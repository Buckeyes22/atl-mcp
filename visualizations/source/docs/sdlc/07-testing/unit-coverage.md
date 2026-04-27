---
title: Unit Test Coverage
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer]
sdlc_category: 07-testing
related: [docs/sdlc/07-testing/strategy.md]
---

# Unit Test Coverage

> **TL;DR:** Per-domain unit-test inventory + numeric coverage target. v1 target: 70% line coverage on `src/`, 90% on `src/domain/` and `src/security/`. No coverage gates in CI yet (planned M11) — discipline is review-driven.

Unit tests run in < 5 seconds total. They're the fast feedback loop.

---

## Subject areas (existing)

| Area | Files | What's tested |
|---|---|---|
| Config | `tests/unit/env.test.ts` | Defensive parsing, required / optional, type coercion |
| Domain — projectState | `tests/unit/domain/projectState.test.ts` | All 13 state transitions; invalid throws |
| Domain — confidence | `tests/unit/domain/confidence.test.ts` | Numeric ↔ categorical mapping |
| Domain — tenantScope | `tests/unit/domain/tenantScope.test.ts` | `assertTenantMatches` semantics |
| Domain — serialization | `tests/unit/domain/serialization.test.ts` | Round-trip JSON for all 18 types |
| Security — token encryption | `tests/unit/security/tokenEncryption.test.ts` | Seal / open / tamper detection / wrong-key |
| Security — code policy adapter | `tests/unit/security/codePolicyAdapter.test.ts` | Decision shape; intents |
| Security — webhook signatures | `tests/unit/security/webhookSignatures.test.ts` | HMAC verify; constant-time |
| Provider HTTP — retry | `tests/unit/providers/http/retry.test.ts` | Backoff, max attempts, 429 handling |
| Provider HTTP — REST client | `tests/unit/providers/http/restClient.test.ts` | URL composition, header injection |
| Atlassian auth | `tests/unit/providers/atlassian/auth.test.ts` | API token + OAuth 3LO + actor attribution |
| Atlassian ADF | `tests/unit/providers/atlassian/adf.test.ts` | Tree round-trip |
| Confluence storage | `tests/unit/providers/atlassian/confluenceStorageRenderer.test.ts` | Storage format round-trip |
| VCS — bitbucket auth | `tests/unit/providers/vcs/bitbucketAuth.test.ts` | App-password auth |
| MCP — projectIntakeTools | `tests/unit/mcp/projectIntakeTools.test.ts` | Tool registration gating |
| MCP — sampling | `tests/unit/mcp/sampling.test.ts` | Sampling provider chain |
| Validator — blueprint | `tests/unit/validators/blueprintValidator.test.ts` | Schema + adversarial triplet |
| Workflow — blueprint | `tests/unit/workflows/blueprintWorkflow.test.ts` | Intake → blueprint orchestration |

Total: ~29 files. Discovered count grows; this list is the current snapshot.

## Coverage targets

| Area | Line coverage target | Justification |
|---|---|---|
| `src/domain/` | ≥ 90% | Domain types are pure; high coverage feasible + valuable |
| `src/security/` | ≥ 90% | Crypto + audit; can't afford gaps |
| `src/providers/` | ≥ 70% | Network paths; live tests fill gaps |
| `src/storage/` | ≥ 80% | Repositories + migrations |
| `src/mcp/` | ≥ 70% | Transport layer; harder to unit-test transport itself |
| `src/workflows/` | ≥ 75% | State machines are testable |
| `src/observability/` | ≥ 60% | Mostly library wrappers |
| `src/config/` | ≥ 80% | Defensive parsing is testable |
| **Overall `src/`** | **≥ 70%** | Aspirational |

These targets are aspirational — no automated gate yet (planned for M11). Manual review checks against them.

## What's NOT unit-tested (intentionally)

- **Transport bring-up.** `tests/unit/buildServer.test.ts` covers server construction; the transport itself is integration-tested.
- **Real provider HTTP.** Mocked at unit level; live tests cover real.
- **Migration apply against real DB.** Integration covers; rehearsal-test handles.
- **Async queue lifecycle.** Integration covers (planned M6+).

## Anti-patterns

To avoid:

- **Mocking everything.** Heavy mock usage masks real behavior; prefer real test doubles where the behavior is testable.
- **Testing implementation details.** Test inputs → outputs / state changes; don't test "this private helper was called."
- **Slow unit tests.** Anything > 50 ms should be re-classified as integration.
- **Snapshot tests for prose.** Snapshots without semantic comparison rot.

## Adding a new unit test

1. Identify the smallest unit (function, class method, type behavior).
2. Write the test first (per iron law).
3. Run; confirm fails.
4. Implement.
5. Run; confirm passes.
6. Add to the relevant subject area.

## Linked artifacts

- **Code:** `tests/unit/`
- **Strategy:** [`strategy.md`](strategy.md)
- **Sibling:** [`integration-plan.md`](integration-plan.md), [`e2e-plan.md`](e2e-plan.md)
- **Iron laws:** [`../13-quality/iron-laws.md`](../13-quality/iron-laws.md)

---

*Last reviewed: 2026-04-25 by Chris.*
