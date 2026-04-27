---
status: accepted
date: 2026-04-25
deciders: [orchestrator-team]
consulted: []
informed: [build-agents]
---

# 0002. Token-store envelope encryption uses @noble/ciphers (xchacha20poly1305)

## Context

v6 §28 M1 specifies an "encrypted token store using envelope encryption (libsodium secretbox or KMS data key), with a test double for local unit tests." The orchestrator persists provider tokens (Atlassian API tokens, OAuth refresh tokens, Bitbucket app passwords). These must be encrypted at rest, with a master key separate from the database, and the cipher choice must work cross-platform — Windows dev (no native deps preferred) and Linux production containers.

## Decision Drivers

- M1 must ship with envelope encryption working today, not "after KMS is wired up."
- Local development must not require native modules (Windows + Docker compatibility, simple `npm install`).
- Per-record data keys must be wrapped by a master key so master-key rotation doesn't require re-encrypting every token (just unwrap the per-record data key with the old master, re-wrap with the new).
- The signing pipeline in M6a will use ed25519 from @noble/curves; consistency in the noble family lowers cognitive load and keeps the audit + token security stack on one set of primitives.

## Considered Options

1. **`@noble/ciphers` xchacha20poly1305** — pure JS, audited, ESM-first, zero native deps. 24-byte nonce (safe to randomize). Same maintainer family as the agentdiff-equivalent ed25519 choice in M6a.
2. **`libsodium-wrappers`** — emscripten-compiled libsodium. Battle-tested, but adds ~300KB and a WASM warm-up. Native FFI alternatives (`sodium-native`) are faster but require native bindings and platform-specific builds.
3. **Node's built-in `crypto.createCipheriv("chacha20-poly1305", ...)`** — no extra dependency. ChaCha20-Poly1305 (12-byte nonce) is fine but the smaller nonce makes random nonces marginally riskier at very high rates; XChaCha20 (24-byte nonce) is the safer default and only available via third-party libs.
4. **AWS KMS / GCP KMS** — strong choice for deployed mode but cannot be the M1 default (would block local dev without cloud creds). Will land as an optional adapter post-v1; the master-key wrapping abstraction in M1 already supports a future swap.

## Decision Outcome

**Adopt @noble/ciphers xchacha20poly1305 for both the per-record data key encryption and the master-key wrapping of data keys.** Master key is 32 bytes; nonces are 24 bytes (random per operation; safe given the nonce space). Master key id is `sha256(masterKey).slice(0, 16)` and is recorded on every encrypted record so future key rotation can identify which master key wrapped each record.

The boundary is clean enough that swapping to KMS post-v1 is a single-file change:
- `createTokenEncryption(masterKey)` becomes `createKmsTokenEncryption(kmsClient, keyId)` and gets wrapped behind the same `TokenEncryption` interface.
- The on-disk schema (`encrypted_tokens` table) carries `masterKeyId` already; KMS records will use the KMS key ARN here.

A test double (`createTestDoubleTokenEncryption`) is provided for unit tests that exercise code paths but don't care about real crypto. The double encodes plaintext as base64 with `algo: "test-plaintext"`, so production code paths cannot accidentally read test-double records (the `open()` method would refuse).

## Consequences

### Good

- Zero native dependencies. `npm install` succeeds on Windows, Linux, macOS without compiler. Docker builds stay multi-stage simple.
- ESM-first; aligns with the orchestrator's `"type": "module"` convention.
- Same maintainer family (paulmillr) as the curves library M6a will use for ed25519 signing — single security-review surface.
- Per-record data keys + 24-byte random nonces eliminate the practical nonce-reuse risk that plagues smaller-nonce ciphers at high message volumes.

### Bad

- Pure-JS performance is lower than native libsodium (~5×). Token operations are infrequent (login + refresh; not hot-path), so the absolute cost is irrelevant — but document it so a future profiling pass doesn't get surprised.
- @noble/ciphers v2 requires explicit `.js` suffixes on submodule imports (e.g., `@noble/ciphers/chacha.js`). NodeNext-style imports throughout the orchestrator already use this convention, so no friction in practice.

### Neutral

- KMS migration post-v1 is a known follow-up. The `TokenEncryption` interface boundary makes this a contained swap.
- Master-key rotation in M1 is manual: introduce a new master key, recover all tokens via old master, re-encrypt under new. Lazy re-wrap on read (decrypt with old, re-seal with new) is implemented in a follow-up ADR when first needed.

## More Information

- v6 plan §28 M1 (Acceptance: "Encrypted token round-trip passes").
- v6 plan §20 (Auth modes; tokens stored via this layer).
- [`docs/partners/agentdiff.md`](../partners/agentdiff.md) §6 — uses `@noble/ed25519` for the audit signing pipeline (M6a), the same family choice as this ADR.
- `src/security/tokenEncryption.ts` — implementation.
- `src/security/tokenStore.ts` — public API; wraps encryption + the encryptedTokens repo.
- `tests/unit/security/tokenEncryption.test.ts` — round-trip + tamper + wrong-key tests.
- `tests/integration/storage/tokenStore.test.ts` — end-to-end encrypted persistence.

## Status notes

- 2026-04-25: ADR 0005 ratifies the audit signing pipeline using `@noble/curves` ed25519, completing the "noble family" alignment this ADR previewed in More Information. F-004 in audit findings.
- KMS migration remains post-v1 per Decision Outcome.
