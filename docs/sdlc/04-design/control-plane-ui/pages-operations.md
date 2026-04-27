---
title: Operator Control Plane Operations Pages
owner: Chris
status: accepted
last_reviewed: 2026-04-27
version: 1.1.0
audience: [engineer, operator, auditor]
sdlc_category: 04-design
related: [docs/sdlc/04-design/control-plane-ui/README.md, docs/sdlc/08-operations/runbook.md]
---

# Operations Pages

> **TL;DR:** Jobs, audit, and policy pages are the operational control loop. They expose asynchronous work, tamper-evident evidence, human approval decisions, and role-aware queue/approval focus through audited admin tools.

## S4 - Jobs

| Field | Value |
|---|---|
| Route | `#/jobs` |
| Component | `JobsPage` |
| Source | [`docs/control-plane/page-jobs-policy.jsx`](../../../control-plane/page-jobs-policy.jsx) |
| Reads | `admin.jobs.list` with `limit: 100`, `admin.projects.list`, `admin.health.get`, `admin.providers.list`, `admin.sessions.list`, `admin.policy.decisions.list` |
| Writes | `admin.jobs.queue.pause`, `admin.jobs.queue.resume`, `admin.jobs.cancel`, `admin.jobs.retry` |

### Purpose

The jobs page lets operators inspect provisioning and background work. It is the recovery surface for queued, running, failed, and completed jobs, and its first-screen focus adjusts for developer, scrum, devops, and operator lenses.

### Data Provenance

| Element | Data source | Notes |
|---|---|---|
| Queue state | `admin.jobs.list` | Includes queue status and job rows where available. |
| Role queue focus | `rolePortfolioFocus`, `BuildControlRail`, `QueueRunwayPanel` | Uses jobs, projects, sessions, providers, health, and approvals to summarize queue pressure and agent runway. |
| Job rows | `admin.jobs.list` | Filtered client-side by status. |
| Detail drawer | Selected row from `admin.jobs.list` | Preserves list context while inspecting payload and errors. |
| Pause/resume | `admin.jobs.queue.pause`, `admin.jobs.queue.resume` | Queue-level operator writes. |
| Cancel/retry | `admin.jobs.cancel`, `admin.jobs.retry` | Record-only until deeper queue mutation is available where applicable. |

### Generation

`JobsPage` fetches job, project, health, provider, session, and approval data through `useAdmin`, builds status filters in React, and opens a drawer for the selected job. Mutating actions use `ConfirmModal` and refetch the job list after completion.

### UX Decisions

- Filter tabs reflect operational states, not arbitrary categories.
- Drawer detail avoids losing queue context while inspecting a single job.
- Pause/resume controls are prominent because queue control is an incident response action.
- Developer role users see failed logs and active build inputs emphasized; scrum users see blocked/queued/running work and approvals; devops/operator users keep queue controls and provider health primary.
- Cancel/retry are confirmed because they can change downstream provider side effects or operator expectations.

## S5 - Audit

| Field | Value |
|---|---|
| Route | `#/audit` |
| Component | `AuditPage` |
| Source | [`docs/control-plane/page-audit.jsx`](../../../control-plane/page-audit.jsx) |
| Reads | `admin.audit.head`, `admin.audit.list` |
| Writes | `admin.audit.verify` |

### Purpose

The audit page is the evidence and integrity page. It shows the current audit head, supports filtered inspection of recent entries, and runs audit-chain verification.

### Data Provenance

| Element | Data source | Notes |
|---|---|---|
| Audit head | `admin.audit.head` | Current chain head, entry count, and integrity metadata. |
| Filters | React state passed to `admin.audit.list` | Outcome, project, and limit become tool arguments. |
| Audit table | `admin.audit.list` | Timestamp, actor, tool, outcome, project, previous hash, signing key. |
| Verification result | `admin.audit.verify` | Explicit operator action that checks chain integrity. |

### Generation

The page builds `listArgs` from filter state, calls `admin.audit.list`, and displays rows with monospace hashes and signing key ids. `Run verify` calls `admin.audit.verify` with operator context and refetches the audit data.

### UX Decisions

- Integrity status appears above the table because it frames whether rows can be trusted.
- Hashes and signing keys are visible to support audit review and screenshot evidence.
- Filtering is server-backed through tool arguments rather than local-only for project/outcome scoping.
- Verification is a button, not hidden automation, so an operator can produce deliberate evidence during review.

## S6 - Policy

| Field | Value |
|---|---|
| Route | `#/policy` |
| Component | `PolicyPage` |
| Source | [`docs/control-plane/page-jobs-policy.jsx`](../../../control-plane/page-jobs-policy.jsx) |
| Reads | `admin.policy.decisions.list`, `admin.projects.list`, `admin.health.get`, `admin.providers.list`, `admin.jobs.list`, `admin.sessions.list` |
| Writes | `admin.policy.approve`, `admin.policy.deny` |

### Purpose

The policy page is the human gate for decisions that cannot be safely automated. It lets an operator inspect policy decisions, filter by effect, approve or deny pending items, and see role-aware approval pressure in the broader build queue context.

### Data Provenance

| Element | Data source | Notes |
|---|---|---|
| Decision rows | `admin.policy.decisions.list` | Includes policy effect, subject, reason, and context where available. |
| Role approval focus | `rolePortfolioFocus` and `BuildControlRail` | Uses project, job, session, provider, and health data to show approval impact for scrum, devops, and operator views. |
| Effect filters | Client-side filter over returned decisions | Supports `all`, `require_approval`, `allow`, and `deny`. |
| Approval write | `admin.policy.approve` | Requires operator context and reason. |
| Denial write | `admin.policy.deny` | Requires operator context and reason. |

### Generation

`PolicyPage` fetches recent decisions plus supporting project, health, provider, job, and session data with a limit, derives the active filter, and opens `ConfirmModal` for approve/deny. After a write, it refetches decisions so the table reflects the backend state.

### UX Decisions

- Policy is a first-class page because approvals are governance events, not incidental notifications.
- Customer and product lenses treat approvals as supporting delivery blockers; scrum, devops, and operator lenses treat them as first-screen workflow pressure.
- Effect filters mirror the policy decision model so the UI language matches backend language.
- Decisions are approved or denied from explicit action buttons with reason capture to preserve accountability.

## Operations Page Cross-Cutting Rules

| Rule | Applies to |
|---|---|
| Mutations require confirmation | Jobs, policy, audit verification when implemented as an operator action. |
| Detail inspection should preserve list context | Jobs and policy details. |
| Evidence values use monospace | Job ids, audit hashes, policy ids, timestamps. |
| Empty lists are not treated as proof of health without source context | Jobs, audit, policy. |
| Role lens is presentation-only | Jobs and policy page copy/focus; data access and writes remain the same admin tool calls. |

## Linked Artifacts

- [`docs/control-plane/page-jobs-policy.jsx`](../../../control-plane/page-jobs-policy.jsx)
- [`docs/control-plane/page-audit.jsx`](../../../control-plane/page-audit.jsx)
- [`docs/control-plane/control-surface-model.js`](../../../control-plane/control-surface-model.js)
- [`src/mcp/admin/tools/jobs.ts`](../../../../src/mcp/admin/tools/jobs.ts)
- [`src/mcp/admin/tools/audit.ts`](../../../../src/mcp/admin/tools/audit.ts)
- [`src/mcp/admin/tools/policy.ts`](../../../../src/mcp/admin/tools/policy.ts)
- [`docs/sdlc/06-security/policy-decision-layer.md`](../../06-security/policy-decision-layer.md)
- [`docs/sdlc/06-security/audit-chain-threat-model.md`](../../06-security/audit-chain-threat-model.md)

---

*Last reviewed: 2026-04-27 by Chris.*
