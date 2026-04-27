---
title: Operator Control Plane Data Contracts
owner: Chris
status: accepted
last_reviewed: 2026-04-27
version: 1.1.0
audience: [engineer, operator, auditor, integrator]
sdlc_category: 04-design
related: [docs/sdlc/04-design/control-plane-ui/runtime-data-flow.md, docs/sdlc/04-design/api-mcp-tools.md]
---

# Data Contracts

> **TL;DR:** The UI data contract is MCP `tools/call` over the loopback admin transport. Static files define presentation and local role-lens preferences; `admin.*` tools define all operational data and write side effects.

## Contract Principles

1. A page may render static labels, route names, and layout metadata from local JSX.
2. A page must obtain operational state from an admin MCP tool.
3. A page must prefer `structuredContent` over textual `content`.
4. A page must render `dataLimited.reason` when a tool returns it.
5. A mutating action must use an admin write tool and carry operator context.
6. The browser must not be treated as a source of truth after a write; affected read tools must be refetched.

## Page-to-Tool Matrix

| Page | Primary read tools | Write tools | Source-of-truth systems |
|---|---|---|---|
| Screen index | None; static route inventory | None | Checked-in UI source. |
| Dashboard | `admin.health.get`, `admin.audit.head`, `admin.sessions.list`, `admin.jobs.list`, `admin.policy.decisions.list`, `admin.audit.list`, `admin.alerts.list` | `admin.policy.approve`, `admin.policy.deny` | Health checks, repositories, session registry, queue, audit chain, policy store. |
| Project list | `admin.projects.list`, `admin.jobs.list`, `admin.sessions.list`, `admin.providers.list`, `admin.health.get`, `admin.policy.decisions.list`, `admin.atlassian.projects.list`, `admin.agent.work.list`, `admin.quality.reports.list` | `admin.projects.adopt`, `admin.requirements.assist.create_intake`, `admin.requirements.assist.generate_blueprint`, `admin.agent.work.assign`, `admin.quality.score.project` | Project repository, Jira Cloud project bridge, assignment repository, content quality repository, queue/session/provider stores. |
| Project detail | `admin.projects.get`, `admin.velocity.manifest.get`, `admin.agent.work.list`, `admin.quality.reports.list` | `admin.projects.transition`, lifecycle tools, `admin.lifecycle.handoff.bundle`, `admin.requirements.assist.*`, `admin.agent.work.assign`, `admin.quality.score.project`, `admin.quality.score.artifact` | Project repository, velocity content registry, workflow modules, providers, assignment repository, content quality repository. |
| Jobs | `admin.jobs.list` | `admin.jobs.queue.pause`, `admin.jobs.queue.resume`, `admin.jobs.cancel`, `admin.jobs.retry` | Provision queue and job repository. |
| Audit | `admin.audit.head`, `admin.audit.list` | `admin.audit.verify` | Audit repository and audit signer/verifier. |
| Policy | `admin.policy.decisions.list` | `admin.policy.approve`, `admin.policy.deny` | Policy decision repository and audit chain. |
| Providers | `admin.providers.list` | `admin.providers.probe`, `admin.secrets.rotate.token` | Jira, Confluence, VCS providers, secret registry. |
| Sessions / Agents | `admin.sessions.list`, `admin.projects.list`, `admin.health.get`, `admin.providers.list`, `admin.jobs.list`, `admin.policy.decisions.list` | `admin.sessions.terminate` | Agent session registry plus supporting role focus data. |
| Alerts | `admin.alerts.list` | Backend supports `admin.alerts.ack`; current page read-only | Data-limited alert backend. |
| Migrations | `admin.migrations.list` | `admin.migrations.apply` | Database migration subsystem. |
| Secrets | `admin.secrets.list` | `admin.secrets.rotate.token`, `admin.secrets.rotate.master.start`, `admin.secrets.rotate.audit.start` | Secret inventory, token store, audit key rotation workflow. |
| SLO | `admin.slos.list` | None | Configured SLO targets; live measurements deferred. |
| Capacity | `admin.capacity.get` | None | Session registry, queue, capacity configuration; cost model deferred. |
| DR | `admin.dr.upcoming.list`, `admin.dr.drills.list` | `admin.dr.drills.schedule` | DR schedule/drill backend, currently data-limited. |
| Settings | `admin.config.env.get`, `admin.config.flags.list` | `admin.config.flags.toggle` | Runtime config and feature flag registry. |
| Requirements Assist | `admin.requirements.assist.preview`, `admin.requirements.assist.provision_preview` | `admin.requirements.assist.create_intake`, `admin.requirements.assist.generate_blueprint` | Intake workflow, blueprint workflow, project repository, audit chain. |
| Agent Assignment | `admin.agent.work.classify`, `admin.agent.work.recommend`, `admin.agent.work.list`, `admin.quality.reports.list` | `admin.agent.work.assign`, `admin.quality.score.project` | Project repository, session registry, session profile repository, work assignment repository, content quality repository, audit chain. |

## Local Presentation Preferences

The control plane stores these browser-local preferences through `CPTweaksProvider`. They are not source-of-truth domain state and do not change backend authorization:

| Preference | Default | Behavior |
|---|---|---|
| `roleLens` | `developer` | Selects page copy, focus-card ordering, primary action labels, and first-screen panel emphasis for `customer`, `product`, `scrum`, `developer`, `devops`, or `operator`. |
| `operatorBadge` | implementation default | Propagated into audited write calls when a page supplies it. |
| Polling and visual tweak settings | implementation defaults | Control browser refresh cadence and demo stress states only. |

Role-specific behavior is computed by `roleCopy`, `roleProjectFocus`, and `rolePortfolioFocus` in `control-surface-model.js`. These helpers return deterministic presentation objects and do not fetch data directly.

## Integrated Project Data Sources

The control plane can be populated through several legitimate paths. All end in repository-backed project rows visible through `admin.projects.list` and `admin.projects.get`.

| Path | Tool or workflow | Result |
|---|---|---|
| Live Jira adoption | `admin.atlassian.projects.list` followed by `admin.projects.adopt` | Jira Cloud project metadata becomes an atl-mcp lifecycle project. |
| Demo seed from live Jira | `admin.demo.seed` with `mode: "jira"` or `mode: "auto"` when Jira is configured | Existing Jira project names are transformed into integrated-looking lifecycle rows, jobs, and audit entries. |
| Demo seed from samples | `admin.demo.seed` with `mode: "sample"` or `mode: "auto"` without Jira | Sample integrated projects are created with lifecycle, job, and audit context. |
| Workflow-created projects | Intake and blueprint workflows | Project rows carry generated blueprints and state-machine history. |

The frontend does not directly call `admin.demo.seed` today. It consumes the seeded/adopted results after they have been written through admin tools and repositories.

Requirements Assist is another legitimate project population path. `admin.requirements.assist.create_intake` writes the project intake, `admin.requirements.assist.generate_blueprint` normalizes the blueprint, and `admin.requirements.assist.provision_preview` previews Jira artifacts without provider writes.

## Project Detail Contract

`admin.projects.get` is the contract anchor for `#/projects/<key>`. The page expects a project-level payload that can support:

| UI area | Required data behavior |
|---|---|
| Header and overview | Project key, display name, state, source, and timestamps where available. |
| Blueprint tab | Stored blueprint object and hash/version context where available. |
| Audit tab | Project-scoped recent audit rows or enough related audit data to render evidence. |
| Jobs tab | Project-scoped job rows or related job summaries. |
| Transitions tab | Current state and allowed transition targets. |
| Provision tab | Project key plus blueprint/context needed by lifecycle preview and execute tools. |
| Assist tab | Project key, description, briefs, and generated intake/blueprint identifiers. |
| Assignments tab | Work refs, classification result, recommendations, and persisted assignments. |
| Quality tab | Latest score, grade, findings, recommendations, and historical report rows. |

If a field is missing because a backend is intentionally incomplete, the backend should return `dataLimited` through the relevant tool rather than requiring the page to infer incompleteness.

## Role Workflow Tool Contracts

| Workflow | Tool family | Contract summary |
|---|---|---|
| Requirements Assist | `admin.requirements.assist.*` | Accepts description and brief excerpts, returns normalized requirements, creates intake/blueprint state, and previews Jira issue nodes. |
| Agent work classification | `admin.agent.work.classify` | Accepts `projectId` or `projectKey` plus `workRef`; returns work item and deterministic classification. |
| Agent recommendation | `admin.agent.work.recommend` | Adds ranked live/persisted agent recommendations to the classification result. |
| Agent assignment | `admin.agent.work.assign`, `admin.agent.work.list` | Persists assignment intent in `work_assignments`, appends audit on assignment, and lists project assignments. |
| Content quality | `admin.quality.score.project`, `admin.quality.score.artifact`, `admin.quality.reports.list` | Persists deterministic score reports in `content_quality_reports` and lists reports by project. |

Write tools in these families append audit evidence when they create durable state. Read-only preview/recommend/list tools must not fabricate provider writes or assignment completion.

## Provisioning Contract

| Stage | Inputs supplied by UI | Backend-generated data | Write side effects |
|---|---|---|---|
| Jira preview | `projectKey` | Planned issues/epics/stories | None. |
| Jira execute | `projectKey`, `jiraProjectKey`, `reason`, `operatorBadge` | Created or planned Jira artifacts | Jira provider writes when configured; audited result. |
| Confluence preview | `projectKey` | Planned page tree/content | None. |
| Confluence execute | `projectKey`, `spaceId`, `reason`, `operatorBadge` | Created or planned pages | Confluence provider writes when configured; audited result. |
| VCS preview | `projectKey`, `workspace`, `repoSlug`, `stackChoices` | Repository file manifest and content preview | None. |
| VCS execute | `projectKey`, `workspace`, `repoSlug`, `stackChoices`, `reason`, `operatorBadge` | Repository URL and file output | VCS provider writes when configured; audited result. |
| Handoff bundle | `projectKey`, prior artifact references, `reason`, `operatorBadge` | Handoff packet with audit-chain head | Audited handoff bundle generation. |

## Data-Limited Tools

| Tool | Expected limitation behavior |
|---|---|
| `admin.alerts.list` | Return real alert rows if available, otherwise empty rows plus `dataLimited.reason`. |
| `admin.slos.list` | Return configured targets; leave live current/state fields null when telemetry is unavailable. |
| `admin.capacity.get` | Return available session/queue values; mark unavailable cost or capacity-model fields. |
| `admin.dr.upcoming.list` | Return scheduled drills only if scheduler exists; otherwise data-limited empty list. |
| `admin.dr.drills.list` | Return completed drill records only if persisted; otherwise data-limited empty list. |
| `admin.config.flags.toggle` | Record intent if runtime mutation is not implemented. |
| `admin.alerts.ack` | Record acknowledgement intent if full alert lifecycle is not implemented. |

## Audited Write Fields

The UI should supply these fields when a tool accepts them:

| Field | Meaning |
|---|---|
| `operatorBadge` | Operator identity from the control-plane tweaks/provider context. |
| `reason` | Human explanation captured by `ConfirmModal`. |
| Object id | The target id, such as project key, job id, policy decision id, provider id, migration id, session id, or logical secret key. |

Write tools append audit entries through the admin write path. Pages should display resulting state by refetching read tools rather than trusting the local confirmation result. Role workflow writes follow the same rule: assisted intake/blueprint generation, work assignment, and content quality scoring are durable only after the admin tool returns and the page refetches the relevant read contract.

## Linked Artifacts

- [`docs/control-plane/use-admin.jsx`](../../../control-plane/use-admin.jsx)
- [`docs/control-plane/page-projects.jsx`](../../../control-plane/page-projects.jsx)
- [`docs/control-plane/page-role-workflows.jsx`](../../../control-plane/page-role-workflows.jsx)
- [`docs/control-plane/control-surface-model.js`](../../../control-plane/control-surface-model.js)
- [`src/mcp/admin/registry.ts`](../../../../src/mcp/admin/registry.ts)
- [`src/mcp/admin/tools/demo.ts`](../../../../src/mcp/admin/tools/demo.ts)
- [`src/demo/controlPlaneDemoSeed.ts`](../../../../src/demo/controlPlaneDemoSeed.ts)
- [`src/mcp/admin/tools/lifecycle.ts`](../../../../src/mcp/admin/tools/lifecycle.ts)
- [`src/mcp/admin/tools/requirementsAssist.ts`](../../../../src/mcp/admin/tools/requirementsAssist.ts)
- [`src/mcp/admin/tools/agentWork.ts`](../../../../src/mcp/admin/tools/agentWork.ts)
- [`src/mcp/admin/tools/quality.ts`](../../../../src/mcp/admin/tools/quality.ts)
- [`src/mcp/admin/tools/dataLimited.ts`](../../../../src/mcp/admin/tools/dataLimited.ts)

---

*Last reviewed: 2026-04-27 by Chris.*
