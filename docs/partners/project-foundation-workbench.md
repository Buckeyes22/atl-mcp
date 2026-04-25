# Partner Integration: project-foundation-workbench

## 1. Why this partner

**Category: B (pattern-lift).** project-foundation-workbench is the framework-governance template from which the project-foundation TS monorepo was built. It contributes 7 findings to v6:

- **F-076** → §6.1 (PHASE-STATE.json with lockable checkpoints + `/resume`)
- **F-077** → §17.4, §31 (5-category test framework UT/IT/ST/PT/E2E with auditable Not-Applicable)
- **F-078** → M5 (14 slash commands: /inception, /decompose, /groom, /wave, /implement, /review, /sync, /drift-check, /sync-configs, /run-wave, /resume, /build, /build-continue + one more)
- **F-082** → §5, §35.5 (unidirectional sync architecture `SYNC.md`)
- **F-085** → §8, §9, M9 (`scripts/syncAgentConfigs.ts` regenerates Cursor / Codex / Copilot configs from canonical AGENTS.md)
- **F-086** → §35.4 (context source hierarchy: project files > stack refs > Context7 > training)
- **F-207** → §20.gotchas (large-file handling: never >200 lines all-at-once; offset+limit)

**Gap closed**: v6 needs orchestration governance (phase state machine), test-framework definitions, slash command surface, unidirectional sync architecture, and context hierarchy. workbench supplies all five. PHASE-STATE.json with `locked_spec` for concurrent-safety surpasses §6's enum-only state machine.

**Findings reference**: `repo-extraction-findings.md` lines 848–863, L1287, §40 F-076, F-077, F-078, F-082, F-085, F-086, F-207.

## 2. Prerequisites

N/A — pattern-lift; no runtime dependency. workbench is a template library, not a service.

## 3. Source provenance

`project-foundation-workbench` repository (templates only — no app code). Pin commit SHA in v6 §40 F-076 row. **No install required**: copy pattern snippets into orchestrator codebase.

## 4. Configuration

### 4.1 Slash command names

```
/inception /decompose /groom /wave /implement /review
/sync /drift-check /sync-configs /run-wave /resume /build /build-continue
```

### 4.2 Agent-config sync script

`scripts/syncAgentConfigs.ts` regenerates `.cursor/rules/agents.mdc` and `.github/copilot-instructions.md` from canonical `AGENTS.md`. Integrate into M9.

## 5. Adoption points in v6

- **F-076** → **§6.1** (PHASE-STATE.json with `current_phase`, `current_task`, `task_statuses`, `locked_spec`, `checkpoints`; lockable for concurrent-safety; `/resume` reads checkpoint)
- **F-077** → **§17.4** + **§31** (5-category test framework UT/IT/ST/PT/E2E; mandatory auditable "Not Applicable" claims)
- **F-078** → **M5** (14 slash commands as canonical planner surface; agents execute to completion; stop only on spec done / ambiguity / security decision / unrecoverable error / missing dep)
- **F-082** → **§5** + **§35.5** (unidirectional sync: repo → tracker; agents NEVER read tracker state for decisions; tracker outage non-blocking)
- **F-085** → **§8** + **§9** + **M9** (`scripts/syncAgentConfigs.ts` regenerates `.cursor/rules/agents.mdc` + `.github/copilot-instructions.md` from canonical AGENTS.md; CLAUDE.md intentionally diverges)
- **F-086** → **§35.4** (context source hierarchy: 1. project files → 2. stack refs → 3. Context7 / live docs → 4. training knowledge)
- **F-207** → **§20.gotchas** (large-file handling: never >200 lines all-at-once; use offset+limit; agent operating rule)

## 6. Pattern excerpts

**PHASE-STATE.json shape** (F-076):
```json
{
  "current_phase": "wave",
  "current_task": "implement",
  "task_statuses": { "inception": "completed", "decompose": "completed" },
  "locked_spec": "SPEC-FEAT-001",
  "checkpoints": [
    { "timestamp": "2025-04-24T14:30:00Z", "phase": "decompose", "artifacts": [] }
  ]
}
```

**Slash command list** (F-078):
```ts
const SLASH_COMMANDS = [
  "inception", "decompose", "groom", "wave", "implement", "review",
  "sync", "drift-check", "sync-configs", "run-wave", "resume", "build", "build-continue"
] as const;
```

**syncAgentConfigs.ts signature** (F-085):
```ts
export async function syncAgentConfigs(
  agentsMdPath: string,
  outputCursor: string,
  outputCopilot: string,
  logger: Logger
): Promise<{ cursorRules: string; copilotInstructions: string }>;
```

**Context source hierarchy** (F-086):
1. Project files (highest) — CLAUDE.md, repo code
2. Stack reference files — ADRs, architectural guides
3. Context7 MCP / live docs — real-time external service docs
4. Training knowledge (lowest) — published frameworks, best practices

## 7. Gotchas

1. **PHASE-STATE.json lock contention**: concurrent agents reading `locked_spec` must skip on conflict, never wait. Deadlock risk if any agent blocks on lock acquisition. (findings.md L853; F-076)
2. **5-category test "Not Applicable" abuse**: teams mark ST/PT/E2E as N/A to hide incomplete coverage. Audit every N/A claim in code review; v6 §31.2 anti-slop linter flags vague rationales. (findings.md L851; F-077)
3. **Slash command name collisions**: the 13–14 names are canonical. If a project overloads `/sync` or `/review` with custom semantics, agents execute the wrong plan. Validate at startup. (findings.md L854; F-078)
4. **Unidirectional sync direction inversion**: if agents ever *read* tracker state for decisions, sync becomes bidirectional, breaking repo-driven autonomy. Audit agent decision logic; block tracker reads at policy boundary. (findings.md L855; F-082)
5. **Agent config regeneration drift**: hand-edits to `.cursor/rules/agents.mdc` are overwritten on next `syncAgentConfigs.ts` run. Treat generated files as generated; all edits go to AGENTS.md. (findings.md L858; F-085)
6. **Context hierarchy fallthrough**: a query that finds nothing in project files may fall back to Stack references with stale docs. Verify Context7 live-doc refresh enabled (v6 §35.3). (findings.md L856; F-086)
7. **Large-file 200-line guard**: agents reading codebase files must never slurp >200 lines into context at once; use offset+limit. Violations cause silent context-window bloat. (findings.md L861, L1287; F-207)

## 8. Validation

```bash
# 1. PHASE-STATE.json schema
orchestrator cli phase validate --state PHASE-STATE.json
# Expect: validates against v6 §6.1 schema

# 2. Slash command names enumerated
orchestrator cli commands list
# Expect: all 13-14 names from F-078 present

# 3. 5-category test enum
orchestrator cli test describe-categories
# Expect: UT, IT, ST, PT, E2E with auditable Not-Applicable

# 4. Sync architecture (unidirectional)
orchestrator cli sync status
# Expect: repo → tracker only; no inbound reads

# 5. Agent config regeneration
pnpm exec ts-node scripts/syncAgentConfigs.ts \
  --agents AGENTS.md \
  --cursor .cursor/rules/agents.mdc \
  --copilot .github/copilot-instructions.md
# Expect: regenerated files; git diff shows no manual edits

# 6. Context hierarchy ordering
orchestrator cli context sources --project-id test --verbose
# Expect: source rank 1=project, 2=stack, 3=context7, 4=training

# 7. Large-file guard
orchestrator cli agent --mode read-large-file --file large.ts --offset 0 --limit 150
# Expect: returns only 150 lines
```

## 9. Operational concerns

- **Upstream archival risk: low.** workbench is a template repo. If archived, the orchestrator's integration layer (slash command enum, PHASE-STATE.json schema, test-category definitions, sync script) is already vendored into the orchestrator codebase. No runtime dependency.
- **Version pinning policy**: pin workbench to a commit SHA. Slash command additions in later commits are backward-compatible; semantic breaking changes (renaming commands, modifying test categories, changing phase counts) require an orchestrator version bump.
- **Upgrade path**: (a) clone at new SHA, (b) verify §8 validation passes, (c) if test categories or phases change, update v6 §17.4 and §6.1, (d) regenerate PHASE-STATE.json schema if needed.
- **Ownership**: orchestrator team owns slash command routing, phase-state persistence, test-framework integration, and `syncAgentConfigs.ts`. workbench is reference template; maintainers do not have operational responsibility for the running orchestrator.
- **In-tree absorption**: PHASE-STATE.json schema in `src/state/phaseState.ts`, slash commands in `src/cli/commands/`, test-category enum in `src/testing/categories.ts`, sync architecture in `src/sync/`, sync script in `scripts/syncAgentConfigs.ts`.
