# Partner Integration: claude-code-production-grade-plugin

## 1. Why this partner

**Category: B (pattern-lift).** claude-code-production-grade-plugin contributes:
- **F-091** (multi with Caliber): 4 shared protocols (ux / input-validation / tool-efficiency / conflict-resolution) → §38.3
- **F-092**: 4 engagement modes (Express / Standard / Thorough / Meticulous) → §38.3 (referenced via shared protocols)

**Gap closed**: v6 §38.3 (cross-cutting safety) requires abstract protocols for UX interaction, input validation, tool efficiency, and conflict resolution that are implementation-agnostic. Building from scratch means defining four discipline documents from blank. This partner ships all four at production grade with intent-routing skill activation, engagement-mode auto-selection heuristics, and conflict escalation loops already proven in a 14-agent deployment.

**Alternatives considered**: design protocols from first principles (rejected — 2–3 weeks design + testing); adopt competitor frameworks (rejected — no other surveyed system ships these four protocols together).

Findings reference: `repo-extraction-findings.md` lines 737–749 (batch write-up), L864–878 (Caliber overlap for F-091), §40 F-091, F-092.

## 2. Prerequisites

N/A — pattern-lift; no runtime dependency. The four protocols are markdown documents; the orchestrator's PolicyDecisionLayer loader injects them at session initialization. Engagement modes propagate via orchestrator config.

## 3. Source provenance

`claude-code-production-grade-plugin` repository. Pin commit SHA in v6 §40 F-091/F-092 rows. **No install required**: copy protocol documents into `.claude/skills/_shared/protocols/` and adopt engagement-mode taxonomy in orchestrator config.

## 4. Configuration

### 4.1 Environment variables

N/A — pattern-lift. Engagement mode is per-session config.

### 4.2 Config file overlays

```yaml
governance:
  sharedProtocols:
    - .claude/skills/_shared/protocols/ux-protocol.md
    - .claude/skills/_shared/protocols/input-validation.md
    - .claude/skills/_shared/protocols/tool-efficiency.md
    - .claude/skills/_shared/protocols/conflict-resolution.md

engagement:
  defaultMode: Standard      # Express | Standard | Thorough | Meticulous
  autoSelectByComplexity: true
  modeRules:
    Express:    { interviewDepth: 0, decisionSurfacing: implicit, outputVerbosity: terse }
    Standard:   { interviewDepth: 3, decisionSurfacing: explicit, outputVerbosity: standard }
    Thorough:   { interviewDepth: 5, decisionSurfacing: explicit, outputVerbosity: detailed }
    Meticulous: { interviewDepth: 8, decisionSurfacing: explicit, outputVerbosity: exhaustive }
```

## 5. Adoption points in v6

- **F-091** → **§38.3** (4 shared protocols loaded into PolicyDecisionLayer at session init: ux-protocol, input-validation, tool-efficiency, conflict-resolution; cross-cuts §17.1 readiness scoring)
- **F-092** → **§38.3** (4 engagement modes auto-selected per `ProjectProfile.complexity`: Express / Standard / Thorough / Meticulous; controls interview depth, decision surfacing, output verbosity, conflict-escalation cost)

## 6. Pattern excerpts

**Four protocols** (each `~150-300 lines` of markdown directives):

```
ux-protocol.md
  1. No open-ended clarifying questions; offer 3–5 structured options
  2. Recommended-first ordering
  3. Continuous execution (one approval at start)
  4. Real-time progress (status, step N/M, ETA)
  5. Structured logs over conversational chatter

input-validation.md
  1. Read project config first
  2. Probe inputs in parallel
  3. Classify gaps: Critical / Degraded / Optional
  4. Print gap summary for human review
  5. Adapt scope before executing

tool-efficiency.md
  1. Parallel tool calls in single assistant message
  2. Smart_outline before Read for large files
  3. Glob over find; Grep over raw grep
  4. Config-aware paths
  5. Cache repeated reads

conflict-resolution.md
  - Authority hierarchy by artifact type (orchestrator > coordinator > worker; CLAUDE.md = human)
  - Dedup keys per artifact (file:line + sha256, etc.)
  - HARDEN → BUILD → escalate loop
```

**Engagement modes** (auto-selection heuristic):
```ts
type EngagementMode = "Express" | "Standard" | "Thorough" | "Meticulous";

function autoSelectMode(profile: ProjectProfile): EngagementMode {
  if (profile.complexity < 0.3 && profile.deadlineHours < 24) return "Express";
  if (profile.securityCritical || profile.auditDependent)     return "Meticulous";
  if (profile.complexity > 0.7)                                return "Thorough";
  return "Standard";
}
```

## 7. Gotchas

1. **UX protocol vs input-validation boundary**: the boundary between "ask the user" (ux-protocol rule 1) and "probe inputs automatically" (input-validation step 2) is permeable. Clarification: ux-protocol applies *after* input probing completes; gather facts in parallel before surfacing structured options. (findings.md L739; F-091)
2. **Engagement-mode auto-selection heuristics can misclassify complexity.** In high-volatility projects, Express may be picked when Thorough is needed. Mode escalation (Express → Thorough) mid-workflow costs ~30% additional compute. Allow explicit mode override per project. (findings.md L740; F-092)
3. **Mode escalation cost is not free.** Switching from Express (0 decision surfacing) to Meticulous (explicit every step) mid-workflow adds 30–50% output tokens. Pre-set mode in `settings.md` if profile is known upfront. (findings.md L741; F-092)
4. **Conflict-resolution protocol assumes hierarchical authority.** Deterministic only when authority hierarchy is unambiguous. In peer-agent or consensus-required systems, escalates to `requireHumanDecision`. (findings.md L742; F-091)

## 8. Validation

```bash
# 1. Verify §38.3 enumerates 4 protocols
grep -nE "ux-protocol|input-validation|tool-efficiency|conflict-resolution" agent-context-orchestrator-mcp-plan-v6.md

# 2. Verify §38.3 enumerates 4 engagement modes
grep -nE "Express|Standard|Thorough|Meticulous" agent-context-orchestrator-mcp-plan-v6.md | head -10

# 3. Verify protocol documents present
ls -la .claude/skills/_shared/protocols/
# Expect: 4 .md files

# 4. Verify engagement-mode auto-selection logic
grep -A6 "autoSelectMode" src/engagement/modes.ts
```

## 9. Operational concerns

- **Upstream archival risk: low.** Protocols are static markdown; engagement modes are a small enum + heuristic. If upstream is abandoned, copies persist indefinitely. Forward-compatible to alternate protocol sources.
- **In-tree absorption**: protocol documents in `.claude/skills/_shared/protocols/`; engagement-mode logic in `src/engagement/modes.ts`; PolicyDecisionLayer wiring in `src/auth/policyLayer.ts`.
- **Operability without protocols**: orchestrator remains functional if protocols omitted; PolicyDecisionLayer returns `allow` without protocol consultation. Omitting degrades UX/safety but does not break the system.
- **Promotion**: not applicable — protocols are documentation, not runtime code.
- **Conformance review**: on each minor v6 version bump, re-validate protocol text against upstream for additions or rule changes.
