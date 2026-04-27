---
title: Testing Strategy
owner: Chris
status: accepted
last_reviewed: 2026-04-27
version: 1.1.0
audience: [engineer]
sdlc_category: 07-testing
related: [agent-context-orchestrator-mcp-plan-v6.md §31, AGENTS.md, docs/sdlc/13-quality/iron-laws.md]
---

# Testing Strategy

> **TL;DR:** Five test categories — unit, integration, contract, lint, live. Iron law: test-first for new behavior. Eval-view (v6 §31.1) for LLM-judged gates. Anti-stub scanner (v6 §31.2) catches lazy patterns. Live tests gated by env var. CI runs cumulative gates per milestone.

The discipline is the test pyramid + the iron law. Categories below.

---

## Test categories

<figure>

<svg viewBox="0 0 1100 620" xmlns="http://www.w3.org/2000/svg" font-family="IBM Plex Sans, system-ui">
    <!-- Pyramid layers -->
    <!-- E2E (planned) - tip -->
    <polygon points="500,60 600,60 615,108 485,108" fill="#ecebe6" stroke="#9a9690" stroke-dasharray="4 3"/>
    <text x="550" y="80" text-anchor="middle" font-size="11.5" font-weight="600" fill="#43434a">E2E</text>
    <text x="550" y="98" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" fill="#6f6e6a">M11 · planned</text>

    <!-- Live (gated) -->
    <polygon points="485,108 615,108 635,156 465,156" fill="#dde9f2" stroke="#1f5f8a"/>
    <text x="550" y="130" text-anchor="middle" font-size="11.5" font-weight="600" fill="#11364f">live (3, gated)</text>
    <text x="550" y="148" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" fill="#11364f">RUN_LIVE_TESTS=1</text>

    <!-- Contract -->
    <polygon points="465,156 635,156 660,216 440,216" fill="#ece1f3" stroke="#6e1a82"/>
    <text x="550" y="182" text-anchor="middle" font-size="12" font-weight="600" fill="#3e0d4d">contract (1+)</text>
    <text x="550" y="200" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" fill="#3e0d4d">provider abstract → impls</text>

    <!-- Integration -->
    <polygon points="440,216 660,216 720,372 380,372" fill="#fbeed8" stroke="#b96b16"/>
    <text x="550" y="262" text-anchor="middle" font-size="15" font-weight="600" fill="#7a4408">integration · 17+</text>
    <text x="550" y="284" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" fill="#7a4408">repos · audit · token store</text>
    <text x="550" y="302" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" fill="#7a4408">migration rehearsal · mgmt API</text>
    <text x="550" y="320" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" fill="#7a4408">provider HTTP (mocked)</text>
    <text x="550" y="346" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" fill="#7a4408">runtime: ~50 ms – seconds · pglite + mocked HTTP</text>

    <!-- Unit -->
    <polygon points="380,372 720,372 820,564 280,564" fill="#dceee5" stroke="#1f6e54"/>
    <text x="550" y="426" text-anchor="middle" font-size="20" font-weight="600" fill="#0e3d2f">unit · 29+</text>
    <text x="550" y="452" text-anchor="middle" font-family="IBM Plex Mono" font-size="11.5" fill="#0e3d2f">domain serialization · state-machine transitions</text>
    <text x="550" y="470" text-anchor="middle" font-family="IBM Plex Mono" font-size="11.5" fill="#0e3d2f">tenant scope · token enc seal/open · webhook HMAC</text>
    <text x="550" y="488" text-anchor="middle" font-family="IBM Plex Mono" font-size="11.5" fill="#0e3d2f">ADF · provider retry · OAuth flows · sampling adapter</text>
    <text x="550" y="514" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" fill="#0e3d2f">runtime: &lt; 50 ms each · no I/O</text>
    <text x="550" y="540" text-anchor="middle" font-family="IBM Plex Mono" font-size="10.5" fill="#1f6e54">broad base — fastest feedback, highest coverage</text>

    <!-- ========== Side annotations ========== -->
    <!-- LEFT: Lint (parallel rail) -->
    <g transform="translate(48,200)">
      <text font-family="IBM Plex Mono" font-size="10.5" letter-spacing="1.4" fill="#9a9690" y="0">PARALLEL · STATIC CHECKS AS TESTS</text>
      <rect x="0" y="14" width="220" height="116" fill="#faf9f6" stroke="#c8c3b6"/>
      <text x="14" y="40" font-size="13" font-weight="600" fill="#1a1a1c">lint (2)</text>
      <text x="14" y="62" font-family="IBM Plex Mono" font-size="11" fill="#43434a">no-stdout protocol</text>
      <text x="14" y="78" font-family="IBM Plex Mono" font-size="11" fill="#43434a">guard (CLAUDE.md)</text>
      <text x="14" y="100" font-family="IBM Plex Mono" font-size="11" fill="#43434a">anti-stub scanner</text>
      <text x="14" y="116" font-family="IBM Plex Mono" font-size="11" fill="#9a9690">(M11, planned)</text>
      <!-- connector -->
      <line x1="220" y1="72" x2="320" y2="72" stroke="#c8c3b6" stroke-dasharray="3 3"/>
    </g>

    <!-- RIGHT: CI gate -->
    <g transform="translate(832,200)">
      <text font-family="IBM Plex Mono" font-size="10.5" letter-spacing="1.4" fill="#9a9690" y="0">CI GATE (every PR)</text>
      <rect x="0" y="14" width="220" height="220" fill="#faf9f6" stroke="#c8c3b6"/>
      <g font-family="IBM Plex Mono" font-size="11.5" fill="#43434a">
        <text x="14" y="38">npm run typecheck</text>
        <text x="14" y="58">npm test</text>
        <text x="14" y="80" fill="#9a9690">  └─ unit + integration</text>
        <text x="14" y="96" fill="#9a9690">     + contract + lint</text>
        <text x="14" y="120">npm run lint:no-stdout</text>
        <text x="14" y="140">npm run lint</text>
      </g>
      <text x="14" y="172" font-size="11" fill="#1a1a1c" font-weight="500">all four must pass</text>
      <text x="14" y="190" font-size="11" fill="#43434a">live tests opt-in only</text>
      <text x="14" y="206" font-size="11" fill="#43434a">(`RUN_LIVE_TESTS=1`)</text>
    </g>

    <!-- bottom legend -->
    <g transform="translate(48,580)" font-family="IBM Plex Mono" font-size="10.5" fill="#6f6e6a">
      <text>iron law (13-quality/iron-laws.md): never write production code without a failing test first when adding behavior.</text>
    </g>

    <!-- top legend -->
    <text x="48" y="36" font-family="IBM Plex Mono" font-size="10.5" letter-spacing="1.4" fill="#9a9690">v6 §31 · 5 CATEGORIES · CUMULATIVE PER MILESTONE</text>
  </svg>

<figcaption><strong>V3 — Test pyramid.</strong> atl-mcp's test pyramid: 29+ unit tests at the broad base (millisecond-scale; cover domain serialization, security primitives, validators), 17+ integration tests in the middle band (seconds-scale; cover storage repositories, provider HTTP, mgmt API), and a narrow tip of contract + live + (planned) E2E tests. The lint category sits alongside as static-checks-as-tests; live tests gate behind `RUN_LIVE_TESTS=1` to keep default CI fast. (See <a href="../../visualizations/v03-test-pyramid.html">full visualization page</a>.)</figcaption>
</figure>


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
  - Storage repositories (all 15 tables — CRUD + queries + tenant scope).
  - Role workflow admin tools (Requirements Assist, agent assignment, content quality).
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

*Last reviewed: 2026-04-27 by Chris.*
