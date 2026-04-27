# AGENTS

Per the Linux Foundation AGENTS.md specification (Jan 2026; see [`docs/partners/agents-md.md`](docs/partners/agents-md.md)). This file is the canonical agent contract for the orchestrator repo. Cursor / Codex / Copilot configs are regenerated from this file by `scripts/syncAgentConfigs.ts` (lands with M9). Do not hand-edit those generated configs — edit AGENTS.md.

> SDLC documentation organized by discipline (charter, architecture, security, operations, deployment, DR, testing, governance, capacity, cost) lives in [`docs/sdlc/`](docs/sdlc/README.md). For agent contracts and CI gates, this file remains canonical.

## Dev environment tips

- Node.js 22+ required (`exactOptionalPropertyTypes: true` is enabled).
- Install with `npm install` (or `pnpm install` if you prefer; both work).
- `npm run dev` runs the server with `tsx watch` for live reload.
- `npm run typecheck` validates TS without emitting.
- The orchestrator never writes to stdout — all logs go to `LOG_FILE_PATH` (default `./orchestrator.log`). Do not introduce `console.*` calls in `src/`; `npm run lint:no-stdout` enforces this and is part of `npm test`.
- Local development uses PGlite (M1+); deployed mode uses Postgres 16. `docker-compose up postgres redis` brings up the deployed-mode dependencies.
- Mgmt API (port 3001) is loopback-only by default — do not bind it to 0.0.0.0 outside container deployments.

## Testing instructions

- `npm test` runs the full vitest suite (unit + integration + the F-031 no-stdout lint).
- `npm run test:watch` for TDD.
- Tests live under `tests/`:
  - `tests/unit/` — pure unit tests (no IO).
  - `tests/integration/` — Hono `app.fetch` style integration tests (no real network).
  - `tests/lint/` — invariants (no-stdout, etc.).
  - `tests/contract/` — provider contract tests (lands with M2).
  - `tests/conformance/` — six-dim rubric (lands with M11).
  - `tests/evals/` — eval-view driven golden + LLM judge (lands with M11).
- New code must ship with tests. `should-catch` and `should-pass` fixtures per [velocity-ops-engine F-002](docs/partners/velocity-ops-engine.md) when adding lint/security rules.
- Coverage threshold is not enforced in M0; will be enforced from M1 onward at 80%+.

## PR instructions

- Branch naming: `feat/<scope>`, `fix/<scope>`, `chore/<scope>`, `docs/<scope>`, `m<N>/<short-name>` for milestone work (e.g., `m1/drizzle-schemas`).
- Commit message: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`).
- Every architectural decision needs an ADR in `docs/adr/` (MADR format; see [`docs/partners/madr.md`](docs/partners/madr.md)) and must satisfy START Criteria + Definition of Done from [`docs/partners/adr-github-io.md`](docs/partners/adr-github-io.md).
- PR description must reference the milestone (M0/M1/.../M11) and the v6 plan section(s) the change implements.
- CI gates (cumulative as milestones land):
  - M0: typecheck + vitest + no-stdout lint.
  - M11: + eval-view verdict gate, anti-slop linter, semgrep banned-patterns, MCP conformance suite.
- Two-stage review per [`docs/partners/superpowers.md`](docs/partners/superpowers.md): Stage 1 = spec compliance; Stage 2 = code quality. Stage 1 must pass before Stage 2 runs.

## Coding conventions

- TypeScript strict mode + `exactOptionalPropertyTypes: true` + `noUncheckedIndexedAccess: true`. No `any`, no `as any`, no double-cast, no `// @ts-ignore`. Use Zod for runtime validation of any external data.
- Keep files focused and split them when it improves reviewability or ownership.
- Iron laws ([`docs/partners/superpowers.md`](docs/partners/superpowers.md)):
  1. **No completion claims without verification evidence.** Tests must pass before claiming a task done.
  2. **No production code without a failing test first.** Write the test, watch it fail, then implement.
- Comment policy: default to no comments. Add a comment only when the WHY is non-obvious — a hidden constraint, an invariant, a workaround. Do not comment on what the code does (well-named identifiers handle that).
- Imports: stdlib → external → internal. Use NodeNext-style `.js` suffixes on internal imports (the build target is ESM).
- Repository layout follows v6 §8. Do not invent new top-level dirs without an ADR.
- Persona vocabulary in prompts ([`docs/partners/three-man-team.md`](docs/partners/three-man-team.md) F-113): named personas with biographical detail outperform generic role labels. Use sparingly and only in §29 prompts.
- The orchestrator is build-agent-agnostic. Code that only works for Claude Code (or only Codex) belongs in `docs/claude-code.md` or `docs/codex.md`, not in `src/`.
