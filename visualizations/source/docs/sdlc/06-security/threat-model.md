---
title: Threat Model
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, auditor]
sdlc_category: 06-security
related: [docs/sdlc/02-architecture/trust-boundaries.md, docs/sdlc/06-security/controls-matrix.md, agent-context-orchestrator-mcp-plan-v6.md §30, §38]
---

# Threat Model — Agent Context Orchestrator (atl-mcp)

> **TL;DR:** STRIDE-organized threat model across the three trust boundaries. Highest-impact threats: forging audit entries (T-1101), exfiltrating tokens (T-2201), and lethal-trifecta exposures (T-3301, v6 §38.1). Each threat has a control, a test, and a residual-risk note. Multi-tenant attack surface is out of scope (single-tenant v1).

This is the parent threat model. Per-component models follow the same shape — see [`audit-chain-threat-model.md`](audit-chain-threat-model.md), [`webhook-verification.md`](webhook-verification.md), [`token-storage.md`](token-storage.md), [`policy-decision-layer.md`](policy-decision-layer.md). Threat IDs are namespaced: `T-1xxx` boundary 1, `T-2xxx` boundary 2, `T-3xxx` cross-cutting.

---

## Scope

- **In:** atl-mcp v1 single-tenant deployment. All code in `src/`. The audit chain. The webhook surface. The mgmt REST API. The MCP transport.
- **Out:** Multi-tenant routing (post-v1; runway in v6 §7.3). Atlassian Cloud / Bitbucket Cloud as systems (their own threat models). Agent host security (Claude Code / Cursor / Codex run on the user's machine). The user's own dev environment.
- **Audience:** internal review + customer security reviewers + auditors.

## Assets

What we're protecting and at what classification (per [`../05-data/classification.md`](../05-data/classification.md)):

| Asset | Classification | Confidentiality | Integrity | Authenticity | Availability |
|---|---|---|---|---|---|
| Atlassian / Bitbucket API tokens | SECRET | High | High | High | Medium |
| Audit chain entries | INTERNAL | Low (intentionally readable) | **Critical** | **Critical** | High |
| Audit signing keys (private half) | SECRET | **Critical** | High | High | Medium |
| Audit signing keys (public half, in registry) | INTERNAL | Low | High | High | Medium |
| Project profiles + blueprints | INTERNAL | Medium | High | Medium | Medium |
| Context packs (post-redaction) | INTERNAL | Medium | High | Medium | Low |
| Customer source code (read in context) | PRIVATE | High | n/a (read-only) | n/a | Low |
| MCP session state | INTERNAL | Medium | Medium | Medium | Medium |
| Operator credentials (mgmt REST) | SECRET | High | High | High | Medium |
| Webhook shared secrets | SECRET | High | High | High | Medium |
| TOKEN_MASTER_KEY | SECRET | **Critical** | **Critical** | High | Medium |

Asset criticality drives prioritization in the controls matrix.

## Adversaries

| Adversary | Capabilities | Motivation | In scope for v1 |
|---|---|---|---|
| Curious insider (operator/dev) | System access; logs; DB read | Curiosity, not harm | Yes |
| Malicious insider | Same access, malicious intent | Sabotage, exfiltration | Yes (limited mitigation; rely on audit) |
| External attacker via public surface | No initial access | Unknown | Yes |
| External attacker with stolen API token | Atlassian/Bitbucket API access | Privilege escalation, data exfil | Yes |
| External attacker with stolen webhook secret | Webhook submission | Forge events, cause state drift | Yes |
| Compromised dependency | Supply-chain attack | Code execution, token exfil | Partial (npm audit + lockfile) |
| Compromised host (root/admin on the server) | Full | Bypass everything | Out (system-level defense) |
| Multi-tenant cross-customer attacker | Other-tenant access | Cross-tenant exfil | Out (single-tenant v1) |

The "compromised host" line is honest: if the OS is rooted, application-layer threat modeling can't save you.

---

## Boundary 1 — External callers → server

The first trust boundary. Build agents (MCP) and operators (mgmt REST) and webhooks land here.

### T-1101: Spoof an MCP session as a different agent

| Field | Value |
|---|---|
| STRIDE | Spoofing |
| Attacker statement | "I open an MCP session and claim to be a different build agent / user" |
| Asset at risk | Audit chain attribution, policy decisions |
| Likelihood | Medium |
| Impact | Medium (audit shows wrong actor; policy may grant inappropriate effect) |
| Mitigating control | Capability negotiation per v6 §2.2; session-bound credentials in `src/mcp/sessionCapabilities.ts` |
| Validating test | `tests/unit/sessionCapabilities.test.ts` (sets up a session with mismatched declared identity vs. credential) |
| Residual risk | If credentials are stolen, the attacker can impersonate. Audit log records *what session did*, not *who really was at the keyboard*. |

### T-1102: Replay a captured MCP request

| Field | Value |
|---|---|
| STRIDE | Spoofing / Tampering |
| Attacker statement | "I capture and replay a state-changing MCP request" |
| Asset at risk | Workspace state (duplicate provisioning) |
| Likelihood | Low (HTTP transport over TLS) |
| Impact | Medium (idempotent operations are safe; non-idempotent could create duplicate Jira issues) |
| Mitigating control | Idempotency keys on provisioning operations (M5 planner); `src/storage/repositories/projectRepository.ts` enforces unique constraints; HTTP transport is TLS-required |
| Validating test | `tests/integration/storage/repositories.test.ts` (concurrent insert with same idempotency key) |
| Residual risk | If TLS is bypassed (proxy MITM), replay is possible. Idempotency keeps damage bounded. |

### T-1103: Forge a webhook delivery

| Field | Value |
|---|---|
| STRIDE | Spoofing / Tampering |
| Attacker statement | "I POST to the webhook ingress with a fabricated payload claiming to be Atlassian / Bitbucket" |
| Asset at risk | State sync (the orchestrator could believe a non-real Atlassian event happened) |
| Likelihood | Medium (webhook URL is discoverable) |
| Impact | High (could trigger drift detection workflows on phantom events) |
| Mitigating control | HMAC-SHA256 signature verification per source. `src/security/webhookSignatures.ts`. Per-source shared secret in `WEBHOOK_SHARED_SECRETS`. |
| Validating test | `tests/unit/security/webhookSignatures.test.ts` |
| Residual risk | If the shared secret is stolen, attacker can sign forged events. Rotation procedure is documented in [`webhook-verification.md`](webhook-verification.md). |

### T-1104: Replay a captured webhook delivery

| Field | Value |
|---|---|
| STRIDE | Tampering |
| Attacker statement | "I capture a valid signed webhook and replay it minutes / hours later" |
| Asset at risk | State drift, duplicate processing |
| Likelihood | Medium |
| Impact | Medium (deduplication mitigates) |
| Mitigating control | Delivery dedup with deterministic IDs per v6 §26.1 (planned: `webhookDeliveries` table indexed by `(source, deliveryId)`) |
| Validating test | (Pending — M10 work; tracked PCO-XX) |
| Residual risk | If `deliveryId` is reused by the source (Atlassian/Bitbucket should not), dedup fails. |

### T-1105: DoS the MCP transport

| Field | Value |
|---|---|
| STRIDE | Denial of service |
| Attacker statement | "I open thousands of MCP sessions and never use them" |
| Asset at risk | Server availability |
| Likelihood | Medium (HTTP transport public) |
| Impact | High |
| Mitigating control | `MCP_HTTP_MAX_CONCURRENT_SESSIONS` (default 1000); session TTL eviction (1h sliding); SSE keep-alive enforced. v6 §22.1, indxr F-051. |
| Validating test | (Capacity test under [`../15-capacity/load-test-runbook.md`](../15-capacity/load-test-runbook.md)) |
| Residual risk | A determined attacker can exhaust the cap; rate limiting at the network edge (out of v1 application scope) is the next layer. |

### T-1106: DoS the mgmt REST API

| Field | Value |
|---|---|
| STRIDE | Denial of service |
| Attacker statement | "I flood `/healthz` or `/metrics`" |
| Asset at risk | Mgmt API availability |
| Likelihood | Low (loopback-only by default) |
| Impact | Low (mgmt API is internal) |
| Mitigating control | `MGMT_API_HOST=127.0.0.1` (loopback). Warning at startup if bound to non-loopback in non-dev. |
| Validating test | `tests/integration/mgmtApi.test.ts` |
| Residual risk | If deployed on a multi-tenant host without firewall, exposing 3001 lets noisy neighbors interfere. |

### T-1107: Inject malicious payload through MCP request

| Field | Value |
|---|---|
| STRIDE | Tampering / Elevation |
| Attacker statement | "I send an MCP request with a payload that exploits a parsing or validation gap to write into storage I shouldn't reach" |
| Asset at risk | Storage integrity, tenant scope |
| Likelihood | Low (Zod validators on every input) |
| Impact | High (if successful) |
| Mitigating control | Zod schema validation on every tool input (`src/domain/*` schemas + tool registration in `src/mcp/registerTools.ts`); tenant scope enforcement in repositories (`assertTenantMatches` pattern) |
| Validating test | `tests/unit/domain/*.test.ts` (schema rejection cases); `tests/unit/domain/tenantScope.test.ts` |
| Residual risk | A bug in a Zod refinement could let through a payload that wouldn't fail at the validator but fails downstream. Defense in depth: storage repositories also validate. |

### T-1108: Operator privilege escalation via mgmt REST

| Field | Value |
|---|---|
| STRIDE | Elevation |
| Attacker statement | "I find an unauthenticated mgmt endpoint and use it to read/write privileged state" |
| Asset at risk | Server configuration, sessions, audit chain |
| Likelihood | Low (mgmt is loopback) |
| Impact | High |
| Mitigating control | Loopback-only binding; `/healthz` and `/readyz` are read-only by design; `/metrics` is read-only |
| Validating test | `tests/integration/mgmtApi.test.ts` (asserts no write endpoints exist) |
| Residual risk | If operators run interactive tools on the server host, they can reach loopback. This is acceptable; the threat model assumes operators are trusted. |

---

## Boundary 2 — Server → external systems

The second trust boundary. Outbound calls to Atlassian / Bitbucket / UIO.

### T-2201: Exfiltrate stored API tokens

| Field | Value |
|---|---|
| STRIDE | Information disclosure |
| Attacker statement | "I read the `encryptedTokens` table and obtain plaintext API tokens" |
| Asset at risk | API tokens (SECRET) |
| Likelihood | Low (DB access required) |
| Impact | **Critical** (tokens grant full Atlassian/Bitbucket API access for that account) |
| Mitigating control | XChaCha20-Poly1305 envelope encryption (ADR-0002); `TOKEN_MASTER_KEY` not stored in DB; tokens are plaintext only in memory during request signing |
| Validating test | `tests/unit/security/tokenEncryption.test.ts`; `tests/integration/storage/tokenStore.test.ts` |
| Residual risk | If `TOKEN_MASTER_KEY` is compromised AND the DB is read, all tokens are decryptable. Master-key rotation is manual (PCO-57); see [`token-storage.md`](token-storage.md) Incident C drill. |

### T-2202: Token leakage via logs

| Field | Value |
|---|---|
| STRIDE | Information disclosure |
| Attacker statement | "I read the orchestrator log file and find tokens / secrets logged accidentally" |
| Asset at risk | Tokens, master key, webhook secrets |
| Likelihood | Medium (easy mistake during dev) |
| Impact | High |
| Mitigating control | Pino redaction config in `src/observability/logger.ts`; structured logging discipline; no `console.*` allowed in `src/` (`scripts/lint-no-stdout.mjs`) |
| Validating test | `tests/lint/no-stdout.test.ts`; manual review of redaction config additions |
| Residual risk | New secret-bearing fields can slip through redaction config. Mitigation: review at every milestone. |

### T-2203: Outbound call to attacker-controlled URL (SSRF)

| Field | Value |
|---|---|
| STRIDE | Information disclosure / DoS |
| Attacker statement | "I influence the orchestrator to call my URL by injecting a hostname into a profile" |
| Asset at risk | Tokens (sent in Authorization header), internal services |
| Likelihood | Low (hostnames come from configured ATLASSIAN_SITE_URL / BITBUCKET workspace, not user input) |
| Impact | High |
| Mitigating control | Provider URLs come from typed config (`src/config/env.ts`) not from user-supplied profile fields; per-provider URL allow-listing |
| Validating test | (Pending — explicit test for "do not honor user-provided URLs"; tracked PCO-XX) |
| Residual risk | If a future tool accepts user URLs (e.g., GitHub partner), this surface returns. Re-threat-model at that point. |

### T-2204: Forge a response from Atlassian/Bitbucket

| Field | Value |
|---|---|
| STRIDE | Spoofing |
| Attacker statement | "I MITM the connection and feed the orchestrator forged responses" |
| Asset at risk | State integrity (orchestrator believes false state) |
| Likelihood | Low (TLS) |
| Impact | High |
| Mitigating control | TLS-only outbound (no plaintext HTTP); certificate validation enabled by default |
| Validating test | (Default Node TLS behavior; not a unit test we own) |
| Residual risk | Compromised CA / pinned-cert bypass. Out of scope for application-layer defense. |

### T-2205: Trigger rate-limit-induced outage

| Field | Value |
|---|---|
| STRIDE | Denial of service |
| Attacker statement | "I cause the orchestrator to issue enough Atlassian calls to trip site-wide rate limit, blocking other operators" |
| Asset at risk | Atlassian API availability |
| Likelihood | Medium |
| Impact | Medium |
| Mitigating control | Provider HTTP retry with exponential backoff (`src/providers/http/retry.ts`); preflight cache TTL to avoid repeated discovery |
| Validating test | `tests/unit/providers/http/retry.test.ts` |
| Residual risk | A determined attacker who controls the orchestrator's input can still craft expensive workloads. Capacity planning ([`../15-capacity/`](../15-capacity/)) addresses workload sizing. |

### T-2206: Operator-as-attacker writes to wrong project

| Field | Value |
|---|---|
| STRIDE | Tampering / Elevation |
| Attacker statement | "I (insider) submit a profile that targets a project I shouldn't touch, and the orchestrator writes there" |
| Asset at risk | Customer Atlassian projects |
| Likelihood | Medium (insider access) |
| Impact | High (real writes to the wrong project) |
| Mitigating control | Policy decision layer (`src/security/policyDecisionLayer.ts`) with project-scoped allow rules; provisioning **preview** before execute; hunk-level review gate for risky writes (v6 §18.3) |
| Validating test | `tests/unit/security/codePolicyAdapter.test.ts` |
| Residual risk | If the policy adapter allows broadly, insider abuse is possible. Mitigation: tenant scope and per-project allow lists in M7+ enrich the adapter. |

---

## Cross-cutting (Boundary 3 — Audit boundary)

These threats span both boundaries and target the audit chain or its surrounding integrity guarantees.

### T-3301: Lethal-trifecta exposure

| Field | Value |
|---|---|
| STRIDE | Information disclosure |
| Attacker statement | "I craft a single operation that combines (a) read of private data, (b) processing of untrusted content, and (c) external communication — exfiltrating private data through the external channel" |
| Asset at risk | PRIVATE / SECRET project data |
| Likelihood | Medium (this is the dominant LLM-app risk class) |
| Impact | Critical |
| Mitigating control | Detection per v6 §38.1; operations that combine all three trifecta dimensions are blocked or require explicit approval. Documented in [`lethal-trifecta.md`](lethal-trifecta.md). |
| Validating test | (Adversarial test set per [`../07-testing/security-test-plan.md`](../07-testing/security-test-plan.md)) |
| Residual risk | Detection is heuristic. A novel combination could slip through. The audit chain records the operation; post-hoc forensics is the second line. |

### T-3302: Forge an audit chain entry

| Field | Value |
|---|---|
| STRIDE | Tampering / Repudiation |
| Attacker statement | "I tamper with the audit chain to forge or remove entries" |
| Asset at risk | Audit chain integrity (Critical) |
| Likelihood | Low (DB write + key access required) |
| Impact | Critical |
| Mitigating control | Hash chain (each entry contains hash of prior); ed25519 signature per entry; key registry in git ref. Verifier re-walks the chain offline. ADR-0005, v6 §30.1. |
| Validating test | `tests/integration/storage/auditRepository.test.ts` (tamper detection); offline verifier exists. |
| Residual risk | Attacker with both DB write AND signing-key access can append valid entries. Splitting key registry from main DB host (post-v1) raises the bar. |

Full attack tree in [`audit-chain-threat-model.md`](audit-chain-threat-model.md).

### T-3303: Compromise the audit signing key

| Field | Value |
|---|---|
| STRIDE | Spoofing |
| Attacker statement | "I read `AUDIT_KEYPAIR_PATH` and use the private key to sign forged entries" |
| Asset at risk | Audit authenticity |
| Likelihood | Low (file system access required) |
| Impact | Critical |
| Mitigating control | File-system permissions on the keypair file (mode 0400, server uid only); rotation procedure in [`audit-chain-threat-model.md`](audit-chain-threat-model.md); compromise itself becomes an audit event |
| Validating test | (Manual permission audit at deploy; ops-level not unit-level) |
| Residual risk | High once compromised. Detection relies on observing unexpected entries; rotation is the only recovery. |

### T-3304: Compromise the key registry git ref

| Field | Value |
|---|---|
| STRIDE | Tampering |
| Attacker statement | "I push to the git ref backing the key registry to register an attacker key as 'active'" |
| Asset at risk | Audit chain authenticity |
| Likelihood | Low (git push permissions required) |
| Impact | Critical |
| Mitigating control | Git ref protection (signed commits, branch protection). Documented procedure in [`audit-chain-threat-model.md`](audit-chain-threat-model.md). |
| Validating test | (Manual audit; not unit-testable in isolation) |
| Residual risk | Inheritable from git host's protection model. |

### T-3305: Audit write fails silently (refused write isn't logged)

| Field | Value |
|---|---|
| STRIDE | Repudiation |
| Attacker statement | "I provoke the orchestrator to attempt a write, the audit append fails, and there's no record of the attempt" |
| Asset at risk | Auditability of refused operations |
| Likelihood | Low (orchestrator fails closed) |
| Impact | Medium |
| Mitigating control | Operations fail closed when the audit chain cannot accept the entry (v6 §30.1). The failure itself logs to the pino file; alerts fire on audit-write failure. |
| Validating test | `tests/integration/storage/auditRepository.test.ts` (audit-write failure scenario) |
| Residual risk | Brief window between failure and alert; mitigated by health check `/admin/health/audit`. |

### T-3306: Time travel via clock manipulation

| Field | Value |
|---|---|
| STRIDE | Tampering |
| Attacker statement | "I change the server clock to insert entries with a wrong timestamp" |
| Asset at risk | Audit chain ordering |
| Likelihood | Low (host root access required) |
| Impact | Medium |
| Mitigating control | Audit entries include both client-stated and server-generated timestamps. Verifier flags discrepancies. Genesis block is a fixed timestamp. |
| Validating test | (Pending — explicit test for clock-skew detection; tracked PCO-XX) |
| Residual risk | Sub-second skew is normal and acceptable; large skew is detectable. |

---

## Summary table — top threats by impact

| Rank | ID | Title | Impact | Likelihood | Status |
|---|---|---|---|---|---|
| 1 | T-2201 | Exfiltrate stored API tokens | Critical | Low | Mitigated (envelope encryption); rotation drill |
| 2 | T-3302 | Forge audit chain entry | Critical | Low | Mitigated (chain + signature + registry) |
| 3 | T-3303 | Compromise audit signing key | Critical | Low | Mitigated (file perms + rotation) |
| 4 | T-3301 | Lethal trifecta exposure | Critical | Medium | Mitigated (detection); residual: heuristic |
| 5 | T-3304 | Compromise key registry git ref | Critical | Low | Mitigated (git protection) |
| 6 | T-1107 | Inject payload via MCP | High | Low | Mitigated (Zod + tenant scope) |
| 7 | T-1103 | Forge webhook delivery | High | Medium | Mitigated (HMAC) |
| 8 | T-2206 | Operator-as-attacker wrong project | High | Medium | Mitigated (policy + preview) |

The full controls map for these threats is in [`controls-matrix.md`](controls-matrix.md).

## What's deliberately NOT in this model

- **Multi-tenant cross-customer attacks** — single-tenant v1.
- **Compromised host (root)** — application defense can't help.
- **Compromised TLS / CA** — out of application scope.
- **Side-channel attacks on @noble/ciphers / @noble/curves** — defer to library-level audits.
- **Build-system supply chain (npm)** — `npm audit` + lockfile + Renovate are standard, not application-defined.

These are documented because "didn't think about it" is worse than "deliberately scoped out."

---

## Linked artifacts

- **Spec:** v6 §30 (security requirements), §38 (lethal trifecta + ACL), §7.2 (policy decision layer), §26 (webhook ingestion)
- **ADRs:** [ADR-0002](../../adr/0002-token-encryption-noble-ciphers.md), [ADR-0005](../../adr/0005-audit-signing-pipeline.md)
- **Code:** `src/security/`, `src/storage/schema/auditEntries.ts`, `src/observability/logger.ts`
- **Tests:** `tests/unit/security/`, `tests/integration/storage/auditRepository.test.ts`
- **Component-level threat models:** [`audit-chain-threat-model.md`](audit-chain-threat-model.md), [`token-storage.md`](token-storage.md), [`webhook-verification.md`](webhook-verification.md), [`policy-decision-layer.md`](policy-decision-layer.md)
- **Controls matrix:** [`controls-matrix.md`](controls-matrix.md)
- **Trust boundaries:** [`../02-architecture/trust-boundaries.md`](../02-architecture/trust-boundaries.md)
- **Data classification:** [`../05-data/classification.md`](../05-data/classification.md)
- **Security test plan:** [`../07-testing/security-test-plan.md`](../07-testing/security-test-plan.md)

---

*Last reviewed: 2026-04-25 by Chris.*
