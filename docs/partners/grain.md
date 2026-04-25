# Partner Integration: grain

## 1. Why this partner

**Category: B (pattern-lift).** grain is an anti-slop linter for AI-generated code patterns. It contributes:

- **F-148**: Anti-slop linter rules (obvious comments, vague TODOs, hedge words, restated docstrings) → §30.2 layer 3, §31.2 (TS port)

**Gap closed**: v6 §30.2 layer 3 needs a quality-anti-pattern detector for AI-generated code; building rule taxonomy from scratch (regex categories for obvious comments, vague TODOs, hedge-word lexicons, docstring-restatement detection) is error-prone. grain provides the reference taxonomy and rule set; the orchestrator ports rules to TypeScript at `src/lint/antiSlopRules.ts` alongside velocity-ops-engine's anti-stub guardrails (§30.2 layer 1) and ai-coding-framework's banned-patterns semgrep (§30.2 layer 2).

**Alternatives considered**: build lint rules in-house (rejected — rule maintenance burden); use ESLint + custom rules only (rejected — rule categories not aligned with grain taxonomy).

Findings reference: `repo-extraction-findings.md` lines 1103–1108, §40 F-148.

## 2. Prerequisites

N/A — pattern-lift. grain is Python; the orchestrator ports rules to TypeScript. No Python dependency in the orchestrator runtime. Optional for development: Python 3.9+ to test grain's reference rules side-by-side.

## 3. Source provenance

`grain` reference repository (Python anti-slop linter). Pin commit SHA in v6 §40 F-148 row. **No install required**: extract rule taxonomy + regex patterns into `src/lint/antiSlopRules.ts`.

## 4. Configuration

### 4.1 Environment variables

N/A — pattern-lift.

### 4.2 Config file overlays

```yaml
lint:
  antiSlop:
    enabled: true
    rules:
      - name: obvious-comment
        severity: warn
        patterns:
          - "//\\s*(Convert|Transform|Create|Parse|Return)\\s+(?:the|a)\\s+(array|list|object|string)"
      - name: vague-todo
        severity: warn
        patterns:
          - "TODO:\\s*(better|improve|fix|handle|check|make|refactor)\\b"
      - name: hedge-words
        severity: info
        words: ["kind of", "probably", "might", "seems to", "arguably"]
      - name: restated-docstring
        severity: warn
        enabled: true
    suppression:
      whitelistPrefixes: ["HACK:", "FIXME:", "BUG:", "XXX:"]
```

## 5. Adoption points in v6

- **F-148** → **§30.2 layer 3** (anti-slop linter as the third quality-gate layer; complements layer 1 anti-stub guardrails (velocity-ops-engine) and layer 2 banned-patterns semgrep (ai-coding-framework)) + **§31.2** (TypeScript port: rules implemented in `src/lint/antiSlopRules.ts`; integrated into `review_code` tool)

## 6. Pattern excerpts

**Rule categories** (`src/lint/antiSlopRules.ts`):

```ts
export interface AntiSlopRule {
  name: string;
  severity: "info" | "warn" | "error";
  check(code: string, context?: { docstring?: string }): Violation[];
}

// Obvious-comment: detects redundant explanations of well-named code
export const OBVIOUS_COMMENT: AntiSlopRule = {
  name: "obvious-comment",
  severity: "warn",
  check(code) {
    const re = /\/\/\s*(Convert|Transform|Create|Parse|Return|Build|Generate|Initialize)\s+(?:the|a|an)\s+(array|list|object|dict|string|map|set)/gi;
    return matchToViolations(code, re, "obvious-comment");
  },
};

// Vague-TODO: detects TODOs that don't specify what to do
export const VAGUE_TODO: AntiSlopRule = {
  name: "vague-todo",
  severity: "warn",
  check(code) {
    const re = /TODO:\s*(better|improve|fix|handle|check|make|refactor|optimize)\b/gi;
    return matchToViolations(code, re, "vague-todo");
  },
};

// Hedge-words: tentative language that signals lack of conviction
export const HEDGE_WORDS: AntiSlopRule = {
  name: "hedge-words",
  severity: "info",
  check(code) {
    const hedges = ["kind of", "probably", "might", "seems to", "arguably", "I think", "could be", "appears to"];
    // Scan for word-boundaried hedges; return violations
  },
};

// Restated-docstring: detects when first code line restates the docstring
export const RESTATED_DOCSTRING: AntiSlopRule = {
  name: "restated-docstring",
  severity: "warn",
  check(code, context) {
    if (!context?.docstring) return [];
    const docTokens = tokenize(context.docstring);
    const codeTokens = tokenize(code.split("\n")[0]);
    const overlap = codeTokens.filter(t => docTokens.includes(t)).length;
    if (overlap / docTokens.length > 0.5) {
      return [{ message: "Docstring is restated in first line; remove redundancy", category: "restated-docstring" }];
    }
    return [];
  },
};
```

## 7. Gotchas

1. **Obvious-comment regex false positives on legitimate work comments**: `// CONVERT the PDF to JSON` legitimately describes a multi-step task. Whitelist comments prefixed with `HACK:`, `FIXME:`, `BUG:`, `XXX:` to reduce false alarms. (findings.md L1104; F-148)
2. **Hedge-word lexicon is English-specific**: "probably" → "probablemente" (Spanish), "wahrscheinlich" (German). Detection requires language-aware tokenization or per-lang word lists. v1 = English-only; document non-English codebases not linted for hedges. (findings.md L1104; F-148)
3. **Restated-docstring detection without a tokenizer produces false positives**: regex-only matches incidental word overlap (docstring "Process an array" + impl "Iterate over array" = false positive). Use string-token matching with overlap >50% threshold AND docstring length >5 tokens. Post-v1: AST parser. (findings.md L1105; F-148)
4. **Rule severity tuning is project-specific**: "hedge-words" at severity `error` blocks valid patterns (e.g., "might want to refactor…" in comments). Default to `info`; allow per-project overrides. (findings.md L1106; F-148)
5. **Inline suppressions (`// grain-off: rule-name`) require parser awareness**: naive substring search matches suppression text in strings. Skip inline suppression in v1; add post-v1 with AST parser. (findings.md L1107; F-148)

## 8. Validation

```bash
# 1. Verify v6 §30.2 layer 3 cites grain rules
grep -nE "anti.slop|grain|obvious.comment|vague.TODO|hedge.word|restated.docstring" agent-context-orchestrator-mcp-plan-v6.md | head -10

# 2. Verify §31.2 references TS port
grep -nE "TS port|TypeScript port|src/lint/antiSlopRules" agent-context-orchestrator-mcp-plan-v6.md | head -5

# 3. Smoke test on a slop sample
cat > /tmp/test-slop.ts <<'EOF'
// Convert the string to lowercase
function convertString(s: string) {
  TODO: make this better
  return s; // probably need optimization
}
EOF
orchestrator cli lint anti-slop /tmp/test-slop.ts --format json
# Expect: violations for obvious-comment + vague-todo + hedge-words

# 4. Whitelist test (FIXME should not flag)
echo "// FIXME: PgBouncer needs statement_cache_size=0" | orchestrator cli lint anti-slop -
# Expect: no violation
```

## 9. Operational concerns

- **Upstream archival risk: low.** grain rule taxonomy is small + stable; ported rules in `src/lint/antiSlopRules.ts` are maintainable offline. If grain is archived, orchestrator continues without it.
- **In-tree absorption**: `src/lint/antiSlopRules.ts` (rule implementations); `config.yaml` lint.antiSlop block (rule + severity config).
- **Upgrade path**: when grain adds new categories, (a) read reference patterns, (b) port to TS, (c) test against current codebase, (d) tune severity, (e) enable in config.
- **Promotion**: not applicable — orchestrator owns rule implementation.
- **Ownership**: orchestrator team owns ported rules + tuning. grain maintainers own reference impl.
