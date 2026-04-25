# Partner Integration: superpowers

## 1. Why this partner

**Category: B (pattern-lift), with secondary C (skills-library reference).** superpowers is a Claude Code skills library (~14 composable skills) contributing four patterns to v6:

- **F-105**: Skill-first protocol with 1% threshold → §14.2
- **F-106**: Iron laws (no completion claims without verification; no production code without failing test first) → §14.2, §29.1, §38.5
- **F-107**: Two-stage review gate (spec compliance → code quality) → §14.4
- **F-108**: Hook-based skill injection (SessionStart) + token usage analysis (per-subagent JSONL parsing) → `docs/claude-code.md`, §27 (counters)

**Gap closed**: v6 §14 / §29 specify skill-first discipline and iron-law enforcement but lack operational patterns from a mature implementation. superpowers provides reference implementations: YAML-frontmatter skill parsing, two-stage gate with independent reviewers, SessionStart-based hook injection (avoids redundant tool calls), and per-subagent token analysis. Iron laws ("no completion claims without verification" + "no production code without failing test first") become PolicyObligations.

**Alternatives considered**: build skill-management from scratch (rejected — 2–3 months); use eval-view alone for review (rejected — eval-view is the LLM-as-judge layer; superpowers' two-stage gate is the spec-compliance + code-quality split that complements it).

Findings reference: `repo-extraction-findings.md` lines 879–893, §40 F-105, F-106, F-107, F-108.

## 2. Prerequisites

N/A — pattern-lift. Note: Claude Code SessionStart hook (F-108) fires only in agent contexts, not interactive sessions (cross-link F-204). The orchestrator's agent-spawning flow (§14.3) honors this constraint.

## 3. Source provenance

`superpowers` reference repository (Claude Code skills library). Pin commit SHA in v6 §40 F-105 row. **No install required**: copy the four patterns into orchestrator policy + review pipelines.

## 4. Configuration

### 4.1 Environment variables

N/A — pattern-lift.

### 4.2 Config file overlays

```yaml
skillManagement:
  protocol:
    skillFirstThreshold: 0.01      # F-105: activate at 1% relevance
    ironLawsEnabled: true           # F-106
    twoStageReviewEnabled: true     # F-107
  injectionHook:
    sessionStartEnabled: true       # F-108: only in agent contexts
    tokenAnalysisEnabled: true      # F-108: per-subagent JSONL parsing

observability:
  tokenBreakdown:
    perSubagent: true
    costModel: "anthropic-2026-04"
```

## 5. Adoption points in v6

- **F-105** → **§14.2** (skill-first protocol with 1% activation threshold: apply any skill if even 1% relevance possible; better over-trigger cheap skills than miss them)
- **F-106** → **§14.2** + **§29.1** + **§38.5** (iron laws as PolicyObligations: `requireVerificationEvidence` blocks `*_complete` outcomes lacking build/test logs; `requireFailingTestFirst` rejects pre-commit changes without antecedent failing test)
- **F-107** → **§14.4** (two-stage review gate: spec-compliance reviewer runs independently first; code-quality reviewer runs only if Stage 1 passes — short-circuit saves cost on broken specs)
- **F-108** → **`docs/claude-code.md`** (Claude Code SessionStart hook injects skill context to avoid redundant tool calls) + **§27** (per-subagent token usage analysis via JSONL parsing → orchestrator counters `context_pack_token_usage{category, subagent}`)

## 6. Pattern excerpts

**1% activation rule** (`src/skills/dispatcher.ts`):
```ts
const relevantSkills = skills.filter(s => s.relevanceScore >= 0.01);
// Invoke all relevant skills, not just the top match. Cheap operations exit fast.
```

**Iron law statements** (verbatim text in §14.2 / §29.1):
```
"NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE"
"NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST"
```

**Two-stage gate** (`src/review/twoStageGate.ts`):
```ts
async function validateReadiness(issueKey: string): Promise<ReadinessVerdict> {
  const stage1 = await specsReviewerHandoff(issueKey);
  if (stage1.verdict !== "PASS") return stage1.verdict;   // short-circuit
  const stage2 = await codeQualityHandoff(issueKey);
  return stage2.verdict;
}
```

**SessionStart hook signature** (`docs/claude-code.md`):
```json
{
  "hooks": {
    "SessionStart": {
      "condition": "agentContext",
      "action": "injectSkillContext",
      "payload": { "usingSkills": ["brainstorming", "writing-plans"], "tokenBudget": 4000 }
    }
  }
}
```

## 7. Gotchas

1. **1% threshold tuning.** The orchestrator must implement `relevanceScore` as a bounded metric (0.0–1.0). Set a per-deployment floor in `config.yaml`; if floor too high (>0.3), legitimate weak-signal detections fail silently. (findings.md L885; F-105)
2. **Iron-law false-pass risk.** "No production code without failing test first" is a pre-commit gate. If hooks are disabled or bypassed (`git commit --no-verify`), the law is violated. Enforce hook installation as part of M6c provisioning. Subagents in detached worktrees may not inherit hook config; mirror hooks during worktree setup. (findings.md L884; F-106)
3. **Two-stage gate cost.** Running two independent subagent reviews costs ~2× single-review tokens. Budget in context packs (§16). For high-throughput projects with consistent stage-1 failures, consider async/batch review. (findings.md L883; F-107)
4. **SessionStart hook fires only in agent contexts.** The Claude Code hook does not fire in interactive sessions (cross-link F-204). Orchestrator's §14.3 ManifestSpawn handoff ensures hooks fire; direct REPL tool invocations do not trigger skill injection. (findings.md L887; F-108)

## 8. Validation

```bash
# 1. Verify §14.2 documents 1% threshold
grep -nE "1%|skillFirstThreshold|0\.01" agent-context-orchestrator-mcp-plan-v6.md | head -5

# 2. Verify §14.4 enumerates two stages
grep -nE "spec.compliance|code.quality" agent-context-orchestrator-mcp-plan-v6.md | head -5

# 3. Verify iron laws cited verbatim
grep -nE "NO COMPLETION CLAIMS|NO PRODUCTION CODE" agent-context-orchestrator-mcp-plan-v6.md

# 4. Verify per-subagent token tracking
grep -nE "context_pack_token_usage|per.subagent" agent-context-orchestrator-mcp-plan-v6.md
```

## 9. Operational concerns

- **Upstream archival risk: low.** Patterns are absorbed in `src/skills/dispatcher.ts`, `src/review/twoStageGate.ts`, `src/auth/policyLayer.ts` (iron laws as obligations), `docs/claude-code.md` (SessionStart hook). No code imported from superpowers; patterns are re-implemented inline.
- **Skills-library reference**: superpowers' skill catalog is a Category C reference. Re-audit every 6 months for new patterns or refinements.
- **Maintenance**: if Claude Code hook behavior changes (e.g., SessionStart fires/doesn't), update `docs/claude-code.md` and add feature flag in config.
- **Promotion**: not applicable — orchestrator owns implementation.
