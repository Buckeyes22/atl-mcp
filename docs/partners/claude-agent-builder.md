# Partner Integration: claude-agent-builder

## 1. Why this partner

**Category: B (pattern-lift).** claude-agent-builder is a meta-skill for generating compliant build agents. It contributes:

- **F-110**: 6-phase agent generation workflow + 7-pattern library → §14.3 (manifest-driven `handoff_generate`), §29.2 (build-agent prompt template), M9

**Gap closed**: v6 §14.3 requires `handoff_generate` to return a `ManifestSpawn` shape containing `phaseGuidance` (the 6-phase workflow) and `pattern` (selected from a 7-pattern library). Building these from scratch means designing a general-purpose agent-generation methodology and validating it empirically. claude-agent-builder has done this work.

**Alternatives considered**: build a minimal in-house 4-phase workflow (rejected — claude-agent-builder's 6-phase design is more mature; 7 patterns cover broader agent archetypes).

Findings reference: `repo-extraction-findings.md` lines 764–772, §40 F-110.

## 2. Prerequisites

N/A — pattern-lift. The orchestrator embeds the phase names and pattern names into the `build-agent-handoff` prompt template; no runtime dependency on claude-agent-builder.

## 3. Source provenance

`claude-agent-builder` reference repository. Pin commit SHA in v6 §40 F-110 row. **No install required**: copy phase names + 7-pattern library into prompt template at `prompts/build-agent-handoff.md`.

## 4. Configuration

### 4.1 Environment variables

N/A — pattern-lift.

### 4.2 Config file overlays

```yaml
agentBuilder:
  phases:
    - context-scan
    - discovery
    - research
    - architecture
    - build
    - verify
  patternLibrary:
    - command-agent-skills
    - research-consolidate-plan-execute
    - parallel-specialists
    - self-evolving
    - hook-guarded
    - slash-command-handoff
    - mcp-powered
  approvalGateAfter: architecture   # mandatory PO approval before build
```

## 5. Adoption points in v6

- **F-110** → **§14.3** (`ManifestSpawn` shape includes `phaseGuidance: Phase[6]` and `pattern: <one-of-7>`); **§29.2** (`build-agent-handoff` prompt template embeds the 6-phase workflow + 7-pattern library descriptions); **M9** (handoff_generate tool implementation embeds these constants).

## 6. Pattern excerpts

**6-phase workflow** (`prompts/build-agent-handoff.md`):

| Phase | Purpose |
|---|---|
| `context-scan` | Gather project context, ACLs, upstream dependencies, domain constraints |
| `discovery` | Enumerate acceptance criteria, test scenarios, edge cases |
| `research` | 4-track parallel research: API docs, similar implementations, performance, security |
| `architecture` | Design boundaries, propose data structures, outline error handling. **Approval gate.** |
| `build` | Implement iteratively; ship intermediate artifacts as deps unblock |
| `verify` | Integration test, load test, security scan, code review |

**7-pattern library**:

| Pattern | When to use |
|---|---|
| `command-agent-skills` | Stateless, command-oriented; CLI-like interface |
| `research-consolidate-plan-execute` | Multi-step reasoning before action |
| `parallel-specialists` | Decomposable task; fan-out / fan-in |
| `self-evolving` | Memory-backed; learns from feedback |
| `hook-guarded` | Pre/post-processing gates; permission checks |
| `slash-command-handoff` | `/command` routing to agent states |
| `mcp-powered` | Agent exposed as MCP server |

**TS shape**:
```ts
type Phase = "context-scan" | "discovery" | "research" | "architecture" | "build" | "verify";
type Pattern = "command-agent-skills" | "research-consolidate-plan-execute" | "parallel-specialists"
             | "self-evolving" | "hook-guarded" | "slash-command-handoff" | "mcp-powered";
interface ManifestSpawn { phaseGuidance: Phase[]; pattern?: Pattern; }
```

## 7. Gotchas

1. **Phase ordering is rigid.** The 6 phases must be presented in order; skipping or reordering signals incomplete context gathering. The approval gate between architecture and build is non-negotiable. (findings.md L765; F-110)
2. **The 7-pattern library is not exhaustive.** Agents may propose hybrids (e.g., parallel-specialists + hook-guarded). Document hybrids as extensions, not as "invalid pattern." (findings.md L766; F-110)
3. **Agent config drift after generation.** Once `handoff_generate` returns a manifest with selected pattern, the build agent may deviate (add hooks, etc.). The manifest is a starting template; document deviation in the issue for auditing. (findings.md L767; F-110)
4. **Prompt-template versioning.** If `build-agent-handoff` is updated (new phases or pattern descriptions), agents using older manifests may not match. Bump `promptVersion` in the manifest; mark in-flight issues for regeneration. (findings.md L770; F-110)

## 8. Validation

```bash
# 1. Verify ManifestSpawn includes phaseGuidance with 6 elements
grep -A5 "interface ManifestSpawn\|phaseGuidance:" src/schemas/handoff.ts

# 2. Verify build-agent-handoff prompt mentions all 7 patterns
for p in command-agent-skills research-consolidate-plan-execute parallel-specialists \
         self-evolving hook-guarded slash-command-handoff mcp-powered; do
  grep -q "$p" prompts/build-agent-handoff.md && echo "ok $p" || echo "missing $p"
done

# 3. Verify §14.3 enumerates 6 phases
grep -nE "context-scan|discovery|research|architecture|build|verify" agent-context-orchestrator-mcp-plan-v6.md | head -10
```

## 9. Operational concerns

- **Upstream archival risk: low.** No external dependency to pin. Phases and patterns are embedded constants in orchestrator code/prompts.
- **In-tree absorption**: `prompts/build-agent-handoff.md` (template), `src/schemas/handoff.ts` (types), `src/agents/builder/` (generator).
- **Upgrade path**: if claude-agent-builder publishes new patterns/phases, mirror them into orchestrator's prompt and schema.
- **Ownership**: orchestrator team owns prompt + pattern selection logic + phase serialization. claude-agent-builder is reference methodology; maintainers have no operational role.
- **Promotion**: not applicable.
