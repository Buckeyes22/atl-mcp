---
title: Security Controls Matrix
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, auditor]
sdlc_category: 06-security
related: [docs/sdlc/06-security/threat-model.md, docs/sdlc/07-testing/security-test-plan.md]
---

# Security Controls Matrix

> **TL;DR:** Maps every threat from [`threat-model.md`](threat-model.md) to the control(s) that mitigate it and the test(s) that prove the control holds. Auditors should be able to point to any threat and trace it to a code path and a test path.

Threat IDs come from [`threat-model.md`](threat-model.md). Controls are categorized as **preventive** (block the attack), **detective** (notice the attack), or **corrective** (recover from a successful attack).

---

## Master matrix

| Threat | Control class | Control (path / mechanism) | Test | Residual |
|---|---|---|---|---|
| T-1101 spoof MCP session | Preventive | Capability negotiation; session-bound credentials. `src/mcp/sessionCapabilities.ts` | `tests/unit/sessionCapabilities.test.ts` | Stolen creds → impersonation possible |
| T-1102 replay MCP request | Preventive | Idempotency keys; TLS transport. `src/storage/repositories/projectRepository.ts` | `tests/integration/storage/repositories.test.ts` | Concurrent same-key → resolved by unique constraint |
| T-1103 forge webhook | Preventive | HMAC-SHA256 per source. `src/security/webhookSignatures.ts` | `tests/unit/security/webhookSignatures.test.ts` | Stolen secret → rotation needed |
| T-1104 replay webhook | Preventive | Delivery dedup by `(source, deliveryId)`. v6 §26.1 | (M10 work; PCO-XX) | If source reuses deliveryId, dedup fails |
| T-1105 DoS MCP transport | Preventive | Max-concurrent cap (1000); session TTL eviction. v6 §22.1 | Capacity test (load-test-runbook) | Determined attacker can saturate cap |
| T-1106 DoS mgmt REST | Preventive | Loopback-only binding by default. `src/config/env.ts` | `tests/integration/mgmtApi.test.ts` | Non-loopback bind in non-dev gets a startup warning |
| T-1107 inject payload | Preventive | Zod schemas on tool inputs; tenant-scope check in repos | `tests/unit/domain/*`, `tests/unit/domain/tenantScope.test.ts` | Refinement bug → defense in depth |
| T-1108 mgmt privilege escalation | Preventive | No write endpoints on mgmt API; loopback-only | `tests/integration/mgmtApi.test.ts` | Operator on host has loopback access (acceptable) |
| T-2201 exfiltrate tokens | Preventive | XChaCha20-Poly1305 envelope encryption. `src/security/tokenEncryption.ts` (ADR-0002) | `tests/unit/security/tokenEncryption.test.ts`; `tests/integration/storage/tokenStore.test.ts` | Master-key compromise → all tokens decryptable; manual rotation drill (PCO-57) |
| T-2202 token leak via logs | Preventive | Pino redaction; `lint:no-stdout`. `src/observability/logger.ts`; `scripts/lint-no-stdout.mjs` | `tests/lint/no-stdout.test.ts` | New secret-bearing fields can slip through; review every milestone |
| T-2203 SSRF | Preventive | URLs from typed config, not user input. `src/config/env.ts` | (Pending; PCO-XX) | Future user-URL features need re-modeling |
| T-2204 forge upstream response | Preventive | TLS-required outbound | (Default Node TLS) | Pinned-cert / CA compromise out of scope |
| T-2205 trigger rate limit | Preventive + corrective | Retry with backoff; preflight cache TTL. `src/providers/http/retry.ts` | `tests/unit/providers/http/retry.test.ts` | Crafted expensive workloads remain possible |
| T-2206 wrong-project write | Preventive | Policy decision layer; provisioning preview; review gate. `src/security/policyDecisionLayer.ts`; v6 §18 | `tests/unit/security/codePolicyAdapter.test.ts` | Broad allow rules → insider abuse possible |
| T-3301 lethal trifecta | Detective | Trifecta detection per v6 §38.1; logged + escalated | (Adversarial test set, security-test-plan) | Heuristic; novel combos can slip through |
| T-3302 forge audit entry | Preventive + Detective | Hash chain + ed25519 + key registry. `src/storage/schema/auditEntries.ts` (ADR-0005) | `tests/integration/storage/auditRepository.test.ts` | DB-write + key access → forgery possible; split (post-v1) raises bar |
| T-3303 compromise signing key | Preventive | File permissions on keypair; rotation procedure | (Manual permission audit) | Compromise → rotation only recovery |
| T-3304 compromise key registry | Preventive | Git ref protection (signed commits, branch protection) | (Manual audit) | Inheritable from git host security |
| T-3305 audit write silently fails | Detective | Fail closed; alert on audit-write failure | `tests/integration/storage/auditRepository.test.ts` | Brief detection window |
| T-3306 clock manipulation | Detective | Dual timestamps (client + server); verifier flags discrepancies | (Pending; PCO-XX) | Sub-second skew normal |

## By control class

### Preventive controls (block attacks)

- **Cryptographic primitives** — ed25519 (audit), HMAC-SHA256 (webhook), XChaCha20-Poly1305 (token store).
- **Validation** — Zod schemas on every MCP tool input, tenant scope checks at the storage boundary.
- **Configuration discipline** — typed env loader, loopback defaults, TLS-required outbound.
- **Idempotency** — unique constraints + planner-level idempotency keys.
- **Rate / quota limits** — concurrent session cap, session TTL, retry backoff.
- **Permission discipline** — file mode on keypair, git ref protection on key registry.

### Detective controls (notice attacks)

- **Audit chain** — every state change is logged + signed; offline verifier walks the chain.
- **Health endpoints** — `/admin/health`, `/admin/health/audit` surface invariant violations.
- **Observability** — Prometheus counters per v6 §27.2 (tool_calls_blocked_total, etc.); Langfuse traces.
- **Lethal-trifecta detection** — flags risky combinations before execution (v6 §38.1).
- **Lint + anti-stub** — `lint:no-stdout`, anti-stub scanner catch class-of-mistake before merge.

### Corrective controls (recover from successful attacks)

- **Token rotation drill** — runbook procedure for master-key + per-token rotation (Incident C in `docs/sdlc/08-operations/runbook.md`).
- **Audit-chain verifier** — offline tool to validate the chain post-incident; identifies first-tampered entry.
- **Migration rehearsal** — applies migrations to a temp DB before production; PCO-13.
- **Backup / restore** — Postgres point-in-time recovery; audit chain reconstructible from signed entries plus key registry. [`../10-dr-bcp/audit-chain-recovery.md`](../10-dr-bcp/audit-chain-recovery.md).

## Coverage assessment

Where the gaps are honest:

- **T-1104, T-2203, T-3306** have controls designed but tests pending. Tracked with PCO-XX placeholders.
- **T-3303 and T-3304** rely on operational hygiene (file perms, git protection); we don't have an automated test for "the file mode is 0400" — that's a deploy-time check.
- **T-2206** is mitigated but residual risk depends on how broadly the policy adapter is configured. The default `codePolicyAdapter` is conservative; richer rules in M7+ enrich coverage.

## Pending controls (M7+ scope)

- **Per-project allow lists** in the policy adapter (M7).
- **Per-tenant key isolation** for the audit chain (post-v1; v6 §7.3).
- **Bug-bounty program** (post-v1; in [`vulnerability-disclosure.md`](vulnerability-disclosure.md)).
- **Automated permission audit** at deploy (operational tooling, not application).

## Linked artifacts

- **Threat model:** [`threat-model.md`](threat-model.md)
- **Component models:** [`audit-chain-threat-model.md`](audit-chain-threat-model.md), [`token-storage.md`](token-storage.md), [`webhook-verification.md`](webhook-verification.md), [`policy-decision-layer.md`](policy-decision-layer.md), [`lethal-trifecta.md`](lethal-trifecta.md)
- **ADRs:** [ADR-0002](../../adr/0002-token-encryption-noble-ciphers.md), [ADR-0005](../../adr/0005-audit-signing-pipeline.md)
- **Spec:** v6 §30, §38
- **Test plans:** [`../07-testing/security-test-plan.md`](../07-testing/security-test-plan.md)
- **Runbook (corrective):** [`../08-operations/runbook.md`](../08-operations/runbook.md)
- **DR (corrective):** [`../10-dr-bcp/`](../10-dr-bcp/)

---

*Last reviewed: 2026-04-25 by Chris.*
