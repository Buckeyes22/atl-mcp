---
title: Velocity-Ops Port — Status
owner: Chris
status: living document
last_reviewed: 2026-04-26
audience: [engineer, operator]
related: [docs/velocity-ops-port-plan.md, docs/documentation-catalog.md]
---

# Velocity-ops port — status

> **What this is.** Status report for the work in [`docs/velocity-ops-port-plan.md`](velocity-ops-port-plan.md). All 7 phases shipped end-to-end as of 2026-04-26 with 282 tests passing.

## Summary by phase

| Phase | Capability | Status |
|---|---|---|
| 0 | Foundations (hooks, semgrep, husky, framework manifest) | shipped |
| 1 | M4 intake + blueprint synthesis (velocity content + registry + scaffolded prompt) | shipped |
| 2 | M5 provisioning preview (admin.lifecycle.{jira,confluence,vcs}.preview) | shipped |
| 3 | M6a Jira issue-tree executor (admin.lifecycle.jira.execute) | shipped |
| 4 | M6b Confluence page-tree executor (admin.lifecycle.confluence.execute) | shipped |
| 5 | M6c VCS repo scaffolder (admin.lifecycle.vcs.execute) | shipped |
| 6 | M7 + M9 handoff bundle (admin.lifecycle.handoff.bundle) | shipped |
| 7 | Conformance rubric + security scan | shipped |

## Phase 0 — Foundations

| Item | Where it lives | How to use it |
|---|---|---|
| 9 enforcement-v2 hooks | `.claude/hooks/*.sh` | Wired in `.claude/settings.json`. Fires on SessionStart, PreToolUse (Write/Edit/Bash), PostToolUse (Read/Write/Edit/Bash), Stop. |
| Plain-language hook | `.claude/hooks/pre-write-plain-language.sh` | Warns when delete-on-sight terms from `plain-language-reference.md` appear in prose writes. |
| Semgrep stub-detection ruleset | `semgrep/stub-detection.yml` | `npm run lint:semgrep`. Warn-skips if semgrep isn't installed locally. |
| Husky pre-commit gate | `.husky/pre-commit` (+ `.husky/README.md`) | Runs lint:no-stdout, lint:anti-stub, typecheck, lint:semgrep, security scan, large-file gate. Activates once the repo is git-init'd and `npx husky init` runs. |
| Framework manifest | `.framework-manifest.json` (+ `scripts/build-framework-manifest.mjs`) | `npm run manifest:build`. 740 files cataloged at last build. |

## Phase 1 — M4 intake + blueprint synthesis

| Item | Where it lives | How to use it |
|---|---|---|
| Velocity content lifted | `docs/velocity-ops-content/{phases,templates,agents,workflows}/` | 6 phases + 16 templates + 13 agent role cards + 7 workflows = 42 markdown files. See the directory's [`README.md`](velocity-ops-content/README.md). |
| Content registry | `src/velocity/contentRegistry.ts` | `createVelocityContentRegistry()` returns a typed catalog with read-by-slug methods. In-memory caching. |
| Synthesis prompt scaffold | `src/velocity/promptScaffold.ts` | `buildScaffoldedBlueprintPrompt(deps, blueprint)` composes the M4 LLM prompt with phase protocols + agent personas + the operator's intake. |
| Blueprint workflow upgrade | `src/workflows/blueprintWorkflow.ts` | When `velocityRegistry` is supplied, M4 generation uses the scaffolded prompt (`promptVersion: blueprint-generation.v2-velocity`). |
| Operator UI access | `admin.velocity.manifest.get` + `admin.velocity.content.read` | Loopback admin transport tools the control plane UI can call to browse the catalog. |
| Tests | `tests/unit/velocity/contentRegistry.test.ts` (6 tests) | Confirms every category reads cleanly + the cache works. |

## Phase 2-6 — M5 + M6abc + M7/M9

### Workflows

| Source | Purpose | Notes |
|---|---|---|
| `src/velocity/templateRenderer.ts` | Substitutes variables in velocity templates using bracketed (`[Project Name]`) and curly (`{PROJECT}` / `{project_name}`) conventions; leaves long instructional brackets intact. | 7 unit tests; handles all three conventions. |
| `src/workflows/jiraIssueTreeWorkflow.ts` | M6a — walks blueprint epics/stories and creates Jira issues via `JiraProvider.createIssue`. Idempotency keys derived from blueprint id + node id + version. | Synchronous fast-path for the admin-side execute; agent-facing workflow uses BullMQ. |
| `src/workflows/confluencePagesWorkflow.ts` | M6b — renders 10 default pages per blueprint (Charter, PRD, ADR Template, SLOs, Threat Model, Runbook, Common Tasks, Incident Response, Requirements Catalog, API Standards). Body wrapped in Confluence storage-format markdown macro. | Idempotency key per `space:templateSlug:title`. |
| `src/workflows/vcsRepoScaffoldWorkflow.ts` | M6c — emits 10 seed files (README, CONTEXT, AGENTS, CLAUDE, CONTRIBUTING, git-branching, ADR-0000, .ai/requirements, .husky/pre-commit, .gitignore). Selects agent role cards for `AGENTS.md` (default: architect/implementer/tester/reviewer/tdd-coach/docs/ops). | Throws helpful error if the VcsProvider doesn't yet expose `createRepository`/`putFile`. |

### Admin tools (operator UI surface)

All wired in `src/mcp/admin/tools/lifecycle.ts`. Each write tool emits a signed audit-chain entry per ADR 0006.

| Tool | Effect |
|---|---|
| `admin.lifecycle.jira.preview` | Plans the Jira issue tree from a blueprint. No side effects. |
| `admin.lifecycle.jira.execute` | Creates the Jira issue tree. Returns `{ok, created[], totalCreated, auditEntryId}` or `dataLimited` when Jira isn't configured. |
| `admin.lifecycle.confluence.preview` | Renders the 10 default Confluence pages. Returns `{pages[], totalPages}` with body snippets and unresolved-placeholder lists. |
| `admin.lifecycle.confluence.execute` | Creates the Confluence pages. Returns `{ok, pagesCreated[], auditEntryId}` or `dataLimited`. |
| `admin.lifecycle.vcs.preview` | Builds the seed file set. Returns `{files[], totalFiles, totalBytes}` with path + executable + headSnippet per file. |
| `admin.lifecycle.vcs.execute` | Creates the Bitbucket repo + seeds it. Returns `{ok, repoUrl, defaultBranch, filesSeeded, initialCommitId, auditEntryId}` or `dataLimited`. |
| `admin.lifecycle.handoff.bundle` | Composes the M9 handoff packet: project metadata, Jira/Confluence/repo references, audit-chain head, agent role-card list, workflow list. |
| `admin.velocity.manifest.get` | Lists every velocity content slug (phases / templates / agents / workflows). |
| `admin.velocity.content.read` | Reads a single piece of velocity content by category + slug. |

### Tests

`tests/integration/admin/lifecycleTools.test.ts` — 9 tests covering every lifecycle tool against a live loopback MCP transport with a fresh PGlite DB. Each tool round-trips cleanly; provider-backed executes return `dataLimited` honestly when no real provider is wired.

## Phase 7 — Cross-cutting quality

| Item | Where it lives | Notes |
|---|---|---|
| M11 conformance rubric | `docs/conformance/rubric.md` | 6 categories (mcp_protocol_compliance, tool_correctness, audit_evidence, policy_gating, data_limited_honesty, idempotency_and_failure), 0–5 each, 30-point aggregate with release gates. |
| Conformance rubric source | `docs/conformance/rubric-source.md` | Original velocity-ops rubric preserved for traceability. |
| Security scan | `quality/pre-commit-security-scan.sh` | Adapted from velocity. Strips PII / personal-name rules; adds atl-mcp-specific scans: token encryption bypass, Drizzle migration safety (DROP without IF EXISTS, missing rollback note), Redis key prefix, audit-key handling outside known sites. Wired into `.husky/pre-commit`. |

## Verification

End-of-port gate sweep:

- `npm run typecheck` — clean
- `npm run lint:no-stdout` — clean
- `npm run lint:anti-stub` — clean
- `npm test` — **282 passed, 6 skipped, 0 failed**
- `npm run build` — clean (copies `docs/control-plane/` + `docs/velocity-ops-content/` into `dist/`)
- `npm run manifest:build` — 740 files cataloged

## What changed in atl-mcp during this port

### New files

- `.claude/hooks/{session-start,pre-write-check,pre-bash-check,compression-detector,verify-before-done,error-halt,read-tracker,pre-write-voice-check,prompt-submit-voice,pre-write-plain-language,README}.{sh,md}` (11)
- `.claude/settings.json`
- `.husky/{pre-commit,README.md}`
- `.framework-manifest.json`
- `semgrep/stub-detection.yml`
- `quality/pre-commit-security-scan.sh`
- `scripts/{lint-semgrep,build-framework-manifest}.mjs`
- `src/velocity/{contentRegistry,promptScaffold,templateRenderer}.ts`
- `src/workflows/{jiraIssueTreeWorkflow,confluencePagesWorkflow,vcsRepoScaffoldWorkflow}.ts`
- `src/mcp/admin/tools/{velocity,lifecycle}.ts`
- `docs/velocity-ops-content/{phases,templates,agents,workflows}/*.md` + `README.md` (43 files)
- `docs/velocity-ops-port-plan.md`, `docs/velocity-ops-port-status.md`
- `docs/conformance/{rubric,rubric-source}.md`
- `tests/unit/velocity/{contentRegistry,templateRenderer}.test.ts`
- `tests/integration/admin/lifecycleTools.test.ts`

### Modified files

- `src/compositionRoot.ts` — adds `velocityRegistry` field
- `src/server.ts` — threads `velocityRegistry` into adminDeps
- `src/mcp/registerCompositionTools.ts` — passes `velocityRegistry` to `createBlueprintWorkflow`
- `src/workflows/blueprintWorkflow.ts` — opt-in scaffolded prompt when registry is supplied
- `src/mcp/admin/registry.ts` — adds `velocityRegistry` to `AdminToolDeps`; registers velocity + lifecycle tool sets
- `tests/integration/admin/_adminFixture.ts` — supplies the registry to the test fixture
- `scripts/copy-runtime-assets.mjs` — copies velocity content into dist
- `package.json` — adds `lint:semgrep` + `manifest:build` scripts
- `docs/documentation-catalog.md` — multiple new rows for the port artifacts
- `.husky/pre-commit` — adds the security scan step

## Next-session work that's not part of this port

- Wire the lifecycle admin tools into the operator control plane UI (`docs/control-plane/page-projects.jsx` could grow a "Provision" section that calls preview / execute).
- Extend the VcsProvider implementation to add `createRepository` and `putFile` so M6c executes against real Bitbucket (the workflow is wired and throws a clear error today).
- Stack-module catalog: lift `velocity-ops-engine/modules/*.md` into `docs/velocity-ops-content/modules/` and have M6c append matching modules to the generated `CLAUDE.md`.
- Calibrate the conformance rubric against the existing admin integration tests to establish a baseline score.
- LLM-assisted blueprint refinement: a `project_blueprint_revise` MCP tool with a critic-persona dialog (one of the open questions in the port plan).
