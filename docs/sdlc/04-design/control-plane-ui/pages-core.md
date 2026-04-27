---
title: Operator Control Plane Core Pages
owner: Chris
status: accepted
last_reviewed: 2026-04-27
version: 1.1.0
audience: [engineer, operator, auditor, executive]
sdlc_category: 04-design
related: [docs/sdlc/04-design/control-plane-ui/README.md, docs/sdlc/04-design/module-workflows.md]
---

# Core Pages

> **TL;DR:** The core UI pages prove the primary business story: Jira projects are represented as atl-mcp lifecycle projects, can be inspected in role-specific context, and can be driven through requirements assist, provisioning, content quality, agent assignment, Jira, Confluence, VCS, and handoff workflows.

## S0 - Screen Index

| Field | Value |
|---|---|
| Route | `#/index` |
| Component | `IndexPage` |
| Source | [`docs/control-plane/page-index.jsx`](../../../control-plane/page-index.jsx) |
| Data source | Static screen inventory and route metadata in the page file. |
| Writes | None. |

### Purpose

The screen index is the UI sitemap and design validation surface. It lets engineers, operators, and reviewers see every route, the intended screen flow, and the reusable component catalog without traversing the app manually.

### Generation

The page is generated from static arrays in `page-index.jsx`. It renders:

- Route cards for the control-plane screen set.
- A screen-flow diagram implemented inline as SVG.
- Component inventory rows for shared UI primitives.
- Notes about the route groupings and operator flow.

### UX Decisions

- The screen index is intentionally available from the More menu because it is useful to reviewers and implementers, but it is not part of the primary operator workflow.
- It uses the same control-plane component language as runtime pages so design drift is visible immediately.
- It is static because it documents the UI contract, not live platform state.

## S1 - Dashboard

| Field | Value |
|---|---|
| Route | `#/` and `#/dashboard` |
| Component | `DashboardPage` |
| Source | [`docs/control-plane/page-dashboard.jsx`](../../../control-plane/page-dashboard.jsx) |
| Reads | `admin.health.get`, `admin.audit.head`, `admin.sessions.list`, `admin.jobs.list`, `admin.policy.decisions.list`, `admin.audit.list`, `admin.alerts.list` |
| Writes | `admin.policy.approve`, `admin.policy.deny` |

### Purpose

The dashboard is the first control-plane landing page. It answers: is the orchestrator alive, are providers healthy, are jobs backed up, are there policy decisions waiting, is the audit chain intact, and what should the currently selected role lens pay attention to first?

### Data Provenance

| Section | Data source | Notes |
|---|---|---|
| Page metadata | `admin.health.get` | Shows environment tier, version, uptime, and last sync context where available. |
| Component status strip | `admin.health.get` | Service, database, audit, Atlassian, Bitbucket, and transport health. |
| Summary stats | `admin.sessions.list`, `admin.jobs.list`, `admin.audit.head`, `admin.alerts.list` | Displays active sessions, queue depth, audit chain length, and alert count. |
| Role portfolio focus | `rolePortfolioFocus(roleLens, projects, jobs, sessions, approvals)` from `control-surface-model.js` | Reorders cards and primary lanes for customer, product, scrum, developer, devops, and operator lenses. |
| SLO preview | Data-limited SLO inputs | Marks incomplete SLO computation rather than fabricating live burn rates. |
| Alerts | `admin.alerts.list` | Data-limited until alert backend is complete. |
| Pending approvals | `admin.policy.decisions.list` filtered to `require_approval` | Approve/deny actions are audited writes. |
| Recent audit | `admin.audit.list` | Shows timestamp, actor, operation, outcome, and previous hash. |

### Generation

`DashboardPage` composes multiple `useAdmin` hooks. Each hook fetches on mount and polls according to global polling settings. Approval actions open `ConfirmModal`, call the selected policy write tool, and then refetch the policy list.

### UX Decisions

- The dashboard emphasizes operational triage, not analytics. It is dense, status-oriented, and table-backed.
- The role lens changes title copy and first-screen focus cards but preserves the same admin data sources.
- Health is displayed as a strip because component state is scanned left-to-right during incidents.
- Approvals are placed on the dashboard because unblocked policy decisions directly affect provisioning progress.
- Recent audit rows anchor visible changes to the tamper-evident audit chain.

## S2 - Project List

| Field | Value |
|---|---|
| Route | `#/projects` |
| Component | `ProjectListPage` |
| Source | [`docs/control-plane/page-projects.jsx`](../../../control-plane/page-projects.jsx) |
| Reads | `admin.projects.list`, `admin.jobs.list`, `admin.sessions.list`, `admin.providers.list`, `admin.health.get`, `admin.policy.decisions.list`, `admin.atlassian.projects.list` when adopt modal opens |
| Writes | `admin.projects.adopt`, `admin.requirements.assist.create_intake`, `admin.requirements.assist.generate_blueprint`, `admin.quality.score.project`, `admin.agent.work.assign` |

### Purpose

The project list is the portfolio view. It demonstrates that projects from Jira, Requirements Assist, or seeded/demo data have become first-class orchestrator lifecycle records with state, freshness, owner context, quality signals, agent assignment signals, and routeable detail pages.

### Data Provenance

| Element | Data source | Notes |
|---|---|---|
| Project rows | `admin.projects.list` | Backed by project repository rows, not static UI data. |
| Role portfolio summary | `rolePortfolioFocus` | Client-side interpretation of project/jobs/session/approval data for the selected role lens. |
| Requirements Assist panel | `admin.requirements.assist.*` tools | Creates assisted intakes and blueprints from project descriptions and brief excerpts. |
| Agent assignment panel | `admin.agent.work.list`, `admin.agent.work.recommend`, `admin.agent.work.assign` | Lists assignment intent, recommends agents, and persists selected assignments. |
| Content quality panel | `admin.quality.reports.list`, `admin.quality.score.project` | Shows latest trustworthiness report or creates a new one. |
| State filters | Project row `state` values | Client-side filter over returned rows. |
| Search | Project key/name fields | Client-side search only; no backend query mutation. |
| Adopt modal | `admin.atlassian.projects.list` | Lists Cloud Jira projects available to adopt. |
| Adoption write | `admin.projects.adopt` | Creates or maps a project lifecycle record from Jira source data. |

### Generation

The page fetches the project list eagerly and also reads jobs, sessions, providers, health, and approvals to build role-aware portfolio focus cards. Filter and search state live in React. The adopt modal fetches Atlassian Cloud projects through an admin bridge tool when opened and submits selected source project metadata to the adopt write tool.

### UX Decisions

- The portfolio table puts state, key, name, source, and freshness in one scanning surface.
- Role-specific columns emphasize status/readiness for customers, scope/trace for product owners, work assignment for developers, and phase/queue/provider pressure for scrum, devops, and operator users.
- Requirements Assist, agent assignment, and content quality panels appear on the Projects page because they are portfolio workflows, not only project-detail workflows.
- Adoption is a modal rather than a separate route because it is a portfolio action, not a long-lived object.
- The page links each row to `#/projects/<key>` to keep the project detail URL simple enough for demos and handoffs.

## S3 - Project Detail

| Field | Value |
|---|---|
| Route | `#/projects/<key>` |
| Component | `ProjectDetailPage` |
| Source | [`docs/control-plane/page-projects.jsx`](../../../control-plane/page-projects.jsx) |
| Reads | `admin.projects.get`, `admin.jobs.list`, `admin.sessions.list`, `admin.providers.list`, `admin.health.get`, `admin.velocity.manifest.get` on provision tab, `admin.agent.work.list`, `admin.quality.reports.list` |
| Writes | `admin.projects.transition`, lifecycle preview/execute tools, `admin.lifecycle.handoff.bundle`, `admin.requirements.assist.*` write tools, `admin.agent.work.assign`, `admin.quality.score.project`, `admin.quality.score.artifact` |

### Purpose

The project detail page is the primary proof that an external or assisted Jira project is integrated into atl-mcp. It combines lifecycle state, role workspace focus, stored blueprint, audit evidence, jobs, transition controls, Requirements Assist, agent assignment, content quality reports, and provisioning stages for that project key.

### Tabs

| Tab | What it shows | Data source |
|---|---|---|
| Overview | Project summary, state, source, timestamps, lifecycle highlights | `admin.projects.get` |
| Assist | Requirements Assist actions for the project | `admin.requirements.assist.preview`, `create_intake`, `generate_blueprint`, `provision_preview` |
| Assignments | Classify work, recommend agents, assign selected agents, and show assignment history | `admin.agent.work.list`, `admin.agent.work.recommend`, `admin.agent.work.assign` |
| Quality | Content quality score, findings, recommendations, and persisted report list | `admin.quality.reports.list`, `admin.quality.score.project`, `admin.quality.score.artifact` |
| Blueprint | Stored blueprint JSON and hash context | `admin.projects.get` |
| Audit | Project-scoped audit entries | `admin.projects.get` embedded/project audit data |
| Jobs | Project-related jobs | `admin.projects.get` embedded/project job data |
| Transitions | Valid state transition controls | `admin.projects.get`, writes through `admin.projects.transition` |
| Provision | Jira, Confluence, VCS, and handoff stages | `admin.velocity.manifest.get`, lifecycle admin tools |

### Generation

`ProjectDetailPage` reads the selected project by route key plus supporting jobs, sessions, providers, and quality/assignment data. It keeps the selected tab in React state. Transition writes call `admin.projects.transition` with the operator badge and then refetch the project detail. Role workspace content is selected through `RoleWorkspacePanel`; the developer role keeps the existing `DeveloperWorkspacePanel` behavior and the other roles render focused cards from `roleProjectFocus`.

### UX Decisions

- Tabs keep all project evidence under one URL so operators can narrate the lifecycle without navigating away.
- Role workspace cards put the current lens's primary action above the full tabbed evidence set without removing the lower panels.
- Blueprint JSON is shown verbatim through `JsonView` because the blueprint is an auditable artifact, not a marketing summary.
- The transition tab makes state movement explicit and inspectable rather than hiding it behind provisioning buttons.
- Project-level audit and jobs are colocated because they explain why a lifecycle state changed.

## S3 Provision Tab - Intake to Handoff Execution

| Stage | Preview tool | Execute/tool action | Output captured by UI |
|---|---|---|---|
| Jira | `admin.lifecycle.jira.preview` | `admin.lifecycle.jira.execute` | Jira project key and issue plan/output. |
| Confluence | `admin.lifecycle.confluence.preview` | `admin.lifecycle.confluence.execute` | Confluence space id and page plan/output. |
| VCS | `admin.lifecycle.vcs.preview` | `admin.lifecycle.vcs.execute` | Repository URL plus generated file manifest. |
| Handoff | None; uses previous stage output | `admin.lifecycle.handoff.bundle` | Handoff packet for downstream build agents. |

### Purpose

The provision tab turns the project detail page into an operator workflow. It lets a user pick stack modules, preview generated work, execute provider writes, and generate the final handoff bundle.

### Data Provenance

| Field | Data source |
|---|---|
| Stack chooser | `admin.velocity.manifest.get` and the `VELOCITY_MODULES` manifest. |
| Jira issue preview | Lifecycle workflow and Jira provider configuration. |
| Confluence page preview | Lifecycle workflow and Confluence provider configuration. |
| VCS file preview | Velocity content registry, stack module content, and VCS scaffolder. |
| Handoff bundle | Project blueprint plus Jira, Confluence, and VCS outputs captured during the tab session. |

### UX Decisions

- Every provider write has a preview button adjacent to execute. The operator can inspect the generated plan before creating remote artifacts.
- The stages are stacked in execution order because later stages depend on earlier identifiers.
- Stack choices are gathered before VCS preview because repository scaffolding changes based on selected stack modules.
- The handoff stage depends on captured outputs rather than asking the operator to re-enter data already produced by previous stages.

## Linked Artifacts

- [`docs/control-plane/page-index.jsx`](../../../control-plane/page-index.jsx)
- [`docs/control-plane/page-dashboard.jsx`](../../../control-plane/page-dashboard.jsx)
- [`docs/control-plane/page-projects.jsx`](../../../control-plane/page-projects.jsx)
- [`docs/control-plane/page-role-workflows.jsx`](../../../control-plane/page-role-workflows.jsx)
- [`docs/control-plane/control-surface-model.js`](../../../control-plane/control-surface-model.js)
- [`src/mcp/admin/tools/projects.ts`](../../../../src/mcp/admin/tools/projects.ts)
- [`src/mcp/admin/tools/atlassian.ts`](../../../../src/mcp/admin/tools/atlassian.ts)
- [`src/mcp/admin/tools/lifecycle.ts`](../../../../src/mcp/admin/tools/lifecycle.ts)
- [`src/mcp/admin/tools/velocity.ts`](../../../../src/mcp/admin/tools/velocity.ts)
- [`src/mcp/admin/tools/requirementsAssist.ts`](../../../../src/mcp/admin/tools/requirementsAssist.ts)
- [`src/mcp/admin/tools/agentWork.ts`](../../../../src/mcp/admin/tools/agentWork.ts)
- [`src/mcp/admin/tools/quality.ts`](../../../../src/mcp/admin/tools/quality.ts)
- [`tests/unit/controlPlaneProvisionUi.test.ts`](../../../../tests/unit/controlPlaneProvisionUi.test.ts)

---

*Last reviewed: 2026-04-27 by Chris.*
