---
title: Operator Control Plane UI/UX System
owner: Chris
status: accepted
last_reviewed: 2026-04-27
version: 1.1.0
audience: [engineer, operator, designer, auditor]
sdlc_category: 04-design
related: [docs/control-plane/STYLE-NOTES.md, docs/sdlc/04-design/control-plane-ui/README.md]
---

# UI/UX System

> **TL;DR:** The control plane is an operational console, not a marketing application. It uses dense, scan-friendly pages; role-aware presentation lenses; explicit provenance; restrained visual styling; packed responsive layouts; and audited confirmation flows for risky actions.

## Experience Goals

| Goal | Design decision |
|---|---|
| Make integration status credible | Show project lifecycle data, provider health, audit rows, and job history from admin tools rather than static demo text. |
| Keep operators oriented | Use a persistent top nav, consistent `PageHead`, route-level page titles, and status strips. |
| Serve multiple internal roles | Let Customer, Product Owner, Scrum Master, Developer, DevOps Engineer, and Operator users switch copy and focus without changing permissions or data access. |
| Reduce accidental writes | Put mutating actions behind `ConfirmModal`, reason capture, and operator badge propagation. |
| Support review and audit | Favor tables, timestamps, hashes, JSON views, and visible data-limited markers. |
| Avoid fake completeness | Render `dataLimited` reasons in the UI when a backend is not fully implemented. |

## Visual Language

The visual language extends the documentation and visualization site:

| Element | Decision | Rationale |
|---|---|---|
| Background | Paper-warm page background with white operational surfaces | Reads as internal infrastructure, not generic SaaS chrome. |
| Typography | IBM Plex Sans for UI, IBM Plex Mono for IDs, hashes, timestamps, JSON | Separates narrative labels from copy/paste operational values. |
| Borders | 1px hairlines with strong lines only for hierarchy | Keeps dense tables readable without heavy card stacks. |
| Color | Semantic only: pass, active, error, warning, info | Avoids dashboard decoration that can be mistaken for signal. |
| Layout | Full-width constrained pages, compact sections, tables, drawers, packed card columns | Optimized for 1280px+ operator workstations while remaining smoke-tested at tablet and mobile widths. |

## Component Vocabulary

| Component | Purpose | UX rule |
|---|---|---|
| `TopNav` | Primary route navigation, More menu, role selector, environment badge, polling status, operator badge, tweaks entry | Must stay visible and accurately reflect active route and selected role lens. |
| `PageHead` | Page title, eyebrow, and right-side metadata | Every route-level page starts here. |
| `StatusDot` | Compact state/severity indicator | Must be paired with text; color alone is not sufficient. |
| `Pill`, `StatePill`, `OutcomePill` | State, severity, and audit outcome labels | Use semantic tone mapping rather than ad hoc colors. |
| `Sparkline` | Compact trend preview | Reserved for metrics where a trend is meaningful; not used as decoration. |
| `Drawer` | Read-only detail drilldown | Used when list context should remain visible. |
| `JsonView` | Structured payload inspection | Used for blueprints, lifecycle previews, and raw admin tool output. |
| `ConfirmModal` | Audited write confirmation | Mutating flows supply operation context, operator badge, and reason where required. |
| `DataLimited`, `DataLimitedBanner` | Backend limitation disclosure | Must render tool-provided reason, not copy invented by the UI. |
| `RoleSelect` | Compact role lens switcher | Persists `roleLens` through tweaks and must not imply access control. |
| `RolePortfolioFocus` / `RoleWorkspacePanel` | Role-aware emphasis panels | Reorder and label existing data for the selected lens while keeping full detail reachable. |

## Information Architecture

The top navigation uses five primary surfaces and a More menu:

| Primary surface | Why it is primary |
|---|---|
| Dashboard | First landing page and operator summary. |
| Projects | Main business object and Jira integration proof point. |
| Jobs | Async operational work and failure recovery. |
| Audit | Integrity evidence and compliance inspection. |
| Policy | Human approval queue and governance control. |

Tier 2 and Tier 3 pages are reachable from the More menu because they are important but less frequently used: providers, sessions, alerts, migrations, secrets, SLO, capacity, DR, settings, and screen index.

Role workflow routes are also reachable from the navigation model:

| Route | Why it exists |
|---|---|
| Requirements Assist | Product owner/project initiator workflow for turning project descriptions and briefs into intakes, blueprints, and Jira previews. |
| Agent Assignment | Developer workflow for classifying work, recommending agents, assigning agents, and checking content quality. |

## Interaction Patterns

| Pattern | Where used | Rule |
|---|---|---|
| Filter tabs | Projects, jobs, policy, audit | Filters should never mutate backend state. |
| Drawers | Jobs, audit, policy/detail surfaces | Use for detail inspection without route changes. |
| Stage cards | Project provisioning | Preview and execute are paired so operators can inspect generated effects before writes. |
| Packed card columns | Project overview, assignment, agent catalog, and role workflow panels | Uneven card heights should pack into columns where supported to avoid extra whitespace from grid row height matching. |
| Role lens switching | Top nav, page focus cards, command header | Changing the lens updates presentation only; all role users can still reach full project, queue, provider, audit, and lifecycle details. |
| Confirm modal | Policy, jobs, providers, sessions, migrations, secrets, DR, settings | Writes require deliberate confirmation. |
| Explicit empty state | Alerts, DR, migrations, project lists | Empty does not mean success unless the backend says so. |
| Manual refetch | After writes and when polling is paused | Browser state is not authoritative. |

## Accessibility and Usability Constraints

- All severity signals require a text label.
- IDs, hashes, timestamps, and code-like values are rendered in monospace.
- Tables preserve visible headers because operators compare rows under incident pressure.
- Buttons must use direct operation labels such as `Approve`, `Deny`, `Retry`, `Probe`, or `Rotate`.
- Copy avoids explaining the product to the operator; it labels the current operational object and state.
- The UI is optimized for desktop control rooms and engineering workstations. Tablet and mobile widths are smoke-tested for no horizontal overflow, no incoherent text overlap, and usable navigation, but dense operational workflows remain desktop-first.

## Security UX

| Risk | UI mitigation |
|---|---|
| Accidental production action | Environment badge and confirmation modal. |
| Anonymous operator action | Operator badge is threaded into write calls. |
| Unreviewed destructive operation | Reason capture and audited admin tool path. |
| False confidence from incomplete data | Data-limited banners and null values instead of fake metrics. |
| Credential exposure | Secrets pages show logical key status and rotation workflows, not raw secret values. |
| Role lens mistaken for authorization | Role selector copy and docs define it as presentation-only; backend tools and data access do not branch on `roleLens`. |

## Linked Artifacts

- [`docs/control-plane/components.jsx`](../../../control-plane/components.jsx)
- [`docs/control-plane/app.css`](../../../control-plane/app.css)
- [`docs/control-plane/app-tweaks.jsx`](../../../control-plane/app-tweaks.jsx)
- [`docs/control-plane/control-surface-model.js`](../../../control-plane/control-surface-model.js)
- [`docs/sdlc/04-design/control-plane-ui/role-workflows.md`](role-workflows.md)
- [`docs/control-plane/STYLE-NOTES.md`](../../../control-plane/STYLE-NOTES.md)
- [`docs/sdlc/06-security/policy-decision-layer.md`](../../06-security/policy-decision-layer.md)
- [`docs/sdlc/06-security/audit-chain-threat-model.md`](../../06-security/audit-chain-threat-model.md)

---

*Last reviewed: 2026-04-27 by Chris.*
