---
title: Velocity-Ops-Engine Port Plan
owner: Chris
status: accepted (build spec for M4-M9)
last_reviewed: 2026-04-26
version: 1.0.0
audience: [engineer, operator]
related: [agent-context-orchestrator-mcp-plan-v6.md §28, docs/build-orchestration.md, docs/partners/velocity-ops-engine.md]
---

# Velocity-Ops-Engine → atl-mcp port plan

> **What this is.** A structured map of every part of `C:\Users\Chris\Documents\git\velocity-ops-engine` worth lifting into atl-mcp, organized by the new capability it unlocks. The capability: take a research brief plus a quick intent summary for a new project, extract requirements, turn them into Jira epics/stories/subtasks, generate Confluence project documentation, and scaffold a Bitbucket repo — handing the bundle to a build agent with zero ambiguity. atl-mcp's v6 spec already names this work as milestones M4–M9; velocity-ops-engine has been doing the same shape of work in the consulting domain and has 10 lifecycle phases, 68 templates, 13 agent role cards, 19 workflows, 38 stack modules, and a hardened quality-gate stack. Most of what M4–M9 needs already exists there, ready to lift or adapt.
>
> **Source repo:** `C:\Users\Chris\Documents\git\velocity-ops-engine` (43 MB, no `LICENSE` file as of inventory — both repos are owned by the same operator; the lift is intra-portfolio).
>
> **Target capability (the user's brief, verbatim shape):**
> 1. Read research brief + quick intent summary for a new project.
> 2. Extract requirements (text → structured list).
> 3. Synthesize a blueprint (requirements → epics → stories → subtasks; plus architecture sketch, SLOs, threat-model summary, testing strategy).
> 4. Provision Jira (project + linked issue tree).
> 5. Provision Confluence (space + doc tree).
> 6. Provision the repo (Bitbucket; scaffold per stack choice; seed `CONTEXT.md`, `AGENTS.md`, `CLAUDE.md`).
> 7. Hand off to a build agent (context bundle).
>
> **Where each step lands in atl-mcp's v6 spec:** M4 (intake + blueprint) → M5 (planner + preview) → M6a/b/c (Jira / Confluence / VCS executors) → M7 (context resources + packs) → M9 (agent handoff). The plan below maps each step to source files in velocity-ops-engine and to the milestone that consumes them.

---

## 0. Headline finding

**Most of M4–M9 can be built by adapting velocity-ops-engine's lifecycle artifacts** rather than designing from scratch. The 10-phase consulting lifecycle (`engine/phases/01-intake/` through `10-operations/`) maps almost directly onto atl-mcp's intake-to-handoff sequence; the templates (`templates/`) become Confluence page generators and repo scaffold seeds; the agent role cards (`agents/`) become personas the M4 blueprint synthesizer consults and the M9 handoff bundle ships; the workflows (`workflows/`) are the orchestration patterns the M5 planner needs.

The single highest-leverage item is **`engine/phases/`** — it's the source-of-truth lifecycle definition. Read that first; everything downstream is in service of it.

The runner-up is **`templates/`** — 68 templates with variable-substitution slots that act as the generator catalog for Confluence pages and repo scaffold files.

The original quality-gate finds from the first pass (`quality/enforcement-v2/`, `semgrep/stub-detection.yml`, `benchmarks/`) remain in scope and are now even more critical: M7 (context packs) and M8 (verification) are exactly where those gates fire.

---

## 1. Capability → milestone map

| # | Capability step | atl-mcp milestone | velocity phase | Velocity source dirs (primary) |
|---|---|---|---|---|
| 1 | Read briefs + extract requirements | M4 (intake) | 01-intake, 02-discovery | `engine/phases/01-intake/`, `engine/phases/02-discovery/`, `templates/research-intake.md`, `templates/requirements-catalog.md`, `agents/researcher.md` |
| 2 | Synthesize blueprint | M4 (blueprint) | 02-discovery, 03-scoping, 06-architecture | `engine/phases/02-discovery/`, `engine/phases/03-scoping/`, `engine/phases/06-architecture/`, `templates/project-brief.md`, `templates/prd.md`, `templates/architecture-decision.md`, `templates/slo-definition.md`, `templates/threat-model.md`, `agents/architect.md`, `agents/thinking-partner.md`, `workflows/decision-flow.md` |
| 3 | Plan + preview the provisioning | M5 (planner + preview) | 03-scoping, 05-setup | `engine/phases/03-scoping/`, `engine/phases/05-setup/`, `workflows/feature-flow.md`, `workflows/multi-agent-flow.md` |
| 4 | Provision Jira | M6a (Jira executor) | 03-scoping (deliverable hierarchy) + 05-setup (project config) | `engine/phases/03-scoping/templates/sow-outline.md`, `templates/feature-spec.md`, `templates/task-spec.md` |
| 5 | Provision Confluence | M6b (Confluence executor) | 02-discovery + 06-architecture + 07-delivery + 08-verification | `engine/phases/02-discovery/templates/discovery-brief.md`, `engine/phases/06-architecture/templates/`, `engine/phases/07-delivery/templates/`, `templates/runbook.md`, `templates/common-tasks-runbook.md`, `templates/incident-response.md`, `templates/api-standards.md`, `quality/ci-pipeline.md`, plus stack modules from `modules/` |
| 6 | Provision repo + scaffold | M6c (VCS executor) | 05-setup + 07-delivery | `templates/contributing.md`, `templates/git-branching.md`, `templates/framework-waivers.md`, `templates/centralized-paths.md`, `modules/*` (per stack), `quality/enforcement-v2/*.sh`, `.husky/pre-commit` |
| 7 | Hand off to build agent | M7 (context packs) + M9 (handoff) | 09-handoff + 10-operations | `engine/phases/09-handoff/templates/handoff-checklist.md`, `engine/phases/09-handoff/templates/proof-asset-capture.md`, `templates/session-handoff.md`, `workflows/session-handoff.md`, `agents/*` (role cards bundled into `AGENTS.md` for the new repo) |

---

## 2. Section A — Phase-by-phase port plan

For each step, what to lift, how to adapt, and which milestone consumes it.

### Step 1 — Read briefs + extract requirements (M4 intake)

| Source | What it gives | Adaptation | Effort |
|---|---|---|---|
| `engine/phases/01-intake/README.md` | Intake protocol: questions to ask, fields to capture, gates that must pass before discovery | Drop in as M4 prompt skeleton — the intake fields become atl-mcp's `ProjectIntake` Zod schema | Adapt |
| `engine/phases/02-discovery/README.md` | Discovery protocol: turn intake answers into validated assumptions, surface unknowns, identify domain experts | Adapt — the assumption-validation pattern becomes part of M4 blueprint synthesis (runs the requirement claims past a confidence gate) | Adapt |
| `templates/research-intake.md` | Field-by-field intake form (operator fills before kicking off) | Lift as the canonical brief shape atl-mcp accepts as input | Drop-in |
| `templates/requirements-catalog.md` | Structured requirements list with traceability columns (req → feature → epic → story) | Lift as the canonical requirements artifact M4 emits | Drop-in |
| `agents/researcher.md` | Role card: how a researcher persona reads briefs, surfaces gaps, validates assumptions | Use as the persona prompt for the M4 brief-reading sub-agent | Adapt |
| `modules/assumption-check.md` | Cross-cutting protocol for validating assumptions made during discovery | Inject into M4 prompt as a falsification step | Drop-in |

### Step 2 — Synthesize blueprint (M4 blueprint)

| Source | What it gives | Adaptation | Effort |
|---|---|---|---|
| `engine/phases/03-scoping/README.md` | Scoping protocol: convert validated requirements into a concrete deliverable tree (epics → stories → tasks) with sequencing | Adapt — this is the blueprint synthesis algorithm; map velocity's "deliverable tree" to atl-mcp's `ProjectBlueprint` shape (`requirements`, `features`, `epics`) | Adapt |
| `engine/phases/06-architecture/README.md` + templates | Architecture-decision protocol with ADR-first discipline, "no implementation before decision" guardrail | Adapt — this becomes the architecture sketch portion of the blueprint (`ProjectBlueprint.architecture`) | Adapt |
| `templates/project-brief.md` | Full project-brief template (purpose, users, domains, workflows, constraints) | Lift as the canonical "first Confluence page" generator template | Drop-in |
| `templates/prd.md` | PRD template (problem, users, success criteria, scope, non-scope, rollout) | Lift as a generated Confluence page; populated from blueprint | Drop-in |
| `templates/architecture-decision.md` | MADR-format ADR template | Already in atl-mcp (`docs/adr/`); use the velocity copy as the seed for the new project's `docs/adr/0000-adr-process.md` | Drop-in |
| `templates/slo-definition.md` | SLO + error-budget template per service | Generated as one Confluence page per service identified in blueprint | Drop-in |
| `templates/threat-model.md` | STRIDE-style threat model template per component | Generated as one Confluence page per major component | Drop-in |
| `templates/feature-spec.md` | Feature-level spec (acceptance criteria + test plan) | One Jira story or Confluence page per feature; the variable-substitution slots are exactly the structured fields the synthesizer emits | Drop-in |
| `templates/task-spec.md` | Subtask-level spec | One Jira subtask per task | Drop-in |
| `agents/architect.md` | Architect role card: confidence-gate framework (5 dimensions), ADR-first mindset, scope-control discipline | Use as the persona for the M4 blueprint synthesizer (the agent that decomposes requirements into epics/stories/architecture) | Adapt |
| `agents/thinking-partner.md` | Structured-reasoning role card for complex decisions (decision tree methodology, tradeoff analysis) | Use during M4 stack-choice and architecture decisions | Adapt |
| `workflows/decision-flow.md` | Trade-off matrix + risk-assessment + stakeholder-input protocol | Sub-procedure inside the M4 blueprint synthesis when the planner faces a non-obvious choice (stack, hosting, auth model) | Adapt |

### Step 3 — Plan + preview provisioning (M5 planner + preview)

| Source | What it gives | Adaptation | Effort |
|---|---|---|---|
| `engine/phases/05-setup/README.md` | Setup-phase protocol: turn deliverable tree into concrete provisioning steps (project, repos, CI, environments) | Adapt — this is the M5 planner; map velocity's setup steps to atl-mcp's `provisioning_plan_create` MCP tool output | Adapt |
| `workflows/feature-flow.md` | Feature → spec → task decomposition with dependency tracking and acceptance-criteria gates | Adapt as the planner's per-feature decomposition algorithm | Adapt |
| `workflows/multi-agent-flow.md` | Wave-based execution + worktree-per-agent + synchronization gates | Adapt for M9 build-agent orchestration; also informs M5's preview-then-execute split | Inspiration |
| `commands/engage-scope-deliverables` (one of the 40 commands) | Slash command that produces a deliverable matrix from scoping inputs | Inspiration for M5 preview tool's UX shape | Inspiration |

### Step 4 — Provision Jira (M6a)

| Source | What it gives | Adaptation | Effort |
|---|---|---|---|
| `engine/phases/03-scoping/templates/sow-outline.md` | Statement-of-work outline → directly maps to a Jira epic/story/subtask hierarchy | Adapt — the outline becomes the canonical Jira issue tree the M6a executor creates | Adapt |
| `templates/feature-spec.md` | Per-feature acceptance criteria with structured fields | Each feature → one Jira story; acceptance criteria → story description; tests → subtasks | Drop-in |
| `templates/task-spec.md` | Per-task subtask shape | Each task → one Jira subtask | Drop-in |
| `engine/phases/05-setup/README.md` (project config section) | Per-project-type configurations (issue types, custom fields, workflows) | Adapt to atl-mcp's `project_type` selection (prototype / foundation / product / integration); each maps to a Jira project template | Adapt |

### Step 5 — Provision Confluence (M6b)

The Confluence executor reads the blueprint plus the chosen stack and walks the template inventory in Section B below, generating one page per template instance. Each velocity template becomes one Confluence page generator.

Specific phase sources:

| Source | Generated page(s) |
|---|---|
| `engine/phases/02-discovery/templates/discovery-brief.md` | **Context → Discovery Brief** (read-only archive page; traceability) |
| `engine/phases/06-architecture/templates/*` | **Architecture → C4-L1 / C4-L2 / sequences / dataflow / trust-boundaries** |
| `engine/phases/07-delivery/templates/*` | **Onboarding** + **Operations → Runbook stubs** |
| `engine/phases/08-verification/templates/*` | **Quality → Test Plan** + **Quality → Verification Checklist** |
| `quality/ci-pipeline.md` | **DevOps → CI Pipeline Reference** |
| `modules/<stack>.md` (per chosen stack) | **Stack Guide → [stack name]** (one per chosen stack) |

### Step 6 — Provision repo + scaffold (M6c)

The VCS executor scaffolds the repo and seeds the operator-facing meta-files (`CONTEXT.md`, `AGENTS.md`, `CLAUDE.md`) so the build agent receives the same shape of guidance atl-mcp itself ships with.

| Source | Repo destination | Notes |
|---|---|---|
| `templates/project-brief.md` (rendered) | `CONTEXT.md` (top section) | The brief itself becomes the project-context root. |
| `agents/*.md` (selected role cards) | `AGENTS.md` | Bundle relevant role cards into the new repo's `AGENTS.md` per the LF AGENTS.md spec atl-mcp already follows. |
| `modules/<stack>.md` | `CLAUDE.md` (stack-specific section) | Append the stack module(s) the operator chose. Multiple stacks = multiple sections. |
| `quality/enforcement-v2/pre-write-check.sh` + `error-halt.sh` + `verify-before-done.sh` + `compression-detector.sh` | `.claude/hooks/*.sh` and `.husky/pre-commit` | Pre-write validation, error halt on cascading failures, end-of-session verification. |
| `quality/enforcement-v2/pre-write-voice-check.sh` + `prompt-submit-voice.sh` | `.claude/hooks/*.sh` | Voice / plain-language enforcement (relevant since atl-mcp already maintains a `plain-language-reference.md`). |
| `velocity-ops-engine/.husky/pre-commit` (48 lines) | `.husky/pre-commit` | Pre-commit gate: lint-staged + typecheck + semgrep + security scan + large-file gate. atl-mcp does not have one today. |
| `semgrep/stub-detection.yml` (230 lines) | `semgrep/stub-detection.yml` | Stub-detection rules; wire as `npm run lint:semgrep`. |
| `templates/contributing.md` | `CONTRIBUTING.md` | Project-specific contributing guide. |
| `templates/git-branching.md` | `docs/git-branching.md` (or merged into CONTRIBUTING) | Branching strategy doc. |
| `templates/framework-waivers.md` | `.claude/framework-waivers.md` (only if waivers exist) | Documents intentional rule-breaks. |
| `velocity-ops-engine/.framework-manifest.json` (37 KB) | `.framework-manifest.json` | Optional governance: machine-readable file catalog with category (auto-update / manual-merge / seed-only). Light investment, useful for drift detection. |

### Step 7 — Hand off to build agent (M7 + M9)

The handoff bundle is the M7 context pack with M9 doing the actual transfer. Velocity has the closest-fit pattern.

| Source | What it gives | atl-mcp use |
|---|---|---|
| `engine/phases/09-handoff/templates/handoff-checklist.md` | Checklist of what must be present in the handoff bundle (artifacts complete? gates passed? proof captured?) | Becomes M9's pre-handoff verification gate; runs `verify-before-done.sh` plus a manifest check |
| `engine/phases/09-handoff/templates/proof-asset-capture.md` | Proof-of-readiness artifacts (links to provisioned Jira / Confluence / repo + screenshots / hashes) | Becomes the structured field set the M9 handoff packet emits |
| `templates/session-handoff.md` | Session-resumption pattern (CLAUDE.md as anchor, `.ai/` as state) | Pre-seeded into the new repo so the build agent can resume cleanly across sessions |
| `workflows/session-handoff.md` | Orchestration: how a build agent picks up where another left off | Bundled doc in the handoff package; agent runtime contract |
| `agents/implementer.md` + `tester.md` + `tdd-coach.md` + `reviewer.md` + `docs.md` + `ops.md` | Role cards the build agent assumes during the build phase | Bundled into the new repo's `AGENTS.md` so the build agent has clear personas to switch between |

---

## 3. Section B — Template inventory for generation

Total: **68 templates in `velocity-ops-engine/templates/`.** The ones that become generators in atl-mcp are below. Each row lists the velocity source, the artifact atl-mcp generates from it, and the variables the substitution layer must supply.

### B.1 — Generates a Confluence page

| velocity source | Generated Confluence page | Variables to fill | M-step |
|---|---|---|---|
| `templates/project-brief.md` | **Charter** (root page) | `{project_name}`, `{users}`, `{domains}`, `{workflows}`, `{constraints}` | M6b |
| `templates/prd.md` | **Product → PRD** | `{problem}`, `{users}`, `{success_criteria}`, `{scope}`, `{non_scope}`, `{rollout}` | M6b |
| `templates/architecture-decision.md` | **Architecture → ADRs → ADR-0001…N** | `{decision_date}`, `{deciders}`, `{context}`, `{alternatives}`, `{decision}`, `{consequences}` | M6b |
| `templates/slo-definition.md` | **Operations → SLOs and Error Budgets** | `{service}`, `{sli_metric}`, `{target_percent}`, `{error_budget_monthly}` | M6b |
| `templates/threat-model.md` | **Security → Threat Model** | `{component}`, `{assets}`, `{entry_points}`, `{threats}`, `{controls}` | M6b |
| `templates/runbook.md` | **Operations → [Service] Runbook** | `{service}`, `{common_tasks}`, `{failure_modes}`, `{escalation}` | M6b |
| `templates/common-tasks-runbook.md` | **Operations → Common Tasks** | `{task_name}`, `{prerequisites}`, `{steps}`, `{rollback}` | M6b |
| `templates/incident-response.md` | **Operations → Incident Response** | `{severity_levels}`, `{escalation_path}`, `{communication}` | M6b |
| `templates/compliance-framework.md` | **Compliance and Risk** | `{frameworks}`, `{requirements}`, `{evidence}` | M6b (only if threat-model flags compliance) |
| `templates/feature-spec.md` | **Features → [FEAT-NNN] Spec** | `{feature_id}`, `{acceptance_criteria}`, `{test_plan}` | M6b |
| `templates/api-standards.md` | **Architecture → API Standards** | `{error_shapes}`, `{versioning}`, `{auth}` | M6b (only if project has APIs) |
| `templates/contributing.md` | **Onboarding → Contributing** (mirror of repo CONTRIBUTING.md) | `{project_name}`, `{stack}`, `{review_process}` | M6b |
| `engine/phases/02-discovery/templates/discovery-brief.md` | **Context → Discovery Brief** (read-only archive) | Filled directly from M4 discovery output | M6b |
| `modules/<stack>.md` (one per chosen stack) | **Stack Guide → [stack name]** | Lifted whole; substitute `{node_version}` / `{python_version}` etc. | M6b |

### B.2 — Generates a repo file (scaffold seed)

| velocity source | Generated repo file | Variables | M-step |
|---|---|---|---|
| `templates/project-brief.md` (rendered) | `CONTEXT.md` (top section: System Purpose) | Same as B.1 row 1 | M6c |
| `agents/architect.md` + `implementer.md` + `tester.md` + `reviewer.md` + `tdd-coach.md` + `docs.md` + `ops.md` (selected) | `AGENTS.md` | `{project_name}`, `{stack}`, `{role_card_set}` | M6c |
| `modules/<stack>.md` | `CLAUDE.md` (stack-specific section) | Stack-module content lifted; `{stack_choice}` selects which module(s) | M6c |
| `quality/enforcement-v2/*.sh` (selected hooks) | `.claude/hooks/*.sh` | Direct copy; no substitution | M6c |
| `quality/enforcement-v2/pre-write-voice-check.sh` + `prompt-submit-voice.sh` | `.claude/hooks/*.sh` (warn-mode initially) | Direct copy | M6c |
| `velocity-ops-engine/.husky/pre-commit` | `.husky/pre-commit` | Strip consulting-specific scan rules; keep typecheck + semgrep + no-stdout + lint-staged | M6c |
| `semgrep/stub-detection.yml` | `semgrep/stub-detection.yml` | Direct copy | M6c |
| `templates/contributing.md` | `CONTRIBUTING.md` | `{stack}`, `{commands}`, `{pr_process}` | M6c |
| `templates/git-branching.md` | `docs/git-branching.md` (or merge into `CONTRIBUTING.md`) | `{strategy_choice}` | M6c |
| `templates/framework-waivers.md` | `.claude/framework-waivers.md` (only if waivers) | `{waivers}` | M6c |
| `templates/requirements-catalog.md` (rendered) | `.ai/requirements.md` | Filled from M4 blueprint requirements | M6c |
| `templates/feature-spec.md` (rendered, batched) | `.ai/features.json` | One entry per feature from blueprint | M6c |
| `templates/architecture-decision.md` | `docs/adr/0000-adr-process.md` (seed) + `docs/adr/0001-…N` (one per architecture decision in blueprint) | `{decision_date}`, etc. | M6c |
| `velocity-ops-engine/.framework-manifest.json` | `.framework-manifest.json` (optional) | Re-build per scaffolded repo with file categories | M6c (optional) |

### B.3 — Catalog-only (not generated; reference for atl-mcp's own SDLC)

The remaining velocity templates (~30 of the 68) are reference material that overlaps with what atl-mcp already has under `docs/sdlc/templates/`. Most are useful as inspiration for atl-mcp's own SDLC tree but are not part of the per-project generation pipeline. List omitted; browse `velocity-ops-engine/templates/` directly when expanding the catalog.

---

## 4. Section C — Workflow + agent role-card patterns

### C.1 — Agents (13 role cards)

Each role card defines a persona with explicit responsibilities, scope boundaries, and gate criteria. atl-mcp consumes them in two ways: (1) some become personas the M4 blueprint synthesizer adopts during specific decisions; (2) several are bundled into the new project's `AGENTS.md` as the build-phase persona library.

| velocity source | What it is | atl-mcp use |
|---|---|---|
| `agents/architect.md` | Principal architect persona; ADR-first; confidence-gate framework | M4 blueprint synthesis persona; M9 handoff bundle |
| `agents/researcher.md` | Domain research + assumption verification | M4 brief-reading sub-agent |
| `agents/thinking-partner.md` | Structured reasoning for complex decisions | M4 + M6 (architecture) decision support |
| `agents/implementer.md` | Developer; delivers code per spec | M9 handoff bundle (build phase persona) |
| `agents/tester.md` | QA owner; test strategy + coverage | M9 handoff bundle |
| `agents/reviewer.md` | Code reviewer; gates merges | M9 handoff bundle |
| `agents/tdd-coach.md` | TDD discipline enforcer | M9 handoff bundle |
| `agents/critic.md` | Adversarial review; finds blind spots | M4 (red-team blueprint); M8 (verification) |
| `agents/judge.md` | Decision arbiter (resolves disagreement between agents) | M9 (multi-agent build orchestration) |
| `agents/docs.md` | Documentation owner | M9 handoff bundle |
| `agents/ops.md` | Operations / on-call persona | M9 handoff bundle (operator-facing runbook) |
| `agents/post-incident.md` | Post-incident review persona | M9 handoff bundle |
| `agents/guardrails-sentinel.md` | Cross-cutting guardrail enforcement | atl-mcp's own anti-slop / iron-law enforcement (mirrors `quality/enforcement-v2/`) |

### C.2 — Workflows (19 orchestration patterns)

| velocity source | What it is | atl-mcp use |
|---|---|---|
| `workflows/multi-agent-flow.md` | Wave-based execution + worktree-per-agent + sync gates | M9 multi-agent build orchestration |
| `workflows/feature-flow.md` | Feature → spec → task decomposition with dependency tracking | M5 planner |
| `workflows/tdd-flow.md` | Red-green-refactor cycle with mutation-testing gates | M9 handoff bundle |
| `workflows/decision-flow.md` | Trade-off matrix + risk assessment + stakeholder input | M4 stack-choice; M6 architecture |
| `workflows/deploy-flow.md` | Deployment ceremony (staging → prod) with rollback plan | M8 verification + M9 handoff (pre-filled) |
| `workflows/incident-flow.md` | Incident response (detect → mitigate → resolve) | M9 handoff bundle (runbook seed) |
| `workflows/session-handoff.md` | Agent session resumption (context recovery, state transfer) | M9 (maps directly to atl-mcp's handoff need) |

The remaining 12 workflows are domain-specific to consulting engagements (review-flow, retainer-flow, etc.) and are not in scope.

---

## 5. Section D — Stack-decision modules

Total: **38 stack/governance modules in `velocity-ops-engine/modules/`.** When the operator picks a stack for the new project, the matching module(s) become Confluence stack-guide pages plus a section appended to the new repo's `CLAUDE.md`.

| velocity source | Stack choice it supports | Generated artifacts | Notes |
|---|---|---|---|
| `modules/nextjs-15.md` | Next.js 15 App Router | Confluence "Stack Guide → Next.js 15" + CLAUDE.md section + repo scaffold (next.config.ts stub) | RSC patterns, server actions, middleware, Playwright/Vitest testing |
| `modules/astro-5.md` | Astro 5 (islands + SSG) | Confluence + CLAUDE.md + repo scaffold | Static-first, content-heavy, low JS footprint |
| `modules/fastapi.md` | FastAPI (Python async) | Confluence + CLAUDE.md + repo scaffold (main.py stub) | Pydantic, OpenAPI auto-docs, async/await discipline |
| `modules/drizzle-orm.md` | Drizzle ORM (TypeScript-first DB) | Confluence + CLAUDE.md + repo scaffold | Pairs with PostgreSQL/MySQL; type-safe schema |
| `modules/firebase.md` | Firebase (BaaS) | Confluence + CLAUDE.md + repo scaffold | Auth + Firestore + Functions; serverless |
| `modules/nodejs-runtime.md` | Node.js baseline | CLAUDE.md (always included) | Async/await discipline, module resolution, signals |
| `modules/mcp-development.md` | Building an MCP server | Confluence + CLAUDE.md + repo scaffold (if project IS an MCP server) | Tool definitions, schema validation, resource URIs |
| `modules/guardrails.md` | Cross-cutting guardrails (always-on) | CLAUDE.md (always included) + `.husky/pre-commit` stubs | Conversation guardrails, assumption verification, scope control |
| `modules/assumption-check.md` | Assumption verification protocol | `.ai/assumption-check.md` reference + injected into M4 prompt | Cross-cutting; not stack-specific |
| `modules/[other 29 modules]` | Various (TypeScript strict, vitest, ESLint, Tailwind, Prisma, tRPC, etc.) | One Confluence stack-guide page per chosen module | Selected per project's stack choice |

The selection rule is straightforward: the operator's stack choice during M4 maps to a list of `modules/` entries, all of which get pulled into the generated artifacts in M6b/M6c.

---

## 6. Section E — Quality gates (carry over from first analysis)

These were the Tier 1 finds from the original pass and remain in scope. With M4–M9 work, they become more critical (M7 context packs and M8 verification are exactly where these gates fire).

| velocity source | Size | What it does | atl-mcp use | Tier |
|---|---|---|---|---|
| `quality/enforcement-v2/session-start.sh` | small bash | Runs at session start; loads context, checks repo state | atl-mcp's own `.claude/settings.json` SessionStart hook + seeded into new repos | Tier 1 |
| `quality/enforcement-v2/pre-write-check.sh` | small bash | Validates writes before they hit disk | Seeded into new repos at `.claude/hooks/`; gates unsafe writes | Tier 1 |
| `quality/enforcement-v2/pre-bash-check.sh` | small bash | Validates Bash commands before execution | Seeded into new repos | Tier 1 |
| `quality/enforcement-v2/compression-detector.sh` | small bash | Detects context compression during sustained work | atl-mcp's own hook (iron-law enforcement) + seeded into new repos | Tier 1 |
| `quality/enforcement-v2/verify-before-done.sh` | small bash | End-of-session: verifies all artifacts complete before claim of done | atl-mcp's own iron-law enforcement + M9 handoff readiness gate | Tier 1 |
| `quality/enforcement-v2/error-halt.sh` | small bash | Halts on first error to prevent cascading failures | atl-mcp's own + seeded into new repos | Tier 1 |
| `quality/enforcement-v2/read-tracker.sh` | small bash | Tracks file-read coverage during a session | atl-mcp's own (helps with the "verify inability before handoff" memory rule) | Tier 1 |
| `quality/enforcement-v2/pre-write-voice-check.sh` | small bash | Voice / plain-language gate before writes | atl-mcp's own — pairs directly with `plain-language-reference.md`; warn-mode first, then enforce | Tier 1 |
| `quality/enforcement-v2/prompt-submit-voice.sh` | small bash | Voice gate at prompt-submit time | atl-mcp's own; same justification as above | Tier 1 |
| `semgrep/stub-detection.yml` | 230 lines YAML | 12 rules: `throw new Error("not implemented")`, placeholder returns, truncation markers, `console.log`-only files, empty catches, hardcoded `example.com`, etc. | atl-mcp's `npm run lint:semgrep` (replaces or runs alongside `scripts/anti-stub-scan.ts`); also seeded into new repos | Tier 1 |
| `velocity-ops-engine/.husky/pre-commit` | 48 lines | Pre-commit gate orchestrating lint-staged + typecheck + semgrep + security scan + large-file gate | atl-mcp adopts directly (atl-mcp has no `.husky/pre-commit` today); also seeded into new repos | Tier 1 |
| `quality/pre-commit-security-scan.sh` | ~16 KB bash | API contract checks, migration safety, dep audit, mutation detection | Adapt for atl-mcp (strip consulting-specific rules; add provider-token-encryption audit, Drizzle migration safety) | Tier 2 |
| `benchmarks/rubric.md` + `task-catalog.md` + `task-matrix.md` + `adapters/` + `tasks/` + `fixtures/` | ~5 KB rubric + variable fixtures | 30-point conformance rubric (completeness / correctness / test / code-quality / safety / docs) + 6 task shapes (bounded-feature, brownfield-intent, multi-session-handoff, etc.) | M11 MCP conformance test suite seed; rubric reusable as-is, task definitions need atl-mcp-domain fixtures | Tier 2 |
| `velocity-ops-engine/.framework-manifest.json` | 37 KB JSON | Machine-readable file catalog with SHA256, size, category | Pattern to adopt in atl-mcp + seed into new repos for governance | Tier 2 |

---

## 7. Section F — Things velocity-ops-engine has that atl-mcp does NOT need

Listed with one-line reasons so future readers don't relitigate.

| velocity asset | Reason atl-mcp skips |
|---|---|
| Consulting engagement shapes (12 types: BUILD, REVIEW, RETAINER, etc.) | atl-mcp is always a BUILD project; engagement shape is implicit |
| Pricing templates and pricing intelligence | atl-mcp is not responsible for project pricing; scope yes, cost no |
| `engine/phases/04-contract/` | Contract negotiation is out of scope; atl-mcp's input is an already-approved brief |
| Buyer "red flag" checklists | Not applicable; atl-mcp assumes the brief and intent are already validated |
| `engine/credentials.md` (operator's "can I serve this client" gating) | Operator-personal; not transferable |
| `engine/verticals/` (industry-specific configs) | Useful as a research lookup; not part of the generation pipeline |
| Multi-engagement portfolio dashboard | Single-project focus in atl-mcp |
| Post-consultation follow-up sequences | atl-mcp's responsibility ends at handoff |
| `commands/` (40 slash commands like `/engage-intake`, `/engage-delivery`) | atl-mcp exposes its own MCP tool surface (~35 `admin.*` and the agent-facing tools); these are domain-specific |
| `playbook/` (sales / go-to-market / delivery operations) | Orthogonal domain |
| `contributions/{accepted,pending,rejected}/` (contribution-gating system) | Reinvents GitHub PRs + ADRs |
| `.daem0nmcp/`, `.playwright-mcp/` | atl-mcp is itself an MCP server, not a consumer; inverse direction |
| Language-specific scanner variants (`scanner-python.sh`, `scanner-go.sh`, `scanner-rust.sh`) | atl-mcp is TypeScript-only |
| `archive/ai-coding-framework/`, `archive/Consulting-Playbook/` | Historical; useful for inspiration only; already mined by velocity-ops-engine itself |
| `quality/ci-pipeline.md` (29 KB CI doc) | atl-mcp's v6 spec is more comprehensive; this would duplicate |
| `quality/ai-review-maturity-model.md` (CMMI-style 5-level model) | atl-mcp uses v6 RM (Reliability Model); different framework |

---

## 8. Section G — Implementation sequencing

Ordered by milestone consumption so the work compounds.

### Phase 0 — Foundations (do these first; unblock everything)

1. **Adopt `quality/enforcement-v2/*.sh` into atl-mcp's own `.claude/hooks/`** — these enforce iron laws atl-mcp already publishes. Wire each via `.claude/settings.json` hook events (SessionStart, PreToolUse, PostToolUse, Stop). Voice hooks start in warn-mode.
2. **Lift `semgrep/stub-detection.yml`** to `atl-mcp/semgrep/stub-detection.yml`. Add `npm run lint:semgrep` script. Add to `npm test` after passing locally.
3. **Install `.husky/pre-commit`** in atl-mcp (greenfield; doesn't exist today). Strip consulting-specific scan rules; keep typecheck + semgrep + no-stdout + lint-staged.
4. **Adopt `.framework-manifest.json` pattern** for atl-mcp. Build the manifest once via a small script; categorize files (auto-update vs manual-merge vs seed-only). Lightweight; high governance value.

### Phase 1 — M4 (intake + blueprint)

1. **Read `engine/phases/01-intake/README.md` + `02-discovery/README.md` + `03-scoping/README.md`.** Extract the protocol structure into atl-mcp's M4 prompt skeleton.
2. **Convert `templates/research-intake.md` → `ProjectIntake` Zod schema** (extends `src/domain/projectIntake.ts`).
3. **Convert `templates/requirements-catalog.md` → requirements artifact shape** stored on `ProjectBlueprint.requirements`.
4. **Adopt `agents/architect.md` + `researcher.md` + `thinking-partner.md` as personas** for atl-mcp's M4 blueprint synthesizer (sub-agent prompts).
5. **Wire `workflows/decision-flow.md`** as a sub-procedure inside M4 for non-obvious choices (stack, hosting, auth model).
6. **Implement `project_intake_create` MCP tool end-to-end** taking a brief + intent and producing a `ProjectBlueprint` containing `requirements`, `features`, `epics`, `architecture`, plus drafted ADRs, SLO definitions, and a threat-model outline. Test against a fixture brief (e.g., one of the live PCO/DriverForge briefs).

### Phase 2 — M5 (planner + preview)

1. **Read `engine/phases/05-setup/README.md`** for the setup-phase protocol.
2. **Adopt `workflows/feature-flow.md`** as the per-feature decomposition algorithm.
3. **Implement the planner**: blueprint → provisioning plan (Jira issue tree shape, Confluence page tree, repo scaffold spec). Output is a structured plan that the M6 executors consume; preview returns the same shape without side effects.

### Phase 3 — M6a (Jira executor)

1. **Adopt `engine/phases/03-scoping/templates/sow-outline.md`** as the canonical Jira issue tree shape.
2. **Implement `provisioning_jira_execute`**: takes the M5 plan + the Jira project type and creates the project, epics, stories, and subtasks with the right links. Uses atl-mcp's existing `JiraProvider`.
3. **Test against PCO** (the live demo project) — adopt-then-extend a known good shape.

### Phase 4 — M6b (Confluence executor)

1. **Implement `provisioning_confluence_execute`**: takes the M5 plan + the chosen stack, walks the template inventory (Section B.1), and emits one page per template instance.
2. **Stack-module page generation**: for each chosen stack, emit one **Stack Guide** page from `modules/<stack>.md`.
3. **Test against ACO** (the live demo space) — generate the full doc tree and confirm rendering.

### Phase 5 — M6c (VCS executor)

1. **Implement `provisioning_vcs_execute`**: takes the M5 plan + the chosen stack, creates the Bitbucket repo, scaffolds per Section B.2 (CONTEXT.md, AGENTS.md, CLAUDE.md, .husky, semgrep, .claude/hooks, .ai/, ADR seeds).
2. **Stack-aware scaffolding**: drives `package.json` / `pyproject.toml` / etc. per stack module.
3. **Initial commit + branch protection** as part of the executor's contract.

### Phase 6 — M7 (context packs) + M9 (handoff)

1. **Adopt `engine/phases/09-handoff/templates/handoff-checklist.md`** as M9's pre-handoff verification gate.
2. **Adopt `engine/phases/09-handoff/templates/proof-asset-capture.md`** as the structured field set the M9 handoff packet emits (links to provisioned Jira / Confluence / repo + commit hashes + audit-chain entry IDs).
3. **Bundle agent role cards into the new repo's `AGENTS.md`** during M6c; the handoff packet references them.
4. **Wire `verify-before-done.sh`** as the M9 readiness gate; only ship the handoff once it passes.

### Phase 7 — Quality (cross-cutting)

1. **Adapt `benchmarks/rubric.md`** for atl-mcp's M11 conformance suite. Keep the 6 dimensions (completeness / correctness / test / code-quality / safety / docs); rewrite scoring criteria for MCP-tool behavior.
2. **Adapt `benchmarks/task-catalog.md`** to atl-mcp's domain (intake-to-handoff fixtures rather than consulting-engagement shapes).
3. **Adapt `quality/pre-commit-security-scan.sh`** for atl-mcp (strip consulting-specific rules; add provider-token-encryption audit + Drizzle migration safety + Redis key injection audit).

---

## 9. Section H — Complete file inventory (absolute paths)

### Lifecycle phase definitions (10 files; **read first**)

```
C:\Users\Chris\Documents\git\velocity-ops-engine\engine\phases\01-intake\README.md
C:\Users\Chris\Documents\git\velocity-ops-engine\engine\phases\02-discovery\README.md
C:\Users\Chris\Documents\git\velocity-ops-engine\engine\phases\03-scoping\README.md
C:\Users\Chris\Documents\git\velocity-ops-engine\engine\phases\04-contract\README.md  (skip — out of scope)
C:\Users\Chris\Documents\git\velocity-ops-engine\engine\phases\05-setup\README.md
C:\Users\Chris\Documents\git\velocity-ops-engine\engine\phases\06-architecture\README.md
C:\Users\Chris\Documents\git\velocity-ops-engine\engine\phases\07-delivery\README.md
C:\Users\Chris\Documents\git\velocity-ops-engine\engine\phases\08-verification\README.md
C:\Users\Chris\Documents\git\velocity-ops-engine\engine\phases\09-handoff\README.md
C:\Users\Chris\Documents\git\velocity-ops-engine\engine\phases\10-operations\README.md
```

### High-priority templates (15 of 68; the generator core)

```
C:\Users\Chris\Documents\git\velocity-ops-engine\templates\project-brief.md
C:\Users\Chris\Documents\git\velocity-ops-engine\templates\prd.md
C:\Users\Chris\Documents\git\velocity-ops-engine\templates\architecture-decision.md
C:\Users\Chris\Documents\git\velocity-ops-engine\templates\slo-definition.md
C:\Users\Chris\Documents\git\velocity-ops-engine\templates\threat-model.md
C:\Users\Chris\Documents\git\velocity-ops-engine\templates\feature-spec.md
C:\Users\Chris\Documents\git\velocity-ops-engine\templates\task-spec.md
C:\Users\Chris\Documents\git\velocity-ops-engine\templates\runbook.md
C:\Users\Chris\Documents\git\velocity-ops-engine\templates\common-tasks-runbook.md
C:\Users\Chris\Documents\git\velocity-ops-engine\templates\contributing.md
C:\Users\Chris\Documents\git\velocity-ops-engine\templates\incident-response.md
C:\Users\Chris\Documents\git\velocity-ops-engine\templates\requirements-catalog.md
C:\Users\Chris\Documents\git\velocity-ops-engine\templates\session-handoff.md
C:\Users\Chris\Documents\git\velocity-ops-engine\templates\api-standards.md
C:\Users\Chris\Documents\git\velocity-ops-engine\templates\git-branching.md
[+53 more templates available in /templates/; browse for cases not covered above]
```

### Agent role cards (13 files)

```
C:\Users\Chris\Documents\git\velocity-ops-engine\agents\architect.md
C:\Users\Chris\Documents\git\velocity-ops-engine\agents\implementer.md
C:\Users\Chris\Documents\git\velocity-ops-engine\agents\tester.md
C:\Users\Chris\Documents\git\velocity-ops-engine\agents\reviewer.md
C:\Users\Chris\Documents\git\velocity-ops-engine\agents\tdd-coach.md
C:\Users\Chris\Documents\git\velocity-ops-engine\agents\researcher.md
C:\Users\Chris\Documents\git\velocity-ops-engine\agents\thinking-partner.md
C:\Users\Chris\Documents\git\velocity-ops-engine\agents\critic.md
C:\Users\Chris\Documents\git\velocity-ops-engine\agents\docs.md
C:\Users\Chris\Documents\git\velocity-ops-engine\agents\judge.md
C:\Users\Chris\Documents\git\velocity-ops-engine\agents\guardrails-sentinel.md
C:\Users\Chris\Documents\git\velocity-ops-engine\agents\ops.md
C:\Users\Chris\Documents\git\velocity-ops-engine\agents\post-incident.md
```

### Workflows in scope (7 of 19)

```
C:\Users\Chris\Documents\git\velocity-ops-engine\workflows\multi-agent-flow.md
C:\Users\Chris\Documents\git\velocity-ops-engine\workflows\feature-flow.md
C:\Users\Chris\Documents\git\velocity-ops-engine\workflows\tdd-flow.md
C:\Users\Chris\Documents\git\velocity-ops-engine\workflows\decision-flow.md
C:\Users\Chris\Documents\git\velocity-ops-engine\workflows\deploy-flow.md
C:\Users\Chris\Documents\git\velocity-ops-engine\workflows\incident-flow.md
C:\Users\Chris\Documents\git\velocity-ops-engine\workflows\session-handoff.md
[+12 more in /workflows/; mostly consulting-domain-specific]
```

### Stack modules (38 files; pick per project)

```
C:\Users\Chris\Documents\git\velocity-ops-engine\modules\nextjs-15.md
C:\Users\Chris\Documents\git\velocity-ops-engine\modules\astro-5.md
C:\Users\Chris\Documents\git\velocity-ops-engine\modules\fastapi.md
C:\Users\Chris\Documents\git\velocity-ops-engine\modules\drizzle-orm.md
C:\Users\Chris\Documents\git\velocity-ops-engine\modules\firebase.md
C:\Users\Chris\Documents\git\velocity-ops-engine\modules\nodejs-runtime.md
C:\Users\Chris\Documents\git\velocity-ops-engine\modules\guardrails.md
C:\Users\Chris\Documents\git\velocity-ops-engine\modules\mcp-development.md
C:\Users\Chris\Documents\git\velocity-ops-engine\modules\assumption-check.md
[+29 more in /modules/]
```

### Quality / enforcement (Tier 1 — adopt now)

```
C:\Users\Chris\Documents\git\velocity-ops-engine\quality\enforcement-v2\session-start.sh
C:\Users\Chris\Documents\git\velocity-ops-engine\quality\enforcement-v2\pre-write-check.sh
C:\Users\Chris\Documents\git\velocity-ops-engine\quality\enforcement-v2\pre-bash-check.sh
C:\Users\Chris\Documents\git\velocity-ops-engine\quality\enforcement-v2\compression-detector.sh
C:\Users\Chris\Documents\git\velocity-ops-engine\quality\enforcement-v2\verify-before-done.sh
C:\Users\Chris\Documents\git\velocity-ops-engine\quality\enforcement-v2\error-halt.sh
C:\Users\Chris\Documents\git\velocity-ops-engine\quality\enforcement-v2\read-tracker.sh
C:\Users\Chris\Documents\git\velocity-ops-engine\quality\enforcement-v2\pre-write-voice-check.sh
C:\Users\Chris\Documents\git\velocity-ops-engine\quality\enforcement-v2\prompt-submit-voice.sh
C:\Users\Chris\Documents\git\velocity-ops-engine\quality\enforcement-v2\README.md
C:\Users\Chris\Documents\git\velocity-ops-engine\semgrep\stub-detection.yml
C:\Users\Chris\Documents\git\velocity-ops-engine\.husky\pre-commit
C:\Users\Chris\Documents\git\velocity-ops-engine\.husky\commit-msg
C:\Users\Chris\Documents\git\velocity-ops-engine\.framework-manifest.json
C:\Users\Chris\Documents\git\velocity-ops-engine\quality\pre-commit-security-scan.sh
```

### Conformance harness (M11)

```
C:\Users\Chris\Documents\git\velocity-ops-engine\benchmarks\rubric.md
C:\Users\Chris\Documents\git\velocity-ops-engine\benchmarks\task-catalog.md
C:\Users\Chris\Documents\git\velocity-ops-engine\benchmarks\task-matrix.md
C:\Users\Chris\Documents\git\velocity-ops-engine\benchmarks\results-summary.md
C:\Users\Chris\Documents\git\velocity-ops-engine\benchmarks\adapters\
C:\Users\Chris\Documents\git\velocity-ops-engine\benchmarks\fixtures\
C:\Users\Chris\Documents\git\velocity-ops-engine\benchmarks\tasks\
C:\Users\Chris\Documents\git\velocity-ops-engine\benchmarks\runs\
```

---

## 10. Section I — Risks and open questions

### Risks

- **License.** No `LICENSE` file in `velocity-ops-engine`; `README.md` and `CLAUDE.md` don't state terms. Both repos belong to the same operator, so the lift is intra-portfolio. Before publishing atl-mcp's partner credit (`docs/partners/velocity-ops-engine.md`), confirm the intended license posture for the lifted artifacts.
- **Bash-on-Windows.** All `quality/enforcement-v2/*.sh` are bash. atl-mcp runs on Windows; cygwin bash is available. Smoke-test each hook on Windows before committing.
- **Voice-check aggressiveness.** `pre-write-voice-check.sh` and `prompt-submit-voice.sh` will block writes containing delete-on-sight terms (`simply`, `leverage`, etc.). Start in warn-only mode for two weeks; promote to blocking once the noise floor is known.
- **Template variable schema drift.** Velocity templates use ad-hoc `{var_name}` slots. Pin a substitution-engine convention (Mustache? Plain `${var}`?) before the first generator lands; document it in this file.
- **Stack-module currency.** Some `modules/` may be dated (Next.js 15 was current at velocity's authoring; atl-mcp may run after Next.js 16 ships). Re-validate each module's stack-version claims when first lifted.
- **Confluence storage format vs ADF.** Generated pages must respect ADR 0003's storage-default-ADF-flagged decision. The Confluence executor must render templates to ADF (not raw markdown) where required.

### Open questions

1. **What's the canonical input shape?** The brief is described as "research brief + quick intent summary" — should that be one MCP tool input (`project_intake_create({brief, intent})`) or two separate calls (`project_brief_ingest` then `project_intake_create`)? Both are buildable; the choice affects how partial-input projects are handled.
2. **Stack-choice selection model.** Operator-explicit (operator names the stack) or AI-recommended (M4 sub-agent recommends based on requirements + constraints)? Velocity's `agents/thinking-partner.md` + `workflows/decision-flow.md` support either; atl-mcp needs to pick.
3. **Multi-stack projects.** Some projects need a frontend + backend + DB stack (e.g., Next.js + FastAPI + Postgres). Confirm the generator concatenates module sections cleanly into a single CLAUDE.md vs producing separate per-stack files.
4. **Adopt-then-modify flow.** atl-mcp already has `admin.projects.adopt` for existing Atlassian projects (the conversation introduced it). Should the new intake-to-handoff flow be the default for new projects, with `adopt` reserved for pre-existing projects? Likely yes — confirm before implementing.
5. **Iteration on the blueprint.** What happens when the operator disagrees with M4's blueprint? A `project_blueprint_revise` tool? Velocity's `agents/critic.md` is a candidate persona for the revision dialog.

### Updates required when this file changes

Per the catalog rule in `CLAUDE.md`: any change to `docs/velocity-ops-port-plan.md` that adds, removes, renames, or substantially modifies sections updates [`docs/documentation-catalog.md`](documentation-catalog.md) in the same change.

---

**The bottom line.** atl-mcp's M4–M9 work doesn't start from a blank page. velocity-ops-engine is a 10-phase lifecycle, 68 templates, 13 agent personas, 19 workflows, 38 stack modules, and a hardened quality-gate stack — almost all of it portable with adapt-not-rewrite effort. The build sequence above turns those artifacts into the intake-to-handoff capability the operator described.
