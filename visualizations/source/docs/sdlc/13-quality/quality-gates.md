---
title: Quality Gates
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer]
sdlc_category: 13-quality
related: [docs/sdlc/09-deployment/ci-cd.md, docs/sdlc/13-quality/iron-laws.md]
---

# Quality Gates

> **TL;DR:** Cumulative gates by milestone. M0 has lint:no-stdout, ESLint, typecheck. M1 adds tests + migration rehearsal. M2+ adds provider tests. M11 adds eval-view + audit-chain verifier. Every gate is automated; review fills the gap. Gates don't get skipped.

This doc summarizes the quality gates from the developer's perspective. Full CI configuration in [`../09-deployment/ci-cd.md`](../09-deployment/ci-cd.md). Per-test detail in [`../07-testing/`](../07-testing/).

---

## Gate categories

### Static checks

Run instantly; cheap to gate every PR:

- `npm run typecheck` — TypeScript strict mode passes.
- `npm run lint` — ESLint passes.
- `npm run lint:no-stdout` — protocol invariant (CLAUDE.md operating rule).
- (Planned M4+) anti-stub scanner.

### Tests

Run in seconds-to-minutes:

- `npm test -- tests/unit` — unit tests.
- `npm test -- tests/integration` — integration tests.
- `npm test -- tests/lint` — lint-as-tests.

Cumulative by milestone — see [`../09-deployment/ci-cd.md`](../09-deployment/ci-cd.md).

### Build

- `npm run build` — tsc emits dist.
- (M11+) `docker build` — image builds + scans.

### Audit

- (M11+) `node scripts/audit-verify.mjs` — chain integrity passes against a fixture.

### Eval-view (M11)

- Multi-provider judge verdicts on golden test cases.
- Drift tracker compared to last 3 runs.

## Gate runtimes (target)

For a v1-scale codebase:

| Gate | Target time |
|---|---|
| typecheck | < 30 s |
| lint:no-stdout + ESLint | < 10 s |
| Unit tests | < 30 s |
| Integration tests | < 2 min |
| Lint tests | < 5 s |
| Build | < 30 s |
| **Total CI per PR** | **< 5 min** |

If CI takes longer, investigate. Slow CI degrades discipline.

## What's gated, what's reviewed

| Concern | Gated by tooling | Reviewed |
|---|---|---|
| Compilation | typecheck | n/a |
| Test passing | vitest | n/a |
| Stdout cleanliness | lint:no-stdout | n/a |
| Test-first discipline | n/a | reviewer checks diff |
| Spec conformance | n/a | reviewer reads spec citation |
| Documentation drift | n/a | reviewer checks updated docs |
| Idiomatic code | partial (ESLint) | reviewer judgment |
| Threat model implication | n/a | reviewer reads + flags |
| Audit chain implication | n/a | reviewer checks state-change ops |
| Cross-link integrity in docs | n/a (planned tool) | reviewer checks |

The split: tooling for mechanical; review for judgment. Don't put judgment into tooling (false positives kill discipline).

## Gate failure modes

### Failure on PR

PR doesn't merge. Author fixes (or reverts the offending change).

### Failure on main

Treat as P1 incident:

1. Identify the merge that caused it (`git bisect` or recent log).
2. Revert immediately.
3. Re-run gates on main.
4. Open a follow-up to land the change correctly.

Main always green. A red main blocks all releases.

### Override

PR-level override is rare. Requires:

- Explicit reason in PR description.
- Reviewer agreement on the override.
- Follow-up ticket to fix the gate or the code.

Examples where override is reasonable:

- The gate has a known bug + ticket.
- The gate is being added in this PR; existing code fails (transitional).

## Adding a new gate

1. Decide what the gate enforces.
2. Implement the check (lint rule, test, scanner).
3. Land the check in non-blocking warning mode for 1-2 weeks.
4. Promote to blocking once CI is green and team is aware.
5. Update this doc + [`../09-deployment/ci-cd.md`](../09-deployment/ci-cd.md).

## Removing a gate

Rare. Reasons:

- The gate's purpose was subsumed by another tool.
- The gate produces too many false positives without value.

Removing requires an ADR (or at least a decision-log entry). Don't silently retire gates.

## Linked artifacts

- **CI config:** [`../09-deployment/ci-cd.md`](../09-deployment/ci-cd.md)
- **Iron laws:** [`iron-laws.md`](iron-laws.md)
- **Anti-slop:** [`anti-slop.md`](anti-slop.md)
- **Code style:** [`code-style.md`](code-style.md)
- **Test plans:** [`../07-testing/`](../07-testing/)
- **Code:** `scripts/lint-no-stdout.mjs`, `tests/lint/no-stdout.test.ts`
- **AGENTS.md** ("CI gates"): [`../../../AGENTS.md`](../../../AGENTS.md)

---

*Last reviewed: 2026-04-25 by Chris.*
