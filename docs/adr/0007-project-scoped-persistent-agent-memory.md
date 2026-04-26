---
status: accepted
date: 2026-04-26
deciders: [orchestrator-team]
consulted: [hindsight-pattern, uio-pattern]
informed: [build-agents, operators, auditors]
---

# 0007. Project-scoped persistent agent memory across MCP sessions

## Context

v6 §4 deferred persistent agent memory because cross-project personal memory belongs to consuming agents, not the orchestrator. The product need that promoted this work is narrower: an agent reconnecting to the orchestrator should be able to recover project-specific facts, decisions, preferences, warnings, and reflections from prior sessions.

The orchestrator already persists session profiles, context packs, project blueprints, and audit entries. What it did not have was a durable, agent-addressable memory bank that survives MCP transport reconnects and can enrich context-pack generation.

## Decision Drivers

- Preserve v6's non-goal: no default cross-project or tenant-global personal memory.
- Make memory auditable because it can influence future agent behavior.
- Keep deterministic recall available in every deployment.
- Allow vector recall where runtime support exists without making memory depend on a vector service.
- Keep deletion/correction first-class so stale or incorrect memory can be removed from recall.

## Considered Options

1. **Project-scoped memory per agent identity.** Memory is keyed by tenant, project, and agent. It survives sessions but does not leak across projects.
2. **Tenant-wide agent memory.** Useful for broad preferences, but creates relevance, privacy, and compliance risk.
3. **Session-continuity notes only.** Safer but too weak; it does not preserve durable project decisions or adoption context.

## Decision Outcome

Adopt option 1. Persistent memory is scoped to `(tenant_id, project_id, agent_key)`. The MCP surface is explicit:

- `memory_retain`
- `memory_recall`
- `memory_reflect`
- `memory_forget`

The feature is gated by `PERSISTENT_AGENT_MEMORY_ENABLED`. Deterministic recall uses project, agent, issue, kind, tags, recency, and keyword scoring. Vector recall is additive behind `AGENT_MEMORY_VECTOR_ENABLED`; if vector support is unavailable or fails, deterministic recall still returns results and the response reports that vector recall was unavailable.

`context_pack_generate` includes a bounded `agentMemory` section when project-scoped memory exists for the current agent. The context-pack regeneration key includes a memory fingerprint when memory is injected, preserving deterministic regeneration semantics.

All mutating memory tools append signed audit entries. `memory_forget` soft-deletes entries so future recalls omit them while preserving auditability.

## Consequences

### Good

- Agents can reconnect and recover useful project state without scraping prior chat history.
- Memory remains tenant/project isolated and aligns with the existing storage model.
- Auditors can see when memory was retained or forgotten.
- Context packs become more useful while staying bounded and traceable.

### Bad

- Agents must manage memory quality; incorrect memories can degrade future work until forgotten.
- Context-pack output can change when memory changes, so regeneration keys now account for memory fingerprints.

### Neutral

- Vector recall is optional. The first production contract is deterministic recall plus a vector provider boundary.
- Cross-project personal memory remains out of scope unless a future ADR explicitly changes the boundary.

## More Information

- `agent-context-orchestrator-mcp-plan-v6.md` §4 and §25.
- `src/workflows/agentMemoryWorkflow.ts`
- `src/storage/schema/agentMemoryEntries.ts`
- `src/mcp/tools/projectWorkflows.ts`
