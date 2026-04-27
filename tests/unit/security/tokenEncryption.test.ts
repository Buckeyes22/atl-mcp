import { describe, expect, it } from "vitest";
import {
  createTokenEncryption,
  generateMasterKey,
  TokenEncryptionError,
} from "../../../src/security/tokenEncryption.js";

describe("TokenEncryption (envelope encryption)", () => {
  it("seal → open round-trips a UTF-8 token", () => {
    const enc = createTokenEncryption(generateMasterKey());
    const plaintext = "ATATT3xFfGN0EXAMPLE-token-vKj4";
    const sealed = enc.seal(plaintext);
    expect(sealed.algo).toBe("xchacha20poly1305");
    expect(sealed.ciphertext).not.toContain(plaintext);
    expect(enc.open(sealed)).toBe(plaintext);
  });

  it("seal of the same plaintext twice produces different ciphertexts (random nonce)", () => {
    const enc = createTokenEncryption(generateMasterKey());
    const a = enc.seal("same-input");
    const b = enc.seal("same-input");
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.nonce).not.toBe(b.nonce);
    expect(enc.open(a)).toBe("same-input");
    expect(enc.open(b)).toBe("same-input");
  });

  it("rejects a master key of the wrong length", () => {
    expect(() => createTokenEncryption(new Uint8Array(16))).toThrow(TokenEncryptionError);
  });

  it("decryption fails when the ciphertext is tampered with", () => {
    const enc = createTokenEncryption(generateMasterKey());
    const sealed = enc.seal("real-token");
    const tampered = { ...sealed, ciphertext: Buffer.from(sealed.ciphertext, "base64").reverse().toString("base64") };
    expect(() => enc.open(tampered)).toThrow(TokenEncryptionError);
  });

  it("decryption fails when the wrong master key is used", () => {
    const enc1 = createTokenEncryption(generateMasterKey());
    const enc2 = createTokenEncryption(generateMasterKey());
    const sealed = enc1.seal("secret");
    expect(() => enc2.open(sealed)).toThrow(TokenEncryptionError);
  });

  it("masterKeyId is deterministic from the key bytes", () => {
    const key = generateMasterKey();
    const a = createTokenEncryption(key);
    const b = createTokenEncryption(key);
    expect(a.masterKeyId).toBe(b.masterKeyId);
    expect(a.masterKeyId).toMatch(/^[0-9a-f]{16}$/);
  });
});
