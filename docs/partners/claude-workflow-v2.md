# Partner Integration: claude-workflow-v2

## 1. Why this partner

**Category: B (pattern-lift).** claude-workflow-v2 is the multi-agent orchestration partner for v6 §24.6 (single-message Task-call constraint) and §18.1 (adversarial verification triplet). It delivers a 7-agent workflow system with action-first directives, 6-phase coordination (UNDERSTAND → PLAN → DELEGATE → INTEGRATE → VERIFY → DELIVER), and a three-stage verification pipeline.

**Gap closed**: v6 §24 specifies parallel sub-agents spawned via Claude Code Task calls. Naive sequential messages execute serially; true parallelism requires all Task invocations in a single assistant message (F-083). §18.1 specifies the adversarial-triplet review pattern — three independent sub-reviewers (false-positive filter, missing-issues finder, context validator) that challenge preview output before execute gates. claude-workflow-v2 operationalizes both.

**Alternatives considered**: implement Task parallelism documentation inline in §24.6 (rejected — clause alone doesn't teach the pattern); implement adversarial triplet manually per-deployment (rejected — non-obvious; baking it into the spec makes it a reusable skill).

Findings reference: `repo-extraction-findings.md` lines 750–763, §40 F-083, F-084.

## 2. Prerequisites

N/A — pattern-lift; no runtime dependency on claude-workflow-v2. The two patterns require: Claude Code CLI with Task-call support (for F-083 single-message dispatch); orchestrator-side review pipeline implementation (for F-084 triplet, runs as three parallel LLM calls).

## 3. Source provenance

`claude-workflow-v2` reference repository. Pin commit SHA in v6 §40 F-083/F-084 rows. **No install required**: copy patterns into `docs/claude-code.md` (when emitted) and `src/review/adversarialTriplet.ts`.

## 4. Configuration

### 4.1 Environment variables

N/A — pattern-lift.

### 4.2 Config file overlays

```yaml
review:
  adversarialTriplet:
    enabled: true
    minDiffLinesToTrigger: 50    # gate triplet on cost-sensitive deployments
    critics:
      - false-positive-filter
      - missing-issues-finder
      - context-validator
    verdictPolicy: any-fail-blocks   # FAIL from any critic blocks execute gate
```

## 5. Adoption points in v6

- **F-083** → **§24.6** (Single-message Task-call constraint for parallelism: all Task invocations that must run in parallel MUST be in a single assistant message; sequential messages execute serially) + **`docs/claude-code.md`** (documented when orchestrator emits Claude Code plugin/skill output).
- **F-084** → **§18.1** (Adversarial verification triplet: three parallel critics — false-positive filter, missing-issues finder, context validator — challenge preview output before execute gates).

## 6. Pattern excerpts

**Single-message Task dispatch rule** (documented in `docs/claude-code.md`):

```
All Task(...) calls that must run in parallel MUST be issued in a single assistant message.
Sequential assistant messages cause Claude Code to execute tasks serially.
Emit the text summary AFTER all Task calls in the same message.
```

**Adversarial triplet structure** (`src/review/adversarialTriplet.ts`):
```ts
async function runAdversarialTriplet(preview: Preview): Promise<VerifyVerdict> {
  const [fpResult, missingResult, ctxResult] = await Promise.all([
    falsePositiveFilterCritic.critique(preview),
    missingIssuesFinderCritic.critique(preview),
    contextValidatorCritic.critique(preview),
  ]);
  return synthesizeVerdict([fpResult, missingResult, ctxResult]);
}
```

The three critics' charters:
- **false-positive filter**: "Is this flagged change truly a violation, or over-trigger?"
- **missing-issues finder**: "What should we have caught but missed?"
- **context validator**: "Does this reflect current remote/repo state?"

## 7. Gotchas

1. **Single-message Task constraint is Claude Code-only.** BullMQ / Hatchet queues and external orchestrators do not enforce this. If provisioning workflow lands on a different agent system, re-implement parallel dispatch for that runtime. (findings.md L753; F-083)
2. **Adversarial triplet adds 3× review cost.** Each critic is a full LLM call with the preview payload. For cost-sensitive deployments, gate the triplet on a threshold (e.g., run only if >50 lines changed). (findings.md L755; F-084)
3. **False-positive filter inherits LLM bias.** The filter is itself an LLM; it can misclassify benign changes as "over-triggers." Pair with deterministic post-filters (lint rules, schema mismatch) before delegating to the critic. (findings.md L756; F-084)
4. **Missing-issues finder risks hallucination.** The critic may invent concerns that do not exist. Synthesize triplet verdicts as advisory; keep human sign-off as the final gate. (findings.md L757; F-084)
5. **Context validator stale-state risk.** Validator challenges fidelity by re-fetching remote state; if remote fetch is itself stale or cached, validation is unreliable. Require cache invalidation before VERIFY phase. (findings.md L758; F-084)

## 8. Validation

```bash
# 1. Verify §24.6 documents single-message Task-call constraint
grep -n "single message\|single-message Task" agent-context-orchestrator-mcp-plan-v6.md
# Expect: hits in §24.6

# 2. Verify §18.1 enumerates 3 critic roles
grep -E "false-positive|missing-issues|context.validator" agent-context-orchestrator-mcp-plan-v6.md
# Expect: all three names present

# 3. Run a preview and verify triplet runs in VERIFY phase
orchestrator cli provision preview --project smoke
# Expect: logs "Running 3 parallel critics: false-positive-filter, missing-issues-finder, context-validator"

# 4. Force a triplet FAIL
# Expect: execute call rejected with "triplet_verdict: FAIL"
```

## 9. Operational concerns

- **Upstream archival risk: low.** claude-workflow-v2 is a reference spec. If abandoned, the two findings (F-083, F-084) are absorbed into v6 §24.6 prose and `src/review/adversarialTriplet.ts`. Orchestrator owns implementation.
- **In-tree adoption**: F-083 documented in `docs/claude-code.md` when orchestrator emits a Claude Code plugin; provisioning workflow (M5–M6) implements F-084.
- **Multi-runtime migration**: if orchestrator adopts a secondary agent system (e.g., Hatchet), re-validate that Task parallelism semantics are preserved. BullMQ + Node loops do not inherit Claude Code's single-message constraint; use explicit ordering or dynamic concurrency controls.
- **Promotion**: not applicable — patterns are stable by design.
