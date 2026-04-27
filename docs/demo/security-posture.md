# Security Posture

> **↗ Canonical version:** [`docs/sdlc/06-security/`](../sdlc/06-security/) — full threat model, controls matrix, token storage, audit chain threat model, webhook verification, policy decision layer, secrets management, lethal trifecta, vulnerability disclosure. Plus security NFRs at [`docs/sdlc/03-requirements/nfr-security.md`](../sdlc/03-requirements/nfr-security.md).
> One-page summary. Long form mirrored in [`ACO/Security`](https://lateapexllc.atlassian.net/wiki/spaces/ACO) Confluence.

---

## Trust boundaries

External callers (auth at session start) → server (policy decisions on every state-changing op) → external systems.

- **Client → server:** MCP session start authenticates build agents; admin REST authenticates operators. See [`src/mcp/sessionCapabilities.ts`](../../src/mcp/sessionCapabilities.ts) for the capability negotiation that gates session-level access.
- **Server → external systems:** Atlassian via API token or OAuth 3LO ([`src/providers/atlassian/auth/`](../../src/providers/atlassian/auth/)); Bitbucket via app password or OAuth ([ADR-0004](../adr/0004-bitbucket-app-password-vs-oauth.md)).
- **Server → audit:** Every state change generates an audit entry ([`src/storage/schema/auditEntries.ts`](../../src/storage/schema/auditEntries.ts), [ADR-0005](../adr/0005-audit-signing-pipeline.md)).

## Data sensitivity

- **Tokens** are encrypted at rest with libsodium primitives via [@noble/ciphers](../adr/0002-token-encryption-noble-ciphers.md). Plaintext exists only in memory during request signing.
- **Audit entries** are tamper-evident via SHA-256 hash linkage and ed25519 signatures (v6 §30.1).
- **Project profiles** are treated as untrusted input. Validated against schemas in [`src/domain/`](../../src/domain/) before any downstream processing.

## Threat model — STRIDE summary

| Threat | Mitigation |
|---|---|
| **Spoofing** | Auth at session start; OAuth/API token validation per request |
| **Tampering** | Hash-chained audit log; signed entries; offline verifier |
| **Repudiation** | Signed audit entries with `actor` field; key-id traceability |
| **Information disclosure** | Encrypted token store; no PII in logs (pino field redaction) |
| **DoS** | Rate limiting on admin REST; retry-with-backoff on Atlassian 429s |
| **Elevation of privilege** | Policy decision layer denies by default; explicit allow rules required |

## Cryptographic primitives

- Hashing: SHA-256 (audit chain).
- Signing: ed25519 (audit chain), HMAC-SHA256 (webhook verification).
- Encryption: XChaCha20-Poly1305 via @noble/ciphers (token storage at rest).

All primitives are NIST-approved or widely audited. No custom cryptography. ADR-0002 documents the library choice rationale.

## Known gaps

- **Master key rotation** is manual and requires a documented re-encrypt drill (Incident C in runbook). Tracked: [PCO-57](https://lateapexllc.atlassian.net/browse/PCO-57).
- **Per-tenant key isolation** is not implemented; v1 is single-tenant. Tracked: [PCO-51](https://lateapexllc.atlassian.net/browse/PCO-51) (multi-tenant runway spike). Documented: v6 §7.3.
- **OAuth 3LO refresh races** under concurrent calls produce intermittent 401s. Tracked: [PCO-59](https://lateapexllc.atlassian.net/browse/PCO-59). Workaround: fall back to API token auth.
- **Audit chain rotation procedure** has been designed (ADR-0005) but has not been exercised end-to-end against a production-shaped chain. The verifier handles the spec; the rotation runbook needs a real drill.

These are not theoretical concerns — each is documented with a tracking ticket and a workaround if applicable.

## What this proves

If you're a security-minded interviewer, this page demonstrates:

1. **Knowledge of trust boundaries.** Three named boundaries with explicit auth + audit obligations at each.
2. **Named primitives.** Specific algorithms with specific reasons (per ADRs).
3. **Named gaps.** Real risks with tracking tickets and either workarounds or documented runways.
4. **No security theater.** The policy decision layer denies by default; the audit chain is verifiable; the token store is encrypted. No "we plan to do this someday" claims.

If you're not security-minded, the runbook page is more relevant — it covers operational implications of these primitives.
