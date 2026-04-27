---
title: Code Review
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer]
sdlc_category: 12-governance
related: [docs/partners/superpowers.md, AGENTS.md]
---

# Code Review

> **TL;DR:** Two-stage review per F-107 (superpowers): spec-conformance pass + code-quality pass. Reviewer can be the same person; the passes are distinct. CI gates are mandatory; reviewer judgment fills the gaps. v1 single-maintainer means self-review with discipline; multi-team adds reviewer rotation.

The two-stage discipline is one of the most useful process choices. It separates "is this what we said we'd build?" from "is the code well-crafted?"

---

## Two stages

### Stage 1: Spec conformance

Question: **does this PR match the spec / ADR / partner-guide it claims to implement?**

Reviewer checks:
- The PR description names what's being built (milestone / ticket / ADR).
- The implementation reflects what the spec says.
- Any deviations from spec are flagged AND have rationale (or earn a new ADR).
- Test coverage matches the spec's invariants.

Output: spec-conformance pass / fail. Failures: re-spec or re-implement.

### Stage 2: Code quality

Question: **assuming the spec match is correct, is the code well-crafted?**

Reviewer checks:
- Idiomatic TypeScript (strict mode obeyed; no `any` without comment; types meaningful).
- Names readable, terse where context exists.
- Errors handled at appropriate boundaries.
- No silent fallbacks for cases that shouldn't happen.
- No dead code; no commented-out code.
- Comments explain WHY non-obvious decisions exist; don't repeat WHAT the code does.
- Tests assert behavior, not implementation.
- New deps justified.

Output: code-quality pass / change requests.

## Why two stages

A single conflated review tends to skip one or the other:

- "It compiles and tests pass" misses spec drift.
- "It matches the spec" misses code-quality issues.

Two stages force both. Even self-review benefits — alternating between "does this match v6 §X?" and "is the variable name clear?" produces better feedback than one combined sweep.

## What CI catches (and doesn't)

CI catches:
- Compilation errors.
- Test failures.
- Lint violations (ESLint + lint:no-stdout + anti-stub when wired).
- Typecheck failures.

CI does NOT catch:
- Spec drift (CI doesn't read the spec).
- Naming choices.
- Whether the test actually exercises the intent.
- Missing test cases for edge conditions.
- Documentation drift.

Reviewer judgment fills these gaps.

## Review heuristics

### "What test would catch this?"

For every behavior change, ask: which test would fail without the change? If you can't name one, the test surface is incomplete.

### "What's the smallest reasonable PR?"

Smaller PRs review better. If the PR description has > 5 bullet points, consider splitting.

### "What's the WHY?"

Comments and commit messages should answer WHY. The diff already shows WHAT.

### "Does this match the spec section it cites?"

If the PR cites v6 §X but the implementation doesn't match: either the spec needs updating (with an ADR) or the implementation is wrong.

### "Is this reversible?"

Some changes are easy to back out (a function refactor); some aren't (a data migration). High-blast-radius changes need higher review bar.

## When to ask for changes

Reviewer requests changes when:

- The diff would be incorrect / unsafe / non-idiomatic.
- Tests are missing for a non-trivial change.
- The PR description is too vague to verify spec conformance.
- The PR violates an iron law.

Reviewer does NOT request changes for personal style preferences. Stick to spec + idiomatic + safety.

## Self-review (v1 single-maintainer)

The discipline is harder solo. Tactics:

- **Sleep on it.** Review your own PR after a delay; mistakes are more visible.
- **Read the diff out loud.** Catches typos and unclear names.
- **Run the failing test on the previous commit.** Verifies test-first.
- **Check spec citations.** Open the v6 section the PR claims; verify match.
- **Check threat-model implications.** Does this PR add a new operation? New auth? Re-evaluate the threat model.

Self-review isn't as good as peer review. It's better than no review.

## Multi-team review (post-v1)

When the team grows:

- Reviewer rotation (named on each PR).
- Two reviewers for high-blast-radius changes (security, audit, schema).
- Architectural reviews for cross-module changes.
- Stage 1 and Stage 2 may be different reviewers.

## Linked artifacts

- **F-107 (two-stage):** [`../../partners/superpowers.md`](../../partners/superpowers.md)
- **AGENTS.md:** [`../../../AGENTS.md`](../../../AGENTS.md) — PR instructions
- **CLAUDE.md:** [`../../../CLAUDE.md`](../../../CLAUDE.md) — operating rules
- **Iron laws:** [`../13-quality/iron-laws.md`](../13-quality/iron-laws.md)
- **Sibling:** [`adr-process.md`](adr-process.md), [`change-management.md`](change-management.md), [`definition-of-ready-done.md`](definition-of-ready-done.md)

---

*Last reviewed: 2026-04-25 by Chris.*
