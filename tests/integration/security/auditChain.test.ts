// F-003 + F-004 closure: ed25519 signer over JCS-canonicalized records.
// - Round-trip sign+verify on the same key passes.
// - Round-trip sign on key A, verify on key B fails.
// - JCS canonicalization is order-independent (key order in source object
//   does not change the signature).
// - Bootstrap path: empty file → key generated + persisted; existing file → reused.

import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createAuditSigner,
  generateAuditKeypair,
  loadAuditKeypair,
  canonicalizeJcs,
} from "../../../src/security/auditChain.js";
import type { AuditEntry } from "../../../src/domain/auditEntry.js";

const FROZEN = "2026-04-25T00:00:00.000Z";

function exampleEntry(): AuditEntry {
  return {
    id: "audit-1",
    tenantId: "default",
    projectId: "proj-1",
    timestamp: FROZEN,
    actor: {
      mcpPrincipalId: "agent@example.com",
      mcpPrincipalFingerprint: "abc",
      credentialFingerprint: "abc",
      authMode: "api_token",
    },
    toolName: "project_provision_execute",
    inputHash: "deadbeef",
    outputArtifactIds: ["PLN-1"],
    prevHash: "0",
    signature: { alg: "ed25519", keyId: "", value: "" },
  };
}

describe("auditChain — ed25519 signer + JCS canonicalization (F-003, F-004)", () => {
  it("round-trips sign → verify on the same key", () => {
    const signer = createAuditSigner();
    const signed = signer.sign(exampleEntry());
    expect(signer.verify(signed)).toBe(true);
  });

  it("rejects when verifying with a different key", () => {
    const signerA = createAuditSigner();
    const signerB = createAuditSigner();
    const signed = signerA.sign(exampleEntry());
    expect(signerB.verify(signed)).toBe(false);
  });

  it("JCS canonicalization is order-independent (RFC 8785)", () => {
    const a = canonicalizeJcs({ a: 1, b: 2, c: { x: 1, y: 2 } });
    const b = canonicalizeJcs({ c: { y: 2, x: 1 }, b: 2, a: 1 });
    expect(a).toBe(b);
  });

  it("loadAuditKeypair recreates the same keyId from a stored seed", () => {
    const original = generateAuditKeypair();
    const reloaded = loadAuditKeypair(original.privateKey);
    expect(reloaded.keyId).toBe(original.keyId);
    expect(Buffer.from(reloaded.publicKey).equals(Buffer.from(original.publicKey))).toBe(true);
  });

  it("publicKeyPem is a well-formed PEM block", () => {
    const m = generateAuditKeypair();
    expect(m.publicKeyPem).toMatch(/^-----BEGIN PUBLIC KEY-----\n/);
    expect(m.publicKeyPem).toMatch(/-----END PUBLIC KEY-----\n$/);
  });

  it("persistent key bootstrap: writing then re-reading the seed yields the same signer", async () => {
    const dir = await mkdtemp(join(tmpdir(), "atl-mcp-audit-"));
    try {
      const keyPath = join(dir, "private.key");
      const generated = generateAuditKeypair();
      await writeFile(keyPath, Buffer.from(generated.privateKey));
      const raw = await readFile(keyPath);
      const reloaded = loadAuditKeypair(new Uint8Array(raw));
      expect(reloaded.keyId).toBe(generated.keyId);
      const signerA = createAuditSigner(generated);
      const signerB = createAuditSigner(reloaded);
      const signed = signerA.sign(exampleEntry());
      expect(signerB.verify(signed)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
