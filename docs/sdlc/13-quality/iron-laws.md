---
title: Iron Laws
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer]
sdlc_category: 13-quality
related: [docs/partners/superpowers.md, CLAUDE.md, docs/sdlc/12-governance/definition-of-ready-done.md]
---

# Iron Laws

> **TL;DR:** Two non-negotiable rules from F-106 (superpowers) and CLAUDE.md. (1) Never claim a task done without verification evidence. (2) Never write production code without a failing test first when adding behavior. They're "iron" because they don't bend. Plus the related operational invariant: never write to stdout from `src/`.

These laws are the spine of the engineering discipline. Without them, the project ships faster but breaks more.

---

## Iron Law 1: Verify before claiming done

**No "I think it works" or "tests pass on my machine."**

Concretely:

- **Tests pass.** All of them. Locally + CI.
- **Build succeeds.** No errors, no warnings introduced.
- **Lint clean.** ESLint + lint:no-stdout + (when wired) anti-stub.
- **Smoke test passes** for runtime changes (e.g., `curl /healthz` after a deploy).
- **Audit chain integrity holds** for any state-change addition.

The phrase "should work" is never a substitute for verification.

### What this catches

- The "tests passed but I changed the test" trap.
- The "fixed in a hotfix nobody verified" trap.
- The "I forgot to run X" trap.

### How CI gates support it

CI gates are the mechanical part of verification. Reviewer judgment fills the rest.

## Iron Law 2: Test-first for new behavior

**Before writing production code that changes behavior, write a test that fails because the new behavior is absent.**

Concretely:

```bash
# 1. Write the test
git add tests/...
# 2. Run; confirm it fails (the relevant assertion)
npm test -- tests/your.test.ts
# (red)
# 3. Implement
git add src/...
# 4. Run; confirm passes
npm test -- tests/your.test.ts
# (green)
# 5. Commit + PR
```

The PR's diff should show the test landing first (or in the same commit, with the test demonstrably failing without the production code).

### Exceptions

- **Refactors that preserve behavior.** Existing tests stay green; no new test required.
- **Doc-only changes.** No test.
- **CI / lint config changes.** The change is its own test.

If you're not sure whether a change is "new behavior" or "refactor": treat it as new behavior. Better to over-test than under-test.

### What this catches

- "I implemented X but never wrote a test for it" → caught: the test must come first.
- "The test passes whether or not the code is there" → caught: the test must initially fail.
- "I changed the test to match the new behavior" → caught: the failing-without is part of the diff.

## Operational invariant: no stdout from `src/`

Not technically an "iron law" but operationally non-negotiable:

> **The stdio MCP transport carries JSON-RPC frames over stdout. Any rogue write corrupts the protocol stream and breaks every connected client. Therefore: no `console.log`, no `process.stdout.write`, no any-form-of-stdout-write from `src/`.**

Enforced by `lint:no-stdout` (CLAUDE.md). Tested by `tests/lint/no-stdout.test.ts`.

The exception: `src/observability/logger.ts` is the *only* file allowed to construct a writer. It writes to a file (or stderr in dev), not stdout.

PCO-12 documents an open gap (alias forms slip through the regex-based lint). Severity is medium because the literal form (which IS caught) is the path normal coding takes.

## Why "iron"

These rules are "iron" because:

- **Bending them defeats them.** The laws are systems, not preferences. One exception licenses many.
- **The cost of compliance is low** vs. the cost of the failures they prevent. Test-first slows you 10%; missed bugs cost weeks.
- **They scale.** As the team grows, the discipline becomes the substrate.

When they bend in real life — when a hotfix happens at 2 AM and the test-first ritual gets skipped — the next-day work is to re-attach the test. The law is what brings the discipline back.

## Why "two laws, not ten"

A long list dilutes. Two laws fit on a sticker; everyone remembers them.

Other rules are real and matter, but they're tactics:

- "Default to no comments" (style).
- "Use Zod for input validation" (idiom).
- "Write structured logs" (observability).

Tactics flex; iron laws don't.

## When the iron law fails

When you discover an iron-law violation:

1. **Don't shame.** This is process, not personal.
2. **Identify the gap.** What allowed the violation? Tooling? Review? Pressure?
3. **Patch the gap.** Lint check, CI gate, review checklist.
4. **Backfill the test** (for Law 2).
5. **Document in audit findings** if material.

Iron laws are upheld by the system, not by individual willpower.

## Linked artifacts

- **F-106 (superpowers source):** [`../../partners/superpowers.md`](../../partners/superpowers.md)
- **CLAUDE.md operating rules:** [`../../../CLAUDE.md`](../../../CLAUDE.md)
- **AGENTS.md:** [`../../../AGENTS.md`](../../../AGENTS.md)
- **Sibling docs:** [`code-style.md`](code-style.md), [`anti-slop.md`](anti-slop.md), [`quality-gates.md`](quality-gates.md)
- **DoR / DoD:** [`../12-governance/definition-of-ready-done.md`](../12-governance/definition-of-ready-done.md)
- **Code review:** [`../12-governance/code-review.md`](../12-governance/code-review.md)

---

*Last reviewed: 2026-04-25 by Chris.*
