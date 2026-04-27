# STYLE-NOTES — atl-mcp operator control plane

This document records the design choices behind the prototype so the eventual
implementer can carry them forward without re-deriving the rules.

Canonical SDLC-level UI documentation now lives in
[`docs/sdlc/04-design/control-plane-ui/`](../sdlc/04-design/control-plane-ui/).
Keep this file as prototype-local implementation notes; update the SDLC docs
when routes, data contracts, page purpose, or governance rules change.

## Aesthetic direction

The control plane extends the **existing visualization-site language**: paper-warm
background (`#faf9f6`), IBM Plex Sans + Plex Mono, semantic palette
(`status-done` / `status-active` / `sev-p0` / `sev-p1`), 1px hairlines, and
hand-laid pages. It is explicitly **not** a generic admin template (no Tailwind
slop, no Material Design, no purple-and-teal SaaS gradients).

Every screen begins from `<PageHead>` (eyebrow + 32px title + meta-block strip)
and `<cp-section-head>` (numbered section markers with right-aligned blurb).
This rhythm keeps 15 different surfaces visually coherent without trapping them
in a grid template.

## Type

| Role            | Family       | Size  | Weight | Notes |
|-----------------|--------------|-------|--------|-------|
| Page title      | Plex Sans    | 32px  | 600    | -0.02em tracking, hairline-bottom rule |
| Section title   | Plex Sans    | 18px  | 600    | -0.005em tracking |
| Body            | Plex Sans    | 13px  | 400    | 1.55 line-height |
| Eyebrow / labels| Plex Mono    | 10.5–11px | 500 | uppercase, 0.12–0.14em tracking |
| Tabular data    | Plex Mono    | 11.5–12.5px | 400 | tabular-nums on numeric cells |
| Hero stat       | Plex Sans    | 32px  | 600    | tabular-nums, -0.02em tracking |

Mono is load-bearing — IDs, hashes, timestamps, env config, JSON, and any value
the operator might copy/paste are all mono. This is the single biggest reason
the surface reads as "infra console" rather than "marketing dashboard".

## Color

Used sparingly. The page body is paper; surfaces are white; rules are
soft (`var(--line)`) by default and strong (`var(--line-strong)`) when an
element needs to claim a hierarchical level.

| Token            | Use |
|------------------|-----|
| `--status-done`  | green dots, pass states, low-burn SLOs, "allow" outcomes |
| `--status-active`| amber dots, in-progress jobs, P1 alerts |
| `--sev-p0`       | P0 alerts, drift, validation failed, lethal-trifecta flag |
| `--sev-p1`       | P1 alerts, stale tokens, rate-limit pressure |
| `--sev-info`     | informational (rare — used in pills only) |

Severity is **always** indicated by both color and label. No color-only signals.

## Spacing

- Page padding: `40px 48px 96px` for narrow pages, max-width `1320px`. Wide
  pages (project list, audit, providers, sessions, alerts, migrations) use
  `1480px`.
- Section gap: `32px` between sibling section heads.
- Card padding: `16–20px` interior, `24px` for hero cards.
- Table cells: `10px 14px` for headers, `12px 14px` for rows.
- All borders are 1px. We don't escalate to 2px except for the two semantic
  cases: active tab underline, and selected-row accent.

## Components

Defined once in `components.jsx` and `app.css`, used everywhere:

| Component        | File              | Purpose |
|------------------|-------------------|---------|
| `<TopNav>`       | components.jsx    | Sticky top bar; reads tweaks state for env pill / polling / operator |
| `<PageHead>`     | components.jsx    | Eyebrow + title + meta-block right rail |
| `<StatusDot>`    | components.jsx    | Tri-color dot with optional pulsing ring |
| `<Pill>`         | components.jsx    | Severity / state / outcome pills |
| `<StatePill>`    | components.jsx    | Project state machine variant (semantic mapping) |
| `<Sparkline>`    | components.jsx    | 100×28 trend line, optional target line |
| `<Modal>`        | components.jsx    | Veil + card + footer |
| `<ConfirmModal>` | components.jsx    | Modal with required reason field for audited writes |
| `<Drawer>`       | components.jsx    | Right-edge slide-in detail panel |
| `<JsonView>`     | components.jsx    | Monochrome syntax-highlighted JSON |
| `<TweaksPanel>`  | tweaks-panel.jsx  | Tweak controls; designer/PM-controllable simulators |

## Interaction patterns

- **Reads are cheap, writes are gated.** Every mutating action (approve, deny,
  cancel job, rotate token, apply migration, terminate session, toggle flag)
  goes through `<ConfirmModal>` with a required reason field that is recorded
  in the audit chain.
- **Polling is visible.** The TopNav refresh toggle shows `auto · 30s · {age}s`
  so the operator always knows how stale the view is. Pause toggles to
  `paused`. Both states persist in the tweaks panel.
- **Drill-downs use drawers, not new pages.** Job detail, audit detail,
  approval detail all open as right-side drawers. This keeps context (the
  list view stays visible behind the veil) and keeps URL state simple.
- **Multi-step operations have explicit progress.** Master key rotation and
  audit-key rotation render as numbered drills with a step bar; the operator
  cannot skip steps. The whole drill is dismissable with "Abort drill" to
  avoid trapping the operator.

## Tweaks (in-prototype state simulation)

The Tweaks panel is exposed via the standard host protocol so PMs and
designers can simulate operator-facing scenarios without code changes:

- **Environment** — switch the env pill between `dev` / `staging` / `production`
- **Polling** — pause auto-refresh, change interval (5–120s)
- **State simulators** — toggle a P0 audit-chain breach, a degraded Bitbucket
  provider, or a 5-alert storm to validate dense states
- **Layout** — show / hide the screen-flow diagram on the index

Defaults live inline in `app-tweaks.jsx` between `EDITMODE-BEGIN` /
`EDITMODE-END` markers; toggles persist to disk via the host.

## Admin tool surface (ADR 0006)

The prototype is wired to the orchestrator's loopback admin MCP transport at
`http://127.0.0.1:3001/mcp`. The UI is an MCP client (`mcp-client.js`); each
page calls one or more `admin.*` tools via the `useAdmin(toolName, args)`
React hook (`use-admin.jsx`).

The complete tool registry lives in `src/mcp/admin/registry.ts`. Reads are
polled every 30s (configurable in the Tweaks panel, pause-able). Writes are
gated by `<ConfirmModal>` and emit a signed audit chain entry through the
existing audit signer pattern (`src/security/auditChain.ts`).

| Screen | Reads | Writes |
|---|---|---|
| S1 Dashboard | `admin.health.get`, `admin.audit.head`, `admin.sessions.list`, `admin.jobs.list`, `admin.policy.decisions.list`, `admin.audit.list`, `admin.alerts.list` | `admin.policy.approve`, `admin.policy.deny` |
| S2 Project list | `admin.projects.list` | — |
| S3 Project detail | `admin.projects.get` | `admin.projects.transition`, `admin.projects.preflight.refresh` |
| S4 Jobs | `admin.jobs.list` | `admin.jobs.queue.pause`, `admin.jobs.queue.resume`, `admin.jobs.cancel`, `admin.jobs.retry` |
| S5 Audit | `admin.audit.head`, `admin.audit.list` | `admin.audit.verify` |
| S6 Policy | `admin.policy.decisions.list` | `admin.policy.approve`, `admin.policy.deny` |
| S7 Providers | `admin.providers.list` | `admin.providers.probe`, `admin.secrets.rotate.token` |
| S8 Sessions | `admin.sessions.list` | `admin.sessions.terminate` |
| S9 Alerts | `admin.alerts.list` (data limited) | `admin.alerts.ack` (record-only) |
| S10 Migrations | `admin.migrations.list` | `admin.migrations.apply` |
| S11 Secrets | `admin.secrets.list` | `admin.secrets.rotate.token`, `admin.secrets.rotate.master.start`, `admin.secrets.rotate.audit.start` |
| S12 SLO | `admin.slos.list` (targets only) | — |
| S13 Capacity | `admin.capacity.get` (sessions+queue only) | — |
| S14 DR | `admin.dr.upcoming.list`, `admin.dr.drills.list` (data limited) | `admin.dr.drills.schedule` (record-only) |
| S15 Settings | `admin.config.env.get`, `admin.config.flags.list` | `admin.config.flags.toggle` (record-only) |

### Data-limited screens

Some backends are deferred per v6 §28 M11+: alerting layer, SLO computation,
DR drill scheduler, capacity cost model, lethal-trifecta detector, provider
rate-limit headroom, secrets rotation execution. The corresponding admin
tools return real but minimal data (empty arrays, null fields, configured
values only) along with a `dataLimited.reason` string. The UI surfaces these
via `<DataLimited reason />` (inline pill) or `<DataLimitedBanner reason />`
(full-width strip). **No fake values anywhere.**

## What the prototype is not

- Not multi-tenant. Single operator, single environment, no role hierarchy.
- Not mobile. Designed for 1280px+ desktop windows. A 1024px breakpoint is
  acceptable but not optimized.
- Not real-time push. Polling is the primary update mechanism; SSE / WebSockets
  could later upgrade specific surfaces (job queue, audit chain) but the
  layout is designed for 30s polling first.
- Not internationalized. Single locale, English, no RTL. All copy is hand-
  written, not from a string table.

## File map

```
index.html                    — entry point, route table
base-styles.css               — paper-warm root tokens (shared with viz site)
app.css                       — control-plane-specific styles
mcp-client.js                 — minimal MCP-over-HTTP client (window.MCP_CLIENT)
use-admin.jsx                 — useAdmin React hook with polling
data-limited.jsx              — DataLimited / DataLimitedBanner / LoadingSkeleton / ErrorBlock
components.jsx                — TopNav, PageHead, pills, modal, drawer, JsonView
app-tweaks.jsx                — CPTweaksProvider + panel (env / polling / operator badge)
page-dashboard.jsx            — S1
page-projects.jsx             — S2 + S3
page-jobs-policy.jsx          — S4 + S6
page-audit.jsx                — S5
page-tier23.jsx               — S7–S15
page-index.jsx                — sitemap + screen-flow diagram
```
