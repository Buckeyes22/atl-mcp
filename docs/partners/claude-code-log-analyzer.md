# Partner Integration: claude-code-log-analyzer

## 1. Why this partner

**Category: B (pattern-lift).** claude-code-log-analyzer is the observability-pattern partner for v6 §27.5 (six-enum taxonomy) and §30.4 (error_class half). It is a Python session-log parser that ingests Claude Code JSONL session logs into three SQLite DBs, providing span extraction (work-unit autonomy/intent/completion tracking), multi-format tool-result parsing, and severity-block extraction. Most significantly, it defines the canonical 6-enum observability taxonomy — autonomy / intent / decision / error_class / gate_type / severity — with specific value sets that v6 adopts by reference.

**Gap closed**: v6 §27.5 requires a fixed enum taxonomy across all observability spans for cross-deployment comparability. claude-code-log-analyzer's taxonomy is the most comprehensive surveyed and bridges autonomy instrumentation (§27) to post-mortem failure analysis (§30.4). Two-pass classification (regex tier → LLM fallback) keeps cost minimal.

**Alternatives considered**: build a custom taxonomy (rejected — reinvents error classification); adopt OpenTelemetry enums only (rejected — too generic for agent-context spans); unstructured string labels (rejected — no comparability).

Findings reference: `repo-extraction-findings.md` lines 789–805, §40 F-090.

## 2. Prerequisites

N/A — pattern-lift. The orchestrator adopts the enum taxonomy as a frozen vocabulary in `src/observability/enums.ts`. Optional runtime adoption (vendoring the parser) is not in v1 scope.

## 3. Source provenance

`claude-code-log-analyzer` (Python). Pin commit SHA in v6 §40 F-090 row. **No install required for taxonomy adoption**: copy enum value sets into `src/observability/enums.ts`. If vendoring the parser (post-v1), add as a Python sidecar service.

## 4. Configuration

### 4.1 Environment variables

N/A — pattern-lift. The taxonomy is a frozen vocabulary; no env knobs.

### 4.2 Config file overlays

```yaml
observability:
  enums:
    # Taxonomy defined in §27.5; claude-code-log-analyzer is source of truth
    autonomy: [interactive, quick, build, feature, release]
    intent: [implement, fix, refactor, test, review, deploy, docs, explore, config, other]
    decision: [APPROVED, NEEDS_REVISION, ESCALATE, UNKNOWN]
    error_class: [SYSTEMATIC, INCOHERENT, OMISSION, API_ERROR]
    gate_type: [review_plan, review_design, review_code, codereview, precommit, validation, qa, audit]
    severity: [critical, high, medium, low, warning, info]
```

## 5. Adoption points in v6

- **F-090** → **§27.5** (canonical 6-enum observability taxonomy with frozen value sets across `autonomy / intent / decision / error_class / gate_type / severity`); **§30.4** (the `error_class` enum half — `SYSTEMATIC / INCOHERENT / OMISSION / API_ERROR` — is the post-mortem failure-classification vocabulary).

## 6. Pattern excerpts

**6-enum taxonomy** (`src/observability/enums.ts`):
```ts
export const ObservabilityEnums = {
  autonomy:    ["interactive", "quick", "build", "feature", "release"],
  intent:      ["implement", "fix", "refactor", "test", "review", "deploy", "docs", "explore", "config", "other"],
  decision:    ["APPROVED", "NEEDS_REVISION", "ESCALATE", "UNKNOWN"],
  error_class: ["SYSTEMATIC", "INCOHERENT", "OMISSION", "API_ERROR"],
  gate_type:   ["review_plan", "review_design", "review_code", "codereview", "precommit", "validation", "qa", "audit"],
  severity:    ["critical", "high", "medium", "low", "warning", "info"],
} as const;

export type Autonomy = (typeof ObservabilityEnums.autonomy)[number];
export type ErrorClass = (typeof ObservabilityEnums.error_class)[number];
// ... rest
```

**Two-pass classification** (regex first, LLM fallback for edge cases):
```ts
export async function classifyError(text: string, tier: "regex" | "regex_then_llm"): Promise<ErrorClass> {
  const regexResult = regexClassifyError(text);
  if (regexResult !== "UNKNOWN") return regexResult;
  if (tier === "regex") return "UNKNOWN";
  return await llmClassifyError(text);   // Gemini Flash Lite or similar
}
```

## 7. Gotchas

1. **Enum value drift between observability sources**: if an upstream emits `autonomy = "autonomous"` but §27.5 defines `autonomy ∈ ["interactive", "quick", "build", "feature", "release"]`, the stray value is rejected/mapped to `UNKNOWN`. Normalize all upstream enum sources to match §27.5 before deployment. (findings.md L796; F-090)
2. **Autonomy classification ambiguity at boundaries**: is a 30-min background agent run `feature` or `build`? Regex defaults to `feature` if duration > 10 min and no explicit mode flag. Operationalize boundaries in `CLAUDE.md` and operator training. (findings.md L797; F-090)
3. **Severity threshold tuning is deployment-specific**: a 10-second timeshift might be `info` in batch but `high` in latency-sensitive systems. §27.5 enumerates values; relative ranking is a post-deploy tuning lever. (findings.md L802; F-090)
4. **Error_class overlap with provider error codes**: provider APIs return `"API_ERROR"` for both transient 503s (system glitch) and permanently-broken endpoints (should map to `SYSTEMATIC`). Two-pass classification needed. Never trust provider error strings directly. (findings.md L800; F-090)

## 8. Validation

```bash
# 1. Verify v6 §27.5 enumerates all 6 enums
grep -nE "autonomy|intent|decision|error_class|gate_type|severity" agent-context-orchestrator-mcp-plan-v6.md | head -20

# 2. Spot-check value sets in source
grep -A1 "autonomy:" src/observability/enums.ts
# Expect: [interactive, quick, build, feature, release]

grep -A1 "error_class:" src/observability/enums.ts
# Expect: [SYSTEMATIC, INCOHERENT, OMISSION, API_ERROR]

# 3. Round-trip parse a sample JSONL
orchestrator cli observability parse --jsonl sample.jsonl --validate-enums
# Expect: zero "UNKNOWN" classifications on canonical sample
```

## 9. Operational concerns

- **Upstream archival risk: low.** The taxonomy is a specification in v6 §27.5; the reference parser is decoupled from the orchestrator. If abandoned, the orchestrator's enum definitions persist unchanged. A replacement parser must implement the same 6 enums with identical value sets.
- **Taxonomy stability guarantee**: the 6-enum vocabulary is frozen post-v1 for audit comparability. New enums or value-set additions are post-v1 only and require ADR.
- **In-tree absorption**: enum definitions live in `src/observability/enums.ts`; classification logic in `src/observability/classifyError.ts`.
- **Promotion**: vendoring the parser (running it as a Python sidecar) is a v2 enhancement if live JSONL ingestion is needed; v1 just consumes the taxonomy.
