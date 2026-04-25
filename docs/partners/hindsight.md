# Partner Integration: hindsight

## 1. Why this partner

**Category: B (deferred reference; out of v1 scope per §4 non-goals).** hindsight provides a production-grade three-operation memory model (`retain` / `recall` / `reflect`) plus multi-strategy retrieval (semantic + BM25 + graph + temporal + reranking) backed by FastMCP. It closes the gap for consuming agents that need cross-session persistent memory beyond the orchestrator's own context-pack management. However, v6 §4 explicitly defers persistent agent memory as a consuming-agent concern, not orchestrator scope. v6 §25.2 records hindsight as a deferred-reference architecture; it is not vendored in v1. Alternatives considered (findings.md L1153–L1158): mengram (3-type memory model + experience-driven evolution, more complex) and `@alioshr/memory-bank-mcp` (lighter-weight variant). Adoption would close a gap only if the orchestrator team later decides to provide persistent memory as a managed runtime feature (post-v1 enhancement). (findings.md L1072–L1087, L1153–L1158, §40 F-145, F-303)

## 2. Prerequisites

N/A in v1 — deferred reference, no runtime dependency. If promoted to Category A (vendored runtime partner in a future version):

- Python 3.11+ (hindsight API server).
- FastMCP HTTP runtime (hindsight ships `api/mcp.py` as the server).
- Vector store backend: Qdrant (1.11+) or sqlite-vec.
- Embedding provider: BGE-M3 (recommended, via UIO integration per §25) or local embedding model.
- Optional: graph store for temporal + relationship-based retrieval (Neo4j or similar).
- Orchestrator would need a new MCP client to call hindsight tools (26 operations across memory banks, mental models, directives).

## 3. Source provenance

Source: hindsight (reference; commit SHA to be pinned only if v1 scope changes to Category A; none required for v1). No install required; patterns are referenced (not adopted) in v6 §25.2 as a deferred architecture.

## 4. Configuration

### 4.1 Environment variables

N/A in v1. If promoted, would extend v6 §20 env block with:

- `HINDSIGHT_ENABLED` (bool, default false)
- `HINDSIGHT_BASE_URL` (FastMCP server address)
- `HINDSIGHT_EMBEDDING_PROVIDER` (anthropic | openai | local)
- `HINDSIGHT_VECTOR_STORE_URL` (Qdrant or sqlite-vec path)
- `HINDSIGHT_BANK_ID` (namespace for orchestrator's memory bank within hindsight)

### 4.2 Config file overlays

N/A in v1.

## 5. Adoption points in v6

Three references; no active integration:

- **v6 §4 (Non-Goals)** — "persistent agent memory across projects (a consuming-agent concern, not orchestrator scope)" explicitly lists memory persistence as out-of-scope. (findings.md L1153–L1158, §40 F-303)
- **v6 §25.2 (Deferred Reference)** → **F-145**: hindsight's three-op model and multi-strategy retrieval are recorded as the cleanest reference architecture for consumers layering memory above the orchestrator. "v1 does not adopt persistent memory; consumers can layer hindsight or `@alioshr/memory-bank-mcp` as needed." (findings.md L1072–L1087)
- **v6 §40 F-303**: Consolidated alternatives row — groups persistent-memory candidates (hindsight, mengram, Memory Bank) for potential post-v1 inclusion if scope changes.

No v6 section calls hindsight; this is a forward-pointer only.

## 6. Pattern excerpts

Three-operation model signature (reference only; not adopted in v1):

```python
# From hindsight api/mcp.py — reference architecture
async def retain(bank_id: str, memory: MemoryUnit) -> MemoryBank:
    """Store a memory unit (observation, inference, or interaction) in a bank."""
    ...

async def recall(bank_id: str, query: str, strategies: List[str]) -> List[MemoryUnit]:
    """Retrieve memories by semantic + BM25 + graph + temporal + reranking."""
    ...

async def reflect(bank_id: str, memories: List[MemoryUnit]) -> Reflection:
    """Synthesize a reflection (insight/update) from a set of recalled memories."""
    ...
```

Multi-strategy retrieval composition (illustrative; not adopted):

```
query → [semantic encoder]  → dense vector
      → [BM25 tokenizer]    → sparse vector
      → [graph traversal]   → related entity nodes
      → [temporal filter]   → recency rank
      → [fusion reranker]   → final top-k
```

All sourced from hindsight's `src/strategies/` and `api/mcp.py`; not integrated into v6 orchestrator.

## 7. Gotchas

1. **FastMCP runtime overhead**: hindsight's HTTP server adds ~100ms latency per retain/recall roundtrip. Consuming agents pay the full cost; orchestrator does not. (findings.md L1073)
2. **Multi-strategy retrieval cost grows with bank size**: semantic encoder + BM25 tokenization + graph traversal + temporal filtering + reranking all execute in-sequence. Qdrant queries are fast, but LLM-based reranking (when enabled) can cost $0.01–$0.10 per query on large banks. (findings.md L1075)
3. **Conflict with §25.1 UIO-as-vector-source decision**: v6 specifies BGE-M3 via UIO as the canonical embedding layer. If hindsight is promoted, it must accept vectors from UIO (no duplicate embedding pipeline) to avoid cost duplication. Currently hindsight assumes its own embedder instance. (findings.md L1075)
4. **14+ integrations complicate onboarding**: hindsight ships adapters for CrewAI, LangGraph, LiteLLM, Claude Code, Pydantic AI, AG2, LlamaIndex. If vendored, the orchestrator must choose: adopt one integration pattern or port a custom one. Decision overhead. (findings.md L1077)
5. **No standardized memory-schema across consuming agents**: hindsight's 3-op model defines the interface, but memory unit shape (observation/inference/interaction types) is consumer-specific. v1 orchestrator cannot enforce a schema; post-v1 team must define governance. (findings.md L1073–L1076)

## 8. Validation

Verification scope is narrow because hindsight is deferred. Confirmation checklist:

```bash
# 1. Verify §4 non-goals still lists persistent memory as out-of-scope
grep -n "persistent agent memory" agent-context-orchestrator-mcp-plan-v6.md | head -3
# Expected: line ~121 in §4

# 2. Confirm §25.2 still records hindsight as deferred reference
grep -n "### 25.2 Considered, deferred: hindsight" agent-context-orchestrator-mcp-plan-v6.md
# Expected: one match, reads "v1 does not adopt persistent memory"

# 3. Check §40 F-145 status remains "Deferred-recorded"
grep "F-145" agent-context-orchestrator-mcp-plan-v6.md | grep hindsight
# Expected: status = Deferred-recorded
```

No live orchestrator integration test exists for v1.

## 9. Operational concerns

**Promotion path (if scope changes)**: A future v2 or post-v1 extension could promote hindsight from Category B to Category A by:

1. Adding `hindsight_retain` / `hindsight_recall` / `hindsight_reflect` to orchestrator's MCP tool suite.
2. Creating new env block (§20) for FastMCP endpoint + vector store credentials.
3. Adding v6 §25.3 integration surface (hook hindsight into context-pack assembly for agent-context enrichment).
4. Defining memory-unit schema governance (ADR for orchestrator-managed vs consumer-managed shape).
5. Writing a new partner guide using the standard 9-section template (like uio.md, eval-view.md).

**Upstream-archival risk**: Low. The three-op model (`retain` / `recall` / `reflect`) and multi-strategy retrieval patterns are algorithmic, not vendor-lock. If hindsight is abandoned, the patterns can be re-implemented independently. The 26-tool interface is larger, but the core three operations are the load-bearing abstraction.

**Where deferred reference lives in-tree**: v6 §25.2 (main deferral record) + §4 non-goals (justification) + §40 F-145 + F-303 (findings index). §16.6 also mentions `@alioshr/memory-bank-mcp` as a lighter alternative for consuming agents.

**Re-review cadence**: This guide should be checked at every v6 minor-version review (e.g., v6.1, v6.2) to confirm the deferred status has not changed and that §4 non-goals remain binding. If the team ships a prototype persistent-memory runtime in a v6.x release, update this guide to Category A and trigger a full integration-point audit (new §5 entries, new §6 glue code, new §8 validation suite).
