---
title: Documentation Catalog
owner: Chris
status: accepted
last_reviewed: 2026-04-26
version: 1.0.0
audience: [engineer, operator, integrator, auditor, executive]
---

# Documentation Catalog

> **What this is.** A complete index of all documentation, scripts, briefs, and live artifacts produced for atl-mcp. Use it as a navigation surface or as a record of "what was added when."
>
> **Volume summary:** 245 markdown files / ~250,000 words, 19 polished SVG visualizations, 1 navigable visualization site (21 HTML files), 1 live Jira project (63 issues), 1 live Confluence space (36 pages), 3 reusable Python scripts, and 2 comprehensive design briefs (visualization + control-plane GUI). Organized in 8 distinct surfaces, each documented below.
>
> **THIS FILE IS CANONICAL — KEEP IT CURRENT.** Any change that creates, removes, renames, or substantially modifies a documentation file (under `docs/`, `visualizations/`, `gui/`, `scripts/demo/`, or any future doc surface) MUST update this catalog in the same change. Update the relevant per-surface table, the top-level summary counts, the [embedded visualizations index](#embedded-visualizations-index) if a figure was added or removed, and the [persona-routed reading orders](#reading-orders-by-audience) if the change introduces a doc that should be in a persona's path. Don't queue updates for "later." Reinforced by the [`CLAUDE.md`](../CLAUDE.md) operating rule and the project's auto-memory feedback entry `feedback_keep_catalog_updated.md`. If you notice the catalog drifting during unrelated work, fix the local area you're touching back into alignment with reality.

---

## Table of contents

1. [Top-level summary](#top-level-summary)
2. [Surface 1 — Repo root + operating rules](#surface-1--repo-root--operating-rules)
3. [Surface 2 — Demo / portfolio mirror (`docs/demo/`)](#surface-2--demo--portfolio-mirror-docsdemo)
4. [Surface 3 — Enterprise SDLC tree (`docs/sdlc/`)](#surface-3--enterprise-sdlc-tree-docssdlc)
5. [Surface 4 — Visualization site (`docs/visualizations/`)](#surface-4--visualization-site-docsvisualizations)
6. [Surface 5 — Visualization brief (`visualizations/`)](#surface-5--visualization-brief-visualizations)
7. [Surface 6 — GUI brief (`gui/`)](#surface-6--gui-brief-gui)
8. [Surface 7 — Operator control plane prototype (`docs/control-plane/`)](#surface-7--operator-control-plane-prototype-docscontrol-plane)
9. [Surface 8 — Scripts (`scripts/demo/`)](#surface-8--scripts-scriptsdemo)
10. [Surface 9 — Live external artifacts](#surface-9--live-external-artifacts)
10. [Embedded visualizations index (which doc has which figure)](#embedded-visualizations-index)
11. [Memory + planning artifacts (out of repo)](#memory--planning-artifacts-out-of-repo)
12. [Reading orders by audience](#reading-orders-by-audience)

---

## Top-level summary

| Surface | Path | Files | Approx words / size | Purpose |
|---|---|---|---|---|
| 1 | repo root | 4 modified | — | Operating rules + project front door |
| 2 | `docs/demo/` | 17 markdown | ~28k words | Demo portfolio: tour scripts + centerpieces + Q&A vault |
| 3 | `docs/sdlc/` | 104 markdown | ~114k words | Enterprise SDLC across 17 numbered categories |
| 4 | `docs/visualizations/` | 21 (HTML + CSS + md) | ~280 KB | Static visualization site: index + 18 SVG figures |
| 5 | `visualizations/` | 114 files | ~135k words | Comprehensive Claude Design brief + source context bundle |
| 6 | `gui/` | 85 files | ~106k words | Claude Design brief for an operator control plane + source context |
| 7 | `docs/control-plane/` | 24 files (HTML + CSS + JSX + JSON + md) | ~276 KB | Static operator-control-plane prototype: 15 routable screens + sitemap |
| 8 | `scripts/demo/` | 3 Python | ~1k LOC | Idempotent seeders for live Atlassian + figure embedder |
| 9 | live | Jira PCO + Confluence ACO | 112 artifacts | Real Atlassian project provisioned during the demo execution |

**Aggregate:** 245 markdown files, 19 SVG visualizations (18 embedded into SDLC docs), 1 static visualization site (21 HTML files), 1 static control-plane prototype (24 files / 15 screens), ~280k words of authored prose, 1k LOC of Python tooling, 112 live Atlassian artifacts (76 Jira issues + 36 Confluence pages).

---

## Surface 1 — Repo root + operating rules

Files at the repo root, modified or created during the documentation pass.

| File | Status | Purpose |
|---|---|---|
| [`README.md`](../README.md) | modified | Added the dogfooding pitch + reviewer routing line + pointers to SDLC tree and visualization site |
| [`CLAUDE.md`](../CLAUDE.md) | modified | Removed the obsolete 200-line file rule (kept iron-law operating rules); added SDLC tree to the "When I need an answer" routing list |
| [`AGENTS.md`](../AGENTS.md) | modified | Added paragraph pointing at SDLC tree for discipline-organized docs |
| [`SECURITY.md`](../SECURITY.md) | created | Vulnerability disclosure stub pointing to canonical disclosure policy in SDLC tree |
| [`docs/documentation-catalog.md`](documentation-catalog.md) | created (this file) | The index you're reading |

---

## Surface 2 — Demo / portfolio mirror (`docs/demo/`)

The demo / reviewer surface. Mirrors the live Atlassian artifacts with markdown for skeptical readers who want to verify offline. **17 files / ~28k words.**

### Build plan + tour scripts

| File | Lines | What it is |
|---|---|---|
| [`docs/demo/interviewer-walkthrough.md`](demo/interviewer-walkthrough.md) | ~870 | Comprehensive build plan for the seed project (10 parts + appendices, with execution log appended after live execution) |
| [`docs/demo/README.md`](demo/README.md) | ~75 | Routing entry point (60s pitch verbatim + persona-routed entry points) |
| [`docs/demo/tour-60-seconds.md`](demo/tour-60-seconds.md) | ~50 | Verbatim 60-second pitch script |
| [`docs/demo/tour-5-minutes.md`](demo/tour-5-minutes.md) | ~85 | Sectioned 5-minute walkthrough script |
| [`docs/demo/tour-15-minutes.md`](demo/tour-15-minutes.md) | ~115 | Deep-dive 15-minute script with code-walk |

### Centerpieces (mirror Confluence pages)

| File | Lines | What it is |
|---|---|---|
| [`docs/demo/architecture.md`](demo/architecture.md) | ~210 | Architecture overview with mermaid system context + sequence + audit chain diagrams |
| [`docs/demo/runbook.md`](demo/runbook.md) | ~155 | Operational runbook with health checks + 3 documented incidents (A/B/C) |
| [`docs/demo/audit-remediation-summary.md`](demo/audit-remediation-summary.md) | ~140 | Self-critique: 15 audit findings + the embarrassing one in detail + what I'd do differently |

### Standalone (live only here)

| File | Lines | What it is |
|---|---|---|
| [`docs/demo/ai-honesty.md`](demo/ai-honesty.md) | ~155 | Designed / Orchestrated / Generated breakdown of how the project was built |
| [`docs/demo/qa-vault.md`](demo/qa-vault.md) | ~545 | 30 pre-prepared Q&A entries (provenance, scope, depth, taste, opinion, trivia, gotcha, level, forward) |
| [`docs/demo/security-posture.md`](demo/security-posture.md) | ~85 | One-page security summary: trust boundaries + sensitive data + STRIDE + known gaps |

### Index / navigation pages

| File | Lines | What it is |
|---|---|---|
| [`docs/demo/jira-work-items.md`](demo/jira-work-items.md) | ~115 | Index of the seeded PCO Jira project (8 epics + 5 flagships + ~50 fillers) |
| [`docs/demo/confluence-space-index.md`](demo/confluence-space-index.md) | ~85 | Index of the seeded ACO Confluence space (35-page IA) |
| [`docs/demo/roadmap.md`](demo/roadmap.md) | ~50 | Milestone status table (M0 → M11) |
| [`docs/demo/known-limitations.md`](demo/known-limitations.md) | ~65 | What this system explicitly does not do (with rationale) |
| [`docs/demo/glossary.md`](demo/glossary.md) | ~40 | Project-specific vocabulary (demo subset) |
| [`docs/demo/screenshots/README.md`](demo/screenshots/README.md) | ~115 | Capture spec for the 10 numbered screenshots (handoff to operator with a logged-in browser) |

---

## Surface 3 — Enterprise SDLC tree (`docs/sdlc/`)

The connective enterprise-SDLC documentation organized by discipline. **104 markdown files / ~114k words across 17 numbered categories + 8 templates.** Embeds 19 SVG figures across 18 docs (see [Embedded Visualizations Index](#embedded-visualizations-index)).

### Top-level

| File | Purpose |
|---|---|
| [`docs/sdlc/README.md`](sdlc/README.md) | TOC + persona routing + question-to-answer mapping + visualization-site link |
| [`docs/documentation-catalog.md`](documentation-catalog.md) | This catalog (above the SDLC tree at `docs/`) |
| [`docs/session-log-2026-04-26.md`](session-log-2026-04-26.md) | Comprehensive context-saving record of the 2026-04-26 documentation + demo build session — 16 arcs, files created / modified, live-state snapshot, pending items, reading order for resuming |
| [`docs/velocity-ops-port-plan.md`](velocity-ops-port-plan.md) | Build spec for atl-mcp's intake-to-handoff capability (M4–M9): a structured map of every artifact in `velocity-ops-engine` worth lifting (10 lifecycle phases, 68 templates, 13 agent role cards, 19 workflows, 38 stack modules, hardened quality-gate stack) plus the per-milestone implementation sequence |
| [`docs/velocity-ops-content/`](velocity-ops-content/) | Lifted prose from `velocity-ops-engine` consumed by atl-mcp's M4–M9 tools at runtime: 6 phases, 16 templates, 13 agent role cards, 7 workflows. The TypeScript registry that exposes this catalog lives at [`src/velocity/contentRegistry.ts`](../src/velocity/contentRegistry.ts); the synthesis prompt scaffold lives at [`src/velocity/promptScaffold.ts`](../src/velocity/promptScaffold.ts); operator browsing is via the `admin.velocity.*` MCP tools. |
| [`docs/velocity-ops-port-status.md`](velocity-ops-port-status.md) | Living status report for the velocity-ops port plan. All 7 phases tested-and-shipped: Phase 0 foundations, Phase 1 M4 intake/blueprint, Phase 2 M5 planner, Phase 3 M6a Jira executor, Phase 4 M6b Confluence executor, Phase 5 M6c VCS scaffolder, Phase 6 M7+M9 handoff, Phase 7 conformance rubric + security scan. |
| [`docs/conformance/rubric.md`](conformance/rubric.md) | M11 conformance rubric for atl-mcp. 6-category 0–5 scoring framework adapted from `velocity-ops-engine/benchmarks/rubric.md`; categories rewritten for MCP-server behavior (protocol compliance, tool correctness, audit evidence, policy gating, data-limited honesty, idempotency + failure handling). Source preserved at `docs/conformance/rubric-source.md`. |

### Per-category

| Category | Files | What's covered |
|---|---|---|
| [`01-charter/`](sdlc/01-charter/) | 3 | Vision, product strategy, non-goals |
| [`02-architecture/`](sdlc/02-architecture/) | 5 | C4-L1 system context (README), C4-L2 containers, dataflow, trust boundaries, tradeoffs |
| [`03-requirements/`](sdlc/03-requirements/) | 6 | Functional + 4 NFR docs (availability, performance, security, scalability) + compliance scope |
| [`04-design/`](sdlc/04-design/) | 13 | 10 module HLD/LLD docs + 2 API specs (MCP tools + mgmt REST) + 8 sequence diagrams in one doc |
| [`05-data/`](sdlc/05-data/) | 6 | Schema (with ER diagram), domain model, retention, classification, migrations, audit trail |
| [`06-security/`](sdlc/06-security/) | 9 | Parent threat model + 7 component threat models + lethal trifecta + vulnerability disclosure |
| [`07-testing/`](sdlc/07-testing/) | 7 | Strategy + 6 plan docs (unit / integration / E2E / perf / security / eval-view) |
| [`08-operations/`](sdlc/08-operations/) | 6 | Runbook + SLO/SLI + monitoring + alerting + on-call playbook + observability stack |
| [`09-deployment/`](sdlc/09-deployment/) | 6 | CI/CD + release process + environments + feature flags + deployment targets + secrets provisioning |
| [`10-dr-bcp/`](sdlc/10-dr-bcp/) | 5 | Backup strategy + recovery objectives + failover + audit chain recovery + DR test schedule |
| [`11-onboarding/`](sdlc/11-onboarding/) | 5 | Developer setup + integrator guide + operator guide + partner onboarding + glossary quick-ref |
| [`12-governance/`](sdlc/12-governance/) | 5 | ADR process + change management + decision log + code review + DoR/DoD |
| [`13-quality/`](sdlc/13-quality/) | 4 | Code style + iron laws + anti-slop + quality gates |
| [`14-incidents/`](sdlc/14-incidents/) | 5 | Postmortem template + failure-mode taxonomy + fix-type taxonomy + incident library + blameless review |
| [`15-capacity/`](sdlc/15-capacity/) | 4 | Current limits + capacity planning + benchmarks (framework) + load-test runbook |
| [`16-cost/`](sdlc/16-cost/) | 3 | Cost model + FinOps + SaaS pricing runway |
| [`17-glossary/`](sdlc/17-glossary/) | 2 | Cross-cutting glossary + domain vocabulary |
| [`templates/`](sdlc/templates/) | 8 | ADR / runbook / postmortem / threat-model / sequence-diagram / module-design / perf-test / security-test |

Per-doc detail in each subdirectory's README or by direct browse.

---

## Surface 4 — Visualization site (`docs/visualizations/`)

A static HTML site with 18 polished SVG figures + an index. Generated by Claude Design from the brief in `visualizations/`, then embedded back into SDLC docs via `scripts/demo/embed-visualizations.py`. **21 files / ~280 KB.**

### Site files

| File | Purpose |
|---|---|
| [`docs/visualizations/index.html`](visualizations/index.html) | Tiered visualization plan (3 tiers, 18 cards), each linking to a finished figure |
| [`docs/visualizations/styles.css`](visualizations/styles.css) | Shared semantic-palette stylesheet (276 lines; IBM Plex Sans/Mono) |
| [`docs/visualizations/README.md`](visualizations/README.md) | Site README with path-mapping (claude-design vs. actual SDLC paths) |

### 18 visualization pages

Each page contains: the SVG figure, a caption (in the project voice), an insertion instruction (where it goes), and design notes.

| ID | File | Tier | Embedded into |
|---|---|---|---|
| V1 | [`v01-audit-chain-construction.html`](visualizations/v01-audit-chain-construction.html) | 1 | `06-security/audit-chain-threat-model.md` |
| V2 | [`v02-lethal-trifecta.html`](visualizations/v02-lethal-trifecta.html) | 1 | `06-security/lethal-trifecta.md` |
| V3 | [`v03-test-pyramid.html`](visualizations/v03-test-pyramid.html) | 1 | `07-testing/strategy.md` |
| V4 | [`v04-milestone-gantt.html`](visualizations/v04-milestone-gantt.html) | 1 | `01-charter/product-strategy.md` |
| V5 | [`v05-token-envelope.html`](visualizations/v05-token-envelope.html) | 1 | `06-security/token-storage.md` |
| V6 | [`v06-observability-pillars.html`](visualizations/v06-observability-pillars.html) | 1 | `08-operations/observability-stack.md` |
| V7 | [`v07-stride-matrix.html`](visualizations/v07-stride-matrix.html) | 2 | `06-security/threat-model.md` |
| V8 | [`v08-failure-ishikawa.html`](visualizations/v08-failure-ishikawa.html) | 2 | `14-incidents/failure-mode-taxonomy.md` |
| V9 | [`v09-failure-fix-matrix.html`](visualizations/v09-failure-fix-matrix.html) | 2 | `14-incidents/fix-type-taxonomy.md` |
| V10 | [`v10-key-rotation.html`](visualizations/v10-key-rotation.html) | 2 | `06-security/audit-chain-threat-model.md` |
| V11 | [`v11-token-budget.html`](visualizations/v11-token-budget.html) | 2 | `04-design/module-context.md` |
| V12 | [`v12-provider-class.html`](visualizations/v12-provider-class.html) | 2 | `04-design/module-providers-vcs.md` |
| V13 | [`v13-onboarding-tree.html`](visualizations/v13-onboarding-tree.html) | 2 | `11-onboarding/README.md` (new file) |
| V14 | [`v14-dr-tree.html`](visualizations/v14-dr-tree.html) | 3 | `10-dr-bcp/failover.md` |
| V15a/b | [`v15-c4-l3.html`](visualizations/v15-c4-l3.html) | 3 | `04-design/module-storage.md` + `module-security.md` (split) |
| V16 | [`v16-role-map.html`](visualizations/v16-role-map.html) | 3 | `01-charter/README.md` |
| V17 | [`v17-cost-stack.html`](visualizations/v17-cost-stack.html) | 3 | `16-cost/cost-model.md` |
| V18 | [`v18-adr-graph.html`](visualizations/v18-adr-graph.html) | 3 | `12-governance/decision-log.md` |

To view: open `docs/visualizations/index.html` in a browser, or `python -m http.server --directory docs/visualizations`.

---

## Surface 5 — Visualization brief (`visualizations/`)

The comprehensive Claude Design brief that produced Surface 4, plus the source bundle that grounded the design. **114 files / ~135k words.**

| Path | Purpose |
|---|---|
| [`visualizations/README.md`](../visualizations/README.md) | The Claude Design brief (688 lines / ~7k words) — 18 visualization specifications with style guide, source-file references, format suggestions, acceptance criteria |
| [`visualizations/source/`](../visualizations/) | The context bundle: full SDLC tree (subset) + 6 ADRs + repo orientation + v6 spec excerpts (~17.6k words). Mirrors the source repo structure for relative-path stability. |
| [`visualizations/source/v6-spec-excerpts.md`](../visualizations/source/v6-spec-excerpts.md) | ~1,800 lines of v6 spec sections most relevant to the visualizations |

This bundle is the input to Claude Design; Surface 4 is the output.

---

## Surface 6 — GUI brief (`gui/`)

The comprehensive Claude Design brief for an operator-facing status monitor / control plane (15 screens). **85 files / ~106k words.**

| Path | Purpose |
|---|---|
| [`gui/README.md`](../gui/README.md) | The Claude Design brief (938 lines / ~7.4k words) — 15 screen briefs across 3 tiers, cross-cutting components, style guide, API surface, data states, output expectations |
| [`gui/source/`](../gui/) | The context bundle: 11 SDLC categories (subset focused on operations + design + security + DR), 6 ADRs, repo orientation, v6 spec excerpts (~12k words), and 6 representative visualization pages as style anchors |
| [`gui/source/v6-spec-excerpts.md`](../gui/source/v6-spec-excerpts.md) | ~1,400 lines of v6 spec sections most relevant for the control plane |
| [`gui/source/existing-visualizations/`](../gui/source/existing-visualizations/) | 4 representative viz pages + index + styles, as the design-system anchor for Claude Design to extend |

The brief assumes M11+ admin REST endpoints (most don't exist yet); the GUI design implicitly specs the API contract.

---

## Surface 7 — Operator control plane (`docs/control-plane/`)

A static, no-build-step operator control plane produced by Claude Design and **wired to live data** per [`docs/adr/0006-operator-control-plane-admin-mcp-tools.md`](adr/0006-operator-control-plane-admin-mcp-tools.md). React 18 + Babel-standalone, hash-routed, light-only. The orchestrator co-hosts the UI on the loopback mgmt port (`127.0.0.1:3001/ui/`) and exposes ~35 `admin.*` MCP tools on a parallel loopback `/mcp` transport that the UI consumes via JSON-RPC. Every page calls real admin tools through `useAdmin(toolName, args)` (`use-admin.jsx`); the previous `data.js`/`mocks/` fixture has been deleted. Backends not yet implemented (alerting layer, SLO computation, capacity cost, DR scheduler, lethal-trifecta detector, secrets rotation execution, provider rate-limit headroom) return real but minimal data with explicit `dataLimited.reason` strings that the UI renders as visible "data limited" badges. **No fake values anywhere.**

### Site files

| File | Purpose |
|---|---|
| [`docs/control-plane/index.html`](control-plane/index.html) | Entry point — loads React/Babel UMD, mounts `<App>`, hash-route table to all 15 screens |
| [`docs/control-plane/base-styles.css`](control-plane/base-styles.css) | Paper-warm root tokens (byte-identical to `docs/visualizations/styles.css` — same design system) |
| [`docs/control-plane/app.css`](control-plane/app.css) | Control-plane-specific styles (TopNav, status strip, SLO cards, drawer/modal/approval card patterns, screen-flow SVG) |
| [`docs/control-plane/data.js`](control-plane/data.js) | `window.MOCK` fixture — 14 projects, 14 jobs, 32 audit entries, 6 SLOs, 3 pending approvals, 2 firing alerts |
| [`docs/control-plane/STYLE-NOTES.md`](control-plane/STYLE-NOTES.md) | Token table, component inventory, interaction patterns, mock-fixture endpoint mapping, scope exclusions |

### Component + tweaks layer

| File | Purpose |
|---|---|
| [`docs/control-plane/components.jsx`](control-plane/components.jsx) | TopNav, PageHead, StatusDot, Pill, StatePill, OutcomePill, Sparkline, Modal, Drawer, JsonView, ConfirmModal, `useHashRoute`, `useTick`, `navigate` |
| [`docs/control-plane/tweaks-panel.jsx`](control-plane/tweaks-panel.jsx) | `CPTweaksProvider` + bottom-right Tweaks dock (env switcher, polling pause/interval, scenario simulators, layout toggles) |
| [`docs/control-plane/app-tweaks.jsx`](control-plane/app-tweaks.jsx) | Tweak defaults (env, polling interval, operator badge, scenario flags) |

### 15 screens across 3 tiers

Each page file routes via `#/<path>`. T1 = must-have, T2 = important, T3 = polish.

| ID | Tier | Hash route | File | Purpose |
|---|---|---|---|---|
| S1 | 1 | `#/` | [`page-dashboard.jsx`](control-plane/page-dashboard.jsx) | Status strip · 4 stat blocks · 6-SLO grid · alerts panel · approvals preview · recent audit |
| S2 | 1 | `#/projects` | [`page-projects.jsx`](control-plane/page-projects.jsx) | Project list — 13-state filter, readiness grades A–F, dense table |
| S3 | 1 | `#/projects/:key` | [`page-projects.jsx`](control-plane/page-projects.jsx) | Project detail — 6 tabs incl. blueprint JSON + state-machine SVG with allowed-next |
| S4 | 1 | `#/jobs` | [`page-jobs-policy.jsx`](control-plane/page-jobs-policy.jsx) | Provisioning queue · job-detail drawer · cancel/retry/pause-queue with confirms |
| S5 | 1 | `#/audit` | [`page-audit.jsx`](control-plane/page-audit.jsx) | Audit chain viewer — integrity banner · time/outcome filters · chain-linkage SVG |
| S6 | 1 | `#/policy` | [`page-jobs-policy.jsx`](control-plane/page-jobs-policy.jsx) | Approval inbox · reasons list · confidence gauge · diff preview · lethal-trifecta badge |
| S7 | 2 | `#/providers` | [`page-tier23.jsx`](control-plane/page-tier23.jsx) | Provider health — rate-limit gauges, failure sparks |
| S8 | 2 | `#/sessions` | [`page-tier23.jsx`](control-plane/page-tier23.jsx) | MCP sessions — TTL warnings, terminate flow |
| S9 | 2 | `#/alerts` | [`page-tier23.jsx`](control-plane/page-tier23.jsx) | Alerts list with linked-runbook detail panel + acknowledge |
| S10 | 2 | `#/migrations` | [`page-tier23.jsx`](control-plane/page-tier23.jsx) | Schema migrations — rehearsal → apply gating |
| S11 | 2 | `#/secrets` | [`page-tier23.jsx`](control-plane/page-tier23.jsx) | Secrets — multi-step master-key + audit-key rotation drills |
| S12 | 3 | `#/slo` | [`page-tier23.jsx`](control-plane/page-tier23.jsx) | SLO grid with error-budget burn |
| S13 | 3 | `#/capacity` | [`page-tier23.jsx`](control-plane/page-tier23.jsx) | Capacity + cost stack-bar |
| S14 | 3 | `#/dr` | [`page-tier23.jsx`](control-plane/page-tier23.jsx) | DR drill scheduler with RTO/RPO panel |
| S15 | 3 | `#/settings` | [`page-tier23.jsx`](control-plane/page-tier23.jsx) | Env config + milestone feature flags |
| —  | — | `#/index` | [`page-index.jsx`](control-plane/page-index.jsx) | Sitemap + 1200×520 SVG screen-flow diagram (T1 primary edges, T2/T3 dashed drill-downs) |

### Mock fixtures

`docs/control-plane/mocks/*.json` — 10 representative response shapes for the backend API contract. The prototype reads from `data.js` for convenience; these files exist as a hand-off artifact for backend engineers.

| File | Endpoint |
|---|---|
| [`mocks/health.json`](control-plane/mocks/health.json) | `GET /api/v1/system/health` |
| [`mocks/projects.json`](control-plane/mocks/projects.json) | `GET /api/v1/projects` |
| [`mocks/jobs.json`](control-plane/mocks/jobs.json) | `GET /api/v1/jobs` |
| [`mocks/audit.json`](control-plane/mocks/audit.json) | `GET /api/v1/audit/entries?limit=50` |
| [`mocks/approvals.json`](control-plane/mocks/approvals.json) | `GET /api/v1/policy/approvals?state=pending` |
| [`mocks/providers.json`](control-plane/mocks/providers.json) | `GET /api/v1/providers` |
| [`mocks/sessions.json`](control-plane/mocks/sessions.json) | `GET /api/v1/sessions` |
| [`mocks/alerts.json`](control-plane/mocks/alerts.json) | `GET /api/v1/alerts` |
| [`mocks/migrations.json`](control-plane/mocks/migrations.json) | `GET /api/v1/migrations` |
| [`mocks/secrets.json`](control-plane/mocks/secrets.json) | `GET /api/v1/secrets` (metadata only) |

To view: open `docs/control-plane/index.html` in a browser, or `python -m http.server --directory docs/control-plane`. The prototype is the rendered output of the Surface 6 brief.

---

## Surface 8 — Scripts (`scripts/demo/`)

Idempotent Python tooling for provisioning + embedding. **3 files / ~1k LOC.**

| File | Purpose |
|---|---|
| [`scripts/demo/seed-jira.py`](../scripts/demo/seed-jira.py) | Seeds the PCO Jira project — 8 epics + 5 flagship stories + ~50 filler tickets. Idempotent: skips issues that already exist by summary. ~720 LOC. |
| [`scripts/demo/seed-confluence.py`](../scripts/demo/seed-confluence.py) | Seeds the ACO Confluence space — 35 pages organized in the IA from the demo build plan. Idempotent: skips pages that already exist by title. ~1,000 LOC including page content. |
| [`scripts/demo/embed-visualizations.py`](../scripts/demo/embed-visualizations.py) | Extracts SVGs / HTML stages / mermaid blocks from each `docs/visualizations/v*.html` and embeds them into the corresponding SDLC markdown doc as `<figure>` blocks. Idempotent: detects existing figures and skips. ~270 LOC. |

All three accept `--dry-run` (or `dry_run` mode) where applicable. Re-running is safe.

---

## Surface 9 — Live external artifacts

Provisioned during the demo execution against `lateapexllc.atlassian.net`. Not files in the repo, but referenced extensively from the demo and SDLC trees.

### Jira project: `PCO` (Project Context Orchestrator)

- **URL:** https://lateapexllc.atlassian.net/jira/software/projects/PCO/boards/1
- **Volume:** 76 issues
  - 8 epics (PCO-1 → PCO-8)
  - 5 flagship stories at production depth (PCO-9 → PCO-13)
  - 50 filler tickets (PCO-14 → PCO-63)
  - **13 subtasks** under flagships (PCO-64 → PCO-76) showing implementation breakdown
- **Hierarchy:** true 3-level Epic → Task → Subtask. 100% parent linkage (no orphans).
- **Components:** 10 (mapping `src/` directory layout)
- **Style:** team-managed (next-gen) Software Kanban
- **Created by:** [`scripts/demo/seed-jira.py`](../scripts/demo/seed-jira.py) — idempotent; re-running adds only new issues.

### Confluence space: `ACO` (Agent Context Orchestrator)

- **URL:** https://lateapexllc.atlassian.net/wiki/spaces/ACO
- **Volume:** 36 pages (homepage + 35 IA pages)
- **Structure:** 8-section information architecture per the demo build plan
- **3 centerpiece pages:** Architecture Overview · Operational Runbook · Audit Findings + Remediation Summary (the most-likely-to-be-read pages)
- **Created by:** [`scripts/demo/seed-confluence.py`](../scripts/demo/seed-confluence.py)

These artifacts are the "dogfooding payoff" — atl-mcp's own seed structure provisioned by the orchestrator's own (simulated) executor.

---

## Embedded visualizations index

Which SDLC doc carries which figure (after the embed pass).

| Doc | Figure(s) | Anchor |
|---|---|---|
| `docs/sdlc/06-security/audit-chain-threat-model.md` | V1 (chain construction) + V10 (key rotation) | after `## Entry shape (recap)` and `## Key rotation procedure` |
| `docs/sdlc/06-security/lethal-trifecta.md` | V2 | after `## What is the lethal trifecta` |
| `docs/sdlc/07-testing/strategy.md` | V3 (test pyramid) | after `## Test categories` |
| `docs/sdlc/01-charter/product-strategy.md` | V4 (milestone Gantt) | after `## The validating moment` |
| `docs/sdlc/06-security/token-storage.md` | V5 (envelope encryption) | after `## Cryptographic primitives` |
| `docs/sdlc/08-operations/observability-stack.md` | V6 (3-pillar observability) | after `## The four streams` |
| `docs/sdlc/06-security/threat-model.md` | V7 (STRIDE matrix) | after `## Summary table` |
| `docs/sdlc/14-incidents/failure-mode-taxonomy.md` | V8 (Ishikawa) | after `## Categories` |
| `docs/sdlc/14-incidents/fix-type-taxonomy.md` | V9 (failure→fix matrix) | after `## How fix-type interacts with failure-mode` |
| `docs/sdlc/04-design/module-context.md` | V11 (token budget bars) | after `## Token budgeting (v6 §16.1)` |
| `docs/sdlc/04-design/module-providers-vcs.md` | V12 (provider class diagram) | after `## Architecture` |
| `docs/sdlc/11-onboarding/README.md` | V13 (onboarding decision tree) | new file (V13 is the page's centerpiece) |
| `docs/sdlc/10-dr-bcp/failover.md` | V14 (DR scenario tree) | after `## Failover scenarios` |
| `docs/sdlc/04-design/module-storage.md` | V15a (C4-L3 storage) | after `## Architecture` |
| `docs/sdlc/04-design/module-security.md` | V15b (C4-L3 security) | after `## Architecture` |
| `docs/sdlc/01-charter/README.md` | V16 (role map) | after `## Users` |
| `docs/sdlc/16-cost/cost-model.md` | V17 (cost stacked bar) | after `## Total monthly cost at v1 scale` |
| `docs/sdlc/12-governance/decision-log.md` | V18 (ADR dependency graph) | after `## ADR index` |

Total: **18 SDLC docs carry 19 figures** (`audit-chain-threat-model.md` carries V1 + V10).

---

## Memory + planning artifacts (out of repo)

Per the auto-memory system. Not committed to the repo; persists across Claude Code sessions.

| Path | Type | Purpose |
|---|---|---|
| `~/.claude/projects/C--Users-Chris-Documents-git-atl-mcp/memory/MEMORY.md` | index | Top-level index of memory entries (auto-loaded into Claude conversations) |
| `~/.claude/projects/C--Users-Chris-Documents-git-atl-mcp/memory/feedback_verify_inability_before_handoff.md` | feedback | "Actually attempt a task and let it fail before telling the operator to do it manually" |
| `~/.claude/projects/C--Users-Chris-Documents-git-atl-mcp/memory/feedback_check_env_before_assuming_no_access.md` | feedback | "Don't infer access only from the deferred-tool list — check `.env`, env vars, and config files first" (added after the early Atlassian-access mistake during demo execution) |
| `~/.claude/plans/generate-a-comprehensive-plan-wobbly-scroll.md` | plan | The approved plan for the comprehensive SDLC documentation pass — referenced from the SDLC tree's execution log |

---

## Reading orders by audience

Pick the path for your role.

### Reviewer / evaluator (90 sec)

1. [`docs/demo/README.md`](demo/README.md) — entry point with the 60s pitch verbatim
2. [`docs/demo/audit-remediation-summary.md`](demo/audit-remediation-summary.md) — the most-signal-dense self-critique page
3. [`docs/visualizations/index.html`](visualizations/index.html) — open in browser; click through the 18 figures

Total: under 5 minutes if you skim the figures.

### Auditor / customer security reviewer (10 minutes)

1. [`docs/sdlc/README.md`](sdlc/README.md) — TOC + persona routing
2. [`docs/sdlc/06-security/threat-model.md`](sdlc/06-security/threat-model.md) — STRIDE per trust boundary (with embedded V7 matrix)
3. [`docs/sdlc/06-security/controls-matrix.md`](sdlc/06-security/controls-matrix.md) — threats × controls × tests
4. [`docs/sdlc/06-security/audit-chain-threat-model.md`](sdlc/06-security/audit-chain-threat-model.md) — the security spine (with embedded V1 + V10)
5. [`docs/sdlc/03-requirements/compliance-scope.md`](sdlc/03-requirements/compliance-scope.md) — applicability statement
6. [`docs/sdlc/06-security/vulnerability-disclosure.md`](sdlc/06-security/vulnerability-disclosure.md) — disclosure process

### On-call / operator (15 minutes)

1. [`docs/sdlc/08-operations/runbook.md`](sdlc/08-operations/runbook.md) — symptom-organized runbook
2. [`docs/sdlc/08-operations/alerting.md`](sdlc/08-operations/alerting.md) — alert → diagnosis → runbook map
3. [`docs/sdlc/08-operations/slo-sli.md`](sdlc/08-operations/slo-sli.md) — targets
4. [`docs/sdlc/11-onboarding/operator-guide.md`](sdlc/11-onboarding/operator-guide.md) — operator persona guide
5. [`docs/sdlc/10-dr-bcp/failover.md`](sdlc/10-dr-bcp/failover.md) — DR procedures (with embedded V14 decision tree)
6. [`docs/control-plane/index.html`](control-plane/index.html) — operator control plane prototype; open in browser, start at the dashboard or `#/index` for the sitemap

### New engineer joining the project (1 hour)

1. [`README.md`](../README.md) — project front door
2. [`CLAUDE.md`](../CLAUDE.md) — operating rules
3. [`docs/sdlc/02-architecture/README.md`](sdlc/02-architecture/README.md) — C4-L1 system context
4. [`docs/sdlc/11-onboarding/developer-setup.md`](sdlc/11-onboarding/developer-setup.md) — clone + install + test
5. [`docs/sdlc/13-quality/iron-laws.md`](sdlc/13-quality/iron-laws.md) — non-negotiable discipline
6. The relevant `04-design/module-*.md` for whichever component you're touching

### Integrator (MCP host builder) (30 minutes)

1. [`docs/sdlc/11-onboarding/integrator-guide.md`](sdlc/11-onboarding/integrator-guide.md) — how to consume atl-mcp
2. [`docs/sdlc/04-design/api-mcp-tools.md`](sdlc/04-design/api-mcp-tools.md) — full tool catalog
3. [`docs/sdlc/04-design/module-mcp-runtime.md`](sdlc/04-design/module-mcp-runtime.md) — transport + capability negotiation
4. [`docs/sdlc/04-design/sequence-diagrams.md`](sdlc/04-design/sequence-diagrams.md) — 8 mermaid sequences

### Executive / sponsor (5 minutes)

1. [`docs/sdlc/01-charter/README.md`](sdlc/01-charter/README.md) — vision + scope + non-goals (with embedded V16 role map)
2. [`docs/sdlc/01-charter/product-strategy.md`](sdlc/01-charter/product-strategy.md) — the bet (with embedded V4 milestone Gantt)
3. [`docs/sdlc/16-cost/cost-model.md`](sdlc/16-cost/cost-model.md) — what it costs (with embedded V17)

### Future maintainer (catalog reader)

You're here. Continue with whichever surface fits the question you have.

---

*Last reviewed: 2026-04-26 by Chris.*
