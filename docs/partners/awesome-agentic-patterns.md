# Partner Integration: awesome-agentic-patterns

## 1. Why this partner

**Category: C (spec / docs source).** awesome-agentic-patterns is a 167-pattern catalog with deep write-ups, code sketches, Mermaid diagrams, trade-offs analysis, and production-maturity grading. v6 §16.7 explicitly adopts four patterns:

- **F-127**: 167-pattern catalog incl. context-window-auto-compaction, budget-aware routing with hard cost caps, declarative YAML topology, layered configuration context → §16.7

**Gap closed**: v6 §16 (context pack design) and §24 (workflow strategies) cite patterns from this catalog rather than deriving from first principles. The catalog provides vetted, production-validated examples that inform orchestrator architecture. Future pattern adoption proceeds via deliberate ADR rather than ad-hoc.

Findings reference: `repo-extraction-findings.md` lines 1031–1039, §40 F-127.

## 2. Prerequisites

N/A — spec/docs reference; read-only specification resource.

## 3. Source provenance

`awesome-agentic-patterns` repository. Pin commit SHA in v6 §40 F-127 row. **No install required**; reference catalog by hyperlink in ADRs and architecture docs.

## 4. Configuration

N/A — spec/docs reference.

## 5. Adoption points in v6

- **F-127** → **§16.7** (orchestrator adopts 4 specific patterns from the 167-pattern catalog: context-window-auto-compaction → §16.2 truncation strategy; budget-aware routing with hard cost caps → §23 sampling cost gates; declarative YAML topology → §13/§24 manifest + worker selection; layered configuration context → §16.5 redaction + injection scanning)

## 6. Pattern excerpts

**4 patterns currently adopted** (v6 §16.7):

- **context-window-auto-compaction** — model-specific lane-aware retry with reserve floors. v6 §16.2 implements as 5-step progressive truncation with model-aware lane selection.
- **budget-aware routing with hard cost caps** — per-call model routing based on remaining budget; v6 §23 enforces `+10%` cost-delta hard cap (§17.2 BLOCK_RELEASE verdict).
- **declarative YAML topology** — workflow topology encoded as configuration, not imperative code. v6 §13 manifest.yaml + §24 worker selection.
- **layered configuration context** — declarative layered-security approach. v6 §16.5 context redaction + prompt-injection scanning + PathGuard.

## 7. Gotchas

1. **Catalog growth velocity**: 167 patterns now and actively maintained. Adoption of new patterns must be deliberate via ADR, not reactive. (findings.md L1031; F-127)
2. **Pattern overlap with other partners**: several patterns overlap (e.g., budget-aware routing overlaps Caliber F-091 + claude_agent_teams_ui F-093/F-095). Prefer existing implementations; adopt from awesome-agentic-patterns only when an implementation gap exists. (findings.md L1036; F-127)
3. **Pattern selection rubric ambiguity**: catalog does not rank patterns by adoption risk or prerequisites. ADR must validate that pattern preconditions (e.g., model support for lane-aware retry) are met before committing. (findings.md L1034; F-127)
4. **Declarative YAML topology vs imperative code drift**: adopting declarative-topology pattern (§24 worker selection) risks drift if implementation diverges from published YAML schema. Enforce schema validation in CI. (findings.md L1036; F-127)

## 8. Validation

```bash
# 1. Verify v6 §16.7 lists exactly the 4 adopted patterns
grep -nE "context-window-auto-compaction|budget-aware routing|declarative YAML topology|layered configuration context" \
  agent-context-orchestrator-mcp-plan-v6.md

# 2. Cross-check that each pattern is cited in its target v6 section
grep -n "context-window-auto-compaction" agent-context-orchestrator-mcp-plan-v6.md | grep "16.2"
grep -n "budget-aware routing"            agent-context-orchestrator-mcp-plan-v6.md | grep "23"
grep -n "declarative YAML topology"       agent-context-orchestrator-mcp-plan-v6.md | grep -E "13|24"
grep -n "layered configuration context"   agent-context-orchestrator-mcp-plan-v6.md | grep "16.5"
```

## 9. Operational concerns

- **Catalog stability**: catalog grows continuously. Pin SHA in §40 F-127 + each ADR that adopts a pattern. Major catalog updates may introduce conflicting patterns; review changelog before bumping pin.
- **Adoption policy**: do not auto-adopt new patterns on version bumps. Each new pattern requires (a) problem statement showing gap, (b) ADR with risk assessment, (c) implementation review. Prevents coupling to catalog's update cadence.
- **Alternatives and supersession**: if a pattern is superseded by a newer pattern in the catalog or by a partner library (uio, Caliber), record retirement in subsequent ADR and migrate carefully.
- **In-tree absorption**: 4 adopted patterns referenced in v6 §16.2 / §16.5 / §23 / §24; each ADR cites source SHA + pattern name.
- **Promotion**: not applicable — catalog is reference, not code.
