// Audit chain — ed25519 signatures over JCS-canonicalized records.
//
// Design (closes F-003 + F-004):
// - Cipher: @noble/curves ed25519, matching ADR 0002's "noble family" rationale.
// - Canonicalization: RFC 8785 JCS via the `canonicalize` npm module.
// - Key persistence: createAuditSigner accepts a pre-loaded keypair. The
//   bootstrap path (load-from-disk or generate-and-write) lives in the
//   composition root; this module is pure crypto.
// - Public key registration into the git-ref registry happens at bootstrap
//   time via storage/repositories/keyRegistryRepository, also out-of-band
//   from this module.

import { createHash, randomBytes } from "node:crypto";
import { ed25519 } from "@noble/curves/ed25519.js";
import canonicalize from "canonicalize";
import type { AuditEntry } from "../domain/auditEntry.js";

export interface AuditSigner {
  readonly keyId: string;
  /** PEM-encoded SubjectPublicKeyInfo for registry registration. */
  readonly publicKeyPem: string;
  sign(entry: AuditEntry): AuditEntry;
  verify(entry: AuditEntry): boolean;
}

export interface AuditKeyMaterial {
  readonly privateKey: Uint8Array;  // 32 bytes (ed25519 seed)
  readonly publicKey: Uint8Array;   // 32 bytes
  readonly keyId: string;           // 16-hex of sha256(publicKey)
  readonly publicKeyPem: string;
}

/** Generates a new ed25519 keypair using @noble/curves. */
export function generateAuditKeypair(): AuditKeyMaterial {
  const privateKey = randomBytes(32);
  const publicKey = ed25519.getPublicKey(privateKey);
  const keyId = sha256Hex(publicKey).slice(0, 16);
  return { privateKey, publicKey, keyId, publicKeyPem: encodeSpkiPem(publicKey) };
}

/** Derives the key material from an existing private key (32-byte seed). */
export function loadAuditKeypair(privateKey: Uint8Array): AuditKeyMaterial {
  if (privateKey.length !== 32) {
    throw new Error(`ed25519 private key must be 32 bytes, got ${privateKey.length}`);
  }
  const publicKey = ed25519.getPublicKey(privateKey);
  const keyId = sha256Hex(publicKey).slice(0, 16);
  return { privateKey, publicKey, keyId, publicKeyPem: encodeSpkiPem(publicKey) };
}

/**
 * Build a signer from pre-loaded key material. When called with no argument,
 * generates a fresh ephemeral keypair (legacy behavior, kept for tests).
 */
export function createAuditSigner(material?: AuditKeyMaterial): AuditSigner {
  const m = material ?? generateAuditKeypair();
  return {
    keyId: m.keyId,
    publicKeyPem: m.publicKeyPem,
    sign(entry) {
      const unsigned = { ...entry, signature: { alg: "ed25519" as const, keyId: m.keyId, value: "" } };
      const signature = Buffer.from(ed25519.sign(Buffer.from(canonicalizeJcs(unsigned), "utf8"), m.privateKey)).toString("base64");
      return { ...unsigned, signature: { alg: "ed25519", keyId: m.keyId, value: signature } };
    },
    verify(entry) {
      const unsigned = { ...entry, signature: { ...entry.signature, value: "" } };
      try {
        return ed25519.verify(
          Buffer.from(entry.signature.value, "base64"),
          Buffer.from(canonicalizeJcs(unsigned), "utf8"),
          m.publicKey,
        );
      } catch {
        return false;
      }
    },
  };
}

/** RFC 8785 JCS canonicalization via the `canonicalize` package. */
export function canonicalizeJcs(value: unknown): string {
  const result = canonicalize(value);
  if (result === undefined) throw new Error("canonicalize returned undefined; value is not JSON-serializable");
  return result;
}

export function auditPayloadHash(value: unknown): string {
  return sha256Hex(Buffer.from(canonicalizeJcs(value)));
}

export function sha256Text(value: string): string {
  return sha256Hex(Buffer.from(value));
}

function sha256Hex(value: Buffer | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Encode a 32-byte ed25519 raw public key as SPKI PEM (RFC 8410). */
function encodeSpkiPem(rawPublicKey: Uint8Array): string {
  // SPKI for Ed25519: 30 2a 30 05 06 03 2b 65 70 03 21 00 || 32-byte key
  const spkiPrefix = Buffer.from([0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00]);
  const der = Buffer.concat([spkiPrefix, Buffer.from(rawPublicKey)]);
  const b64 = der.toString("base64");
  const lines = b64.match(/.{1,64}/g) ?? [b64];
  return ["-----BEGIN PUBLIC KEY-----", ...lines, "-----END PUBLIC KEY-----"].join("\n") + "\n";
}
