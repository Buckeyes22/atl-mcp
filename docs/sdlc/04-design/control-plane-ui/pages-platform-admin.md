---
title: Operator Control Plane Platform Administration Pages
owner: Chris
status: accepted
last_reviewed: 2026-04-27
version: 1.1.0
audience: [engineer, operator, auditor]
sdlc_category: 04-design
related: [docs/sdlc/04-design/control-plane-ui/README.md, docs/sdlc/08-operations/runbook.md, docs/sdlc/09-deployment/environments.md]
---

# Platform Administration Pages

> **TL;DR:** The platform administration pages expose provider health, active sessions/agents, agent role catalog, alerts, migrations, secrets, SLO targets, capacity, disaster recovery, and runtime settings. These pages are deliberately explicit about deferred backends through the data-limited contract.

## Page Matrix

| Screen | Route | Component | Reads | Writes |
|---|---|---|---|---|
| S7 Providers | `#/providers` | `ProvidersPage` | `admin.providers.list` | `admin.providers.probe`, `admin.secrets.rotate.token` |
| S8 Sessions / Agents | `#/sessions` | `SessionsPage` | `admin.sessions.list`, `admin.projects.list`, `admin.health.get`, `admin.providers.list`, `admin.jobs.list`, `admin.policy.decisions.list` | `admin.sessions.terminate` |
| S9 Alerts | `#/alerts` | `AlertsPage` | `admin.alerts.list` | No visible write in current page; backend supports record-only `admin.alerts.ack`. |
| S10 Migrations | `#/migrations` | `MigrationsPage` | `admin.migrations.list` | `admin.migrations.apply` |
| S11 Secrets | `#/secrets` | `SecretsPage` | `admin.secrets.list` | `admin.secrets.rotate.token`, `admin.secrets.rotate.master.start`, `admin.secrets.rotate.audit.start` |
| S12 SLO | `#/slo` | `SloPage` | `admin.slos.list` | None. |
| S13 Capacity | `#/capacity` | `CapacityPage` | `admin.capacity.get` | None. |
| S14 DR | `#/dr` | `DrPage` | `admin.dr.upcoming.list`, `admin.dr.drills.list` | `admin.dr.drills.schedule` |
| S15 Settings | `#/settings` | `SettingsPage` | `admin.config.env.get`, `admin.config.flags.list` | `admin.config.flags.toggle` |

All components above live in [`docs/control-plane/page-tier23.jsx`](../../../control-plane/page-tier23.jsx).

## S7 - Providers

### Purpose

Providers shows the integration health of Jira, Confluence, and VCS providers. It is the page an operator uses to determine whether external dependencies are reachable before provisioning work is attempted.

### Data and Generation

`ProvidersPage` reads `admin.providers.list`, which aggregates configured provider availability and health probe data. The page can run `admin.providers.probe` for a selected provider. Token rotation is available through `admin.secrets.rotate.token` using the provider logical key.

### UX Decisions

- Provider cards show health and capability in one row because dependency triage starts with "can I call it?"
- Probe is an explicit action so operators can distinguish polled state from a fresh provider test.
- Token rotation is colocated with provider health because expired provider credentials commonly surface as provider failures.

## S8 - Sessions

### Purpose

Sessions lists active MCP sessions for the agent-facing transport, shows role-aware agent runway context, and gives operators a way to terminate stale or risky sessions. It also exposes the analyzed agent role catalog so developers assigning work can understand what each known agent role does.

### Data and Generation

`SessionsPage` reads `admin.sessions.list` from the session registry plus projects, health, providers, jobs, and policy approvals to build the role-aware runway panels. Termination calls `admin.sessions.terminate` with the selected session id and operator badge. `AgentRoleCatalogPanel` reads static catalog entries from `agentRoleCatalog()` in `control-surface-model.js`; live availability still comes from session data.

### UX Decisions

- Active sessions are an operational risk surface, so the page emphasizes identity, age, and termination.
- The agent role catalog is static explanatory metadata and must not be confused with live capacity or assignment state.
- Developer role users need specialization descriptions near the session table because assignment recommendations name agents by capability.
- Termination is confirmed because it can interrupt an in-flight agent workflow.
- The page uses table density rather than cards because session comparison is row-oriented.

## S9 - Alerts

### Purpose

Alerts is the future alert inbox and current disclosure point for alerting backend readiness.

### Data and Generation

`AlertsPage` reads `admin.alerts.list`. Current backend behavior is data-limited; the tool returns real minimal data and a reason string rather than fabricated alert traffic. The backend includes record-only `admin.alerts.ack`, but the current page does not expose an acknowledge button.

### UX Decisions

- The page displays a data-limited banner when alerting data is incomplete.
- Empty alert lists do not imply healthy production alerting unless the data source is complete.
- Acknowledgement is not shown until the page can support a full operator flow.

## S10 - Migrations

### Purpose

Migrations shows database migration status and allows an operator to apply pending migrations through the admin write path.

### Data and Generation

`MigrationsPage` reads `admin.migrations.list`. Pending migrations can be applied through `admin.migrations.apply`, with reason capture and operator badge propagation.

### UX Decisions

- Migrations are visible in the UI because deployment readiness depends on schema state.
- Apply is gated by confirmation because schema changes are high-impact operational writes.
- Rows preserve migration identity and status for release review.

## S11 - Secrets

### Purpose

Secrets is the credential lifecycle page. It shows logical secret status and supports token rotation plus master-key and audit-key rotation drills.

### Data and Generation

`SecretsPage` reads `admin.secrets.list`. Token rotation calls `admin.secrets.rotate.token`. Drill starts call `admin.secrets.rotate.master.start` or `admin.secrets.rotate.audit.start`.

### UX Decisions

- Raw secrets are never rendered. The UI displays logical keys, status, and rotation workflow state only.
- Master and audit key rotations are modeled as drills because they are multi-step, high-risk procedures.
- Rotation calls are audited to tie credential lifecycle events to an operator and reason.

## S12 - SLO

### Purpose

SLO displays reliability targets and, once live telemetry is available, will show current attainment and state.

### Data and Generation

`SloPage` reads `admin.slos.list`. Current behavior returns targets only with null current/state values and a data-limited reason.

### UX Decisions

- Targets are visible even before live measurements so the operational contract is clear.
- Missing current values stay null/blank rather than mocked to green.
- The data-limited banner prevents operators from treating the page as a complete SLO monitor.

## S13 - Capacity

### Purpose

Capacity shows current platform limits and pressure signals such as session count, queue depth, and deferred cost/capacity fields.

### Data and Generation

`CapacityPage` reads `admin.capacity.get`. Current live values include session and queue-related counters where available. Cost model details are data-limited.

### UX Decisions

- Capacity status uses compact status strips because operators scan for pressure, not long explanation.
- Cost and runway gaps are explicitly marked as limited instead of backfilled by estimates.
- No write actions appear because capacity changes belong to deployment/configuration workflows.

## S14 - DR

### Purpose

DR displays disaster recovery drill schedules, past drill records, and the operator action for scheduling a new drill.

### Data and Generation

`DrPage` reads `admin.dr.upcoming.list` and `admin.dr.drills.list`. Scheduling calls `admin.dr.drills.schedule`, which is currently record-only when the scheduler backend is not complete.

### UX Decisions

- DR is separated from capacity and settings because recovery evidence is governance-critical.
- Scheduling requires a scenario and reason so future audit review can understand intent.
- Data-limited handling avoids pretending that an automated drill scheduler exists before it is implemented.

## S15 - Settings

### Purpose

Settings exposes non-sensitive runtime environment and feature flag state.

### Data and Generation

`SettingsPage` reads `admin.config.env.get` and `admin.config.flags.list`. Flag changes call `admin.config.flags.toggle`, currently record-only where runtime flag mutation is not implemented.

### UX Decisions

- Environment settings are read-only because they are deployment facts, not browser preferences.
- Feature flag toggles are audited because flag changes alter behavior and must be attributable.
- Secret values and sensitive config are intentionally excluded from this page.

## Linked Artifacts

- [`docs/control-plane/page-tier23.jsx`](../../../control-plane/page-tier23.jsx)
- [`docs/control-plane/control-surface-model.js`](../../../control-plane/control-surface-model.js)
- [`src/mcp/admin/tools/providers.ts`](../../../../src/mcp/admin/tools/providers.ts)
- [`src/mcp/admin/tools/sessions.ts`](../../../../src/mcp/admin/tools/sessions.ts)
- [`src/mcp/admin/tools/migrations.ts`](../../../../src/mcp/admin/tools/migrations.ts)
- [`src/mcp/admin/tools/secrets.ts`](../../../../src/mcp/admin/tools/secrets.ts)
- [`src/mcp/admin/tools/config.ts`](../../../../src/mcp/admin/tools/config.ts)
- [`src/mcp/admin/tools/dataLimited.ts`](../../../../src/mcp/admin/tools/dataLimited.ts)
- [`docs/sdlc/08-operations/runbook.md`](../../08-operations/runbook.md)
- [`docs/sdlc/10-dr-bcp/recovery-objectives.md`](../../10-dr-bcp/recovery-objectives.md)

---

*Last reviewed: 2026-04-27 by Chris.*
