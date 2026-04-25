// Envelope-encrypted token store.
//
// Pattern: a 32-byte master key (loaded from env or KMS at process start)
// wraps per-record data keys. Each record has its own data key + nonce, and
// the data key itself is encrypted by the master key using xchacha20poly1305.
//
// AEAD choice: xchacha20-poly1305 (24-byte nonce; safe to randomize without
// collision risk; @noble/ciphers pure-JS implementation, no native bindings).
//
// M1 supports a single master key version. Key rotation (multiple master
// keys, lazy re-wrap on next read) lands post-v1; the `masterKeyId` column
// already records which key version was used for each record.
//
// Test seam: `TokenEncryption` interface lets tests inject a no-op double
// (see tokenEncryption.testDouble.ts) instead of running real crypto.

import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { randomBytes } from "@noble/ciphers/utils.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

const ALGO = "xchacha20poly1305";
const NONCE_LEN = 24;
const KEY_LEN = 32;

export interface SealedToken {
  readonly algo: string;
  readonly wrappedDataKey: string;
  readonly wrapNonce: string;
  readonly ciphertext: string;
  readonly nonce: string;
  readonly masterKeyId: string;
}

export interface TokenEncryption {
  seal(plaintext: string): SealedToken;
  open(sealed: SealedToken): string;
  /** First 16 hex of sha256(masterKey) — for audit + rotation tracking. */
  readonly masterKeyId: string;
}

export class TokenEncryptionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "TokenEncryptionError";
  }
}

export function createTokenEncryption(masterKey: Uint8Array): TokenEncryption {
  if (masterKey.length !== KEY_LEN) {
    throw new TokenEncryptionError(`master key must be ${KEY_LEN} bytes; got ${masterKey.length}`);
  }
  const masterKeyId = bytesToHex(sha256(masterKey)).slice(0, 16);

  return {
    masterKeyId,

    seal(plaintext: string): SealedToken {
      const dataKey = randomBytes(KEY_LEN);
      const nonce = randomBytes(NONCE_LEN);
      const wrapNonce = randomBytes(NONCE_LEN);

      const cipher = xchacha20poly1305(dataKey, nonce);
      const ciphertext = cipher.encrypt(utf8ToBytes(plaintext));

      const wrap = xchacha20poly1305(masterKey, wrapNonce);
      const wrappedDataKey = wrap.encrypt(dataKey);

      return {
        algo: ALGO,
        wrappedDataKey: toBase64(wrappedDataKey),
        wrapNonce: toBase64(wrapNonce),
        ciphertext: toBase64(ciphertext),
        nonce: toBase64(nonce),
        masterKeyId,
      };
    },

    open(sealed: SealedToken): string {
      if (sealed.algo !== ALGO) {
        throw new TokenEncryptionError(`unsupported algo: ${sealed.algo}`);
      }
      if (sealed.masterKeyId !== masterKeyId) {
        throw new TokenEncryptionError(
          `master key id mismatch (record=${sealed.masterKeyId}, current=${masterKeyId})`,
        );
      }
      try {
        const wrap = xchacha20poly1305(masterKey, fromBase64(sealed.wrapNonce));
        const dataKey = wrap.decrypt(fromBase64(sealed.wrappedDataKey));

        const cipher = xchacha20poly1305(dataKey, fromBase64(sealed.nonce));
        const plaintextBytes = cipher.decrypt(fromBase64(sealed.ciphertext));
        return new TextDecoder().decode(plaintextBytes);
      } catch (err) {
        throw new TokenEncryptionError("decryption failed (wrong key, tampered ciphertext, or corrupt nonce)", { cause: err });
      }
    },
  };
}

/** Generate a fresh 32-byte master key (e.g., for tests or one-time bootstrap). */
export function generateMasterKey(): Uint8Array {
  return randomBytes(KEY_LEN);
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function fromBase64(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64"));
}
