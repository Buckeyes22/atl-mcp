# Partner Integration: agentic-rag-for-dummies

## 1. Why this partner

**Category: B (pattern-lift).** agentic-rag-for-dummies contributes parent-child hierarchical chunking and LangGraph-style query decomposition to v6 §16 (context pack design), §25 (semantic retrieval), M4, and M7. The repository demonstrates a production-ready hybrid RAG implementation with Qdrant dense+sparse retrieval, structured query decomposition, and multi-agent orchestration via LangGraph's `Send` API.

**Gap closed**: v6 §16 requires a chunking strategy with parent-context aggregation; v6 §25 requires Qdrant integration with decomposition. agentic-rag-for-dummies provides both patterns in unified, auditable form.

**Alternatives considered**: build from scratch — rejected because the chunking strategy (2000–10000 char parent-merge bounds, 500/100 child splits) and query decomposition (1–3 sub-queries in parallel via LangGraph `Send`) are already battle-tested here.

Findings reference: `repo-extraction-findings.md` lines 410–418, §40 F-032.

## 2. Prerequisites

N/A — pattern-lift; no runtime dependency on agentic-rag-for-dummies. Required infrastructure for the orchestrator's adoption: Qdrant 1.11+ (already required by v6 §25) and an embedding model (BGE-M3 via UIO or orchestrator's own embedder). No agentic-rag packages vendored.

## 3. Source provenance

Source: `agentic-rag-for-dummies` (community LangChain example). Pin to commit SHA recorded in v6 §40 F-032 row. **No install required**; patterns are ported into TypeScript at `src/context/chunker.ts` and `src/retrieval/decomposer.ts`.

## 4. Configuration

### 4.1 Environment variables

N/A — pattern-lift. Chunk-size constants are embedded in the chunker implementation:

```
parent_min_chars: 2000
parent_max_chars: 10000
child_split_chars: 500
child_min_chars: 100
decomposition_max_subqueries: 3
```

### 4.2 Config file overlays

Optional, in `config.yaml`:

```yaml
context:
  chunker:
    parentMinChars: 2000
    parentMaxChars: 10000
    childTargetChars: 500
    childMinChars: 100
retrieval:
  decomposer:
    enabled: true
    maxSubqueries: 3
```

## 5. Adoption points in v6

- **F-032** → **§16** (parent-child hierarchical chunking — context pack assembly uses parent-context for retrieved children); **§25** (hybrid Qdrant retrieval with dense + sparse vectors); **M4** (context pack generation milestone integrates the chunker); **M7** (query decomposition milestone uses LangGraph `Send`-style parallelization).

## 6. Pattern excerpts

**Parent-child chunker** (`src/context/chunker.ts`, ported from Python):
```ts
function createHierarchicalChunker(config: ChunkerConfig) {
  const PARENT_MIN = 2000, PARENT_MAX = 10000;
  const CHILD_TARGET = 500, CHILD_MIN = 100;
  return {
    chunk(doc: Document): ChunkedDocument {
      const children = splitAtSize(doc.content, CHILD_TARGET, CHILD_MIN);
      const parents = mergeChildren(children, PARENT_MIN, PARENT_MAX);
      return { children, parents, hierarchyMap: buildMap(children, parents) };
    }
  };
}
```

**Query decomposer signature** (`src/retrieval/decomposer.ts`, M7 integration):
```ts
interface QueryAnalysis {
  isClear: boolean;
  questions: string[];          // 1–3 sub-queries
  clarificationNeeded?: string;
}

function decomposeQuery(query: string): Promise<QueryAnalysis> {
  // Structured output; rewrite + clarity check; returns 1–3 sub-queries for parallel dispatch
}
```

## 7. Gotchas

1. **Parent-context inflation**: if child merges exceed `PARENT_MAX` (10000 chars), fallback to next boundary risks losing child relationships. Validate hierarchy post-merge. (findings.md L411; F-032)
2. **Child overlap drift**: children sized by hard `CHILD_TARGET` (500 chars) can drift on each re-chunk if whitespace boundaries shift. Include a deterministic anchor (e.g., markdown header hash) to stabilize child IDs across re-ingestion. (findings.md L412; F-032)
3. **Decomposition cost**: each query spawns 1–3 LLM calls (clarity analysis + sub-query rewrite). Budget these in cost gates; set `decomposer.enabled: false` for high-volume read paths. (findings.md L413; F-032)
4. **Qdrant dual-vector cost**: HYBRID retrieval hits both dense + sparse indexes per sub-query. Monitor via `context_pack_generation_qdrant_ms` histogram; consider sparse-only fallback if dense is unavailable. (findings.md L411–412; F-032)

## 8. Validation

```bash
# Verify chunk constants match source
grep -nE "PARENT_MIN|PARENT_MAX|CHILD_TARGET|CHILD_MIN" src/context/chunker.ts
# Expect: 2000, 10000, 500, 100

# Verify decomposer enforces ≤3 sub-queries
grep -n "maxSubqueries\|questions\.length.*3" src/retrieval/decomposer.ts
# Expect: cap on length

# Diff hierarchical output against source if Python ref retained
python3 -c "from agentic_rag import chunk; print(len(chunk('test.md')))"
```

## 9. Operational concerns

- **Upstream archival risk: low.** agentic-rag-for-dummies is a community LangChain example, not a core service. If archived, the orchestrator has already ported the logic into `src/context/chunker.ts` and `src/retrieval/decomposer.ts`; no runtime dependency remains.
- **Version stability**: the chunking algorithm and decomposer signature are stable. Pin the source SHA for audit trail.
- **Ownership**: orchestrator team owns the TS implementations in `src/context/` and `src/retrieval/`; agentic-rag maintainers own the Python reference. No joint artifacts.
- **Promotion**: not anticipated — pattern lift only.
