---
title: NFR — Security
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, auditor]
sdlc_category: 03-requirements
related: [docs/sdlc/06-security/threat-model.md, docs/sdlc/06-security/controls-matrix.md]
---

# Non-Functional Requirements — Security

> **TL;DR:** Confidentiality (tokens encrypted at rest, plaintext only in memory), integrity (audit chain hash + signature), authenticity (every state change auditable to an actor), non-repudiation (signed by ed25519, key registry git ref). Single-tenant scope assumption is encoded in storage; multi-tenant is documented runway. The threat model in [`../06-security/threat-model.md`](../06-security/threat-model.md) is the operational expansion of these requirements.

This is the requirements view; the controls view is [`../06-security/controls-matrix.md`](../06-security/controls-matrix.md). Each NFR maps to a threat in the model.

---

## Confidentiality

| Requirement | Means |
|---|---|
| **NFR-S-1**: Tokens are not readable from storage without the master key | XChaCha20-Poly1305 envelope encryption (ADR-0002); master key in env, never in DB |
| **NFR-S-2**: Tokens are not in logs | Pino redact config; lint enforces no `console.*` in `src/` |
| **NFR-S-3**: Customer source code (when read into context) is treated as PRIVATE | Classification policy enforces; redaction in context-pack generation |
| **NFR-S-4**: Audit signing private key is not on disk in source-controlled locations | `AUDIT_KEYPAIR_PATH` points to a non-tracked file; mode 0400 |
| **NFR-S-5**: Master key (TOKEN_MASTER_KEY) is provided by secret manager in production | Operational; verified during deploys |

## Integrity

| Requirement | Means |
|---|---|
| **NFR-S-6**: Audit log entries cannot be modified without detection | Hash chain + ed25519 signatures; offline verifier (ADR-0005) |
| **NFR-S-7**: Tokens cannot be modified without detection | AEAD construction (XChaCha20-Poly1305 includes auth tag); ciphertext changes detected on decrypt |
| **NFR-S-8**: Provisioning operations are idempotent — replays produce no extra writes | Idempotency keys + unique constraints |
| **NFR-S-9**: Schema migrations are rehearsed before applying to production | Migration runner with rehearsal mode (PCO-13) |
| **NFR-S-10**: Webhook bodies cannot be tampered with in transit | HMAC-SHA256 verification before parsing |

## Authenticity

| Requirement | Means |
|---|---|
| **NFR-S-11**: Every state change has a recorded actor | `actor` column in `auditEntries`; populated at write time |
| **NFR-S-12**: MCP sessions authenticate at session start | Capability negotiation per v6 §2.2 |
| **NFR-S-13**: Operator actions on mgmt REST authenticate (when not loopback) | Loopback by default; auth headers required if non-loopback |
| **NFR-S-14**: Webhooks authenticate the source via shared secret | HMAC-SHA256 per source |

## Non-repudiation

| Requirement | Means |
|---|---|
| **NFR-S-15**: Audit entries cannot be plausibly denied by the actor | ed25519 signature; verifier proves signature against the key registered for the actor's session at the time |
| **NFR-S-16**: Key rotations are themselves audit events | Rotation procedure (audit-chain-threat-model.md) writes a rotation entry signed with the new key |
| **NFR-S-17**: Refused operations are recorded | Policy denials emit audit entries (with the deny outcome) |

## Authorization

| Requirement | Means |
|---|---|
| **NFR-S-18**: Every state-changing operation is gated by the policy decision layer | `policyDecisionLayer.evaluate()` invariant |
| **NFR-S-19**: Default policy is deny in strict mode (production) | `POLICY_STRICT_MODE=true` in production tier |
| **NFR-S-20**: Cross-project writes require explicit approval | Code-policy adapter rule; T-2206 mitigation |

## Lethal-trifecta protection

| Requirement | Means |
|---|---|
| **NFR-S-21**: Operations combining (read PRIVATE) + (process UNTRUSTED) + (emit EXTERNAL) are blocked or require approval | v6 §38.1; [`../06-security/lethal-trifecta.md`](../06-security/lethal-trifecta.md) |
| **NFR-S-22**: Detection events are auditable | Detection generates an audit entry tagged `lethal_trifecta` |

## Tenant isolation (v1)

| Requirement | Means |
|---|---|
| **NFR-S-23**: Single-tenant scope is enforced at every storage boundary | `assertTenantMatches` at every repository read/write |
| **NFR-S-24**: Multi-tenant cross-customer isolation is out of scope for v1 | v6 §7.3 documents the runway; tracked PCO-51 |

## Cryptographic compliance

| Requirement | Means |
|---|---|
| **NFR-S-25**: Algorithms are NIST-approved or widely audited | SHA-256, HMAC-SHA256, ed25519, XChaCha20-Poly1305 (audited primitives via @noble/ciphers per ADR-0002) |
| **NFR-S-26**: No custom cryptography | Library primitives only |
| **NFR-S-27**: Constant-time comparison for HMAC | `node:crypto.timingSafeEqual` in webhook verifier |

## Secret lifecycle

| Requirement | Means |
|---|---|
| **NFR-S-28**: Secrets are versioned in the secret manager | Provider-specific; documented in [`../06-security/secrets-mgmt.md`](../06-security/secrets-mgmt.md) |
| **NFR-S-29**: Secret rotation is documented procedure | Per-secret runbooks |
| **NFR-S-30**: Compromised secrets can be rotated in < 1 hour | Operational; relies on operator availability |

## Vulnerability disclosure

| Requirement | Means |
|---|---|
| **NFR-S-31**: A reported vulnerability is acknowledged within 5 business days | Stated in [`../06-security/vulnerability-disclosure.md`](../06-security/vulnerability-disclosure.md) |
| **NFR-S-32**: Critical vulnerabilities are patched within 7 days of report | Same source |

## Compliance posture

For v1 single-tenant on-prem deployment:

- **GDPR**: applicability TBD; depends on customer's data; default position is "no PII persistence" (project profiles describe code, not people). [`compliance-scope.md`](compliance-scope.md).
- **SOC2**: not in scope for v1. Post-v1 depending on commercialization.
- **HIPAA**: explicitly not applicable (no PHI handled).

## Linked artifacts

- **Threat model:** [`../06-security/threat-model.md`](../06-security/threat-model.md)
- **Controls matrix:** [`../06-security/controls-matrix.md`](../06-security/controls-matrix.md)
- **ADRs:** [ADR-0002](../../adr/0002-token-encryption-noble-ciphers.md), [ADR-0005](../../adr/0005-audit-signing-pipeline.md)
- **Compliance scope:** [`compliance-scope.md`](compliance-scope.md)
- **Sibling NFRs:** [`nfr-availability.md`](nfr-availability.md), [`nfr-performance.md`](nfr-performance.md), [`nfr-scalability.md`](nfr-scalability.md)
- **Test plan:** [`../07-testing/security-test-plan.md`](../07-testing/security-test-plan.md)
- **Spec:** v6 §30 (security), §38 (lethal trifecta + ACL)

---

*Last reviewed: 2026-04-25 by Chris.*
