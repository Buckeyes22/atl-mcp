// OAuth 2.0 3LO for Atlassian Cloud.
//
// M2 ships:
//   - Token type definitions (access + refresh + expiry).
//   - Refresh-token rotation logic: on demand or when access token nears expiry.
//   - getAuthHeader() returning "Bearer <accessToken>" with auto-refresh.
//
// M2 does NOT ship the authorization-code dance (that's an interactive
// out-of-band flow). When orchestrator first needs an OAuth credential, an
// operator runs a one-time `orchestrator cli oauth bootstrap` command (lands
// with M2 acceptance documentation) which performs the auth-code flow and
// stores the resulting refresh token via tokenStore. This file consumes the
// stored refresh token and rotates it.

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import type { Logger } from "pino";
import type { AtlassianAuthProvider, AuthDescriptor } from "./types.js";

export interface OAuth3loConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  /** Atlassian token endpoint, e.g. https://auth.atlassian.com/oauth/token. */
  readonly tokenEndpoint: string;
  /** When refresh succeeds, persist the rotated refresh token via this callback. */
  readonly persistRotatedRefreshToken: (refreshToken: string) => Promise<void>;
  /** Loaded plaintext refresh token (e.g., decrypted from token store). */
  readonly initialRefreshToken: string;
  /** Optional initial access token + expiry (saves one refresh on startup). */
  readonly initialAccess?: { token: string; expiresAt: number };
  /** Refresh skew: refresh when access token expires within this many ms. Default 60s. */
  readonly refreshSkewMs?: number;
  readonly logger: Logger;
  /** Test injection — defaults to global fetch. */
  readonly fetchImpl?: typeof fetch;
}

interface CachedAccessToken {
  readonly token: string;
  readonly expiresAt: number;
}

export interface TokenRefreshResponse {
  readonly access_token: string;
  /** Atlassian rotates refresh tokens on every refresh. */
  readonly refresh_token?: string;
  readonly expires_in: number;
  readonly token_type: string;
}

export class OAuth3loRefreshError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "OAuth3loRefreshError";
  }
}

export function createOAuth3loAuth(config: OAuth3loConfig): AtlassianAuthProvider {
  const skew = config.refreshSkewMs ?? 60_000;
  const fetchImpl = config.fetchImpl ?? fetch;

  let refreshToken = config.initialRefreshToken;
  let cached: CachedAccessToken | undefined = config.initialAccess
    ? { token: config.initialAccess.token, expiresAt: config.initialAccess.expiresAt }
    : undefined;
  let inflight: Promise<CachedAccessToken> | undefined;

  // Fingerprint refresh-token (not access — access rotates frequently and is short-lived).
  const credentialFingerprint = bytesToHex(sha256(utf8ToBytes(refreshToken))).slice(0, 8);

  async function refreshAccessToken(): Promise<CachedAccessToken> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
    });
    const res = await fetchImpl(config.tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: body.toString(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new OAuth3loRefreshError(`token refresh failed: ${res.status} ${text}`);
    }
    const json = (await res.json()) as TokenRefreshResponse;
    if (!json.access_token || typeof json.expires_in !== "number") {
      throw new OAuth3loRefreshError("token refresh response missing access_token or expires_in");
    }
    if (json.refresh_token && json.refresh_token !== refreshToken) {
      // Atlassian rotates refresh tokens — persist the new one.
      refreshToken = json.refresh_token;
      try {
        await config.persistRotatedRefreshToken(refreshToken);
      } catch (err) {
        config.logger.error({ err }, "failed to persist rotated refresh token; continuing with in-memory copy");
      }
    }
    const next: CachedAccessToken = {
      token: json.access_token,
      expiresAt: Date.now() + json.expires_in * 1000,
    };
    cached = next;
    return next;
  }

  async function ensureFresh(): Promise<CachedAccessToken> {
    if (cached && cached.expiresAt - skew > Date.now()) return cached;
    if (inflight) return inflight;
    inflight = refreshAccessToken().finally(() => {
      inflight = undefined;
    });
    return inflight;
  }

  return {
    mode: "oauth3lo",
    async getAuthHeader() {
      const fresh = await ensureFresh();
      return `Bearer ${fresh.token}`;
    },
    describe(): AuthDescriptor {
      return {
        mode: "oauth3lo",
        credentialFingerprint,
        principalId: config.clientId,
        autoRotates: true,
      };
    },
  };
}
