---
title: Anti-Slop Discipline
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer]
sdlc_category: 13-quality
related: [agent-context-orchestrator-mcp-plan-v6.md §31.2, docs/partners/simple-commands-mcp.md]
---

# Anti-Slop Discipline

> **TL;DR:** "Slop" = lazy patterns that look functional but are degraded. Examples: `Math.random` in production paths, `console.log` in `src/`, lorem-ipsum / TODO without ticket, empty function bodies, "throw new Error('not implemented')" in shipped code. v1 has `lint:no-stdout` (live) + the broader anti-stub scanner planned for M4–M11. v6 §31.2; F-002 (simple-commands-mcp).

The anti-slop rule: machine enforcement first, review backstop second. Don't let pattern-recognition fail silently.

---

## What's slop

Patterns that pass syntax checks + tests but indicate degraded craft:

| Pattern | Why it's slop |
|---|---|
| `console.log` in `src/` | Corrupts MCP stdio protocol stream (Incident A) |
| `console.error` in `src/` (outside logger) | Same — also goes to stdout in some configs |
| `process.stdout.write` (literal form) | Same |
| `process.stdout.write` (alias form, e.g., `const w = process.stdout`) | Same; PCO-12 documents the gap |
| `Math.random` in production paths | Non-determinism without justification; make seeded if needed |
| `// TODO` without a ticket reference | Drifts; nobody will fix |
| `// FIXME` without a ticket | Same |
| `// XXX` | Same |
| Lorem-ipsum text in production code | Forgotten placeholder |
| `throw new Error("not implemented")` in shipped code | Should be `throw new Error("…")` with a real message OR a registered tool that's flag-disabled |
| Empty function body (no comment explaining why) | Stub left behind |
| `as any` casts without comment | Bypassing strict mode silently |
| Catch + ignore (`catch (_) {}`) | Silent failure |

## Enforcement

### `lint:no-stdout` (live)

```bash
npm run lint:no-stdout
```

`scripts/lint-no-stdout.mjs` greps `src/` for forbidden tokens. Allowlist: `src/observability/logger.ts` (the legitimate writer construction).

Test: `tests/lint/no-stdout.test.ts` runs the lint as a vitest test.

Known limitation: regex-based, misses alias forms. PCO-12 tracks the AST-walk replacement.

### Anti-stub scanner (planned, M4–M11)

Beyond stdout, the scanner catches:

- `Math.random` in non-test paths.
- `// TODO` without `(PCO-N)` annotation.
- `lorem ipsum` / `placeholder` text patterns.
- `not implemented` patterns.
- Empty function bodies.

Status: spec'd in v6 §31.2; implementation planned in M4–M11.

### ESLint rules

`@typescript-eslint` rules catch:

- Unused variables.
- Unused imports.
- Missing return types where it matters.
- Some `any` patterns.

Configured in `eslint.config.js`.

### Review backstop

Reviewers catch what tooling can't:

- Comment that doesn't explain why.
- Function that's correct but obtuse.
- Missing test for an edge case.
- Variable name that fights readability.

## Why this matters

In a build-agent-assisted codebase, anti-slop is doubly important. Build agents (and humans) are good at producing plausible-looking code. The plausibility is the trap — code that *looks* fine can hide real failures.

Examples that motivated the discipline:

- **Incident A.** `console.log` in `src/mcp/sessionCapabilities.ts` shipped silently in M0. Looked fine; broke MCP clients.
- **Stub pattern catch (simple-commands-mcp F-002).** Production paths with `Math.random` or empty bodies pass tests but produce non-deterministic output.

## Discipline cost

Anti-slop checks add CI time + review burden. Worth it because:

- Catches problems at minimum cost.
- Reduces "I deployed and it's wrong" incidents.
- Scales: tooling enforces; humans review; both improve over time.

Cost is ~5% of CI time + ~10% of review time. Saves more than it spends.

## Adding a new check

When discovering a new slop pattern:

1. Capture an example.
2. Decide enforcement: tooling (ESLint rule, anti-stub addition) or review (checklist item).
3. If tooling: write the rule + a test that verifies it catches the example AND doesn't false-positive.
4. Add to this doc + to [`quality-gates.md`](quality-gates.md).

## Linked artifacts

- **Spec:** v6 §31.2 (anti-slop linting in CI)
- **F-002 (simple-commands-mcp source):** [`../../partners/simple-commands-mcp.md`](../../partners/simple-commands-mcp.md)
- **Code:** `scripts/lint-no-stdout.mjs`, `tests/lint/no-stdout.test.ts`
- **Sibling:** [`code-style.md`](code-style.md), [`iron-laws.md`](iron-laws.md), [`quality-gates.md`](quality-gates.md)
- **CI:** [`../09-deployment/ci-cd.md`](../09-deployment/ci-cd.md)
- **Tracking:** PCO-12 (AST-walk lint upgrade)

---

*Last reviewed: 2026-04-25 by Chris.*
