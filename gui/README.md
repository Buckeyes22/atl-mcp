# Claude Design Brief — atl-mcp Operator Control Plane

> **What this is.** A comprehensive brief for Claude Design to design a **web-based status monitor and control plane** for atl-mcp. Operator-facing, single-tenant, read-heavy with selective write actions (approve / cancel / rotate). The accompanying `source/` directory contains the SDLC docs, ADRs, v6 spec excerpts, and existing-visualization style anchors that ground the design.
>
> **What atl-mcp is.** An MCP (Model Context Protocol) server that turns raw project requirements into agent-ready Jira + Confluence + Bitbucket workspaces. Single-tenant on-prem in v1; build-agent-agnostic; auditable. Full project orientation in `source/repo-readme.md` + `source/CLAUDE.md`.
>
> **What you (Claude Design) should produce.** A polished HTML/CSS/JS prototype of the control plane: an index + 12-15 screens covering monitoring + control surfaces + a small set of focused workflows. Same visual quality as the existing visualization site at `source/existing-visualizations/` — the design system continues there.

---

## Table of contents

1. [Operator persona + use cases](#operator-persona--use-cases)
2. [How the source material is organized](#how-the-source-material-is-organized)
3. [Existing visual language (style anchor)](#existing-visual-language-style-anchor)
4. [The control plane's API surface](#the-control-planes-api-surface)
5. [Information architecture (15 screens)](#information-architecture-15-screens)
6. [Per-screen briefs](#per-screen-briefs)
7. [Cross-cutting components](#cross-cutting-components)
8. [Style guide](#style-guide)
9. [Data states (empty / loading / error / populated)](#data-states-empty--loading--error--populated)
10. [Output format expectations](#output-format-expectations)
11. [What NOT to design](#what-not-to-design)
12. [Quick reference: screen → source files](#quick-reference-screen--source-files)

---

## Operator persona + use cases

### Who uses this

The single primary persona is **the human operator running atl-mcp in production** (per `source/docs/sdlc/11-onboarding/operator-guide.md`). For v1 single-maintainer they're often the same person who built it; the GUI's job is to make their on-call / steady-state work fast.

Secondary personas:
- **Auditor** — reads audit chain entries, verifies integrity. Read-only access.
- **On-call peer** (post-v1) — handles alerts when primary operator is unavailable.

The GUI is **not for build agents** (they consume MCP, not the GUI) and **not for partner teams** (they interact via Jira/Confluence after provisioning).

### Top operator tasks the GUI accelerates

Roughly in order of "how often does this happen":

1. **Daily glance** — "is the system healthy? are SLOs green? any alerts firing?" (every morning + ad-hoc)
2. **Provisioning approval** — operator reviews a `require_approval` policy decision; approves or denies (occasional; spikes when adopting a new project)
3. **Incident triage** — alert fires; operator reads the alert, opens the linked runbook entry, follows diagnostics, resolves (per-incident; goal: <5 min for P0 ack)
4. **Audit chain verification** — periodic + post-incident "did anything weird happen?" review
5. **Provisioning lifecycle** — start a new project: intake → blueprint → preview → execute (rare but high-stakes)
6. **Credential rotation** — quarterly + at-will: rotate Atlassian token / master encryption key / audit signing key
7. **Capacity check** — quarterly review against limits + cost-tracking
8. **DR drill** — quarterly: stage a scenario, run recovery, score
9. **Migration apply** — when a new schema migration ships
10. **Configuration / feature-flag flip** — rare; mostly for milestone enablement

The GUI optimizes for #1, #2, #3 first, then progressively for the rest.

### What the GUI is explicitly NOT

- **Not a customer-facing app.** atl-mcp's customers see Atlassian/Bitbucket UIs (atl-mcp wrote into them); they never see this.
- **Not a build-agent UI.** Build agents speak MCP; the GUI is for the human operator.
- **Not a multi-tenant admin console.** v1 single-tenant. Multi-tenant is post-v1 (v6 §7.3).
- **Not an interactive code editor.** No editing of project profiles in the GUI; that's what the MCP `project_intake_create` tool is for. The GUI shows what was created/edited, not the editing.
- **Not a real-time chat interface for build agents.** Out of scope.
- **Not mobile.** Desktop-first. A small-viewport fallback is acceptable but not the focus.

---

## How the source material is organized

```
source/
├── repo-readme.md                       repo-root README (project pitch + reading order)
├── CLAUDE.md                            Claude-Code operating rules (mention the iron laws + no-stdout rule)
├── AGENTS.md                            LF AGENTS.md spec (for additional engineering conventions)
├── v6-spec-excerpts.md                  ~12k words of v6 spec sections most relevant to the control plane
├── docs/
│   ├── adr/                             6 ADRs (architectural decision records)
│   │   ├── 0000-adr-process.md
│   │   ├── 0001-pglite-for-dev.md
│   │   ├── 0002-token-encryption-noble-ciphers.md
│   │   ├── 0003-confluence-storage-default-adf-flagged.md
│   │   ├── 0004-bitbucket-app-password-vs-oauth.md
│   │   └── 0005-audit-signing-pipeline.md
│   └── sdlc/                            ~70 docs across the relevant categories
│       ├── README.md                    SDLC TOC + persona-routing
│       ├── 02-architecture/             system context, containers, dataflow, trust boundaries (5 files)
│       ├── 04-design/                   module designs, API specs, sequence diagrams (13 files)
│       ├── 05-data/                     schema, domain model, retention, classification, audit trail (6 files)
│       ├── 06-security/                 threat model, controls, policy, audit chain, lethal trifecta (9 files)
│       ├── 08-operations/               runbook, SLO/SLI, monitoring, alerting, observability stack (6 files)  ←  HEAVY USE
│       ├── 09-deployment/               environments, feature flags, deployment targets, secrets provisioning (6 files)
│       ├── 10-dr-bcp/                   backup, RTO/RPO, failover, audit chain recovery, drill schedule (5 files)
│       ├── 11-onboarding/               developer / integrator / OPERATOR / partner guides (5 files)  ←  PERSONA SOURCE
│       ├── 14-incidents/                postmortem template, taxonomies, library (5 files)
│       ├── 15-capacity/                 current limits, planning, benchmarks, load-test runbook (4 files)
│       └── 17-glossary/                 cross-cutting + domain vocabulary (2 files)
└── existing-visualizations/             style anchor — design language to extend
    ├── index.html                       the visualization plan / TOC page (the most polished example)
    ├── styles.css                       shared semantic palette + IBM Plex typography
    ├── v01-audit-chain-construction.html  example: information-dense single-figure page
    ├── v06-observability-pillars.html     example: 4-column comparison layout
    ├── v07-stride-matrix.html             example: structured matrix / table layout
    └── v15-c4-l3.html                     example: stacked 2-figure architecture page
```

When a screen brief says "read for context," paths are relative to `source/`.

---

## Existing visual language (style anchor)

The control plane should feel like a sibling of the 18-figure visualization site at `source/existing-visualizations/`. **Open `source/existing-visualizations/index.html` first** — that's the cleanest articulation of the design system to extend. The CSS at `source/existing-visualizations/styles.css` defines the tokens (colors, fonts, spacing, borders, shadows) you should reuse.

### Established design tokens

| Token | Value | Usage |
|---|---|---|
| Body type | IBM Plex Sans 400/500/600/700 | All UI text |
| Mono type | IBM Plex Mono 400/500 | IDs, paths, code, eyebrow labels |
| Background | `#fff` (page) / `#faf9f6` (subtle / sidebar) | Generous whitespace |
| Ink | `#1a1a1c` (primary) / `#43434a` (secondary) / `#6f6e6a` (tertiary) / `#9a9690` (eyebrow) | Hierarchy via shade, not weight alone |
| Lines | `#e3e0d8` (default) / `#c8c3b6` (strong) | 1px default; never thicker than 1.5px |
| Surface | `#fff` (cards) / `#faf9f6` (sub-surface) | Subtle layered surfaces |
| Severity red | `#7a1d14` text / `#b8281d` accent / `#fbe7e4` bg / `#e8a89e` border | P0 / SECRET / deny / failure |
| Severity amber | `#7a4408` text / `#b96b16` accent / `#fbeed8` bg / `#e3c486` border | P1 / PRIVATE / warn |
| Severity blue | `#11364f` text / `#1f5f8a` accent / `#dde9f2` bg / `#a3c4d8` border | INTERNAL / info |
| Success green | `#0e3d2f` text / `#1f6e54` accent / `#dceee5` bg / `#a3c8b8` border | PUBLIC / pass / done |
| Purple | `#3e0d4d` text / `#6e1a82` accent / `#ece1f3` bg / `#c39bd1` border | Identity / signing / cryptographic operations |

The semantic palette is consistent: **red = severity**, **amber = warn**, **blue = info**, **green = pass**, **purple = identity/crypto**.

### Established layout conventions

Observable from the existing pages:

- **Page max-width** ~1320px with 56px / 48px page padding.
- **Eyebrow line** in IBM Plex Mono, 11px, `#9a9690`, letter-spacing 1.4px, uppercased — every page has one.
- **H1** 40px / 600 weight / -0.02em letter-spacing, line-height 1.1.
- **Cards** 1px border with 0px or 3px corner radius — almost no rounded corners. Cards lift on hover (subtle shadow).
- **Section heads** with the section number in mono on the left, title in sans, sub-blurb on the right, separated by a 1px black underline.
- **Tables / matrices** with mono headers, sans cells, alternating row backgrounds when needed.
- **Stat blocks** with mono labels above 32px display-weight numbers, with secondary sub-text below.

The control plane extends this language to interactive screens: navigation, panels, live data, action buttons, modals, forms.

### Visual ethos

- **Designed page**, not a generic dashboard template. The existing visualizations look hand-crafted; the GUI should too.
- **Information density** that respects whitespace. Don't pack the screen edge-to-edge; let content breathe.
- **Static SVG aesthetic** for any inline diagrams (audit-chain construction, status indicators, etc.). Match the visualization site's drawing style.
- **No emojis.** No icon-fonts that look generic. Custom 16px/20px line-icons in monochrome where icons help.
- **No bright colors except for severity signaling.** Most of the GUI is monochrome; color is meaning, not decoration.
- **Direct voice.** Labels are imperative or noun-phrase. Not "Click to view audit chain" — just "Audit chain" + a chevron.

---

## The control plane's API surface

Important: most of these endpoints **don't exist yet** in atl-mcp. The current mgmt API only has `/healthz`, `/readyz`, `/metrics` (per `source/docs/sdlc/04-design/api-mgmt-rest.md`). Operator-control endpoints are M11+ work.

**The GUI design implicitly specifies the API contract.** Design the screens against what they SHOULD consume; the API is a co-design output.

### Read endpoints (assumed)

| Endpoint | Returns | Used by screens |
|---|---|---|
| `GET /admin/health` | service health + version + uptime + active sessions + tier | Dashboard |
| `GET /admin/health/audit` | chain length, last verified, integrity status | Dashboard, Audit viewer |
| `GET /admin/health/upstream` | per-provider reachability + rate-limit headroom | Dashboard, Provider health |
| `GET /admin/health/db` | migration version, pool stats, connectivity | Dashboard, Migrations |
| `GET /admin/projects?state=&limit=` | project list with state, last activity, readiness grade | Project list |
| `GET /admin/projects/:id` | project detail (blueprint, profile, recent jobs, recent audit entries) | Project detail |
| `GET /admin/projects/:id/blueprint` | current blueprint JSON | Project detail |
| `GET /admin/projects/:id/audit?from=&to=` | audit entries scoped to project | Project detail (audit tab) |
| `GET /admin/projects/:id/profile` | preflight profile (capabilities + warnings) | Project detail (profile tab) |
| `GET /admin/projects/:id/context-packs` | generated context packs | Project detail (context tab) |
| `GET /admin/jobs?status=&type=` | provisioning job list | Provisioning queue |
| `GET /admin/jobs/:id` | job detail incl. plan, progress, errors | Job detail (modal or page) |
| `GET /admin/audit?actor=&op=&from=&to=` | audit entries with filters | Audit chain viewer |
| `GET /admin/audit/:id` | single entry detail (full payload, signature, key_id) | Audit entry detail |
| `GET /admin/policy/decisions?effect=&from=` | recent policy decisions | Policy decisions |
| `GET /admin/policy/pending` | require_approval queue | Approval inbox |
| `GET /admin/sessions` | active MCP sessions (id, capabilities, ttl) | Sessions |
| `GET /admin/migrations` | applied + pending migrations | Migrations |
| `GET /admin/secrets` | sealed-token rows (kind + subject + createdAt; NEVER plaintext) | Secrets |
| `GET /admin/alerts` | currently firing alerts | Alerts/incidents |
| `GET /admin/alerts/:id` | alert detail with linked runbook section | Alert detail |
| `GET /admin/slos` | SLO targets + current SLI values | SLO dashboard |
| `GET /admin/cost/current` | current month cost breakdown | Cost dashboard |
| `GET /admin/capacity` | current usage vs. configured limits | Capacity |
| `GET /admin/dr/drills` | drill history | DR control plane |
| `GET /admin/feature-flags` | current flag values | Settings / config |
| `GET /admin/incidents` | recent incident library entries | Incidents |

### Write endpoints (assumed)

Every write generates an audit chain entry. All require operator auth (M11; loopback for v1).

| Endpoint | Action | Used by screens |
|---|---|---|
| `POST /admin/jobs/:id/cancel` | cancel running job | Provisioning queue, job detail |
| `POST /admin/jobs/:id/retry` | retry failed job | Provisioning queue, job detail |
| `POST /admin/jobs/:id/pause` / `resume` | pause/resume processing | Provisioning queue |
| `POST /admin/policy/decisions/:id/approve` | approve a require_approval decision | Approval inbox |
| `POST /admin/policy/decisions/:id/deny` | deny a require_approval decision | Approval inbox |
| `POST /admin/audit/verify` | trigger offline verifier run | Audit viewer |
| `DELETE /admin/sessions/:id` | terminate an MCP session | Sessions |
| `POST /admin/migrations/run` | apply pending migrations (after rehearsal) | Migrations |
| `POST /admin/secrets/:id/rotate` | initiate token rotation | Secrets |
| `POST /admin/audit-key/rotate` | initiate audit signing key rotation | Secrets / DR |
| `POST /admin/dr/drills` | schedule + run a DR drill | DR control plane |
| `POST /admin/feature-flags/:name` | flip a feature flag (M11+) | Settings |
| `POST /admin/projects/:id/transition` | manual project state transition (with reason; audited) | Project detail |
| `POST /admin/preflight/refresh?projectId=` | force re-run of preflight discovery | Project detail |

### Streaming / WebSocket (NOT for v1)

A real-time stream of audit chain entries / alerts / job status would be ideal but **out of v1 scope.** Use polling intervals appropriate to the data:
- Dashboard: 30s
- Provisioning queue: 5s while a job is in_progress; 30s otherwise
- Audit viewer: manual refresh (default) + 60s auto-refresh toggle
- Approval inbox: 15s

Design indicates polling status (small "last updated 12s ago" indicator) but doesn't depend on WebSocket.

### Auth model

- **v1:** loopback-only; the GUI lives on the same host as the orchestrator, no app-level auth.
- **Post-v1 (M11+):** operator-token auth. The brief should design with auth in mind: a small "operator: chris@lateapexllc.com" badge in the top-right, a sign-out affordance, a session-expiry indicator.
- **Auditor accounts** (post-v1): read-only mode. The GUI design should accommodate a "read-only" pill in the top bar; write actions are visibly disabled.

---

## Information architecture (15 screens)

Tiered by must-have / should-have / nice-to-have.

### Tier 1 — must-have (6 screens)

The minimum viable control plane.

1. **`/`** — **Dashboard / Overview** (system at a glance)
2. **`/projects`** — **Project list**
3. **`/projects/:id`** — **Project detail** (with tabs: overview / blueprint / profile / audit / jobs / context packs)
4. **`/jobs`** — **Provisioning queue**
5. **`/audit`** — **Audit chain viewer**
6. **`/policy`** — **Policy decisions + approval inbox**

### Tier 2 — should-have (5 screens)

7. **`/providers`** — **Provider health** (Atlassian / Bitbucket / UIO)
8. **`/sessions`** — **MCP sessions** (active + recent)
9. **`/alerts`** — **Alerts + incidents**
10. **`/migrations`** — **Migrations**
11. **`/secrets`** — **Secrets + key rotation**

### Tier 3 — nice-to-have (4 screens)

12. **`/slos`** — **SLO dashboard**
13. **`/capacity`** — **Capacity + cost**
14. **`/dr`** — **DR control plane**
15. **`/settings`** — **Settings / feature flags / config**

Plus cross-cutting:

- **Top navigation** (with all 15 routes accessible)
- **Sign-in / sign-out** stub (one screen + one modal)
- **404 / 500** error pages
- **Empty / loading / error** state for any data-fetching surface

---

## Per-screen briefs

Each brief follows this shape:

- **Route + tier**
- **Purpose** — what the operator does here
- **Read for context** — specific files in `source/` to ground the design
- **Data sources** — which API endpoints the screen consumes
- **Layout** — what panels / blocks / regions
- **Key UI elements** — specific labels, controls, indicators
- **Actions** — write operations available
- **Style notes** — beyond global style guide
- **Acceptance criteria** — when the screen is done well

---

### S1. Dashboard / Overview

- **Route:** `/` (default landing)
- **Tier:** 1
- **Purpose:** The "morning glance" view. In 5 seconds the operator can answer: is the system healthy, are SLOs green, are alerts firing, is there a queue backlog, did anything weird happen overnight.
- **Read for context:**
  - `source/docs/sdlc/08-operations/runbook.md`
  - `source/docs/sdlc/08-operations/slo-sli.md`
  - `source/docs/sdlc/08-operations/alerting.md`
  - `source/docs/sdlc/08-operations/monitoring.md`
  - `source/docs/sdlc/11-onboarding/operator-guide.md` (the "Daily glance" workflow)
- **Data sources:** `/admin/health`, `/admin/health/audit`, `/admin/health/upstream`, `/admin/health/db`, `/admin/slos`, `/admin/alerts`, `/admin/jobs?status=in_progress`, `/admin/policy/pending`
- **Layout:** Single page, top-down scan order:
  1. **Status strip** at top: 4-6 binary indicators (Service, DB, Audit chain, Atlassian, Bitbucket, MCP transport) — green/amber/red dots with one-line status text.
  2. **Stat-block row** (4 stats, mirroring the visualization-site `ix-stats` block style): active sessions, queue depth, audit chain length, alerts firing.
  3. **SLO grid** (6 SLOs, per `slo-sli.md`): each as a small card showing target / current / time-window with a sparkline if appropriate.
  4. **Active alerts panel** (left, ~60% width): current firing alerts, severity-colored, each with "→ runbook" link.
  5. **Approval inbox preview** (right, ~40% width): top 5 pending `require_approval` decisions, severity-colored, each with "Approve" / "Deny" inline buttons OR a "Review" link.
  6. **Recent audit activity** (bottom): last 10 audit entries, scannable table format (time / actor / operation / outcome).
  7. **Footer**: last-refreshed timestamp + auto-refresh toggle (default on, 30s interval).
- **Key UI elements:**
  - Status strip: each indicator is a colored dot + label + sub-line (e.g., "Atlassian — reachable, 98% rate-limit headroom").
  - SLO cards: target as a target-line on a small chart, current SLI value as a number above, color = pass/at-risk/breach.
  - Alerts panel rows: severity dot, alert ID, alert name, fired-at timestamp, "→ runbook" mini-button.
- **Actions:**
  - Approve / Deny inline (with confirm modal — never destructive without confirmation).
  - Click any alert → alert detail.
  - Click any SLO card → SLO dashboard scrolled to that SLI.
  - Click any project in audit activity → project detail.
- **Style notes:** Lean on the existing-visualization stat-block style for the top stats. Use the severity palette consistently. The status strip is the key surface — make it a dominant visual element at the top.
- **Acceptance criteria:**
  - In one screen-height (no scrolling on a 1080p display), the operator sees: service health, queue, alerts count, SLO status, pending approvals count.
  - Severity is communicated by color first, text second.
  - Auto-refresh works without disrupting the operator (no scroll-jumps; "last updated" indicator updates).
  - The dashboard is the only screen that loads quickly even with 10s of stale data — show stale-data indicator if backend is slow.

---

### S2. Project list

- **Route:** `/projects`
- **Tier:** 1
- **Purpose:** See all projects atl-mcp is managing, filter by state, drill into any.
- **Read for context:**
  - `source/v6-spec-excerpts.md` § 6 (Project State Machine)
  - `source/docs/sdlc/05-data/domain-model.md` (`ProjectState`)
  - `source/docs/sdlc/04-design/module-workflows.md`
  - `source/docs/sdlc/01-charter/README.md` (charter Users section — "operator" persona)
- **Data sources:** `/admin/projects?state=&limit=`
- **Layout:**
  - **Header**: page title, project count, "+ New project" button (top-right).
  - **Filter bar**: state filter (pill group: All / DRAFT / IN_PROGRESS / READY / DRIFT_DETECTED / ARCHIVED), search by key/name, sort dropdown.
  - **Project list** as a dense table:
    - columns: Project key, Name, State (colored pill), Last activity, Readiness grade, Active jobs, Actions
    - row hover: subtle background, full-row clickable to navigate to detail
  - **Empty state**: "No projects yet — create one via the MCP tool `project_intake_create` or [+ New project]."
  - **Pagination** at bottom (or virtualized if many).
- **Key UI elements:**
  - State pills: color per state. Use the established palette — green for terminal-good (READY_FOR_BUILD), amber for in-flight (IN_PROGRESS), red for problematic (DRIFT_DETECTED, VALIDATION_FAILED), grey for ARCHIVED.
  - Readiness grade: A / B / C / D / F as a visual cell (colored pill or letter mark).
  - Active jobs column: numeric; if > 0, link to the queue filtered to this project.
- **Actions:**
  - "New project" → opens a stub flow (could be a modal that just shows the MCP tool to call, since intake creation is via MCP not the GUI).
  - Row click → project detail.
- **Style notes:** Dense table styling per the matrix examples in `source/existing-visualizations/v07-stride-matrix.html`. Mono for the project key column. Sans for names.
- **Acceptance criteria:**
  - All 13 ProjectState values are color-coded.
  - Filter changes the list immediately (client-side or with skeleton loading).
  - Empty state is informative, not just "No data."

---

### S3. Project detail

- **Route:** `/projects/:id`
- **Tier:** 1
- **Purpose:** Drill into a specific project. The operator's primary "what's going on with project X" view.
- **Read for context:**
  - `source/docs/sdlc/04-design/module-workflows.md`
  - `source/docs/sdlc/05-data/domain-model.md`
  - `source/docs/sdlc/06-security/policy-decision-layer.md`
  - `source/v6-spec-excerpts.md` § 6 (state machine), § 17 (readiness rubric)
- **Data sources:**
  - `GET /admin/projects/:id` (overview)
  - `GET /admin/projects/:id/blueprint`
  - `GET /admin/projects/:id/profile`
  - `GET /admin/projects/:id/audit`
  - `GET /admin/jobs?projectId=:id`
  - `GET /admin/projects/:id/context-packs`
- **Layout:**
  - **Header**: project key + name + state pill + readiness grade + last-updated.
  - **Action bar**: "Refresh preflight", "Manual transition", "Open in Jira/Confluence/Bitbucket" (external links).
  - **Tabs** (sticky below header):
    1. **Overview** — state machine visual (dot diagram showing current state in the 13-state machine), summary stats (audit entry count, last provisioning, readiness grade).
    2. **Blueprint** — JSON tree of the current blueprint (collapsible sections). Read-only view; "Re-generate" button if the operator wants to trigger M4 again.
    3. **Profile** — preflight profile (capabilities + warnings). "Refresh preflight" button (calls `POST /admin/preflight/refresh`).
    4. **Audit** — paginated audit entries scoped to this project. Filters: from/to, operation, outcome.
    5. **Jobs** — provisioning jobs scoped to this project. Same shape as the queue page.
    6. **Context packs** — generated context packs with regeneration keys, sizes, target models.
- **Key UI elements:**
  - State machine visual: 13 nodes laid out as a flow; current state highlighted; allowed transitions visually distinct from disallowed.
  - Blueprint JSON viewer: indented, syntax-highlighted (basic), expandable nodes.
  - Audit entries table: time / actor / operation / outcome / chain hash (truncated, click to copy).
- **Actions:**
  - Manual transition: opens a modal listing the allowed next states (per the state machine), requires a reason text field, requires confirmation. Audited.
  - Refresh preflight: in-place button that triggers + shows a brief "running" state.
  - Re-generate blueprint: confirmation modal (potentially expensive; includes sampling cost estimate).
- **Style notes:** Tabs in the design system's mono-styled pill nav. State machine visual should be a small, clean SVG inline (taking design cues from how the existing visualizations render state).
- **Acceptance criteria:**
  - All 6 tabs are accessible from a single project URL with hash-style routing.
  - The state machine visual is unambiguous about current state + allowed next states.
  - Empty states for each tab (e.g., "No context packs generated yet").

---

### S4. Provisioning queue

- **Route:** `/jobs`
- **Tier:** 1
- **Purpose:** See provisioning jobs, their status, queue depth; cancel/retry as needed.
- **Read for context:**
  - `source/docs/sdlc/04-design/module-queue.md`
  - `source/docs/sdlc/04-design/module-workflows.md`
  - `source/v6-spec-excerpts.md` § 24 (Job Queue and Async Workflows)
- **Data sources:** `/admin/jobs?status=&type=`, `/admin/jobs/:id`
- **Layout:**
  - **Header + status strip**: queue depth, in-flight count, failed-last-24h count.
  - **Filters**: status (pill group: All / pending / in_progress / succeeded / failed / canceled), job kind (Jira-execute / Confluence-execute / VCS-execute / blueprint-generate / preflight), project filter.
  - **Job list table**: time-enqueued, project, kind, status, progress (small bar/percentage if in-progress), actions.
  - **Job detail panel** (right side, slides in on row click): full plan JSON (collapsible), per-action progress, audit emissions, errors if any. Close to return to list.
- **Key UI elements:**
  - Status pills: green (succeeded), amber (pending/in-progress), red (failed), grey (canceled).
  - Progress bar for in-progress jobs (e.g., "12 of 50 actions complete").
  - "Cancel" / "Retry" buttons in actions column, contextually visible.
- **Actions:**
  - **Cancel** (in-progress job): confirmation modal; cancellation honored at next safe boundary; warning if mid-action.
  - **Retry** (failed job): confirmation modal; idempotent re-run.
  - **Pause / Resume queue** (top-right action): pauses worker pickup of new jobs; in-flight continue.
- **Style notes:** Time-series feel: most-recent first, with the in-flight jobs visually distinct (subtle pulse animation? or just amber backdrop?). Don't over-animate — the visualization-site aesthetic is calm.
- **Acceptance criteria:**
  - Queue depth and failure-count are visible without filtering.
  - Cancel + retry actions are available from both list and detail.
  - "Pause queue" is a destructive-feeling action — make it clearly destructive (red border + confirm).

---

### S5. Audit chain viewer

- **Route:** `/audit`
- **Tier:** 1
- **Purpose:** Browse, filter, verify the audit chain. Auditor's primary surface; operator's investigation surface.
- **Read for context:**
  - `source/docs/sdlc/05-data/audit-trail.md`
  - `source/docs/sdlc/06-security/audit-chain-threat-model.md`
  - `source/docs/adr/0005-audit-signing-pipeline.md`
  - `source/docs/sdlc/10-dr-bcp/audit-chain-recovery.md`
  - `source/v6-spec-excerpts.md` § 30
- **Data sources:** `/admin/health/audit`, `/admin/audit?actor=&op=&from=&to=`, `/admin/audit/:id`
- **Layout:**
  - **Top status strip**: chain length / last verified at / integrity status (verified / unverified / failed).
  - **Filters bar**: time range (from / to with quick-pick: 1h / 24h / 7d / 30d / all), actor (autocomplete), operation (autocomplete), outcome (allow / deny / require_approval / failure / refusal).
  - **Entry list** (table): timestamp, actor (truncated session id or operator email), operation, outcome (colored pill), payload-summary (1-line), chain-hash (truncated, copy-to-clipboard).
  - **Entry detail panel** (right slide-in): full JSON payload, signature verification result, key_id resolved + linked-to in registry, prev_hash linkage diagram (small, inline).
  - **Verifier action** (top-right): "Run offline verifier" button → kicks off a verification run; shows progress; reports result (passed / failed at entry K).
- **Key UI elements:**
  - Integrity-status badge: prominent. "Verified · 2026-04-26 07:14 UTC" (green) or "Failed at entry K" (red, with link).
  - Outcome pills: deny=red, allow=green, require_approval=amber, failure=red.
  - Inline mini-chain diagram in entry detail: previous entry → current → (next?) showing prev_hash linkage. Take inspiration from `source/existing-visualizations/v01-audit-chain-construction.html`.
- **Actions:**
  - Run verifier (full or scoped to time range).
  - Export filtered entries (JSON download).
  - Click entry → detail.
- **Style notes:** The audit viewer is the most "auditor-facing" screen. Make it feel formal, archival, restrained. Mono-heavy. No animations beyond loading indicators.
- **Acceptance criteria:**
  - Chain integrity status is visible without scroll.
  - Filters update the list with a clear "filtered: N of M entries" indicator.
  - The mini-chain diagram in entry detail clearly shows the chain linkage (prev_hash → chain_hash → signature) — this is the GUI's surfacing of V1's static figure.

---

### S6. Policy decisions + approval inbox

- **Route:** `/policy`
- **Tier:** 1
- **Purpose:** See recent policy decisions; act on the require_approval queue.
- **Read for context:**
  - `source/docs/sdlc/06-security/policy-decision-layer.md`
  - `source/docs/sdlc/06-security/lethal-trifecta.md`
  - `source/v6-spec-excerpts.md` § 7 (architecture — policy layer), § 38 (lethal trifecta)
- **Data sources:** `/admin/policy/decisions?effect=&from=`, `/admin/policy/pending`
- **Layout:**
  - **Two-tab**: "Approval inbox" (require_approval pending) | "Recent decisions" (history).
  - **Approval inbox**:
    - Cards per pending decision. Each card:
      - Decision id, project, intent, requested-at, requesting actor.
      - Reasons: bullet list of why this needs approval (e.g., "Cross-project write" / "Lethal trifecta detected with confidence 0.84" / "Operator-strict-mode violation").
      - Confidence: numeric + categorical badge.
      - Diff or context preview: what would happen if approved.
      - "Approve" / "Deny" buttons with required reason text field.
  - **Recent decisions**:
    - Table: timestamp, project, intent, effect (allow / deny / require_approval), confidence, actor, reason summary.
    - Filters: effect, project, time range, confidence threshold.
- **Key UI elements:**
  - Pending-approval cards lean toward severity-amber backdrop (require attention).
  - Confidence display: small inline meter (0-1 numeric + categorical badge).
  - Approve modal: confirms intent + requires the operator to type a justification. Audited.
- **Actions:**
  - Approve (with reason) — POST `/admin/policy/decisions/:id/approve`.
  - Deny (with reason) — POST `/admin/policy/decisions/:id/deny`.
- **Style notes:** Approval queue feels like an inbox — chronological, action-oriented, urgency-coded. The require_approval decisions are the operator's most consequential actions; design accordingly.
- **Acceptance criteria:**
  - Approval inbox empty state ("All clear — no decisions pending review") is celebratory but understated.
  - Approve/deny require an explicit reason; can't submit empty.
  - Lethal-trifecta-flagged decisions are visually distinct (red accent, clear "lethal trifecta" badge).

---

### S7. Provider health (Atlassian / Bitbucket / UIO)

- **Route:** `/providers`
- **Tier:** 2
- **Purpose:** Dedicated view of external dependencies' health. Where rate-limit issues + auth issues + outages surface.
- **Read for context:**
  - `source/docs/sdlc/04-design/module-providers-atlassian.md`
  - `source/docs/sdlc/04-design/module-providers-vcs.md`
  - `source/docs/sdlc/04-design/module-preflight.md`
  - `source/docs/sdlc/08-operations/runbook.md` (provider 401/429 sections)
- **Data sources:** `/admin/health/upstream`, `/admin/secrets` (for auth creds metadata), `/admin/audit?op=provider*`
- **Layout:**
  - **3 panels** (one per provider, side-by-side or stacked at narrow viewports):
    - Atlassian (Jira + Confluence)
    - Bitbucket
    - UIO (optional partner)
  - Each panel:
    - Status header: reachable / degraded / unreachable (colored dot + label).
    - Auth status: token kind, last rotation, expiry-if-known.
    - Rate-limit headroom: gauge or numeric (e.g., "97% headroom against site rate limit").
    - Recent failures (last hour): count + spark indicator.
    - Actions: rotate credentials, test connection (probe).
- **Key UI elements:**
  - Rate-limit gauge: simple horizontal bar with target line at 100% and current usage.
  - Recent failures sparkline: 60-min minute-buckets.
- **Actions:**
  - Probe (test connection) — calls `/admin/health/upstream` for that provider with force=true.
  - Rotate token — links to secrets screen.
- **Style notes:** Two-row layout: status + auth on top, telemetry (rate-limit + failures) on bottom. Mono for the technical bits (token kind, endpoint URL); sans for the human-readable status.
- **Acceptance criteria:**
  - Per-provider status visible at a glance.
  - Rate-limit headroom uses the established palette (green > 50%, amber 20-50%, red < 20%).

---

### S8. MCP sessions

- **Route:** `/sessions`
- **Tier:** 2
- **Purpose:** See currently-connected MCP clients; terminate misbehaving sessions; understand capability negotiation outcomes.
- **Read for context:**
  - `source/docs/sdlc/04-design/module-mcp-runtime.md`
  - `source/docs/sdlc/04-design/api-mcp-tools.md`
  - `source/v6-spec-excerpts.md` § 22 (transport), § 14 (MCP surface)
- **Data sources:** `/admin/sessions`
- **Layout:**
  - **Stat strip**: total active / by transport (stdio vs HTTP) / by client name (Claude Code, Cursor, Codex, etc.).
  - **Session list**:
    - columns: id (truncated), client (advertised name), transport, capabilities (count), connected-at, last-activity, ttl-remaining, actions.
  - **Session detail panel**: full capability set negotiated, recent tool calls (last 10), client metadata (advertised version, model target if any), terminate button.
- **Key UI elements:**
  - Capability set: pill cluster — `tools (12) · resources (5) · prompts (3) · sampling`.
  - TTL: countdown indicator (color-coded if approaching expiry).
- **Actions:**
  - Terminate session — confirmation modal. The MCP client will see a clean disconnect.
- **Style notes:** Network-administration feel; mono-heavy for IDs. Don't expose any session-internal state that could leak credentials or pseudonyms.
- **Acceptance criteria:**
  - Concurrent session count vs. cap (1000 default per `MCP_HTTP_MAX_CONCURRENT_SESSIONS`) is visible.
  - Sessions can be terminated cleanly.

---

### S9. Alerts + incidents

- **Route:** `/alerts`
- **Tier:** 2
- **Purpose:** See alerts firing now; navigate to runbook procedures; track recent incidents.
- **Read for context:**
  - `source/docs/sdlc/08-operations/alerting.md`
  - `source/docs/sdlc/08-operations/runbook.md`
  - `source/docs/sdlc/14-incidents/incident-library.md`
  - `source/docs/sdlc/14-incidents/postmortem-template.md`
- **Data sources:** `/admin/alerts`, `/admin/alerts/:id`, `/admin/incidents`
- **Layout:**
  - **Two columns** (or two tabs):
    - **Active alerts** (left): list of currently-firing alerts, severity-colored, each linkable to:
      - The runbook entry (mini-preview drawer or full nav)
      - The metric chart that's breaching
    - **Recent incidents** (right): last 20 closed incidents with status (active / resolved), severity, opened-at, closed-at.
  - **Alert detail panel**: alert ID, severity, fired-at, threshold crossed, current value, linked runbook entry (with quick action steps inline), acknowledge button.
- **Key UI elements:**
  - Severity colors: P0 red border + red dot; P1 amber; P2 grey.
  - "Acknowledge" button silences re-pages but doesn't resolve.
  - Runbook-entry preview (right pane or modal): mini-renders the relevant runbook section.
- **Actions:**
  - Acknowledge — operator says "I've got this."
  - Open runbook entry — quick navigation to the operations doc anchor.
  - Mark incident closed — for incidents (not alerts) once mitigation is verified.
- **Style notes:** Severity-driven layout. P0s float to top with red emphasis. Include a "no alerts" empty state that's reassuring without being smug.
- **Acceptance criteria:**
  - P0 alerts cannot be missed visually.
  - Acknowledge action is one-click + confirmable.
  - Runbook integration: the operator can read the procedure WITHOUT leaving the alert detail.

---

### S10. Migrations

- **Route:** `/migrations`
- **Tier:** 2
- **Purpose:** Surface migration state; trigger application of pending migrations after rehearsal; see history.
- **Read for context:**
  - `source/docs/sdlc/05-data/migrations.md`
  - `source/docs/sdlc/04-design/module-storage.md`
  - `source/docs/adr/0001-pglite-for-dev.md`
- **Data sources:** `/admin/migrations`, `/admin/health/db`
- **Layout:**
  - **Status header**: current migration version, last applied at, total applied count.
  - **Pending migrations list**: if any. Highlighted (amber) with "Run rehearsal" / "Apply" action buttons.
  - **Applied migrations table**: chronological, applied-at + applied-by + duration + post-condition results.
- **Key UI elements:**
  - Pending migrations are visually warning-toned.
  - "Apply" button has a checklist confirmation: "Confirm rehearsal passed", "Confirm operator authorized", "I've reviewed the SQL".
- **Actions:**
  - Run rehearsal — kicks off a rehearsal run against a temp DB; reports results.
  - Apply pending — only enabled after a successful rehearsal in the last N hours.
- **Style notes:** Dense table for applied list. Pending migration cards more elaborate. The "Apply" action feels weighty (multi-step confirm).
- **Acceptance criteria:**
  - Pending migrations are unmissable.
  - Apply action requires a recent rehearsal.

---

### S11. Secrets + key rotation

- **Route:** `/secrets`
- **Tier:** 2
- **Purpose:** See sealed credentials' metadata; rotate. Master encryption key + audit signing key get special treatment.
- **Read for context:**
  - `source/docs/sdlc/06-security/secrets-mgmt.md`
  - `source/docs/sdlc/06-security/token-storage.md`
  - `source/docs/sdlc/06-security/audit-chain-threat-model.md` (rotation procedure)
  - `source/docs/sdlc/08-operations/runbook.md` (Incident C — encryption key rotation)
- **Data sources:** `/admin/secrets`
- **Layout:**
  - **Sections** (grouped by concern):
    1. **Token store** — list of sealed tokens (kind: atlassian_api_token / oauth_refresh / bitbucket_app_password / webhook_shared_secret). Per row: subject, last-rotated, action (rotate).
    2. **Master encryption key** — single card: status (active), last rotated, "Rotate (with re-encrypt drill)" button — the button opens a multi-step wizard.
    3. **Audit signing key** — single card: active key id, registry git ref + last commit, "Rotate" button.
- **Key UI elements:**
  - **Plaintext is NEVER shown.** The GUI never displays a token value. Confirmable by code review.
  - Rotation actions open multi-step wizards with confirmation gates.
- **Actions:**
  - Rotate token — confirmation; new token must be provided; old token marked superseded but retained for rollback.
  - Rotate master key — multi-step drill: backup → generate new → re-encrypt all → cut over → verify → decommission old. Each step has a confirmation.
  - Rotate audit signing key — multi-step: generate new → register public-half in git ref → activate → verify next chain entry signs with new key.
- **Style notes:** This is the most security-sensitive screen. Make destructive / consequential actions feel weighty. Use the visualization-site's red/amber palette for danger. NO casual UI.
- **Acceptance criteria:**
  - No plaintext token values are visible anywhere in the UI.
  - Rotation flows are multi-step with explicit confirmation.
  - The "rotate master key" flow walks through the documented re-encrypt drill (per `token-storage.md`).

---

### S12. SLO dashboard

- **Route:** `/slos`
- **Tier:** 3
- **Purpose:** Detailed SLO view: target vs. current, error budget burn rate, history.
- **Read for context:**
  - `source/docs/sdlc/08-operations/slo-sli.md`
  - `source/docs/sdlc/08-operations/monitoring.md`
- **Data sources:** `/admin/slos`, `/admin/health` (for current values)
- **Layout:**
  - **Per-SLO card** (grid of 6+):
    - SLI name + target.
    - Current value (compared to target — green/amber/red).
    - 7-day or 30-day window trend (sparkline).
    - Error budget remaining / consumed (visual gauge).
- **Key UI elements:**
  - Each card visually unambiguous about pass/fail vs. target.
  - Sparklines bottom-aligned, axes hidden, target line shown.
- **Actions:** None — read-only.
- **Style notes:** Clean grid. Lots of whitespace.
- **Acceptance criteria:**
  - All SLOs from `slo-sli.md` are surfaced.
  - Pass/fail at-a-glance.

---

### S13. Capacity + cost

- **Route:** `/capacity`
- **Tier:** 3
- **Purpose:** Usage vs. configured limits; cost month-to-date.
- **Read for context:**
  - `source/docs/sdlc/15-capacity/current-limits.md`
  - `source/docs/sdlc/15-capacity/capacity-planning.md`
  - `source/docs/sdlc/16-cost/cost-model.md`
- **Data sources:** `/admin/capacity`, `/admin/cost/current`
- **Layout:**
  - **Capacity panel** (top): bars showing current vs. limit for: concurrent sessions, queue depth, audit chain length, DB connections, file descriptors.
  - **Cost panel** (bottom): current-month spend stacked bar (compute / DB / LLM / backup / misc), comparison to last month.
- **Style notes:** Use the cost-stack visualization (V17) as a style reference.
- **Acceptance criteria:**
  - Headroom is unmistakable.
  - Cost categories are color-coded consistently with the cost visualization.

---

### S14. DR control plane

- **Route:** `/dr`
- **Tier:** 3
- **Purpose:** Schedule + run DR drills; see drill history; check RTO/RPO compliance.
- **Read for context:**
  - `source/docs/sdlc/10-dr-bcp/dr-test-schedule.md`
  - `source/docs/sdlc/10-dr-bcp/recovery-objectives.md`
  - `source/docs/sdlc/10-dr-bcp/failover.md`
  - `source/docs/sdlc/10-dr-bcp/audit-chain-recovery.md`
- **Data sources:** `/admin/dr/drills`
- **Layout:**
  - **Schedule + history panel**: upcoming drills, last drill outcome, drill cadence (quarterly).
  - **Run drill** action: select scenario (Postgres restore / audit verifier / token rotation / host loss), confirm prerequisites, kick off.
  - **RTO/RPO compliance**: target vs. last-measured.
- **Style notes:** This is a low-frequency screen; design it more like a documentation dashboard than a live ops screen.
- **Acceptance criteria:**
  - Drill scheduling is straightforward.
  - Past-drill outcomes are scannable.

---

### S15. Settings / feature flags / config

- **Route:** `/settings`
- **Tier:** 3
- **Purpose:** Read-only view of current configuration + feature flag state. Operator-flippable flags get small inline controls (M11+).
- **Read for context:**
  - `source/docs/sdlc/09-deployment/secrets-provisioning.md`
  - `source/docs/sdlc/09-deployment/feature-flags.md`
  - `source/docs/sdlc/09-deployment/environments.md`
- **Data sources:** `/admin/feature-flags`, env-derived static values
- **Layout:**
  - **Config sections**:
    1. Environment (deployment tier, ports, transport mode)
    2. Feature flags (MILESTONE_4_ENABLED through MILESTONE_11_ENABLED)
    3. Provider configuration (Atlassian site URL, Bitbucket workspace — non-secret config only)
    4. Observability config (log level, tier)
- **Key UI elements:**
  - Feature flags: toggle controls with confirmation if flipping affects production paths.
  - Config values: read-only mono display.
- **Style notes:** Keep this minimal. Settings screens often bloat; the bar for adding to this screen is "the operator changes this in production."
- **Acceptance criteria:**
  - All milestone feature flags are visible.
  - Toggle confirmations make the operator think.

---

## Cross-cutting components

These appear on multiple screens. Design once + reuse.

### C1. Top navigation

- **Layout:** Fixed top bar, ~64px tall, full-width.
- **Left:** atl-mcp wordmark + version badge (mono small).
- **Center:** route nav — primary tabs (Dashboard / Projects / Jobs / Audit / Policy / Providers / Sessions / Alerts) with secondary dropdown for Tier 3 routes.
- **Right:** environment indicator (DEV / STAGING / PRODUCTION pill, tier-colored), operator badge (M11+), refresh-toggle.
- **Style:** mono nav labels, subtle hover, active-route underline.

### C2. Status indicator (small)

- 3-color dot (green / amber / red) + label + optional sub-line. Used in dashboard status strip, provider cards, etc.

### C3. Severity pill

- Used for alerts, audit outcomes, policy decisions, project states.
- Small inline pill (e.g., "P0 · audit chain") with severity-colored background + 1px border.

### C4. Stat block

- Mono label (small, all-caps, letter-spaced) over 32px display number with optional sub-text. Per the existing-visualization `ix-stat` style.

### C5. Approval card

- For pending policy decisions. Used in dashboard preview + dedicated approval inbox.
- Reasons list, confidence display, intent summary, approve/deny inline buttons.

### C6. Audit entry row

- Time / actor / operation / outcome / hash. Used in audit viewer + project detail audit tab + dashboard recent activity.

### C7. Confirmation modal

- For all destructive / consequential actions. Title + body + optional reason input (required for some actions) + Cancel / Confirm buttons. Confirm button styled with severity color matching the action (red for "Cancel job", amber for "Pause queue").

### C8. Empty / loading / error / refresh-stale states

- Empty: friendly explanation + suggested action.
- Loading: skeleton rows / blocks (not spinners — match the visualization-site's calm aesthetic).
- Error: red notice with retry; never destructive on retry.
- Stale: small "last updated 12s ago" indicator; updates as polling refreshes data.

---

## Style guide

(In addition to the design tokens already documented under "Existing visual language.")

### Voice + tone

- **Direct.** "Cancel job" not "Are you sure you want to cancel?"
- **Imperative for actions.** "Approve" / "Deny" / "Rotate token" / "Run drill".
- **Noun-phrase for views.** "Provisioning queue" / "Audit chain viewer".
- **No metaphors that aren't already in the docs.** Don't invent "shipping wizard" or "rocket launch" — use the established vocabulary.

### Density

- **Information-dense but breathing.** Per the visualization-site aesthetic. Cards have padding; lists have row-spacing; text has line-height 1.5+.
- **Pages can be scrollable.** Don't compress everything to fit one viewport. The dashboard is the exception (one viewport landing).

### Typography hierarchy

- H1 (page title): 32-40px, weight 600, letter-spacing -0.02em.
- H2 (section): 22-26px, weight 600.
- H3 (subsection): 16-18px, weight 600.
- Body: 14px, line-height 1.5.
- Mono: 11-12px for IDs / paths / counters.
- Eyebrow: 10.5-11px mono, all-caps, letter-spacing 1.4px, color tertiary ink.

### Iconography

- Custom 16px / 20px line-icons in monochrome. NO icon-font libraries (FontAwesome, etc.).
- Severity dots: 8-10px filled circles in the established palette.
- Minimal use; labels first, icons second.

### Animations

- Fade-ins on data arrival (200-300ms).
- Hover transitions on interactive elements (100-150ms).
- NO bouncy / playful animations. The aesthetic is calm.
- NO loading spinners (use skeleton blocks).

### Responsive behavior

- **Desktop-first.** Designed at 1440px-1920px viewports.
- **Graceful at 1024-1280px.** Some panels collapse from side-by-side to stacked.
- **Tablet (768-1024px):** acceptable but not optimized.
- **Mobile (<768px):** out of scope. A "best on desktop" notice is acceptable.

### Accessibility

- WCAG AA color contrast minimums (the established palette already targets this).
- Keyboard navigation: all actions reachable via tab; focus rings visible.
- Form labels explicit; placeholders are not labels.
- ARIA live regions for status indicators that change.

---

## Data states (empty / loading / error / populated)

For every data-fetching surface, design four states:

- **Empty.** No data exists yet. Friendly + suggestive (e.g., "No projects — use `project_intake_create` to create one").
- **Loading.** Initial load OR refresh. Skeleton blocks, not spinners.
- **Error.** Backend returned an error. Red notice + retry button + "what to try" guidance.
- **Stale.** Data exists but is older than expected (e.g., dashboard hasn't refreshed in > 60s). Small inline indicator: "last updated 1m ago — retry?"

Every screen with dynamic data should have all four documented.

---

## Output format expectations

For each screen, please deliver:

1. **An HTML/CSS prototype** at `<screen-id>.html` (e.g., `s01-dashboard.html`). Same approach as the visualization site — static HTML, no build step, reuses `styles.css` (extend as needed).
2. **A small note in each file** (top comment) describing what state is shown (e.g., "populated state with 3 alerts firing") and how to mock the other states.
3. **A shared `styles.css`** that extends the existing-visualization tokens with control-plane-specific tokens (data-table styles, modal styles, button variants, etc.).
4. **An `index.html`** that's the equivalent of the visualization-site index — a navigable map of the 15 screens + cross-cutting components, organized by tier, with thumbnails or descriptions per screen.
5. **A short `STYLE-NOTES.md`** documenting any new tokens / components added, plus interaction patterns (modal flows, multi-step confirmations) so a future dev can replicate them in a real implementation.

Bonus if you also produce:

- **Mock JSON fixtures** at `mocks/<endpoint>.json` showing expected shape + sample data — useful for hand-off to backend engineers writing the actual mgmt API.
- **A "screen flow" diagram** (mermaid or SVG) showing how operators move between screens during the top tasks (daily glance / approval / incident triage).

If you decide a layout / interaction pattern would serve better than I suggested, do that and explain in 1-2 sentences. The briefs are starting points, not constraints.

---

## What NOT to design

- **A real-time WebSocket implementation.** Polling is fine for v1; designs assume polling with sensible intervals.
- **Authentication flows beyond a stub.** Design with auth in mind (operator badge, session expiry indicator) but don't build sign-in / SSO flows.
- **Multi-tenant features.** Single-tenant only; no tenant-switching UI.
- **A general-purpose code editor.** Project profile editing happens via MCP tools, not the GUI.
- **A chat interface for build agents.** Build agents speak MCP, not the GUI.
- **Mobile-optimized layouts.** Desktop-first; mobile is out of scope.
- **Heavy analytics / BI dashboards.** SLO + cost dashboards are simple cards; not a Datadog clone.
- **Customer-facing branding.** This is internal-only; no marketing visuals.
- **A separate operator-onboarding flow.** The operator-guide doc is the onboarding; the GUI doesn't repeat it.
- **More than 15 screens.** If you find yourself wanting a 16th, consolidate.

---

## Quick reference: screen → source files

| # | Screen | Tier | Primary source files |
|---|---|---|---|
| S1 | Dashboard | 1 | `08-operations/runbook.md`, `slo-sli.md`, `alerting.md`, `monitoring.md`, `11-onboarding/operator-guide.md` |
| S2 | Project list | 1 | `05-data/domain-model.md`, `04-design/module-workflows.md`, `v6 §6` |
| S3 | Project detail | 1 | `04-design/module-workflows.md`, `06-security/policy-decision-layer.md`, `v6 §6 + §17` |
| S4 | Provisioning queue | 1 | `04-design/module-queue.md`, `module-workflows.md`, `v6 §24` |
| S5 | Audit chain viewer | 1 | `05-data/audit-trail.md`, `06-security/audit-chain-threat-model.md`, `adr/0005`, `10-dr-bcp/audit-chain-recovery.md` |
| S6 | Policy + approval | 1 | `06-security/policy-decision-layer.md`, `lethal-trifecta.md`, `v6 §38` |
| S7 | Provider health | 2 | `04-design/module-providers-atlassian.md`, `module-providers-vcs.md`, `module-preflight.md`, `08-operations/runbook.md` |
| S8 | MCP sessions | 2 | `04-design/module-mcp-runtime.md`, `api-mcp-tools.md`, `v6 §22 + §14` |
| S9 | Alerts + incidents | 2 | `08-operations/alerting.md`, `runbook.md`, `14-incidents/` |
| S10 | Migrations | 2 | `05-data/migrations.md`, `04-design/module-storage.md`, `adr/0001` |
| S11 | Secrets + rotation | 2 | `06-security/secrets-mgmt.md`, `token-storage.md`, `audit-chain-threat-model.md`, `08-operations/runbook.md` (Incident C) |
| S12 | SLO dashboard | 3 | `08-operations/slo-sli.md`, `monitoring.md` |
| S13 | Capacity + cost | 3 | `15-capacity/`, `16-cost/cost-model.md` |
| S14 | DR control plane | 3 | `10-dr-bcp/` |
| S15 | Settings | 3 | `09-deployment/secrets-provisioning.md`, `feature-flags.md`, `environments.md` |

---

## A note on prototype fidelity

Match the existing-visualization site's level of polish: hand-rendered HTML/CSS, IBM Plex everywhere, semantic palette consistent, designed-page feel. Don't generate a generic admin-template look (Material/Bootstrap admin); the project's identity is hand-crafted SVG figures + careful typography. The control plane is the same identity extended to interactive screens.

---

## Final note

The 15 screens are an upper bound; if some compress naturally (e.g., "Sessions" + "MCP runtime status" might be one screen), do that. The minimum viable shipped GUI is **Tier 1 (6 screens) + the cross-cutting components + index**. Tier 2 + 3 are progressive enhancement.

Take care with **S1 (Dashboard), S5 (Audit chain viewer), and S6 (Policy + approval)** — those are the highest-impact operator surfaces and deserve the most polish. S2 / S3 / S4 are workhorse screens; serviceable is enough.

If anything is ambiguous, default to the existing visualization site's design choices (open `source/existing-visualizations/index.html` and the four representative pages) — they're the most precise articulation of the design system.

Good luck.
