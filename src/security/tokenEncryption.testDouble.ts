// Test double for TokenEncryption — no real crypto, plaintext round-trip.
// Use this in unit tests that need to call code paths that depend on
// TokenEncryption but don't care about the cryptographic guarantees.
// DO NOT import this from src/server.ts — only from test code.

import type { SealedToken, TokenEncryption } from "./tokenEncryption.js";

export function createTestDoubleTokenEncryption(masterKeyId = "test-double"): TokenEncryption {
  return {
    masterKeyId,
    seal(plaintext: string): SealedToken {
      return {
        algo: "test-plaintext",
        wrappedDataKey: "",
        wrapNonce: "",
        ciphertext: Buffer.from(plaintext, "utf8").toString("base64"),
        nonce: "",
        masterKeyId,
      };
    },
    open(sealed: SealedToken): string {
      if (sealed.algo !== "test-plaintext") {
        throw new Error(`testDouble can only open test-plaintext records; got algo=${sealed.algo}`);
      }
      return Buffer.from(sealed.ciphertext, "base64").toString("utf8");
    },
  };
}
