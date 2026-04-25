# Partner Integration: ai-coding-framework

## 1. Why this partner

**Category: B (with secondary C for AGENTS.md spec adoption).** ai-coding-framework closes three conformance gaps for v6: (1) a **six-dimension rubric** (instruction compliance, functional correctness, quality evidence, scope control, continuity, portability, each 0–5) for evaluating context packs and handoffs (§17, §31); (2) a **banned-patterns semgrep ruleset** (stubs, hardcoded secrets, weak error handling, unsafe type assertions) for three-layer code-quality enforcement (§30.2 layer 2); and (3) an **OWASP LLM Top-10 checklist** (prompt injection, data exfiltration, token leakage, jailbreaks, drift) for security scanning (§38.6). Additionally, it provides the **Linux Foundation AGENTS.md (Jan 2026) format** — a cross-tool agent-roster standard with three-tier capability boundaries (Always / Ask First / Never) — adopted in v6 §9's AGENTS.md conventions. These are pattern-lifts: semgrep YAML, markdown checklists, a rubric scoring model, and a spec-conformant template, none requiring runtime integration. Confidence-gate JSON (§10, §17.3) is handled separately as F-007 across multiple partners. Findings reference: `repo-extraction-findings.md` lines 261–278 and lines 1229–1230 (confidence-gate); §40 F-005, F-006, F-007.

## 2. Prerequisites

N/A — pattern-lift requires no runtime dependency. **Note**: semgrep CLI (`semgrep` binary, version 1.45+) is **not** provided by this partner but is required to execute the adopted ruleset at CI time (v6 §30.2 layer 2). Assumed to be installed separately in the orchestrator's CI environment.

## 3. Source provenance

Repository: `ai-coding-framework` (pinned commit SHA to be recorded in v6 §40 F-005, F-006 row). No installation required; patterns extracted from source files:
- Six-dimension rubric: `benchmarks/rubric.md`
- Banned-patterns semgrep YAML: `quality/banned-patterns.md`
- OWASP LLM checklist: `quality/ai-security-checklist.md`
- AGENTS.md format: root-level `AGENTS.md`

All referenced in v6 §9 (ADR conventions, AGENTS.md), §17 (rubric reference), §30.2 layer 2 (semgrep gate), §31 (conformance tests), §38.6 (OWASP checklist).

## 4. Configuration

### 4.1 Environment variables

N/A — pattern-lift. Semgrep invocation is managed by CI configuration (§4.2).

### 4.2 Config file overlays

In the orchestrator's `.semgrep.yml` or CI workflow (v6 §30.2 layer 2 pointer):

```yaml
rules:
  - id: ai-coding-framework-banned-patterns
    paths:
      include:
        - src/**/*.ts
        - src/**/*.js
    rules:
      # Adopt from ai-coding-framework/quality/banned-patterns.md
      - no-hardcoded-secrets
      - no-stub-implementations
      - no-unsafe-type-assertions
      - no-weak-error-handling
```

## 5. Adoption points in v6

- **F-005** → **§9** (ADR conventions reference the six-dim rubric and AGENTS.md spec); **§17** (six-dimension rubric reference and numeric scoring weights); **§30.2 layer 2** (banned-patterns semgrep YAML ported as a CI gate alongside velocity-ops-engine 12-pattern guardrails); **§31** (conformance tests reference the six dimensions); **§38.6** (OWASP LLM Top-10 checklist ported verbatim).
- **F-006** → **§9** (AGENTS.md spec adoption — Linux Foundation AGENTS.md Jan 2026 format for agent roster, capability matrix, tool-permission boundaries).
- **F-007** → **§10** (PolicyDecision confidence shape: `{ check: { checked: bool, confidence: 0–100 } }` and numeric `confidenceScore: 0..1`); **§17.3** (project-level readiness gate uses confidence gates as inputs to the rubric score).

## 6. Pattern excerpts

**Six-dimension rubric scoring (v6 §17.1):**
Each dimension 0–5; aggregate to categorical grade (A/B/C/D/F based on weighted sum). Source: `benchmarks/rubric.md`.

```yaml
dimensions:
  instruction_compliance:
    description: "Prompt specifies requirements; context delivered same"
    weights: 0.20
  functional_correctness:
    description: "Artifacts execute without error on representative inputs"
    weights: 0.25
  quality_evidence:
    description: "Tests, types, or static checks provided"
    weights: 0.20
  scope_control:
    description: "Output scope matches request scope"
    weights: 0.15
  continuity:
    description: "Handoff state preserved across sessions"
    weights: 0.10
  portability:
    description: "No hardcoded paths; env-var driven"
    weights: 0.10
```

**AGENTS.md section headers (v6 §9):**
```markdown
# AGENTS

## Always
- capability: "read_workspace"
- capability: "execute_bash"

## Ask First
- capability: "modify_file"
- capability: "git_push"

## Never
- capability: "delete_database"
```

**Confidence-gate JSON shape (v6 §10):**
```json
{
  "checks": [
    {"name": "lint_pass", "checked": true, "confidence": 95}
  ],
  "confidenceScore": 0.92
}
```

**OWASP LLM Top-10 checklist (v6 §38.6):**
Prompt Injection, Insecure Output Handling, Training Data Poisoning, Model Denial of Service, Supply Chain Vulnerabilities, Sensitive Information Disclosure, Insecure Plugin Design, Model Theft, Unauthorized Code Execution, Inadequate AI Alignment. Source: `quality/ai-security-checklist.md`.

## 7. Gotchas

1. **Semgrep rule false positives on TypeScript idioms.** The banned-patterns ruleset was authored for a Python/Go codebase; certain TS patterns (e.g., `any` type assertions in conditional branches) may trigger false positives. Review CI output before blocking merges. Mitigate: add rule exemptions via comments `# nosemgrep: <rule-id>` in the orchestrator's code. (findings.md L267–268; F-005)
2. **AGENTS.md spec evolution risk.** The Linux Foundation may release revisions to the AGENTS.md spec after v6 adoption. The orchestrator should pin a specific LF spec version (e.g., "AGENTS.md v1, Jan 2026") in §9 documentation and upgrade deliberately, not automatically. (findings.md L263; F-006)
3. **OWASP LLM Top-10 update cadence.** OWASP refreshes the Top-10 periodically. Set a quarterly review cadence (e.g., Q2 each year) to check for new items; do not re-adopt automatically. Add new items as a deliberate security decision in v6 §38.6. (findings.md L266; F-005)
4. **Six-dimension rubric weighting is policy, not algorithm.** The rubric provides dimensions; v6 §17.1 assigns weights and grade thresholds. Weights in §6 above are examples only — the orchestrator team must decide final weights in §17.1 based on deployment constraints. (findings.md L270; F-005)
5. **Confidence-gate JSON shape is minimal and extensible.** Some checks may need additional fields (e.g., `error: string` for failure reasons). Extend orthogonally; do not alter the `checked` + `confidence` core. (findings.md L1229–1230; F-007)

## 8. Validation

After adopting the patterns, run these checks:

```bash
# 1. Verify OWASP-LLM checklist adoption
grep -c "Prompt Injection" docs/v6/§38.6-security-checklist.md
# Expect: ≥1

# 2. Verify AGENTS.md header set matches LF spec
grep "^## Always" AGENTS.md && grep "^## Ask First" AGENTS.md && grep "^## Never" AGENTS.md
# Expect: all three headers present

# 3. Semgrep CI dry-run with adopted ruleset
semgrep --config=.semgrep.yml src/ --json > /tmp/semgrep-results.json
jq '.results | length' /tmp/semgrep-results.json
# Expect: integer

# 4. Six-dimension rubric scoring on a test project
orchestrator cli readiness validate --project-id test-project --rubric-version benchmarks-ai-coding-framework
# Expect: scalar grade (A–F) + component scores for all six dimensions
```

## 9. Operational concerns

**Upstream archival risk: low.** The patterns adopted — semgrep ruleset, markdown checklists, rubric definition, AGENTS.md template — are small, self-contained files with no complex dependencies. If ai-coding-framework is archived, the patterns remain in the orchestrator's tree and continue to function. Confidence-gate shape (F-007) is replicated across multiple partners and is not at risk. AGENTS.md spec is owned by Linux Foundation, not this repo.

**Where patterns live in-tree:**
- `src/conformance/rubric.ts` (six-dimension scorer, ported from benchmarks/rubric.md)
- `lint/.semgrep-rules/ai-coding-framework-banned.yml` (adopted semgrep rules)
- `AGENTS.md` (adopted spec template)
- `src/security/owasp-llm-checks.ts` (OWASP checklist as a typed enum or matrix)

**Promotion path:** If v6 later chooses to **vendor the entire ai-coding-framework repo as a CI dependency** (e.g., calling `ai-coding-framework lint` as a subprocess), this becomes Category A (runtime dependency). For v1, patterns are extracted and copied; no subprocess call.

**Conformance review cadence:** On every minor v6 version bump, re-sync the rubric weights (§17.1), semgrep ruleset (§30.2), and OWASP checklist (§38.6) against upstream to catch any spec-drift or new threat categories.
