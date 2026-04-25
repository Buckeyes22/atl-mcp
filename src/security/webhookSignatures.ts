// Webhook signature verification.
//
// Generic HMAC-SHA256 + timing-safe comparison. Used by:
//   - Bitbucket Cloud webhooks (X-Hub-Signature: sha256=<hex>)
//   - Atlassian webhooks (Atlassian sets X-Hub-Signature too when configured with a secret)
//   - GitHub webhooks (X-Hub-Signature-256: sha256=<hex>)
//   - Stripe-style (Stripe-Signature: t=<ts>,v1=<hex>) — handled by a separate format helper
//
// Pattern from project-foundation F-026 (HMAC-SHA256 with timingSafeEqual)
// and F-024 (constant-length comparison).
//
// All verifiers take the RAW request body (before any parsing). Even
// whitespace differences invalidate the signature.

import { createHmac, timingSafeEqual } from "node:crypto";

export interface VerifyOptions {
  /** Hex-encoded signature, optionally with a `sha256=` prefix. */
  readonly signatureHeader: string;
  /** Raw request body bytes. */
  readonly body: Uint8Array | string;
  /** The webhook secret configured in the upstream provider. */
  readonly secret: string;
  /** Algorithm; default `sha256`. */
  readonly algo?: "sha256" | "sha512";
}

/**
 * Verify a webhook signature in the Hub-style header format
 * (X-Hub-Signature / X-Hub-Signature-256).
 *
 * Returns true iff the body's HMAC under the secret equals the header value.
 * False on every kind of mismatch (different bytes, different length, no prefix).
 */
export function verifyHubSignature(opts: VerifyOptions): boolean {
  const algo = opts.algo ?? "sha256";
  const presented = stripSchemePrefix(opts.signatureHeader, algo);
  if (presented === undefined) return false;

  // Compute the expected HMAC.
  const bodyBytes = typeof opts.body === "string" ? Buffer.from(opts.body, "utf8") : Buffer.from(opts.body);
  const expectedHex = createHmac(algo, opts.secret).update(bodyBytes).digest("hex");

  // Length-check before timingSafeEqual; both buffers must be the same length.
  if (presented.length !== expectedHex.length) return false;

  return timingSafeEqual(Buffer.from(presented, "hex"), Buffer.from(expectedHex, "hex"));
}

/**
 * Verify a Stripe-style signature header:
 *   t=<unix-seconds>,v1=<hex>
 * Stripe (and a few others) sign `${t}.${body}` to bind the signature to a
 * specific timestamp. This prevents indefinite replay.
 */
export function verifyStripeStyleSignature(opts: {
  readonly signatureHeader: string;
  readonly body: Uint8Array | string;
  readonly secret: string;
  /** Reject signatures older than this many seconds. */
  readonly toleranceSeconds: number;
  /** Defaults to Date.now() / 1000. Test seam. */
  readonly nowSeconds?: number;
}): boolean {
  const parts = parseStripeStyleHeader(opts.signatureHeader);
  if (!parts) return false;
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - parts.timestamp) > opts.toleranceSeconds) return false;

  const bodyStr = typeof opts.body === "string" ? opts.body : Buffer.from(opts.body).toString("utf8");
  const signedPayload = `${parts.timestamp}.${bodyStr}`;
  const expectedHex = createHmac("sha256", opts.secret).update(signedPayload, "utf8").digest("hex");

  if (parts.v1.length !== expectedHex.length) return false;
  return timingSafeEqual(Buffer.from(parts.v1, "hex"), Buffer.from(expectedHex, "hex"));
}

// ----- Internal helpers -----

function stripSchemePrefix(header: string, algo: "sha256" | "sha512"): string | undefined {
  const trimmed = header.trim();
  const prefix = `${algo}=`;
  const candidate = trimmed.toLowerCase().startsWith(prefix) ? trimmed.slice(prefix.length) : trimmed;
  // Hex digits only — reject any non-hex content (length check happens in caller).
  if (!/^[0-9a-fA-F]+$/.test(candidate)) return undefined;
  return candidate.toLowerCase();
}

interface StripeStyleParts {
  readonly timestamp: number;
  readonly v1: string;
}

function parseStripeStyleHeader(header: string): StripeStyleParts | undefined {
  let timestamp: number | undefined;
  let v1: string | undefined;
  for (const segment of header.split(",")) {
    const [k, ...rest] = segment.split("=");
    if (!k) continue;
    const v = rest.join("=").trim();
    const key = k.trim();
    if (key === "t") {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) timestamp = Math.floor(n);
    } else if (key === "v1") {
      if (/^[0-9a-fA-F]+$/.test(v)) v1 = v.toLowerCase();
    }
  }
  if (timestamp === undefined || v1 === undefined) return undefined;
  return { timestamp, v1 };
}
