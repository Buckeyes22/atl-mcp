# Partner Integration: codebase-memory-mcp

## 1. Why this partner

**Category: B (pattern-lift / deferred reference).** Status: **Deferred-recorded**. codebase-memory-mcp is a considered alternative to BGE-M3 + Qdrant (v6 §25 default via UIO partnership) for semantic code retrieval:

- **F-008**: 11-signal algorithmic embeddings (no LLM) + SQLite int8 + custom `cbm_cosine_i8()` → §25.1 (deferred alternative)
- **F-302**: Consolidated alternative — algorithmic embeddings vs BGE-M3 → ADR `0003-qdrant-bge-m3-default-algorithmic-considered.md`

**What it does**: Pure-C11 MCP server (~30–50MB static binary, zlib-only dependency) exposing 14 tools over stdio JSON-RPC 2.0. Vendored Tree-sitter AST extraction for 66 languages. **Distinctive contribution**: 11-signal algorithmic embeddings (TF-IDF, Random Indexing, MinHash, API signature, type signature, module proximity, decorators, AST structural profile, approximate dataflow, graph diffusion, Halstead-Lite) with **no external LLM dependency**. SQLite int8 quantized vectors + custom `cbm_cosine_i8()` SQL function.

**Why deferred**: orchestrator chose BGE-M3 dense+sparse+ColBERT via Qdrant + UIO (§25, §35). BGE-M3 wins on semantic understanding (LLM-trained vs heuristic), production maturity, and multi-format support (OCR + docs + code unified). Algorithmic embeddings scale poorly past 100k files and lack semantic precision for cross-domain understanding.

**Rehabilitation path**: if BGE-M3 cost exceeds budget or UIO becomes unavailable, codebase-memory-mcp's algorithmic approach is a fallback. No v1 integration planned.

Findings reference: `repo-extraction-findings.md` lines 454–464, L1153–1158, §40 F-008, F-302.

## 2. Prerequisites

N/A in v1 — deferred reference; no runtime dependency. If revived: C11 compiler + zlib; SQLite 3.35+; OS-specific filesystem watcher (inotify / FSEvents / ReadDirectoryChangesW).

## 3. Source provenance

`codebase-memory-mcp` reference repo. Pin commit SHA in v6 §40 F-008 row only if scope reverts. **No install required for v1**.

## 4. Configuration

N/A in v1. If revived, env would include `CBM_ENABLED`, `CBM_SQLITE_PATH`, `CBM_POLL_INTERVAL_MS`, `CBM_LANGUAGE_FILTERS`.

## 5. Adoption points in v6

- **F-008** → **§25.1** (recorded as deferred alternative; not adopted in v1) + **F-302 → ADR 0003** (consolidated alternative documenting why BGE-M3 was chosen over algorithmic). No v6 surface area calls codebase-memory-mcp; this is a forward-pointer for scope reversion.

## 6. Pattern excerpts

**11-signal embedding pipeline**:
1. TF-IDF (term-freq × inverse-doc-freq over code tokens)
2. Random Indexing (LSH variant)
3. MinHash (Jaccard-similarity approximation)
4. API signature (function/method call topology)
5. Type signature (parameter + return type hashes)
6. Module proximity (import graph distance)
7. Decorators + annotations (AST metadata)
8. AST structural profile (25-float vector capturing syntax-tree shape)
9. Approximate dataflow (data-flow graph heuristic)
10. Graph diffusion (label-propagation-style embedding)
11. Halstead-Lite (code complexity metrics)

**Storage**: SQLite schema with int8 quantized vectors (~1–2KB per file vs 4KB+ for float32).

**Custom SQL function**:
```sql
SELECT path, cbm_cosine_i8(embedding, ?) AS score
FROM file_embeddings
ORDER BY score DESC
LIMIT 10;
```

## 7. Gotchas

1. **11-signal weighting tuning is non-trivial.** Each signal contributes equally by default; code domains vary (TS benefits from decorator/type-sig; Rust benefits from module-proximity + type-sig; Python benefits from API topology). No adaptive tuning; weights are static config. (findings.md L458; F-008)
2. **int8 quantization introduces precision loss.** Cosine over int8 is approximate. For top-K ranking, acceptable; for distance-threshold gates ("only chunks ≥ 0.85"), precision loss may admit false positives. Validate thresholds empirically. (findings.md L458; F-008)
3. **SQLite extension portability is OS-specific.** Custom `cbm_cosine_i8()` is a C extension; Windows / Linux / macOS builds require separate compilation. Pre-built binaries must ship per OS; cross-compile is non-trivial. (findings.md L460; F-008)
4. **No semantic understanding — weak cross-domain retrieval.** The 11 signals are syntactic/structural; query for "HTTP error handling" will not retrieve semantically-equivalent code with different terminology. BGE-M3 catches this. (findings.md L458; F-008)
5. **Scaling wall at ~100k files.** Watcher thread polls git diff every 5–60s; beyond 100k files, polling latency + re-index cost prohibitive. Full re-index takes hours. UIO + Qdrant scales to petabyte. (findings.md L462; F-008)
6. **No multi-format support.** Indexes code only (Tree-sitter languages). Cannot index PDFs, Word docs, HTML pages. v6 §35.1 needs mixed sources; UIO handles all. (findings.md L457; F-008)

## 8. Validation

```bash
# 1. Verify §25.1 still records as deferred alternative
grep -n "codebase-memory-mcp\|algorithmic.*embedding" agent-context-orchestrator-mcp-plan-v6.md | grep "25"

# 2. Verify ADR 0003 documents the decision
ls -la docs/adr/0003-qdrant-bge-m3-default-algorithmic-considered.md
grep -lE "F-008|F-302" docs/adr/0003*.md

# 3. Confirm §40 F-008 status remains Deferred-recorded
grep "F-008" agent-context-orchestrator-mcp-plan-v6.md | grep -i deferred
```

## 9. Operational concerns

- **Promotion path (low likelihood, <5%)**: if BGE-M3 cost spike or UIO unavailable, codebase-memory-mcp could be re-evaluated. Requires (a) benchmarking 11-signal precision on orchestrator's corpus, (b) porting Tree-sitter + SQLite int8 logic to Node, (c) integration into §16 in place of BGE-M3, (d) updating §25.1 + ADR 0003 with re-adoption rationale.
- **Upstream archival risk: low.** No v1 runtime dependency. If scope reverts in v2, reference preserved in v6 §40 F-008 + ADR 0003; clone and rebuild from recorded SHA.
- **Ownership if revived**: shared (orchestrator team for §25 integration, codebase-memory-mcp maintainers for binary/library). No active relationship in v1.
- **Re-review cadence**: check at each v6 minor-version review to confirm deferred status remains correct.
