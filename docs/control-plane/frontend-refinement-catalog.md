# Control Plane Frontend Refinement Catalog

Date: 2026-04-27

## Intent

The frontend should read as a project inception through build pipeline, not as a generic admin console. The operator should be able to answer these questions in one scan:

- What phase is each project in?
- Which Jira cards, Confluence pages, repo artifacts, and handoff bundles exist or are planned?
- What is blocking build readiness?
- Which agents are connected and which work is queued or running?
- What happened recently, and which external artifact did it touch?

## Product Research

### Atlassian Compass / DX

Useful pattern: component catalogs combine ownership, docs, dependencies, and scorecards. Compass materials emphasize scorecards as a way to make engineering expectations visible and measurable, plus dependency maps and component health signals.

Sources:
- https://support.atlassian.com/compass/docs/what-is-the-developer-experience-dashboard/
- https://www.atlassian.com/software/compass/guide/design-and-architecture/scorecard-design
- https://www.atlassian.com/software/compass/engineering-standards

Potential changes:
- Add a readiness scorecard per project with gates for intake, blueprint, Jira, docs, repo, handoff, agents, and audit evidence.
- Add a compact portfolio-wide scorecard summary on the Pipeline page.
- Add dependency/trace map widgets that show how blueprint sections map to Jira, Confluence, VCS, and handoff artifacts.

### Backstage / TechDocs

Useful pattern: developer portals make docs and source code first-class resources on service/project pages. TechDocs is explicitly based on docs-as-code, where documentation is authored and managed with the underlying software.

Sources:
- https://backstage.io/docs/features/techdocs/how-to-guides
- https://backstage.io/docs/features/techdocs/configuration/
- https://backstage.spotify.com/docs/portal/core-features-and-plugins/techdocs

Potential changes:
- Add a project resource dock: Jira project/cards, Confluence pages, repository, handoff bundle, context pack, and audit chain.
- Promote docs and repo state out of tabs into always-visible project resources.
- Add quick actions that open the provision tab, jobs page, agents page, or external repo when available.

### Linear Projects

Useful pattern: project overviews combine project properties, documents/resources, milestones, and a graph showing scope/progress. This maps well to atl-mcp's project profile, blueprint, artifacts, readiness, and handoff state.

Source:
- https://linear.app/docs/project-overview

Potential changes:
- Add a project detail sidebar/dock for project properties and resources.
- Add a progress graph or phase rail that is always visible on project detail.
- Add milestone/readiness cards derived from the lifecycle state machine.

### Port Software Catalog / Scorecards

Useful pattern: scorecards translate internal engineering standards into measurable checks on catalog entities. Port positions scorecards around maturity, production readiness, and engineering quality, which maps directly to atl-mcp's active project catalog.

Source:
- https://docs.port.io/scorecards/overview/

Potential changes:
- Add a catalog standards panel to the Pipeline dashboard with portfolio-level pass/fail rules.
- Keep rules derived from live project state and artifact summaries rather than static recommendations.
- Use the same rule language on individual project readiness so operators can move from portfolio drift to a specific project.

### Jira + Confluence Integration

Useful pattern: Jira and Confluence are strongest when each side can reveal linked work/docs and their status. Atlassian docs emphasize seeing work item status from Confluence and links to pages/docs from Jira.

Sources:
- https://support.atlassian.com/confluence-cloud/docs/use-jira-and-confluence-together/
- https://support.atlassian.com/jira-cloud-administration/docs/integrate-with-confluence/

Potential changes:
- Keep Jira cards and Confluence pages side-by-side in project detail.
- Add status chips and counts in project list/dashboard cards.
- Add an orchestration activity timeline showing when each artifact was created, linked, or refreshed.

## InfernoDev Design Essentials Inventory

Requested target:

`InfernoDev` -> `D:\git\start-lists\Design Essentials`

Resolved target:

`InfernoDev` -> `D:\git\star-lists\Design essentials`

Status:

- Completed after SSH became reachable from Windows PowerShell via `C:\Windows\System32\OpenSSH\ssh.exe`.
- SSH config maps `InfernoDev` to `192.168.22.22` as user `chris`.
- The originally requested path used `start-lists`; the actual folder is `star-lists`.
- Inventory found 120 top-level repos; 117 had frontend/design markers from package metadata, component files, CSS, images, or UI-oriented directory names.

All repos observed:

`1fe`, `960-Grid-System`, `a11y`, `a11y.css`, `a11yproject.com`, `a11y-tools`, `accessibility`, `accessibility-developer-tools`, `accessibility-fails`, `accessibility-guide`, `accesslint.js`, `ally.js`, `angular`, `animate.css`, `astro`, `atomic-react-redux`, `aurelia`, `awesome-a11y`, `axe-cli`, `backbone`, `baklava`, `basscss`, `blueprint`, `bootstrap`, `bulma`, `chakra-ui`, `chat-app`, `colorable`, `colors`, `core`, `crowdmeeting`, `daisyui`, `design`, `dojo`, `eleva`, `ember.js`, `flag-icons`, `Flat-UI`, `flowrift`, `foundation-sites`, `framework`, `gatsby`, `headlessui`, `heroicons`, `heroui`, `Hover`, `HTML5accessibility`, `html5-boilerplate`, `hyperapp`, `hyperui`, `icons`, `ionicons`, `kit`, `knockout`, `leonardo`, `lightcrawler`, `lighthouse`, `lit`, `live-jazz-tokyo`, `mantine`, `marko`, `material`, `materialize`, `materialized`, `material-tailwind`, `material-ui`, `merakiui`, `mithril.js`, `Modernizr`, `myna`, `neo`, `next.js`, `nextjs6-graphql-client-tutorial`, `next-redux-todo`, `normalize.css`, `nuclear-js`, `open-props`, `pa11y`, `photon`, `polymer`, `preact`, `preline`, `primeng`, `primereact`, `protractor-accessibility-plugin`, `pure`, `qwik`, `ratchet`, `react`, `react-a11y`, `react-bootstrap`, `refine`, `responsively-app`, `REVENGE.CSS`, `rewindui`, `riot`, `rsuite`, `sailboatui`, `seemple`, `Semantic-UI`, `Semantic-UI-React`, `serverless-aws-cdk-ecommerce`, `solid`, `spine`, `StockManagementSystem`, `SubtlePatterns`, `svelte`, `tabler-icons`, `tailgrids`, `tail-kit`, `tailwindcss`, `tastin-front`, `TheA11yMachine`, `todomvc`, `tota11y`, `ui`, `uikit`, `vue`, `website`, `zinggrid`.

## Full 120-Repo Batch Review

Answer to the direct count question:

- Earlier work inventoried all 120 repos and opened a smaller representative subset deeply.
- This pass batch-reviewed all 120 repos using Windows OpenSSH from PowerShell, not WSL.
- The scan inspected repo metadata, README headings, top-level directories, tracked file manifests, and UI-oriented file-name signals. It is a breadth pass across every repo, with deeper manual follow-up still best reserved for repos that map directly to atl-mcp's control-plane needs.

Category breakdown from the full pass:

- Design system or component library: 35
- Admin workflow pattern source: 31
- Accessibility and quality reference: 19
- Framework reference: 10
- Application example: 8
- Visual assets and iconography: 8
- General frontend reference: 7
- Component examples and documentation: 2

Control-surface themes reinforced by the full pass:

- The frontend should behave like a build control room: persistent project context, phase status, artifact chain, queue state, agent state, and operator gates should be visible without hunting through generic admin pages.
- Jira issues, Confluence pages, VCS artifacts, context packs, readiness reports, and handoff bundles should share one artifact model in the UI, with consistent status chips, links, provenance, and freshness.
- Long project pages need a sticky project rail or local navigation so inception, blueprint, provisioning, context, readiness, and handoff are treated as one pipeline rather than separate islands.
- Agent monitoring should be lane-based: ready handoffs, assigned agents, running jobs, blocked jobs, failed jobs, and approval gates should sit next to project status instead of living in a disconnected sessions table.
- Empty, degraded, loading, and failed states need the same geometry as healthy states, so a fetch failure does not make the operator lose the whole mental map.
- Icon language should be systematic: status, stage, artifact, external link, refresh, retry, copy, open, and agent actions should have stable icons and compact tool affordances.

### Batch 1: 1-20

- `1fe` (general frontend reference): operator surface structure, phase/progress tracking, component states and controls.
- `960-Grid-System` (design system or component library): baseline frontend conventions.
- `a11y` (accessibility and quality reference): accessibility guardrails.
- `a11y.css` (accessibility and quality reference): accessibility guardrails, icon/token system cues.
- `a11yproject.com` (accessibility and quality reference): operator surface structure, component states and controls, accessibility guardrails, icon/token system cues.
- `a11y-tools` (accessibility and quality reference): baseline frontend conventions.
- `accessibility` (accessibility and quality reference): operator surface structure, accessibility guardrails, icon/token system cues.
- `accessibility-developer-tools` (accessibility and quality reference): operator surface structure, accessibility guardrails.
- `accessibility-fails` (accessibility and quality reference): operator surface structure, component states and controls.
- `accessibility-guide` (accessibility and quality reference): operator surface structure, component states and controls, icon/token system cues.
- `accesslint.js` (accessibility and quality reference): modern stack conventions.
- `ally.js` (accessibility and quality reference): operator surface structure, component states and controls.
- `angular` (admin workflow pattern source): operator surface structure, phase/progress tracking, component states and controls, accessibility guardrails, icon/token system cues, modern stack conventions.
- `animate.css` (component examples and documentation): accessibility guardrails, icon/token system cues.
- `astro` (admin workflow pattern source): operator surface structure, phase/progress tracking, component states and controls, accessibility guardrails, icon/token system cues.
- `atomic-react-redux` (framework reference): icon/token system cues, modern stack conventions.
- `aurelia` (admin workflow pattern source): operator surface structure, phase/progress tracking, component states and controls, accessibility guardrails, icon/token system cues, modern stack conventions.
- `awesome-a11y` (accessibility and quality reference): baseline frontend conventions.
- `axe-cli` (accessibility and quality reference): modern stack conventions.
- `backbone` (framework reference): operator surface structure, icon/token system cues.

### Batch 2: 21-40

- `baklava` (admin workflow pattern source): operator surface structure, phase/progress tracking, component states and controls, accessibility guardrails, icon/token system cues, modern stack conventions.
- `basscss` (design system or component library): baseline frontend conventions.
- `blueprint` (design system or component library): operator surface structure, phase/progress tracking, component states and controls, accessibility guardrails, icon/token system cues, modern stack conventions.
- `bootstrap` (design system or component library): operator surface structure, phase/progress tracking, component states and controls, accessibility guardrails, icon/token system cues, modern stack conventions.
- `bulma` (design system or component library): operator surface structure, phase/progress tracking, component states and controls, icon/token system cues.
- `chakra-ui` (design system or component library): operator surface structure, phase/progress tracking, component states and controls, accessibility guardrails, icon/token system cues, modern stack conventions.
- `chat-app` (application example): component states and controls, icon/token system cues, modern stack conventions.
- `colorable` (visual assets and iconography): component states and controls, modern stack conventions.
- `colors` (visual assets and iconography): visual identity assets.
- `core` (admin workflow pattern source): operator surface structure, phase/progress tracking, component states and controls, icon/token system cues.
- `crowdmeeting` (application example): operator surface structure, phase/progress tracking, component states and controls, icon/token system cues, modern stack conventions.
- `daisyui` (design system or component library): operator surface structure, phase/progress tracking, component states and controls, accessibility guardrails, icon/token system cues, modern stack conventions.
- `design` (admin workflow pattern source): operator surface structure, phase/progress tracking, component states and controls, accessibility guardrails, icon/token system cues, modern stack conventions.
- `dojo` (admin workflow pattern source): operator surface structure, phase/progress tracking.
- `eleva` (admin workflow pattern source): operator surface structure, component states and controls, icon/token system cues.
- `ember.js` (admin workflow pattern source): operator surface structure, phase/progress tracking, component states and controls, icon/token system cues, modern stack conventions.
- `flag-icons` (visual assets and iconography): icon/token system cues.
- `Flat-UI` (design system or component library): operator surface structure, phase/progress tracking, component states and controls, icon/token system cues.
- `flowrift` (design system or component library): baseline frontend conventions.
- `foundation-sites` (design system or component library): operator surface structure, phase/progress tracking, component states and controls, accessibility guardrails, icon/token system cues.

### Batch 3: 41-60

- `framework` (general frontend reference): baseline frontend conventions.
- `gatsby` (admin workflow pattern source): operator surface structure, phase/progress tracking, component states and controls, accessibility guardrails, icon/token system cues.
- `headlessui` (design system or component library): operator surface structure, phase/progress tracking, component states and controls, accessibility guardrails, icon/token system cues.
- `heroicons` (visual assets and iconography): operator surface structure, component states and controls.
- `heroui` (design system or component library): operator surface structure, phase/progress tracking, component states and controls, accessibility guardrails, icon/token system cues.
- `Hover` (general frontend reference): icon/token system cues.
- `HTML5accessibility` (accessibility and quality reference): operator surface structure, phase/progress tracking, accessibility guardrails, icon/token system cues.
- `html5-boilerplate` (component examples and documentation): component states and controls, icon/token system cues.
- `hyperapp` (framework reference): architecture conventions.
- `hyperui` (design system or component library): operator surface structure, phase/progress tracking, component states and controls, icon/token system cues, modern stack conventions.
- `icons` (visual assets and iconography): operator surface structure, phase/progress tracking, component states and controls, icon/token system cues, modern stack conventions.
- `ionicons` (visual assets and iconography): operator surface structure, phase/progress tracking, component states and controls, accessibility guardrails, icon/token system cues.
- `kit` (admin workflow pattern source): operator surface structure, component states and controls, accessibility guardrails, icon/token system cues.
- `knockout` (framework reference): architecture conventions.
- `leonardo` (admin workflow pattern source): operator surface structure, component states and controls, accessibility guardrails, icon/token system cues.
- `lightcrawler` (general frontend reference): baseline frontend conventions.
- `lighthouse` (accessibility and quality reference): operator surface structure, phase/progress tracking, component states and controls, accessibility guardrails, icon/token system cues, modern stack conventions.
- `lit` (framework reference): operator surface structure, component states and controls, icon/token system cues.
- `live-jazz-tokyo` (application example): operator surface structure, icon/token system cues, modern stack conventions.
- `mantine` (design system or component library): operator surface structure, phase/progress tracking, component states and controls, accessibility guardrails, icon/token system cues, modern stack conventions.

### Batch 4: 61-80

- `marko` (admin workflow pattern source): operator surface structure, phase/progress tracking, component states and controls, icon/token system cues.
- `material` (design system or component library): operator surface structure, phase/progress tracking, component states and controls, icon/token system cues.
- `materialize` (design system or component library): operator surface structure, phase/progress tracking, component states and controls, icon/token system cues.
- `materialized` (design system or component library): icon/token system cues, modern stack conventions.
- `material-tailwind` (design system or component library): operator surface structure, phase/progress tracking, component states and controls, icon/token system cues, modern stack conventions.
- `material-ui` (design system or component library): operator surface structure, phase/progress tracking, component states and controls, accessibility guardrails, icon/token system cues, modern stack conventions.
- `merakiui` (admin workflow pattern source): operator surface structure, phase/progress tracking, component states and controls, icon/token system cues.
- `mithril.js` (framework reference): component states and controls.
- `Modernizr` (admin workflow pattern source): operator surface structure, phase/progress tracking, component states and controls.
- `myna` (general frontend reference): operator surface structure, phase/progress tracking, component states and controls, icon/token system cues, modern stack conventions.
- `neo` (admin workflow pattern source): operator surface structure, phase/progress tracking, component states and controls, icon/token system cues.
- `next.js` (admin workflow pattern source): operator surface structure, phase/progress tracking, component states and controls, accessibility guardrails, icon/token system cues, modern stack conventions.
- `nextjs6-graphql-client-tutorial` (framework reference): operator surface structure, component states and controls, icon/token system cues, modern stack conventions.
- `next-redux-todo` (application example): operator surface structure, component states and controls, icon/token system cues, modern stack conventions.
- `normalize.css` (design system or component library): baseline frontend conventions.
- `nuclear-js` (admin workflow pattern source): operator surface structure, phase/progress tracking, component states and controls, icon/token system cues, modern stack conventions.
- `open-props` (design system or component library): component states and controls, icon/token system cues.
- `pa11y` (accessibility and quality reference): component states and controls, accessibility guardrails, modern stack conventions.
- `photon` (admin workflow pattern source): operator surface structure, component states and controls, icon/token system cues.
- `polymer` (admin workflow pattern source): operator surface structure, icon/token system cues.

### Batch 5: 81-100

- `preact` (admin workflow pattern source): operator surface structure, modern stack conventions.
- `preline` (design system or component library): operator surface structure, phase/progress tracking, component states and controls, accessibility guardrails, icon/token system cues.
- `primeng` (design system or component library): operator surface structure, phase/progress tracking, component states and controls, accessibility guardrails, icon/token system cues, modern stack conventions.
- `primereact` (design system or component library): operator surface structure, phase/progress tracking, component states and controls, accessibility guardrails, icon/token system cues, modern stack conventions.
- `protractor-accessibility-plugin` (accessibility and quality reference): modern stack conventions.
- `pure` (design system or component library): operator surface structure, icon/token system cues.
- `qwik` (admin workflow pattern source): operator surface structure, phase/progress tracking, component states and controls, icon/token system cues, modern stack conventions.
- `ratchet` (admin workflow pattern source): operator surface structure, component states and controls, icon/token system cues.
- `react` (admin workflow pattern source): operator surface structure, phase/progress tracking, component states and controls, icon/token system cues.
- `react-a11y` (accessibility and quality reference): accessibility guardrails, modern stack conventions.
- `react-bootstrap` (design system or component library): operator surface structure, phase/progress tracking, component states and controls, icon/token system cues, modern stack conventions.
- `refine` (admin workflow pattern source): operator surface structure, phase/progress tracking, component states and controls, icon/token system cues, modern stack conventions.
- `responsively-app` (general frontend reference): operator surface structure, component states and controls, icon/token system cues.
- `REVENGE.CSS` (general frontend reference): baseline frontend conventions.
- `rewindui` (design system or component library): operator surface structure, phase/progress tracking, component states and controls, accessibility guardrails, icon/token system cues.
- `riot` (framework reference): architecture conventions.
- `rsuite` (design system or component library): operator surface structure, phase/progress tracking, component states and controls, accessibility guardrails, icon/token system cues, modern stack conventions.
- `sailboatui` (design system or component library): operator surface structure, phase/progress tracking, component states and controls, icon/token system cues, modern stack conventions.
- `seemple` (framework reference): phase/progress tracking, icon/token system cues.
- `Semantic-UI` (design system or component library): operator surface structure, phase/progress tracking, component states and controls, icon/token system cues.

### Batch 6: 101-120

- `Semantic-UI-React` (design system or component library): operator surface structure, phase/progress tracking, component states and controls, icon/token system cues, modern stack conventions.
- `serverless-aws-cdk-ecommerce` (application example): operator surface structure, component states and controls, icon/token system cues.
- `solid` (admin workflow pattern source): operator surface structure, icon/token system cues.
- `spine` (framework reference): architecture conventions.
- `StockManagementSystem` (application example): operator surface structure, icon/token system cues.
- `SubtlePatterns` (visual assets and iconography): operator surface structure, component states and controls.
- `svelte` (admin workflow pattern source): operator surface structure, component states and controls, accessibility guardrails, icon/token system cues, modern stack conventions.
- `tabler-icons` (visual assets and iconography): operator surface structure, phase/progress tracking, component states and controls, icon/token system cues, modern stack conventions.
- `tailgrids` (design system or component library): operator surface structure, phase/progress tracking, component states and controls, accessibility guardrails, icon/token system cues.
- `tail-kit` (design system or component library): operator surface structure, phase/progress tracking, component states and controls, icon/token system cues, modern stack conventions.
- `tailwindcss` (design system or component library): operator surface structure, component states and controls, icon/token system cues.
- `tastin-front` (application example): component states and controls, icon/token system cues, modern stack conventions.
- `TheA11yMachine` (accessibility and quality reference): operator surface structure, accessibility guardrails, modern stack conventions.
- `todomvc` (application example): operator surface structure, phase/progress tracking, component states and controls, accessibility guardrails, icon/token system cues.
- `tota11y` (accessibility and quality reference): accessibility guardrails.
- `ui` (admin workflow pattern source): operator surface structure, phase/progress tracking, component states and controls, icon/token system cues, modern stack conventions.
- `uikit` (design system or component library): operator surface structure, phase/progress tracking, component states and controls, icon/token system cues.
- `vue` (admin workflow pattern source): operator surface structure, component states and controls.
- `website` (admin workflow pattern source): operator surface structure, phase/progress tracking, component states and controls, accessibility guardrails, icon/token system cues, modern stack conventions.
- `zinggrid` (admin workflow pattern source): operator surface structure, component states and controls, icon/token system cues.

Most applicable repos opened more deeply:

- `design`: useful guidance for page layout, nav lists, progress bars, and data tables. The strongest fit is explicit table headers/actions and progress values paired with text.
- `blueprint`: useful for desktop-heavy operator surfaces, especially breadcrumbs with overflow behavior and compact interactive cards.
- `daisyui`: useful CSS patterns for steps, timelines, status dots, tables, and scroll-safe step rows.
- `refine`: useful admin-dashboard pattern: resource-first navigation and headless workflow separation from UI.
- `rewindui` and `rsuite`: useful admin shell/sidebar patterns with collapsible navigation and dense operational panels.
- `next-redux-todo` and `responsively-app`: useful smaller examples for status indicators, navigation layout, and compact icon action groups.
- `a11yproject.com`, `ally.js`, `pa11y`, `tota11y`, `lighthouse`: useful accessibility/testing references for keyboard focus, skip/navigation behavior, and degraded states.

Patterns applied to atl-mcp:

- Added project breadcrumbs inspired by `blueprint` and `design` nav/page-layout patterns.
- Added an artifact matrix inspired by `design` data-table guidance so Jira, Confluence, VCS, and handoff can be compared in one flat view.
- Tightened mobile overflow after checking the dense dashboard/project surfaces, matching the scroll-contained approach visible in step/nav examples.

Potential follow-up changes from this inventory:

- Add a persistent project-side nav for long project detail pages, inspired by `rsuite` and `rewindui` sidebars.
- Add sortable/filterable artifact tables once artifact counts grow beyond the demo fixture size.
- Add keyboard-visible focus states and skip links across the static control plane, using `a11yproject.com`, `ally.js`, and `pa11y` references.
- Add a compact icon action group for refresh/open/copy actions in project detail, inspired by `responsively-app`.
- Add explicit empty/error/degraded states for artifact tables using the same row geometry instead of separate free-text blocks.

Additional build-control-surface changes from the full 120-repo batch pass:

- Add a project command header that combines logo/monogram, lifecycle phase, readiness verdict, artifact counts, queue state, and last orchestration event.
- Convert Jira and Confluence from external-only links into first-class frontend panels with issue/page title, key, status, link health, last sync, and provenance.
- Add a phase conveyor for inception, requirements, blueprint, preflight, provisioning, context, readiness, handoff, and build, with each stage showing its owning tools and blocked/ready state.
- Add a trace graph or matrix view that maps requirements to Jira cards, Confluence sections, repo files, PRs, context packs, readiness gates, and handoff artifacts.
- Add an agent operations board with lanes for available agents, assigned build agents, running jobs, blocked jobs, failed jobs, and stale handoffs.
- Add command-palette style quick actions for project operators: open Jira, open Confluence, refresh context, rerun readiness, retry provision, copy handoff URI, and open agent monitor.
- Add a provider health strip for Jira, Confluence, Bitbucket/GitHub, Qdrant, queue, audit chain, and webhooks so fetch/tool failures are contextual rather than page-breaking.
- Add compact project visualizations where useful: generated project logo/monogram, artifact-chain diagram, readiness radar, and activity heat strip.

## Implemented In This Pass

- Project readiness scorecard.
- Project resource dock.
- Trace map widget connecting blueprint, Jira, Confluence, repo, and handoff.
- Orchestration timeline surfaced on overview.
- Next-action panel that directs the operator to the right tab/page.
- Small integrated icon treatment that matches the existing mono, rectangular visual language.

## Implemented In 2026-04-27 Refinement Pass 2

- Dashboard catalog standards panel, inspired by Compass and Port scorecards, using live project/artifact state for blueprint, Jira, Confluence, repo, handoff, readiness, and queue rules.
- Project operator launchpad with one-scan links/actions for Jira, Confluence, repo, provisioning controls, lifecycle transitions, and agent monitoring.
- Project milestone panel derived from the six lifecycle phases: inception, blueprint, preflight, provision, context, and build handoff.
- Cache version bump for the static control-plane assets so the served UI picks up the new dashboard and project widgets.

## Implemented In 2026-04-27 Refinement Pass 3

- Completed the InfernoDev Design Essentials inventory against the corrected folder.
- Added project breadcrumb navigation to project detail pages.
- Added artifact matrix table for Jira, Confluence, repository, and handoff state.
- Bumped static CSS/project-page cache versions again after the new widgets.

## Implemented In 2026-04-27 Refinement Pass 4

- Added a shared build control rail across Pipeline, Projects, Queue, Agents, and Approvals so each primary page exposes project flow, artifact chain, agent runway, and operator gates.
- Reframed Jobs as Queue in the primary navigation and page title.
- Added a portfolio command summary on Projects for ready lanes, exceptions, artifact linkage, and open jobs.
- Added a queue runway panel with status cards and Jira/Confluence/VCS/handoff stage grouping.
- Added an approval gate board that groups pending operator decisions by lifecycle stage.
- Added an agent runway board that ties connected agents to ready handoff lanes, active jobs, failed jobs, and approval gates.

## Backlog

- Add context pack status and freshness once `admin.projects.get` exposes latest context pack/readiness report.
- Add artifact search/filter within the project detail page.
- Add webhook-driven live activity rows for Jira, Confluence, Bitbucket, and GitHub events.
- Add a dependency graph once trace links are queryable from admin MCP.
- Add persistent per-project notes or operator bookmarks for high-friction handoff decisions.
