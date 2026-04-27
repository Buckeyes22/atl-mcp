# Jira Work Items — PCO Project

> **Live board:** [PCO Kanban](https://lateapexllc.atlassian.net/jira/software/projects/PCO/boards/1) · **Issue list:** [PCO issues](https://lateapexllc.atlassian.net/issues/?jql=project%20%3D%20PCO%20ORDER%20BY%20created%20DESC)
>
> **Provenance:** the build structure below — 8 build epics, 5 flagship stories with subtask breakdowns, ~50 filler tickets, distributed across 10 components — is the output of running the orchestrator's blueprint on the project's own profile. Where M4 (blueprint workflow) and M6a (Jira executor) aren't yet implemented, the seed script at [`scripts/demo/seed-jira.py`](../../scripts/demo/seed-jira.py) faithfully simulates the executor's output shape. A separate **future-work backlog** (6 epics + 19 tasks + 63 subtasks, added 2026-04-27) tracks unfinished features as a structured plan — see ["Future-work backlog"](#future-work-backlog-6-epics-added-2026-04-27) below.

---

## At a glance

- **Project key:** `PCO`
- **Style:** team-managed (next-gen) Software Kanban
- **Issue types in use:** Epic, Task, Subtask (true 3-level hierarchy). Tasks subclassified via labels (`type:story` / `type:bug` / `type:spike` / `type:task`).
- **Statuses:** To Do / In Progress / Done (template constraint; see [`known-limitations.md`](known-limitations.md)).
- **Components:** 10 (mirror `src/` directory structure)
- **Issue count:** 76 (8 epics + 5 flagships + 50 filler + **13 subtasks** under flagships)
- **Subtasks:** 13 across the 5 flagships, showing implementation breakdown (PCO-64 through PCO-76)
- **Hierarchy:** 100% parent linkage. Every Task is parented to an Epic; every Subtask is parented to a Task.

## Components (10)

| Component | Maps to | What lives here |
|---|---|---|
| Runtime | [`src/mcp/`](../../src/mcp/) | Process lifecycle, transport, server bootstrap |
| Domain | [`src/domain/`](../../src/domain/) | 18 domain types and value objects |
| Storage | [`src/storage/`](../../src/storage/) | Schema, migrations, repositories |
| Providers - Atlassian | [`src/providers/atlassian/`](../../src/providers/atlassian/) | Jira + Confluence integration |
| Providers - VCS | [`src/providers/vcs/`](../../src/providers/vcs/) | Bitbucket integration |
| Security | [`src/security/`](../../src/security/) | Auth, encryption, policy, audit, webhooks |
| Observability | [`src/observability/`](../../src/observability/) | Pino logger, metrics, traces |
| Preflight | [`src/preflight/`](../../src/preflight/) | Capability discovery, readiness |
| Docs | [`docs/`](../) | Spec, partner guides, ADRs |
| Demo Ops | [`docs/demo/`](.) | Portfolio surface |

## Labels (12)

`mcp`, `atlassian`, `vcs`, `security`, `audit`, `queue`, `ops`, `demo`, `tech-debt`, `breaking`, `wont-do`, plus `type:story` / `type:bug` / `type:spike` / `type:task` for issue-type subclassification.

## Versions

- `v0.1 — First Shippable Slice` (closes when M6a ships)
- `v0.2 — Read-Path Demo` (closes when M7 ships)

---

## The 8 build epics

| # | Key | Title | Status | What it covers | Spec |
|---|---|---|---|---|---|
| 1 | [PCO-1](https://lateapexllc.atlassian.net/browse/PCO-1) | Runtime, Deployment, Transport (M0) | Done | Dual-port MCP transport, server bootstrap, Dockerfile | v6 §22, §28 M0 |
| 2 | [PCO-2](https://lateapexllc.atlassian.net/browse/PCO-2) | Domain Model and Storage (M1) | Done | 18 domain types; storage with migration runner; token encryption | v6 §10, §28 M1 |
| 3 | [PCO-3](https://lateapexllc.atlassian.net/browse/PCO-3) | Atlassian Providers + Capability Discovery (M2) | In Progress | Jira REST v3 + Confluence REST v2, OAuth 3LO, capability discovery | v6 §19, §20, §28 M2 |
| 4 | [PCO-4](https://lateapexllc.atlassian.net/browse/PCO-4) | VCS Provider — Bitbucket (M3) | In Progress | App-password auth, REST v2, per-session worktree manager | v6 §13, §19, §24.5, §28 M3 |
| 5 | [PCO-5](https://lateapexllc.atlassian.net/browse/PCO-5) | Blueprint Workflow with Sampling (M4) | To Do | Profile → epic+story plan via MCP sampling | v6 §23, §28 M4 |
| 6 | [PCO-6](https://lateapexllc.atlassian.net/browse/PCO-6) | Provisioning Planner + Executors (M5–M6c) | To Do | Diff-against-live planner, idempotent Jira/Confluence/VCS executors | v6 §18, §28 M5–M6c |
| 7 | [PCO-7](https://lateapexllc.atlassian.net/browse/PCO-7) | Audit + Policy Enforcement (M11) | In Progress | Hash-chain + ed25519 audit, policy decision layer | v6 §7.2, §30.1, §28 M11 |
| 8 | [PCO-8](https://lateapexllc.atlassian.net/browse/PCO-8) | Demo Documentation + Portfolio Packaging | In Progress | This portfolio. The dogfooding meta-epic. | (not in v6 — meta) |

## The 5 flagship stories (production-depth)

| Key | Title | Why it's a flagship |
|---|---|---|
| [PCO-9](https://lateapexllc.atlassian.net/browse/PCO-9) | Implement audit chain hash linkage with ed25519 signature | Cryptographic depth; 5 G/W/T criteria; links ADR-0005 + v6 §30.1 |
| [PCO-10](https://lateapexllc.atlassian.net/browse/PCO-10) | Capability discovery against Jira Cloud REST v3 with API token auth | Real API integration with edge cases (429s, pagination, missing perms) |
| [PCO-11](https://lateapexllc.atlassian.net/browse/PCO-11) | [Spike] Confluence storage format vs ADF — pick a default | Research → ADR pattern; closure is ADR-0003 |
| [PCO-12](https://lateapexllc.atlassian.net/browse/PCO-12) | [Bug] lint:no-stdout misses dynamic process.stdout.write calls | Demonstrates self-discovered defects; senior signal |
| [PCO-13](https://lateapexllc.atlassian.net/browse/PCO-13) | Migrate from raw SQL migrations to a runner with rehearsal | Tests-first; concurrency control; ties to Incident B in runbook |

Click any flagship to see the production-depth description with full Given/When/Then acceptance criteria, linked ADRs, and design notes.

## Subtasks under flagships (13)

Each flagship has 2–3 subtasks showing implementation breakdown. PCO-64 through PCO-76 — every subtask is parented to its flagship.

| Flagship | Subtasks |
|---|---|
| [PCO-9](https://lateapexllc.atlassian.net/browse/PCO-9) audit chain hash linkage | PCO-64 (schema columns) · PCO-65 (chain_hash + ed25519 pipeline) · PCO-66 (offline verifier CLI) |
| [PCO-10](https://lateapexllc.atlassian.net/browse/PCO-10) Jira capability discovery | PCO-67 (probe set) · PCO-68 (429 retry) · PCO-69 (warnings emitter) |
| [PCO-11](https://lateapexllc.atlassian.net/browse/PCO-11) ADF vs storage spike | PCO-70 (round-trip fixtures) · PCO-71 (tradeoff matrix) · PCO-72 (draft ADR-0003) |
| [PCO-12](https://lateapexllc.atlassian.net/browse/PCO-12) lint:no-stdout alias-form bug | PCO-73 (regression test) · PCO-74 (AST-walk replacement) |
| [PCO-13](https://lateapexllc.atlassian.net/browse/PCO-13) migration runner with rehearsal | PCO-75 (runner + advisory lock) · PCO-76 (rehearsal mode) |

Subtasks are filterable on the Kanban board (they nest under their parent, don't appear as separate cards) and visible in the parent ticket's detail view.

## Future-work backlog (6 epics, added 2026-04-27)

A structured backlog of unfinished features tracked as epics + tasks + subtasks, distinct from the 8 build epics above. Each future-work epic carries `tech-debt` plus a phase-specific label so backlog filtering works out of the box.

| Key | Title | Phase label | Tasks | Subtasks |
|---|---|---|---|---|
| [PCO-77](https://lateapexllc.atlassian.net/browse/PCO-77) | M6b — Confluence Provisioning Executor | `phase-m6b` | 4 | 13 |
| [PCO-95](https://lateapexllc.atlassian.net/browse/PCO-95) | M6c — VCS Provisioning Executor | `phase-m6c` | 4 | 14 |
| [PCO-114](https://lateapexllc.atlassian.net/browse/PCO-114) | M11 — Operations Surface | `phase-m11` | 6 | 20 |
| [PCO-141](https://lateapexllc.atlassian.net/browse/PCO-141) | Memory & Embeddings Hardening | `memory-hardening` | 2 | 6 |
| [PCO-150](https://lateapexllc.atlassian.net/browse/PCO-150) | Observability Hardening | `observability` | 2 | 6 |
| [PCO-159](https://lateapexllc.atlassian.net/browse/PCO-159) | Secrets Rotation (M11+) | `phase-m11`, `security` | 1 | 4 |

Total future-work load: **19 tasks, 63 subtasks**. Each task names a concrete file path or behavior change — actionable, not "investigate X." This backlog is evidence of self-policing scope: the unfinished surface is visible and trackable rather than implicit.

## Filler tickets (~50)

Distributed across the 8 epics. Each filler has a 1-paragraph stub pointing back to the parent epic for context. Filler is calibrated for "looks real, not padded": each epic has 3–8 filler tickets reflecting plausible work breakdown, plus a few `wont-do` tickets that show real triage (e.g. "Add OAuth 1.0 support" — won't do per v6 §3 non-goals).

The distribution by epic and type:

| Epic | Stories | Bugs | Spikes | Tasks |
|---|---|---|---|---|
| Runtime (PCO-1) | 2 | 1 (flagship) | 0 | 2 |
| Domain + Storage (PCO-2) | 5 | 2 | 1 | 1 |
| Atlassian providers (PCO-3) | 5 | 3 | 0 | 0 |
| VCS (PCO-4) | 4 | 0 | 0 | 0 |
| Blueprint workflow (PCO-5) | 4 | 0 | 1 | 0 |
| Provisioning (PCO-6) | 6 | 1 | 0 | 0 |
| Audit + Policy (PCO-7) | 4 | 0 | 1 | 0 |
| Demo Ops (PCO-8) | 3 | 0 | 0 | 1 |

(Bug counts include the flagship bug PCO-12; spike counts include flagship spike PCO-11.)

## Linking discipline

- Every flagship has at least one ADR link and one v6 §-reference.
- Every Audit + Policy ticket links to ADR-0005.
- Every "wont-do" ticket has a labeled rationale pointing to the v6 non-goal that justifies the deferral.

---

## How to navigate (for an interviewer)

The fastest reading order for getting a sense of the project structure:

1. Open [the board](https://lateapexllc.atlassian.net/jira/software/projects/PCO/boards/1) — see the column distribution.
2. Open the epic list. Click epic [PCO-7 (Audit + Policy)](https://lateapexllc.atlassian.net/browse/PCO-7) — most architecturally interesting.
3. Open flagship [PCO-9](https://lateapexllc.atlassian.net/browse/PCO-9). Read the description and acceptance criteria.
4. Click into ADR-0005 (linked from PCO-9). Confirm the implementation matches the design.

That's a 5-minute tour by itself. The rest of the project earns its credibility from the consistency between board, ticket, ADR, code, and spec.
