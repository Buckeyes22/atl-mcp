# Partner Integration: uio

## 1. Why this partner

UIO (Universal Intake Orchestrator) is the direct integration partner named in v6 §35.1. It provides production-grade document ingestion (MinerU + PaddleOCR-VL + Docling + GLM-OCR parser router), multi-vector embedding (BGE-M3: dense 1024 + sparse + BM25 + ColBERT), Qdrant multi-collection storage, Hatchet orchestration, and a TypeScript MCP server (`packages/mcp/`) exposing `uio_ingest` / `uio_query` / `uio_status` / `uio_catalog`.

**Gap closed**: v6 §35.1 specifies that `project_intake_create` accepts either raw markdown or a UIO document reference (source_id + chunk_indices) or a UIO file upload (garage_key). When UIO is configured, the orchestrator **reuses UIO's pre-computed dense+sparse+ColBERT vectors** from `uio_books_raw_v1` (or other UIO collection, per license-class routing) rather than re-embedding. This avoids duplicating the MinerU → BGE-M3 pipeline and cuts intake cost for documents UIO has already processed.

**Alternatives considered**: build the parser + embedder pipeline in-house. Rejected because UIO already does this at production quality and the orchestrator's scope (v6 §1, §4) is project orchestration, not document intake infrastructure.

Findings reference: `repo-extraction-findings.md` lines 393–409 (batch 1 write-up), L1276–1279 (§35 UIO integration refinements), §40 F-010 through F-013, F-201.

## 2. Prerequisites

- Node.js 22+ on the orchestrator host (for the TypeScript MCP client wrapper UIO ships).
- Python 3.12+ on the UIO host (for the FastAPI + Hatchet workers). UIO itself is not run by the orchestrator; orchestrator is a consumer.
- PostgreSQL 16+ behind UIO (UIO's canonical data store).
- Redis 7+ for UIO's caches.
- Qdrant 1.11+ reachable from both UIO and (for vector-reuse reads) the orchestrator.
- Garage (S3-compatible) for UIO's file staging — required only when the orchestrator passes `source.kind = "uio_file_upload"` with a `garageKey`.
- Hatchet for UIO's workflow engine (bundled via UIO's `config/docker/`).
- UIO API key with read access to the collections your deployment uses.
- Operator profile YAML at UIO's `config/operator-profile.yaml` aligned to your project/domain — UIO uses this to classify intake.

## 3. Clone and install

```bash
# Clone UIO at a pinned commit
git clone https://github.com/<your-org>/uio.git
cd uio
# Pin to a known-good commit. Record this SHA in v6 §40 F-010 row once chosen.
git checkout <UIO_COMMIT_SHA>

# Bring up UIO stack (Docker Compose)
cp config/.env.example .env
# edit .env with your secrets
docker compose -f config/docker/docker-compose.yml up -d
# Wait for health: Postgres → Qdrant → Hatchet → Garage → UIO API (port 8000)

# Verify
curl -H "X-API-Key: $UIO_API_KEY" http://localhost:8000/api/v1/healthz
```

The orchestrator does not vendor UIO; it consumes UIO at runtime over HTTP (API) and optionally over direct Qdrant reads (vector reuse).

## 4. Configuration

### 4.1 Environment variables

Extends v6 §20 env block. New variables:

| Var | Required | Default | Example | Notes |
|---|---|---|---|---|
| `UIO_ENABLED` | No | `false` | `true` | Master switch. When false, orchestrator uses its own embedder. |
| `UIO_BASE_URL` | Yes (when enabled) | — | `https://uio.example.com` | UIO FastAPI base URL. |
| `UIO_API_KEY` | Yes (when enabled) | — | `uio_...` | Sent as `X-API-Key` header. |
| `UIO_QDRANT_URL` | Yes (for vector reuse) | — | `http://uio-qdrant:6333` | UIO's Qdrant. Read-only access needed for vector reuse; do not write. |
| `UIO_QDRANT_API_KEY` | Yes (for vector reuse) | — | `...` | If UIO's Qdrant requires auth. |
| `UIO_DEFAULT_COLLECTION` | No | `uio_books_raw_v1` | — | Which UIO collection to read from by default. License-class routing can override. |
| `UIO_POLL_INTERVAL_MS` | No | `1000` | `2000` | Polling interval for `uio_status` while waiting for ingestion. |
| `UIO_POLL_TIMEOUT_MS` | No | `300000` | — | Max wait for UIO envelope to reach `completed`. |

### 4.2 Config file overlays

In the orchestrator's `config.yaml`:

```yaml
uio:
  enabled: ${UIO_ENABLED}
  baseUrl: ${UIO_BASE_URL}
  apiKey: ${UIO_API_KEY}
  qdrantUrl: ${UIO_QDRANT_URL}
  qdrantApiKey: ${UIO_QDRANT_API_KEY}
  defaultCollection: ${UIO_DEFAULT_COLLECTION:-uio_books_raw_v1}
  reuseEmbeddings: true              # when ingesting docs UIO has already processed
  poll:
    intervalMs: ${UIO_POLL_INTERVAL_MS:-1000}
    timeoutMs: ${UIO_POLL_TIMEOUT_MS:-300000}

preflight:
  invalidateOnUioReachabilityChange: true
```

## 5. Integration points with the orchestrator

Five integration points, each mapped to a v6 section and workflow step.

### 5.1 Preflight discovery reachability (v6 §9, §10)

**Trigger**: `project_preflight_check` runs. **Data in**: `ProjectProfile` request. **Data out**: `UioPartnerProfile` populated in `ProjectProfile.uio` with fields `{ baseUrlReachable, qdrantReachable, defaultCollectionExists, apiKeyValid }`. **Failure mode**: partial (any `false` → `ProfileWarning` emitted with `target: "uio"`, severity `warn`; preflight still passes if orchestrator's own embedder is available).

### 5.2 Intake via UIO document reference (v6 §14, §15, §35.1)

**Trigger**: `project_intake_create` called with `source.kind = "uio_document"` + `{ uioSourceId, uioChunkIndices? }`. **Data out**: catalog entry fetched via `UioAdapter.getCatalogEntry(sourceId)`, pinned into `SourcePin` with `uioSourceId` + `uioChunkIndices`. Vectors are **not** fetched yet — that happens on first context-pack assembly. **Failure mode**: envelope not in `completed` state → orchestrator returns `CLARIFICATION_NEEDED` with the UIO error.

### 5.3 Intake via UIO file upload (v6 §14, §15, §35.1)

**Trigger**: `project_intake_create` with `source.kind = "uio_file_upload"` + `{ garageKey, mimeType }`. **Data out**: orchestrator calls `UioAdapter.ingest({ source_type: "file_drop", raw_content: { garage_key: garageKey }, metadata: {...} })`, then polls `UioAdapter.status(envelopeId)` until `completed`. On completion, behaves as 5.2. **Failure mode**: UIO ingestion failure → orchestrator surfaces `envelope.error` via `ProfileWarning` and transitions to `CLARIFICATION_NEEDED`.

### 5.4 Vector reuse at context-pack assembly (v6 §16, §25)

**Trigger**: `context_pack_generate` finds that a source pin has `uioSourceId` set. **Data out**: `UioAdapter.fetchVectorsBySource(sourceId, chunkIndices?)` returns `UioPoint[]` with dense + sparse + ColBERT vectors ready for Qdrant-style search against the query embedding. Orchestrator skips its own BGE-M3 call for these chunks. **Failure mode**: fallback to orchestrator's own embedder if UIO Qdrant unreachable (config: `uio.reuseEmbeddings: false` effectively).

### 5.5 Telemetry integration (v6 §27.1)

**Trigger**: all UIO adapter calls. **Data out**: Langfuse span `orchestrator.partner.uio.<operation>` with attributes `uio.source_id`, `uio.envelope_id`, `uio.collection`, `uio.vectors_reused` (bool). Counters: `orchestrator.partner_calls_total{partner="uio", operation="..."}`, `orchestrator.partner_vectors_reused_total{partner="uio"}`.

## 6. Glue code patterns

Informational, not normative. Implementation belongs to M2 (reachability in preflight) and M4 (intake path).

```ts
// src/providers/uio/uioMcpAdapter.ts
import { createHash } from "node:crypto";

export interface UioAdapter {
  ingest(input: UioIngestInput): Promise<UioEnvelope>;
  status(envelopeId: string): Promise<UioEnvelope>;
  getCatalogEntry(envelopeId: string): Promise<UioKnowledgeArtifact>;
  fetchVectorsBySource(sourceId: string, chunkIndices?: number[]): Promise<UioPoint[]>;
}

export function createUioAdapter(config: UioConfig, logger: Logger): UioAdapter {
  if (!config.enabled) return createDisabledUioAdapter();

  const http = createHttpClient({ baseUrl: config.baseUrl, headers: { "X-API-Key": config.apiKey } });
  const qdrant = createQdrantClient({ url: config.qdrantUrl, apiKey: config.qdrantApiKey });

  return {
    async ingest(input) {
      const res = await http.post("/api/v1/intake", input);
      return res.body as UioEnvelope;
    },
    async status(envelopeId) {
      const res = await http.get(`/api/v1/intake/${envelopeId}`);
      return res.body as UioEnvelope;
    },
    async getCatalogEntry(envelopeId) {
      const res = await http.get(`/api/v1/catalog/${envelopeId}`);
      return res.body as UioKnowledgeArtifact;
    },
    async fetchVectorsBySource(sourceId, chunkIndices) {
      // Direct Qdrant read — READ ONLY; never write to UIO's Qdrant
      const filter: QdrantFilter = {
        must: [{ key: "source_id", match: { value: sourceId } }]
      };
      if (chunkIndices && chunkIndices.length > 0) {
        filter.must.push({ key: "chunk_index", match: { any: chunkIndices } });
      }
      const scroll = await qdrant.scroll(config.defaultCollection, {
        filter,
        limit: 1000,
        with_vector: true,
        with_payload: true,
      });
      return scroll.points.map(toUioPoint);
    },
  };
}

// src/workflows/intakeWorkflow.ts (relevant excerpt)
async function handleUioFileUpload(source: UioFileUploadSource, uio: UioAdapter): Promise<IntakeResult> {
  const envelope = await uio.ingest({ source_type: "file_drop", raw_content: { garage_key: source.garageKey }, metadata: {} });
  const deadline = Date.now() + config.uio.poll.timeoutMs;
  while (Date.now() < deadline) {
    const status = await uio.status(envelope.envelope_id);
    if (status.status === "completed") return buildIntakeFromUioEnvelope(status, uio);
    if (status.status === "failed") throw new UioIngestionFailedError(status.error);
    await sleep(config.uio.poll.intervalMs);
  }
  throw new UioIngestionTimeoutError(envelope.envelope_id);
}
```

## 7. Gotchas

Each gotcha cites `repo-extraction-findings.md` so rationale is auditable.

1. **PgBouncer transaction-mode requires `statement_cache_size=0` on asyncpg clients.** Named prepared statements break when PgBouncer is in transaction mode. This affects UIO's internal connections, not the orchestrator, but operational teams that share a PgBouncer instance must configure it. (findings.md line 1282; F-202)
2. **BGE-M3 sparse-vector format conversion**: Qdrant expects `{idx: val}` dict; UIO's FlagEmbedding wrapper returns `{indices: [], values: []}`. UIO converts internally (see `src/uio/storage/qdrant.py` `bge_sparse_to_qdrant()`). The orchestrator should not attempt to upsert sparse vectors into UIO's Qdrant; reads return the correct post-conversion shape. (findings.md line 1283; F-206)
3. **Do not write to UIO's Qdrant from the orchestrator.** The orchestrator has read-only access semantics even if the API key technically permits writes. UIO's Hatchet workers own write ordering; concurrent writes corrupt UIO's indexing invariants.
4. **UIO's `operator-profile.yaml` must be present.** UIO's triage classifier reads this at startup. UIO ships a `.example` file; customize before first run or intake classification defaults may not match your domain. (findings.md line 405 — "missing operator profile" caveat)
5. **Deterministic chunk IDs are keyed on `(source_id, content, stage, version_hash)`.** If UIO's `version_hash` changes (upgrade, reingest), the chunk IDs change too. Orchestrator source pins with old IDs will fail to resolve. Mitigation: pin by `source_id + chunk_index` (which remains stable) rather than by UIO's internal UUID, and fall back to re-fetching catalog entry if a vector lookup returns empty. (findings.md line ~400)
6. **UIO's `uio_books_raw_v1` is one of 8 collections.** License-class routing can direct reads to `uio_books_sterile_v1` (licensed-cleared content only) or others. Default to `uio_books_raw_v1` for orchestrator purposes unless your deployment has a sterile-only policy; configure via `UIO_DEFAULT_COLLECTION`. (findings.md line ~398)
7. **UIO does not currently expose MCP resource subscriptions.** The orchestrator cannot receive push notifications when UIO reingests or deletes a source. Poll on intake completion; treat UIO sources as effectively immutable post-completion. (Open question for UIO team; not blocking v1.)

## 8. Validation

After install, run these smoke tests before declaring integration ready.

```bash
# 1. Connectivity
curl -sH "X-API-Key: $UIO_API_KEY" "$UIO_BASE_URL/api/v1/healthz" | jq .

# 2. Qdrant reachability (read-only scroll)
curl -sH "api-key: $UIO_QDRANT_API_KEY" "$UIO_QDRANT_URL/collections/uio_books_raw_v1" | jq '.result.status'

# 3. Orchestrator preflight with UIO target
orchestrator cli preflight --project-id smoke-test --targets uio
# Expect: ProjectProfile.uio with all four booleans true; zero ProfileWarnings for target=uio

# 4. End-to-end intake with UIO document reference
# Assumes an existing UIO source with source_id=SMOKE_SRC
orchestrator cli intake create --project-name smoke \
  --source '{"kind":"uio_document","uioSourceId":"SMOKE_SRC"}'
# Expect: project created, source pin written with uioSourceId, no vector fetch yet

# 5. Context pack generation uses UIO vectors
orchestrator cli context pack --project-id smoke --issue-key SMOKE-1 --verbose
# Expect: log shows "vectors_reused: true" for chunks whose source_id === SMOKE_SRC
```

## 9. Operational concerns

- **Version pinning policy**: pin UIO to a specific commit SHA. Upgrade requires (a) re-running §8 validation, (b) verifying `version_hash` has not changed in a way that affects orchestrator source pins, (c) bumping the orchestrator compatibility-matrix entry (v6 §36).
- **Upgrade path**: UIO releases are coordinated with the orchestrator because embedding schema changes affect vector reuse. Major UIO version bumps require a joint upgrade window.
- **Ownership**: the orchestrator team owns the `UioAdapter` and the integration tests; the UIO team owns the UIO service itself. Joint ownership of the contract (intake envelope schema, catalog entry schema, Qdrant point shape).
- **Partner repo archived/abandoned scenario**: UIO is internal to the same organization; abandonment risk is low. In the event UIO is superseded, the orchestrator's `UioAdapter` boundary isolates the change; replace the adapter implementation without touching the workflow layer. The §25.1 deferred alternative (codebase-memory-mcp algorithmic embeddings) and the orchestrator's own BGE-M3 fallback are the two backstops.
- **Disaster recovery**: UIO's Qdrant and Postgres are backed up independently of the orchestrator. Orchestrator source pins that reference UIO-only content become dangling if UIO state is lost; the readiness report (v6 §17) flags these as `dirty` and regeneration re-ingests.
