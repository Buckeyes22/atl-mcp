# Agent Context Orchestrator MCP Server — Project Plan (v6)


## 0. v6 Review Summary and Material Changes

v5 is a strong and buildable plan. v6 keeps the same mission, architecture, and milestone shape, and **wholesale-adopts the refinement candidates surfaced by a 78-repo extraction survey** (`repo-extraction-findings.md`). The strategic thesis ("orchestration MCP server, not Atlassian MCP clone") is preserved unchanged. New material lands as subsections within the existing §0–§37 spine; four new top-level sections (§38–§41) are appended for cross-cutting concepts, partner integration index, findings coverage table, and skipped-repo appendix. v6 also adds three companion partner guides under `docs/partners/` for repos promoted to direct integration partners (UIO, eval-view, agentdiff).

Material changes from v5:

1. **Stack baselines tightened.** Local dev/test storage swaps SQLite for **PGlite** (same Postgres dialect, eliminates SQL-dialect divergence between dev and deployed Postgres). TypeScript is set to **`exactOptionalPropertyTypes: true`**. AGENTS.md follows the **Linux Foundation (Jan 2026) format**. ADRs use **MADR template** under `docs/adr/`. Conformance tests use the **six-dimension rubric** (instruction compliance, functional correctness, quality evidence, scope control, continuity, portability). See §9.
2. **State machine + queue richer than v5's enum.** Replace v5's enum-only state machine with **PHASE-STATE.json + lockable checkpoints** (concurrent-safe spec locking, file-based for single-tenant). Job queue acquires **four workflow strategies** (simple / queue / tree / DAG with topological waves) and **four scheduler strategies** (round-robin / least-busy / capability-match / dependency-first). Add **discovery-brief compression** (~500-token wave summaries) and **claim-based scope coordination**. M6c VCS provisioning runs in **per-session git worktrees** (`orchestrator/{sessionId}` branches). See §6, §24, §38.4 (Fleet pattern).
3. **Access gate + write guards layered.** Above the existing three-mode access gate, add an **open-edison "lethal trifecta" baseline check** (private-data access × untrusted-content exposure × external communication; block on completion of all three). Add **PUBLIC(0) < PRIVATE(1) < SECRET(2) ACL ranking** with wildcard permission JSON. Add **action-mode capability injection** (read-only / approve-each-tool) as obligation type. Add **UIO compliance gate** structure (similarity / blending / verbatim / adjacency / rate-limit / license-class) for context-pack assembly. Add **four shared protocols** (ux / input-validation / tool-efficiency / conflict-resolution) as governance layer. The PolicyDecisionLayer now has the **`onApproval(completedTasks, nextTasks) → Promise<boolean>`** callback shape with skip-cascade on rejection. See §7, §38.1, §38.2, §38.3.
4. **MCP surface gains discipline + composition primitives.** Adopt **four-mode agent model** (worker / coordinator / coordinated-worker / coordinated-coordinator) for tool-actor categorization. Adopt **skill-first protocol with 1% threshold** ("even 1% chance a skill might apply"). Adopt **iron laws** (no completion claims without fresh verification; no production code without a failing test first). Adopt **two-stage review gate** (spec compliance → code quality). Adopt **persona vocabulary routing** for prompts. Adopt **6-phase agent-generation workflow + 7 patterns** for `handoff_generate`. Adopt **GT0–GT5 orientation detection** for `architecture-review` / `readiness-reviewer`. Adopt **tool-collapse pattern** (3 compound tools default + N granular via `--all-tools`-style flag) to address §34 tool-sprawl risk. Adopt **proactive resource pinning** (`orchestrator://session/current/preflight` auto-loaded). See §14, §29, §38.5.
5. **Context packs more granular.** Adopt **6-category token tracking** (claude-md / mentioned-file / tool-output / thinking-text / team-coordination / user-message) instead of single aggregate. Adopt **5-step progressive truncation** (doc comments → private decls → children → leaf files → final). Adopt **22-model context-size table** for budgeting against the configured target. Add **FTS5 BM25 with column weights** (path 2.0 / summary 1.5 / outline 1.2 / exports 1.0) as the metadata-search component of hybrid ranking, alongside dense Qdrant cosine. Adopt named patterns from `awesome-agentic-patterns`: context-window-auto-compaction (model-specific lane-aware retry with reserve floors), budget-aware routing with hard cost caps, declarative YAML topology, layered configuration context. Reference Memory Bank pattern (`@alioshr/memory-bank-mcp`). See §16.
6. **Readiness rubric layered (not single rubric).** Adopt **eval-view's 4-tier verdict** (SAFE_TO_SHIP / SHIP_WITH_QUARANTINE / INVESTIGATE / BLOCK_RELEASE). Adopt **Caliber's deterministic 6-category scoring** (existence/quality/grounding/accuracy/freshness/bonus → A/B/C/D) for zero-LLM baseline. Adopt **5-category test framework** (UT / IT / ST / PT / E2E) with auditable "Not applicable" claims. Adopt **5-section skill format** (Identity / Orientation / Protocol / Quality Gates / Exit). Confidence is now `{ checked, confidence: 0–100 }` per check plus a **numeric `confidenceScore: 0..1`** field alongside the categorical `Confidence` enum. See §17, §38.6.
7. **Preview/approve/execute hardened.** Add **adversarial verification triplet** (false-positive filter + missing-issues finder + context validator → PASS/FAIL synthesis). Add **deploy-gate accountability** (summarize → tell PO → PO approves → commit → log → checkpoint). File-based handoff serialization uses **BRIEF / REQUEST / FEEDBACK files** between waves. M6c PR provisioning supports **hunk-level review** with merge3. See §18.
8. **Streamable HTTP transport architecture borrowed.** Adopt **indxr's transport architecture** (axum-equivalent + SSE + 1 hour sliding TTL + 1000 concurrent + session lifecycle). Adopt **WebSocket batching + per-entity throttling + 1MB backpressure** as the backpressure pattern. Adopt **dual-port architecture** (MCP on 3000 / mgmt+health API on 3001) for clean separation. Adopt **SSE 30s keep-alive** + no-polling pattern for `notifications/resources/updated`. See §22.
9. **Sampling acquires seat-based providers + fallback chains.** Add **seat-based vs API-key provider distinction** (Claude CLI `claude -p`, Cursor ACP `agent acp --trust`, alongside API-key Anthropic/OpenAI/Vertex). Add **grammar-constrained JSON via GBNF** as alternative to JSON-mode for guaranteed-valid structured outputs. Reference **17-LLM-provider abstraction** (plano) for fallback-chain design. See §23.
10. **Webhooks gain dedup keying + corpus.** Adopt **deterministic message IDs** (`sha256(source + timestamp + content)`) for delivery dedup keys. Adopt **Stripe-style HMAC verification + tests** as the canonical verification pattern. Adopt **bundled signature corpus pattern** (per-host event-ID headers: `X-Atlassian-Webhook-Identifier`, `X-GitHub-Delivery`, `X-Hook-UUID`). See §26.
11. **Observability stack picked.** v6 default = **Langfuse + Prometheus + structlog** (uio precedent) plus **OpenTelemetry counters template** (`tool_calls_total`, `tool_calls_blocked_total`, `private_data_access_calls_total`, `untrusted_public_data_calls_total`, `write_operation_calls_total`). Add **install-unique deaggregation ID** for opt-out telemetry. Adopt **Agent Trace v0.1.0 JSONL spec** (Cognition / Cursor / Vercel / Cloudflare alignment) for trajectory export. Adopt **6-observability-enum taxonomy** (autonomy / intent / decision / error_class / gate_type / severity). Add **Sentry conditional init by environment** as supplement for error capture. See §27.
12. **Audit chain gets ed25519 signing without KMS.** Adopt **agentdiff's ed25519 + RFC 8785 JCS canonicalization + git-ref key registry** (`refs/orchestrator/keys/{key_id}:pub.key`) for v1 audit-chain key distribution. KMS becomes optional post-v1. Pair with **anti-stub guardrails (12 patterns)** + should-catch/should-pass fixtures, **banned-patterns semgrep YAML** + bash anti-stub scanner (different enforcement layers), and a **TS `grain`-equivalent anti-slop linter** for AI-generated code drift. Add **CATCH→DIAGNOSE→ROOT CAUSE→FIX→SAVE→ENFORCE** postmortem framework: every detected failure mode produces a hook-enforced guard, not just a written rule. Adopt the **failure-mode taxonomy** (Ambiguity / Missing Context / Wrong Tool / Speed over Safety / Pattern Matching / Model Limitation × SYSTEMATIC / INCOHERENT / OMISSION / API_ERROR). See §30, §38.7.
13. **Testing strategy: adopt eval-view wholesale.** Build §31 around eval-view's framework (Python+Node, 56k SLOC, MCP-server-included): multi-provider LLM-as-judge with caching, verdict layer, drift tracker, golden baselines, auto-PR from production incidents, model-drift canary suite. See §31 and `docs/partners/eval-view.md`.
14. **Risk register grounded.** Reference the **20-failure-mode taxonomy** from FRAMEWORK-METHODOLOGY-AND-AUDIT.md (CodingRepos parent meta-repo) as the source for §34 risk entries.
15. **UIO promoted from "adjacent system" to direct integration partner.** v6 §35 specifies the orchestrator's `project_intake_create` tool to call UIO's MCP `uio_ingest` (or accept a UIO document reference) and pull pre-computed dense+sparse+ColBERT vectors from `uio_books_raw_v1` keyed by `source_id` + `chunk_index`, avoiding re-embedding. Adopt **agentic-coding-handbook's 8 context strategies** (with MCPs as #4) as the documented context-source taxonomy. Adopt **unidirectional sync architecture** (orchestrator reads repo state, pushes to external Notion/Linear/Jira, **never reads back from tracker for decisions**). See §35 and `docs/partners/uio.md`.
16. **Partner-repo install guides added.** New `docs/partners/` directory with `README.md` index plus three P0 guides: `uio.md`, `eval-view.md`, `agentdiff.md`. Each guide follows a fixed 9-section template (why / prerequisites / clone+install / configuration / integration points / glue code patterns / gotchas / validation / operational concerns). Two P1 guides (context-fabric, hindsight) are deferred unless §16 / §25 implementation actually depends on a vendored repo (vs pattern lift). See §39.

**Conflict resolutions in v6:**

- **Queue: BullMQ remains v6 default.** Considered: Hatchet (uio uses it; Postgres-backed, GPU-aware worker labels), zeroshot SQLite ledger. Reason for default: BullMQ is the lowest-friction TS-native choice and v5 §24 already specifies it; Hatchet wins for GPU-bound workloads which v6 does not have. Hatchet recorded as "Considered, deferred" in §24.
- **Vector retrieval: Qdrant + BGE-M3 remains v6 default.** Considered: codebase-memory-mcp algorithmic 11-signal embeddings (no LLM dependency, SQLite + int8 quantized). Reason for default: Qdrant + BGE-M3 is what UIO already produces and §35 specifies embedding reuse from UIO. Algorithmic embeddings recorded in §25 as "Considered, deferred" — relevant if BGE-M3 cost/latency becomes prohibitive.
- **Audit-chain key distribution: agentdiff's git-ref key registry replaces KMS for v1.** Considered: KMS, Vault, AWS Secrets Manager. Reason for default: git-ref registry works offline, requires no external service, survives squash/rebase via UUID dedup, and is documented as adoption-ready in agentdiff. KMS becomes optional post-v1 per §30.
- **Memory layer: partially promoted.** Project-scoped persistent memory across MCP sessions is adopted behind `PERSISTENT_AGENT_MEMORY_ENABLED` using retain/recall/reflect/forget tools plus bounded context-pack injection. Cross-project personal memory remains a consuming-agent concern. Considered references remain in §25.

Material changes v5 made to v4, preserved and endorsed here:

1. Add a session capability registry and adaptive feature exposure. The server records the client protocol version, client info, and client capabilities during MCP initialization, then gates sampling, elicitation, completions, resource subscriptions, and optional task-style behavior on what was actually negotiated for that session.
2. Fix the Rovo MCP endpoint in configuration. The upstream Rovo provider uses `https://mcp.atlassian.com/v1/mcp` for Streamable HTTP. Legacy HTTP+SSE endpoints are not a default path and are not used for upstream Rovo integration.
3. Clarify the formal policy-engine decision. v1 uses a small `PolicyDecisionLayer` interface backed by code-based policy checks, Zod validation, write guards, preview approvals, and the access gate. OPA/Rego or Cedar adapters are planned post-v1 when a second or third deployment proves the need for declarative policy.
4. Add a multi-tenant SaaS runway without making v1 SaaS. v1 remains single-tenant per deployment, but the persistence model carries `tenantId = "default"`, repository calls require a tenant scope, vector collections and secret paths are tenant-scoped, and the SaaS admin plane plus Postgres RLS remain post-v1 work.
5. Require structured tool outputs. High-level workflow tools declare `outputSchema` and return `structuredContent` that conforms to it, while also returning a short text summary for older or less capable clients.
6. Make model/tokenizer selection fully configurable. Examples no longer rely on a hard-coded future model name; the context-pack token budget is computed against the configured build-agent target.
7. Add Codex/Claude client notes as generated docs. The repo emits `docs/codex.md` and `docs/claude-code.md` with MCP setup, tool approval, elicitation, and transport guidance, but the server does not assume that every host supports elicitation or subscriptions.

Material changes v4 made to v3, preserved and endorsed here:

1. Declare target MCP spec versions. The server explicitly targets a stable MCP spec version and lists optional or draft capabilities behind flags so client compatibility is knowable.
2. Design the access-control gate for cached and vectorized context. Because downstream-token pass-through is prohibited, the gate runs in one of three modes — single-user local, remote re-check per read, or cached-ACL with webhook-triggered invalidation — each with explicit failure behavior.
3. Specify actor attribution for service-account and OAuth-app writes. When the server uses a server-owned credential to create a Jira issue, a Confluence page, or a PR, it records the originating MCP principal as a label/fingerprint, metadata block, and audit entry so the trail survives the identity hop.
4. Extend preflight. The preflight profile covers vector-store connectivity, embedding endpoint reachability, webhook registration state, TTL, and invalidation triggers.
5. Export preflight results to telemetry. Structured-log and OTel-span emission of preflight warnings make operational patterns across projects observable.
6. Add webhook delivery idempotency. Atlassian and Bitbucket deliver at least once; dedup uses provider event ID where available and payload hash otherwise.
7. Specify a default Rovo MCP allowlist. Search and fetch-by-ID only; writes and administrative calls are blocked by default.
8. Split Milestone 6. M6a is Jira provisioning, M6b is Confluence provisioning, M6c is VCS branch+PR provisioning. The first shippable slice terminates at M6a.
9. Use non-deprecated Jira create-meta endpoints: `/rest/api/3/issue/createmeta/{projectIdOrKey}/issuetypes` and `/rest/api/3/issue/createmeta/{projectIdOrKey}/issuetypes/{issueTypeId}`.
10. Resource pagination. MCP resources that enumerate many items support server-side filtering and pagination.

Material changes v3 made to v2, preserved and endorsed here:

1. Preflight and capability discovery before provisioning, with a stored `ProjectProfile` consumed by the planner.
2. Confluence rendering defaults to `body.representation = "storage"`; `atlas_doc_format` is optional behind a feature flag and compatibility tests for the target site. Jira rich-text fields continue to use ADF.
3. Pass-through of MCP-client downstream tokens is prohibited. Server-owned OAuth 2.0/2.1 flows, server-owned API token, or service-account/bot credentials are the supported auth modes; standards-based token exchange is reserved for enterprise deployments that need it.
4. Tool annotations for every tool (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) as UI hints, not enforcement.
5. Elicitation support for clarification and approval, with non-elicitation fallbacks and an explicit prohibition on using elicitation to collect secrets.
6. Access-control gate before returning cached, summarized, or vector-retrieved content.
7. VCS writes are branch-and-PR-first by default.
8. Operational states: `VALIDATION_FAILED`, `DRIFT_DETECTED`, `ARCHIVED`. Drift affects readiness.
9. Atlassian Rovo MCP is an optional upstream read-only provider only, accessed through the current Streamable HTTP `/v1/mcp` endpoint.
10. The first shippable slice is narrowed below the full plan.

## 1. Mission

Build an MCP server that turns raw project requirements into an agent-ready Atlassian workspace. The system creates and maintains the Confluence, Jira, and VCS context that implementation agents need to begin work with minimal ambiguity.

The server is not primarily a Jira/Confluence/Bitbucket API wrapper. It is an orchestration layer that accepts project requirements, converts them into a normalized project blueprint, generates a linked Confluence documentation tree and a Jira issue hierarchy, prepares VCS repository context and agent instructions, builds task-level context packs reachable through MCP resources, validates that the project is ready for implementation agents, and keeps the context graph synchronized as pages, issues, and code evolve through a push-based webhook pipeline.

The server is build-agent-agnostic. Codex and Claude Code are reference integration targets; other MCP-capable agents are supported through the same surface.

## 2. Strategic Design Decision

Use an orchestration MCP server, not an Atlassian MCP clone.

Atlassian already ships a Rovo MCP server for Jira, Confluence, Compass, and Bitbucket Cloud. This project sits above that layer and owns the higher-level workflow: project intake, artifact generation, traceability, readiness validation, context-pack assembly, and agent handoff.

The architecture is a hybrid provider model. Direct Atlassian REST APIs are used for provisioning, idempotent writes, custom field handling, dry-run diffs, and exact payload control. Rovo MCP is used optionally for semantic search and read-only retrieval where available and allowed, and is explicitly never used on write paths. Provider interfaces stay abstract so the server can switch between direct REST, Rovo MCP, mocks, or Data Center adapters later.

The Rovo MCP provider is an upstream provider implementation, not a tool surface exposed transitively to build agents. The orchestrator does not mirror all upstream Rovo tools into its own MCP tool list because that would recreate tool sprawl and weaken safety boundaries. If Rovo is enabled, calls are mediated through typed provider methods with explicit allowlists and audit records. The default Rovo allowlist covers read and search operations only — specifically, Rovo tools equivalent to Jira issue search, Jira issue fetch, Confluence content search, Confluence page fetch, and cross-product semantic search. Writes, administrative operations, and anything outside the allowlist are blocked unless explicitly extended in configuration. Use Atlassian's Streamable HTTP `/mcp` endpoint for Rovo; do not depend on legacy SSE endpoints.

### Target MCP spec version

The server declares support for a stable MCP specification version in its server info. As of 2026-04-24, the latest published MCP specification is `2025-11-25`, and Milestone 0 should target it when the TypeScript SDK and reference hosts support it. If either reference host or the SDK lags, the server may initially negotiate `2025-06-18`, but the compatibility matrix must record the fallback and must keep newer features behind flags. Draft or opt-in capabilities — for example, MCP Tasks for long-running operations — are enabled only behind feature flags and are not relied upon in the default configuration.

### Session capability negotiation and adaptive feature exposure

MCP initialization is not just a version check. The server records a `McpSessionProfile` for each session containing the negotiated protocol version, client info, client capabilities, enabled server features, and disabled feature reasons. The server then follows these rules:

1. Only send `sampling/createMessage` requests when the client advertised sampling and the current workflow is tied to an originating request that permits sampling.
2. Only send elicitation requests when the client advertised elicitation and Codex/Claude policy allows elicitation prompts to surface. Otherwise, return a structured approval or clarification request through normal tool output.
3. Only advertise task-style execution metadata when the server feature flag is enabled, the negotiated protocol supports it, and the client capabilities indicate task support. Job resources remain the default long-running-operation mechanism.
4. Only advertise completions when the server implements `completion/complete` and declares the `completions` capability.
5. Only emit resource update notifications to sessions that subscribed to the resource and only when the server declared `resources.subscribe`.
6. Never hide safety-critical fallback tools just because a client lacks an optional feature. For example, `approval_request` remains available; its behavior adapts to the session.

A diagnostic resource, `orchestrator://session/current/capabilities`, exposes the current session profile for debugging and support. The compatibility matrix in Section 36 records, per server release and per reference client, which features are expected to work: elicitation, resource subscriptions, Streamable HTTP, completion, task-style execution, and host-delegated sampling.

A second proactive resource, `orchestrator://session/current/preflight`, is **auto-pinned** into the session context where the client supports proactive resource pinning (per the Mengram `memory://profile` pattern). It returns the current `ProjectProfile` summary and is refreshed whenever preflight state changes. Clients that do not support pinning fetch it on demand. (from mengram, see §40 F-053)

## 3. Assumptions for the First Build

These assumptions are safe defaults. Each is configurable rather than hard-coded.

Atlassian Cloud is the first target. Bitbucket Cloud is the first VCS target; Bitbucket Data Center and Bitbucket Server are out of scope for MVP because their REST APIs differ substantially from Bitbucket Cloud and would require a separate adapter. Codex and Claude Code are first-class reference agents; neither is privileged in the design. The MCP server is built in TypeScript on Node.js 22+ with `exactOptionalPropertyTypes: true`. Confluence, Jira, and Bitbucket Cloud are the sources of truth. The orchestrator stores metadata, trace links, readiness state, checksums, pinned source versions, and optional generated summaries; it does not store full Atlassian content by default. All write operations support dry-run mode and high-impact writes require a preview result before execution. One Atlassian site, one Jira project, one Confluence space, and one VCS workspace/repo are sufficient for MVP. Multi-site, multi-repo, and multi-tenant support are planned. The server supports both stdio and Streamable HTTP transports from MVP. SSE fallback is optional and temporary for downstream clients that still require it; it must not be used as the default upstream Rovo integration path. **Local development uses PGlite** (Postgres-compatible WASM, same dialect as deployed Postgres so migrations and queries do not diverge between dev and prod) plus an in-memory queue. Deployed mode uses Postgres, Redis/BullMQ, and Qdrant. (PGlite swap from project-foundation, see §40 F-021)

Preflight capability discovery can run at any point after intake capture; it does not require a complete blueprint. Running preflight early is preferred because the intake and blueprint prompts can then incorporate profile warnings (for example, "the target Jira project lacks the Epic issue type, decomposition will collapse Epic into Story parents"). Preflight is still mandatory before `PROVISIONING_PREVIEWED` and is re-verified before `PROVISIONED`.

The orchestrator is **build-agent-aware in eight categories of context** (see §35.4), so the system knows which inputs to expose to which agents and how to keep them fresh. The categories are: (1) implementation plans, (2) well-crafted prompts, (3) host-MCP tools (Claude Code / Cursor / Codex / Windsurf / OpenCode / etc.), (4) external MCPs (Jira / Confluence / Figma / GitHub / Rovo), (5) visual mockups, (6) project instructions (CLAUDE.md / AGENTS.md / .cursor/rules), (7) workspace indexing, (8) conversational memory + small-first scaling. (from agentic-coding-handbook, see §40 F-101)

## 4. Non-Goals for MVP

The following are explicitly out of scope for v1: building a general AI project manager; replacing Jira, Confluence, or Bitbucket as systems of record; shipping a full Atlassian Marketplace app; fine-tuning a model; allowing agents to make silent destructive changes; requiring custom Jira workflows; solving every company-specific project-management convention on day one; and providing human-in-the-loop UI beyond approval prompts surfaced through the MCP host.

Also out of scope for the first shippable slice: automatic deletion/cleanup of remote artifacts, default-branch VCS commits, automatic merges, cross-tenant SaaS hosting, full Jira workflow customization, relying on cached/vector content without a fresh access check, persistent agent memory across projects (a consuming-agent concern, not orchestrator scope), and Bitbucket Data Center / Server support.

## 5. Core User Flow

```text
Raw requirements
  -> intake (optionally via UIO document extraction, with embedding reuse — §35)
  -> preflight capability discovery (early; ProjectProfile auto-pinned as resource)
  -> clarification questions and assumptions
  -> normalized project blueprint
  -> preflight re-verification
  -> Confluence documentation tree
  -> Jira epic/story/task hierarchy
  -> VCS repo preparation (generated branch + PR; per-session worktree)
  -> context graph and cross-links
  -> readiness validation (4-tier verdict + 6-category score)
  -> task-level agent context packs (6-category token tracking)
  -> build agents begin implementation
```

Webhook-driven change data capture runs in parallel once the project is `PROVISIONED`, keeping the context graph current without requiring agent polling. The orchestrator follows **unidirectional sync** — it reads its own repo state for decisions and pushes updates to external trackers (Notion / Linear / Jira / Confluence), but never reads back from those trackers to make work-routing decisions. (unidirectional sync from project-foundation-workbench `SYNC.md`, see §40 F-082)

## 6. Project State Machine

```text
DRAFT_INTAKE
  -> CLARIFICATION_NEEDED
  -> BLUEPRINT_READY
  -> PREFLIGHT_PASSED
  -> PROVISIONING_PREVIEWED
  -> PROVISIONED
  -> LINKED
  -> VALIDATED
  -> READY_FOR_BUILD

Any active state
  -> VALIDATION_FAILED
  -> DRIFT_DETECTED
  -> ARCHIVED
```

State meanings. `DRAFT_INTAKE` indicates requirements captured but not normalized. `CLARIFICATION_NEEDED` indicates missing information or conflicting assumptions. `BLUEPRINT_READY` indicates a structured project blueprint exists. `PREFLIGHT_PASSED` indicates the server has verified required Jira, Confluence, VCS, auth, permission, vector-store, and webhook capabilities. `PROVISIONING_PREVIEWED` indicates a dry-run plan for Atlassian/VCS writes has been produced. `PROVISIONED` indicates pages, issues, and repo artifacts have been created. `LINKED` indicates cross-links among Jira, Confluence, and VCS have been created and verified. `VALIDATED` indicates readiness checks have passed or produced approved waivers. `READY_FOR_BUILD` indicates agents can fetch task-specific context packs and begin work. `VALIDATION_FAILED` indicates readiness checks failed without waivers. `DRIFT_DETECTED` indicates generated artifacts were changed outside the orchestrator or source pins are stale. `ARCHIVED` indicates the project is intentionally no longer active.

### 6.1 PHASE-STATE.json — concurrent-safe persistence

State is persisted as `PHASE-STATE.json` per project (file-backed for single-tenant; tenant-scoped row in Postgres for multi-tenant deployments). The schema is validated against `PHASE-STATE.schema.json`. (from project-foundation-workbench, see §40 F-076)

```json
{
  "schemaVersion": 1,
  "tenantId": "default",
  "projectId": "PCO-123",
  "currentState": "PROVISIONING_PREVIEWED",
  "lockedSpec": "M6a-jira-provision",
  "lockedBy": "worker-7b3c",
  "lockedAt": "2026-04-24T10:14:00Z",
  "checkpointPath": ".orchestrator/checkpoints/PCO-123/2026-04-24T10-14-00.json",
  "phaseHistory": [
    { "from": "DRAFT_INTAKE", "to": "BLUEPRINT_READY", "at": "2026-04-24T09:30:00Z", "by": "intakeWorkflow" }
  ]
}
```

`lockedSpec` prevents concurrent execution of the same provisioning step from two workers. A worker that finds a spec locked **skips to the next available spec** rather than waiting (no deadlock, no wait queue). Locks have a TTL; stale locks (TTL exceeded) are reclaimable. Checkpoint files at `.orchestrator/checkpoints/{projectId}/{timestamp}.json` contain context summary, next task, and state snapshot so a `resume` operation can pick up after a crash or context-window exhaustion. (lockable-checkpoint pattern from project-foundation-workbench + Citadel claim-based coordination, see §40 F-076 + F-141)

### 6.2 Workflow strategies for in-state work

Within a phase, work that fans out into sub-tasks is dispatched per a configurable workflow strategy: (from agent-maestro, see §40 F-061)

- **simple**: single task, direct execution; phases execute → report → complete.
- **queue**: FIFO sub-task loop; pull → claim → execute → report → finish → loop.
- **tree**: subtask tree with dependency ordering; discover leaf tasks, execute in dependency order, per-task status tracking.
- **intelligent-batching**: groups independent sub-tasks into parallel batches; batches run sequentially.
- **dag** (default for §6 multi-spec phases): topological wave execution. Build dependency graph, execute ready-task waves in parallel, maximize concurrency.

Each strategy is selected per phase via the `ProjectProfile`. M6a Jira provisioning uses `dag` because Jira issue creation has natural ordering (epics before stories) but stories within an epic are independent.

### 6.3 Drift detection and `DRIFT_DETECTED` triggers

`DRIFT_DETECTED` fires when any of the following are observed:

- A webhook-ingested change to an orchestrator-generated artifact (Jira issue / Confluence page / VCS file) does not match the orchestrator's stored checksum or version pin.
- A scope-signature comparison shows the underlying intake or blueprint has changed since `PROVISIONED` (scope-signature pattern from project-foundation-workbench `scope.mjs`).
- A preflight invalidation event (permission scheme change, branch protection change, auth token rotation) marks the `ProjectProfile` stale beyond TTL (see §9).
- A blueprint or prompt version bump renders existing context packs eligible for regeneration (the eligible flag is set; packs are not auto-invalidated).

Drift detection takes inputs from: webhook ingestion (§26), scope-signature watcher (§9), and the post-compaction recovery hook (`re-inject orchestrator-managed metadata on compaction`, claude_agent_teams_ui pattern, see §40 F-094).

## 7. High-Level Architecture

```text
MCP Host / Agent (Codex, Claude Code, other)
        |
        v
Agent Context Orchestrator MCP Server
 |-- Transports: stdio, Streamable HTTP (optional temporary SSE fallback)
 |-- MCP Tools: intake, preflight, blueprint, preview, provision, validate, context, handoff
 |-- MCP Resources: manifest, context, readiness, trace-map, task packs (paginated)
 |-- MCP Prompts: intake, decomposition, handoff, validation
 |-- MCP Sampling client: LLM calls delegated to host model
 |-- MCP Elicitation client: clarification and approval requests where supported
 |-- MCP Session Capability Registry
 |
 |-- Domain Orchestration Engine (PHASE-STATE + workflow strategies)
 |-- Project Blueprint Builder
 |-- Capability/Profile Discovery Engine
 |-- Artifact Planner
 |-- Context Graph Store (relational; PGlite local, Postgres deployed)
 |-- Vector Store (semantic retrieval; Qdrant deployed; UIO embedding reuse)
 |-- Readiness Validator (deterministic 6-category score + LLM-judged 4-tier verdict)
 |-- Context Pack Builder (6-category token tracking, 5-step truncation)
 |-- Access-Control Gate for cached/vector context (see §38.1 lethal trifecta + §38.2 ACL)
 |-- Policy Decision Layer (code-based MVP; OPA/Cedar adapters planned)
 |   `-- Approval-gate callback: onApproval(completedTasks, nextTasks)
 |-- Write Guards (banned-pattern scanner + grain anti-slop; see §30, §38.7)
 |-- Renderer Registry (Jira ADF, Confluence storage, optional Confluence ADF)
 |-- Audit Log (ed25519 + JCS canonicalization, git-ref key registry)
 |-- Job Queue Worker (BullMQ; provisioning, sync, validation; 4 scheduler strategies)
 |-- Webhook Ingress (Atlassian + VCS CDC; deterministic dedup IDs)
 |-- Notification Dispatcher (pluggable Transport<T>: Slack / Teams)
 |-- Observability Layer (Langfuse + Prometheus + structlog + OTel + Sentry)
 |
 |-- Provider Interfaces
       |-- Atlassian Capability Discovery Provider
       |-- Jira REST Provider (direct, ADF for Jira rich-text fields)
       |-- Confluence REST Provider (v2, storage representation by default)
       |-- Vcs Provider
       |     |-- Bitbucket Cloud REST Adapter (MVP; per-session worktrees)
       |     |-- GitHub REST Adapter (planned)
       |     |-- GitLab REST Adapter (planned)
       |-- Notification Provider
       |     |-- Slack Adapter
       |     |-- Teams Adapter
       |-- Optional Atlassian Rovo MCP Provider (read-only, allowlisted)
       |-- UIO Adapter (direct partner; calls uio_ingest, reads vectors by source_id)
       |-- Mock Provider (tests)
```

### 7.1 Access-control gate for cached and vectorized context

Because the server authenticates to Atlassian with credentials it obtained and manages itself (service account, API token, or a per-user OAuth 3LO token stored by the orchestrator) rather than blindly passing through MCP-client tokens, a cache or vector hit cannot implicitly inherit the caller's permissions. The gate enforces one of three modes, selected by configuration and declared in the `ProjectProfile`. Shared deployments should prefer per-user OAuth 3LO. Service-account-only shared deployments must either operate under an explicit shared-principal policy or fail closed for cached/vectorized private content.

Mode A — single-user local. The gate is disabled. All cache and vector hits are returned without re-checking. This mode is intended for single-user homelab and development deployments and is refused when the server is running multi-user.

Mode B — remote re-check per read. Every cache or vector hit is verified by a lightweight read against Atlassian using the caller's linked downstream credential when available, or by an approved provider-specific permission check when the deployment has the required admin scope. This mode is authoritative but adds latency and quota cost. It is the default for shared deployments until mode C is populated. If no caller-bound downstream credential or admin-grade permission-check path exists, the read fails closed unless the deployment is explicitly configured as a shared-principal environment.

Mode C — cached ACL with webhook-triggered invalidation. The server records per-artifact access decisions observed in prior reads and returns cache hits based on the stored ACL. Webhook events that signal permission changes (Jira permission scheme edits, Confluence space permission edits, project role changes) invalidate the affected ACL entries. Unknown principals or ACL entries older than the configured staleness window fall through to mode B. Mode C is used when remote-check cost is prohibitive.

The gate's failure behavior is fail-closed. A gate timeout, a provider error, or an ambiguous ACL result denies the cache hit and returns either a mode-B live read or an access-denied response, logged to audit.

**Before any of the three modes runs, the gate applies the lethal-trifecta baseline check (§38.1) and the ACL ranking comparison (§38.2).** If either rejects the hit, the gate denies without consulting modes A/B/C.

### 7.2 Policy decision layer

v1 does not ship a full declarative policy engine. It ships a narrow `PolicyDecisionLayer` interface with a code-based adapter. Every tool call, resource read, provisioning action, access-gate decision, and waiver request is evaluated through that interface. The initial adapter is implemented in TypeScript and composes Zod schema validation, actor/principal checks, tenant scope checks, write guards, preview approval state, access-gate output, project-state constraints, and the **four shared protocols** (ux / input-validation / tool-efficiency / conflict-resolution; see §38.3). (from claude-code-production-grade-plugin, see §40 F-091)

The interface returns one of three effects: `allow`, `deny`, or `require_approval`, plus reasons and obligations. Obligations are concrete server-side requirements such as `requirePreview`, `requireFreshPreflight`, `requireNonDirtyContextPack`, `requireHumanWaiver`, `requireSandboxOnly`, **`requireReadOnlyMode`**, and **`requireApproveEachTool`** (the last two are action-mode capability injections; see §38.3 for the action-mode pattern). These obligations are enforced by the workflow layer and cannot be satisfied by tool arguments alone. (action-mode injection from claude_agent_teams_ui, see §40 F-095)

The PolicyDecisionLayer also exposes a mid-execution callback for waves and batches:

```ts
type ApprovalGate = (
  completedTasks: readonly Task[],
  nextTasks: readonly Task[],
) => Promise<boolean>;
```

When `onApproval` returns `false`, the workflow layer triggers a **skip-cascade**: all `nextTasks` and their downstream dependents are marked `skipped` with the reason `"Skipped: approval rejected"`. (callback shape from open-multi-agent, see §40 F-072)

OPA/Rego and Cedar are explicitly post-v1 adapters. They should be added only when deployments need policy maintained by security/platform teams outside the application code. The interface exists now so the migration does not require rewriting every tool and workflow.

### 7.3 Multi-tenant SaaS runway

v1 remains single-tenant per deployment. However, v1 should not paint the project into a corner. The storage layer carries a `tenantId` field with default value `default`; repository methods require a `TenantScope`; Qdrant collections, secret paths, webhook dedup keys, audit records, and actor fingerprints are tenant-scoped; and tests verify that repository methods cannot be called without an explicit tenant scope.

The following remain post-v1: SaaS admin plane, tenant provisioning UI/API, tenant-level billing, cross-tenant organization management, Postgres row-level security policies, per-tenant Qdrant cluster decisions, tenant-aware rate-limit budgets, tenant-scoped support tooling, and customer-facing audit export. When SaaS hosting becomes real, Postgres RLS is required rather than optional, and the app-level tenant filter becomes defense in depth.


## 8. Repository Structure

```text
agent-context-orchestrator/
  package.json
  tsconfig.json                    (strict + exactOptionalPropertyTypes: true)
  README.md
  AGENTS.md                        (Linux Foundation Jan 2026 format)
  CLAUDE.md
  .cursor/rules/                   (auto-generated from AGENTS.md)
  .codex/config.toml               (auto-generated from AGENTS.md)
  .github/copilot-instructions.md  (auto-generated from AGENTS.md)
  .env.example
  Dockerfile
  docker-compose.yml
  src/
    server.ts
    config.ts
    transport/
      stdio.ts
      http.ts                      (Streamable HTTP; 1h sliding TTL, 1000 concurrent)
    mcp/
      registerTools.ts
      registerResources.ts
      registerPrompts.ts
      sampling.ts
      elicitation.ts
      subscriptions.ts
      sessionCapabilities.ts
      capabilityAwareRegistration.ts
      schemas.ts
    domain/
      projectBlueprint.ts
      projectGraph.ts
      artifactPlan.ts
      projectProfile.ts
      readiness.ts
      contextPack.ts
      traceLinks.ts
      relevance.ts
    workflows/
      intakeWorkflow.ts
      blueprintWorkflow.ts
      provisioningWorkflow.ts
      validationWorkflow.ts
      syncWorkflow.ts
      webhookWorkflow.ts
      phaseStateMachine.ts          (PHASE-STATE.json + lockable checkpoints)
    queue/
      worker.ts
      schedulers/                   (round-robin / least-busy / capability-match / dependency-first)
      strategies/                   (simple / queue / tree / intelligent-batching / dag)
      jobs/
        provisionJob.ts
        syncJob.ts
        validateJob.ts
        webhookJob.ts
    providers/
      Provider.ts
      atlassian/
        auth/
          oauth3lo.ts
          apiToken.ts
          serviceAccount.ts
          actorAttribution.ts
          tokenStore.ts             (envelope encryption: libsodium secretbox)
        capabilityDiscovery.ts
        jiraRestProvider.ts
        confluenceRestProvider.ts
        rovoMcpProvider.ts
        rovoAllowlist.ts
        adf.ts
        confluenceStorageRenderer.ts
        confluenceAdfRenderer.ts
        storageFormat.ts
        rateLimit.ts
        pagination.ts
      vcs/
        VcsProvider.ts
        bitbucket/
          bitbucketRestProvider.ts
          worktreeManager.ts        (per-session worktrees: orchestrator/{sessionId})
        github/
          githubRestProvider.ts
      notification/
        NotificationProvider.ts     (pluggable Transport<T>)
        slackProvider.ts
        teamsProvider.ts
      uio/
        uioMcpAdapter.ts            (calls uio_ingest, reads vectors by source_id)
    storage/
      db.ts                         (PGlite local, Postgres deployed)
      tenantScope.ts
      migrations/
      repositories/
        projectRepository.ts
        graphRepository.ts
        auditRepository.ts          (hash chain + ed25519 signatures)
        jobRepository.ts
        tokenRepository.ts          (envelope-encrypted)
        aclRepository.ts
        keyRegistryRepository.ts    (ed25519 pubkeys; mirrored to refs/orchestrator/keys/)
      vector/
        qdrantClient.ts
        chunker.ts
        embedder.ts                 (when not reusing UIO vectors)
    webhooks/
      ingress.ts
      atlassianHandlers.ts
      vcsHandlers.ts
      signatureVerification.ts
      deliveryDedup.ts              (sha256(source + timestamp + content) keys; Redis)
    security/
      redaction.ts                  (gitleaks-rule-compatible + entropy detection)
      injectionScanner.ts           (untrusted-data markers)
      promptInjectionScanner.ts     (SYSTEM:/<IMPORTANT>/ignore-previous patterns)
      pathGuard.ts                  (relative()-based traversal validation)
      permissions.ts                (PUBLIC/PRIVATE/SECRET ACL + wildcard JSON)
      writeGuards.ts                (12-pattern banned-list + bash anti-stub)
      antiSlopLinter.ts             (TS equivalent of grain)
      bannedPatterns.semgrep.yaml
      lethalTrifecta.ts             (private × untrusted × external = block)
      policyDecision.ts
      policyAdapters/
        codePolicyAdapter.ts
      accessGate.ts
      toolAnnotations.ts
      auditChain.ts                 (ed25519 sign + JCS canonicalization)
      sharedProtocols/              (ux / input-validation / tool-efficiency / conflict-resolution)
    observability/
      logger.ts                     (pino JSON to file; never stdout for stdio servers)
      telemetry.ts                  (Prometheus counters + install-unique deaggregation ID)
      langfuseTracer.ts
      otelExporter.ts
      sentry.ts                     (conditional init by environment)
      preflightTelemetry.ts
      agentTraceJsonl.ts            (Agent Trace v0.1.0 spec)
    evals/                          (eval-view integration; see §31)
      datasets/
      judges/
      runners/
      verdict.ts                    (4-tier: SAFE_TO_SHIP/SHIP_WITH_QUARANTINE/INVESTIGATE/BLOCK_RELEASE)
      driftTracker.ts
    validators/
      blueprintValidator.ts
      jiraValidator.ts
      confluenceValidator.ts
      vcsValidator.ts
    utils/
      stableIds.ts
      tokenBudget.ts                (6-category breakdown; 22-model context-size table)
      truncation.ts                 (5-step progressive)
      confluenceProperties.ts
      markdown.ts
      links.ts
      pagination.ts
  tests/
    unit/
    contract/
    integration/
    conformance/                    (six-dim rubric: instruction / functional / quality / scope / continuity / portability)
    evals/                          (golden + LLM judge; see §31)
    fixtures/
  docs/
    architecture.md
    operations.md
    deployment.md
    context-pack-schema.md
    auth.md
    webhooks.md
    access-gate.md
    policy.md
    multi-tenancy.md
    codex.md
    claude-code.md
    adr/                            (MADR templates; NNNN-decision-title.md)
      0001-pglite-for-dev.md
      0002-bullmq-default-hatchet-considered.md
      0003-qdrant-bge-m3-default-algorithmic-considered.md
      0004-agentdiff-key-registry-replaces-kms-v1.md
      ...
    partners/                       (P0 partner integration guides)
      README.md
      uio.md
      eval-view.md
      agentdiff.md
  scripts/
    syncAgentConfigs.ts             (regenerate .cursor/rules, .codex/config.toml, .github/copilot-instructions.md from AGENTS.md)
```

## 9. Technology Choices

### MVP stack

The implementation language is TypeScript on Node.js 22+ with `tsconfig` set to `strict: true` and **`exactOptionalPropertyTypes: true`** (PAE precedent for stricter type safety than v5 specified). The MCP SDK is the official Model Context Protocol TypeScript SDK (`@modelcontextprotocol/sdk` ≥ v1.27.x; see §22 for transport details). Schema validation uses Zod v4 or another Standard Schema-compatible validator supported by the SDK. HTTP uses undici with a retry and rate-limit wrapper. **Relational storage is PGlite for local MVP** (Postgres-compatible WASM, eliminates SQL-dialect divergence between dev and deployed Postgres) **and Postgres 16+ for deployed versions**; migrations use drizzle. The queue provider is abstract: local development can use an in-memory queue, while deployed mode uses BullMQ backed by Redis 7+. The vector store is Qdrant, deployed either as the existing homelab instance or a project-scoped instance. Embeddings default to BGE-M3 via a local inference endpoint or a hosted embedding API, selected by config; **for documents already ingested by UIO, the orchestrator reuses UIO's pre-computed vectors directly rather than re-embedding** (see §35). Structured logging uses pino with **file output only — never stdout for stdio MCP servers** (stdout corrupts the protocol stream; from simple-commands-mcp + Anthropic guidance, see §40 F-031). Tests use vitest. Observability exports OpenTelemetry spans and traces to Langfuse for any sampling call or context-pack assembly, plus Prometheus counters and Sentry for error capture (see §27).

### Storage policy

The orchestrator database stores tenant IDs, project IDs, Jira issue keys and IDs, Confluence page IDs and versions, VCS workspace/repo slugs and commit SHAs, blueprint versions, trace links, readiness results, content checksums, pinned source versions, observed ACL entries for mode-C access gating, audit records with hash-chain linkage **and ed25519 signatures (see §30, §38.7)**, session capability profiles, policy decisions, and optional generated summaries. Full Atlassian content is not stored by default. The vector store holds chunked, embedded representations of requirements documents, ADRs, selected Confluence pages, and repo README/CONTRIBUTING content for relevance ranking during context pack assembly — except where UIO has already produced embeddings for the same source, in which case the orchestrator references UIO's vectors via `source_id` rather than duplicating them.

### Secret and token storage

API tokens, OAuth access tokens, and OAuth refresh tokens are encrypted at rest using envelope encryption. Acceptable implementations include libsodium `secretbox`/XChaCha20-Poly1305 with a deployment key from a secrets manager, or a cloud/Vault KMS data-key envelope. Sealed-box primitives are public-key constructs and are not appropriate for a deployment-secret model; do not use them for this purpose. Tokens are never written to logs or audit records. The audit record stores the auth-mode identifier and a truncated token fingerprint only.

### Capability discovery and preflight profile

Before any live provisioning, the server must run `project_preflight_check`. The result is stored as a `ProjectProfile` and used by the planner. The profile includes Jira project type and management mode, available issue types, required fields, parent/hierarchy behavior, available issue link types, components, versions, custom field IDs that are safe to write, Confluence space ID, page-create/update permission, supported Confluence body representations, VCS default branch, branch protection, webhook registration state, CI provider, vector-store connectivity and collection existence, embedding endpoint reachability, **UIO partner reachability (when configured)**, auth capability (OAuth scopes granted, service-account roles), and maximum safe request budget.

The planner fails fast if the profile is missing or stale. A profile is stale when its TTL has expired or when an invalidation event has been recorded against it. The default TTL ceiling is 7 days, configurable down to 1 hour. Invalidation events include: a webhook signalling a Jira permission scheme change, a webhook signalling a Confluence space permission change, an auth token rotation, a VCS branch protection change recorded through a VCS webhook, and an explicit `project_preflight_check` call with `forceRefresh: true`. Preflight does not create or update remote artifacts.

Preflight warnings are emitted as structured log records (`orchestrator.preflight.warning`) and as OTel span events on the `orchestrator.preflight.discover` span. Warning attributes include the affected target (`jira`, `confluence`, `vcs`, `vector`, `auth`, `uio`), the capability code, severity, and a stable warning ID. This makes cross-project operational patterns observable in aggregate — for example, service accounts that consistently lack a required Jira permission across sites.

### AGENTS.md and ADR conventions

The repo's `AGENTS.md` follows the **Linux Foundation (Jan 2026) AGENTS.md format** with sections for Dev environment tips / Testing instructions / PR instructions / Coding conventions (per the `agents.md` canonical spec, see §40 F-121). A `scripts/syncAgentConfigs.ts` script regenerates `.cursor/rules/agents.mdc`, `.codex/config.toml`, and `.github/copilot-instructions.md` from the canonical AGENTS.md so cross-host configs do not drift (from project-foundation-workbench, see §40 F-085). CLAUDE.md is hand-authored and intentionally diverges from AGENTS.md in structure (it is project-specific guidance, not the agent contract).

ADRs use the **MADR template** under `docs/adr/` with naming convention `NNNN-decision-title.md` and YAML frontmatter (`status / date / decision-makers / consulted / informed`). Status enum: `proposed | accepted | deprecated | superseded`. Every adoption recorded in v6 §0 has a corresponding ADR in `docs/adr/` capturing rationale and considered alternatives — this is the auditable record for "why did we pick X" questions. (from madr + adr.github.io, see §40 F-122 + F-123)

The conformance test suite uses the **six-dimension rubric** (instruction compliance / functional correctness / quality evidence / scope control / continuity / portability), each scored 0–5. (from ai-coding-framework `benchmarks/rubric.md`, see §40 F-005)

## 10. Domain Model

```ts
export type ProjectState =
  | "DRAFT_INTAKE"
  | "CLARIFICATION_NEEDED"
  | "BLUEPRINT_READY"
  | "PREFLIGHT_PASSED"
  | "PROVISIONING_PREVIEWED"
  | "PROVISIONED"
  | "LINKED"
  | "VALIDATED"
  | "READY_FOR_BUILD"
  | "VALIDATION_FAILED"
  | "DRIFT_DETECTED"
  | "ARCHIVED";

export interface ProjectBlueprint {
  id: string;
  tenantId: string;   // default: "default" for single-tenant v1
  name: string;
  key: string;
  state: ProjectState;
  schemaVersion: number;
  blueprintVersion: number;
  goals: string[];
  nonGoals: string[];
  stakeholders: Stakeholder[];
  requirements: Requirement[];
  features: Feature[];
  epics: EpicPlan[];
  architecture: ArchitecturePlan;
  risks: Risk[];
  openQuestions: OpenQuestion[];
  testingStrategy: TestingStrategy;
  securityPrivacy: SecurityPrivacyPlan;
  releasePlan: ReleasePlan;
  sourcePins: SourcePin[];
  projectProfileId?: string;
}

export interface ProjectProfile {
  id: string;
  tenantId: string;
  projectId: string;
  generatedAt: string;
  expiresAt: string;
  accessGateMode: "local" | "remote_check" | "cached_acl";
  jira: JiraProjectProfile;
  confluence: ConfluenceSpaceProfile;
  vcs: VcsRepoProfile;
  vector: VectorStoreProfile;
  auth: AuthCapabilityProfile;
  webhooks: WebhookRegistrationProfile;
  uio?: UioPartnerProfile;            // present when UIO partner configured
  warnings: ProfileWarning[];
}

export interface ProfileWarning {
  id: string;
  target: "jira" | "confluence" | "vcs" | "vector" | "auth" | "webhooks" | "uio";
  code: string;
  severity: "info" | "warn" | "error";
  message: string;
}

export interface SourcePin {
  artifactRef: ArtifactRef;
  version: string;        // Confluence page version, Jira updated timestamp, Git SHA
  contentChecksum: string;
  pinnedAt: string;
  uioSourceId?: string;   // when content originated from UIO ingestion
  uioChunkIndices?: number[];
}

export interface Requirement {
  id: string;
  title: string;
  description: string;
  type: "functional" | "non_functional" | "constraint" | "assumption";
  priority: "must" | "should" | "could" | "wont";
  acceptanceSignals: string[];
  sourceRefs: SourceRef[];
}

export interface EpicPlan {
  id: string;
  title: string;
  outcome: string;
  stories: StoryPlan[];
  confluenceRefs: string[];
  dependencies: string[];
}

export interface StoryPlan {
  id: string;
  title: string;
  userStory: string;
  acceptanceCriteria: string[];
  implementationNotes: string[];
  testNotes: string[];
  contextRefs: string[];
  dependencies: string[];
  estimatedComplexity: "S" | "M" | "L" | "XL";
}

export interface TraceLink {
  id: string;
  tenantId: string;
  projectId: string;
  source: ArtifactRef;
  target: ArtifactRef;
  relation:
    | "defines"
    | "implements"
    | "depends_on"
    | "documents"
    | "tests"
    | "references"
    | "blocks"
    | "annotates";
}

export interface ContextPack {
  id: string;
  tenantId: string;
  projectId: string;
  issueKey?: string;
  title: string;
  summary: string;
  goals: string[];
  nonGoals: string[];
  acceptanceCriteria: string[];
  implementationPlan: string[];
  testPlan: string[];
  linkedArtifacts: ArtifactRef[];
  relevantFiles: RepoFileRef[];
  risks: Risk[];
  openQuestions: OpenQuestion[];
  tokenBudget: TokenBudgetReport;
  sourcePins: SourcePin[];
  generatedAt: string;
  regenerationKey: string;   // deterministic seed for reproducible regeneration
  freshness: "current" | "stale" | "dirty";
  accessDecision: "allowed" | "denied" | "requires_remote_check";
}

export interface TokenBudgetReport {
  targetModel: string;
  budgetTokens: number;
  usedTokens: number;
  // 6-category breakdown (claude_agent_teams_ui pattern, see §40 F-093)
  byCategory: {
    claudeMd: number;
    mentionedFile: number;
    toolOutput: number;
    thinkingText: number;
    teamCoordination: number;
    userMessage: number;
  };
  sections: { name: string; tokens: number; truncated: boolean }[];
  truncationStep?: 1 | 2 | 3 | 4 | 5;   // which of the 5 progressive truncation steps fired
}

export interface AclEntry {
  tenantId: string;
  projectId: string;
  artifactRef: ArtifactRef;
  principalId: string;
  decision: "allowed" | "denied";
  observedAt: string;
  source: "jira_permission_check" | "confluence_content_permission" | "vcs_repo_permission";
  // ACL ranking (open-edison pattern, see §38.2)
  classification: "PUBLIC" | "PRIVATE" | "SECRET";
}

export interface McpSessionProfile {
  id: string;
  tenantId: string;
  protocolVersion: string;
  clientInfo: { name: string; title?: string; version?: string };
  clientCapabilities: {
    roots: boolean;
    sampling: boolean;
    elicitation: boolean;
    tasks: boolean;
    resourcePinning?: boolean;        // for proactive resource auto-load
  };
  enabledServerFeatures: string[];
  disabledFeatureReasons: Record<string, string>;
  // 4-mode agent classification (agent-maestro, see §40 F-060)
  agentMode?: "worker" | "coordinator" | "coordinated-worker" | "coordinated-coordinator";
  createdAt: string;
  lastSeenAt: string;
}

export interface PolicyDecision {
  effect: "allow" | "deny" | "require_approval";
  reasons: string[];
  obligations: PolicyObligation[];
  evaluatedAt: string;
  // Confidence (velocity-ops-engine + ai-coding-framework + PAE patterns, see §40 F-007 + F-018 + F-046)
  confidenceCategorical: "high" | "medium" | "low";
  confidenceScore: number;            // 0..1 numeric for evidence-weighted comparisons
  checks: Array<{ name: string; checked: boolean; confidence: number }>; // 0–100 per check
}

export interface PolicyObligation {
  kind:
    | "require_preview"
    | "require_fresh_preflight"
    | "require_human_approval"
    | "require_access_gate_allow"
    | "require_non_dirty_context"
    | "require_sandbox_target"
    | "require_tenant_scope"
    | "require_read_only_mode"        // action-mode injection (claude_agent_teams_ui)
    | "require_approve_each_tool";    // action-mode injection
  message: string;
}

export interface AuditEntry {
  id: string;
  tenantId: string;
  projectId?: string;
  timestamp: string;
  actor: {
    mcpPrincipalId: string;
    mcpPrincipalFingerprint: string;  // sha256 of principal id, first 16 hex
    credentialFingerprint: string;     // truncated token fingerprint
    authMode: "api_token" | "oauth3lo" | "service_account";
  };
  toolName: string;
  inputHash: string;                   // sha256, never raw input
  outputArtifactIds?: string[];
  errorState?: string;
  prevHash: string;                    // hash chain
  signature: {                         // ed25519 over JCS-canonicalized record (see §30, §38.7)
    alg: "ed25519";
    keyId: string;                     // first 16 hex of sha256(pubkey)
    value: string;                     // base64
  };
}
```

## 11. Generated Confluence Structure

For every orchestrated project, generate or maintain this page tree.

```text
Project Home
  00 - Project Brief
  01 - Product Requirements
  02 - Scope and Non-Goals
  03 - Stakeholders and Roles
  04 - User Journeys
  05 - Functional Requirements
  06 - Non-Functional Requirements
  07 - Domain Model and Glossary
  08 - Architecture Overview
  09 - Component Specifications
  10 - API and Data Contracts
  11 - Security and Privacy Requirements
  12 - Testing Strategy
  13 - Release and Rollout Plan
  14 - Risks, Assumptions, and Open Questions
  15 - ADR Index
  16 - Agent Build Guide
  17 - Context Map
```

Each generated page carries required metadata: stable orchestrator artifact ID, blueprint version, schema version, generated timestamp, related Jira issue links, related VCS repo/path links, status (draft, reviewed, ready), and owner/steward. Metadata is stored primarily in Confluence content properties and labels, with a small human-visible metadata block in the page body. Page bodies are generated against Confluence v2 REST using `PageBodyWrite`; the default representation is `storage` because it is the documented create/update path. `atlas_doc_format` support is optional and must be feature-flagged until compatibility is proven against the target site. Jira rich-text fields still use ADF through the Jira renderer.

## 12. Generated Jira Structure

MVP hierarchy is Epic → Story → Task as a logical model, not a hard-coded Jira assumption. The project profile maps this logical hierarchy to the target Jira project's available issue types and parent-link behavior. A later hierarchy option supports Initiative → Epic → Story → Task/Sub-task when the target Jira configuration supports it.

Each generated Jira issue contains summary, description in ADF, acceptance criteria, definition of ready, definition of done, context pack URI, Confluence context links, VCS repo/path links, dependencies, risks, open questions, labels, component, priority, a "Generated By: Agent Context Orchestrator" marker, blueprint version, and actor attribution (see §20). The artifact planner probes project type (`projectTypeKey`), management mode (`simplified`), create metadata, required fields, safe custom fields, link types, components, and hierarchy behavior before generating payloads. Team-managed projects skip custom-field-scheme-dependent writes; company-managed projects use the full discovered field set only when the field is present and safe to write.

Suggested labels include `agent-ready`, `generated-by-context-orchestrator`, `needs-human-review`, `blocked-by-open-question`, `architecture-required`, `security-review-required`, `test-plan-required`, and an actor-attribution label `orchestrator-actor-<principal>`.

## 13. Generated VCS Artifacts

For a new or existing repository, the VCS provider generates or updates a common set of files, with CI configuration specialized per provider. By default, all generated VCS changes are written to a generated branch and proposed through a pull request. Direct commits to the default branch require an explicit configuration override and a separate approval path. **For sandboxed isolation, M6c VCS work executes in a per-session git worktree at `.worktrees/orchestrator-{sessionId}/` on branch `orchestrator/{sessionId}`** (from agent-maestro pattern, see §40 F-064). This prevents two concurrent provisioning runs from interfering with each other's working tree.

```text
README.md
AGENTS.md
CLAUDE.md
CONTRIBUTING.md
.bitbucket/pull-request-template.md     # when provider is Bitbucket Cloud
.github/PULL_REQUEST_TEMPLATE.md        # when provider is GitHub
.cursor/rules/project.mdc
bitbucket-pipelines.yml                 # when provider is Bitbucket Cloud and CI is required
.github/workflows/ci.yml                # when provider is GitHub and CI is required
docs/
  agent-context/
    manifest.yaml
    project-brief.md
    architecture-summary.md
    task-index.md
    readiness-report.md
  adr/
    0001-initial-architecture.md
```

`AGENTS.md`, `CLAUDE.md`, and `.cursor/rules/project.mdc` are generated from a single canonical source to preserve parity across build agents. `docs/agent-context/manifest.yaml` is the authoritative agent manifest.

### Example `docs/agent-context/manifest.yaml`

```yaml
project:
  id: pco-123
  key: PCO
  name: Agent Context Orchestrator
  blueprintVersion: 1
  schemaVersion: 1

atlassian:
  jira:
    projectKey: PCO
    issueSearch: 'project = PCO ORDER BY Rank ASC'
  confluence:
    spaceKey: PCO
    homePageTitle: Project Home

vcs:
  provider: bitbucket_cloud
  workspace: example-workspace
  repoSlug: agent-context-orchestrator

contextResources:
  projectManifest: orchestrator://project/pco-123/manifest
  projectContext: orchestrator://project/pco-123/context
  readinessReport: orchestrator://project/pco-123/readiness
  taskContextTemplate: orchestrator://issue/{issueKey}/context

agentRules:
  alwaysRead:
    - AGENTS.md
    - docs/agent-context/manifest.yaml
    - docs/agent-context/project-brief.md
  beforeImplementing:
    - fetch the Jira issue context pack
    - check linked Confluence pages
    - check acceptance criteria and test plan
    - confirm no blocking open questions
```

## 14. MCP Surface Area

### Design principle

Three MCP primitive types are exposed intentionally. Resources serve read-only context and support subscriptions for change notifications. Tools expose workflow actions and writes; they are kept high-level to avoid agent overload. Prompts codify repeatable agent workflows and are versioned alongside the blueprint schema. Tool outputs are structured by default: tools that return machine-actionable data declare `outputSchema`, populate `structuredContent`, and include a concise text summary for clients that only render text.

### Tool-collapse pattern

To address the §34 tool-sprawl risk, the orchestrator exposes **3 compound tools by default** (`workflow_step`, `context_query`, `provision_action`) that internally route to specific operations. The full set of N granular tools (listed below) is available behind an `--all-tools` configuration flag for hosts that prefer explicit per-operation tools. Most agents see a small surface; power users and custom integrations get full granularity. (from indxr, see §40 F-051)

### Tools (full granular set)

| Tool | Purpose | Side Effects |
|---|---|---:|
| `project_preflight_check` | Discover and validate Jira, Confluence, VCS, vector, auth, permission, webhook, UIO, and rate-limit capabilities before planning. | local DB only |
| `project_profile_get` | Return the current preflight/capability profile and staleness status. | none |
| `session_capabilities_get` | Return the current MCP session profile and feature-gating decisions. | none |
| `project_intake_create` | Capture raw requirements, a UIO document reference, or a UIO document upload and create a draft project record. | local DB; may call UIO `uio_ingest` |
| `project_blueprint_generate` | Convert requirements into a normalized blueprint using host-delegated sampling. | local DB only |
| `project_blueprint_update` | Apply human-approved changes to the blueprint. | local DB only |
| `project_provision_preview` | Produce a dry-run write plan for Confluence/Jira/VCS with request-count estimate. Requires a non-stale project profile. | none |
| `project_provision_execute` | Enqueue an approved provisioning job and return a job handle. | writes Atlassian and VCS |
| `project_sync` | Force a reconciliation read of Atlassian and VCS artifacts and refresh the graph. | local DB only |
| `context_pack_generate` | Generate project-level or issue-level context packs with hybrid relevance ranking and 6-category token tracking. | local DB optional |
| `context_get` | Return bounded context for an issue, epic, or project. | none |
| `readiness_validate` | Validate whether the project or issue is build-ready against the layered rubric (deterministic 6-category score + LLM-judged 4-tier verdict). | local DB only |
| `artifact_annotate` | Attach metadata to a blueprint artifact — trace links, decision records, or open questions — discriminated by `kind`. | local DB and optional Atlassian |
| `handoff_generate` | Generate a build-agent handoff for one Jira issue, targeting Codex, Claude Code, or a generic agent. Output is **manifest-shaped** (see §14.3). | none |
| `approval_request` | Ask the user to approve a high-impact action through MCP elicitation when supported, otherwise return a structured approval request. | none |

### Resource URI scheme

```text
orchestrator://session/current/capabilities
orchestrator://session/current/preflight        # auto-pinned where supported
orchestrator://project/{projectId}/manifest
orchestrator://project/{projectId}/profile
orchestrator://project/{projectId}/blueprint
orchestrator://project/{projectId}/context
orchestrator://project/{projectId}/readiness
orchestrator://project/{projectId}/trace-map
orchestrator://project/{projectId}/job/{jobId}
orchestrator://issue/{issueKey}/context
orchestrator://issue/{issueKey}/handoff
orchestrator://issue/{issueKey}/acceptance-criteria
orchestrator://issue/{issueKey}/linked-artifacts
orchestrator://repo/{workspace}/{repoSlug}/agent-guide
```

Resources support `resources/subscribe` and emit `notifications/resources/updated` when the underlying graph entry changes due to webhook ingestion or sync completion. `resources/templates/list` is implemented for discoverability. `completion/complete` is implemented for prompt arguments that reference project keys and issue keys. **SSE keep-alive frames are sent every 30s on subscribed connections to avoid intermediary timeout** (from claude_agent_teams_ui pattern, see §40 F-097).

Resources that can enumerate many items — notably `trace-map`, `linked-artifacts`, the job list under a project, and any future issue-enumeration resource — accept query-string filters (`?since=`, `?kind=`) and pagination cursors (`?cursor=`, `?limit=`). Server responses include a `nextCursor` field when more pages are available. Subscribed clients continue to receive updates scoped to the filter they originally supplied.

### 14.1 Four-mode agent classification

Sessions are tagged with one of four agent modes (`McpSessionProfile.agentMode`) that affect tool exposure and policy decisions: (from agent-maestro, see §40 F-060)

- **`worker`** — single-task agent (Codex/Claude Code on a story). Sees the granular tool set; cannot spawn subagents via the orchestrator's session tools.
- **`coordinator`** — multi-step orchestrator (an agent driving M5–M6c provisioning waves). Sees `workflow_step` compound tools and the spawning shape of `handoff_generate`.
- **`coordinated-worker`** — worker invoked by a coordinator. Inherits the coordinator's project scope; restricted from re-entering preview/execute on the parent's behalf.
- **`coordinated-coordinator`** — sub-orchestrator (rare; for split provisioning across parallel teams). Subject to the same restrictions as `coordinated-worker` plus a hard cap on recursion depth.

The mode is established at session initialize from a header / hint or defaults to `worker`. The PolicyDecisionLayer consults the mode for action-mode obligation injection (§38.3).

### 14.2 Skill-first protocol with 1% threshold

When an orchestrator-side skill could plausibly apply to a request, the server's tool dispatch invokes the skill **even if the threshold of relevance is only 1%**. Better to over-trigger a cheap skill than miss it. (from superpowers, see §40 F-105) Two iron laws are enforced as policy obligations:

- **No completion claims without fresh verification evidence.** Every `*_complete` outcome must be accompanied by a verification artifact (build log, test result, linked PR, etc.); the obligation `requireVerificationEvidence` is enforced by the workflow layer.
- **No production code without a failing test first.** Pre-commit / pre-merge gates reject changes lacking an antecedent failing test. (Iron laws from superpowers, see §40 F-106)

### 14.3 Manifest-driven `handoff_generate`

The output of `handoff_generate` is a `ManifestSpawn` shape rather than a free-form prompt: (from agent-maestro pattern, see §40 F-063)

```ts
interface ManifestSpawn {
  manifestVersion: 1;
  generatedAt: string;
  targetAgent: "codex" | "claude-code" | "cursor" | "windsurf" | "opencode" | "generic";
  agentMode: "worker" | "coordinator" | "coordinated-worker" | "coordinated-coordinator";
  task: { issueKey: string; title: string; objective: string };
  contextPackUri: string;
  acceptanceCriteria: string[];
  testPlan: string[];
  capabilities: { allow: string[]; deny: string[]; obligations: PolicyObligation[] };
  prompts: { system: string; user: string };
  // 6-phase agent-generation workflow (claude-agent-builder, see §40 F-110)
  phaseGuidance: ["context-scan" | "discovery" | "research" | "architecture" | "build" | "verify"];
  // pattern selection from 7-pattern library
  pattern?: "command-agent-skills" | "research-consolidate-plan-execute" | "parallel-specialists"
          | "self-evolving" | "hook-guarded" | "slash-command-handoff" | "mcp-powered";
}
```

The host reads the manifest and constructs the spawning command. This separates spawn metadata from prompt text and makes handoff verifiable.

### 14.4 Two-stage review gate

Workflow steps that produce code or content (provisioning actions, context-pack generation, handoff generation) are reviewed in two stages: (from superpowers, see §40 F-107)

1. **Spec compliance review** — independent review (don't trust the report; re-inspect the artifact). Verifies the output matches the request, has no missing requirements, no over-engineering.
2. **Code quality review** — assesses style, naming, error handling, performance, security against the §31 testing strategy.

Stage 2 is gated on stage 1 passing. A failing stage 1 short-circuits without consuming review budget on stage 2.

### Prompts

| Prompt | Purpose |
|---|---|
| `project-intake-interview` | Ask concise questions needed to complete missing requirements. |
| `requirements-decomposer` | Convert raw requirements into features, epics, stories, and risks. Uses GT0–GT5 orientation detection (§29.3) to challenge unclear scope. |
| `architecture-review` | Review the blueprint for missing technical decisions. Uses GT0–GT5 challenge probes. |
| `jira-story-writer` | Produce implementation-ready story descriptions and acceptance criteria. |
| `confluence-page-writer` | Produce standardized Confluence pages from blueprint sections. |
| `readiness-reviewer` | Review an issue or project against the readiness rubric. Uses GT0–GT5 challenge probes. |
| `build-agent-handoff` | Generate a bounded implementation handoff for any compliant build agent. Embeds 6-phase + 7-pattern guidance (§14.3). |
| `post-implementation-sync` | Summarize changes and update context after implementation. |

Prompts carry a `promptVersion` field. When a prompt version is bumped, dependent context packs are marked as eligible for regeneration but are not invalidated automatically.

### Tool annotations and approval hints

Every MCP tool declares annotations. Suggested defaults:

| Tool group | `readOnlyHint` | `destructiveHint` | `idempotentHint` | `openWorldHint` |
|---|---:|---:|---:|---:|
| Read-only context/profile/readiness tools | true | false | true | false |
| Preview/planning tools | true | false | true | false |
| Local DB update tools | false | false | true | false |
| Provisioning/write tools | false | false | true | true |
| Explicit destructive tools, if ever added | false | true | false | true |

Annotations are advisory hints, not a substitute for the policy decision layer, write guards, preview approval, or server-side access checks. For workflow tools, `outputSchema` is required and must match `structuredContent`; contract tests validate this.

## 15. Example Tool Schema

```ts
export const ProjectPreflightCheckSchema = z.object({
  projectId: z.string(),
  targets: z.array(z.enum(["jira", "confluence", "vcs", "vector", "auth", "webhooks", "uio"])).default([
    "jira",
    "confluence",
    "vcs",
    "vector",
    "auth",
    "webhooks",
    "uio",
  ]),
  forceRefresh: z.boolean().default(false),
});

export const ProjectProvisionPreviewSchema = z.object({
  projectId: z.string(),
  targets: z.array(z.enum(["confluence", "jira", "vcs"])).default([
    "confluence",
    "jira",
    "vcs",
  ]),
  mode: z.enum(["create_missing", "update_existing", "full_reconcile"]).default("create_missing"),
  includeDestructiveChanges: z.boolean().default(false),
});

export const ProjectProvisionExecuteSchema = z.object({
  projectId: z.string(),
  previewId: z.string(),
  approved: z.literal(true),
  idempotencyKey: z.string(),
  notifyOnCompletion: z.array(z.enum(["slack", "teams"])).optional(),
});

export const ArtifactAnnotateSchema = z.object({
  projectId: z.string(),
  kind: z.enum(["trace_link", "decision_record", "open_question"]),
  payload: z.union([TraceLinkInputSchema, DecisionRecordInputSchema, OpenQuestionInputSchema]),
  writeThrough: z.array(z.enum(["jira", "confluence", "vcs"])).default([]),
});

export const ProjectIntakeCreateSchema = z.object({
  tenantId: z.string().default("default"),
  projectName: z.string(),
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("raw_markdown"), content: z.string() }),
    z.object({
      kind: z.literal("uio_document"),
      uioSourceId: z.string(),
      uioChunkIndices: z.array(z.number().int().nonnegative()).optional(),
    }),
    z.object({
      kind: z.literal("uio_file_upload"),
      garageKey: z.string(),
      mimeType: z.string(),
    }),
  ]),
  metadata: z.record(z.unknown()).optional(),
});

export const ProjectProvisionPreviewOutputSchema = z.object({
  previewId: z.string(),
  projectId: z.string(),
  tenantId: z.string(),
  profileId: z.string(),
  actions: z.array(z.object({
    target: z.enum(["jira", "confluence", "vcs"]),
    action: z.enum(["create", "update", "noop", "blocked"]),
    artifactStableId: z.string(),
    summary: z.string(),
    requestEstimate: z.number().int().nonnegative(),
    policyDecision: z.enum(["allow", "deny", "require_approval"]),
  })),
  estimatedRequests: z.number().int().nonnegative(),
  requiresApproval: z.boolean(),
  warnings: z.array(ProfileWarningSchema).default([]),
});
```

## 16. Context Pack Design

A context pack is the primary thing implementation agents consume. Context packs are bounded, traceable to source artifacts, specific to one issue/epic/workflow, explicit about goals and non-goals, explicit about acceptance criteria, explicit about risks and open questions, linked to Confluence/Jira/VCS sources, and deterministically regeneratable from pinned source versions. Every context pack carries a freshness state: `current`, `stale`, or `dirty`. Agents may use stale packs only when the handoff explicitly allows it; dirty packs block readiness.

### 16.1 Token budgeting (6-category breakdown + 22-model context-size table)

Context packs are budgeted in tokens against the target model's tokenizer, not in characters. **The budget is tracked across six categories** rather than as a single aggregate (from claude_agent_teams_ui pattern, see §40 F-093):

| Category | Description | Default reserve |
|---|---|---|
| `claudeMd` | Project / repo CLAUDE.md and AGENTS.md content | 800 |
| `mentionedFile` | Files explicitly cited in the issue or context | 1,200 |
| `toolOutput` | Outputs of read tools (file_read, Grep, etc.) | 2,000 |
| `thinkingText` | Agent reasoning text and chain-of-thought | reserve floor |
| `teamCoordination` | Cross-agent messages, status updates, discovery briefs | 1,000 |
| `userMessage` | Original user message and clarifications | reserve floor |

The token-budget configuration carries a **22-model context-size table** (Claude Sonnet 200K, GPT-5.4 1M, Gemini 1M, etc.) so the orchestrator computes the right partition for whatever model the host uses (from context-fabric pattern, see §40 F-041). Default total budget = 8% of model context (configurable 1–20%); reserved categories take their fixed allocations first, expandable categories share the remainder.

**Pre-calculated token estimates** are stored at capture time per source (`Math.ceil(byteLength / 3.5)` as conservative default; tokenizer-exact when available); this eliminates lazy reads at query time (from context-fabric, see §40 F-041).

### 16.2 5-step progressive truncation

When the expandable section would exceed budget, the pack builder applies a 5-step progressive truncation order (from indxr pattern, see §40 F-052):

1. **Doc comments** — strip docstrings and block comments from included code.
2. **Private declarations** — drop private/non-exported helpers; keep public surface.
3. **Children of large structures** — collapse nested children to their signatures; keep top-level structure.
4. **Leaf files** — drop entire files that are leaves in the trace-link graph (no further dependencies).
5. **Final** — apply hybrid relevance ranking (16.3) and truncate from the lowest-scored end.

Each step records its action in `TokenBudgetReport.truncationStep`; the readiness rubric (§17) penalizes packs that truncated at step 4 or 5 because the agent will be operating with reduced fidelity.

### 16.3 Hybrid relevance ranking

The context pack builder collects candidate sources through trace-link traversal up to a configured depth, then ranks them by a hybrid score combining:

1. **Trace-link membership** as a hard filter (chunks outside the trace-link set are never included; prevents unrelated content leakage).
2. **Dense cosine similarity** in Qdrant against a query embedding (issue summary + acceptance criteria).
3. **Sparse / BM25 metadata search** via FTS5 with column weights — `path 2.0 / file_summary 1.5 / outline 1.2 / exports 1.0` (from context-fabric pattern, see §40 F-042).
4. **Reranking** via GTE-Reranker-ModernBERT-Base (CPU ONNX, configurable depth 20–100) with conditional expansion when signals disagree (from uio pattern).

The top-k scored chunks are included until the token budget is exhausted. **Before any chunk from cached or vectorized content is returned, the access-control gate runs** (lethal trifecta → ACL ranking → mode A/B/C; see §7.1, §38.1, §38.2) to verify the requesting principal can still access the underlying artifact.

### 16.4 Source version pinning

Each context pack records pinned versions of every source it references: Confluence page version IDs, Jira issue `updated` timestamps, VCS commit SHAs, **and UIO `source_id` + `chunk_indices` when content originated from UIO ingestion** (see §35). The `regenerationKey` field combines a hash of the pins with the prompt version. Regenerating a pack with identical pins and identical prompt version produces identical output, subject to sampling temperature set to 0 where the underlying model supports it.

### 16.5 Redaction and prompt-injection scanning

Before any pulled content is included in a pack, two safety passes run:

1. **Redaction** — gitleaks-rule-compatible secret detection plus entropy-based detection for generic high-entropy strings. Detected secrets are redacted; the pack flags `redactionApplied: true`.
2. **Prompt-injection scanning** — patterns redacted include `SYSTEM:`, `<IMPORTANT>` tag injections, "ignore previous instructions" variants, "you are now a..." jailbytes, `[INST]` / `[/INST]` Llama format, control-character normalization (from context-fabric `InjectionGuard`, see §40 F-043). Untrusted content is wrapped in untrusted-data markers that the handoff prompts in §29 recognize.

### 16.6 Memory Bank reference (out of v1 scope; preserved for reference)

The plan adopts project-scoped persistent memory across MCP sessions, but not cross-project personal memory. Consumers that want global memory can still layer `@alioshr/memory-bank-mcp` (or equivalent) above the orchestrator using the **Memory Bank pattern**: 6 persistent `.md` files (`projectbrief.md`, `productContext.md`, `systemPatterns.md`, `techContext.md`, `activeContext.md`, `progress.md`) maintained outside the orchestrator's context-pack scope (from agentic-coding-handbook, see §40 F-103).

### 16.7 Patterns from the awesome-agentic-patterns catalog

The following named patterns from `awesome-agentic-patterns` (167-pattern catalog with code sketches and Mermaid diagrams) are explicitly adopted in v6 §16 + §24: (from awesome-agentic-patterns, see §40 F-127)

- **context-window-auto-compaction** — model-specific lane-aware retry with reserve floors. Implements §16.2's truncation steps with model awareness.
- **budget-aware routing with hard cost caps** — see §23 sampling section.
- **declarative YAML topology** — see §24 worker selection.
- **layered configuration context** — see §16.5.

### Example task context pack

```md
# Context Pack: PCO-42 - Implement Confluence Page Provisioner

## Objective
Implement the Confluence page provisioning workflow for generated project documentation.

## Scope
- Create missing pages from the artifact plan.
- Update pages that have matching orchestrator artifact IDs.
- Preserve manual edits when possible.
- Store page IDs and versions in the project graph.

## Non-Goals
- Do not create new Confluence spaces in this task.
- Do not implement Jira issue creation in this task.

## Acceptance Criteria
- Given a dry-run artifact plan, the tool creates the expected page tree.
- Re-running the same plan is idempotent.
- Existing generated pages are updated, not duplicated.
- Manual pages without orchestrator IDs are not overwritten.
- Unit and integration tests pass.

## Freshness
- Current: true
- Source pins verified: true
- Dirty artifacts: none

## Required Context
- Confluence REST Provider interface
- ArtifactPlan model
- ProjectGraph repository
- Confluence storage-format renderer utilities

## Linked Artifacts
- Jira: PCO-42 (updated: 2026-04-22T10:14:00Z)
- Confluence: Architecture Overview (v7), Agent Build Guide (v3)
- VCS: src/providers/atlassian/confluenceRestProvider.ts @ 4f1c9ab

## Test Plan
- Mock provider test for page tree creation.
- Snapshot test for generated page bodies.
- Integration test against sandbox space when credentials are present.

## Token Budget
- Target: configured-build-agent-model
- Budget: 32000
- Used: 18430
- By category: claudeMd 780 / mentionedFile 4120 / toolOutput 8400 / thinkingText 0 / teamCoordination 0 / userMessage 5130
- Truncated sections: none
- Truncation step fired: 0 (none)
```

## 17. Readiness Rubric

A project is `READY_FOR_BUILD` only when both the deterministic score crosses threshold and the LLM-judged verdict is `SAFE_TO_SHIP` or `SHIP_WITH_QUARANTINE`, or exceptions have approved waivers. v6 layers two scoring systems rather than relying on a single rubric.

### 17.1 Deterministic 6-category score (zero LLM)

The first layer is a deterministic, zero-LLM score across six categories totaling 100 points (from Caliber pattern, see §40 F-091): (Caliber-style A/B/C/D grade)

| Category | Weight | Evidence |
|---|---:|---|
| **Existence** | 25 | Required artifacts present (CLAUDE.md, AGENTS.md, manifest.yaml, ADRs, etc.) — file-existence checks. |
| **Quality** | 25 | Code-block density, token budget within range, concrete (non-placeholder) instructions, heading structure. |
| **Grounding** | 20 | References to files / paths / endpoints actually exist on disk or in the project graph. |
| **Accuracy** | 15 | Referenced paths resolve; stated versions match actual versions; freshness vs git history. |
| **Freshness** | 10 | Recently updated; no secrets leaked; permissions OK. |
| **Bonus** | 5 | Auto-refresh hooks present, AGENTS.md follows LF format, OpenSkills-format skills declared. |

Grade thresholds: A (90+), B (80–89), C (70–79), D (<70). Grade D blocks `READY_FOR_BUILD` regardless of the verdict layer.

### 17.2 LLM-judged 4-tier verdict

The second layer is an LLM-as-judge run over the 5-category test framework outputs (§17.4) and the readiness checks below, producing one of four verdicts (from eval-view, see §40 F-046):

- **`SAFE_TO_SHIP`** — all hard regressions clear; soft signals within tolerance.
- **`SHIP_WITH_QUARANTINE`** — passes overall, but specific tests/checks are quarantined and tracked in the report.
- **`INVESTIGATE`** — soft regressions or stale-quarantine entries detected; human review required before promoting.
- **`BLOCK_RELEASE`** — hard regression, forbidden tool used, or cost spike beyond `+10%` cap.

The verdict layer signals are: test_statuses, quarantined_tests, stale_quarantine, cost_delta_ratio, drift_confidence, drift_is_downward, execution_failures.

### 17.3 Project-level readiness checks (weighted)

Each check carries a weight and an evidence type. Mechanical evidence is verified programmatically; semantic evidence is verified by an LLM judge prompt against a rubric. **Confidence is recorded as both categorical and numeric**: every check returns `{ checked: bool, confidence: 0–100 }`, and the rolled-up `PolicyDecision.confidenceScore` is a `0..1` numeric for evidence-weighted comparisons (from PAE + velocity-ops-engine + ai-coding-framework, see §40 F-007).

| Check | Weight | Evidence |
|---|---:|---|
| Project brief exists | 5 | mechanical |
| Goals and non-goals are documented | 5 | mechanical |
| Stakeholders are documented | 3 | mechanical |
| Preflight profile exists and is not stale | 8 | mechanical |
| Requirements are decomposed into epics/stories/tasks | 10 | mechanical |
| All epics have related Confluence context | 8 | mechanical |
| All stories have acceptance criteria (testable) | 15 | semantic |
| Architecture overview exists | 8 | mechanical |
| Domain model or glossary exists | 5 | mechanical |
| Testing strategy exists | 5 | semantic |
| Security/privacy requirements documented or N/A marked | 8 | mechanical |
| Risks and open questions tracked | 5 | mechanical |
| VCS repo context exists | 5 | mechanical |
| Agent manifest and AGENTS.md/CLAUDE.md exist | 5 | mechanical |
| Context map links are resolvable | 8 | mechanical |
| No blocking open questions | 10 | mechanical |
| No dirty generated artifacts or unresolved drift | 8 | mechanical |

### 17.4 5-category test framework (mandatory + auditable N/A)

Every spec must address all five test categories or document an audited "Not applicable" (from project-foundation-workbench, see §40 F-077): **UT** (unit, vitest), **IT** (integration, real test DB), **ST** (security — OWASP Top 10, conditional), **PT** (performance — load tests, conditional), **E2E** (Playwright or equivalent, conditional).

Tests must import real source code (no stubs). Test naming: `{SPEC-ID}-{CATEGORY}-{NN}`. "Not applicable" claims are auditable — code review verifies the claim.

### 17.5 Issue-level readiness (weighted)

| Check | Weight | Evidence |
|---|---:|---|
| Clear objective | 10 | semantic |
| Scope and non-goals | 10 | semantic |
| Acceptance criteria present and testable | 20 | semantic |
| Test plan present | 15 | semantic |
| Links to relevant Confluence pages | 10 | mechanical |
| Links to repo paths or explicit "unknown" marker | 10 | mechanical |
| Dependencies documented | 10 | mechanical |
| No blocking open questions | 10 | mechanical |
| Context pack available through MCP | 5 | mechanical |

### 17.6 Skill format (5-section) for orchestrator-emitted skills

Skill artifacts produced by the orchestrator (e.g., the `setup-orchestrator` skill installed into `~/.claude/skills/`) follow a fixed 5-section structure (from Citadel pattern, see §40 F-142): **Identity** / **Orientation** / **Protocol** / **Quality Gates** / **Exit**. This makes skills diff-able and reviewable.

### 17.7 Readiness score

```text
90-100: Ready for autonomous agent implementation
75-89:  Ready with human review
50-74:  Needs planning work
0-49:   Not ready
```

`READY_FOR_BUILD` requires **both** (a) score ≥ 90 (or 75–89 with the `requireHumanReview` obligation set) **and** (b) verdict ∈ {`SAFE_TO_SHIP`, `SHIP_WITH_QUARANTINE`}. Either condition failing blocks promotion.

Weights are configurable per project type via profile (infra, web-app, data-pipeline). Waivers carry an actor, timestamp, reason, and expiration.

## 18. Write Safety and Idempotency

All write tools follow a fixed pattern. The server reads current remote state, builds desired state, produces a dry-run diff, returns the diff to the agent/user, requires explicit `approved: true` and `previewId` to execute, enqueues the write job with an idempotency key, executes through provider interfaces, stores resulting artifact IDs and checksums, validates links, and writes a tamper-evident audit entry (ed25519-signed; see §30, §38.7).

MVP write operations never delete Jira issues, delete Confluence pages, delete branches, merge pull requests, force-push, write directly to the default branch without explicit override, overwrite pages without matching orchestrator metadata, or expose secrets in generated context. These are enforced at the `writeGuards` layer and cannot be bypassed by tool arguments.

### 18.1 Adversarial verification triplet

Before promoting any preview to execute, the workflow runs three adversarial sub-reviewers in parallel against the preview output (from claude-workflow-v2, see §40 F-082):

1. **False-positive filter** — challenges every flagged change ("is this actually wrong, or did the analyzer over-trigger?").
2. **Missing-issues finder** — challenges scope ("what should this preview have caught but didn't?").
3. **Context validator** — challenges fidelity ("does this preview reflect the actual current state of Jira/Confluence/VCS?").

The three outputs are synthesized into a final PASS/FAIL by the orchestrator. A FAIL synthesis blocks `project_provision_execute` regardless of `approved: true`. This is the orchestrator-internal twin of the §17.2 verdict layer.

### 18.2 File-based handoff serialization (BRIEF / REQUEST / FEEDBACK)

When a workflow phase hands off to a downstream phase or agent, three files are written to `.orchestrator/handoff/<phaseId>/` (from three-man-team pattern, see §40 F-114):

- **`BRIEF.md`** — the orchestrator's instructions to the next phase: decisions, constraints, build order, flags.
- **`REQUEST.md`** — what the phase has built (file list, line ranges, open questions, known gaps).
- **`FEEDBACK.md`** — review status (APPROVED / APPROVED-WITH-CONDITIONS / REJECTED) plus blocking conditions.

These files are reviewable, diff-able, and survive process restarts. They are also the input to the §29 build-agent prompts.

### 18.3 Hunk-level review for M6c

For VCS provisioning (M6c), the preview includes per-hunk diffs and supports per-hunk accept/reject (using `node-diff3` or equivalent for merge3 conflict resolution, from claude_agent_teams_ui, see §40 F-098). This lets the operator approve specific changes within a generated PR rather than all-or-nothing.

### 18.4 Deploy-gate accountability

For state transitions that affect production-visible state (`PROVISIONED → LINKED`, anything that calls a write provider), the orchestrator enforces a deploy-gate sequence (from three-man-team `deploy-gate.md` pattern, see §40 F-115):

1. Reviewer signals "clear" (from §18.1).
2. Orchestrator summarizes the set of changes.
3. Orchestrator notifies the project owner (via `NotificationProvider`).
4. PO approves explicitly.
5. Workflow commits + deploys + writes audit entry + writes checkpoint.

Step 4 is satisfied by an `approval_request` MCP tool response carrying the human's `approved: true`. Steps 1, 2, 3, 5 are server-side and cannot be skipped.

## 19. Provider Interfaces

```ts
export interface CapabilityDiscoveryProvider {
  discoverProjectProfile(input: DiscoverProjectProfileInput): Promise<ProjectProfile>;
  verifyProfile(profileId: string): Promise<ProjectProfileVerificationResult>;
}

export interface JiraProvider {
  getProject(projectKey: string): Promise<JiraProject | null>;
  searchIssues(jql: string, options?: PageOptions): Promise<Page<JiraIssue>>;
  createIssue(input: CreateJiraIssueInput): Promise<JiraIssue>;
  updateIssue(issueKey: string, input: UpdateJiraIssueInput): Promise<JiraIssue>;
  linkIssues(input: LinkIssuesInput): Promise<void>;
  addRemoteLink(issueKey: string, input: RemoteLinkInput): Promise<void>;

  // Create-meta uses the non-deprecated variant:
  // GET /rest/api/3/issue/createmeta/{projectIdOrKey}/issuetypes
  // GET /rest/api/3/issue/createmeta/{projectIdOrKey}/issuetypes/{issueTypeId}
  getCreateMetaIssueTypes(projectKey: string): Promise<JiraCreateMetaIssueType[]>;
  getCreateMetaFields(projectKey: string, issueTypeId: string): Promise<JiraCreateMetaField[]>;

  getIssueLinkTypes(): Promise<JiraIssueLinkType[]>;
}

export interface ConfluenceProvider {
  getSpace(spaceKey: string): Promise<ConfluenceSpace | null>;
  getPageByTitle(spaceKey: string, title: string, parentId?: string): Promise<ConfluencePage | null>;
  createPage(input: CreateConfluencePageInput): Promise<ConfluencePage>;
  updatePage(pageId: string, input: UpdateConfluencePageInput): Promise<ConfluencePage>;
  addLabels(pageId: string, labels: string[]): Promise<void>;
  getContentProperties(pageId: string): Promise<Record<string, unknown>>;
  setContentProperty(pageId: string, key: string, value: unknown): Promise<void>;
  supportsBodyRepresentation(representation: "storage" | "atlas_doc_format"): Promise<boolean>;
}

export interface VcsProvider {
  readonly providerName: "bitbucket_cloud" | "github" | "gitlab";
  getRepository(workspace: string, repoSlug: string): Promise<VcsRepo | null>;
  createRepository(input: CreateRepositoryInput): Promise<VcsRepo>;
  getFile(workspace: string, repoSlug: string, path: string, ref?: string): Promise<string | null>;
  putFiles(input: PutFilesInput): Promise<CommitResult>;
  createPullRequest(input: CreatePullRequestInput): Promise<PullRequest>;
  getWebhookSignatureVerifier(): (headers: Record<string, string>, body: string) => boolean;
  // Per-session worktree support (from agent-maestro)
  acquireWorktree(sessionId: string): Promise<WorktreeHandle>;
  releaseWorktree(handle: WorktreeHandle): Promise<void>;
}

export interface NotificationProvider {
  readonly channel: "slack" | "teams";
  send(input: NotificationInput): Promise<void>;
}

// UIO direct partner adapter (see §35 + docs/partners/uio.md)
export interface UioAdapter {
  ingest(input: UioIngestInput): Promise<UioEnvelope>;                     // POST /api/v1/intake
  status(envelopeId: string): Promise<UioEnvelope>;                        // poll for completion
  getCatalogEntry(envelopeId: string): Promise<UioKnowledgeArtifact>;      // when status === "completed"
  fetchVectorsBySource(sourceId: string, chunkIndices?: number[]): Promise<UioPoint[]>; // direct Qdrant read
}
```

## 20. Authentication and Configuration

### Auth modes

The server supports three modes. API token auth (email + token) is the simplest and suitable for single-user homelab deployments. OAuth 2.0 3LO is required for normal multi-user direct-REST deployments and supports PKCE flow with refresh token rotation. Service-account/bot auth is allowed for controlled automation when paired with explicit policy restrictions, actor attribution, and approval gates.

Do not implement raw downstream-token pass-through from an MCP client to Atlassian or VCS APIs. The MCP client authenticates to the orchestrator; the orchestrator separately authenticates to Atlassian/VCS using credentials issued for that downstream service. If a future enterprise deployment needs user-context propagation without storing user refresh tokens, use a standards-based token-exchange or delegated authorization pattern only when the downstream provider supports the correct audience and actor semantics.

Tokens in all modes are encrypted at rest using the same envelope-encryption policy described in §9. Tokens are never logged. Audit records store the auth-mode identifier and a truncated token fingerprint only.

### Actor attribution

Because the server writes to Atlassian and VCS with its own credentials (service account, server-owned OAuth principal, or server-held API token), the remote artifact's "creator" or "author" field records the server identity, not the originating MCP principal. To preserve the audit trail across this identity hop, the server attaches originating-actor metadata to every remote write in three locations:

1. A Jira label of the form `orchestrator-actor-<principal-fingerprint>` added to every created or updated issue, where `<principal-fingerprint>` is a stable, non-reversible hash of the originating principal identifier. Raw principal identifiers are not placed in labels because Jira labels are world-visible within the project.
2. A trailing description block in the Jira issue ADF and the Confluence page storage body, marked as an orchestrator-managed metadata block and not modifiable by agents. The block lists the originating principal display name (if disclosed by the host), the blueprint version, the generating tool name, and the audit entry ID.
3. An entry in the orchestrator's own audit log, which carries the unhashed principal identifier, the truncated credential fingerprint, the target artifact ID(s), the previous-entry hash for chain integrity, **and the ed25519 signature over the JCS-canonicalized record (see §30, §38.7)**.

VCS writes follow the same pattern: the PR description contains the orchestrator-managed metadata block, and the git commit's trailer line includes `Orchestrator-Actor-Fingerprint: <hash>` and `Orchestrator-Audit-Id: <id>`. This lets auditors correlate any Atlassian or VCS artifact back to the MCP principal that initiated it without relying on downstream identity fields that the orchestrator does not own.

### Operational gotchas (consolidated)

The following operational rules are non-negotiable for v1 deployments. They surfaced repeatedly across the survey and would otherwise be re-discovered painfully:

- **PgBouncer transaction-mode requirement**: when using PgBouncer in transaction mode, set `statement_cache_size=0` on asyncpg/postgres clients. Named prepared statements break in transaction mode. (from uio, see §40 F-202)
- **stdio MCP servers MUST log to file (pino with file transport) — never stdout.** Stdout is the protocol stream; any non-JSON-RPC bytes corrupt it. (from simple-commands-mcp + Anthropic guidance, see §40 F-031)
- **`.claude-plugin/plugin.json` MUST NOT declare hooks** — Claude Code v2.1+ auto-loads `hooks/hooks.json` by convention; declaring hooks in plugin.json breaks loading. Relevant when the orchestrator emits a Claude Code plugin (see §29). (from everything-claude-code, see §40 F-203)
- **Of 27 documented Claude Code hook events, only 6 actually fire in agent (subagent) contexts**: `PreToolUse`, `PostToolUse`, `PermissionRequest`, `PostToolUseFailure`, `Stop`, `SubagentStop`. The other 21 (SessionStart, Notification, Setup, etc.) are main-session-only. Agent-emitted hooks must use only these 6. (from claude-code-best-practice, see §40 F-204)
- **Foreground-only Agent-tool subagents in Claude Code**: background mode stalls on Edit-tool approval requests. Document this in `docs/claude-code.md`. (from three-man-team, see §40 F-205)
- **BGE-M3 sparse-format conversion**: Qdrant expects `{idx: val}` dict for sparse vectors; FlagEmbedding returns `{indices: [], values: []}` — convert before upsert. (from uio, see §40 F-206)
- **Large-file handling**: never read >200 lines all-at-once via Read tool; use offset+limit (150–200 per read). Applies to orchestrator-internal file reads during preflight and context-pack assembly. (from project-foundation-workbench, see §40 F-207)

### Environment variables

```bash
# Deployment and tenancy
DEPLOYMENT_MODE=single_tenant       # single_tenant | multi_tenant_saas_future
TENANT_ID=default
INSTALL_UNIQUE_ID=                  # auto-generated; opt-out via OBSERVABILITY_TELEMETRY_OPT_OUT=true (§27)

# Atlassian site
ATLASSIAN_SITE_URL=https://example.atlassian.net
ATLASSIAN_CLOUD_ID=...

# Auth mode: api_token | oauth3lo | service_account
ATLASSIAN_AUTH_MODE=api_token
ATLASSIAN_EMAIL=...
ATLASSIAN_API_TOKEN=...

# OAuth 3LO
ATLASSIAN_OAUTH_CLIENT_ID=...
ATLASSIAN_OAUTH_CLIENT_SECRET=...
ATLASSIAN_OAUTH_REDIRECT_URI=...

# Project defaults
JIRA_PROJECT_KEY=PCO
CONFLUENCE_SPACE_KEY=PCO

# VCS
VCS_PROVIDER=bitbucket_cloud
BITBUCKET_WORKSPACE=example-workspace
BITBUCKET_REPO_SLUG=agent-context-orchestrator
BITBUCKET_APP_PASSWORD=...
GITHUB_TOKEN=...

# Storage
DATABASE_URL=postgres://orchestrator:...@db:5432/orchestrator
DATABASE_DEV_MODE=pglite             # pglite | postgres; pglite uses in-process WASM
PGBOUNCER_TRANSACTION_MODE=true      # when true, statement_cache_size=0 enforced
REDIS_URL=redis://redis:6379/0
QDRANT_URL=http://qdrant:6333
QDRANT_API_KEY=...

# Transport (dual-port; see §22)
MCP_TRANSPORT=stdio,http
MCP_HTTP_PORT=3000                   # MCP Streamable HTTP
MCP_HTTP_BIND=127.0.0.1
MGMT_API_PORT=3001                   # health, metrics, dashboard (separate from MCP)
MCP_HTTP_SESSION_TTL_SECONDS=3600    # 1h sliding TTL
MCP_HTTP_MAX_CONCURRENT=1000

# Webhooks
WEBHOOK_INGRESS_PORT=7412
WEBHOOK_PUBLIC_BASE_URL=https://orchestrator.example.com
WEBHOOK_SIGNING_SECRET=...
WEBHOOK_DEDUP_TTL_SECONDS=86400      # Redis TTL for sha256(source+timestamp+content) dedup keys

# Access gate
ACCESS_GATE_MODE=cached_acl     # local | remote_check | cached_acl
ACCESS_GATE_ACL_STALENESS_HOURS=24
LETHAL_TRIFECTA_ENFORCE=true         # baseline check before mode A/B/C (§7.1, §38.1)

# Model/token budgeting
TARGET_MODEL=configured-build-agent-model

# Observability (see §27)
LOG_LEVEL=info
LOG_OUTPUT=file                      # always file for stdio servers; stdout corrupts protocol
LOG_FILE_PATH=./logs/orchestrator.log
LANGFUSE_HOST=https://langfuse.example.com
LANGFUSE_PUBLIC_KEY=...
LANGFUSE_SECRET_KEY=...
OTEL_EXPORTER_OTLP_ENDPOINT=...
PROMETHEUS_METRICS_PORT=9464
SENTRY_DSN=                          # conditional; only init when env=staging|production
SENTRY_ENV=local                     # local | staging | production

# Policy
POLICY_MODE=code                    # code | opa_future | cedar_future
POLICY_FAIL_CLOSED=true

# Security (see §30)
TOKEN_ENCRYPTION_KEY_REF=vault://kv/orchestrator/encryption_key
WRITE_GUARD_REQUIRE_PREVIEW=true
INJECTION_SCAN_ENABLED=true
REDACTION_RULES=gitleaks,default
ACTOR_ATTRIBUTION_FINGERPRINT_SALT_REF=vault://kv/orchestrator/actor_salt
AUDIT_SIGNING_PRIVKEY_PATH=~/.orchestrator/keys/private.key  # ed25519
AUDIT_SIGNING_KEY_REGISTRY_REF=git://this-repo/refs/orchestrator/keys/

# UIO partner (see §35)
UIO_ENABLED=false
UIO_BASE_URL=https://uio.example.com
UIO_API_KEY=...                      # X-API-Key header
UIO_QDRANT_URL=http://uio-qdrant:6333  # for direct vector reads when permitted
UIO_QDRANT_API_KEY=...

# Eval-view partner (see §31)
EVAL_VIEW_ENABLED=false
EVAL_VIEW_API_URL=
```

### Configuration file

```yaml
tenant:
  mode: single_tenant
  defaultTenantId: default

mcp:
  targetProtocolVersion: "2025-11-25"
  adaptiveRegistration: true
  toolCollapse:
    enabled: true                  # 3 compound tools default
    allTools: false                # set true to expose granular tools
  resourcePinning:
    sessionPreflight: true         # auto-pin orchestrator://session/current/preflight
  featureFlags:
    tasks: false
    confluenceAtlasDocFormat: false

atlassian:
  mode: hybrid # direct_rest | rovo_mcp | hybrid
  authMode: api_token # api_token | oauth3lo | service_account
  siteUrl: ${ATLASSIAN_SITE_URL}
  cloudId: ${ATLASSIAN_CLOUD_ID}
  jira:
    projectKey: ${JIRA_PROJECT_KEY}
  confluence:
    spaceKey: ${CONFLUENCE_SPACE_KEY}
    apiVersion: v2
    bodyRepresentation: storage # storage | atlas_doc_format_feature_flagged

rovo:
  enabled: false
  endpoint: https://mcp.atlassian.com/v1/mcp
  allowlist:
    - jira.search
    - jira.get_issue
    - confluence.search
    - confluence.get_page
    - crossproduct.semantic_search

vcs:
  provider: bitbucket_cloud
  workspace: ${BITBUCKET_WORKSPACE}
  repoSlug: ${BITBUCKET_REPO_SLUG}
  branchAndPrDefault: true
  worktreesEnabled: true            # per-session worktrees on orchestrator/{sessionId}
  worktreesRoot: .worktrees

notifications:
  channels: [slack]
  slack:
    webhookUrl: ${SLACK_WEBHOOK_URL}

sampling:
  mode: host_delegated  # host_delegated | direct_api
  targetModel: ${TARGET_MODEL}
  temperature: 0
  maxTokens: 4000
  # Provider chain (§23): seat-based options first, API-key fallback
  providerChain:
    - { kind: claude_cli, command: "claude -p" }                  # seat-based
    - { kind: cursor_acp, command: "agent acp --trust" }          # seat-based
    - { kind: api_key, provider: anthropic, model: claude-sonnet-4-6 }
    - { kind: api_key, provider: openai, model: gpt-5.4-mini }
  # Grammar-constrained JSON for guaranteed-valid structured output
  gbnfEnabled: false                # opt-in; requires llama.cpp-compatible local model

queue:
  provider: bullmq # in_memory | bullmq
  concurrency:
    provision: 2
    sync: 4
    validate: 4
  # 4 scheduler strategies (§24)
  scheduler: dependency-first       # round-robin | least-busy | capability-match | dependency-first
  # 4 workflow strategies (§24)
  defaultWorkflowStrategy: dag      # simple | queue | tree | intelligent-batching | dag

vector:
  provider: qdrant
  collection: orchestrator_${tenantId}_${projectKey}
  embeddingModel: bge-m3
  chunkSize: 512
  chunkOverlap: 64
  hybridRanking:
    enableFts5Bm25: true
    bm25Weights:
      path: 2.0
      file_summary: 1.5
      outline: 1.2
      exports: 1.0
  reuseFromUio: true                 # when source originated from UIO, fetch vectors instead of re-embedding

preflight:
  ttlHours: 168               # 7-day ceiling, configurable
  invalidateOnAuthRotation: true
  invalidateOnPermissionWebhook: true
  invalidateOnBranchProtectionChange: true

policy:
  mode: code
  failClosed: true
  # 4 shared protocols (§38.3) loaded by default
  sharedProtocols:
    ux: true
    inputValidation: true
    toolEfficiency: true
    conflictResolution: true

writes:
  requirePreview: true
  allowDestructiveChanges: false
  idempotencyRequired: true
  # Adversarial verification triplet (§18.1)
  adversarialVerification:
    enabled: true
    falsePositiveFilter: true
    missingIssuesFinder: true
    contextValidator: true

accessGate:
  mode: cached_acl # local | remote_check | cached_acl
  aclStalenessHours: 24
  failClosed: true
  # ACL ranking (§38.2)
  aclRanking:
    enabled: true
    defaultClassification: PRIVATE  # PUBLIC | PRIVATE | SECRET
  # Lethal trifecta baseline check (§38.1)
  lethalTrifecta:
    enabled: true

context:
  targetModel: ${TARGET_MODEL}
  maxBudgetTokens: 32000
  # 6-category breakdown (§16.1)
  categoryReserves:
    claudeMd: 800
    mentionedFile: 1200
    toolOutput: 2000
    teamCoordination: 1000
  modelContextSizes: ${context_size_table_22_models}    # see §16.1
  truncation:
    progressiveSteps: 5             # see §16.2
  includeFullPageBodies: false
  includeRepoSnippets: true
  redactSecrets: true
  injectionScanEnabled: true

audit:
  signing:
    enabled: true                   # ed25519 + JCS canonicalization (§30, §38.7)
    keyAlg: ed25519
    privateKeyPath: ${AUDIT_SIGNING_PRIVKEY_PATH}
    keyRegistryRef: refs/orchestrator/keys/   # git-ref registry (replaces KMS for v1)
  hashChain:
    enabled: true

observability:
  logger:
    output: file                    # NEVER stdout for stdio servers
    path: ./logs/orchestrator.log
    format: pino-json
  langfuse:
    enabled: true
    host: ${LANGFUSE_HOST}
  prometheus:
    enabled: true
    port: 9464
  otel:
    endpoint: ${OTEL_EXPORTER_OTLP_ENDPOINT}
  sentry:
    enabled: false                  # auto-enabled when env in {staging, production}
    environment: ${SENTRY_ENV}
  agentTraceJsonl:
    enabled: true                   # Agent Trace v0.1.0 spec (§27)
  telemetry:
    optOut: false
    installUniqueIdRef: ${INSTALL_UNIQUE_ID}

uio:
  enabled: false
  baseUrl: ${UIO_BASE_URL}
  apiKey: ${UIO_API_KEY}
  qdrantUrl: ${UIO_QDRANT_URL}
  qdrantApiKey: ${UIO_QDRANT_API_KEY}
  reuseEmbeddings: true             # when ingesting docs UIO has already processed

evals:
  evalView:
    enabled: false                  # see §31 + docs/partners/eval-view.md
    apiUrl: ${EVAL_VIEW_API_URL}
```

## 21. Rate Limits, Pagination, and Retries

Provider middleware handles paginated Jira search, paginated Confluence v2 results, paginated VCS list endpoints, retryable HTTP failures, 429 handling with backoff honoring `Retry-After`, rate-limit response headers, per-workflow request budgeting, and concurrency limits. Provisioning prefers fewer large structured operations over unbounded per-issue loops. The dry-run planner estimates write counts before execution and fails the preview if the estimate exceeds a configurable ceiling. The HTTP retry middleware also handles 425 (Too Early) and 408 (Request Timeout) per the PAE pattern (`src/shared/http.ts`), and **augments retried requests with the same idempotency key for write paths** to prevent duplicate side effects from retries. (from PAE retry pattern, see §40 F-014)

## 22. Transport and Deployment

The server exposes two transports from MVP. Stdio transport is the default for local agent hosts (Claude Code, Codex CLI). Streamable HTTP transport listens on a configurable port and bind address. Optional SSE fallback can be implemented only for downstream clients that require it and should be considered temporary. Both transports share the same tool, resource, and prompt registrations.

### 22.1 Streamable HTTP architecture (from indxr)

The HTTP transport uses an axum-equivalent (TS: `hono` or `fastify`) + tokio (TS: native event loop) + SSE for notifications, with the following operational defaults: (from indxr, see §40 F-051)

- **Session lifecycle**: 1-hour sliding TTL per session (refreshed on activity); session is closed and resources released on TTL expiry or explicit close.
- **Concurrency cap**: 1000 concurrent sessions; new sessions beyond cap receive HTTP 503 with `Retry-After`.
- **Message broadcast channels**: per-session broadcast channel for `notifications/resources/updated`, scoped to the resources the session has subscribed to.
- **SSE keep-alive**: 30s heartbeat frame on subscribed connections to avoid intermediary timeout (from claude_agent_teams_ui, see §40 F-097).
- **Backpressure**: per-session message-buffer cap (1MB default); events are batched at 50ms granularity to amortize SSE frame overhead (from claude_agent_teams_ui, see §40 F-096); when buffer is exceeded, the session is signaled to drain or disconnect.

### 22.2 Dual-port architecture

The HTTP transport process runs **two listeners on separate ports** for clean separation of concerns: (from open-edison, see §40 F-130)

- **MCP transport on port 3000** — the only port that handles MCP protocol traffic (Streamable HTTP / SSE). Authenticates via MCP session.
- **Management API on port 3001** — health (`/health/live`, `/health/ready`), metrics (`/metrics` for Prometheus scrape), dashboard, admin endpoints. Authenticates via separate operator credentials. Distinct from the MCP `health_check` tool.

Webhook ingress runs on its own port (`WEBHOOK_INGRESS_PORT`, default 7412) so MCP auth and webhook signature verification stay separate.

### 22.3 Deployment artifacts

A single-stage Dockerfile builds from `node:22-bookworm-slim` and emits a non-root image. The `docker-compose.yml` composes the server with Postgres 16, Redis 7, and Qdrant, mounts a persistent volume for Postgres and Qdrant, and exposes only the MCP HTTP, mgmt API, and webhook ports. A `docker-compose.override.yml` is provided for local development that enables live reload. A systemd unit is provided for non-containerized deployments targeting Debian 12 hosts. Healthchecks at `/health/live` and `/health/ready` are exposed on the mgmt API port (3001), distinct from the MCP `health_check` tool. The compose file optionally references **Traefik labels for dynamic service discovery** when deployed behind a Traefik gateway (constraint-label pattern from full-stack-fastapi-template, see §40 F-152).

## 23. Sampling and LLM Integration

The server delegates LLM inference to the MCP host by default using `sampling/createMessage` only while handling an originating MCP request that permits server-to-client sampling. This keeps the server BYO-LLM, inherits the user's model and credential choices, and avoids duplicate billing. The host negotiation declares requested capabilities (model hint, max tokens, temperature) and the server accepts whatever the host grants, falling back to a deterministic non-sampling path for prompts that can be handled without LLM inference (template-driven page generation, mechanical readiness checks).

A direct-API mode is supported for headless deployments where no host is present or where the work is no longer associated with an active MCP request — for example, webhook-triggered background regeneration. Direct-API mode selects from a configurable provider chain.

### 23.1 Provider chain — seat-based and API-key

The provider chain (configured in `sampling.providerChain`) supports both seat-based providers and traditional API-key providers, and tries them in order: (from Caliber pattern, see §40 F-093)

- **`claude_cli`** — invokes the Claude Code CLI (`claude -p --model haiku --no-session-persistence`) which uses the host operator's seat-based subscription rather than API credits. Available where the operator has Claude Code installed.
- **`cursor_acp`** — invokes Cursor's Agent Communication Protocol CLI (`agent acp --trust`) for seat-based access via Cursor.
- **`api_key`** — traditional `@anthropic-ai/sdk` / `openai` / `@anthropic-ai/vertex-sdk` providers. Configurable per-entry: `{ kind: api_key, provider: anthropic, model: claude-sonnet-4-6 }`.

Seat-based options are tried before API-key options to prefer the operator's existing subscription. Each provider entry implements the `LLMProvider` interface (per Caliber's abstraction): `streamCompletion`, `estimateTokens`, `getFastModel`. Transient errors (rate limit / timeout / connection) trigger retry with exponential backoff (max 5 attempts).

### 23.2 Grammar-constrained JSON (GBNF, optional)

For deployments using llama.cpp-compatible local models, structured-output tools can opt into **grammar-constrained generation via GBNF** (BNF grammar describing the JSON schema), which guarantees the model emits syntactically valid JSON matching the schema. (from ATLAS pattern, see §40 F-067) This is an alternative to JSON-mode (Anthropic / OpenAI) and avoids the need for a JSON-parse-and-retry loop. Disabled by default; opt-in via `sampling.gbnfEnabled: true`.

### 23.3 17-LLM-provider abstraction (reference)

The provider chain is designed to support extension to additional providers. The 17-provider abstraction in plano (`crates/hermesllm/src/providers/id.rs`) is the canonical reference for the breadth that may eventually be supported: OpenAI, Anthropic, Gemini, Azure, Mistral, Deepseek, Groq, XAI, Ollama, Moonshotai, Zhipu, Qwen, Bedrock, GitHub Models, Xiaomi, plus seat-based Claude CLI and Cursor ACP. (from plano, see §40 F-074) v1 ships with the four chain entries above; additional providers are added by implementing the `LLMProvider` interface.

All sampling calls are traced to Langfuse with project ID, blueprint version, prompt version, token counts, and provider-chain entry as trace attributes. The default is intentionally not hard-coded in this plan; deployments set `TARGET_MODEL` and tokenizer mapping in config.

## 24. Job Queue and Async Workflows

Long-running workflows are executed by BullMQ workers rather than inline in tool handlers. `project_provision_execute` enqueues a `provision` job and returns a job handle; the handle is exposed as `orchestrator://project/{projectId}/job/{jobId}` with subscription support so the agent can observe progress. `project_sync` and `readiness_validate` use the same pattern.

Jobs are idempotent and carry an idempotency key stored in the configured queue backend with a configurable TTL. Duplicate enqueues with the same key return the existing job handle. Job state transitions (`queued → running → succeeded|failed|retrying`) emit MCP resource update notifications so subscribed agents see progress without polling. If the stable MCP Tasks utility becomes broadly supported by the target clients, job resources can be mapped to task-backed tool calls behind a feature flag; job resources remain the default because they work across current clients.

### 24.1 Workflow strategies (per phase)

Each phase that fans out into sub-tasks uses a configurable workflow strategy (declared in the `ProjectProfile`): see §6.2 for the five strategies (`simple` / `queue` / `tree` / `intelligent-batching` / `dag`). The default for §6 multi-spec phases is `dag`. (from agent-maestro)

### 24.2 Scheduler strategies (per worker)

When multiple workers compete for ready tasks, the scheduler chooses one of: (from open-multi-agent, see §40 F-073)

- **`round-robin`** — even distribution by worker index. Cheapest, ignores load.
- **`least-busy`** — worker with the fewest in-progress tasks wins. Avoids hot-spots.
- **`capability-match`** — bidirectional keyword scoring of task description × worker tag set; best for heterogeneous worker pools (e.g., one worker has Confluence credentials, another has Jira).
- **`dependency-first` (default)** — critical-path heuristic: count blocked dependents per task (BFS over reverse dependency graph), sort descending, assign tasks unblocking the most dependents first. Maximizes throughput on a DAG.

### 24.3 Approval-gate callback (mid-execution)

Wave-based phases call the PolicyDecisionLayer between waves via the `ApprovalGate` callback:

```ts
const proceed = await policy.onApproval(completedTasks, nextTasks);
if (!proceed) await queue.skipRemaining("Skipped: approval rejected");
```

Skip cascade marks all `nextTasks` and their downstream dependents as `skipped` with the rejection reason. (from open-multi-agent, see §40 F-072)

### 24.4 Discovery-brief compression and claim-based scope coordination (Fleet pattern)

For Wave 2+ in DAG strategies, the orchestrator compresses Wave 1 outputs into ~500-token discovery briefs at `.orchestrator/fleet/briefs/{waveId}/{taskId}.md` (from Citadel Fleet pattern, see §40 F-141). Wave 2+ workers receive ALL prior briefs in their initial context to avoid re-discovering the same artifacts.

Scope conflicts between concurrent workers are prevented by **file-based claims** at `.orchestrator/coordination/claims/`. A worker writes a claim file naming the artifacts it intends to modify; another worker that finds an overlapping claim **skips to the next available task** rather than waiting (no deadlock; no wait queue). Claims have a TTL; stale claims (TTL exceeded without a heartbeat) are reclaimable. This complements the §6.1 `lockedSpec` mechanism — `lockedSpec` is at the spec/phase level; claims are at the artifact level. (from Citadel + agent-maestro patterns)

### 24.5 Per-session VCS worktree (M6c)

VCS provisioning jobs acquire a per-session git worktree via `VcsProvider.acquireWorktree(sessionId)`, which checks out branch `orchestrator/{sessionId}` into `.worktrees/orchestrator-{sessionId}/`. All file mutations happen in the worktree; the worktree is released and the branch pushed when the job completes. (from agent-maestro, see §40 F-064)

### 24.6 Single-message Task-call constraint (documentation rule)

When the orchestrator emits Claude Code `Task` calls into a host session for true parallelism, **all `Task` invocations MUST be issued in a single assistant message**. Sequential messages execute serially. This constraint is documented in `docs/claude-code.md` and applies to handoffs that spawn parallel sub-agents. (from claude-workflow-v2, see §40 F-083)

### 24.7 Considered, deferred: Hatchet as alternative queue

UIO uses Hatchet (Postgres-backed at-least-once workflow engine, GPU-aware worker labels) instead of BullMQ. Hatchet's stronger semantics for long-running and GPU-routed work are attractive but unnecessary for v1's CPU-bound provisioning workloads. v6 stays on BullMQ. Hatchet is recorded in `docs/adr/0002-bullmq-default-hatchet-considered.md` for future revisit.

## 25. Semantic Retrieval and Vector Store

Qdrant stores chunked, embedded representations of requirements documents, ADRs, selected Confluence pages, Jira issue descriptions, and repo README/CONTRIBUTING content. Chunking uses a recursive text splitter tuned to 512-token chunks with 64-token overlap; markdown and code are split along natural boundaries (headers, function definitions). Embeddings default to BGE-M3, matching the UIO stack (see §35).

Collections are scoped by tenant ID and project key to prevent cross-project and future cross-tenant retrieval leakage. **When the optional UIO partner is enabled, the orchestrator reuses UIO's embeddings rather than recomputing them**, referencing them by UIO `source_id` + `chunk_index` keys in `uio_books_raw_v1` (or other UIO collection per the operator's policy mode; see §35). The relevance ranker combines trace-link membership (hard filter), embedding cosine similarity (Qdrant), and FTS5 BM25 metadata weights as described in §16.3.

### 25.1 Considered, deferred: algorithmic 11-signal embeddings (codebase-memory-mcp)

For deployments where the BGE-M3 embedding cost or latency becomes prohibitive, **codebase-memory-mcp's 11-signal algorithmic embedding** approach is a viable alternative for code-only retrieval: TF-IDF + Random Indexing + MinHash + API signature + type signature + module proximity + decorators + AST structural profile (25 floats) + approximate dataflow + graph diffusion + Halstead-Lite. SQLite + int8 quantized vectors + custom `cbm_cosine_i8()` SQL function. No external embedding service. Recorded in `docs/adr/0003-qdrant-bge-m3-default-algorithmic-considered.md` for revisit. (from codebase-memory-mcp, see §40 F-008)

### 25.2 Considered, deferred: hindsight three-op memory model

For consumers that want a structured agent-memory layer above the orchestrator, hindsight's `retain` / `recall` / `reflect` three-operation model is the cleanest reference architecture (vs mengram's 29-tool surface or context-fabric's pack-centric design). The orchestrator adopts a bounded project-scoped subset with deterministic recall and optional vector recall; richer cross-project semantic memory remains outside v1. (from hindsight, see §40 F-145)

## 26. Webhook Ingestion and Change Data Capture

The webhook ingress endpoint accepts Atlassian webhooks (Jira `jira:issue_updated`, `jira:issue_created`, `jira:issue_deleted`, Confluence `page_updated`, `page_created`) and VCS webhooks (Bitbucket Cloud `repo:push`, `pullrequest:updated`; GitHub `push`, `pull_request` when the GitHub adapter is enabled). Signatures are verified against provider-specific secrets before processing using a **Stripe-style HMAC-SHA256 verification pattern with mocked-fetch tests** (from project-foundation, see §40 F-026).

### 26.1 Delivery dedup with deterministic IDs

Verified events are deduplicated before normalization. Dedup uses a deterministic key:

```ts
const dedupKey = sha256(`${sourceProvider}|${eventTimestamp}|${stableContent}`);
```

When the provider supplies an event ID it is used directly:

| Provider | Event-ID header |
|---|---|
| Atlassian (Jira / Confluence) | `X-Atlassian-Webhook-Identifier` |
| GitHub | `X-GitHub-Delivery` |
| Bitbucket Cloud | `X-Hook-UUID` |

Otherwise the orchestrator computes the deterministic key. (Pattern from claude_agent_teams_ui's `TeamInboxReader`, see §40 F-098.) Dedup state lives in Redis with a TTL of 24 hours by default. Duplicate deliveries are acknowledged with 200 and discarded.

### 26.2 Bundled signature corpus

The webhook signature-verifier registry is a small typed corpus: per-provider `(headerName, secretRef, hashAlgorithm, signatureFormat)`. New providers are added by appending to the corpus, not by writing per-provider code paths. This pattern follows the bundled rule-pack approach used by PAE (`src/signatures/data/`) and agentdiff (per-host event-ID headers). (from PAE + agentdiff, see §40 F-016 + F-117)

### 26.3 Normalization, drift flagging, ACL invalidation

Deduplicated events are normalized into a common `GraphChangeEvent` and handed to the queue worker, which updates the affected graph entries and fires `notifications/resources/updated` for subscribed MCP resources. Delete events create tombstone records and drift flags rather than silently removing graph entries. Checksums are recomputed and compared; unchanged payloads are discarded to avoid update storms. Events that touch orchestrator-generated artifacts trigger a drift flag on the associated blueprint artifact, visible in the readiness report. Permission-affecting events additionally invalidate the relevant preflight profile entries and any matching cached ACL entries.

## 27. Observability and Telemetry

All tool calls, provider calls, sampling calls, and job executions emit OpenTelemetry spans with a consistent attribute set: `orchestrator.project_id`, `orchestrator.tenant_id`, `orchestrator.blueprint_version`, `orchestrator.tool_name`, `orchestrator.job_id`, `mcp.session_id`, `mcp.client_name`, `mcp.client_version`. Span names follow `orchestrator.<component>.<operation>`. Preflight warnings are emitted as span events on `orchestrator.preflight.discover` with attributes `preflight.target`, `preflight.code`, `preflight.severity`. Traces export to the configured OTLP endpoint and, for sampling calls, additionally to Langfuse with prompt version and token counts.

### 27.1 Observability stack (default)

v6 default observability stack: **Langfuse + Prometheus + structlog + OpenTelemetry + Sentry** (from uio precedent + open-edison OTel + full-stack-fastapi-template Sentry). (from uio + open-edison + full-stack-fastapi-template, see §40 F-009 + F-128 + F-152)

- **Langfuse** — sampling-call traces, prompt versions, token counts. One-trace-per-`project_intake_create`-or-`context_pack_generate`; nested spans for sub-calls.
- **Prometheus** — counters and histograms scraped from the mgmt API port (3001). See §27.2.
- **structlog (TS: pino with structured config)** — JSON to file (never stdout for stdio servers). Context-bound fields: `query_mode`, `pipeline`, `stage`.
- **OpenTelemetry** — OTLP gRPC export of all spans.
- **Sentry** — conditional init by `SENTRY_ENV`; only emits when env ∈ {`staging`, `production`}. Captures unhandled errors and breadcrumbs.

### 27.2 Prometheus counter template

Counters emitted by default (from open-edison template, see §40 F-128):

```
orchestrator.tool_calls_total{tool, status}
orchestrator.tool_calls_blocked_total{tool, reason}
orchestrator.private_data_access_calls_total
orchestrator.untrusted_public_data_calls_total
orchestrator.write_operation_calls_total{provider}
orchestrator.lethal_trifecta_blocks_total
orchestrator.acl_denials_total{classification}
orchestrator.policy_decisions_total{effect}
orchestrator.audit_entries_total
orchestrator.audit_signature_failures_total
orchestrator.preflight_warnings_total{target, severity}
orchestrator.context_pack_token_usage{category}     # histogram, by 6-category breakdown
orchestrator.context_pack_truncation_step{step}     # 0..5
orchestrator.queue_jobs_total{status}
orchestrator.webhook_events_total{provider, status}
orchestrator.webhook_dedup_hits_total{provider}
```

### 27.3 Install-unique deaggregation ID + opt-out

Telemetry exports include an `INSTALL_UNIQUE_ID` (auto-generated on first start, persisted to config dir) so multiple installs are deaggregated in shared backends without sharing PII. Opt-out via `OBSERVABILITY_TELEMETRY_OPT_OUT=true` disables outbound telemetry (Langfuse + Sentry; local Prometheus stays). (from open-edison pattern, see §40 F-129)

### 27.4 Agent Trace v0.1.0 JSONL spec

Long-running orchestrator workflows emit per-step trajectory records as JSONL conforming to the **Agent Trace v0.1.0 spec** (Cognition / Cursor / Vercel / Cloudflare alignment) at `.orchestrator/traces/{projectId}/{jobId}.jsonl`. (from agentdiff pattern, see §40 F-118)

```json
{"version":"0.1.0","id":"<uuid>","timestamp":"...","vcs":{"vcs_type":"git","revision":"<sha>"},"tool":{"name":"orchestrator","version":"<v>"},"files":[...],"metadata":{"prompt_excerpt":"...","prompt_hash":"<sha>","session_id":"<id>","files_read":[...],"intent":"implement","trust":85,"flags":["security"],"author":"<actor>","capture_tool":"orchestrator"},"sig":{"alg":"ed25519","key_id":"<16hex>","value":"<base64>"}}
```

The signature uses the same ed25519 + JCS canonicalization pipeline as the audit chain (§30, §38.7) so trajectory records are tamper-evident.

### 27.5 Six-enum observability taxonomy

Span attributes and counters use a fixed enum taxonomy for cross-deployment comparability (from claude-code-log-analyzer, see §40 F-090):

| Enum | Values |
|---|---|
| `autonomy` | interactive / quick / build / feature / release |
| `intent` | implement / fix / refactor / test / review / deploy / docs / explore / config / other |
| `decision` | APPROVED / NEEDS_REVISION / ESCALATE / UNKNOWN |
| `error_class` | SYSTEMATIC / INCOHERENT / OMISSION / API_ERROR |
| `gate_type` | review_plan / review_design / review_code / codereview / precommit / validation / qa / audit |
| `severity` | critical / high / medium / low / warning / info |

### 27.6 SLOs

SLO definitions are documented in `docs/operations.md`: provisioning success rate ≥ 98% over a 7-day window, context pack generation p95 latency ≤ 8 seconds, webhook ingestion lag p95 ≤ 30 seconds, preflight discovery p95 latency ≤ 15 seconds. SLO violations write a notification to the configured channel.

## 28. Implementation Milestones

Each milestone now lists the patterns it leans on (from the §40 findings table). Migration / wiring detail lives in the partner guides under `docs/partners/`, not in milestone wording.

### Milestone 0 — Scaffold

Deliver a TypeScript project, MCP server entrypoint, dual-transport support (stdio + Streamable HTTP), config loader, structured logger (pino-to-file), health tool, session capability registry, feature flags, test setup, Dockerfile, and compose file. The dual-port architecture (MCP 3000, mgmt 3001) is established here.

Acceptance. Server starts on both transports. MCP inspector lists the health tool over both. The server records the negotiated protocol/client capabilities in memory and exposes `orchestrator://session/current/capabilities` and `orchestrator://session/current/preflight` (the latter as a stub). Unit tests pass. `docker compose up` brings up the server with Postgres and Redis dependencies.

**Uses patterns from**: simple-commands-mcp (`@modelcontextprotocol/sdk@1.27+` stdio scaffold), indxr (Streamable HTTP transport architecture, axum-equivalent + SSE + 1h TTL + 1000 concurrent), open-edison (dual-port 3000/3001), project-foundation (HTTP server patterns, security headers, request ID).

### Milestone 1 — Domain model and storage

Deliver domain models for ProjectBlueprint, ProjectGraph, TraceLink, ArtifactRef, ContextPack, SourcePin, TokenBudgetReport, ProjectProfile, AclEntry, McpSessionProfile, TenantScope, PolicyDecision, AuditEntry. **PGlite for local dev** + Postgres for deployed, both with drizzle migrations. Tenant-scoped repositories. Code-based PolicyDecisionLayer adapter and an envelope-encrypted token store.

Acceptance. Create/read/update a draft project succeeds on PGlite and Postgres with `tenantId = "default"`. Trace links, readiness results, policy decisions, session profiles, ACL entries, and audit entries persist. Repository calls require `TenantScope`. Snapshot tests cover serialized blueprint and context pack. Encrypted token round-trip passes. Migration rehearsal test passes (parity between PGlite and Postgres).

**Uses patterns from**: project-foundation (drizzle dual-mode client, schemas, migration runner, migration rehearsal test), workbench (3-tier REQ→FEAT→SPEC decomposition, type discipline), PAE (`exactOptionalPropertyTypes` + Confidence enum + numeric `confidenceScore`).

### Milestone 2 — Atlassian direct providers and capability discovery

Deliver Jira REST provider, Confluence v2 REST provider, Jira ADF utilities, Confluence storage-format renderer, optional feature-flagged Confluence ADF renderer, content-property helpers, capability discovery, pagination, rate-limit, and retry wrapper (with **idempotency-key plumbing on writes**). OAuth 3LO support in addition to API token. Jira create-meta uses the non-deprecated `/issue/createmeta/{projectIdOrKey}/issuetypes` endpoints. Add `project_preflight_check` and `project_profile_get`.

Acceptance. Providers work against recorded HTTP fixtures. Optional live integration tests run only when credentials are present. OpenAPI-driven contract tests pass for both providers. Token encryption and refresh rotation tested. Preflight produces a project profile that includes Jira create metadata, required fields, Confluence space/page capabilities, supported body representations, vector-store connectivity, embedding endpoint reachability, **UIO partner reachability when configured**, webhook registration state, and auth warnings.

**Uses patterns from**: PAE (HTTP retry with Retry-After parsing + provider-interface pattern), project-foundation (env-driven REST client + idempotent upsert), PAE (Confluence platform-fingerprint corpus pattern for site-type detection during preflight).

### Milestone 3 — VCS provider

Deliver the VcsProvider interface, Bitbucket Cloud adapter, file write APIs, pull-request APIs, webhook signature verification, and **per-session worktree manager**. The GitHub adapter stub is created but not implemented in this milestone.

Acceptance. Bitbucket Cloud adapter passes contract tests. Interface surface accommodates GitHub without changes. Worktree acquire/release works on POSIX and Windows.

**Uses patterns from**: project-foundation (Stripe-style HMAC verification + mocked-fetch tests, transferable to Atlassian + Bitbucket secrets), agent-maestro (per-session worktrees on `orchestrator/{sessionId}`).

### Milestone 4 — Blueprint workflow with sampling

Deliver `project_intake_create`, `project_blueprint_generate`, `project_blueprint_update`, blueprint validator, and host-delegated sampling integration. UIO document ingestion path is accepted as an alternative to raw markdown (calls UIO `uio_ingest`).

Acceptance. Raw markdown requirements become a structured blueprint. Missing requirements produce open questions. Blueprint is deterministic for snapshot tests at temperature 0. Sampling call traces appear in Langfuse. UIO-sourced intake correctly references `source_id` + `chunk_indices` and reuses pre-computed vectors.

**Uses patterns from**: PAE (Handlebars conditional template selector for prompt routing), claude-agent-builder (6-phase workflow for blueprint generation), agentic-coding-handbook (3 reasoning methods: Three Experts / Self-Refinement / Zero-One-N-Shot), uio (MCP `uio_ingest` adapter — see `docs/partners/uio.md`).

### Milestone 5 — Provisioning planner

Deliver artifact plan generator, Confluence page plan, Jira issue plan using the discovered project profile, VCS branch/PR file plan, **actor-attribution plan** (labels, metadata blocks, commit trailers, PR description blocks), policy-decision evaluation for every planned action, structured output schemas, and `project_provision_preview`. Adversarial verification triplet (§18.1) runs on the preview output.

Acceptance. Dry-run output shows create/update/no-op/blocked actions including actor attribution and policy decisions. No remote writes happen during preview. Plan includes estimated request count. Company-managed and team-managed Jira projects produce distinct plans where appropriate. Preview fails if the project profile is stale or required field mappings are unresolved. Adversarial triplet PASS/FAIL synthesis is recorded with the preview.

**Uses patterns from**: PAE (comparison-matrix shape + signal-weighted policy scoring), project-foundation (idempotent upsert), workbench (scope-signature + 14 slash commands), claude-workflow-v2 (effort scaling Instant/Light/Deep/Exhaustive + adversarial verification triplet), three-man-team (file-based BRIEF / REQUEST / FEEDBACK handoff).

### Milestone 6a — Jira provisioning executor (first shippable slice terminates here)

Deliver BullMQ worker integration, `project_provision_execute` for Jira-only targets, idempotency key handling, policy-decision enforcement (including adversarial-triplet PASS gate), job resource exposure, **audit log with hash-chain integrity AND ed25519 signatures over JCS-canonicalized records (key registry in `refs/orchestrator/keys/`)**, actor-attribution writes (labels, description metadata block, audit entry), and graph update after writes.

Acceptance. Running the same plan twice does not duplicate Jira issues. Generated issue keys, IDs, and actor-attribution labels are stored. Job state is observable through the MCP resource. Audit hash chain validates end-to-end. Audit signatures verify against the git-ref key registry. The first shippable slice ends here; Confluence and VCS provisioning remain ahead.

**Uses patterns from**: open-multi-agent (TaskQueue + 4 schedulers + approval-gate callback + skip-cascade), Citadel (claim-based scope coordination + discovery-brief compression for Wave 1+ DAG execution), agentdiff (ed25519 + JCS canonicalization + git-ref key registry — see `docs/partners/agentdiff.md`), project-foundation (pluggable Transport pattern for queue worker abstraction).

### Milestone 6b — Confluence provisioning executor

Deliver Confluence page provisioning in the same executor, using the storage representation by default. Metadata is stored in Confluence content properties and labels, with a human-visible metadata block appended to the page body.

Acceptance. Running the same plan twice does not duplicate Confluence pages. Content properties persist across updates. Metadata block is preserved against manual edits.

**Uses patterns from**: project-foundation (idempotent upsert), agentdiff (audit signatures continue here).

### Milestone 6c — VCS branch and PR provisioning executor

Deliver VCS provisioning in the same executor. Generated files are committed in **per-session git worktrees** (M3) to a generated branch and proposed through a PR by default. Commit trailers carry actor attribution; PR description carries the metadata block. **Hunk-level review** (§18.3) is supported in the preview output.

Acceptance. Running the same plan twice does not open duplicate PRs; subsequent runs update the existing PR. Direct commits to the default branch are refused unless the override configuration is set. PR description metadata block is preserved. Hunk-level accept/reject works in the preview UI/MCP-tool output.

**Uses patterns from**: agent-maestro (per-session worktrees), claude_agent_teams_ui (hunk-level review with merge3 via `node-diff3`), agentdiff (commit trailers `Orchestrator-Actor-Fingerprint`, `Orchestrator-Audit-Id`).

### Milestone 7 — Context resources and packs

Deliver `context_pack_generate`, `context_get`, MCP resources for project and issue context, **6-category token budgeting** against the target model's tokenizer, **5-step progressive truncation**, **22-model context-size table**, Qdrant-backed dense relevance ranking, **FTS5 BM25 with column weights** as the metadata-search component, redaction pass with gitleaks-based rules, prompt-injection scanning, and access-control gate integration (lethal trifecta + ACL ranking + mode A/B/C).

Acceptance. Agents can fetch `orchestrator://issue/{issueKey}/context`. Context includes linked Jira, Confluence, and VCS references with pinned versions. Context pack is bounded, traceable, and regenerates deterministically from pins. The access gate, lethal trifecta, ACL ranking, and policy decision layer return decisions on every cache or vector hit. UIO-sourced packs reuse UIO vectors via `source_id`.

**Uses patterns from**: context-fabric (E1 Capture, E2 Anchor for drift, E3 Router with FTS5 BM25 + column weights, E4 Governor with 22-model context table, E5 Weaver, InjectionGuard, PathGuard), agentic-rag-for-dummies (parent-child hierarchical chunking + hybrid retrieval + LangGraph-style query rewriting), uio (MinerU + BGE-M3 + multi-vector Qdrant), thinking-partner (challenge-prompt patterns for `architecture-review`).

### Milestone 8 — Readiness validation

Deliver `readiness_validate`, **layered scoring** (deterministic 6-category score → A/B/C/D + LLM-judged 4-tier verdict), weighted project-level and issue-level rubrics, readiness report resource, waiver handling, **5-category test framework with auditable Not-Applicable**, and confidence-gate JSON output.

Acceptance. Report identifies missing acceptance criteria, test plans, links, risks, and unresolved questions with weights. Project can transition to `READY_FOR_BUILD` only when both score-grade and verdict-tier permit. The `setup-orchestrator` skill (if emitted) follows the 5-section format (Identity / Orientation / Protocol / Quality Gates / Exit).

**Uses patterns from**: eval-view (4-tier verdict + drift tracker + golden baselines — see `docs/partners/eval-view.md`), Caliber (deterministic 6-category scoring, A/B/C/D), workbench (5-category test framework UT/IT/ST/PT/E2E), ai-coding-framework (six-dim conformance rubric), velocity-ops-engine + ai-coding-framework (confidence-gate JSON), Citadel (5-section skill format).

### Milestone 9 — Agent handoff

Deliver `handoff_generate` returning `ManifestSpawn`, `build-agent-handoff` prompt, and a single canonical source that emits `AGENTS.md`, `CLAUDE.md`, and Cursor / Codex / Copilot configs in parity. The cross-host parity script lives in `scripts/syncAgentConfigs.ts`.

Acceptance. Given a Jira issue key, the server returns a `ManifestSpawn` that Codex and Claude Code can consume identically. The handoff includes objective, scope, acceptance criteria, test plan, links, repo paths, agentMode, capabilities, and 6-phase + 7-pattern guidance. `syncAgentConfigs.ts` regenerates the host configs from AGENTS.md without drift.

**Uses patterns from**: claude-agent-builder (6-phase agent generation workflow + 7 multi-agent patterns library), agent-maestro (manifest-driven spawning + 4-mode classification), workbench (agent-config-shim auto-generation), Caliber (multi-platform writers for 5 hosts), everything-claude-code (canonical agent / skill / command / hook patterns).

### Milestone 10 — Webhook ingestion and resource subscriptions

Deliver the webhook ingress endpoint, Atlassian webhook handlers, Bitbucket Cloud webhook handlers, signature verification (Stripe-style HMAC), **delivery dedup with deterministic IDs**, normalized `GraphChangeEvent` pipeline, resource pagination, session-aware subscriptions, `resources/subscribe` support, and **SSE 30s keep-alive**.

Acceptance. Edits to a Confluence page or Jira issue land in the graph within SLO. Duplicate deliveries are discarded. Subscribed agents receive `notifications/resources/updated` without polling. Drift on orchestrator-generated artifacts is flagged in the readiness report. Permission-affecting events invalidate the relevant preflight profile entries and cached ACL entries. Long-lived SSE subscriptions stay open across NAT/proxy timeouts.

**Uses patterns from**: project-foundation (Stripe HMAC + mocked-fetch tests), claude_agent_teams_ui (SSE + deterministic message IDs `sha256(source+timestamp+content)`), PAE + agentdiff (bundled signature corpus).

### Milestone 11 — Notifications, evals, and hardening

Deliver notification provider with Slack and Teams adapters (pluggable `Transport<T>`), prompt eval framework via eval-view integration with golden datasets and LLM-as-judge rubrics, **TS `grain`-equivalent anti-slop linter**, **banned-patterns semgrep + bash anti-stub** scanners, MCP conformance tests via inspector (six-dim rubric), SLO metrics export, and the deployment runbook.

Acceptance. Provisioning completion and waiver events notify configured channels. Prompt eval framework runs on CI; verdict layer gates merges on `SAFE_TO_SHIP` or `SHIP_WITH_QUARANTINE`. MCP conformance suite passes. Anti-slop linter blocks PRs containing AI-generated tells. Operations runbook covers deployment, backup, restore, and disaster recovery.

**Uses patterns from**: eval-view (full eval framework — see `docs/partners/eval-view.md`), project-foundation (pluggable `Transport<T>` for Slack/Teams), grain (anti-slop linter; TS port), velocity-ops-engine (anti-stub guardrails), ai-coding-framework (banned-patterns semgrep), Citadel (telemetry contract pattern), agentdiff (continued audit signing).

## 29. Build Agent Prompts

The following prompts are executed one milestone at a time. Each is written to be agent-agnostic; "the build agent" refers to whichever agent is operating (Codex, Claude Code, or other). All prompts use **persona vocabulary routing** (named personas with backstory activate richer training patterns than generic role labels) where helpful (from three-man-team, see §40 F-113).

### 29.1 Iron laws applied to all prompts

Every build prompt enforces the §14.2 iron laws:

- **No completion claims without fresh verification evidence.** A "done" response without a build/test/lint output attached fails review.
- **No production code without a failing test first.** Pre-commit gates reject changes lacking an antecedent failing test.

### 29.2 6-phase workflow for `build-agent-handoff`

The `build-agent-handoff` prompt embeds the **6-phase agent-generation workflow** (from claude-agent-builder, see §40 F-110): Context Scan → Discovery → Research → Architecture → Build → Verify, with an explicit approval gate between Architecture and Build. The 7-pattern library is embedded in `ManifestSpawn.pattern`: `command-agent-skills` / `research-consolidate-plan-execute` / `parallel-specialists` / `self-evolving` / `hook-guarded` / `slash-command-handoff` / `mcp-powered`.

### 29.3 GT0–GT5 orientation detection for review prompts

Three prompts (`requirements-decomposer`, `architecture-review`, `readiness-reviewer`) include **orientation-detection probes** that silently classify the user's reasoning state into one of six modes (from thinking-partner, see §40 F-119):

- **GT0** — no orientation awareness (inertial). Intervention: introduce orientation concept.
- **GT1** — conclusion-preservation (identity fusion: evidence bends to defend conclusion). Intervention: decouple from identity, external monitoring.
- **GT2** — authority-preservation (fused to role). Intervention: differentiate authority from accuracy.
- **GT3** — threat-reduction (physiological state drives discomfort-seeking resolution). Intervention: address state first.
- **GT4** — completion-seeking (output over accuracy). Intervention: hold before resolve.
- **GT5** — monitor co-option (defense system locked, counter-evidence triggers more defense). Intervention: external scaffolding only; do NOT argue content.

Diagnosis is silent — the prompts do not label the user's state out loud. Mechanism-specific responses are encoded in the prompt template branches.

### Prompt 1 — Scaffold:
```text
Build Milestone 0 from docs/agent-context-orchestrator-mcp-plan-v6.md.
Create a TypeScript Node.js 22 MCP server with dual-transport support (stdio and Streamable HTTP), config loading, structured pino logging (file output only — never stdout for stdio), a health tool with proper annotations and output schema, session capability capture during initialize, a diagnostic session capabilities resource and stub session preflight resource, feature flags, test setup, Dockerfile, and docker-compose.yml with Postgres and Redis dependencies. Establish dual-port architecture: MCP on 3000, mgmt API on 3001.
Do not implement Atlassian providers yet.
Acceptance: server starts on both transports, tools/list includes health_check over both, session capability + preflight resources work, tests pass, docker compose up succeeds.
```

### Prompt 2 — Domain and storage:
```text
Implement Milestone 1.
Add domain models for ProjectBlueprint, ProjectGraph, TraceLink, ArtifactRef, ContextPack, SourcePin, TokenBudgetReport, ProjectProfile, AclEntry, McpSessionProfile, TenantScope, PolicyDecision, AuditEntry.
Add storage layer supporting PGlite (local dev) and Postgres (deployed) with drizzle migrations and tenant-scoped repositories.
Add a code-based PolicyDecisionLayer adapter and an encrypted token store using envelope encryption (libsodium secretbox or KMS data key), with a test double for local unit tests.
Add unit tests, snapshot tests, and a migration rehearsal test verifying parity between PGlite and Postgres. Do not call external services.
```

### Prompt 3 — Atlassian providers:
```text
Implement Milestone 2.
Add provider interfaces and direct REST providers for Jira and Confluence. Use ADF for Jira rich-text fields. Use Confluence v2 `storage` representation by default, with optional feature-flagged `atlas_doc_format` support only when tests prove compatibility.
Implement project_preflight_check and project_profile_get. Discover Jira create metadata via the non-deprecated /issue/createmeta/{projectIdOrKey}/issuetypes endpoints, required fields, issue types, link types, Confluence space/page capabilities, supported body representations, vector-store connectivity, embedding endpoint reachability, UIO partner reachability when configured, webhook registration, and auth warnings. Emit warnings as structured logs and OTel span events.
Implement API token and OAuth 2.0 3LO auth modes with refresh token rotation. Do not implement raw MCP-client token passthrough.
Implement pagination, retry with idempotency-key plumbing on writes, rate-limit handling, ADF helpers, Confluence storage helpers, and content-property helpers.
All live integration tests must be skipped unless required env vars are present.
Contract tests must be driven by recorded HTTP fixtures or OpenAPI stubs.
```

### Prompt 4 — VCS provider:
```text
Implement Milestone 3.
Add the VcsProvider interface and Bitbucket Cloud adapter.
Implement getRepository, createRepository, getFile, putFiles, createPullRequest, getWebhookSignatureVerifier, and per-session worktree management (acquireWorktree / releaseWorktree on branch orchestrator/{sessionId}).
Stub the GitHub adapter to validate the interface without implementation.
Contract tests pass for Bitbucket Cloud. Worktree tests pass on POSIX and Windows.
```

### Prompt 5 — Blueprint workflow with sampling:
```text
Implement Milestone 4.
Add MCP tools project_intake_create, project_blueprint_generate, and project_blueprint_update.
Use MCP sampling/createMessage for LLM-backed generation while handling an originating MCP request; fall back to a deterministic non-sampling path where possible, and to direct-API mode for headless background work using the §23 provider chain (seat-based first, API-key fallback).
Accept raw markdown, a UIO document reference, or a UIO file upload as intake input. When UIO source is provided, fetch the catalog entry and pin source_id + chunk_indices.
Add tests from fixture markdown requirements at temperature 0.
Sampling calls emit Langfuse traces.
Apply orientation-detection probes (GT0-GT5) to requirements-decomposer prompt.
```

### Prompt 6 — Provisioning preview:
```text
Implement Milestone 5.
Generate a dry-run artifact plan for Confluence pages, Jira issues, and VCS files.
Use the stored project profile from project_preflight_check; fail if it is stale or missing. Adapt the issue plan to company-managed vs team-managed Jira projects, required fields, link types, and safe custom fields.
Plan actor-attribution writes: label, Jira description metadata block, Confluence body metadata block, commit trailer, PR description block. Evaluate every planned action through the PolicyDecisionLayer (with action-mode obligations honored).
Run the adversarial verification triplet (false-positive filter + missing-issues finder + context validator) on the preview output and synthesize PASS/FAIL.
Add MCP tool project_provision_preview.
Ensure it never performs remote writes.
Return create/update/no-op/blocked actions, branch/PR VCS actions, estimated request counts, policy decisions, adversarial-triplet verdict, and a structuredContent payload conforming to the tool output schema.
```

### Prompt 7 — Jira provisioning executor (first shippable slice terminates here):
```text
Implement Milestone 6a.
Add a BullMQ worker and job repository.
Add MCP tool project_provision_execute that enqueues a Jira-only provisioning job and returns a job handle.
Expose job state via orchestrator://project/{projectId}/job/{jobId}.
Require previewId, approved: true, and idempotencyKey. Reject if the §18.1 adversarial-triplet verdict is FAIL.
Make repeated execution idempotent.
Enforce PolicyDecisionLayer obligations (including action-mode injections) before any remote write.
Implement actor-attribution writes on Jira: orchestrator-actor-<fingerprint> label, description metadata block, audit log entry.
Implement tamper-evident audit log with hash chain AND ed25519 signatures over JCS-canonicalized records. Mirror the public key to refs/orchestrator/keys/{key_id}:pub.key per docs/partners/agentdiff.md.
Implement Citadel-style claim-based scope coordination at .orchestrator/coordination/claims/ for concurrent worker safety.
```

### Prompt 8 — Confluence provisioning executor:
```text
Implement Milestone 6b.
Extend the provisioning executor to create and update Confluence pages using the storage representation by default.
Store metadata in Confluence content properties and labels; append a human-visible metadata block to the page body.
Preserve manual edits on page bodies that lack the orchestrator metadata block.
Continue ed25519 audit signing for all writes.
```

### Prompt 9 — VCS provisioning executor:
```text
Implement Milestone 6c.
Extend the provisioning executor to write generated files to a per-session git worktree (orchestrator/{sessionId} branch in .worktrees/orchestrator-{sessionId}/), and open a PR by default.
Do not commit to the default branch unless the override configuration is explicitly set.
Write commit trailers carrying actor attribution (Orchestrator-Actor-Fingerprint, Orchestrator-Audit-Id).
Write PR description metadata block.
Repeat runs update the existing PR rather than opening a duplicate.
Support hunk-level review in the preview output (preview returns per-hunk diffs that the caller can accept/reject individually) using node-diff3 or equivalent for merge3 conflict resolution.
```

### Prompt 10 — Context packs:
```text
Implement Milestone 7.
Add context_pack_generate, context_get, and MCP resources for project and issue context.
Implement 6-category token budgeting (claudeMd / mentionedFile / toolOutput / thinkingText / teamCoordination / userMessage) against the configured target model from the 22-model context-size table.
Implement 5-step progressive truncation (doc comments → private decls → children → leaf files → final relevance-ranked).
Integrate Qdrant for dense relevance ranking with trace-link filter and embedding similarity. Add FTS5 BM25 with column weights (path 2.0 / file_summary 1.5 / outline 1.2 / exports 1.0) as the metadata-search component of hybrid ranking.
Wire the access-control gate; before any cache/vector hit, run lethal trifecta baseline check (§38.1) → ACL ranking comparison (§38.2) → mode A/B/C (§7.1). Return gate decisions on every hit.
Implement prompt-injection scanning on pulled content (SYSTEM:/<IMPORTANT>/ignore-previous patterns) and gitleaks-based redaction. Wrap untrusted content in untrusted-data markers recognized by the §29 prompts.
Context packs must include objective, scope, non-goals, acceptance criteria, test plan, linked artifacts, repo refs, source pins (including UIO source_id when applicable), freshness state, access decision, and 6-category token budget report.
When source originated from UIO, fetch pre-computed vectors via the UIO adapter rather than re-embedding (per docs/partners/uio.md).
```

### Prompt 11 — Readiness validation and handoff:
```text
Implement Milestones 8 and 9.
Add readiness_validate with layered scoring: deterministic 6-category Caliber-style score (existence/quality/grounding/accuracy/freshness/bonus → A/B/C/D) + LLM-judged 4-tier verdict (SAFE_TO_SHIP / SHIP_WITH_QUARANTINE / INVESTIGATE / BLOCK_RELEASE).
Implement weighted project-level and issue-level rubrics with confidence-gate JSON output ({ check, checked, confidence: 0-100 }) and numeric PolicyDecision.confidenceScore.
Apply the 5-category test framework (UT/IT/ST/PT/E2E) with auditable Not-Applicable claims to spec validation.
Apply orientation-detection probes (GT0-GT5) to readiness-reviewer prompt.

Add handoff_generate returning ManifestSpawn (versioned: 1) with targetAgent, agentMode, task, contextPackUri, capabilities (allow/deny/obligations), prompts, phaseGuidance (6-phase), pattern (7-pattern library).
Implement scripts/syncAgentConfigs.ts: regenerate .cursor/rules/agents.mdc, .codex/config.toml, .github/copilot-instructions.md from canonical AGENTS.md (Linux Foundation Jan 2026 format).
Emit AGENTS.md, CLAUDE.md, and Cursor / Codex / Copilot configs from a single canonical source.
Add tests for ready and not-ready projects and for waiver handling.
```

### Prompt 12 — Webhook ingestion and subscriptions:
```text
Implement Milestone 10.
Add the webhook ingress endpoint on a distinct port from MCP HTTP (WEBHOOK_INGRESS_PORT, default 7412).
Implement signature verification for Atlassian and Bitbucket Cloud webhooks using a Stripe-style HMAC pattern with mocked-fetch tests.
Implement delivery dedup using deterministic IDs sha256(source + timestamp + content), backed by Redis with 24h TTL. Use provider event-ID headers when available (X-Atlassian-Webhook-Identifier, X-GitHub-Delivery, X-Hook-UUID).
Maintain the bundled signature-verifier corpus per provider (headerName, secretRef, hashAlgorithm, signatureFormat) — new providers added by appending to the corpus, not by writing per-provider code paths.
Normalize events to GraphChangeEvent and update the graph through the queue.
Implement resources/subscribe, notifications/resources/updated with SSE 30s keep-alive frames, and resource pagination on enumerable resources.
Add drift flagging on orchestrator-generated artifacts.
Invalidate preflight profile and cached ACL entries on permission-affecting events.
```

### Prompt 13 — Notifications, evals, and hardening:
```text
Implement Milestone 11.
Add NotificationProvider with Slack and Teams adapters using a pluggable Transport<T> abstraction.
Add a prompt eval framework integrated with eval-view (per docs/partners/eval-view.md): multi-provider LLM-as-judge with cache, 4-tier verdict layer, drift tracker, golden baselines, auto-PR from production incidents, model-drift canary suite. CI gates merges on verdict ∈ {SAFE_TO_SHIP, SHIP_WITH_QUARANTINE}.
Add MCP conformance tests driven by the MCP inspector and graded on the six-dim rubric (instruction compliance / functional correctness / quality evidence / scope control / continuity / portability) at 0–5 each.
Add a TS anti-slop linter (port of the Python `grain` pattern) that flags AI-generated code tells: obvious comments, vague TODOs, hedge words, restated docstrings.
Add banned-patterns semgrep YAML rules and a bash anti-stub scanner (12 patterns: STUB_NOT_IMPLEMENTED, TYPE_AS_ANY, TYPE_DOUBLE_ASSERT, TYPE_TS_IGNORE, MODULE_REQUIRE, SECURITY_HARDCODED_SECRET, SECURITY_SQL_INJECTION, STUB_TRUNCATION, STUB_ELLIPSIS, STUB_EMPTY_CATCH, STUB_CATCH_TODO, STUB_INLINE_MARKER) with should-catch / should-pass test fixtures.
Add OTel exporters, Prometheus counters per §27.2, install-unique deaggregation ID, Sentry conditional init by environment, and Agent Trace v0.1.0 JSONL emission for long-running workflows.
Produce docs/operations.md with deployment, backup, restore, and disaster recovery runbooks.
Produce docs/adr/0001..N MADR files documenting every adopted refinement.
```

## 30. Security Requirements

Use least-privilege credentials. Never log tokens or secrets. Encrypt tokens at rest with envelope encryption backed by a KMS, Vault, or equivalent deployment secret. Sealed-box primitives are public-key constructs and are not appropriate for this purpose. Redact secrets from all generated context packs using a layered detection strategy combining gitleaks-rule-compatible patterns with entropy-based detection for generic high-entropy strings.

Preview before writes. Require explicit approval for writes. Block destructive operations by default and enforce the block at the policy decision layer and writeGuards layer below tool argument validation. Respect Atlassian and VCS permissions. Do not use raw downstream-token passthrough. Before returning cached or vectorized content, **run the lethal-trifecta baseline check (§38.1) → ACL ranking comparison (§38.2) → access-control gate (§7.1) in this order**; fail closed on gate timeouts and provider errors.

### 30.1 Audit log: hash chain + ed25519 signatures + git-ref key registry

Write audit entries for all tool calls that create or update remote artifacts. Include actor (MCP principal and credential fingerprint), timestamp, tool name, input hash, output IDs, error state, previous-entry hash, **and an ed25519 signature over the JCS-canonicalized record (RFC 8785)**. Audit entries form a hash chain so tampering is detectable. The signature uses a private key in `~/.orchestrator/keys/private.key` (chmod 600); the corresponding public key is mirrored to `refs/orchestrator/keys/{key_id}:pub.key` where `key_id = first 16 hex of sha256(pubkey)`. Verifiers fetch the public key from the git-ref registry by key_id without out-of-band key exchange. (from agentdiff pattern, see §40 F-117 + `docs/partners/agentdiff.md`)

This **replaces a planned KMS dependency for v1**. KMS becomes optional post-v1 for deployments that need centralized key management or per-tenant key rotation policies. The git-ref registry approach works offline, requires no external service, and survives squash/rebase via UUID dedup.

For compliance-adjacent deployments, additionally ship audit entries to an append-only SIEM sink. Actor attribution is mirrored into Jira labels, Jira/Confluence body metadata blocks, commit trailers, and PR description blocks so the audit trail survives the identity hop to downstream systems (see §20).

### 30.2 Code-quality enforcement (three layers)

Three complementary layers enforce code-quality discipline against AI-generated drift:

1. **Anti-stub guardrails (12 patterns)** — bash scanner with should-catch / should-pass test fixtures (from velocity-ops-engine pattern). Patterns: `STUB_NOT_IMPLEMENTED` / `TYPE_AS_ANY` / `TYPE_DOUBLE_ASSERT` / `TYPE_TS_IGNORE` / `MODULE_REQUIRE` / `SECURITY_HARDCODED_SECRET` / `SECURITY_SQL_INJECTION` / `STUB_TRUNCATION` / `STUB_ELLIPSIS` / `STUB_EMPTY_CATCH` / `STUB_CATCH_TODO` / `STUB_INLINE_MARKER`. (from velocity-ops-engine, see §40 F-002)
2. **Banned-patterns semgrep YAML** — declarative rule set (from ai-coding-framework). Different enforcement layer (semgrep CLI in CI) from the bash scanner; both run on every PR. (from ai-coding-framework, see §40 F-005)
3. **TS anti-slop linter** — port of the Python `grain` v0.2.0 anti-slop tool. Flags AI-generated tells: obvious comments, vague TODOs, hedge words, restated docstrings. Custom `.antislop.toml` rules. (from grain, see §40 F-148)

### 30.3 Postmortem framework (CATCH→DIAGNOSE→ROOT CAUSE→FIX→SAVE→ENFORCE)

When a production incident or detected violation occurs, the orchestrator's incident playbook (`docs/operations.md`) requires a 6-step postmortem (from vibe-tuning, see §40 F-149):

1. **CATCH** — log the violation as it occurred.
2. **DIAGNOSE** — chain-of-thought trace; identify the agent's reasoning path.
3. **ROOT CAUSE** — classify against the failure-mode taxonomy (§30.4).
4. **FIX** — propose a concrete fix; classify against the fix-type taxonomy (§30.5).
5. **SAVE** — write the rule/config/process to the appropriate location.
6. **ENFORCE** — wire a hook (PreToolUse / PostToolUse / pre-commit / CI gate) so the rule actively triggers, not just sits in a doc. **"Rules without enforcement are just hope."**

### 30.4 Failure-mode taxonomy

Every detected failure is classified along two axes (from vibe-tuning + claude-code-log-analyzer, see §40 F-149 + F-090):

- **Cause class**: `Ambiguity` / `Missing Context` / `Wrong Tool` / `Speed over Safety` / `Pattern Matching` / `Model Limitation`.
- **Failure class**: `SYSTEMATIC` / `INCOHERENT` / `OMISSION` / `API_ERROR`.

The 20-failure-mode taxonomy in `FRAMEWORK-METHODOLOGY-AND-AUDIT.md` (CodingRepos parent meta-repo) serves as the source of FM-1..FM-20 references for §34. (from CodingRepos parent, see §40 F-019)

### 30.5 Fix-type taxonomy

Fixes are classified for downstream tracking (from vibe-tuning, see §40 F-149):

- `Rule` (declarative; lands in CLAUDE.md / banned-patterns / etc.)
- `Tool` (new tool / new tool capability)
- `Config` (deployment or runtime config change)
- `Education` (operator training; doc update)
- `Process` (workflow change; e.g., add an approval gate)

### 30.6 Other security primitives

Scan pulled content for prompt-injection patterns before inclusion in context packs (§16.5). Wrap pulled content in untrusted-data markers that the §29 handoff prompts recognize. Verify webhook signatures before processing. Deduplicate webhook deliveries before normalization. Drop unsigned or mis-signed events without processing. Every MCP tool declares safety annotations, but enforcement lives in the server-side policy decision layer, write guards, access gate, and approval checks, not in annotations. Repository reads/writes must always carry a tenant scope, even in single-tenant mode.

## 31. Testing Strategy

Unit tests cover domain model validation, blueprint parsing, tenant-scope enforcement, session capability negotiation, preflight profile validation, artifact plan generation, policy-decision evaluation (including action-mode obligation injection), actor-attribution planning, lethal-trifecta gate, ACL-ranking comparison, readiness scoring (both deterministic 6-category and verdict-layer integration), context pack generation (6-category token tracking, 5-step truncation), token budgeting, redaction, injection scanning, Jira ADF generation, Confluence storage rendering, access gates, tool annotations, tool output schemas, audit-chain integrity, **audit ed25519 signature verification against the git-ref key registry**, webhook delivery dedup, deterministic dedup-key generation, and Rovo allowlist enforcement.

Contract tests cover Jira, Confluence, and VCS provider behavior against recorded HTTP fixtures and OpenAPI-derived stubs. Confluence tests must separately verify storage representation and feature-flagged atlas_doc_format behavior. Pagination, 429 handling, retry with idempotency-key plumbing, and idempotency are exercised.

Integration tests run only when credentials are present and target create/update on a sandbox Confluence space, a sandbox Jira project, and a sandbox VCS branch, with cleanup. Webhook signature verification is tested against real signature samples. Per-session worktree acquire/release is tested on POSIX and Windows.

Conformance tests use the MCP inspector to validate JSON-RPC envelope compliance, capability negotiation, tool/resource/prompt registration, structuredContent/outputSchema behavior, subscription lifecycle (including 30s SSE keep-alive), completion responses, and resource pagination. Conformance results are scored on the **six-dimension rubric** (instruction compliance / functional correctness / quality evidence / scope control / continuity / portability) at 0–5 per dimension. (from ai-coding-framework, see §40 F-005)

Snapshot tests cover generated Confluence page bodies, generated Jira issue payloads, generated VCS manifests, and generated context packs.

### 31.1 Eval-view integration (wholesale)

Evals cover the LLM-backed prompts (`project-intake-interview`, `requirements-decomposer`, `jira-story-writer`, `confluence-page-writer`, `readiness-reviewer`, `build-agent-handoff`) against a golden dataset with an LLM-as-judge rubric using the **eval-view framework integrated as a partner** (see `docs/partners/eval-view.md`). Eval-view provides: (from eval-view, see §40 F-046 + `docs/partners/eval-view.md`)

- **Multi-provider LLM-as-judge** with judge cache (SQLite + in-memory, 24h TTL, ~80% cost reduction in statistical mode).
- **Code-based deterministic checks** applied **before** the LLM judge call (regex, JSON schema) — dock points without API spend.
- **4-tier verdict layer**: `SAFE_TO_SHIP` / `SHIP_WITH_QUARANTINE` / `INVESTIGATE` / `BLOCK_RELEASE` (see §17.2).
- **Drift tracker** with temporal OLS slope across check history; drift-classifier confidence (NONE / WEAK / MEDIUM / STRONG); flipped-prompt counting; suite-size aware thresholds.
- **Golden baseline system** with up to 5 variants per test (`.evalview/golden/`); auto-save + approval workflow (`--approve-generated`); multi-variant clustering for non-deterministic outputs.
- **Auto-PR from production incidents**: `evalview monitor --incidents` → `evalview autopr --open-pr` opens regression-test PRs via `gh pr create` (deterministic, no LLM).
- **Model-drift canary suite**: separate zero-judge canary (`evalview model-check --model claude-sonnet-4-6`) catches silent provider model updates.
- **Pytest-style plugin** with `evalview_check` fixture.
- **Slack notifier** for daily digests with drift sparklines and stale-quarantine warnings.

CI gates merges on verdict ∈ {`SAFE_TO_SHIP`, `SHIP_WITH_QUARANTINE`}. Eval regression runs on every PR; prompt version bumps require passing evals before merge.

### 31.2 Anti-slop linting in CI

The §30.2 layer-3 anti-slop linter (TS port of `grain`) runs in CI as a code-quality gate alongside vitest, ESLint, and the banned-patterns scanners. It blocks PRs containing AI-generated tells.

## 32. Definition of Done

The project is complete when a user can submit raw requirements (or a UIO document reference / file upload); the server creates a structured project blueprint; the server discovers a non-stale project profile; the server previews Confluence, Jira, and VCS changes (with adversarial-triplet PASS); the server executes approved provisioning idempotently through the queue with actor attribution propagated into Jira labels, Jira and Confluence metadata blocks, commit trailers, and PR description blocks; the server creates linked Confluence pages and Jira issues with correct per-project-type behavior; the server creates or updates VCS agent-context files across supported providers through a generated branch and PR by default in **per-session worktrees**, with **hunk-level review** supported in M6c preview; the server exposes project and task context through paginated MCP resources with session-aware subscription support and 30s SSE keep-alive; **the lethal-trifecta baseline check, ACL ranking comparison, access-control gate, and policy decision layer authorize every cache/vector hit** in the configured order; the server ingests webhooks with **deterministic dedup-key delivery dedup** and keeps the graph current; the server validates build readiness against the **layered rubric (deterministic 6-category score + LLM-judged 4-tier verdict)**; any compliant MCP agent (Codex, Claude Code, or other) can fetch a `ManifestSpawn` handoff and begin implementation; **eval-view-driven evals** including model-drift canary pass; secrets are redacted; **writes are audited with hash-chained ed25519-signed records and the public key is mirrored to `refs/orchestrator/keys/`**; all persistence and vector/secret paths are tenant-scoped even in single-tenant mode; **anti-stub guardrails (12 patterns) + banned-patterns semgrep + TS anti-slop linter** all gate merges; and the operations runbook covers deploy, backup, restore, and DR plus the **CATCH→DIAGNOSE→ROOT CAUSE→FIX→SAVE→ENFORCE postmortem framework**.

## 33. Prerequisites Checklist Before Live Provisioning

Run `project_preflight_check` first and review its warnings. Then collect or decide deployment mode (`single_tenant` for v1), tenant ID (`default` unless explicitly changed), policy mode (`code` for v1), the Atlassian Cloud site URL, Atlassian cloud ID, Jira project key or permission to create one, Jira project type (company-managed or team-managed), available Jira issue types, custom fields to use or avoid, Confluence space key or permission to create one, VCS provider (Bitbucket Cloud for MVP; GitHub/GitLab for future; Bitbucket Data Center and Server are out of scope), VCS workspace, VCS repo slug or permission to create one, whether the VCS workspace is linked to an Atlassian organization, auth mode (API token, OAuth 3LO, or service-account/bot), whether API token auth is allowed by org admins, rate-limit constraints, whether generated pages require human review before publish, required labels/components/versions, branch naming convention, PR template convention, CI requirements, security/privacy constraints, data caching policy, access gate mode, **whether lethal trifecta enforcement is desired** (default yes), notification channel (Slack or Teams webhook URL), secrets-manager location for the token encryption key, actor-attribution fingerprint salt location, **path to ed25519 audit private key + git ref for the public-key registry**, **whether the UIO partner is enabled** and its base URL + API key + Qdrant URL (see `docs/partners/uio.md`), and **whether the eval-view partner is enabled** and its API URL (see `docs/partners/eval-view.md`).

Partner-repo install steps are not duplicated here — see `docs/partners/{uio,eval-view,agentdiff}.md` for clone, install, configuration, integration, and validation procedures.

## 34. Key Risks and Mitigations

The risk register references the **20-failure-mode taxonomy** in `FRAMEWORK-METHODOLOGY-AND-AUDIT.md` (CodingRepos parent meta-repo) for FM-1..FM-20 source IDs. (from CodingRepos parent, see §40 F-019)

| Risk | Mitigation |
|---|---|
| Tool sprawl overwhelms agents (FM-1) | **Tool-collapse pattern** (§14): 3 compound tools default + N granular behind `--all-tools` flag. Consolidate metadata-attach operations into `artifact_annotate`. Expose detailed context as resources. |
| Duplicate Jira issues or pages (FM-2) | Use stable artifact IDs, idempotency keys, stored remote IDs, and preflight-derived field mappings. Enqueue through the queue to serialize writes per project. Idempotency-key plumbing on retried HTTP requests. |
| Wrong Confluence body format (FM-3) | Default to Confluence `storage` representation. Keep `atlas_doc_format` behind a feature flag and live compatibility test. |
| Raw token passthrough violates MCP security model (FM-4) | Do not forward MCP client tokens to downstream APIs. Use server-owned OAuth/API-token/service-account credentials or standards-based token exchange where supported. |
| Lost actor attribution across identity hop (FM-5) | Propagate originating-principal fingerprints via Jira labels, body metadata blocks, commit trailers, PR description blocks, and the orchestrator audit log (ed25519-signed). |
| Tool annotations are trusted too much (FM-6) | Treat annotations as UI hints only. Enforce safety through the policy decision layer, write guards, approvals, access gate (lethal trifecta + ACL ranking + mode A/B/C), and audit checks. |
| Formal policy engine added too early (FM-7) | Keep v1 policy code-based behind a `PolicyDecisionLayer` interface. Add OPA/Rego or Cedar only after deployment evidence shows code policies are insufficient. |
| MCP client capability mismatch (FM-8) | Record session capabilities during initialize, gate optional features by session, and provide fallbacks for elicitation, sampling, subscriptions, completions, and tasks. |
| Cached/vector content leaks across permissions (FM-9) | Run lethal trifecta + ACL ranking + access-control gate (configured mode) with fail-closed semantics. Invalidate cached ACLs on permission-affecting webhooks. |
| Context packs become too large (FM-10) | Enforce **6-category token tracking** with section reservations. Use **5-step progressive truncation** + hybrid (dense + BM25) ranking to drop low-value content first. Track `truncationStep` in `TokenBudgetReport` so readiness penalizes packs that hit step 4 or 5. |
| Agents act on stale context (FM-11) | Store pinned source versions and freshness state in every context pack. Webhook ingestion updates the graph in real time and fires resource update notifications. Dirty packs block readiness. |
| Destructive writes happen accidentally (FM-12) | Dry-run first, require approval, **adversarial-triplet PASS gate** (§18.1), block destructive changes by default at the writeGuards layer. |
| Atlassian rate limits interrupt provisioning (FM-13) | Add request budgeting, backoff honoring Retry-After (incl. 425/408), pagination, and concurrency limits in provider middleware. Idempotency-key plumbing on retries. Fail preview if request estimate exceeds configured ceiling. |
| Manual edits conflict with generated content (FM-14) | Preserve manual sections using generated markers, show diffs in preview, **support hunk-level review** (M6c), and flag drift in the readiness report. |
| Permissions differ per user (FM-15) | Prefer per-user OAuth 3LO for multi-user deployments. When cached content is used, the access gate verifies via remote check or cached ACL with invalidation. |
| VCS support differs by auth mode (FM-16) | Keep direct REST providers available and isolate Rovo MCP as an optional read-only provider behind an allowlist. |
| Webhook duplicate delivery corrupts state (FM-17) | **Deterministic dedup keys** `sha256(source+timestamp+content)` with provider event-ID headers when available. Redis TTL. |
| Stale preflight profile causes provisioning failure (FM-18) | Invalidate on permission webhooks, token rotation, branch-protection changes, and TTL. Fail preview on stale profile. |
| Rovo provider exposes unintended capabilities | Default allowlist covers read/search only. Extensions require explicit config. |
| Prompt injection through Confluence or Jira content (FM-19) | Scan pulled content for injection patterns (`SYSTEM:`, `<IMPORTANT>`, `[INST]`, etc.) before inclusion. Wrap untrusted data in markers recognized by handoff prompts. |
| Secret leakage through generated context (FM-20) | Apply gitleaks-rule-compatible detection plus entropy-based detection. Test cases cover each rule class. **TS anti-slop linter** flags hard-coded credentials in code comments. |
| Audit log tampering | Hash-chain audit entries **PLUS ed25519 signatures with git-ref key registry**. Optionally ship to an append-only SIEM sink. |
| Audit-key registry compromise | Public keys mirrored to `refs/orchestrator/keys/{key_id}:pub.key`; key rotation by issuing a new key pair, registering, and superseding the old via ADR. KMS optional post-v1. |
| AI-generated code drift | **Three layers**: 12-pattern bash anti-stub + banned-patterns semgrep + TS anti-slop linter (`grain` port). All three gate merges in CI. |
| Prompt regressions break agents | Run **eval-view evals + model-drift canary** on every prompt version bump. Gate merges on verdict ∈ {SAFE_TO_SHIP, SHIP_WITH_QUARANTINE}. |
| Blueprint schema evolution | Carry `schemaVersion` on every blueprint. Provide migration functions for each bump. Store old versions for replay. |
| Multi-tenant cache leakage | v1 remains single-tenant, but stores `tenantId`, requires `TenantScope`, scopes vector collections and secret paths by tenant, and plans Postgres RLS for SaaS. |
| Bitbucket Data Center/Server assumed compatible with Cloud | MVP explicitly targets Bitbucket Cloud only. DC/Server REST differences require a separate adapter; flagged as out of scope for v1. |
| Concurrent worker scope conflict | **Citadel claim-based coordination** at `.orchestrator/coordination/claims/`: workers writing claim files; conflicts cause skip-to-next, not wait. Complemented by §6.1 `lockedSpec` at the spec/phase level. |
| Context-window-exhaustion mid-job | **Checkpoint files** at `.orchestrator/checkpoints/` written before context exhaustion; `resume` operation picks up from checkpoint. Discovery-brief compression keeps Wave 2+ context under control. |
| UIO partner unavailable | UIO is optional; orchestrator falls back to its own embedding pipeline (Qdrant + BGE-M3 directly) when UIO is disabled or unreachable. Preflight emits a warning. See `docs/partners/uio.md` §9 (operational concerns). |
| Eval-view partner unavailable | CI degrades to local-only test gating (vitest + lint + typecheck + anti-stub + banned-patterns + anti-slop). Verdict layer falls back to deterministic 6-category score only. See `docs/partners/eval-view.md` §9. |

## 35. Relationship to Adjacent Systems

### 35.1 UIO (Universal Intake Orchestrator) — direct integration partner

UIO is no longer an "adjacent system"; it is a **direct integration partner**. The orchestrator's `project_intake_create` tool accepts three source kinds (see §15 schema):

1. `raw_markdown` — content inline; orchestrator embeds via its own pipeline.
2. `uio_document` — `{ uioSourceId, uioChunkIndices? }` — orchestrator fetches UIO's catalog entry and pulls pre-computed dense+sparse+ColBERT vectors from UIO's Qdrant by `source_id` (and optionally `chunk_index` filter), avoiding re-embedding.
3. `uio_file_upload` — `{ garageKey, mimeType }` — orchestrator calls UIO's MCP `uio_ingest` tool, polls envelope status until `completed`, then proceeds as in (2).

UIO's pipeline is the canonical reference for **MinerU + PaddleOCR + Docling + GLM-OCR document parsing**, **BGE-M3 multi-vector embeddings (dense 1024 + sparse + BM25 + ColBERT)**, **hierarchical token-aware chunking (500 target / 600 max / 100 min / 50 overlap)** with **deterministic chunk IDs** `chunk_id = SHA256(source_id | content | stage | version_hash)`. The orchestrator does not duplicate this pipeline; it consumes UIO outputs.

Operational details (clone, install, env vars, Qdrant collection access, gotchas like PgBouncer transaction-mode and BGE-M3 sparse-format conversion) live in `docs/partners/uio.md`.

### 35.2 Langfuse, Prometheus, OTel, Sentry

All sampling calls and context pack assemblies export traces to the shared Langfuse instance. Trace attributes include project ID, blueprint version, prompt version, tool name, token counts, and provider-chain entry. Prometheus scrapes counters from the mgmt API port (3001). OpenTelemetry spans are exported to the configured OTLP endpoint. Sentry captures unhandled errors when env ∈ {staging, production}. Prompt eval runs (via eval-view) also trace to Langfuse so prompt regressions are visible alongside production use. See §27 for the full observability spec.

### 35.3 Eval-view — direct integration partner for §31

Eval-view (Python+Node, 56k SLOC, MCP-server-included) is a **direct integration partner** providing the §31 testing framework wholesale. The orchestrator's eval suite is built on eval-view's verdict layer, drift tracker, golden baselines, and judge cache. CI gates merges on the eval-view verdict.

Operational details live in `docs/partners/eval-view.md`.

### 35.4 Eight context strategies (taxonomy)

The orchestrator categorizes context sources into eight strategies (from agentic-coding-handbook, see §40 F-101):

1. **Implementation plans** — orchestrator-emitted plan.md / todo.md.
2. **Well-crafted prompts** — `build-agent-handoff` and other §29 prompts.
3. **Host MCP tools** — Claude Code / Cursor / Codex / Windsurf / OpenCode tool surfaces.
4. **External MCPs** — Jira / Confluence / Figma / GitHub / Rovo.
5. **Visual mockups** — Figma exports / screenshots attached to issues.
6. **Project instructions** — CLAUDE.md / AGENTS.md / `.cursor/rules` / `.codex/config.toml` / `.github/copilot-instructions.md` (auto-generated from canonical AGENTS.md).
7. **Workspace indexing** — Qdrant + FTS5 BM25 index of project content.
8. **Conversational memory + small-first scaling** — orchestrator-emitted context packs with 6-category token tracking and 5-step progressive truncation.

The orchestrator owns categories (1), (2), (4)-Atlassian-Rovo, (6), (7), and (8). Categories (3), (5), and (4)-non-Atlassian are managed by the host or the operator and referenced by the orchestrator.

### 35.5 Unidirectional sync to external trackers

Outbound sync to Notion / Linear / Jira / Confluence follows **unidirectional sync** (from project-foundation-workbench `SYNC.md`, see §40 F-082): the orchestrator reads its own repo state for decisions and pushes updates to external trackers; it never reads back from those trackers to make work-routing decisions. This prevents infinite loops, race conditions, and sync drift. External-tracker outage does not block work.

### 35.6 Brand and packaging

If this ships as a Velocity Ops offering, package and repo naming follows VO conventions (`@velocityops/context-orchestrator` or equivalent) and the documentation adopts the finalized VO visual identity. This decision is made before the v1.0 release, not before MVP.

## 36. Versioning and Compatibility

The server follows semver. The MCP spec version the server implements is declared in server info. The server targets the most recent stable MCP spec version supported by both the TypeScript SDK and the reference build-agent hosts (Codex, Claude Code); draft or opt-in capabilities (for example, MCP Tasks for long-running operations) are gated behind feature flags and are not required for default operation. Blueprint schema carries `schemaVersion` independent of the server version; migrations between schema versions are stored in `src/storage/migrations/blueprint/`. Prompts carry `promptVersion`; prompt version bumps mark dependent context packs as regeneration-eligible but do not invalidate them.

A compatibility matrix in the README documents, per server release, the supported MCP spec versions, target build-agent versions (Codex, Claude Code, Cursor, Windsurf, OpenCode, Gemini), Atlassian API versions, VCS API versions, Rovo MCP endpoint versions, **UIO partner versions**, **eval-view partner versions**, and Bitbucket variant scope (Cloud only in MVP). The matrix also records which clients support elicitation, resource subscriptions, Streamable HTTP, resource pagination, completions, host-delegated sampling, optional task-style long-running operations, and **proactive resource pinning** (for `orchestrator://session/current/preflight`). At runtime, the `McpSessionProfile` is the source of truth for what was negotiated in the current session.

## 37. Immediate Next Step

Start with Milestone 0. Do not try to implement the entire system at once. The first useful deliverable is a working MCP server with both stdio and Streamable HTTP transports, dual-port architecture (MCP 3000, mgmt 3001), a health tool with proper annotations and output schema, session capability capture, the diagnostic session capabilities resource, the stub session preflight resource, typed config, pino logger (file output only), test harness, Dockerfile, compose file, and a documented project skeleton. The second useful deliverable is not provisioning; it is **preflight capability discovery with recorded fixtures, including UIO partner reachability when configured**. The first shippable slice terminates at Milestone 6a (Jira-only provisioning with actor attribution + ed25519-signed audit chain); Confluence (M6b) and VCS-with-worktrees-and-hunk-review (M6c) provisioning land as separate, orderable increments after the slice is proven.


## 38. Cross-cutting Safety Concepts

This section is the **single canonical home** for safety concepts that touch multiple v6 sections. §7, §14, §17, §24, §30 link in via `→ see §38.x` rather than redefining. This is the anti-duplication mechanism that keeps v6 from accumulating the same definition in five places.

### 38.1 Lethal trifecta (baseline access-gate check)

**Definition** (from open-edison's `DataAccessTracker`, see §40 F-126): three boolean flags per session/request:

- `has_private_data_access` — the session has touched a tool/resource/prompt classified as reading private data.
- `has_untrusted_content_exposure` — the session has touched untrusted public content (read of untrusted source).
- `has_external_communication` — the session has touched a write/external-communication operation.

When all three are true at once, the trifecta is "complete" and the gate **blocks** the in-flight operation regardless of ACL or mode A/B/C. Rationale: this is the canonical pattern for prompt-injection-driven exfiltration (untrusted content + private data + write-out = exfil path). Blocking the third leg is the cheapest reliable defense.

The check runs **before** the §38.2 ACL ranking and **before** §7.1 modes A/B/C. Configured via `accessGate.lethalTrifecta.enabled` (default `true`).

### 38.2 ACL ranking + wildcard permission JSON

**Classification levels** (from open-edison's permissions model, see §40 F-126): `PUBLIC (0) < PRIVATE (1) < SECRET (2)`. Every tool, resource, prompt, and stored artifact carries one of these. The gate enforces no-write-down: a session whose highest-classification observed read is `SECRET` cannot write to a `PRIVATE` or `PUBLIC` artifact without explicit `requireHumanApproval` obligation.

Permissions are loaded from JSON with **wildcard pattern support** (`filesystem/*`, `mcp__atlassian__*`, `template:*`). Schema:

```ts
interface ToolPermission { pattern: string; classification: "PUBLIC" | "PRIVATE" | "SECRET"; readPrivate: boolean; readUntrusted: boolean; writeOperation: boolean; }
interface ResourcePermission { uriPattern: string; classification: "PUBLIC" | "PRIVATE" | "SECRET"; }
interface PromptPermission { name: string; classification: "PUBLIC" | "PRIVATE" | "SECRET"; }
```

The gate compares the session's highest classification × the requested operation's classification × the configured no-write-down policy and returns allow/deny.

### 38.3 Action-mode capability injection + four shared protocols

**Action-mode capability injection** (from claude_agent_teams_ui, see §40 F-095): the PolicyDecisionLayer can inject capability constraints into a session at runtime without changing tool code. Two action modes are predefined:

- **`requireReadOnlyMode`** — disable all write tools for the session (deny effect on any write call).
- **`requireApproveEachTool`** — every tool call requires explicit `approval_request` round-trip before execution.

These are PolicyObligation kinds (§7.2) — the workflow layer enforces them; tools cannot opt out.

**Four shared protocols** (from claude-code-production-grade-plugin, see §40 F-091) loaded into the PolicyDecisionLayer at startup:

1. **`ux-protocol.md`** — 6 interaction rules: no open-ended questions, structured options, recommended-first ordering, "Chat about this" as last resort, continuous execution, real-time progress.
2. **`input-validation.md`** — 5-step validation: read config → probe inputs in parallel → classify (Critical / Degraded / Optional) → print gap summary → adapt scope.
3. **`tool-efficiency.md`** — 5 tool-usage rules: parallel tool calls, smart_outline before Read, Glob (not find), Grep (not grep), config-aware paths.
4. **`conflict-resolution.md`** — authority hierarchy by artifact type, dedup by file:line, max-2 HARDEN→BUILD feedback cycles before escalation.

These protocols are loaded into the system prompt for `coordinator` and `coordinated-coordinator` mode sessions (§14.1) and consulted by the PolicyDecisionLayer for relevant policy decisions.

### 38.4 Fleet pattern (discovery-brief compression + claim-based scope coordination)

For wave-based DAG execution, the **Fleet pattern** (from Citadel, see §40 F-141 + F-142) defines:

- **Wave 1** spawns 2–3 sub-agents in **isolated git worktrees** (per §24.5) with no file overlap.
- **After each wave**, sub-agent outputs are compressed to **~500-token discovery briefs** in `.orchestrator/fleet/briefs/{waveId}/{taskId}.md`.
- **Wave 2+** receives ALL prior briefs in initial context to avoid re-discovering the same artifacts.
- **Scope conflicts** are prevented by **file-based claims** at `.orchestrator/coordination/claims/`. Workers write claim files naming the artifacts they intend to modify; conflicts cause **skip-to-next** (no wait, no deadlock).
- **Budget**: ~700K tokens per wave with ~300K reserved for orchestration logic.

Fleet pattern complements §6.1 `lockedSpec` (spec/phase-level lock) with artifact-level claims.

### 38.5 Iron laws (verification + test-first)

Two non-negotiable rules enforced as PolicyObligation kinds (from superpowers, see §40 F-106):

- **No completion claims without fresh verification evidence.** Obligation `requireVerificationEvidence`. A `*_complete` outcome without an attached build/test/lint output fails review.
- **No production code without a failing test first.** Obligation `requireFailingTestFirst`. Pre-commit gates reject changes lacking an antecedent failing test.

These laws apply to v6 sections §14, §18, §24, and §31 simultaneously and are referenced from each.

### 38.6 Six-dimension conformance rubric

For MCP conformance and §31 readiness scoring, the **six-dimension rubric** (from ai-coding-framework `benchmarks/rubric.md`, see §40 F-005) scores each evaluated artifact 0–5 on:

1. **Instruction compliance** — followed the directive without drift.
2. **Functional correctness** — the output works as specified.
3. **Quality evidence** — test outputs, lint, type-check, security-scan results attached.
4. **Scope control** — stayed within the requested change; no unrelated edits.
5. **Continuity** — checkpointed state; resumable; no lost context.
6. **Portability** — works across host agents (Claude Code, Codex, Cursor) without per-host hacks.

Total = 0–30. Conformance threshold = 25/30 (per dimension floor 3/5). The §17.2 verdict layer can downgrade `SAFE_TO_SHIP` to `SHIP_WITH_QUARANTINE` if conformance score is between 20 and 24.

### 38.7 Audit signing pipeline (ed25519 + JCS + git-ref key registry)

Every audit entry written by the orchestrator is signed (see §30.1 for the mechanism in §30 context):

1. Build the `AuditEntry` record (without the `signature` field).
2. **JCS canonicalize** (RFC 8785) the record using the `json-canon` library (or TS equivalent).
3. **ed25519 sign** the canonical bytes using the private key at `~/.orchestrator/keys/private.key` (libsodium / `tweetnacl` in TS).
4. Set `signature.alg = "ed25519"`, `signature.key_id = first 16 hex of sha256(pubkey)`, `signature.value = base64(rawSignature)`.
5. Write the signed record to the audit log (and optionally to the SIEM sink).
6. **Mirror the public key** to `refs/orchestrator/keys/{key_id}:pub.key` once on key generation; verifiers fetch by key_id with no out-of-band exchange.

Verification: `verifyAuditEntry(entry)` looks up the public key by key_id from the git-ref registry, JCS-canonicalizes the record (without signature), and verifies the ed25519 signature against the canonical bytes. Tampering with any field invalidates the signature; tampering with the signature invalidates verification; tampering with the public key in the registry is detectable via key_id mismatch.

This pipeline is the same one that signs **Agent Trace v0.1.0 JSONL** records (§27.4) so trajectories are tamper-evident under the same trust model.

## 39. Partner Integration Index

Partner repos are external dependencies the orchestrator either calls directly (UIO), embeds as infrastructure (eval-view, agentdiff), or references for patterns (context-fabric, hindsight). P0 partners ship with v6; P1 partners are deferred unless implementation pulls them in.

### P0 partners (ship with v6)

| Partner | Role | v6 sections | Guide |
|---|---|---|---|
| **UIO** | Direct integration partner: document ingestion + multi-vector embedding reuse. Orchestrator's `project_intake_create` calls `uio_ingest`; vectors fetched from UIO's Qdrant by `source_id`. | §9, §10, §15, §19, §22, §25, §27, §35.1 | [`docs/partners/uio.md`](docs/partners/uio.md) |
| **eval-view** | Direct integration partner: §31 testing framework (multi-provider LLM-as-judge, 4-tier verdict, drift tracker, golden baselines, auto-PR, model-drift canary). | §17.2, §31, §35.3 | [`docs/partners/eval-view.md`](docs/partners/eval-view.md) |
| **agentdiff** | Audit-chain signing infrastructure: ed25519 + RFC 8785 JCS canonicalization + git-ref key registry. Replaces planned KMS dependency for v1. | §10 (`AuditEntry`), §20, §27.4, §30.1, §38.7 | [`docs/partners/agentdiff.md`](docs/partners/agentdiff.md) |

### P1 partners (deferred; reference patterns inline)

| Partner | Role | Why deferred | Reference |
|---|---|---|---|
| **context-fabric** | 5-engine context-pack architecture (E1 Capture / E2 Anchor / E3 Router / E4 Governor / E5 Weaver), 22-model context-size table, FTS5 BM25 column weights, InjectionGuard, PathGuard. | Adopted as pattern lift in §16, not as vendored repo. Re-promote to P0 if implementation actually depends on a vendored copy. | findings.md L486–500 |
| **hindsight** | Three-op memory model (retain/recall/reflect), multi-strategy retrieval (semantic + BM25 + graph + temporal + reranking), FastMCP-based. | Persistent memory is a consuming-agent concern, not orchestrator scope (§4). Re-promote if the orchestrator decides to expose memory primitives. | findings.md L1072–1080 |

Add new partners by writing a guide using the 9-section template in `docs/partners/README.md` and appending a row to this table.

## 40. Findings Coverage Table

Auditable mapping from every Tier 1 + Tier 2 finding in `repo-extraction-findings.md` to its v6 destination(s). Status values: **`Integrated`** (in v6 prose), **`Deferred-recorded`** (alternative considered, recorded in §0 conflict resolutions or in an ADR), **`Skipped-with-reason`** (not adopted; reason given). Zero blanks. Zero conflict-pending.

`F-NNN` is the v6 finding ID. `findings.md` line ranges are the canonical source for the rationale.

| ID | Repo | Tier | Summary | findings.md L | v6 destination(s) | Status |
|---|---|---|---|---|---|---|
| F-001 | velocity-code-engine | 2 | MCP contract diff/normalization | 13 | §31 (conformance tests) | Integrated |
| F-002 | velocity-ops-engine | 1 | Anti-stub guardrails (12 patterns) + should-catch/should-pass fixtures | 49–60 | §30.2 layer 1, §31 | Integrated |
| F-003 | velocity-ops-engine | 1 | Enforcement-v2 hooks (real-time pre-write/post-write/pre-bash) | 53 | §30.2 layer 1 | Integrated |
| F-004 | velocity-ops-engine | 1 | `modules/mcp-development.md` + `modules/mcp-governance.md` | 49–53 | §14, §22, §30 (background) | Integrated |
| F-005 | ai-coding-framework | 1 | Six-dimension conformance rubric + banned-patterns semgrep YAML + OWASP LLM checklist | 261–278 | §9 (ADR conventions), §17 (rubric reference), §30.2 layer 2, §31 (conformance), §38.6 | Integrated |
| F-006 | ai-coding-framework | 1 | LF AGENTS.md (Jan 2026) format | 261 | §9 (AGENTS.md conventions) | Integrated |
| F-007 | velocity-ops-engine + ai-coding-framework + PAE | 1 | Confidence-gate JSON + numeric `confidenceScore` | 1229–1230 | §10 (`PolicyDecision`), §17.3 | Integrated |
| F-008 | codebase-memory-mcp | 2 | 11-signal algorithmic embeddings (no LLM) + SQLite int8 + custom `cbm_cosine_i8()` | 454–464 | §25.1 (deferred alt) | Deferred-recorded |
| F-009 | uio | 1 | Langfuse + Prometheus + structlog + DCGM observability stack | 393–409 | §27.1 | Integrated |
| F-010 | uio | 1 | UIO is **the** UIO from plan §35; FastAPI + TypeScript MCP server with `uio_ingest` / `uio_query` / `uio_status` / `uio_catalog` | 393–409 | §35.1, `docs/partners/uio.md` | Integrated |
| F-011 | uio | 1 | MinerU + PaddleOCR-VL + Docling + Pandoc-EPUB + GLM-OCR parser router | 393–409 | §35.1 | Integrated |
| F-012 | uio | 1 | BGE-M3 embedding server (dense 1024 + sparse + BM25 + ColBERT) | 393–409 | §25, §35.1 | Integrated |
| F-013 | uio | 1 | Qdrant 8-collection multi-vector setup with payload indexes | 393–409 | §25 (config) | Integrated |
| F-014 | PAE | 1 | HTTP retry with Retry-After + 425/408 handling | 174–189 | §21 | Integrated |
| F-015 | PAE | 1 | Pluggable provider interface (SerpAPI/Serper) | 174–189 | §19 (modeled on this) | Integrated |
| F-016 | PAE | 2 | Bundled rule-pack JSON corpus pattern (`data/`) | 174–189 | §26.2 (signature corpus) | Integrated |
| F-017 | PAE | 1 | Handlebars renderer + conditional template selector | 174–189 | §29 (prompt templates), M4 | Integrated |
| F-018 | PAE | 1 | `Confidence = "high" | "medium" | "low"` + numeric score | 174–189 | §10, §17.3 | Integrated |
| F-019 | CodingRepos parent | 1 | 20-failure-mode taxonomy (`FRAMEWORK-METHODOLOGY-AND-AUDIT.md`) | 925–932 | §30.4, §34 | Integrated |
| F-020 | velocity-code-engine | 2 | Workflow state-machine + gate types (confidence/approval/quality/manual) | 13–22 | §6, §17 | Integrated |
| F-021 | project-foundation | 1 | Drizzle dual-mode client (PGlite + Postgres) | 106–122 | §3, §9 (storage), §20 (DATABASE_DEV_MODE), M1 | Integrated |
| F-022 | project-foundation | 1 | Drizzle pgTable schemas + migration runner + rehearsal test | 106–122 | §9 (storage policy), M1 | Integrated |
| F-023 | project-foundation | 1 | Rate limiter (sliding-window with bucket pruning) | 106–122 | §21 | Integrated |
| F-024 | project-foundation | 1 | HMAC-SHA256 session token with `timingSafeEqual` | 106–122 | §20 | Integrated |
| F-025 | project-foundation | 1 | RBAC action-vector pattern (`{allowed, code, message}`) | 106–122 | §7.2 (PolicyDecisionLayer interface modeled on this) | Integrated |
| F-026 | project-foundation | 1 | Stripe-style HMAC verification + mocked-fetch tests | 106–122 | §26, M3 | Integrated |
| F-027 | project-foundation | 1 | Idempotent upsert pattern (`ensure-*-tracking.ts`) | 106–122 | §18, M5, M6a | Integrated |
| F-028 | project-foundation | 1 | Pluggable `Transport<T>` interface | 106–122 | §19, §24 (notification adapters), M11 | Integrated |
| F-029 | project-foundation | 1 | Defensive env-parsing helpers (`trimToUndefined`, `readString`, `readNumber`) | 106–122 | §20 (env validation) | Integrated |
| F-030 | project-foundation | 2 | Repository + service + route handler split | 123–131 | §8 (repo structure) | Integrated |
| F-031 | simple-commands-mcp | 1 | `@modelcontextprotocol/sdk@1.17.3` stdio scaffold + Winston file logger ("stdout breaks MCP") | 419–427 | §9, §20.gotchas, §22, M0 | Integrated |
| F-032 | agentic-rag-for-dummies | 1 | Parent-child hierarchical chunking (2000-10000 char parents, 500/100 children) + hybrid Qdrant retrieval + LangGraph-style query decomposition | 410–418 | §16, §25, M4, M7 | Integrated |
| F-033 | mcpd | 1 | MCP aggregator/proxy pattern for mediating upstream MCP servers (Rust, spec 2025-11-25 reference types) | 447–453 | §2 (Rovo mediation), §19 (Rovo provider) | Integrated |
| F-034 | atomic-agents | 2 | Multi-transport MCP client reference (STDIO + SSE + HTTP Stream) with persistent session reuse | 646–658 | §19 (Rovo provider design), §22 (client-side transport) | Integrated |
| F-040 | mcp_daemon | 2 | Multi-transport `Transport` trait abstraction (stdio + WS + HTTP/2 + SSE + InMemory) | 428–438 | §22 (architecture reference) | Integrated |
| F-041 | context-fabric | 1 | E4 Governor: 22-model context-size table + pre-calculated token estimates | 486–500 | §16.1 | Integrated |
| F-042 | context-fabric | 1 | E3 Router: SQLite FTS5 BM25 with column weights (path 2.0 / summary 1.5 / outline 1.2 / exports 1.0) | 486–500 | §16.3 | Integrated |
| F-043 | context-fabric | 1 | InjectionGuard + PathGuard | 486–500 | §16.5, §8 (`security/`) | Integrated |
| F-044 | context-fabric | 1 | E2 Anchor SHA256-based drift detection | 486–500 | §6.3 (drift triggers reference) | Integrated |
| F-045 | context-fabric | 1 | E5 Weaver structured markdown briefing | 486–500 | §16 (context pack format) | Integrated |
| F-046 | eval-view | 1 | 4-tier verdict + multi-provider LLM-as-judge + drift tracker + golden baselines + auto-PR + model-drift canary | 543–558 | §17.2, §31.1, §35.3, `docs/partners/eval-view.md` | Integrated |
| F-051 | indxr | 1 | Streamable HTTP transport architecture (axum + tokio + SSE + 1h sliding TTL + 1000 concurrent) | 501–513 | §22.1, M0 | Integrated |
| F-052 | indxr | 1 | 5-step progressive truncation (doc comments → private decls → children → leaf files → final) | 501–513 | §16.2 | Integrated |
| F-053 | mengram | 2 | Proactive resource pinning (`memory://profile` auto-load) | 514–522 | §2 (`orchestrator://session/current/preflight`), §14 | Integrated |
| F-060 | agent-maestro | 1 | 4-mode agent classification (worker / coordinator / coordinated-worker / coordinated-coordinator) | 586–597 | §10, §14.1 | Integrated |
| F-061 | agent-maestro | 1 | 4 workflow strategies (simple / queue / tree / intelligent-batching / DAG with topological waves) | 586–597 | §6.2, §24.1 | Integrated |
| F-063 | agent-maestro | 1 | Manifest-driven agent spawning | 586–597 | §14.3 | Integrated |
| F-064 | agent-maestro | 1 | Per-session git worktrees on `orchestrator/{sessionId}` | 586–597 | §13, §19 (VcsProvider), §24.5, M3, M6c | Integrated |
| F-065 | agent-maestro | 2 | WebSocket batching (50ms) + per-entity throttling + 1MB backpressure | 586–597 | §22.1 | Integrated |
| F-067 | ATLAS | 2 | Grammar-constrained JSON via GBNF | 523–529 | §23.2 | Integrated |
| F-072 | open-multi-agent | 1 | Approval-gate callback signature with skip-cascade | 598–613 | §7.2 (PolicyDecisionLayer), §24.3 | Integrated |
| F-073 | open-multi-agent | 1 | 4 scheduler strategies (round-robin / least-busy / capability-match / dependency-first) | 598–613 | §24.2 | Integrated |
| F-074 | plano | 2 | 17-LLM-provider abstraction reference | 536–542 | §23.3 (reference) | Integrated |
| F-076 | project-foundation-workbench | 1 | PHASE-STATE.json with lockable checkpoints + `/resume` | 848–863 | §6.1 | Integrated |
| F-077 | project-foundation-workbench | 1 | 5-category test framework (UT / IT / ST / PT / E2E) with auditable Not-Applicable | 848–863 | §17.4, §31 | Integrated |
| F-078 | project-foundation-workbench | 1 | 14 slash commands (/inception, /decompose, /groom, /wave, /implement, /review, /sync, /drift-check, /sync-configs, /run-wave, /resume, /build, /build-continue) | 848–863 | M5 (planner uses these) | Integrated |
| F-082 | project-foundation-workbench | 1 | Unidirectional sync architecture (`SYNC.md`) | 848–863 | §5, §35.5 | Integrated |
| F-083 | claude-workflow-v2 | 1 | Single-message Task-call constraint for parallelism | 750–763 | §24.6, `docs/claude-code.md` (when emitted) | Integrated |
| F-084 | claude-workflow-v2 | 1 | Adversarial verification triplet (false-positive filter + missing-issues finder + context validator) | 750–763 | §18.1 | Integrated |
| F-085 | project-foundation-workbench | 1 | `scripts/syncAgentConfigs.ts` regenerates Cursor / Codex / Copilot configs from canonical AGENTS.md | 848–863 | §8, §9 (AGENTS.md conventions), M9 | Integrated |
| F-086 | project-foundation-workbench | 1 | Context source hierarchy (project files > stack refs > Context7 > training) | 848–863 | §35.4 (8 strategies expanded), `docs/codex.md` + `docs/claude-code.md` | Integrated |
| F-090 | claude-code-log-analyzer | 1 | 6-observability-enum taxonomy (autonomy / intent / decision / error_class / gate_type / severity) | 789–805 | §27.5, §30.4 (error_class half) | Integrated |
| F-091 | Caliber + claude-code-production-grade-plugin | 1 | Caliber 6-category scoring (existence/quality/grounding/accuracy/freshness/bonus → A/B/C/D) **AND** 4 shared protocols (ux / input-validation / tool-efficiency / conflict-resolution) | 864–878, 737–749 | §17.1, §38.3 | Integrated |
| F-092 | claude-code-production-grade-plugin | 1 | 4 engagement modes (Express / Standard / Thorough / Meticulous) | 737–749 | §38.3 (referenced via shared protocols) | Integrated |
| F-093 | claude_agent_teams_ui + Caliber | 1 | 6-category token tracking (claudeMd / mentionedFile / toolOutput / thinkingText / teamCoordination / userMessage) **AND** seat-based vs API-key provider distinction | 773–788, 864–878 | §10 (`TokenBudgetReport`), §16.1, §23.1 | Integrated |
| F-094 | claude_agent_teams_ui | 1 | Post-compact context recovery (re-inject orchestrator-managed metadata on compaction) | 773–788 | §6.3 (DRIFT_DETECTED triggers) | Integrated |
| F-095 | claude_agent_teams_ui | 1 | Action-mode capability injection (read-only / approve-each-tool) | 773–788 | §7.2 (PolicyObligation), §38.3 | Integrated |
| F-096 | claude_agent_teams_ui | 1 | WebSocket batching (50ms) + 1MB backpressure | 773–788 | §22.1 | Integrated |
| F-097 | claude_agent_teams_ui | 1 | SSE 30s keep-alive + no-polling pattern | 773–788 | §14, §22.1, M10 | Integrated |
| F-098 | claude_agent_teams_ui | 1 | Hunk-level review with `node-diff3` merge3 + deterministic message IDs (`sha256(from + timestamp + text)`) | 773–788 | §18.3, §26.1, M6c | Integrated |
| F-101 | agentic-coding-handbook | 1 | 8 context strategies (incl. MCPs as #4) | 894–906 | §3, §35.4 | Integrated |
| F-103 | agentic-coding-handbook | 2 | Memory Bank pattern + `@alioshr/memory-bank-mcp` reference | 894–906 | §16.6 (out-of-v1 reference) | Integrated |
| F-105 | superpowers | 1 | Skill-first protocol with 1% threshold | 879–893 | §14.2 | Integrated |
| F-106 | superpowers | 1 | Iron laws (no completion claims without verification; no production code without failing test first) | 879–893 | §14.2, §29.1, §38.5 | Integrated |
| F-107 | superpowers | 1 | Two-stage review gate (spec compliance → code quality) | 879–893 | §14.4 | Integrated |
| F-108 | superpowers | 2 | Hook-based skill injection (SessionStart) + token usage analysis (per-subagent JSONL parsing) | 879–893 | `docs/claude-code.md` (when emitted), §27 (counters) | Integrated |
| F-110 | claude-agent-builder | 1 | 6-phase agent generation workflow + 7-pattern library | 764–772 | §14.3, §29.2, M9 | Integrated |
| F-113 | three-man-team | 1 | Persona vocabulary routing | 668–678 | §29 (prompt convention) | Integrated |
| F-114 | three-man-team | 1 | File-based handoff (BRIEF / REQUEST / FEEDBACK) | 668–678 | §18.2 | Integrated |
| F-115 | three-man-team | 1 | Deploy-gate accountability (summarize → tell PO → PO approves → commit → log → checkpoint) | 668–678 | §18.4 | Integrated |
| F-117 | agentdiff | 1 | ed25519 + RFC 8785 JCS canonicalization + git-ref key registry (`refs/agentdiff/keys/{key_id}:pub.key`) | 614–632 | §10 (`AuditEntry`), §20, §30.1, §38.7, `docs/partners/agentdiff.md` | Integrated |
| F-118 | agentdiff | 1 | Agent Trace v0.1.0 JSONL spec | 614–632 | §27.4 | Integrated |
| F-119 | thinking-partner | 1 | GT0–GT5 orientation detection + 7 cognitive operation pairs + 150+ mental models | 907–924 | §29.3 | Integrated |
| F-121 | agents.md | 1 | Canonical AGENTS.md spec sections (Dev environment tips / Testing / PR / Coding conventions) | 1017–1019 | §9 (AGENTS.md conventions) | Integrated |
| F-122 | madr | 1 | MADR template structure (`NNNN-decision-title.md` + frontmatter + Consequences Good/Bad/Neutral) | 1026–1030 | §8, §9 (ADR conventions) | Integrated |
| F-123 | adr.github.io | 1 | START Criteria + DoD 5-element checklist for ADR governance | 1020–1025 | §9 (ADR conventions) | Integrated |
| F-126 | open-edison | 1 | Lethal trifecta + PUBLIC/PRIVATE/SECRET ACL ranking + wildcard permission JSON | 633–645 | §38.1, §38.2, §10 (`AclEntry.classification`) | Integrated |
| F-127 | awesome-agentic-patterns | 1 | 167-pattern catalog incl. context-window-auto-compaction, budget-aware routing with hard cost caps, declarative YAML topology, layered configuration context | 1031–1039 | §16.7 | Integrated |
| F-128 | open-edison | 1 | OTel counters template (tool_calls_total / tool_calls_blocked_total / private_data_access / untrusted_public_data / write_operation) | 633–645 | §27.2 | Integrated |
| F-129 | open-edison | 1 | Install-unique deaggregation ID + opt-out telemetry | 633–645 | §27.3 | Integrated |
| F-130 | open-edison | 1 | Dual-port architecture (MCP 3000 / mgmt API 3001) | 633–645 | §22.2 | Integrated |
| F-141 | Citadel | 1 | Fleet pattern: discovery-brief compression (~500 tokens) | 1060–1071 | §24.4, §38.4 | Integrated |
| F-142 | Citadel | 1 | Claim-based scope coordination (`.planning/coordination/claims/`); 5-section skill format (Identity / Orientation / Protocol / Quality Gates / Exit) | 1060–1071 | §17.6, §24.4, §38.4 | Integrated |
| F-145 | hindsight | 2 | Three-op memory model (retain/recall/reflect) + multi-strategy retrieval | 1072–1080 | §25.2 (deferred reference) | Deferred-recorded |
| F-146 | gstack | 2 | Persistent Bun + Chromium daemon (~100ms vs 3-5s cold) for stateful browser sessions | 1081–1087 | §28 M11 (reference; v6 does not currently need browser automation) | Skipped-with-reason |
| F-148 | grain | 1 | Anti-slop linter for AI-generated code patterns (obvious comments, vague TODOs, hedge words, restated docstrings) | 1103–1108 | §30.2 layer 3, §31.2 (TS port) | Integrated |
| F-149 | vibe-tuning | 1 | CATCH→DIAGNOSE→ROOT CAUSE→FIX→SAVE→ENFORCE postmortem + failure-mode taxonomy + fix-type taxonomy | 1010–1014 | §30.3, §30.4, §30.5 | Integrated |
| F-150 | claude-sessions | 2 | Incremental Haiku-based summarization + HTML-comment-delimited markdown checkpoints + stale-session auto-finalization | 806–815 | §6.1 (checkpoint pattern reference) | Integrated |
| F-151 | full-stack-fastapi-template | 2 | OpenAPI codegen via `hey-api/openapi-ts` | 980 | §8 (`scripts/`), `docs/operations.md` (optional REST API for admin) | Skipped-with-reason |
| F-152 | full-stack-fastapi-template | 2 | Sentry conditional init by environment **AND** Traefik dynamic discovery + constraint labels | 980 | §22.3 (Traefik), §27.1 (Sentry) | Integrated |
| F-201 | uio | 2 | UIO compliance gate (similarity / blending / verbatim / adjacency / rate-limit / license-class) — adopt as access-gate baseline shape | 393–409 | §7.1 (referenced in lethal trifecta + ACL composition) | Integrated |
| F-202 | uio | 1 | PgBouncer transaction-mode requirement: `statement_cache_size=0` | 1281 | §20.gotchas | Integrated |
| F-203 | everything-claude-code | 1 | `.claude-plugin/plugin.json` MUST NOT declare hooks (Claude v2.1+ auto-loads `hooks/hooks.json`) | 1284 | §20.gotchas, §29 prompt 13 (when emitting Claude Code plugin) | Integrated |
| F-204 | claude-code-best-practice | 1 | Only 6 of 27 Claude Code hook events fire in agent contexts | 1285 | §20.gotchas, `docs/claude-code.md` (when emitted) | Integrated |
| F-205 | three-man-team | 1 | Foreground-only Agent-tool subagents in Claude Code | 1286 | §20.gotchas, `docs/claude-code.md` | Integrated |
| F-206 | uio | 1 | BGE-M3 sparse-format conversion: Qdrant wants `{idx: val}`, FlagEmbedding returns `{indices, values}` | 1282 | §20.gotchas, `docs/partners/uio.md` §7 | Integrated |
| F-207 | project-foundation-workbench | 1 | Large-file handling: never >200 lines all-at-once; offset+limit | 1287 | §20.gotchas, agent operating rule | Integrated |
| F-300 | (consolidated alternatives) | — | Hatchet (uio queue) considered as alternative to BullMQ for §24 | 1306–1310 | §24.7 (deferred), `docs/adr/0002-bullmq-default-hatchet-considered.md` | Deferred-recorded |
| F-301 | (consolidated alternatives) | — | KMS / Vault / AWS Secrets Manager considered as alternatives to git-ref key registry for §30 | n/a | §30.1 (KMS optional post-v1), `docs/adr/0004-agentdiff-key-registry-replaces-kms-v1.md` | Deferred-recorded |
| F-302 | (consolidated alternatives) | — | Algorithmic 11-signal embeddings (codebase-memory-mcp) considered as alternative to BGE-M3 for §25 | 1153–1158 | §25.1 (deferred), `docs/adr/0003-qdrant-bge-m3-default-algorithmic-considered.md` | Deferred-recorded |
| F-303 | (consolidated alternatives) | — | Persistent agent memory (hindsight, mengram, Memory Bank) considered for v1 inclusion | 1153–1158 | §4, §25.2, ADR 0007 | Project-scoped subset promoted; cross-project memory remains deferred |
| F-400 | (skipped) | — | Skipped repos summarized in §41 (templates, vibe-coding, awesome lists, philosophical research, etc.) | various | §41 | Skipped-with-reason |

Coverage check: every refinement-cluster entry in `repo-extraction-findings.md` lines 1180–1289 maps to either a §0 numbered material change (1–16) or a §40 row above (`Integrated` / `Deferred-recorded`). Every Tier 1 repo has at least one `Integrated` row.

## 41. Skipped/Low-yield Repo Appendix

One-line per repo from `repo-extraction-findings.md` that did not yield Tier 1 or Tier 2 patterns. Kept here so the survey's negative findings are not lost.

**Batch 1 skips:**
- `Daemon` — Daniel Miessler personal-profile static site (Astro + React on Cloudflare Workers); actual MCP backend not in this repo.

**Batch 2 skips:**
- `ATLAS` — standalone Go+Python local coding assistant (NOT Atlassian-related); useful patterns (GBNF, tier classification, permission glob defaults) lifted into v6 §23.2 + §29.3 + §30; the harness itself is out of scope.
- `statespace` — Rust CLI for Markdown data apps (NOT a state-machine framework as the name suggests).
- `plano` — Rust/WASM Envoy LLM router (NOT a project planner); 17-LLM-provider abstraction referenced in §23.3.

**Batch 3 skips:**
- `autoresearch` — Python autonomous LLM-training framework (5-min training loops); orthogonal to MCP scope.

**Batch 6 skips (app templates):**
- `ai_app_template` — generic FastAPI + Ollama + Neo4j chatbot.
- `full-stack-ai-agent-template` — Python FastAPI cookiecutter with PydanticAI; Logfire pattern noted but Python-only.
- `mckays-app-template` — Mckay Wrigley canonical Next.js + Supabase + Drizzle + Clerk + Stripe (no novel patterns vs project-foundation).
- `project-template` — Josee9988 generic GitHub scaffolding.
- `python-project-template` — generic Copier Python boilerplate.
- `cookiecutter-data-science` — DrivenData ML scaffolder.
- `generative_ai_project` — empty 1-byte placeholder skeleton.

**Batch 7 skips (vibe templates + misc):**
- `vibe_coding_template` — markdown context templates only.
- `vibe-coding-template` — generic NextJS+FastAPI+Supabase boilerplate.
- `cursor-vibe-coding-template` — Cursor MCP workflow template.
- `vibesdk-templates` — Cloudflare Workers template generator.
- `devvit-template-vibe-coding` — Reddit Devvit platform starter.
- `design-ai` — 33 UI design system markdown files.
- `openai` (Archive) — corrupted/abandoned Azure-Samples/openai shallow clone.

**Batch 8 skips:**
- `MasteringAgenticAISystems_supplementals` — NVIDIA Agentic AI Certification course supplementals; comprehensive but synthesizes patterns already covered.
- `guides_4_AIagents` — cybersecurity policy + AI governance research guides.
- `ai-consciousness-research` — pure philosophical research.
- `awesome-agent-clis` — 32-CLI inventory; standard agent-CLI flag conventions (`--json` / `--no-interactive` / `--auto-confirm` / `--format`) noted as a soft adoption for any future orchestrator CLI.

**Batch 9 skips:**
- `WFGY` — philosophical reasoning text artifact.
- `prediction-terminal` — sports prediction ML platform.
- `ouroboros` — explorer returned a description of v5 itself; repo content closely mirrors the plan or is empty.
- `gstack` — Garry Tan's Claude Code "software factory"; persistent-Bun-Chromium-daemon pattern noted in §40 F-146 but not adopted (v6 has no need for browser automation).
- `zeroshot` — multi-agent CLI; SQLite ledger + planner→implementer→validators loop noted as alternative reference; not adopted (v6 stays on BullMQ).
- `get-shit-done` (×2 clones) — task orchestration framework refinement of SpecKit/BMAD; `/plan-phase → /execute-phase → /verify-work` workflow discipline noted as inspiration for §28 milestone wording.

**Original survey skips** (5-repo originals already documented in findings.md L9–L308):
- `velocity-code-engine` — bash-heavy workflow framework with no implementation; MCP contract diff (F-001) is the one Tier 1 lift.
- `Archive/ai-coding-framework` — same v1.5.0 as live + Velocity Ops Engine wrapping; SDLC documentation taxonomy reference only.
- `perplexity-super-skills` — README-only hub (skill code in external repos).
- `CodingRepos` parent meta-repo — research synthesis docs only; FRAMEWORK-METHODOLOGY-AND-AUDIT.md (F-019) is the one Tier 1 reference.
