# Partner Integration: agentic-coding-handbook

## 1. Why this partner

**Category: C (spec / docs source).** agentic-coding-handbook is a community methodology and context-sourcing reference. Two findings adopted:

- **F-101**: 8 context strategies (incl. MCPs as #4) → §3 (assumptions), §35.4 (context strategy taxonomy)
- **F-103**: Memory Bank pattern + `@alioshr/memory-bank-mcp` reference → §16.6 (out-of-v1 reference)

**Gap closed**: v6 §35.4 needs an enumerated, ordered taxonomy of context-sourcing strategies. The handbook explicitly enumerates 8 (plans, prompts, host tools, MCPs, mockups, project instructions, indexing, memory) with MCPs as strategy #4 — directly mapping to orchestrator's primary surface area. F-103's Memory Bank pattern is preserved as an out-of-v1 reference for consuming agents.

Findings reference: `repo-extraction-findings.md` lines 894–906, §40 F-101, F-103.

## 2. Prerequisites

N/A — spec/docs reference; no installation required.

## 3. Source provenance

Reference: agentic-coding-handbook (community-maintained git repository). Pin commit SHA in v6 §40 F-101/F-103 rows when chosen. **No install required**; reference only.

## 4. Configuration

N/A — spec/docs reference.

## 5. Adoption points in v6

- **F-101** → **§3** (assumptions cite the 8-strategy taxonomy as the design baseline) + **§35.4** (8 context strategies enumerated; MCPs as #4 maps to orchestrator's primary surface area; orchestrator owns strategies #1, #4, partial #6, partial #7)
- **F-103** → **§16.6** (Memory Bank pattern + `@alioshr/memory-bank-mcp` recorded as out-of-v1 reference; consuming agents may layer above orchestrator if cross-session memory is required)

## 6. Pattern excerpts

**8 context strategies** (handbook ordering, F-101):
1. Implementation plans
2. Well-crafted prompts
3. Copilot tools (file/folder/search/terminal)
4. **External MCPs (Jira / Confluence / Figma / GitHub)** ← orchestrator's primary surface
5. Visual mockups (Figma exports, screenshots)
6. Project instructions (`.copilot-instructions.md` / `CLAUDE.md` / `AGENTS.md`)
7. Workspace indexing (semantic search)
8. Conversational memory + small-first scaling

**Memory Bank pattern** (F-103):
- 6 persistent markdown files: `projectbrief.md`, `productContext.md`, `systemPatterns.md`, `techContext.md`, `activeContext.md`, `progress.md`
- Optional MCP backend: `@alioshr/memory-bank-mcp` for cross-session retrieval
- Maintained by **consuming agents**, not orchestrator (v1 boundary)

## 7. Gotchas

1. **Handbook revision cadence**: handbook is community-maintained and evolves independently. Set quarterly conformance review against latest handbook; check for new strategies or workflow shifts. (findings.md L894; F-101)
2. **Strategy ordering interpretation**: handbook lists strategies (1)–(8) in pedagogical order, not priority order. Strategy #4 (MCPs) and #7 (indexing) are equally critical in v6; do not assume numeric sequence implies dependency. (findings.md L895; F-101)
3. **Memory Bank persistence model is consumer-side**: handbook describes Memory Bank as agent-maintained, not orchestrator-maintained. Orchestrator supplies context packs; consuming agents extend with persistent memory. Do not move Memory Bank responsibility into orchestrator — violates v1 scope boundary (§4 non-goals). (findings.md L898; F-103)
4. **Strategy selection rubric ambiguity**: handbook lists 7 workflows (Spec-First, Auto-Validations, TDD, Exploratory, Visual Feedback, Debugging, Memory Bank) but does not formally specify which strategies apply to which workflows. Document mapping in `docs/integration/context-strategy-to-workflow-map.md` as orchestrator's own clarification. (findings.md L896; F-101)

## 8. Validation

```bash
# 1. Verify §35.4 lists 8 strategies
grep -nE "implementation plans|well-crafted prompts|host.tools|external MCPs|visual mockups|project instructions|workspace indexing|conversational memory" agent-context-orchestrator-mcp-plan-v6.md | head -10

# 2. Verify §16.6 references Memory Bank
grep -n "Memory Bank\|memory-bank-mcp\|@alioshr" agent-context-orchestrator-mcp-plan-v6.md

# 3. Verify §4 non-goals lists persistent memory
grep -n "persistent.*memory" agent-context-orchestrator-mcp-plan-v6.md

# 4. Confirm handbook source URL accessible in §40 F-101 row
grep -A1 "F-101.*agentic-coding-handbook" agent-context-orchestrator-mcp-plan-v6.md
```

## 9. Operational concerns

- **Spec/docs stability**: handbook is community-maintained; stability not guaranteed. Pin handbook SHA in v6 §40 F-101; re-pin at each orchestrator minor version.
- **Memory Bank escalation path**: if consuming agents request deep integration with Memory Bank (cross-session continuity), escalate to §25.2 (deferred agent-memory layer) — do not pull Memory Bank into orchestrator scope.
- **In-tree absorption**: 8-strategy taxonomy in `src/context/contextStrategies.ts`; Memory Bank reference in v6 §16.6 + `docs/consuming-agents.md`.
- **Conformance review cadence**: quarterly handbook check + on each orchestrator minor version bump.
- **Promotion**: not applicable — handbook is reference, not code.
