---
title: Integration Test Plan
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer]
sdlc_category: 07-testing
related: [docs/sdlc/07-testing/strategy.md]
---

# Integration Test Plan

> **TL;DR:** Tests that touch DB (pglite or Postgres) and / or HTTP (mocked or live). Integration tests run in seconds, not minutes. Required CI gate from M1+. Live integration (`RUN_LIVE_TESTS=1`) tests against real Atlassian / Bitbucket; default-off.

Integration tests cover the seams between modules and external systems. The discipline: integration > unit when the seam matters; unit > integration when it doesn't.

---

## Subject areas (existing)

| Area | File | Coverage |
|---|---|---|
| Mgmt API | `tests/integration/mgmtApi.test.ts` | `/healthz`, `/readyz`, `/metrics` contract |
| Storage repositories | `tests/integration/storage/repositories.test.ts` | All 12 tables — CRUD + queries |
| Audit chain integrity | `tests/integration/storage/auditRepository.test.ts` | Chain construction, tamper detection, fail-closed |
| Token store | `tests/integration/storage/tokenStore.test.ts` | Seal / open across pglite + Postgres |
| Migration rehearsal | `tests/integration/storage/migrationRehearsal.test.ts` | Rehearsal mode catches violations |
| Confluence REST (live, gated) | `tests/integration/providers/confluenceRestProvider.test.ts` | Real Atlassian read path |
| Bitbucket REST (live, gated) | `tests/integration/providers/vcs/bitbucketRestProvider.test.ts` | Real Bitbucket read path |
| Worktree manager | `tests/integration/providers/vcs/worktreeManager.test.ts` | Concurrent worktrees + cleanup |
| Preflight workflow | `tests/integration/preflight.test.ts` | Capability discovery end-to-end |

## Subject areas (planned)

- **Composition tools** (M4): Tool registration with feature gates; integration with workflows.
- **Blueprint workflow** (M4): Adversarial triplet end-to-end, including sampling integration.
- **Provisioning planner** (M5): Plan-against-live with mocked Atlassian + VCS.
- **Provisioning executor** (M6a/b/c): Idempotent execute + audit emission.
- **Webhook ingestion** (M10): Signature verify + dedup + workflow trigger.
- **Context pack engine** (M7): Generation + idempotent re-fetch.
- **Readiness rubric** (M8): Deterministic score + LLM-judged verdict.
- **Audit chain verifier** (M11): Offline verifier passes against built fixtures.

## Test environment

- **Default:** pglite + HTTP mocks. Fast; no external deps.
- **With `RUN_LIVE_TESTS=1`:** real Postgres (or pglite) + real Atlassian / Bitbucket sandbox.
- **Fixtures:** `tests/fixtures/` for inputs (e.g., `requirements-billing.md`).

## Patterns

### Repository test pattern

```typescript
// Setup: fresh pglite DB; apply migrations.
// Test: insert via repository; query; assert; verify tenant scope honored.
// Teardown: drop DB.
```

`tests/integration/storage/_testDb.ts` provides the harness.

### Audit chain test pattern

```typescript
// Insert N entries.
// Tamper with entry K (UPDATE in raw SQL).
// Run verifier.
// Assert: verifier reports failure at entry K.
```

### Provider HTTP test pattern (mocked)

```typescript
// Configure mock HTTP client to return a specific response.
// Invoke provider method.
// Assert: correct URL composed, correct headers, correct payload.
// For 429: assert retry behavior.
```

### Live provider test pattern (gated)

```typescript
beforeAll(() => {
  if (!process.env.RUN_LIVE_TESTS) return test.skip()
  // ...load creds, set up sandbox state
})
```

## Coverage gaps (acknowledged)

- **Webhook delivery dedup** (M10): not yet integration-tested.
- **OAuth 3LO refresh race** (PCO-59): hard to reproduce; needs a deterministic test harness.
- **Master-key rotation drill** (PCO-57): manual today; should be integration-tested when the rotation tool lands.
- **Concurrent provisioning under contention**: not stress-tested at v1 scale.

## Failure analysis

When an integration test fails:

1. **Re-run** — integration tests are sometimes flaky on slow CI hosts.
2. **Inspect logs** — vitest captures stdout; check for unexpected output (which itself might be a CLAUDE.md operating-rule violation).
3. **Reproduce locally** with the same env.
4. **Bisect** if recent — `git bisect` against the failing test.

Persistent flakes are tech debt; file a ticket.

## Linked artifacts

- **Code:** `tests/integration/`, `tests/integration/storage/_testDb.ts`
- **Strategy:** [`strategy.md`](strategy.md)
- **Sibling:** [`unit-coverage.md`](unit-coverage.md), [`e2e-plan.md`](e2e-plan.md)
- **Spec:** v6 §31 (testing strategy)

---

*Last reviewed: 2026-04-25 by Chris.*
