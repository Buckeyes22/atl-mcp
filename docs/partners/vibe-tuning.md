# Partner Integration: vibe-tuning

## 1. Why this partner

**Category: B (pattern-lift).** vibe-tuning contributes:

- **F-149**: CATCH→DIAGNOSE→ROOT CAUSE→FIX→SAVE→ENFORCE postmortem + failure-mode taxonomy + fix-type taxonomy → §30.3, §30.4, §30.5

**Gap closed**: v6 §30 needs a systematic incident-response framework with explicit enforcement hooks. Writing rules without enforcement is "just hope" (§30.3). vibe-tuning's 6-step framework systematizes incident response; the failure-mode taxonomy (cause class + failure class) and fix-type taxonomy (Rule / Tool / Config / Education / Process) enable consistent categorization across the org.

**Alternatives considered**: postmortem-less response (rejected — no path from discovery to enforcement); free-form logs (rejected — duplicate/conflicting rules).

Findings reference: `repo-extraction-findings.md` lines 1010–1014, §40 F-149.

## 2. Prerequisites

N/A — pattern-lift. vibe-tuning is process + taxonomies, not a service.

## 3. Source provenance

vibe-tuning reference. Pin commit SHA in v6 §40 F-149 row. **No install required**: framework + taxonomies absorbed into v6 §30.3-§30.5 + ops runbook.

## 4. Configuration

### 4.1 Environment variables

N/A — pattern-lift.

### 4.2 Config file overlays

```yaml
postmortem:
  stages:
    - CATCH
    - DIAGNOSE
    - ROOT_CAUSE
    - FIX
    - SAVE
    - ENFORCE
  failureModeClasses:
    cause: [Ambiguity, MissingContext, WrongTool, SpeedOverSafety, PatternMatching, ModelLimitation]
    failure: [SYSTEMATIC, INCOHERENT, OMISSION, API_ERROR]
  fixTypes: [Rule, Tool, Config, Education, Process]
```

## 5. Adoption points in v6

- **F-149** → **§30.3** (6-step postmortem framework: CATCH → DIAGNOSE → ROOT CAUSE → FIX → SAVE → ENFORCE; "rules without enforcement are just hope") + **§30.4** (failure-mode taxonomy: 6 cause classes + 4 failure classes aligned with claude-code-log-analyzer's error_class enum) + **§30.5** (fix-type taxonomy: Rule / Tool / Config / Education / Process)

## 6. Pattern excerpts

**6-step postmortem stages**:
1. **CATCH** — log violation as it occurred (timestamp, principal, tool/prompt, input/output hash)
2. **DIAGNOSE** — chain-of-thought trace; identify reasoning divergence
3. **ROOT CAUSE** — classify against cause-class taxonomy (§30.4)
4. **FIX** — propose concrete fix; classify against fix-type taxonomy (§30.5)
5. **SAVE** — write rule/config to appropriate location (CLAUDE.md / banned-patterns / config.yaml / AGENTS.md)
6. **ENFORCE** — wire hook (PreToolUse / PostToolUse / pre-commit / CI gate) so rule actively triggers

**Failure-mode taxonomy** (§30.4):
- Cause class: `Ambiguity`, `MissingContext`, `WrongTool`, `SpeedOverSafety`, `PatternMatching`, `ModelLimitation`
- Failure class (aligned with claude-code-log-analyzer F-090): `SYSTEMATIC`, `INCOHERENT`, `OMISSION`, `API_ERROR`

**Fix-type taxonomy** (§30.5):
- `Rule` — declarative constraint (CLAUDE.md / banned-patterns / AGENTS.md)
- `Tool` — new tool capability or refinement
- `Config` — deployment/runtime setting (config.yaml / env)
- `Education` — operator training / docs update
- `Process` — workflow change (approval gate, human review requirement)

## 7. Gotchas

1. **ENFORCE step is non-negotiable**: writing a rule without wiring a hook leaves violations unblocked. Procedural rules require CI/Jira-transition enforcement; code-level rules require runtime hook. (findings.md L1011; F-149)
2. **Stage-skipping is common**: skipping CATCH (no log) → missing root cause → repeated failures. Skipping SAVE → next incident repeats diagnosis. Skipping ENFORCE → recurrence. Each stage must produce an artifact. (findings.md L1011; F-149)
3. **Root cause vs proximate cause confusion**: a fix for the proximate cause is incomplete if the root cause persists. Failure-mode taxonomy (§30.4) disambiguates — Root Cause stage must classify against cause class, not just describe error. (findings.md L1012; F-149)
4. **Taxonomy expansion governance**: 6-cause-class and 4-failure-class taxonomies are v1 baselines. New cause classes from incidents → document exception in incident log; flag for post-v1 taxonomy review via ADR. Do not auto-expand mid-incident. (findings.md L1012; F-149)

## 8. Validation

```bash
# 1. Verify §30.3 documents 6-step process
grep -nE "CATCH|DIAGNOSE|ROOT CAUSE|FIX|SAVE|ENFORCE" agent-context-orchestrator-mcp-plan-v6.md | head -10

# 2. Verify §30.4 enumerates failure-mode taxonomy
grep -nE "Ambiguity|MissingContext|WrongTool|SpeedOverSafety|PatternMatching|ModelLimitation" agent-context-orchestrator-mcp-plan-v6.md

# 3. Verify §30.5 enumerates fix-type taxonomy
grep -nE "Rule|Tool|Config|Education|Process" agent-context-orchestrator-mcp-plan-v6.md | grep -i fix
```

## 9. Operational concerns

- **Upstream archival risk: low.** vibe-tuning is process + taxonomies; no external code dependency. Framework persists in v6 §30 + ops runbook + `src/postmortem/`.
- **In-tree absorption**: incident log schema in `src/postmortem/incidentLog.ts`; failure-mode + fix-type enums in `src/observability/failureTaxonomy.ts`; ENFORCE-step hook binding in policy layer.
- **Versioning**: postmortem framework immutable in v1. Taxonomies may expand post-v1 via ADR + schema migration.
- **Ownership**: orchestrator team owns framework + taxonomies + ENFORCE hook integration. On-call team owns incident log + post-incident case studies.
- **Promotion**: not applicable — process patterns, not runtime code.
