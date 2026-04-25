# Partner Integration: context-fabric

## 1. Why this partner

**Category: B (pattern-lift).** context-fabric is a TypeScript MCP server (v1.27.1 SDK) that defines the CADRE 5-engine architecture (E1–E5) for context assembly, token budgeting, and drift detection. v6 §16 (context-pack design) and §6.3 (drift triggers), §8 (security), and §30 (redaction) directly adopt five core patterns from context-fabric as foundational to the orchestrator's architecture, without vendoring or runtime dependency. The repo provides reference implementations of the Governor (22-model context-size table + pre-calculated token estimates), Router (FTS5 BM25 with column weights), Weaver (structured markdown briefing), InjectionGuard, and PathGuard. Promotion to Category A would happen if v6 chooses to vendor the repo. Findings reference: `repo-extraction-findings.md` lines 486–500 (batch 1 write-up), §40 F-041 through F-045.

## 2. Prerequisites

N/A — pattern-lift; no runtime dependency. The orchestrator will implement the patterns in-tree. Optional libs the orchestrator's implementation will need: `better-sqlite3` (FTS5 virtual tables for §16.3 BM25 ranking).

## 3. Source provenance

**Source**: https://github.com/context-fabric/context-fabric (canonical CADRE implementation, TypeScript/Node, ~2,000 LoC core engines). **Commit SHA to pin**: [TBD — record in v6 §40 F-041–F-045 rows once selected]. **Adoption**: No install required; patterns are referenced in-tree at v6 §16.1, §16.3, §16.5, §6.3, §8. The orchestrator re-implements the five engines in its own codebase.

## 4. Configuration

### 4.1 Environment variables

N/A — pattern-lift. The orchestrator's own configuration (v6 §20) will define `CONTEXT_BUDGET_PCT`, `CONTEXT_MODEL_LIST`, `FTS5_COLUMN_WEIGHTS`, etc., derived from context-fabric's pattern. No external service is consulted.

### 4.2 Config file overlays

In the orchestrator's `config.yaml`, v6 §16 pointer:

```yaml
context:
  # E4 Governor: 22-model context-size table (F-041)
  budgetPercentage: ${CONTEXT_BUDGET_PCT:-8}    # 1–20% of model context
  modelContextSizes:
    claude-opus-4-1: 200000
    claude-sonnet-4-6: 200000
    gpt-5-4-turbo: 1000000
    gemini-2-0-pro: 1000000
    # ... 18 more models (from context-fabric)

  # E3 Router: FTS5 BM25 column weights (F-042)
  rankingWeights:
    path: 2.0
    summary: 1.5
    outline: 1.2
    exports: 1.0

  # E5 Weaver: bounded sections (F-045)
  briefing:
    maxStaleFiles: 20
    maxComponents: 25
    maxAdrs: 10
    driftWarningOnMediumHigh: true

  # E2 Anchor: drift detection severity (F-044)
  drift:
    severityLow: "< 10%"
    severityMed: "10–30%"
    severityHigh: "> 30%"
```

## 5. Adoption points in v6

- **F-041** → v6 §16.1: 22-model context-size table and pre-calculated token estimates (`Math.ceil(byteLength / 3.5)`) adopted as the canonical token-budgeting approach. Default total budget = 8% of model context.
- **F-042** → v6 §16.3: FTS5 BM25 ranking with column weights (path 2.0 / summary 1.5 / outline 1.2 / exports 1.0) adopted as Step 3 of hybrid relevance ranking, after dense cosine similarity (Step 2) and before reranking (Step 4).
- **F-043** → v6 §16.5 + §8 (security/): InjectionGuard patterns (SYSTEM: tag redaction, "ignore previous instructions" variants, Llama `[INST]` format, jailbyte detection) and PathGuard (traversal validation via `relative()` checks) adopted as the two safety passes that run before any content is included in a pack.
- **F-044** → v6 §6.3: E2 Anchor SHA256-based drift detection with three severity levels (LOW < 10%, MED 10–30%, HIGH > 30%) adopted as the canonical drift-detection mechanism for scope-signature watcher and webhook invalidation.
- **F-045** → v6 §16: E5 Weaver structured markdown briefing format, with bounded sections (max 20 stale files, max 25 components, max 10 ADRs) and drift warning prepended on MED/HIGH severities, adopted as the pack's default render format.

## 6. Pattern excerpts

Illustrative patterns from context-fabric that the orchestrator will re-implement:

**Governor (E4) — 22-model context-size table** (`src/engines/governor.ts` in context-fabric):
- Hardcoded model context sizes for Claude, GPT-5.4, Gemini, Grok, Llama, etc.
- Greedy token selection with 8% default budget allocation.
- Pre-calculated token estimates stored at capture time (byte-length to token conversion via `Math.ceil(byteLength / 3.5)`).

**Router (E3) — FTS5 BM25 ranking** (`src/engines/router.ts` in context-fabric):
- SQLite virtual table with FTS5 full-text search.
- Query sanitizer strips FTS5 operators (`+ - * ^ ( ) " : .`) and reserved words (OR/AND/NOT).
- Column weights: `path 2.0, file_summary 1.5, outline 1.2, exports 1.0`.
- Min token threshold: 2; max: 10 per query.

**InjectionGuard + PathGuard** (`src/security/` in context-fabric):
- Redaction patterns: `SYSTEM:`, `<IMPORTANT>`, "ignore previous instructions" variants, "you are now a...", `[INST]/[/INST]` Llama format, control-character normalization.
- Traversal validation: `relative()`-based path normalization to prevent `../` escapes.

**Anchor (E2) — SHA256 drift detection** (`src/engines/anchor.ts` in context-fabric):
- Severity codes: LOW, MED, HIGH, DELETED, UNREADABLE, TRAVERSAL_REJECTED.
- Thresholds: LOW < 10% delta, MED 10–30%, HIGH > 30%.

**Weaver (E5) — structured markdown briefing** (`src/engines/weaver.ts` in context-fabric):
- Bounded sections: max 20 stale files, max 25 components, max 10 ADRs.
- Drift warning prepended for MED/HIGH severity.
- `wrapAsData()` wrapper for untrusted content.

## 7. Gotchas

1. **FTS5 operator stripping is critical to prevent syntax errors.** The query sanitizer in E3 must reject `+`, `-`, `*`, `^`, `(`, `)`, `"`, `:`, `.` and reserved words. If these leak into the FTS5 query, the search fails silently or throws. (findings.md line 491; F-042)
2. **Token pre-calculation uses `Math.ceil(byteLength / 3.5)` as a conservative default.** This is an approximation; exact token counts require a tokenizer. The Governor stores these estimates at capture time, not at query time, to avoid lazy reads. Do not re-tokenize on every query. (findings.md line 492; F-041)
3. **Column weight tuning is heuristic.** context-fabric hardcodes `path 2.0 / summary 1.5 / outline 1.2 / exports 1.0` based on empirical testing. Changing these weights without re-indexing and re-evaluating will shift ranking results; document any weight changes as a prompt-version bump (v6 §16.4). (findings.md line 491; F-042)
4. **InjectionGuard patterns must be applied *before* content enters the pack.** If an injection pattern leaks into a pack, the agent downstream may execute unintended instructions. The two safety passes (redaction + injection scanning) are non-optional. (findings.md line 494; F-043)
5. **PathGuard relies on `path.relative()` for traversal validation.** Different OSes handle paths differently; ensure the implementation is platform-agnostic. context-fabric detects WSL and NVM-aware Node paths. (findings.md line 495; F-043)
6. **Drift severity threshold boundaries (LOW/MED/HIGH) are inclusive-exclusive.** LOW is `< 10%` (not `<= 10%`), MED is `10–30%` (inclusive on both ends), HIGH is `> 30%`. Misalignment causes boundary cases to be classified incorrectly. (findings.md line 490; F-044)
7. **The Weaver's structured markdown format is deterministic for regeneration.** If the briefing format changes between versions, existing packs cannot be bit-identical re-rendered. Version the format in the pack's `regenerationKey` (v6 §16.4). (findings.md line 493; F-045)

## 8. Validation

After implementing the five patterns in v6 §16 / §8 / §6.3, run these verification commands:

```bash
# 1. Verify 22-model context-size table is defined
grep -r "claude-opus-4-1.*200000" src/context/ && echo "PASS: model table defined"

# 2. Verify FTS5 column weights match F-042
grep -E "path.*2\.0.*summary.*1\.5.*outline.*1\.2.*exports.*1\.0" src/context/ && echo "PASS: weights correct"

# 3. Verify InjectionGuard patterns are present
grep -rE "SYSTEM:|ignore previous|you are now|INST" src/security/ && echo "PASS: injection patterns defined"

# 4. Verify PathGuard traversal validation
grep -r "path\.relative" src/security/ && echo "PASS: PathGuard traversal check present"

# 5. Verify drift severity thresholds
grep -rE "0\.1|0\.3" src/drift/ && grep -rE "LOW|MED|HIGH" src/drift/ && echo "PASS: drift severities defined"

# 6. Compare token pre-calculation formula
grep -r "Math\.ceil.*byteLength.*3\.5" src/context/ && echo "PASS: token pre-calc matches F-041"

# 7. Verify Weaver bounded sections
grep -rE "maxStaleFiles.*20|maxComponents.*25|maxAdrs.*10" src/context/ && echo "PASS: Weaver bounds defined"
```

## 9. Operational concerns

**Upstream-archival risk**: context-fabric is not a runtime dependency; the orchestrator absorbs the five patterns into v6 §16 / §8 / §6.3 as canonical implementations. If the context-fabric repo is archived, the v6 in-tree code continues to function. The repo serves as a reference specification and is not consulted at runtime. No backup or mirror strategy is required beyond standard git repository backup.

**Pattern update path**: If context-fabric introduces new patterns or refines the existing ones (e.g., improved FTS5 weights, additional injection signatures), the v6 team reviews the change in their own architectural context and decides whether to adopt via a new prompt-version bump (v6 §16.4). This is a deliberate, versioned decision, not an automatic pull-in.

**Promotion to Category A**: If v6 decides to vendor context-fabric (e.g., ship context-fabric as a library within the orchestrator package), the repo moves to Category A and gains §2 prerequisites (Node.js, better-sqlite3, MCP SDK), a §3 clone-and-install step, and optional §4 environment variables. This decision belongs in an ADR (v6 §0) and is out-of-scope for v1.

**Location in v6**: The implementations live in `src/context/` (context-pack assembly), `src/engines/` (E1–E5 re-implementations), `src/security/` (InjectionGuard + PathGuard), and `src/drift/` (E2 Anchor). These are first-class v6 modules, not vendored code; they are tested as part of the orchestrator's own test suite.
