# Claude Code: orchestrator project guidance

This file is hand-authored guidance for Claude Code when working in this repo. It intentionally diverges from `AGENTS.md` (which is the LF-spec canonical agent contract regenerated to other hosts via `scripts/syncAgentConfigs.ts`). Read both.

## What this project is

The Agent Context Orchestrator MCP Server. Turns raw project requirements into agent-ready Atlassian + VCS workspaces. Build-agent-agnostic — Claude Code is one of several reference consumers.

**Three docs are authoritative**, in this order:

1. [`agent-context-orchestrator-mcp-plan-v6.md`](agent-context-orchestrator-mcp-plan-v6.md) — the spec.
2. [`docs/build-orchestration.md`](docs/build-orchestration.md) — the build sequence (M0 → M11) tying milestones to partner guides.
3. [`docs/partners/`](docs/partners/) — 42 partner integration guides. Each adoption point in the spec is backed by one of these.

If a question can be answered from these three, prefer them over inferring from code.

## Operating rules in this repo

- **Never write to stdout from `src/`.** The stdio MCP transport carries JSON-RPC frames over stdout. A single `console.log` corrupts the protocol stream and breaks every connected client. Use the pino file logger via `src/observability/logger.ts`. The `npm run lint:no-stdout` check (and a vitest test) enforces this.
- **Single-message Task dispatch.** When you spawn multiple sub-agents that should run in parallel, issue all `Task(...)` calls in a single assistant message. Sequential messages cause Claude Code to execute them serially. ([`docs/partners/claude-workflow-v2.md`](docs/partners/claude-workflow-v2.md) F-083)
- **Iron laws.** Do not claim a task done without verification evidence (tests pass, build succeeds, etc.). Do not write production code without a failing test first when adding behavior. ([`docs/partners/superpowers.md`](docs/partners/superpowers.md) F-106)
- **Do not invent skills, hooks, or plugins outside the v6 spec.** New surface area requires an ADR (MADR format, in `docs/adr/`).

## Where I am in the build

Check `docs/adr/` for the latest decision records. Check the v6 §28 milestones table to see what's been delivered. Each commit message references its milestone (e.g., `m0/scaffold:`, `m1/storage:`) — `git log --oneline` is the fastest way to orient.

## Things that are NOT my concern

- Persistent agent memory across sessions (out of v1 scope per v6 §4 non-goals; see [`docs/partners/hindsight.md`](docs/partners/hindsight.md)).
- Multi-tenant SaaS hosting (post-v1; runway documented in v6 §7.3).
- Bitbucket Data Center / Server, GitHub, GitLab (post-v1; v6 §3 non-goals).
- OpenAPI codegen for any internal admin REST API (deferred per v6 §40 F-151).

## When I need an answer

- Is it a v6 spec question? → Read v6 plan section.
- Is it about how to integrate a partner? → Read its `docs/partners/<slug>.md`.
- Is it about the right next step? → [`docs/build-orchestration.md`](docs/build-orchestration.md) §5 sequence.
- Is it about a recorded design decision? → `docs/adr/`.
- Is it an SDLC-discipline question (architecture, security, operations, deployment, DR, testing, governance, capacity, cost)? → [`docs/sdlc/README.md`](docs/sdlc/README.md) routes to ~95 docs across 17 categories.
- Is it about which Claude Code hooks fire in agent contexts? → [`docs/partners/claude-code-best-practice.md`](docs/partners/claude-code-best-practice.md) (only 6 of 27 fire).
- Is it about plugin emission rules? → [`docs/partners/everything-claude-code.md`](docs/partners/everything-claude-code.md).
- Is it none of the above? → Ask before guessing.
