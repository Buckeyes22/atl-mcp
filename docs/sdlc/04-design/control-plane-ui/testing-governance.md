---
title: Operator Control Plane Testing and Governance
owner: Chris
status: accepted
last_reviewed: 2026-04-27
version: 1.1.0
audience: [engineer, operator, auditor]
sdlc_category: 04-design
related: [docs/sdlc/04-design/control-plane-ui/README.md, docs/sdlc/07-testing/strategy.md, docs/sdlc/12-governance/change-management.md]
---

# Testing and Governance

> **TL;DR:** The control plane is verified as a static UI host, MCP client surface, page-to-tool wiring layer, lifecycle provisioning workflow, role workflow surface, and audited operator surface. UI changes must preserve route coverage, data provenance, role-lens boundaries, responsive layout behavior, and the data-limited contract.

## Verification Layers

| Layer | Purpose | Current artifacts |
|---|---|---|
| Static asset host | Ensure `/ui/` serves the entrypoint and assets safely. | `tests/integration/admin/transportAndUi.test.ts` |
| MIME and traversal checks | Ensure CSS/JSX assets have usable MIME types and traversal attempts are rejected. | `tests/integration/admin/transportAndUi.test.ts` |
| Provisioning UI wiring | Ensure project detail provision tab includes stack manifest and handoff artifact references. | `tests/unit/controlPlaneProvisionUi.test.ts` |
| Role lens source tests | Ensure role selector, role tweak persistence, role focus helpers, project role workspace, and route workflow components remain wired. | `tests/unit/controlSurfaceModel.test.ts`, `tests/unit/controlPlaneProvisionUi.test.ts` |
| Role workflow admin tools | Verify Requirements Assist, agent recommendation/assignment, and content quality scoring return structuredContent and persist durable rows where required. | `tests/integration/admin/roleWorkflowTools.test.ts` |
| Packed responsive layout | Ensure uneven two-column card layouts use packed columns instead of grid rows that create excess whitespace. | `tests/unit/controlPlaneProvisionUi.test.ts` |
| Lifecycle admin tools | Verify preview/execute/handoff tools produce expected structuredContent and data-limited fallbacks. | `tests/integration/admin/lifecycleTools.test.ts` |
| Demo seed data | Verify seeded projects, jobs, and audit entries are available for UI population. | `tests/integration/admin/demoSeed.test.ts` |
| Admin tool registry | Ensure admin tools are registered through the central registry. | `src/mcp/admin/registry.ts` plus admin integration tests. |

## Required Checks for UI Changes

| Change type | Required verification |
|---|---|
| New route | Add route to `index.html`, `TopNav` or screen index if user-facing, and this documentation set. |
| New admin read | Add source tool to page docs and data contract; verify `structuredContent` shape in a test. |
| New admin write | Use `ConfirmModal` where operator intent matters; verify audit side effect or record-only behavior. |
| Data-limited backend | Return `dataLimited.reason` from the tool and render `DataLimited` or `DataLimitedBanner`. |
| Provisioning stage change | Update provision tab docs, lifecycle tool tests, and handoff artifact tests. |
| Role lens change | Keep the lens presentation-only; update `role-workflows.md`, source tests, and browser smoke through all six role ids. |
| Role workflow change | Update `role-workflows.md`, page-to-tool matrix, data schema/domain docs when persistence changes, and integration tests for the affected admin tool family. |
| Responsive layout change | Check desktop, tablet, and mobile widths for horizontal overflow, text overlap, and excessive card whitespace. |
| Visual system change | Update `ux-system.md` and `docs/control-plane/STYLE-NOTES.md`; inspect primary pages in browser. |

## Route Coverage Checklist

Every release touching the UI should confirm these routes render without fatal errors:

| Route | Expected page |
|---|---|
| `/ui/#/` | Dashboard |
| `/ui/#/dashboard` | Dashboard |
| `/ui/#/projects` | Project list |
| `/ui/#/projects/<existing-key>` | Project detail |
| `/ui/#/jobs` | Jobs |
| `/ui/#/audit` | Audit |
| `/ui/#/policy` | Policy |
| `/ui/#/providers` | Providers |
| `/ui/#/sessions` | Sessions |
| `/ui/#/alerts` | Alerts |
| `/ui/#/migrations` | Migrations |
| `/ui/#/secrets` | Secrets |
| `/ui/#/slo` | SLO |
| `/ui/#/capacity` | Capacity |
| `/ui/#/dr` | DR |
| `/ui/#/settings` | Settings |
| `/ui/#/index` | Screen index |
| `/ui/#/requirements-assist` | Requirements Assist |
| `/ui/#/agent-assignment` | Agent Assignment |

## Browser QA Scenarios

| Scenario | Evidence to collect |
|---|---|
| Integrated Jira portfolio | Project list contains adopted or seeded Jira-style projects and routes to detail pages. |
| Project provisioning | On a project detail provision tab, preview Jira, Confluence, and VCS stages; execute against configured providers or confirm data-limited fallbacks. |
| Handoff bundle | Generate a handoff packet and confirm Jira, Confluence, VCS references are carried when available. |
| Policy approval | Approve or deny a pending policy decision with a reason; confirm audit visibility. |
| Audit verification | Run audit verification and inspect head/table updates. |
| Provider degradation | Probe a provider and confirm degraded/error state is visible without breaking the page. |
| Data-limited pages | Alerts, SLO, capacity, and DR visibly disclose backend limitations. |
| Role lens cycle | Switch through Customer, Product Owner, Scrum Master, Developer, DevOps Engineer, and Operator; confirm copy and focus cards change while data remains reachable. |
| Requirements Assist | Enter a project description and brief excerpt; preview requirements, create intake, generate blueprint, and preview Jira without console errors. |
| Agent assignment | Select a story/task; classify and recommend agents; assign an agent with a reason; confirm persisted assignment appears. |
| Content quality | Score a project and confirm grade/findings are visible in Projects, Project Detail Quality tab, and Agent Assignment shortcut. |
| Responsive route sweep | Open Dashboard, Projects, Project Detail, Jobs, Providers, Sessions/Agents, Approvals/Policy, Requirements Assist, and Agent Assignment at desktop, tablet, and mobile widths; confirm no horizontal overflow. |

## Governance Rules

- UI docs are part of the definition of done for route or page changes.
- `docs/control-plane/STYLE-NOTES.md` may describe prototype tactics, but canonical SDLC intent belongs in this directory.
- Admin tools are the only supported data source for the UI. Direct database fetches from browser code are out of scope.
- `roleLens` is a presentation preference. Security decisions, redaction, and backend data access must not branch on it.
- Fake operational data is not allowed in runtime pages. Use `admin.demo.seed` to create repository-backed demo data, or mark the source data-limited.
- Every mutating UI path must be attributable to an operator and visible in audit evidence, even if the backend action is record-only.
- Screenshots are useful release evidence, but they do not replace tool-level tests because the UI is data-driven.

## Future Test Gaps

| Gap | Recommended test |
|---|---|
| Full browser rendering | Add automated browser smoke tests against a running management API for the expanded route set and six role lenses. |
| Route-level data failures | Add tests that force selected admin tools to fail and verify `ErrorBlock` rendering. |
| Confirmation enforcement | Add source-level or browser tests ensuring mutating buttons open `ConfirmModal`. |
| Accessibility regression | Add axe-style checks for route pages once a browser test harness is established. |
| Visual regression | Capture desktop, tablet, and mobile screenshots for dashboard, projects, project detail, sessions/agents, requirements assist, and agent assignment after seeded data load. |

## Linked Artifacts

- [`tests/integration/admin/transportAndUi.test.ts`](../../../../tests/integration/admin/transportAndUi.test.ts)
- [`tests/unit/controlPlaneProvisionUi.test.ts`](../../../../tests/unit/controlPlaneProvisionUi.test.ts)
- [`tests/unit/controlSurfaceModel.test.ts`](../../../../tests/unit/controlSurfaceModel.test.ts)
- [`tests/integration/admin/roleWorkflowTools.test.ts`](../../../../tests/integration/admin/roleWorkflowTools.test.ts)
- [`tests/integration/admin/lifecycleTools.test.ts`](../../../../tests/integration/admin/lifecycleTools.test.ts)
- [`tests/integration/admin/demoSeed.test.ts`](../../../../tests/integration/admin/demoSeed.test.ts)
- [`docs/sdlc/07-testing/strategy.md`](../../07-testing/strategy.md)
- [`docs/sdlc/12-governance/change-management.md`](../../12-governance/change-management.md)

---

*Last reviewed: 2026-04-27 by Chris.*
