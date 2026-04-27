---
title: Testing Strategy
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer]
sdlc_category: 07-testing
related: [agent-context-orchestrator-mcp-plan-v6.md §31, AGENTS.md, docs/sdlc/13-quality/iron-laws.md]
---

# Testing Strategy

> **TL;DR:** Five test categories — unit, integration, contract, lint, live. Iron law: test-first for new behavior. Eval-view (v6 §31.1) for LLM-judged gates. Anti-stub scanner (v6 §31.2) catches lazy patterns. Live tests gated by env var. CI runs cumulative gates per milestone.

The discipline is the test pyramid + the iron law. Categories below.

---

## Test categories

### Unit (29+)

- Fast (< 50 ms per test).
- No I/O — no DB, no network.
- Subject areas:
  - Domain serialization (every type round-trips JSON).
  - State-machine transitions.
  - Confidence representation.
  - Tenant scope assertions.
  - Token encryption seal/open.
  - Code-policy adapter.
  - Webhook signature verify (HMAC-SHA256 + constant-time compare).
  - Provider HTTP retry logic.
  - REST client config.
  - Atlassian auth flows (API token, OAuth 3LO, actor attribution).
  - ADF render + parse.
  - Confluence storage format render + parse.
  - Blueprint validator (schema + adversarial triplet).
  - Sampling adapter.

Run: `npm test -- tests/unit`.

### Integration (17+)

- Slower (> 50 ms; up to seconds).
- Touch DB (pglite) and / or HTTP (mocked).
- Subject areas:
  - Storage repositories (all 12 tables — CRUD + queries + tenant scope).
  - Audit repository (chain construction + tamper detection).
  - Token store (seal / open round-trips with real DB).
  - Migration rehearsal (PCO-13 — applies migrations against fixture, verifies post-conditions).
  - Mgmt API endpoints (`/healthz`, `/readyz`, `/metrics`).
  - Provider HTTP clients (Confluence REST, Bitbucket REST — mocked).
  - VCS provider with worktree manager.
  - Composition tools registration.
  - Provider contracts.

Run: `npm test -- tests/integration`.

### Contract (1+)

- Verify every implementation of an abstract interface satisfies the contract.
- Subject: provider abstract → all implementations.

Run: `npm test -- tests/integration/providers/contracts`.

### Lint (2)

- Static checks; not behavior tests but in the test suite for CI integration.
- `tests/lint/no-stdout.test.ts` — protocol-stream protection (CLAUDE.md operating rule).
- (Planned, M11) anti-stub-scanner test.

Run: `npm test -- tests/lint`.

### Live (3, gated)

- Run only with `RUN_LIVE_TESTS=1`.
- Subject: real Atlassian Cloud, real Bitbucket Cloud, real UIO partner.
- Not part of default CI; require sandbox creds.

Run: `RUN_LIVE_TESTS=1 npm test -- tests/integration/providers/`.

## Iron law: test-first

Per [`../13-quality/iron-laws.md`](../13-quality/iron-laws.md):

> Never write production code without a failing test first when adding behavior.

Implementation: PRs introducing new behavior land with a test that **fails** at the commit just before the production code lands, and passes at the commit that introduces production code. Reviewers verify this in the diff.

Exceptions:
- **Refactors** that preserve behavior: no new test required (existing tests still pass).
- **Doc-only changes:** no test.
- **CI / lint config changes:** the change is its own test.

## Eval-view integration

v6 §31.1 specifies wholesale eval-view integration:

- Multi-provider LLM-as-judge.
- Verdict layer combining multiple providers.
- Drift tracker comparing current outputs vs. golden baselines.
- Auto-PR from incidents.

Status: M11 work; designed but not yet wired. Affects the blueprint workflow's adversarial verifier (it's a precursor to eval-view).

## Anti-slop discipline

v6 §31.2 specifies anti-slop linting:

- No `Math.random` in production paths.
- No `console.*` (covered by `lint:no-stdout`).
- No lorem-ipsum / TODO comments without ticket reference.
- No empty function bodies / no `throw new Error("not implemented")` in production paths.

Status: lint:no-stdout is live; full anti-stub scanner is M4–M11 work.

## CI gates (cumulative)

Per [`../09-deployment/ci-cd.md`](../09-deployment/ci-cd.md):

- M0: lint:no-stdout, ESLint, typecheck, build.
- M1: + unit tests, integration storage tests, migration rehearsal.
- M2: + provider HTTP retry, Atlassian auth, ADF round-trip.
- M3: + Bitbucket auth, worktree manager, webhook signatures.
- M4: + blueprint validator, sampling, anti-stub scanner.
- M5–M6c: + planner tests, provider contract, idempotency.
- M7+: + context pack tests, readiness rubric, manifest spawn.
- M11: + eval-view verdict, MCP conformance, audit-chain verifier, semgrep.

## Test data

- **Fixtures** in `tests/fixtures/` (e.g., `requirements-billing.md`).
- **Test doubles** for security primitives: `src/security/tokenEncryption.testDouble.ts` lets non-encryption tests skip the crypto path while preserving the contract.
- **In-memory project repo** for workflow tests (`tests/unit/workflows/inMemoryProjectRepository.ts`) — avoids DB cost for state-machine tests.

## What's NOT covered (and why)

- **Property-based testing.** Not v1; Zod schemas catch most input variations.
- **Mutation testing.** Out of scope.
- **Chaos engineering.** Not v1 single-tenant; post-v1.
- **Long-running soak tests.** Not v1; capacity drills cover this when they land.

## Linked artifacts

- **Spec:** v6 §31 (testing strategy), §31.1 (eval-view), §31.2 (anti-slop)
- **AGENTS.md:** [`../../../AGENTS.md`](../../../AGENTS.md) — "Testing" section
- **Iron laws:** [`../13-quality/iron-laws.md`](../13-quality/iron-laws.md)
- **Code:** `tests/`
- **Sibling test docs:** [`unit-coverage.md`](unit-coverage.md), [`integration-plan.md`](integration-plan.md), [`e2e-plan.md`](e2e-plan.md), [`perf-plan.md`](perf-plan.md), [`security-test-plan.md`](security-test-plan.md), [`eval-view-integration.md`](eval-view-integration.md)
- **CI:** [`../09-deployment/ci-cd.md`](../09-deployment/ci-cd.md), [`../13-quality/quality-gates.md`](../13-quality/quality-gates.md)

---

*Last reviewed: 2026-04-25 by Chris.*
