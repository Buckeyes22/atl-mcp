# Partner Integration: Caliber

## 1. Why this partner

**Category: B (pattern-lift).** Caliber contributes across two multi-source findings:

- **F-091** (multi with claude-code-production-grade-plugin): 6-category deterministic scoring (existence / quality / grounding / accuracy / freshness / bonus → A/B/C/D grade) → §17.1
- **F-093** (multi with claude_agent_teams_ui): 6-category token tracking (claudeMd / mentionedFile / toolOutput / thinkingText / teamCoordination / userMessage) **AND** seat-based vs API-key provider distinction → §10 (TokenBudgetReport), §16.1, §23.1

**Gap closed**: v6 §17 requires a deterministic baseline readiness score independent of LLM evaluation to avoid circular judge dependencies and cost blowup. Caliber's zero-LLM scoring rubric provides this foundation, layered with eval-view's 4-tier verdict for composite scoring. For provider distinction (§23.1), Caliber's seat-based vs API-key separation enables cost modeling and fallback chains.

**Alternatives considered**: build readiness scoring from scratch (rejected — reinvents grade rubric design); use eval-view alone (rejected — eval-view's verdict is LLM-judged; combine with Caliber for deterministic baseline).

Findings reference: `repo-extraction-findings.md` lines 864–878 (Caliber), L737–749 (production-grade-plugin overlap), L773–788 (claude_agent_teams_ui overlap), §40 F-091, F-093.

## 2. Prerequisites

N/A — pattern-lift. The orchestrator implements Caliber's scoring categories and token-tracking categories in `src/readiness/caliberScorer.ts` and `src/observability/tokenTracking.ts`. (Optional vendor: if v2 chooses to install `@rely-ai/caliber` directly, becomes Category A.)

## 3. Source provenance

Caliber repository. Pin commit SHA / npm version in v6 §40 F-091, F-093 rows. **No install required for pattern-lift**: copy scoring rubric and token-tracking categories into orchestrator codebase. If later vendored: `pnpm add @rely-ai/caliber@<pinned>`.

## 4. Configuration

### 4.1 Environment variables

N/A — pattern-lift. Score weights and token categories live in orchestrator config.

### 4.2 Config file overlays

```yaml
readiness:
  caliberScoring:
    weights:
      existence: 0.25
      quality:   0.25
      grounding: 0.20
      accuracy:  0.15
      freshness: 0.10
      bonus:     0.05
    gradeThresholds:
      A: 0.90    # ≥90 → A
      B: 0.75    # ≥75 → B
      C: 0.60    # ≥60 → C
      D: 0.00    # else D
    freshnessDriftDays: 30

context:
  tokenTracking:
    categories:
      - claudeMd
      - mentionedFile
      - toolOutput
      - thinkingText
      - teamCoordination
      - userMessage

sampling:
  providers:
    - { type: seat-based-claude-cli, label: "Claude CLI seat",  cost: null }
    - { type: seat-based-cursor-acp, label: "Cursor ACP seat",  cost: null }
    - { type: api-key-anthropic,     label: "Anthropic API",    cost: 0.003 }
    - { type: api-key-openai,        label: "OpenAI API",        cost: 0.001 }
    - { type: api-key-vertex,        label: "Vertex AI",         cost: 0.00025 }
```

## 5. Adoption points in v6

- **F-091** → **§17.1** (deterministic 6-category scoring: zero-LLM grade A/B/C/D as baseline layer below eval-view's 4-tier verdict; existence 25 / quality 25 / grounding 20 / accuracy 15 / freshness 10 / bonus 5)
- **F-093** → **§10** (`TokenBudgetReport` with 6-category breakdown) + **§16.1** (context budgeting accounts per category) + **§23.1** (seat-based vs API-key provider distinction informs sampling strategy and cost-aware fallback)

## 6. Pattern excerpts

**Caliber score output** (`src/readiness/caliberScorer.ts`):
```ts
export interface CaliberScore {
  categories: {
    existence: number;   // 0..1
    quality:   number;
    grounding: number;
    accuracy:  number;
    freshness: number;
    bonus:     number;
  };
  totalScore: number;            // weighted; 0..1
  grade: "A" | "B" | "C" | "D";
  evidence: string[];            // audit trail
}
```

**Token budget report** (`src/observability/tokenTracking.ts`):
```ts
export interface TokenBudgetReport {
  claudeMd:          number;
  mentionedFile:     number;
  toolOutput:        number;
  thinkingText:      number;
  teamCoordination:  number;
  userMessage:       number;
  total:             number;
}
```

**Provider distinction** (`src/sampling/providerStrategy.ts`):
```ts
export enum ProviderType {
  SEAT_BASED_CLAUDE_CLI = "seat-based-claude-cli",
  SEAT_BASED_CURSOR_ACP = "seat-based-cursor-acp",
  API_KEY_ANTHROPIC     = "api-key-anthropic",
  API_KEY_OPENAI        = "api-key-openai",
  API_KEY_VERTEX        = "api-key-vertex",
}

// Seat-based providers have null cost (org-metered); fallback chain prefers seat first
```

## 7. Gotchas

1. **6-category score weighting must be tuned per project domain.** Defaults assume general-purpose code projects. Research projects need higher grounding weight; legacy brownfield needs lower quality weight. Tune via `readiness.caliberScoring.weights`. (findings.md L865; F-091)
2. **Freshness drift detection is not free.** Computing `time_since_last_commit` requires git history walk per file; in 50k-file monorepos, costs 2–5s per `readiness_validate`. Cache git-history metadata; set `freshnessDriftDays` to ≥30. (findings.md L866; F-091)
3. **Seat-based vs API-key changes cost modeling, not functionality.** Seat-based providers (Claude CLI) have null per-token cost. Do not subtract seat-based calls from `EVAL_VIEW_BUDGET`; only count API-key calls. (findings.md L867; F-093)
4. **Token category overlap (claudeMd ↔ mentionedFile)**: a mentioned file injected into system prompt on second turn may be double-counted. Tag injections at ingest (mark as claudeMd), then skip mentionedFile if same chunk already in claudeMd. (findings.md L778; F-093)
5. **A/B/C/D thresholds are cardinal, not ordinal.** Score 0.595 is D (just under 0.60); no "C-minus." Add `gradeModifier` if finer granularity needed. (findings.md L869; F-091)

## 8. Validation

```bash
# 1. Verify §17.1 lists all 6 score categories
grep -nE "existence|quality|grounding|accuracy|freshness|bonus" agent-context-orchestrator-mcp-plan-v6.md | head -10

# 2. Verify §10 TokenBudgetReport has 6 token categories
grep -E "claudeMd|mentionedFile|toolOutput|thinkingText|teamCoordination|userMessage" src/observability/tokenTracking.ts

# 3. Verify §23.1 distinguishes seat vs API-key
grep -E "SEAT_BASED|API_KEY" src/sampling/providerStrategy.ts

# 4. Smoke score
orchestrator cli readiness score --project-id smoke
# Expect: JSON with grade A/B/C/D and 6-category breakdown

# 5. Token tracking
orchestrator cli context pack --project-id smoke --verbose
# Expect: TokenBudgetReport with all 6 categories
```

## 9. Operational concerns

- **Upstream archival risk: low.** Scoring rubric and token-tracking taxonomy are absorbed in `src/readiness/caliberScorer.ts` and `src/observability/tokenTracking.ts`. If Caliber is abandoned, drop-in replacement scorer with same interface is straightforward.
- **Promotion to Category A**: would require `pnpm add @rely-ai/caliber` (small library; reasonable v2 enhancement).
- **Ownership**: orchestrator team owns the wrapper, token-tracking integration, and provider strategy. Caliber maintainers own Caliber itself. Joint ownership of scoring-category definitions in §17.1.
- **Seat-based provider fallback**: if Claude CLI / Cursor ACP unavailable, fallback chain transparently downgrades to API-key providers; cost modeling adjusts dynamically.
