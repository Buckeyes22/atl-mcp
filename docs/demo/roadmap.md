# Roadmap + Milestones

> **Mirror of** [`ACO/Roadmap + Milestones`](https://lateapexllc.atlassian.net/wiki/spaces/ACO). Status as of 2026-04-27. Aligned with v6 §28.

## Milestone status

| Milestone | Surface area | Status | Linked epic |
|---|---|---|---|
| M0 | Scaffold — runtime, transport, lint | ✅ Done | [PCO-1](https://lateapexllc.atlassian.net/browse/PCO-1) |
| M1 | Domain model + storage + token encryption | ✅ Done | [PCO-2](https://lateapexllc.atlassian.net/browse/PCO-2) |
| M2 | Atlassian providers + capability discovery | 🟡 In progress (auth+read done; capability discovery open) | [PCO-3](https://lateapexllc.atlassian.net/browse/PCO-3) |
| M3 | VCS provider (Bitbucket) | 🟡 In progress (auth+REST done; worktree manager open) | [PCO-4](https://lateapexllc.atlassian.net/browse/PCO-4) |
| M4 | Blueprint workflow with sampling | ⏳ To Do | [PCO-5](https://lateapexllc.atlassian.net/browse/PCO-5) |
| M5 | Provisioning planner | ⏳ To Do | [PCO-6](https://lateapexllc.atlassian.net/browse/PCO-6) |
| M6a | Jira executor (first shippable slice) | ⏳ To Do | [PCO-6](https://lateapexllc.atlassian.net/browse/PCO-6) |
| M6b | Confluence executor | ⏳ To Do | [PCO-6](https://lateapexllc.atlassian.net/browse/PCO-6) |
| M6c | VCS executor | ⏳ To Do | [PCO-6](https://lateapexllc.atlassian.net/browse/PCO-6) |
| M7 | Context resources + packs | ⏳ To Do | (future epic) |
| M8 | Readiness validation | ⏳ To Do | (future epic) |
| M9 | Agent handoff | ⏳ To Do | (future epic) |
| M10 | Webhook ingestion + subscriptions | ⏳ To Do | (future epic) |
| M11 | Notifications, evals, hardening (audit + policy slice done) | 🟡 In progress | [PCO-7](https://lateapexllc.atlassian.net/browse/PCO-7) |

## Versions

- **v0.1 — First Shippable Slice.** Closes when M6a ships. Per v6 §28, M6a is the first shippable slice (Jira provisioning end-to-end).
- **v0.2 — Read-Path Demo.** Closes when M7 ships (context resources + packs).

## What's next (M6a)

The next priority is M6a: the Jira provisioning executor. M5 (planner) has to land first, and M5 has to come after M4 (blueprint workflow). So the immediate next step is:

1. M4 — blueprint workflow with sampling. ~PCO-5 epic.
2. M5 — provisioning planner. ~PCO-6 epic, child stories.
3. M6a — Jira executor with idempotent retry semantics. ~PCO-6 epic, "Jira executor" child story.

Once M6a ships, the orchestrator can produce a real Jira project from a real profile end-to-end — and the `seed-jira.py` simulation script becomes redundant, replaced by a single `atl-mcp provision <profile.json>` invocation.

## Future-work backlog (added 2026-04-27)

The unfinished surface, tracked as 6 epics with structured task/subtask breakdowns in PCO. Each maps to a milestone or hardening surface above.

| Epic | Phase | Covers |
|---|---|---|
| [PCO-77](https://lateapexllc.atlassian.net/browse/PCO-77) | M6b | Confluence Provisioning Executor — page action handler in provisionJob, ADF rendering wired, trace links + idempotency, integration tests (4 tasks · 13 subtasks) |
| [PCO-95](https://lateapexllc.atlassian.net/browse/PCO-95) | M6c | VCS Provisioning Executor — Bitbucket + GitHub repo+branch handlers, worktreeManager initialization, trace links + tests (4 tasks · 14 subtasks) |
| [PCO-114](https://lateapexllc.atlassian.net/browse/PCO-114) | M11 | Operations Surface — Prometheus exporter, real alert state, SLO evaluation, cost model, DR drill scheduler (6 tasks · 20 subtasks) |
| [PCO-141](https://lateapexllc.atlassian.net/browse/PCO-141) | post-M7 | Memory & Embeddings Hardening — replace hash-based embeddings with sentence-transformer, migration plan (2 tasks · 6 subtasks) |
| [PCO-150](https://lateapexllc.atlassian.net/browse/PCO-150) | M11 | Observability Hardening — OpenTelemetry tracing, structured error taxonomy (2 tasks · 6 subtasks) |
| [PCO-159](https://lateapexllc.atlassian.net/browse/PCO-159) | M11+ | Secrets Rotation — `admin.secrets.rotate.token` end-to-end (1 task · 4 subtasks) |

Each task points at a specific stub location or behavior in the codebase.

## What's deferred

- **Multi-tenant.** v6 §7.3 documents the runway. Out of v1.
- **GitHub / GitLab / Linear / BB Server.** v6 §3.
- **Persistent agent memory.** v6 §4.
- **OpenAPI codegen** for the admin REST API. v6 §40 F-151.
