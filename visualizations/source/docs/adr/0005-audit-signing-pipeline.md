---
status: accepted
date: 2026-04-25
deciders: [orchestrator-team]
consulted: [agentdiff-pattern, noble-libs-pattern]
informed: [build-agents]
---

# 0005. Audit signing pipeline: ed25519 (@noble/curves) + RFC 8785 JCS canonicalization + git-ref public-key registry

## Context

v6 §28 M6a acceptance bar requires audit entries to be:
- Hash-chained (each entry references its predecessor's payload hash).
- Signed with **ed25519**.
- Canonicalized via **JCS** (RFC 8785) before signing so any byte-equal payload yields the same signature.
- Public keys mirrored to **`refs/orchestrator/keys/{keyId}:pub.key`** so any verifier can fetch the key by `git fetch origin <ref>` and check the signature without trusting a central server.

The original M6a-prep code in `src/security/auditChain.ts` used Node's built-in `crypto.generateKeyPairSync("ed25519")` plus a hand-rolled `Object.keys().sort()` canonicalizer. That landed three problems:
1. Key ephemeral per process — `git fetch` retrieves no key (audit Pass 5 finding **F-003**).
2. Hand-rolled canonicalizer is not RFC 8785 (no number normalization, no surrogate-pair handling).
3. Diverged from ADR 0002 which had pre-decided "noble family" for the same security-review surface (audit finding **F-004**).

## Decision Drivers

- M6a acceptance: real, off-process verification of audit signatures.
- Single security-review surface across token encryption (`@noble/ciphers`, ADR 0002) and audit signing.
- Must work cross-platform (Windows + Linux containers); zero native deps preferred.
- Key rotation must be a clean operation: introduce a new keyId, register, supersede the old via ADR.

## Considered Options

1. **`@noble/curves` ed25519 + `canonicalize` (RFC 8785) + persistent seed file** — pure JS, ESM-first, audited; matches ADR 0002's family; the `canonicalize` package is the most-used JCS implementation on npm.
2. **Node `crypto.sign` with custom canonicalization** — zero deps, but requires authoring/auditing canonicalization. Diverges from ADR 0002.
3. **External KMS** (AWS KMS, GCP KMS, HSM) — strongest security posture; infeasible for v1 because it forces every dev/test path through a cloud round-trip and breaks local development.

## Decision Outcome

**Adopt option 1.**

- Cipher: `@noble/curves/ed25519` (`getPublicKey`, `sign`, `verify`). Private keys are 32-byte seeds; public keys are 32 bytes raw. SPKI PEM derivation uses the standard Ed25519 prefix `30 2a 30 05 06 03 2b 65 70 03 21 00`.
- Canonicalization: `canonicalize` npm package (RFC 8785-aligned). Used for both `sign(JCS(payload))` and `prevHash = sha256(JCS(prevPayload))`.
- Persistence:
  - `AUDIT_SIGNING_PRIVKEY_PATH` env var configures the file location.
  - On startup (`compositionRoot`): if file exists, load. If absent, generate, write `0600`. Either way, register the public key into the git-ref registry.
  - When unset (dev/tests): use an ephemeral keypair per process. Logs a warning at startup.
- Registry: `createGitRefKeyRegistryRepository.registerPublicKey(keyId, pem)` shells out to `git hash-object` + `git update-ref`. Idempotent.
- Key rotation: minted by re-running the bootstrap with a new path; old keys remain registered (verifiable for historical audit entries) and are superseded via a successor ADR.

## Consequences

### Good

- M6a acceptance unblocked: `git fetch origin refs/orchestrator/keys/<keyId>` retrieves the public key; any verifier can check signatures off-process.
- Single noble-family security surface across `@noble/ciphers` (ADR 0002) and `@noble/curves` (this ADR).
- JCS canonicalization is industry-standard; any other JCS implementation (in another language) verifies our signatures.
- Zero native deps.

### Bad

- Adds two npm dependencies: `@noble/curves`, `canonicalize`. Both are tiny (<10 KB combined) and well-maintained.
- Bootstrap path requires the orchestrator to shell out to `git`. Acceptable: the operator needs `git` on PATH for any provisioning work anyway.

### Neutral

- KMS migration post-v1 is now a single-file change at the bootstrap step in `compositionRoot`: replace the file-based seed load with a KMS data-key envelope; the `AuditSigner` interface stays identical.
- The historic ephemeral-key signatures (signed before this ADR landed) are unrecoverable. v6 M6a hadn't shipped yet so no production audit entries exist.

## More Information

- `src/security/auditChain.ts` — implementation.
- `src/compositionRoot.ts` — bootstrap path.
- `src/storage/repositories/keyRegistryRepository.ts` — git-ref registration.
- `tests/integration/security/auditChain.test.ts` — round-trip + canonicalization tests.
- `docs/audit-findings-2026-04-25.md` F-003, F-004 — origin findings.
- `docs/partners/agentdiff.md` §6 — pattern reference.
