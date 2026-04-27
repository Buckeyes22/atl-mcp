---
title: Decision Log
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, executive, auditor]
sdlc_category: 12-governance
related: [docs/adr/, docs/sdlc/12-governance/adr-process.md]
---

# Decision Log

> **TL;DR:** Rolled-up index of all ADRs + significant non-ADR architectural decisions. Not authoritative — each ADR is canonical for its decision. This log is the navigation surface: scan this when you want to know "what was decided about X?"

When in doubt, the linked ADRs (or original decision sources) are authoritative; this log is convenience.

---

## ADR index

| ID | Title | Status | Decision summary |
|---|---|---|---|
| [0000](../../adr/0000-adr-process.md) | ADR Process | Accepted | MADR 4.0 + adr.github.io START + DoD |
| [0001](../../adr/0001-pglite-for-dev.md) | pglite for dev | Accepted | pglite (Postgres in WASM) for dev; real Postgres for prod; same migrations |
| [0002](../../adr/0002-token-encryption-noble-ciphers.md) | Token encryption library | Accepted | @noble/ciphers + @noble/curves for token + audit-signing primitives |
| [0003](../../adr/0003-confluence-storage-default-adf-flagged.md) | Confluence body format | Accepted | ADF default; storage format optional via flag |
| [0004](../../adr/0004-bitbucket-app-password-vs-oauth.md) | Bitbucket auth | Accepted | App password as default; OAuth as fallback |
| [0005](../../adr/0005-audit-signing-pipeline.md) | Audit signing pipeline | Accepted | Hash chain + ed25519 + git-ref versioned key registry |

## Significant non-ADR decisions

Decisions that shape the project but didn't earn their own ADR:

### Charter-level

| Decision | Source | Rationale |
|---|---|---|
| Single-tenant for v1 | v6 §3 (Assumptions), [`../01-charter/non-goals.md`](../01-charter/non-goals.md) | Bounded complexity for v1; multi-tenant is post-v1 (v6 §7.3) |
| Atlassian + Bitbucket Cloud only | v6 §3 | Bounded scope; deeper integration than spreading across vendors |
| Build-agent-agnostic MCP server | v6 §2 | Future-proof; broader market |
| TypeScript strict + extras | AGENTS.md | Type safety > flexibility for this project |

### Architectural patterns

| Decision | Source | Rationale |
|---|---|---|
| Dual-port (3000 MCP, 3001 mgmt) | v6 §22 + open-edison F-130 | Trivial firewall rules; clear separation |
| Pino file-only logger | v6 §22, CLAUDE.md | Stdio MCP requires stdout protocol-purity |
| Single-message Task dispatch | CLAUDE.md, v6 §24.6 | Claude Code parallelism quirk |
| BullMQ for async queue | v6 §24, deferred Hatchet (§24.7) | Purpose-built; library maturity |
| Iron law: test-first for new behavior | superpowers F-106, CLAUDE.md | Testability by construction |
| Iron law: verify before claiming done | superpowers F-106, CLAUDE.md | No false-completion |
| Drizzle ORM | implicit; not ADR'd | Type-safe queries; migration-friendly |
| pino as logger | implicit; not ADR'd | Default for Node; fast |
| vitest as test runner | implicit; not ADR'd | Greenfield; preferred over jest |
| Zod for input validation | implicit; not ADR'd | Industry standard for runtime + type integration |

### Process patterns

| Decision | Source | Rationale |
|---|---|---|
| Two-stage review (spec + quality) | superpowers F-107 | Distinct concerns; one pass each |
| Anti-stub scanner | simple-commands-mcp F-002, v6 §31.2 | Catch lazy patterns mechanically |
| `lint:no-stdout` check | CLAUDE.md, M0 | Protocol invariant enforcement (Incident A response) |
| Migration rehearsal | M1 (PCO-13) | Incident B response; mandatory pre-apply |
| Conventional commits | AGENTS.md | Auto-derive release notes |

### Operational patterns

| Decision | Source | Rationale |
|---|---|---|
| Audit chain non-negotiable | v6 §30.1, ADR-0005 | Tamper-evidence > performance |
| Fail closed on audit failure | v6 §30.1 | Integrity > availability |
| Loopback default for mgmt API | v6 §22 | Reduce attack surface |
| Manual master-key rotation drill (v1) | [`../06-security/token-storage.md`](../06-security/token-storage.md) | Envelope encryption deferred (PCO-57) |

## Deferred decisions

Decisions deliberately deferred to post-v1:

| Decision | Defer reason | Tracking |
|---|---|---|
| Multi-tenant key registry | Out of v1 scope | PCO-51 |
| Envelope encryption with per-row data keys | Refactor; not justified for v1 | PCO-57 |
| GitHub / GitLab / Linear support | Bounded scope | v6 §3 non-goals |
| Bitbucket Data Center / Server | Cloud only in v1 | v6 §3 |
| OpenAPI codegen for mgmt REST | Manually-typed for v1 | v6 §40 F-151 |
| OAuth 1.0 for Atlassian | Won't do | (Documented in audit findings) |
| Hatchet as alternative queue | Considered, deferred | v6 §24.7 |
| Algorithmic 11-signal embeddings | Deferred | v6 §25.1 (codebase-memory-mcp) |
| Hindsight three-op memory | Deferred | v6 §25.2 |

## Reading order for understanding the system

If you want to understand "why does this look like this?":

1. Read [`../01-charter/README.md`](../01-charter/README.md) — the highest-level "why."
2. Read v6 §1 (Mission), §2 (Strategic design), §3 (Assumptions), §4 (Non-goals).
3. Read the ADRs in order (0000-0005).
4. Read the partner guides cited from v6.
5. Come back to this log to see what's NOT in those.

## Linked artifacts

- **ADR root:** [`../../adr/`](../../adr/)
- **Sibling docs:** [`adr-process.md`](adr-process.md), [`change-management.md`](change-management.md), [`code-review.md`](code-review.md), [`definition-of-ready-done.md`](definition-of-ready-done.md)
- **Charter:** [`../01-charter/`](../01-charter/)
- **Spec:** v6 §1, §2, §3, §4, §28

---

*Last reviewed: 2026-04-25 by Chris.*
