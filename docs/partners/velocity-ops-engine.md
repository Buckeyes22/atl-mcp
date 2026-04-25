# Partner Integration: velocity-ops-engine

## 1. Why this partner

**Category: B (pattern-lift).** velocity-ops-engine contributes four discrete, reusable artifacts to v6: (1) **12-pattern anti-stub guardrails** with should-catch/should-pass test fixtures (findings.md L49–60, §40 F-002) adopted into v6 §30.2 layer 1; (2) **enforcement-v2 real-time hooks** (pre-write, post-write, pre-bash, error-halt, compression-detector) informing v6 §30.2 layer 1's hook infrastructure (findings.md L53, F-003); (3) **MCP development and governance modules** (`modules/mcp-development.md`, `modules/mcp-governance.md`) feeding v6 §14 (MCP surface), §22 (deployment), and §30 (security + audit) (findings.md L49–53, F-004); (4) **confidence-gate JSON schema** `{ check: { checked: bool, confidence: 0–100 } }` and numeric confidenceScore field (findings.md L1229–1230, §40 F-007) adopted as the shape for `PolicyDecision` confidence in v6 §10 and project-readiness checks in §17.3.

**Gap closed**: v6 §30.2 requires three-layer code-quality enforcement. Building anti-stub patterns and hooks from scratch costs 3–4 weeks. velocity-ops-engine's catalog + enforcement pipeline is battle-tested and immediately applicable. The MCP governance rules (6-rule RBAC + audit-log JSON schema) and confidence-gate schema save redesign of v6 §10 and §17.3.

**Alternatives considered**: regex-only linting (rejected — no test-fixture harness); in-house hook framework (rejected — re-inventing orchestration); build confidence scoring from scratch (rejected — PAE + velocity-ops-engine + ai-coding-framework have alignment; consolidate). The confidence-gate shape is the only unified format across all three sources.

Findings reference: `repo-extraction-findings.md` lines 49–60 (velocity-ops-engine batch write-up), L1229–1230 (confidence scoring), L1282 (operational notes), §40 rows F-002, F-003, F-004, F-007.

## 2. Prerequisites

N/A — pattern-lift; no runtime dependency. The orchestrator does not execute velocity-ops-engine code. Instead, the orchestrator **implements** the anti-stub regex set, the hook event callbacks, and the confidence-gate JSON shape in its own code (v6 §30.2, §10). If Claude Code hooks (hooks.json) are emitted as part of the orchestrator's initialization, the shape borrows from velocity-ops-engine's enforcement-v2 structure.

## 3. Source provenance

**Source**: velocity-ops-engine repository (internal). Findings extracted at lines 49–60 of `repo-extraction-findings.md`. No install required; patterns are referenced and adapted in-tree in v6 §30.2 layer 1, §31 (conformance tests), §10 (PolicyDecision), §17.3 (readiness checks). Adoption is copy-adapt-cite, not a live dependency. Pin the source commit SHA in v6 §40 F-002 row once chosen.

## 4. Configuration

### 4.1 Environment variables

N/A — pattern-lift. The anti-stub patterns are built into the orchestrator's lint layer (§30.2); they do not require separate configuration.

### 4.2 Config file overlays

**Optional**: if the orchestrator's configuration tree exposes linting rules as external data, the anti-stub pattern set is loaded from a source like:

```yaml
linting:
  antiStubPatterns:
    - name: STUB_NOT_IMPLEMENTED
      regex: '(throw new Error\("not implemented"\)|NotImplementedError|TODO|FIXME)'
    - name: TYPE_AS_ANY
      regex: 'as any|as unknown|:\s*any(?:\s|,|\[)'
    # ... (10 more patterns from F-002)
  hooks:
    enforcementV2:
      preWrite: true
      postWrite: true
      preBash: true
      errorHalt: true
```

Inline patterns is the recommended default (no external file).

## 5. Adoption points in v6

- **F-002** → **v6 §30.2 layer 1** + **§31** (12-pattern anti-stub guardrails + should-catch/should-pass fixtures lifted as orchestrator's lint layer; §31 defines test matrix covering both should-catch and should-pass cases)
- **F-003** → **v6 §30.2 layer 1** (enforcement-v2 hook pattern: real-time pre-write/post-write/pre-bash hooks; informs Claude Code hook emission. Pre-write and pre-bash gates are the two critical enforcement points; post-write and compression-detector are optional observability hooks.)
- **F-004** → **v6 §14** + **§22** + **§30 background** (mcp-development.md + mcp-governance.md modules informed orchestrator's MCP surface design: 18 MCP rules — Zod schemas, tool descriptions, error handling, resource URI templates, token caching, RLS via `SET LOCAL`, stderr-only logging — plus 6 governance rules — allowlist + pinning, RBAC, audit JSON, trust evaluation, gateway-first)
- **F-007** → **v6 §10** + **§17.3** (PolicyDecision.confidence + numeric confidenceScore shape: §10 formalizes PolicyDecision as having both categorical `Confidence` enum and numeric `confidenceScore`; §17.3 defines the check result shape `{ check: { checked: bool, confidence: 0–100 } }` for the readiness rubric)

## 6. Pattern excerpts

Illustrative patterns from velocity-ops-engine, cited semantically (not copied verbatim).

**Anti-stub patterns (12-pattern set, from F-002)**:
- `STUB_NOT_IMPLEMENTED`: `throw new Error("not implemented")` | `NotImplementedError` | bare `TODO`/`FIXME` comments
- `TYPE_AS_ANY`: `as any` | `as unknown` | `: any`
- `TYPE_DOUBLE_ASSERT`: double type-cast (`as X as Y`)
- `TYPE_TS_IGNORE`: `// @ts-ignore` comments
- `MODULE_REQUIRE`: ES6 imports alongside `require()` calls
- `SECURITY_HARDCODED_SECRET`: API keys, passwords in plaintext
- `SECURITY_SQL_INJECTION`: unparameterized SQL queries
- `STUB_TRUNCATION`: `... | [truncated] | ...` in outputs
- `STUB_ELLIPSIS`: trailing `...` without context
- `STUB_EMPTY_CATCH`: `catch (e) { }` with no logging
- `STUB_CATCH_TODO`: `catch (e) { TODO(...) }`
- `STUB_INLINE_MARKER`: inline comments `// stub`, `// TODO`, `// HACK`, `// XXX`

**Enforcement-v2 hook event shape (from F-003)**:
```json
{
  "eventType": "pre-write" | "post-write" | "pre-bash" | "error-halt" | "compression-check",
  "timestamp": "ISO8601",
  "triggerPath": "file.ts",
  "triggerRule": "STUB_NOT_IMPLEMENTED",
  "suggestion": "Remove the error stub; implement the handler."
}
```

**Confidence-gate JSON shape (from F-007)**:
```json
{
  "check": {
    "checked": true,
    "confidence": 87
  }
}
```
Rolled up: `confidenceScore: 0.87` (numeric 0..1 range).

## 7. Gotchas

1. **Aggressive regex patterns can false-positive on legitimate code.** The `STUB_ELLIPSIS` pattern (`\.{3}`) matches valid spread operators and ellipsis in docstrings. velocity-ops-engine mitigates this via context windows and should-pass fixtures; the orchestrator's implementation must do likewise or risk blocking valid PRs. (findings.md L50; F-002)
2. **Hook event coverage is asymmetric.** velocity-ops-engine's enforcement-v2 covers tool invocations (`pre-write`, `pre-bash`) but not all Claude Code runtime events (e.g., no hook for file-read operations). The orchestrator must document which hook points are actually available; do not assume complete coverage for all code-modification patterns. (findings.md L53; F-003; cross-link F-204)
3. **Confidence-gate numeric precision (0–100 vs. 0..1) requires explicit conversion.** Project-readiness checks return `confidence: 0–100` per check (integer percent); the rolled-up `PolicyDecision.confidenceScore` is `0..1` (float fraction). Normalize at aggregation time, not at the check level. (findings.md L1230; F-007)
4. **Regex vs. AST tradeoff.** Anti-stub patterns are regex-based for speed; they miss deep semantic issues (e.g., a function that returns early on error without documentation). Semgrep rules (§30.2 layer 2) provide AST coverage for banned patterns; bash regex is not a substitute. (findings.md L49–50; F-002)
5. **MCP governance's 6-rule RBAC assumes a per-role policy store.** v6's allowlist (§19) is identity-keyed, not role-keyed. If the orchestrator uses both role-based and identity-based ACLs, velocity-ops-engine's governance rules apply only to role boundaries; identity bindings require additional logic. (findings.md L51–52; F-004)

## 8. Validation

After adopting the patterns in-tree, verify pattern equivalence:

```bash
# Count the 12 anti-stub patterns in the orchestrator's config or linter
grep -c "name:" src/lint/antiStubPatterns.json
# Expect: 12

# Verify pattern regex against a should-catch test case
echo "function notImpl() { throw new Error('not implemented'); }" \
  | grep -E 'throw new Error\("not implemented"\)|NotImplementedError'
# Expect: match

# Verify should-pass case does NOT match
echo "function valid() { return data; }" \
  | grep -E 'throw new Error\("not implemented"\)|NotImplementedError'
# Expect: no match

# Spot-check confidence-gate JSON shape in readiness checks
grep -A 5 '"checked": true' src/readiness/checks.ts
# Expect: confidence field present as integer 0–100
```

## 9. Operational concerns

- **Upstream archival risk: low.** velocity-ops-engine's patterns are absorbed into v6 §30.2 layer 1 as declarative rules (regex + test fixtures), not runtime imports. If the upstream repo is archived, v6's in-tree adoption continues without breakage. The orchestrator owns the pattern set once adopted.
- **In-tree location**: anti-stub patterns live in `src/lint/antiStubPatterns.ts` (or `.json`); enforcement-v2 hook shape is mirrored in `src/hooks/enforcementV2.ts`; confidence-gate JSON schema is defined in `src/domain/PolicyDecision.ts` + `src/readiness/readinessCheck.ts`. All inline or co-located; no external dependency.
- **Promotion path**: if the orchestrator team later decides to vendor a standalone linter (e.g., adopt Semgrep wholesale, or publish a standalone `@orchestrator/lint` package), these patterns become the v0 rule set. Until then, adopt as internal-only copy-adapt-cite.
- **Conformance check**: on each v6 minor-version review, re-validate that the 12-pattern set has not drifted from velocity-ops-engine §40 F-002 source. Pattern additions or removals require ADR. For governance rules (F-004), audit the RBAC + audit-log fields against the source every 6 months.
