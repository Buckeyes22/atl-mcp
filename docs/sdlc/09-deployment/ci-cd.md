---
title: CI/CD Pipeline
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer]
sdlc_category: 09-deployment
related: [AGENTS.md, docs/sdlc/13-quality/quality-gates.md, docs/sdlc/09-deployment/release-process.md]
---

# CI/CD Pipeline

> **TL;DR:** Cumulative gates by milestone — M0 has lint:no-stdout, M1 adds typecheck + vitest, M2 adds eval-view, etc. Every PR runs the cumulative set for the current milestone. Main branch always green. Main → release tag → image build is the same pipeline; deploy is a separate step.

This doc codifies the CI gates from AGENTS.md §CI gates and ties each gate to its enforcement point.

---

## Pipeline shape

```
PR opened → CI job runs cumulative gates → review → squash merge → main
main → tag → build image → push to registry → deploy (separate step)
```

Each stage has explicit inputs / outputs / pass criteria.

## Cumulative gates

The gate set grows by milestone. M0 has the smallest set; M11 has the full set.

### M0 — Scaffold

| Gate | Command | Passes when |
|---|---|---|
| Anti-stdout lint | `npm run lint:no-stdout` | No `console.*` or `process.std*.write` references in `src/` outside the allowlist (logger only) |
| Standard lint | `npm run lint` | ESLint passes; the lint config is checked in |
| Typecheck | `npm run typecheck` | TypeScript strict mode + extras (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) pass |
| Build | `npm run build` | tsc emits to `dist/` without errors |

### M1 — Domain + storage

Adds:

| Gate | Command | Passes when |
|---|---|---|
| Unit tests | `npm test -- tests/unit` | All unit tests green |
| Integration tests (storage) | `npm test -- tests/integration/storage` | All storage repo tests green; pglite-backed |
| Migration rehearsal | `npm test -- tests/integration/storage/migrationRehearsal.test.ts` | Migrations apply against a prod-shaped fixture and post-conditions hold |

### M2 — Atlassian providers

Adds:

| Gate | Command | Passes when |
|---|---|---|
| Provider HTTP retry tests | `npm test -- tests/unit/providers/http` | Backoff + 429 handling tests green |
| Atlassian auth tests | `npm test -- tests/unit/providers/atlassian/auth.test.ts` | API token + OAuth 3LO paths green |
| Confluence ADF round-trip | `npm test -- tests/unit/providers/atlassian/adf.test.ts` | ADF tree round-trips |
| Live integration (gated) | `RUN_LIVE_TESTS=1 npm test -- tests/integration/providers/confluenceRestProvider.test.ts` | Optional; gated behind env var, not run in default CI |

### M3 — VCS provider

Adds:

| Gate | Command | Passes when |
|---|---|---|
| Bitbucket auth tests | `npm test -- tests/unit/providers/vcs/bitbucketAuth.test.ts` | App-password flow green |
| Worktree manager tests | `npm test -- tests/integration/providers/vcs/worktreeManager.test.ts` | Concurrent worktrees + cleanup green |
| Webhook signatures | `npm test -- tests/unit/security/webhookSignatures.test.ts` | HMAC verify + constant-time compare green |

### M4 — Blueprint workflow

Adds:

| Gate | Command | Passes when |
|---|---|---|
| Blueprint validator | `npm test -- tests/unit/validators/blueprintValidator.test.ts` | Schema checks + adversarial verification triplet green |
| Sampling tests | `npm test -- tests/unit/mcp/sampling.test.ts` | Sampling provider chain green |
| Anti-stub scanner | `npm run lint:anti-stub` | No `Math.random` / `console.log` / lorem-ipsum in production code paths (per simple-commands-mcp F-002) |

### M5–M6c — Provisioning

Adds:

| Gate | Command | Passes when |
|---|---|---|
| Planner tests | `npm test -- tests/unit/workflows/blueprintWorkflow.test.ts` | Plan-against-live + idempotency green |
| Provider contract tests | `npm test -- tests/integration/providers/` | Each provider impl satisfies the abstract contract |
| Idempotency tests | (subset of above) | Replay produces no-op or precise diff |

### M7 — Context resources

Adds:

| Gate | Command | Passes when |
|---|---|---|
| Context pack tests | (planned) | Token budget + redaction + model targeting green |
| Pack-replay tests | (planned) | Same regenerationKey produces same content (idempotent) |

### M8 — Readiness validation

Adds:

| Gate | Command | Passes when |
|---|---|---|
| Readiness rubric tests | (planned) | 6-category deterministic + 4-tier verdict green |

### M9 — Agent handoff

Adds:

| Gate | Command | Passes when |
|---|---|---|
| Manifest spawn tests | (planned) | Generated manifest validates against MCP spec |

### M10 — Webhook ingestion

Adds:

| Gate | Command | Passes when |
|---|---|---|
| Webhook delivery + dedup | (planned, M10) | Replay produces idempotent ack; dedup table grows correctly |

### M11 — Notifications, evals, hardening

Adds:

| Gate | Command | Passes when |
|---|---|---|
| Eval-view verdict gate | `npm run eval` (planned) | Multi-provider LLM-as-judge verdict passes thresholds (per v6 §31.1) |
| MCP conformance | `npm run conformance:mcp` (planned) | Conformance suite against the MCP spec passes |
| Audit-chain verifier | `node scripts/audit-verify.mjs` (planned) | Offline verifier passes against built fixtures |
| Semgrep | `npm run lint:semgrep` (planned) | Custom rules + standard rules pass |

---

## Cumulative-gate enforcement

The cumulative set means: if you're at M3, you run M0 + M1 + M2 + M3 gates on every PR. Gates don't get re-skipped after their milestone; they're permanent.

This is how AGENTS.md §CI gates phrases it: "no regressions ever." The lint:no-stdout introduced in M0 still runs at M11.

## What's enforced WHERE

| Enforcement point | What it catches |
|---|---|
| Pre-commit hook (optional, dev) | Format, lint, typecheck — fast feedback before push |
| PR CI | Full cumulative gate set for the current milestone |
| Branch protection | Main can only receive merges with all gates green |
| Release tag CI | Same gates + image build + image-scan (planned, M11) |
| Deploy-time | Migration rehearsal + smoke checks; not "CI" but part of pipeline |

For v1, the deploy platform may not enforce branch protection automatically; the discipline is operator-side. Document the protection rule in `.github/branch-protection.json` (when applicable).

---

## Pipeline file references

CI configuration lives in `.github/workflows/` (when checked in for GitHub Actions) or equivalent for the chosen CI platform. v1 uses local-and-developer-driven CI (no platform-bound CI yet); the gates above run via `npm run`.

When CI lands on a platform, this section gets updated with the workflow filename(s).

---

## Failure modes

### A gate fails on PR

Default: PR doesn't merge. Override is rare and requires:

- Documented justification in the PR description.
- Reviewer approval explicitly noting the override.
- A follow-up ticket to fix the gate (if the gate itself is wrong) or fix the code (if the code is wrong).

### A gate fails on main

Treat as P1 incident. Main is always-green; a red main blocks all releases. Steps:

1. Identify the merge that caused the failure (`git bisect` or recent log).
2. Revert that merge (`git revert <sha>`).
3. Re-run gates on main.
4. Open a ticket to land the reverted change correctly.

### A new gate is added

Coordinate with the team. New gate lands in main as a non-blocking warning first; promotes to blocking after a transition period (1–2 weeks). For v1 single-maintainer, the transition is just "make it green before promoting."

---

## Linked artifacts

- **AGENTS.md §CI gates:** [`AGENTS.md`](../../../AGENTS.md)
- **Spec:** v6 §28 (milestones), §31 (testing strategy), §32 (Definition of Done)
- **Sibling docs:** [`release-process.md`](release-process.md), [`environments.md`](environments.md), [`feature-flags.md`](feature-flags.md), [`secrets-provisioning.md`](secrets-provisioning.md), [`deployment-targets.md`](deployment-targets.md)
- **Quality:** [`../13-quality/quality-gates.md`](../13-quality/quality-gates.md), [`../13-quality/anti-slop.md`](../13-quality/anti-slop.md), [`../13-quality/iron-laws.md`](../13-quality/iron-laws.md)
- **Test plans:** [`../07-testing/`](../07-testing/)
- **Code:** `scripts/lint-no-stdout.mjs`, `tests/lint/no-stdout.test.ts`, all `tests/`

---

*Last reviewed: 2026-04-25 by Chris.*
