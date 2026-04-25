# Repo Extraction Findings — Agent Context Orchestrator MCP Plan v5

Rolling notes from evaluating local repos for anything reusable against the plan in `agent-context-orchestrator-mcp-plan-v5.md`.

Plan summary (for cross-reference): TypeScript/Node 22 MCP server orchestrating Atlassian (Jira + Confluence) and VCS (Bitbucket Cloud MVP, GitHub/GitLab planned) provisioning. Dual transport (stdio + Streamable HTTP), session capability registry, tenant-scoped storage (SQLite/Postgres + drizzle), BullMQ, Qdrant + BGE-M3, code-based Policy Decision Layer, write guards, access-control gate, envelope-encrypted token store, hash-chained audit log, actor attribution, preflight discovery, webhook ingest with signature verification + delivery dedup, context packs with token budgeting and hybrid ranking, gitleaks redaction, prompt-injection scanning, Langfuse + OTel, optional Rovo MCP read-only upstream provider, UIO integration for document extraction.

---

## Repo 1: `C:\Users\Chris\Documents\git\velocity-code-engine`

**Verdict:** Workflow-orchestration / agent-instruction framework. ~20% direct lift, ~30% architectural inspiration, ~50% N/A. No Atlassian/VCS/DB/queue/vector implementation code.

### Worth lifting (Tier 1 — direct)

1. **MCP contract diff/normalization** — `runtime/lib/mcp-contract.mjs` (`normalizeMcpContract()`, `compareContracts()` for tools-removed / inputs-changed / required-added). Maps onto Section 31 conformance tests for tool-schema breakage.
2. **Workflow state machine + gate types** — `runtime/control-plane.mjs` defines feature-flow / bugfix-flow / deploy-flow / multi-agent-flow with confidence/approval/quality/manual gates and scope-signature drift detection. Maps onto Section 6 state machine and Section 18 preview/approve/execute loop.
3. **Context scoring dimensions** — `templates/ai/context-score.json` (Existence / Quality / Grounding / Freshness / Token budget / Cross-platform parity). Informs Section 17 readiness rubric and ContextPack freshness.
4. **Session continuity artifacts** — `.ai/active-context.md`, `.ai/session-log.md`, `.ai/findings.md`. Patterns for session capability registry + drift tracking.
5. **Agent persona/skill definitions** — `skills/code-review/SKILL.md`, `agents/*.md` with CRITICAL/HIGH/MEDIUM/LOW severity. Model for handoff prompts and readiness reviewer.
6. **Multi-agent wave relay** — parallel-then-dependent coordination from AGENTS.md. Useful if M6a/M6b/M6c run concurrent sub-flows.
7. **Markdown artifact validators** — `runtime/control-plane.mjs:127-192` parses `**Field:** value`, detects `TBD`/`TODO`/`[...]`. Good for preflight reports and handoff documents.
8. **Drizzle ORM module** — `modules/drizzle-orm.md` is reference-quality even though not used in-repo.

### Worth lifting (Tier 2 — adapt)

- File-backed state + scope-signature idempotency (`runtime/lib/utils.mjs`, `approval.mjs`).
- Gate lifecycle hooks (`quality/guardrails/gate-*.sh`) — pre-edit / post-edit / pre-commit / stop. Adapt to provisioning hooks.
- Bootstrap/adopt patterns (`scripts/bootstrap.sh`, `adopt.sh`) — informs tenant onboarding flow.

### Skip / traps

- Heavy bash scripting (~70%) — port any critical paths to TypeScript instead.
- File-based `.ai/` state doesn't scale to tenant concurrency — switch to SQLite/Postgres + BullMQ early.
- 13-agent persona framework is overkill for headless orchestration — pick 3–4.
- "Framework adoption" model assumes downstream projects; you're a library.
- MCP contract management here is snapshot-based, not live introspection.
- Research docs reference 32+ external cloned repos not present in this tree.

### Not present

Atlassian REST clients, Jira/Confluence/Bitbucket providers, ADF/storage renderers, Drizzle schemas, BullMQ, Qdrant, envelope-encrypted token store, webhook signature verification, access-control gate, policy decision layer, prompt-injection scanning, Langfuse/OTel wiring, MCP transports, MinerU/UIO integration.

---

## Repo 2: `C:\Users\Chris\Documents\git\velocity-ops-engine`

**Verdict:** Governance / ops / documentation framework for a consulting business. Higher value than velocity-code-engine because of two production-grade MCP-specific modules and stronger guidance — but still no Atlassian/VCS/Drizzle/BullMQ/Qdrant code.

### Worth lifting (Tier 1 — direct)

1. **`modules/mcp-development.md`** — full MCP server development guide. 18 rules covering Zod tool schemas, descriptive tool definitions, MCP-protocol vs tool-execution error handling, resource URI templates, multi-tenant DB via PostgreSQL `SET LOCAL` RLS, token caching with short TTL, env-var validation at startup (fail-fast), InMemoryTransport pair tests, conformance checks, absolute paths in `~/.claude/settings.json`, **stderr-only logging in stdio servers** (stdout corrupts protocol). Maps onto Section 14 (MCP surface) and Section 31 (testing).
2. **`modules/mcp-governance.md`** — 6 rules: allowlist with provenance + version pinning (no floating tags / exact digests), per-role RBAC, audit log JSON schema (timestamp / agent_id / agent_role / server_name / tool_name / input_sha256 / status / duration_ms / request_id — **never raw inputs or sensitive outputs**), trust-evaluation checklist for upstream providers, gateway-first architecture for multi-agent. Maps directly onto Section 19 (Rovo allowlist), Section 20 (auth), Section 30 (security + audit chain).
3. **`quality/enforcement-v2/` scripts** — real-time hooks: `pre-write-check.sh`, `pre-bash-check.sh`, `verify-before-done.sh`, `compression-detector.sh` (rolling baseline; warns when output drops <30% of session avg), `error-halt.sh`, `session-start.sh`, `pre-write-voice-check.sh`. Adopt as pre-commit + pre-write-guard hooks; supersedes v1.
4. **Anti-stub guardrails checklist (v1 scanner, kept as catalog)** — 12 patterns: `STUB_NOT_IMPLEMENTED`, `TYPE_AS_ANY`, `TYPE_DOUBLE_ASSERT`, `TYPE_TS_IGNORE`, `MODULE_REQUIRE`, `SECURITY_HARDCODED_SECRET`, `SECURITY_SQL_INJECTION`, `STUB_TRUNCATION`, `STUB_ELLIPSIS`, `STUB_EMPTY_CATCH`, `STUB_CATCH_TODO`, `STUB_INLINE_MARKER`. Should-catch / should-pass dual-fixture test pattern is directly applicable to contract tests.
5. **`runtime/control-plane.mjs`** — file-backed workflow state machine with gates (confidence → approval → execution → quality → handoff), resume/interrupt, JSON state. Pattern (not code) maps onto Section 6 + Section 24; you'll back it with BullMQ for real.
6. **CLAUDE.md / AGENTS.md structure** — read-first absolute rules, build/test/lint specificity (require actual output), staged-approval protocol for shared files (package.json, tsconfig, env.ts, schemas, auth), worktree+wave multi-agent coordination, branch naming `ai/[agent-id]/[task-slug]`, file protection metadata (`.donttouch_files.json`, `.redacted_files.json`, `.important_files.json`), self-verification (read-last for recency bias). Directly adoptable for the repo's CLAUDE.md/AGENTS.md.
7. **`docs/reference-synthesis.md`** — 40+ research briefs with stats. Pattern (not content) is the takeaway: build the equivalent for Jira REST evolution, Confluence ADF/storage compatibility, Bitbucket webhook quirks — feeds preflight warnings (Section 9) and risk register (Section 34).
8. **Confidence-gate artifact** (`.ai/confidence-check.json`) — JSON checklist `{ check: { checked: bool, confidence: 0–100 } }`. Adoptable as the readiness rubric output format (Section 17).

### Worth lifting (Tier 2 — adapt)

- Multi-tenant RLS via `SET LOCAL` (postgres-only — for SQLite, enforce in app layer).
- Audit log structure (sha256 of inputs, status only).
- Bootstrap/provision/adopt scripts as a model for tenant onboarding (`scripts/bootstrap.sh`, `provision-managed-mcp.sh`, `configure-daem0nmcp.sh`, `install-hooks.sh`).
- Trust review template applied to Rovo, Bitbucket webhook API, Qdrant — store in `tools/trust-reviews/[provider].md`.
- Worktree+wave model for parallel provider implementation if M6a/M6b/M6c overlap.
- Knowledge-base platform integration guides (`engine/knowledge-base/platforms/daem0nmcp.md`, `context7.md`, `mcpjungle.md`) as model for Rovo upstream provider docs.

### Skip / traps

- Guardrails v1 is on-demand CLI only — use v2 hooks for real enforcement.
- File-backed runtime doesn't scale to multi-instance.
- RLS pattern assumes Postgres only (SQLite needs app-layer enforcement).
- `pnpm test` invokes `bash scripts/framework-smoke-test.sh`, not Vitest directly.
- Compression detector is heuristic — meant to warn, not block.
- ESM-only (`"type": "module"`); CJS `require()` will fail guardrails.
- `.daem0nmcp/storage/qdrant/meta.json` is metadata only — Qdrant not actually deployed here.
- 11-agent roster is consulting-specific — trim to MCP needs.

### Not present

Same gaps as repo 1: no Jira/Confluence/Bitbucket REST clients, no ADF/storage renderers, no Drizzle schemas, no envelope encryption, no BullMQ, no Qdrant client, no webhook-signature verification code, no Langfuse/OTel wiring, no Dockerfile, no domain types matching ProjectBlueprint / ProjectProfile / ContextPack / TraceLink / AclEntry / McpSessionProfile / PolicyDecision, no MinerU/UIO.

### Net new vs velocity-code-engine

Two production-grade modules (`mcp-development.md`, `mcp-governance.md`) are the highest-leverage items found across either repo so far. Research synthesis pattern is also unique.

---

## Cross-cutting observations so far

- Both repos are governance/instruction frameworks, not implementation. Building blocks (REST clients, drizzle schemas, queue, vector, encryption, OTel) still need to come from elsewhere or be written.
- Both contribute strong **process** patterns (gates, approval, guardrails, worktree/wave, severity taxonomy, audit shape) that transplant well into the Section 18 write-safety loop, Section 30 security, Section 31 testing strategy.
- Drizzle is documented but never used; pattern guidance only.
- MCP-specific patterns concentrate in velocity-ops-engine (`modules/mcp-development.md`, `modules/mcp-governance.md`).
- Anti-stub checklist + should-catch/should-pass fixtures from velocity-ops-engine should become a CI gate for the new repo from Milestone 0.

---

## Repo 3: `C:\Users\Chris\Documents\git\project-foundation`

**Verdict:** First repo with **actual TypeScript implementation code**. Consulting-site monorepo (apps/api, apps/web, packages/shared) plus reusable governance scaffolding. ~25–30% direct transplant, ~40–50% adapt, ~20–30% custom build still required (Atlassian/VCS/embeddings/queue/encryption are absent).

Stack: pnpm@10.6.2 workspaces, TS 5.9.3 strict + `--noEmit`, Node `--experimental-strip-types` (no bundler), Biome (lint/format), `node:test` + `node:assert/strict` (not Vitest), Drizzle, PGlite/Postgres dual-mode, Resend, Stripe, OpenProject, Clerk backend.

### Worth lifting (Tier 1 — direct, copy-paste ready)

1. **Drizzle dual-mode client** — `apps/api/src/db/client.ts` (102 lines). Detects `postgres://` vs `postgresql://` and falls back to PGlite (`:memory:` or file-backed). Lazy singleton + migration runner + close hook. **Maps directly onto Section 9 storage policy** (SQLite/Postgres dual support — but PGlite swaps in for SQLite).
2. **Drizzle pgTable schema patterns** — `apps/api/src/db/schema.ts` (241 lines). Foreign keys with cascades, JSONB for milestones/metadata, indexes, uniqueness constraints, idempotency keys table, webhook events table. Adapt for ProjectBlueprint / ProjectGraph / TraceLink / AclEntry / SourcePin / AuditEntry / WebhookDelivery.
3. **Migration runner** — `apps/api/src/db/migrate.ts` (~150 lines). Reads .sql files sequentially, schema version table, abstracts `query()` (Postgres) vs `exec()` (PGlite). Direct copy.
4. **Rate limiter** — `apps/api/src/security/rate-limiter.ts` (105 lines). Sliding-window buckets, expired-window pruning, max-bucket cap to prevent memory leak, returns `{allowed, remaining, retryAfterSeconds}`. Production quality. Reuse for MCP tool rate limits + per-workflow request budgeting (Section 21).
5. **HMAC-SHA256 stateless session token** — `packages/shared/src/portal-session.ts` + `apps/api/src/auth/session-token.ts` (117 lines). Payload + `timingSafeEqual()` signature + expiry. Adapt for MCP session identity (not for Atlassian token storage — that needs envelope encryption per plan).
6. **RBAC action-vector pattern** — `apps/api/src/auth/roles.ts` (86 lines). Actions as union type, returns `{allowed, code, message}`, MFA required for internal users, client isolation by `clientId`. Direct model for Section 7 PolicyDecisionLayer interface (`allow | deny | require_approval` + reasons + obligations).
7. **In-memory observability store** — `apps/api/src/observability/store.ts` (234 lines). Counter store with `snapshot()` + computed error rates. Categories: lead intake / proposal follow-ups / Stripe webhooks / auth failures. Extend with OTel spans for Section 27.
8. **HTTP server patterns** — `apps/api/src/http-server.ts` (737 lines). Bare-metal stdlib `createServer`, regex routing, JSON parsing with size limits, request ID via `randomUUID`, structured stdout JSON logging, security headers (CSP/HSTS/X-Frame-Options/COOP/CORP/Permissions-Policy/Referrer-Policy). Patterns lift to Streamable HTTP transport handler + webhook ingress.
9. **Defensive env parsing helpers** — scattered across `openproject/`, `billing/stripe-checkout.ts`, `notifications/email.ts`. `trimToUndefined()`, `readString()`, `readNumber()` family. Drop into shared utils for Section 20 env validation.
10. **Idempotent upsert pattern** — `apps/api/src/openproject/ensure-lead-tracking.ts` and `ensure-proposal-tracking.ts`. "Check existing FK ref → create if missing → store ID back on parent." Direct model for Section 12 Jira issue + Section 13 VCS PR idempotency.
11. **Pluggable transport interface** — `apps/api/src/jobs/proposal-followups.ts`. `Transport<T>` with webhook + log impls. Generalizes to MCP stdio + Streamable HTTP duality (Section 22) and to NotificationProvider Slack/Teams adapters (Section 19).
12. **Stripe webhook signature verification** — `apps/api/src/billing/` + tests. Mocked-fetch test pattern for HMAC-signed webhook payloads. Adapt to Atlassian webhook secret + Bitbucket Cloud `X-Hook-UUID` (Section 26).
13. **Test structure** — per-module `*.test.ts` with `node:test` + `node:assert/strict`, inline factory helpers, mocked-fetch for third-party clients. Plan calls for Vitest, but pattern transfers.
14. **Migration rehearsal test** — `apps/api/src/db/rehearsal.test.ts`. Tests migrations in isolation — verifies the schema evolves correctly. Direct copy for Milestone 1 acceptance.

### Worth lifting (Tier 2 — adapt)

- **Repository + service + route handler split** — leads, proposals, billing all follow this. Thin handler dispatches to domain layer; business logic never touches HTTP. Maps onto MCP tool handlers → workflow → domain.
- **Lead pipeline state machine** — `apps/api/src/leads/stage-machine.ts`. Allowed transitions, validation, side effects, history table. Model for Section 6 ProjectState transitions.
- **Feature spec template** — `specifications/features/CONS-###.{md,acceptance.md,asvs.md,deps.md,testplan.md,trace.md}`. Six-doc-per-feature structure. Adopt for plan's milestone specifications.
- **Governance hierarchy** — `agent-directives/` (canonical AGENTS.md + CLAUDE.md + CODEX.md variants), `standards/` (DEVELOPMENT_PROTOCOL, API_STANDARDS, GIT_BRANCHING, QUALITY), `guardrails/` (SECURITY, TESTING_CHECKLIST, threat model), `specifications/`, `technical-reference/` (TECH_STACK_STANDARD, ARCHITECTURE), `STACK-TRANSLATION-MAP.md`. Stronger than the prior two repos because it's tied to working code.
- **Document relationship graph** in `FOUNDATION-README.md` (mermaid). Adopt for the new repo's architecture overview.
- **Manifest pattern** — `MANIFEST.md` complete file inventory + classification. Useful for a complex monorepo to keep accurate.

### Skip / traps

- **OpenProject ≠ Atlassian.** No Jira REST, no Confluence REST, no ADF, no storage format, no create-meta, no Rovo, no OAuth 3LO. Pattern (env-driven REST client + idempotent upsert) transfers; the actual API surface is different.
- **No VCS at all** — no Bitbucket, GitHub, GitLab, no commit signing, no Git webhooks. Stripe webhook verification is the closest model.
- **No BullMQ.** Job runner is a polling-loop dispatcher with no retry / DLQ / backoff / dedup. Plan's Section 24 needs real BullMQ.
- **No vector store, no embeddings, no Qdrant.**
- **No Docker, no docker-compose, no healthcheck endpoints, no env schema validation at startup.** Plan calls for all of these.
- **No envelope encryption** — session tokens are HMAC-signed but payloads are plaintext. Plan's Section 9 encrypted token store still needs to be built (libsodium secretbox or KMS data-key envelope).
- **No tamper-evident audit log.** Portal finding history exists but no hash chain.
- **No policy decision engine.** RBAC is a function returning a tuple — not the obligation-bearing PolicyDecisionLayer the plan describes (Section 7).
- **No write guards, access gate, redaction (gitleaks), or prompt-injection scanner.**
- **No Langfuse, no OTel, no pino.** Logging is stdout JSON only.
- **No MCP code anywhere.** SDK absent. Tool/resource/prompt registration absent. No transport layer for MCP. Stdio + Streamable HTTP need to be built from scratch on top of the HTTP-server patterns.
- **`node:test` not Vitest.** Plan specifies Vitest. Patterns transfer; runner does not.
- **No bundler.** Uses `--experimental-strip-types`. Acceptable for backend; flag for production hardening.
- **`pnpm@10.6.2`** specified — pin matches plan's pnpm posture.
- **Domain mismatch.** Consulting portal entities (leads, proposals, invoices, portal findings) do not overlap with plan domain entities. Steal the *type discipline*, not the types.

### Net new vs prior repos

This is the first repo with actual TypeScript application code and a complete monorepo build. It supplies the **storage layer (drizzle dual-mode + migrations)**, **HTTP/security/auth/observability scaffolding**, **rate limiter**, **state machine + idempotent upsert patterns**, and **third-party REST client pattern (OpenProject)** — all production-grade. None of these were present in velocity-code-engine or velocity-ops-engine.

Combined with velocity-ops-engine's `modules/mcp-development.md` + `modules/mcp-governance.md` and velocity-code-engine's MCP contract diff, the **scaffolding for Milestones 0–1** is now mostly assembled. Atlassian (M2), VCS (M3), queue (M6), vector (M7), and the access gate / policy / audit / envelope-encryption layer remain greenfield.

---

## Cross-cutting observations so far

- velocity-code-engine + velocity-ops-engine = **process and governance** (gates, severity taxonomy, audit shape, AGENTS/CLAUDE structure, MCP development + governance modules, anti-stub guardrails).
- project-foundation = **TypeScript scaffolding** (drizzle, HTTP handler, auth, rate limiter, observability, repo+service+route split, idempotent upsert, state machine, monorepo build).
- Combined: Milestones 0 and 1 are largely a copy-and-adapt job. Milestone 2 (Atlassian providers) onward still needs research + custom implementation; pattern templates exist for env-driven REST clients but actual Jira/Confluence/Bitbucket surfaces are absent across all three repos.
- Governance docs across all three repos converge on the same shape: read-first absolute rules, build/test/lint specificity, staged-approval for shared files, file protection metadata, self-verification (read-last). Pick one (project-foundation's is tied to working code) and adapt.
- **Drizzle PGlite/Postgres dual-mode is a better fit than the plan's SQLite/Postgres split.** PGlite is Postgres-compatible WASM — eliminates the SQL dialect-divergence problem the plan would otherwise hit between local SQLite and deployed Postgres. Worth flagging as a potential plan refinement.

---

## Repo 4: `C:\Users\Chris\Documents\git\product-analysis-engine`

**Verdict:** Mature CLI-driven product/market analysis engine ("SiteIntel"). ~7,450 LoC across 118 TS files, fully implemented and production-quality. Six-phase pipeline (recon → classification → deep-features → market → competitors → synthesis → prompts/reports). **No MCP, no Atlassian, no VCS, no vector store, no LLM client, no DB, no queue, no encryption** — but supplies several high-value patterns the prior repos didn't.

Stack: Node 20+, TS 5.8.3 strict (`exactOptionalPropertyTypes`, `noImplicitOverride`), commander 13, native fetch + hand-rolled retry, cheerio, Handlebars 4.7, pino 9.7, p-limit 6.2, Playwright 1.52 (graceful degradation), js-yaml, fast-xml-parser, vitest 3.1 (no MSW; fixture-based).

### Worth lifting (Tier 1 — direct)

1. **HTTP retry/backoff with Retry-After parsing** — `src/shared/http.ts` (lines 70–105). Handles 429 / 500–504 / 425 / 408 with exponential backoff and proper Retry-After header parsing. Drop-in for Section 21 (rate limits / retries) on Jira and Confluence calls.
2. **Pluggable provider interface** — `src/market/search/types.ts` + `serpapi-provider.ts` / `serper-provider.ts`. Clean abstraction over multiple search backends behind a common interface. Direct model for VcsProvider polymorphism (Bitbucket Cloud / GitHub / GitLab) and for the JiraProvider / ConfluenceProvider / RovoMcpProvider split in Section 19.
3. **Feature evidence chaining** — `src/deep-features/feature-intelligence-extractor.ts` (lines 38–74). `FeatureEvidence { source, sourceType, extractedText, confidence }`. Maps directly onto SourcePin / TraceLink / context-pack provenance shape (Section 10 + Section 16).
4. **Signal-weighted scoring** — `src/classification/business-type-classifier.ts` (lines 1–30). `addSignal()` accumulates weighted evidence across multiple independent signals → final classification with confidence. Direct model for the readiness rubric (Section 17) and PolicyDecisionLayer scoring (Section 7) — adds numeric weights on top of the velocity-code-engine context-score dimensions.
5. **Confidence model** — `Confidence = "high" | "medium" | "low"` standardized across all types. Adopt for ProfileWarning severity, AclEntry decisions, preflight outputs.
6. **Handlebars renderer + selector** — `src/prompts/renderer.ts` + `src/prompts/selector.ts`. Conditional template selection based on signal detection (e.g., security/compliance prompts only fire when regulatory signals present). Direct fit for Section 14 prompts (`jira-story-writer`, `confluence-page-writer`, `readiness-reviewer`) and Section 18 preview-output rendering.
7. **CLI argument parsing with override tracking** — `src/cli/commands/analyze.ts` (lines 50–115). `optionIfSpecified()` distinguishes "explicitly set" from "default", nested config merging. Useful for an admin/debug CLI alongside the MCP server.
8. **JSON + YAML mirror writer** — `src/shared/filesystem.ts` + `src/report/json-writer.ts`. `writeStructured()` writes JSON, optionally a YAML mirror. Useful for audit/debug exports of context packs and policy decisions.
9. **Pino logger setup** — `src/shared/logger.ts` (7 lines). Three levels (debug/info/silent), structured JSON. Drop-in baseline before OTel wiring (Section 27).
10. **Six-phase pipeline orchestration** — `src/cli/commands/analyze.ts`. Clear phase boundaries, per-phase error handling, artifact loader for resumability. Pattern for the workflow layer (intake → preflight → blueprint → preview → execute → validate → handoff).
11. **Multi-doc-platform fingerprinting corpus** — `data/documentation-platforms/` (20+ JSON files: Docusaurus, Gitbook, Confluence, Archbee, Document360, etc.). The Confluence platform-fingerprint JSON is interesting on its own — useful as reference data for site-type detection during preflight, especially the "Atlassian Cloud vs Server" determination.
12. **Domain-type discipline** — `src/types/` (1,610 LoC, 8 files). Rich, strict-mode types with discriminated unions, readonly arrays, optional via `?`, `Confidence` everywhere. Pattern transfers wholesale to ProjectBlueprint / ProjectProfile / ContextPack / TraceLink / AclEntry.
13. **Bundled signature corpus pattern** — `src/signatures/data/` (13 JSON files, 225+ tech rules across 6 categories: frontend / backend / ecommerce / hosting / payments+auth / customer+analytics). Loaded via `src/signatures/index.ts`. Direct model for **Section 26 webhook event taxonomy** and **Section 9 capability discovery rule packs**.

### Worth lifting (Tier 2 — adapt)

- **Aggregator patterns corpus** (`data/aggregator-patterns/` — G2, Capterra, Product Hunt, Clutch, etc.) — pattern (not content) for bundled domain-detection rules. Useful structure for tenant-scoped capability rule packs.
- **Conditional prompt generation by business type** — `src/prompts/selector.ts` selects target/03H-engineering vs target/03S-service-delivery vs target/03-architecture based on classification. Maps onto company-managed vs team-managed Jira-project plan generation in Section 12.
- **Documentation crawler with TOC extraction** — `src/deep-features/documentation-crawler.ts`. Pattern for extracting structured ToC from Confluence space hierarchies during preflight.
- **Comparison matrix model** — `ComparisonMatrices` + `FeatureComparisonMatrix` (present / absent / partial / unknown). Useful shape for diff outputs in `project_provision_preview` (Section 14 / Section 18).
- **Artifact loader with shape assertions** — `src/shared/artifact-loader.ts`. Hand-rolled type narrowing on loaded JSON; pattern OK but the plan should adopt Zod (per Section 9) rather than copying the assertion approach.
- **Vitest fixture testing** — `tests/` (30+ files). Inline-fixture style without MSW. Plan calls for Vitest; this is a working reference. Consider adding MSW or Nock for HTTP contract tests against Jira/Confluence — fixture-only is fragile.

### Skip / traps

- **No MCP, no Atlassian REST, no VCS, no vector store, no LLM client, no DB, no auth, no encryption, no queue.** None of the still-open gaps are filled here.
- **`runCompetitorQueue`** (`src/competitors/index.ts`) is `p-limit` over `Promise.all` — **not a real job queue.** No persistence, no retry-on-failure, no backoff, no DLQ. Don't port; use BullMQ as Section 24 specifies.
- **HTTP retry has no idempotency-key plumbing** — same request retried verbatim. Fine for read-heavy SiteIntel calls; **dangerous for Jira/Confluence/VCS write paths**. Augment with Section 24 idempotency keys + `X-Idempotency` headers.
- **`Confidence` is a flat enum, not numeric.** Useful as a default; consider also tracking `confidenceScore: number (0..1)` so policy decisions can compare evidence weights.
- **Crawl pagination is heuristic** — no Link/cursor handling. Replace for Jira/Confluence/Bitbucket pagination per Section 21.
- **Search providers in tests are not mocked** — integration tests need live API keys to run. Plan's Section 31 strategy (recorded fixtures + OpenAPI stubs) is the right move.
- **Single-shot CLI process model** — no long-lived state, no caching, no resumable sessions beyond on-disk artifacts. MCP server needs the opposite. Take the phase-orchestration ideas, not the process model.
- **Handlebars template injection risk** — `renderer.ts` compiles caller-controlled context into templates. Section 30 prompt-injection scanning + Handlebars escaping defaults must be in place before adopting for LLM prompt generation.
- **Playwright is bundled** — graceful-degraded screenshot capture. Not relevant to the MCP server; don't pull it in.
- **No schema validation library on artifact load** — switch to Zod when adopting (already in plan).
- **Phase 2.5 hardware spec extraction** is not relevant to MCP scope; ignore that subtree.

### Not present

Same gaps as before: no Jira/Confluence REST clients, no ADF/storage rendering, no Rovo, no OAuth 3LO, no Bitbucket/GitHub/GitLab adapters, no BullMQ, no Qdrant/BGE-M3, no envelope encryption, no hash-chained audit log, no policy decision engine code, no write guards, no access gate, no gitleaks redaction, no prompt-injection scanning, no Langfuse/OTel, no MCP SDK / transports / tool registration, no MinerU/UIO. Also no DB layer at all (artifact persistence is JSON-on-disk).

### Net new vs prior repos

This repo's contribution beyond what the first three already provide:

- **HTTP retry with proper Retry-After** — closer to plan-spec Section 21 than anything in project-foundation.
- **Provider-abstraction pattern with multiple working backends** — first concrete working example of the pluggable-adapter shape needed for VcsProvider / NotificationProvider / search-or-Rovo upstream.
- **Evidence chaining + numeric/weighted signal scoring + flat confidence enum** — composable into Section 7 PolicyDecisionLayer and Section 17 readiness scoring more directly than velocity-code-engine's context-score dimensions.
- **Working Handlebars-based conditional template generation** — much further along than the prompt scaffolding in any prior repo; directly applicable to Section 14 prompts.
- **Bundled signature/rule-pack corpus with loader** — pattern (not content) for capability discovery rule packs and webhook event taxonomy.
- **Strict-mode TypeScript with `exactOptionalPropertyTypes`** — sets a higher bar than project-foundation; worth matching in the new repo.

---

## Cross-cutting observations so far

- **Process and governance** (velocity-code-engine, velocity-ops-engine): gates, severity taxonomy, audit shape, AGENTS/CLAUDE structure, MCP development + governance modules, anti-stub guardrails, MCP contract diff.
- **TypeScript scaffolding** (project-foundation): drizzle dual-mode, HTTP handler, auth, rate limiter, observability, repo+service+route split, idempotent upsert, state machine, monorepo build.
- **Pipeline + provider + retry + scoring + templating** (product-analysis-engine): six-phase orchestration, pluggable provider interface, HTTP retry with Retry-After, signal-weighted scoring + confidence model, Handlebars conditional template generation, evidence-chain provenance, bundled rule-pack corpus.
- Combined view of Milestone coverage:
  - **M0 (scaffold)** — covered: HTTP server (project-foundation), pino (PAE), CLI/commander (PAE), monorepo + biome (project-foundation), TS strict (PAE).
  - **M1 (domain + storage)** — covered: drizzle pgTable + dual-mode + migrations (project-foundation); type-discipline reference (PAE). Still needed: tenant-scope helpers, encrypted token store, audit hash chain, McpSessionProfile / PolicyDecision types.
  - **M2 (Atlassian providers + capability discovery)** — partial: HTTP retry + Retry-After (PAE), provider-interface pattern (PAE), env-driven REST client + idempotent upsert (project-foundation), capability discovery shape pattern (PAE evidence-chain + signal scoring). Still needed: Jira REST, Confluence v2 REST, ADF, storage renderer, OAuth 3LO, Rovo allowlist.
  - **M3 (VCS provider)** — partial: provider-interface pattern (PAE), env-driven REST + idempotent upsert (project-foundation), Stripe webhook signature pattern (project-foundation). Still needed: Bitbucket Cloud REST, file commits, PR creation, Git webhook signatures.
  - **M4 (blueprint + sampling)** — partial: Handlebars conditional templating (PAE), prompt selector (PAE). Still needed: MCP `sampling/createMessage` integration, deterministic-at-temperature-0 fixtures, Langfuse traces.
  - **M5 (provisioning planner)** — partial: comparison-matrix shape (PAE), signal-weighted policy scoring (PAE), idempotency upsert (project-foundation). Still needed: actor attribution (labels/metadata blocks/commit trailers/PR blocks), policy obligations engine, structured-output schemas.
  - **M6a–c (executors)** — none present. BullMQ + idempotency keys + audit chain + executor logic still greenfield.
  - **M7 (context resources + packs)** — partial: evidence chaining (PAE), confidence model (PAE), Handlebars rendering (PAE). Still needed: Qdrant + BGE-M3, token budgeting, trace-link traversal, hybrid ranking, gitleaks redaction, prompt-injection scanning, access gate.
  - **M8 (readiness)** — partial: signal-weighted scoring (PAE), context-score dimensions (velocity-code-engine), confidence-gate artifact (velocity-ops-engine).
  - **M9 (handoff)** — partial: Handlebars templates + conditional selector (PAE).
  - **M10 (webhooks)** — partial: Stripe-style HMAC verification + tests (project-foundation), bundled signature/rule-pack corpus pattern (PAE) for event taxonomy. Still needed: Atlassian + Bitbucket signature verification, delivery dedup (Redis), GraphChangeEvent normalization.
  - **M11 (notifications/evals/hardening)** — none present beyond fixture testing patterns and pino logging.

- **Plan refinement candidates worth flagging:**
  - PGlite > SQLite for dev/test (project-foundation) — same dialect as production Postgres.
  - Add numeric `confidenceScore: number (0..1)` alongside the categorical `Confidence` enum (PAE) so policy decisions can compare evidence weights.
  - Adopt `exactOptionalPropertyTypes: true` for the new repo (PAE precedent).
  - Bundle preflight/capability rule packs in `data/` JSON corpus pattern (PAE) rather than hardcoding in TS.

---

## Repo 5: `C:\Users\Chris\Documents\git\ai-coding-framework`

**Verdict:** Repository-local AI coding operating system / instruction framework. **Not a codebase** — ~99% governance + workflow Markdown, ~1% lightweight `.mjs` scaffolding (~2 KB of actual runtime code). High overlap with velocity-code-engine and velocity-ops-engine but tighter and more agent-tool-portable (Linux Foundation AGENTS.md standard, cross-tool Claude/Codex/Cursor/Copilot). Fills none of the remaining MCP-implementation gaps; reinforces governance patterns.

### Worth lifting (Tier 1 — direct)

1. **Linux Foundation AGENTS.md (Jan 2026) format** — `AGENTS.md` (~25 KB, ~600 lines). Cross-tool standard with three-tier boundary system (Always / Ask First / Never), agent roster with capabilities and tool permissions. Adopt verbatim for the new repo's AGENTS.md instead of inventing one.
2. **`modules/mcp-development.md` + `modules/mcp-governance.md`** — same as in velocity-ops-engine but cleaner here. Two-document MCP playbook with stdio boilerplate, Zod-validated tool registration, Streamable HTTP guidance, allowlist JSON schema, RBAC config, audit-log requirements, trust-evaluation checklist, gateway-first architecture. Direct reference for Sections 14, 19, 20, 30.
3. **`quality/mcp-security-checklist.md`** — 20+ provenance / code-quality / runtime-safety / supply-chain questions. Drop-in for trust review of any upstream MCP provider (Section 19 Rovo provider in particular).
4. **`quality/ai-security-checklist.md`** — OWASP LLM-specific threat checklist (prompt injection, data exfiltration, token leakage, jailbreaks, drift). Direct fit for Section 30 prompt-injection scanning + Section 16 untrusted-data wrapping.
5. **`quality/banned-patterns.md`** — semgrep YAML rules for stubs, hardcoded secrets, weak error handling, unsafe type assertions. Adopt as a CI gate alongside the velocity-ops-engine 12-pattern guardrails set.
6. **`runtime/lib/scope.mjs`** (331 lines) — concrete logic for detecting file changes / dependency changes / auth changes / CI changes. Useful for Section 9 drift detection and Section 26 webhook-driven invalidation triggers.
7. **`runtime/lib/confidence.mjs`** + **`runtime/lib/approval.mjs`** — JSON artifact schemas with weighted checks → composite score → decision (`stop` / `present-alternatives` / `reviewed-alternatives` / `proceed`). Adoptable as the readiness rubric output and the preview-approval state machine in Section 18.
8. **Conformance rubric** — `benchmarks/rubric.md`. Six 0–5 dimensions: instruction compliance, functional correctness, quality evidence, scope control, continuity, portability. Adopt as the structure for evaluating context packs and handoffs in Section 17 + Section 31 evals.
9. **Multi-tool MCP governance parity** — `modules/mcp-governance.md` "Remote MCP clients" section enforces same transport/TLS/header rules across `.claude/settings.json`, `.codex/config.toml`, `.vscode/mcp.json`, GitHub coding-agent config. Section 36 compatibility-matrix posture matches; lift the file pattern.
10. **Three-layer adoption safety** — full project archive + per-file snapshots + git-clean precondition before adoption mutates anything. Pattern for any tenant-onboarding / brownfield-import command in the new repo.
11. **Module composition pattern** — `scripts/compose-config.sh` layers stack-specific Markdown into a base CLAUDE.md. Useful structure for layering Atlassian-specific / VCS-specific / Rovo-specific guidance modules into a single canonical CLAUDE.md.
12. **MCP provisioning approach** — `scripts/provision-managed-mcp.sh` (referenced) does checksum verification + version pinning + virtualenv/binary management for managed MCP servers. Pattern (not code) for `docs/codex.md` and `docs/claude-code.md` install steps in Section 8.
13. **Should-catch / should-pass fixture pattern** — same as velocity-ops-engine but tied here to the banned-patterns set. Direct application to anti-stub, prompt-injection, redaction, ADF/storage-format renderer correctness.
14. **Domain-logic example** — `examples/01-domain-module/domain-logic.ts` (167 lines) + `domain-logic.test.ts` (221 lines). Pure functions, Zod-style validation, no `any`, no stubs, comprehensive Vitest. Use as a code-quality reference exemplar for new contributors.

### Worth lifting (Tier 2 — adapt)

- **9 specialized agent definitions** (architect, researcher, implementer, tdd-coach, reviewer, tester, docs, ops, guardrails-sentinel, thinking-partner) — trim to 3–4 for the MCP server's needs (likely architect + implementer + reviewer + ops). Boundaries / pre-execution gates / workflow steps are the reusable parts.
- **25+ slash-command definitions** in `commands/` — `/audit`, `/adopt`, `/plan`, `/implement`, `/review`, `/test`, `/release`, `/deploy`, `/incident`, `/rollback`, `/security-audit`, `/multi-agent`, `/translate-tools`. Pattern (not content) for the new repo's command surface.
- **10 workflow definitions** in `workflows/` (feature, TDD, bugfix, refactor, multi-agent, long-running, release, deploy, incident, rollback) — each 5–10 phases with explicit gates. Adapt the structure for the MCP server's intake → preflight → blueprint → preview → execute → validate → handoff workflow.
- **30+ stack modules** in `modules/` (Next.js 15, FastAPI, PostgreSQL, Drizzle, tRPC, Tailwind, Flutter, Kafka, Kong, etc.). The drizzle / postgresql / vitest / fast-check modules are reference-grade; everything else is out-of-scope but the *composability pattern* is reusable.
- **50+ templates** in `templates/` — ADR template, threat model, error handling spec, compliance, incident response, data classification. Pattern + a few specific templates (ADR, threat model, runbook, incident-response) are directly adoptable.
- **Conformance task catalog** — `benchmarks/task-catalog.md` lists frozen tasks: greenfield-source-initiation, brownfield-intent-reconstruction, brownfield-remediation, bounded-feature, bounded-bugfix, parallel-decomposition, multi-session-handoff. Useful for shaping a similar catalog for MCP server tasks (intake-from-pdf, preflight-on-team-managed-jira, provision-with-stale-profile, etc.).

### Skip / traps

- **Not a codebase.** ~99% Markdown. Don't expect to lift implementation. Plan-spec gaps (Atlassian, VCS, vector, queue, encryption, audit, OTel, Langfuse, transports) are not addressed.
- **Heavy bash automation.** Adoption / bootstrap / convert / compose are bash. Translate selectively to TypeScript; don't import wholesale.
- **Framework, not library.** Designed to be adopted into projects via `/adopt`, not `npm install`-ed. Modules compose into CLAUDE.md; agents read rules explicitly. No tool/capability auto-registration.
- **MCP governance is prescriptive, not enforced.** Allowlist + trust evaluation are documented best practices, not running code. The new repo must implement the PolicyDecisionLayer in TypeScript itself.
- **Conformance harness is operator-assisted.** No automation. Useful for periodic evals, not CI gating. Section 31's eval framework needs to be built fresh on top of vitest.
- **Session continuity is file-backed (`.ai/`).** Same trap as velocity-code-engine; doesn't scale to multi-tenant or distributed.
- **`agents/*.md` are static Markdown, not versioned prompts.** Section 14 prompt versioning still has to be added.
- **No Rovo MCP integration.** Mentions are governance-only; no client code. Same gap as everywhere.
- **No LLM SDK usage anywhere.** No Anthropic SDK, no `sampling/createMessage` wiring. Section 23 still greenfield.
- **Significant overlap with velocity-code-engine + velocity-ops-engine.** Pick one source for governance docs; don't try to reconcile three. This one's AGENTS.md follows the published Linux Foundation standard, which is the strongest reason to prefer it for the new repo.

### Net new vs prior repos

- **Linux Foundation AGENTS.md (Jan 2026) standard adherence** — cleaner than velocity-ops-engine's AGENTS.md, designed for cross-tool portability (Claude / Codex / Cursor / Copilot). Use as the authoritative source if any conflict arises.
- **OWASP LLM security checklist** (`quality/ai-security-checklist.md`) — first explicit Section 30 prompt-injection / token-leakage / jailbreak coverage seen across the five repos.
- **Banned-patterns semgrep ruleset** (`quality/banned-patterns.md`) — first YAML/semgrep-formatted ruleset; complements velocity-ops-engine's bash anti-stub scanner.
- **Six-dimension conformance rubric** (`benchmarks/rubric.md`) — most concrete eval scoring scaffold across all five repos.
- **`runtime/lib/scope.mjs` drift detection** — concrete file/dep/auth/CI change-detection logic; new and useful.

---

## Final cross-repo synthesis

### Where each plan section gets its starting material

| Plan section | Strongest source | Notes |
|---|---|---|
| **§2 strategic design + Rovo allowlist** | velocity-ops-engine `modules/mcp-governance.md`; ai-coding-framework `quality/mcp-security-checklist.md` | Lift allowlist JSON schema + trust-eval checklist verbatim |
| **§6 state machine** | velocity-code-engine `runtime/control-plane.mjs` (gate model); ai-coding-framework `runtime/lib/confidence.mjs` + `approval.mjs` | Pattern only; rebuild on BullMQ |
| **§7 access gate + PolicyDecisionLayer** | project-foundation `auth/roles.ts` (RBAC tuple); product-analysis-engine signal-weighted scoring; ai-coding-framework confidence weighted-checks | Combine: tuple shape + weighted signals + obligations |
| **§7 multi-tenant runway** | project-foundation drizzle dual-mode | Add tenant scope helpers + tenant-scoped Qdrant collection naming (Section 25) |
| **§8 repo structure** | project-foundation pnpm workspaces + biome + tsconfig.check; product-analysis-engine `exactOptionalPropertyTypes` | Adopt strictest TS posture |
| **§9 storage** | project-foundation `db/client.ts` + `schema.ts` + `migrate.ts` + `rehearsal.test.ts` | **Suggest swapping plan's SQLite for PGlite** — same Postgres dialect, eliminates migration drift |
| **§9 secrets/tokens** | None present in any repo | Greenfield; libsodium secretbox or KMS data-key envelope per plan |
| **§9 capability profile** | product-analysis-engine `data/documentation-platforms/` Confluence fingerprint + signal-weighted scoring | Pattern for site-type detection during preflight |
| **§10 domain types** | product-analysis-engine `src/types/` discipline (Confidence enum, evidence chains); project-foundation type patterns | Add numeric `confidenceScore: 0..1` alongside categorical `Confidence` |
| **§14 MCP surface** | velocity-ops-engine + ai-coding-framework `modules/mcp-development.md` (boilerplate); product-analysis-engine Handlebars conditional selector for prompts | None of the five has actual MCP SDK code |
| **§17 readiness rubric** | ai-coding-framework `benchmarks/rubric.md` (6 dimensions, 0–5); velocity-code-engine context-score dimensions; product-analysis-engine signal-weighted scoring | Combine three sources |
| **§18 write safety / preview-approve-execute** | project-foundation idempotent upsert (`ensure-*-tracking.ts`); ai-coding-framework approval artifact + scope signature; velocity-code-engine gate types | Pattern composition; the dry-run diff format itself is fresh work |
| **§19 provider interfaces** | product-analysis-engine pluggable search-provider interface; project-foundation OpenProject REST client + transport pattern | OpenProject is closest existing pattern; Atlassian/VCS surfaces are still greenfield |
| **§20 auth** | project-foundation HMAC session token (good for MCP session, not Atlassian) | Atlassian OAuth 3LO + service-account auth = greenfield |
| **§20 actor attribution** | None implemented; only described in plan | Greenfield: Jira labels, ADF/storage metadata blocks, commit trailers, PR description blocks |
| **§21 retries / pagination** | product-analysis-engine `src/shared/http.ts` (Retry-After parsing); project-foundation rate limiter | Augment PAE retry with idempotency-key plumbing for write paths |
| **§22 transport** | project-foundation HTTP server (737 lines, security headers); ai-coding-framework `modules/mcp-development.md` stdio boilerplate | Streamable HTTP transport itself is greenfield |
| **§23 sampling** | None | Greenfield; `sampling/createMessage` while handling originating request, deterministic non-sampling fallback, direct-API mode for headless |
| **§24 queue/jobs** | project-foundation pluggable `Transport<T>` (closest pattern, but no real queue); product-analysis-engine `p-limit` (don't port) | BullMQ wiring + idempotency-keys table + job resource exposure = greenfield |
| **§25 vector / embeddings** | None across all five | Greenfield: Qdrant client, BGE-M3 endpoint, recursive splitter (512 tok / 64 overlap), tenant-scoped collection naming |
| **§26 webhooks** | project-foundation Stripe HMAC verification + tests; product-analysis-engine signature corpus (pattern) | Atlassian + Bitbucket signature verification + Redis dedup with provider event IDs = greenfield |
| **§27 observability** | product-analysis-engine pino setup; project-foundation in-memory metrics store | OTel + Langfuse wiring, preflight span events = greenfield |
| **§30 security** | velocity-ops-engine enforcement-v2 hooks + 12-pattern anti-stub; ai-coding-framework banned-patterns semgrep + OWASP LLM checklist; project-foundation security headers | Combine: pre-write hooks + semgrep + OWASP review + headers |
| **§30 audit chain** | None implemented; plan describes hash-chain | Greenfield |
| **§30 redaction / injection scanning** | ai-coding-framework `quality/ai-security-checklist.md` (rules); none implement | Greenfield: gitleaks lib + entropy detection + injection-pattern scanner with untrusted-data markers |
| **§31 testing** | project-foundation test patterns + migration rehearsal; product-analysis-engine vitest fixtures; ai-coding-framework should-catch/should-pass + conformance rubric | Vitest + recorded HTTP fixtures (add MSW) + MCP inspector conformance |
| **§32 DoD / §33 prerequisites / §34 risks** | velocity-ops-engine governance shape; ai-coding-framework command/workflow definitions | Combine governance patterns |
| **§35 UIO** | None across all five | Greenfield |

### Plan refinement candidates worth flagging

1. **PGlite over SQLite** for dev/test (project-foundation precedent). Same Postgres dialect; eliminates SQLite/Postgres-divergence risk in migrations and queries (esp. JSONB, RLS, full-text).
2. **Add numeric `confidenceScore: number (0..1)`** alongside categorical `Confidence` enum (PAE precedent). Lets policy decisions compare evidence weights, not just categories.
3. **Adopt `exactOptionalPropertyTypes: true`** in tsconfig (PAE precedent). Higher type-safety bar than project-foundation.
4. **Bundled rule-pack JSON corpus** (`data/`) for capability discovery, webhook event taxonomy, Confluence/Jira platform fingerprints (PAE precedent). Easier to update than hardcoded TS.
5. **Linux Foundation AGENTS.md (Jan 2026)** as the canonical AGENTS.md format (ai-coding-framework precedent). Cross-tool portability.
6. **Six-dimension conformance rubric** for evals (ai-coding-framework precedent) instead of inventing one.
7. **Banned-patterns as semgrep YAML + bash anti-stub scanner combined** (ai-coding-framework + velocity-ops-engine). Different layers of enforcement.

### Combined Milestone coverage at end of survey

- **M0 scaffold** — covered enough to start. HTTP server (project-foundation) + pino (PAE) + commander/CLI (PAE) + monorepo+biome (project-foundation) + AGENTS.md format (ai-coding-framework) + MCP boilerplate doc (ai-coding-framework `modules/mcp-development.md`).
- **M1 domain + storage** — drizzle dual-mode + migrations + rehearsal test (project-foundation); type discipline + Confidence enum (PAE). Greenfield: tenant-scope helpers, encrypted token store, audit hash chain, McpSessionProfile/PolicyDecision types.
- **M2 Atlassian providers + capability discovery** — HTTP retry with Retry-After (PAE), provider-interface pattern (PAE), env-driven REST + idempotent upsert (project-foundation), Confluence fingerprint corpus pattern (PAE). Greenfield: Jira REST client (incl. non-deprecated create-meta), Confluence v2 REST client, ADF helpers, storage-format renderer, optional ADF feature flag, OAuth 3LO + refresh, Rovo allowlist enforcer.
- **M3 VCS provider** — provider-interface (PAE), Stripe-style HMAC webhook verification (project-foundation). Greenfield: Bitbucket Cloud REST (file commits, PR creation), GitHub adapter stub, webhook signature verifier per provider.
- **M4 blueprint + sampling** — Handlebars conditional templating (PAE), signal-weighted classification scoring (PAE). Greenfield: MCP `sampling/createMessage`, deterministic temperature-0 fixtures, direct-API fallback, Langfuse traces.
- **M5 provisioning planner** — comparison-matrix shape (PAE), idempotent upsert (project-foundation), confidence/approval/scope artifacts (ai-coding-framework). Greenfield: actor-attribution planning, structured `outputSchema` with `structuredContent`, policy-decision-per-action, request-count estimator.
- **M6a–c executors** — pluggable Transport (project-foundation closest pattern). Greenfield: BullMQ worker + idempotency keys + audit hash chain + writeGuards layer + actor-attribution writes (Jira labels / ADF body block / commit trailers / PR description block).
- **M7 context resources + packs** — evidence chaining + Confidence + Handlebars (PAE), session continuity artifacts (velocity-code-engine + ai-coding-framework). Greenfield: Qdrant + BGE-M3 + chunker, token budgeting against configured target model, trace-link traversal, hybrid ranking, gitleaks redaction, prompt-injection scanner with untrusted-data markers, three-mode access gate.
- **M8 readiness** — six-dim rubric (ai-coding-framework), context-score dimensions (velocity-code-engine), signal-weighted scoring (PAE), confidence artifact schema (ai-coding-framework + velocity-ops-engine).
- **M9 handoff** — Handlebars + conditional selector (PAE), AGENTS.md/CLAUDE.md/Cursor-rules canonical-source pattern (ai-coding-framework module composition).
- **M10 webhooks + subscriptions** — Stripe HMAC + tests (project-foundation), bundled signature corpus pattern (PAE). Greenfield: Atlassian + Bitbucket signature verification, Redis dedup keyed on provider event IDs (`X-Atlassian-Webhook-Identifier`, `X-GitHub-Delivery`, `X-Hook-UUID`), GraphChangeEvent normalization, drift flagging, ACL invalidation on permission events, MCP `resources/subscribe` + `notifications/resources/updated` + pagination.
- **M11 notifications + evals + hardening** — pluggable Transport pattern (project-foundation) for Slack/Teams adapters, banned-patterns semgrep + OWASP LLM checklist + conformance rubric (ai-coding-framework). Greenfield: actual notification adapters, golden datasets, LLM-as-judge runner, MCP inspector conformance suite, OTel + Langfuse exporters, SLO dashboards, ops runbook.

### Bottom-line summary across all five repos

- **Process / governance / agent instruction:** Saturated. Pick one canonical AGENTS.md (ai-coding-framework's Linux Foundation form) and one canonical CLAUDE.md format. The rest is excess.
- **TypeScript scaffolding (HTTP, auth, rate limit, observability stub, monorepo, drizzle, migrations):** Solid, comes mostly from project-foundation, supplemented by PAE.
- **Domain patterns (provider abstraction, retry, evidence/scoring, conditional templating, pipeline):** Solid, comes mostly from product-analysis-engine.
- **MCP-specific implementation (SDK, transports, tools, sampling, elicitation, completions, subscriptions, session capability registry):** **Zero across all five repos. Entirely greenfield.**
- **Atlassian (Jira / Confluence / Rovo / ADF / OAuth 3LO):** **Zero. Entirely greenfield.**
- **VCS (Bitbucket Cloud / GitHub / GitLab):** **Zero. Entirely greenfield.**
- **Vector / embeddings (Qdrant / BGE-M3 / chunker):** **Zero. Entirely greenfield.**
- **Queue (BullMQ + idempotency + DLQ):** **Zero. Entirely greenfield.**
- **Encryption / KMS / hash-chained audit:** **Zero. Entirely greenfield.**
- **Access gate + write guards + policy decision engine + redaction + injection scanning:** Specs and checklists yes; code no. Greenfield.
- **OTel + Langfuse + preflight telemetry:** **Zero. Entirely greenfield.**
- **MinerU / UIO document extraction:** **Zero. Entirely greenfield.**

Roughly half the plan is rooted in patterns / scaffolding present somewhere in these five repos. The other half — most of the differentiated value (MCP surface, Atlassian, VCS, vector, queue, encryption, audit, OTel, access gate, redaction) — is greenfield work informed by the plan and external references, not by these repos.

---

# Archive sweep — `C:\Users\Chris\Documents\git\Archive` (73 repos)

## Batch 1 (UIO + RAG + MCP-named)

### `uio` — **the** UIO from plan §35 (highest-value find of the survey so far)
- Production Python FastAPI + **TypeScript MCP server** (`packages/mcp/src/`, ~150 LoC, Zod-validated, X-API-Key auth, SSE transport, 4 tools: `uio_ingest` / `uio_query` / `uio_status` / `uio_catalog`).
- **MinerU client integration** (`src/uio/parsing/parsers/mineru.py`) + parser router for PaddleOCR-VL / Docling / Pandoc-EPUB / GLM-OCR with QA gating. **Direct match for §35**.
- **BGE-M3 embedding server** — custom FastAPI wrapper around FlagEmbedding returning dense (1024-dim Cosine) + sparse + BM25 + ColBERT (multivector) in one call. Client at `src/uio/embedding/client.py`.
- **Qdrant 8-collection multi-vector setup** (`src/uio/storage/qdrant.py`) with payload indexes (project_id, source_id, envelope_id, content_type, license_class). Idempotent schema validation. Sparse format conversion gotcha: Qdrant wants `{idx: val}` dict; FlagEmbedding returns `{indices, values}` — see `bge_sparse_to_qdrant()`.
- **Hierarchical chunker** (`src/uio/chunking/hierarchical.py`) — token-aware recursive (target 500 / max 600 / min 100 / overlap 50). **Deterministic chunk IDs**: `chunk_id = SHA256(source_id | content | stage | version_hash)` — exactly the keying pattern §35 needs for embedding reuse.
- **Hatchet orchestrator** (Postgres-backed at-least-once workflow engine) with GPU-aware worker labels, deterministic idempotency keys, Garage S3 checkpointing. **Plan refinement candidate vs BullMQ** — Hatchet has stronger semantics for long-running, GPU-routed work.
- **Compliance gate** (`src/uio/compliance/gate.py`) — similarity (cosine + n-gram + MinHash; flag >0.80, reject >0.90), blending (min 3 sources, max 40% single-source), verbatim budget, adjacency suppression, rate limiter, license-class enforcement. Partial fit for §7 access gate.
- **Hybrid retrieval** with **RRF cross-collection merge** (k_rrf=60), GTE-Reranker-ModernBERT-Base reranker (CPU ONNX, conditional depth 20–100). Query mode routing: INTERNAL / PUBLICATION / DRIVERFORGE.
- **Langfuse + Prometheus + structlog + DCGM GPU telemetry** wired end-to-end. Trace per envelope, span per stage. Fills §27.
- **Postgres + asyncpg** (NOT drizzle) with **PgBouncer transaction mode** — `statement_cache_size=0` mandatory (named prepared statements break in tx mode). SQL migrations via version-tracked `schema_migrations` table.
- **GitHub webhook** with HMAC-SHA256 signature verification.
- **Pydantic settings hierarchy** with `${VAR:default}` env interpolation.
- Stack-aware Docker Compose for Postgres + Hatchet + Qdrant + Garage + Langfuse.
- Gaps: no envelope encryption, no hash-chained audit log, no policy DSL, no gitleaks/injection scanning, no OTel (Langfuse + Prom only), no Jira/Confluence, no Bitbucket beyond GitHub-star webhook.
- **Recommended integration:** orchestrator's `project_intake_create` should call UIO's MCP `uio_ingest` and either wait for envelope completion or accept a UIO document reference (source_id + chunk_indices) and pull pre-computed vectors from Qdrant `uio_books_raw_v1` directly.

### `agentic-rag-for-dummies` — Python LangGraph hybrid RAG reference
- **Qdrant hybrid (dense + sparse) retrieval** with HYBRID retrieval mode, named `"sparse"` vector via FastEmbedSparse (BM25 wrapper).
- **Parent-child hierarchical chunking** (`document_chunker.py`): MD-header split → merge <2000 char → split >10000 char → child splits 500/100. Two-stage retrieval: search children → fetch full parent JSON. Direct fit for §16.
- **LangGraph multi-agent map-reduce** via `Send` API for query decomposition (1–3 sub-queries in parallel, then aggregation node).
- **Query analysis** with structured Pydantic output (`QueryAnalysis { is_clear, questions, clarification_needed }`); rewrites + clarity check + human-in-the-loop interrupt.
- **PDF→Markdown via PyMuPDF4LLM** plus a 3-tier strategy doc (`pdf_to_md.ipynb`): simple → Docling/Marker/Surya/PaddleOCR → VLM (Gemini/GPT/Claude). Useful adjunct to UIO's MinerU choice.
- File-based parent store (JSON), Ollama LLM (qwen3:4b-instruct), InMemorySaver checkpointer. Uses `all-mpnet-base-v2` not BGE-M3.
- Gaps: no token budgeting, no trace-link traversal, no source pinning, no gitleaks/injection scanning, no Langfuse/OTel, no MCP.

### `simple-commands-mcp` — first concrete TS MCP scaffolding
- `@modelcontextprotocol/sdk` **^1.17.3** (current stable). TypeScript ES2022 + esbuild bundle with shebang + `createRequire` ESM banner.
- Clean `StdioServerTransport` + `ListToolsRequestSchema` + `CallToolRequestSchema` handlers; error path via `McpError` + `ErrorCode.InternalError`. Server declares `capabilities: { tools: {} }`.
- Static config-driven tool list; auto-generated daemon controls (`{name}_start`, `_status`, `_stop`, `_logs` per daemon entry).
- **Winston file logger** with explicit "stdout breaks MCP" warning (must log to file, never stdout in stdio servers — important rule).
- ProcessManager singleton with **circular output buffer (max 1000 lines)**, state machine, SIGTERM→5s→SIGKILL graceful shutdown.
- CLI wrapper validates `@config.json` arg and forwards via `MCP_CONFIG_PATH` + `MCP_PROJECT_ROOT` env vars.
- No HTTP transport, no resources/prompts/sampling/elicitation/subscriptions/capability negotiation. Direct lift target for stdio scaffolding (M0 acceptance).

### `mcp_daemon` — Rust v0.3.0 multi-transport SDK reference (best transport architecture seen)
- Implements MCP spec **2025-03-26** from scratch (`jsoncall` JSON-RPC 2.0 + serde). Crate v0.3.0 on crates.io.
- **Multi-transport `Transport` trait abstraction** (`src/transport/mod.rs:46-78`):
  - **stdio** (`stdio.rs` 198 LoC), **WebSocket** (629 LoC, native TLS), **HTTP/2** (1350 LoC, Rustls + ACME), **SSE** (385 LoC, feature-gated), **InMemory** (269 LoC, for tests).
- **Macro-based registration** `#[server]` + `#[tool]` / `#[resource]` / `#[prompt]` (`src/utility/macros.rs`).
- Full sampling (`sampling/createMessage`), completions, resource subscribe/unsubscribe.
- Capability negotiation declares `prompts` + `resources.{subscribe, list_changed}` + `tools.list_changed` + `logging`.
- Daemonization via `daemonize-me` crate (PID file, user/group dropping, post-fork hooks). CLI scaffold complete; subcommand handlers are TODOs.
- `Arc<dyn Server>` ownership, `SessionData` threading to every handler, `RequestContextAs<T>` wrapper, `Empty` result type for void responses.
- Rust — language mismatch — but the **transport-trait abstraction is the cleanest reference for plan §22** and the Server-trait dispatch + SessionData pattern is the cleanest model for §14.

### `mcp-daemonize` — Go MCP daemon-process manager
- `mark3labs/mcp-go v0.32.0` (Go SDK), stdio only, 4 tools (`daemonize_start/stop/list/logs`).
- Tool builder pattern: `mcp.NewTool("name", mcp.WithDescription(), mcp.WithString(...))`; result via `mcp.NewToolResultText/Error`.
- **Process group management** (Unix-only): `Setpgid: true`, kill via negative PID `syscall.Kill(-pgid, sig)`. SIGINT→10s→SIGKILL.
- **Circular in-memory logger** with `io.Writer` interface; destructive `ReadLine()` (clears buffer — gotcha).
- GoReleaser multi-platform builds; CGO disabled. Windows commented out.
- Useful as a tool-registration shape reference, but redundant with simple-commands-mcp for our purposes.

### `mcpd` — Rust MCP aggregator/proxy (v1.0.7)
- Production crates.io v1.0.7 — pure stdio aggregator that **proxies multiple backend MCP servers** behind a 2-tool meta-interface (`list_tools` + `use_tool` with `server__toolname` namespace) plus native pass-through of `resources/list`, `resources/read`, `prompts/list`, `prompts/get`.
- **JSON-RPC multiplexing** with async background reader task per backend, oneshot channels keyed on numeric request IDs, dual-lock pattern (`init_lock` separate from state) preventing TOCTOU race on `initialized` flag. Concurrent-safety verified by regression tests (10× parallel calls + 10× concurrent `ensure_ready`).
- Filesystem-based registry (`~/.config/mcpd/registry.json`) with hot reload on every request and `notifications/{tools,resources,prompts}/list_changed` dispatch on change.
- Hand-rolled MCP types for spec **2025-11-25** in `mcp.rs` (480 LoC). Useful as a TS Zod port reference.
- **Direct architectural model for plan §2 / §19 Rovo MCP mediation** — when the orchestrator proxies upstream MCP providers (Rovo + future), this is the pattern.

### `codebase-memory-mcp` — Pure-C MCP server with built-in vector + tree-sitter
- Pure **C11**, ~30–50MB static binary, only zlib dependency. arXiv preprint 2603.27277. SLSA-3, cosign, VirusTotal-cleared releases.
- 14 MCP tools (`index_repository`, `search_graph`, `query_graph`, `trace_call_path`, `get_code_snippet`, `search_code`, `detect_changes`, `manage_adr`, `ingest_traces`, etc.) over JSON-RPC 2.0 stdio.
- **Tree-sitter AST extraction** for **66 languages** (vendored grammars) — direct relevance for chunking code-aware Confluence pages or Bitbucket sources during preflight or context-pack assembly.
- **11-signal algorithmic embeddings** (TF-IDF, Random Indexing, MinHash, API signature, type signature, module proximity, decorators, AST structural profile [25 floats], approximate dataflow, graph diffusion, Halstead-Lite). **No external LLM dependency**. SQLite + int8 quantized vectors + custom `cbm_cosine_i8()` SQL function. Plan refinement candidate: skip Qdrant for code retrieval if BGE-M3 cost is too high.
- **Multi-agent auto-config installer** for 10 hosts: Claude Code, Codex CLI, Gemini CLI, Zed, OpenCode, Antigravity, Aider, KiloCode, VS Code, OpenClaw. Directly relevant to plan §8 `docs/codex.md` + `docs/claude-code.md` install patterns — copy this list and the per-host config-file paths.
- 8-layer build-time security audit (shell-injection allowlist, binary-string audit, network-egress monitoring, MCP-robustness adversarial fuzz, etc.) — strong source for §30 hardening checks.
- Cypher subset (MATCH/WHERE/RETURN/LIMIT) over SQLite graph; FTS5 BM25 with camelCase tokenizer.
- Watcher thread polls git diff every 5–60s for incremental re-indexing. File-hash + mtime tracking.
- C — language mismatch — but the algorithmic-embedding signals + multi-host auto-config are unique contributions.

### `Daemon` — Daniel Miessler's personal-profile static site (irrelevant)
- Astro + React on Cloudflare Workers; the actual MCP backend isn't even in this repo. Skip.

### Batch 1 net-new vs prior 5
- **First actual TypeScript MCP scaffolding** (simple-commands-mcp) — `@modelcontextprotocol/sdk@1.17.3` stdio + `ListToolsRequestSchema`/`CallToolRequestSchema` shape.
- **First multi-transport SDK reference** (mcp_daemon Rust) — Transport trait covers stdio + WebSocket + HTTP/2 + SSE + InMemory.
- **First MCP aggregator/proxy pattern** (mcpd) — directly applicable to Rovo upstream mediation.
- **First production document-extraction stack** (uio) — MinerU + BGE-M3 + hierarchical chunker + Qdrant multi-vector + Hatchet orchestrator + Langfuse — covers §25, §27, §35 in one repo.
- **First production hybrid RAG reference** (agentic-rag-for-dummies) — Qdrant dense+sparse + parent-child chunking + LangGraph map-reduce + query rewriting.
- **First MCP host auto-config inventory** (codebase-memory-mcp): 10 host config paths.
- **Confirmed plan refinement candidates:**
  - Hatchet (Postgres-backed, deterministic idempotency, GPU-aware labels) as alternative or supplement to BullMQ for long-running/GPU-bound work.
  - PgBouncer transaction-mode requirement: `statement_cache_size=0`. Document in §22.
  - BGE-M3 sparse format conversion: Qdrant wants `{idx: val}`, FlagEmbedding returns `{indices, values}`.
  - In stdio servers, log to file (Winston) — NEVER stdout — confirms velocity-ops-engine guidance.
  - Algorithmic embeddings (codebase-memory-mcp's 11-signal approach) viable for code-only retrieval if BGE-M3 cost is undesired.
  - MCP host auto-config list (10 hosts) for `docs/codex.md` + `docs/claude-code.md` (§8).
  - Compliance gate from UIO (similarity / blending / verbatim / adjacency / rate-limit / license-class) is a near-fit for §7 access gate — adopt the pattern.

## Batch 2 (context / index / eval / state systems)

### `context-fabric` — **TS MCP server with full context-pack pipeline** (high value)
- `@modelcontextprotocol/sdk@1.27.1` (newer than simple-commands-mcp's 1.17.3). Stdio transport. 5 tools: `cf_capture`, `cf_drift`, `cf_query`, `cf_health`, `cf_log_decision`.
- **CADRE 5-engine architecture** (named for §16 paper):
  - **E1 Capture** (`src/engines/watcher.ts`, ~862 LoC): post-commit git hook + `git diff-tree`/`ls-files`/`cat-file --batch` + SHA256 fingerprinting + deferred capture for >500 files / >32 MB. 27-language export-extraction regexes.
  - **E2 Anchor** (`src/engines/anchor.ts`): SHA256-based drift; severity LOW (<10%) / MED (10-30%) / HIGH (>30%); special codes `DELETED`/`UNREADABLE`/`TRAVERSAL_REJECTED`. Direct fit §27 freshness.
  - **E3 Router** (`src/engines/router.ts`): SQLite **FTS5 BM25 with column weights** (path 2.0 / file_summary 1.5 / outline 1.2 / exports 1.0); query sanitizer strips FTS5 operators (`+ - * ^ ( ) " : .`), filters reserved words (OR/AND/NOT), min token 2, max 10. Direct fit §16 hybrid ranking.
  - **E4 Governor** (`src/engines/governor.ts`): greedy token selection with **22 model context sizes hardcoded** (Claude 200K, GPT-5.4 1M, Gemini 1M, etc.); default budget = 8% of model context; pre-calculated estimates (`Math.ceil(byteLength / 3.5)`) at capture time, no lazy reads. Direct fit §16 budgeting.
  - **E5 Weaver** (`src/engines/weaver.ts`): structured markdown briefing with drift warning prepended on MED/HIGH; `wrapAsData()` untrusted-data wrapper; bounded sections (20 stale files, 25 components, 10 ADRs). Direct fit §16 context-pack rendering.
- **InjectionGuard** (`src/security/injection-guard.ts`): patterns redacted — `SYSTEM:`, `<IMPORTANT>`, "ignore previous instructions" variants, "you are now a..." jailbytes, `[INST]/[/INST]` Llama format, control char normalization, output truncation. Direct fit §30.
- **PathGuard** (`src/security/path-guard.ts`): `relative()`-based traversal validation. Direct fit §30.
- **SQLite WAL** with FTS5 virtual table, schema v2 with migration path; Vitest with no mocking (real temp files, real SQLite, real SHA256).
- ResultCache with capture-aware TTL invalidation. CLI: `init` / `capture` / `query --budget-pct --model` / `doctor [--repair]`. WSL detection, NVM-aware Node-path.
- Gaps: stdio only (no Streamable HTTP), no policy engine, no audit chain, no Langfuse/OTel.
- **Recommended:** lift E1–E5 wholesale as the foundation of §16 context-pack module + §27 drift detection. Wrap in Streamable HTTP transport + add tenant scoping + extend with Qdrant as secondary signal.

### `indxr` — **Rust MCP with Streamable HTTP transport** (best §22 reference)
- ~4,700 LoC core + 1,100 wiki. Rust 2024 edition, MSRV 1.85.
- **MCP transports**: stdio (default) + **Streamable HTTP** (axum + tokio + SSE, v2025-03-26 spec, **session lifecycle 1h sliding TTL, 1000 concurrent**). Best concrete reference for §22 dual-transport.
- 26 tools — **3 compound default + 23 granular via `--all-tools` flag** + 9 wiki-specific behind `--features wiki`. EXTENDED_TOOLS array reduces per-request schema overhead ~420 vs 1100+ tokens. Pattern relevant to §34 tool-sprawl risk.
- **Token budgeting** with 5-step progressive truncation: doc comments → private decls → children → leaf files → final. File importance scoring (entry points +100, path depth -5/level, public-API count +3). Direct fit §16.
- **Persistent codebase wiki** (`src/wiki/`): YAML frontmatter (id, page_type, source_files, links_to, covers, contradictions, failures), `[[wiki-link]]` cross-references, manifest.yaml for fast lookups, path-traversal defense.
- **Multi-signal lexical relevance** (NOT vector): substring + word-boundary + levenshtein fuzzy fallback, weights name 3× / signature 2× / doc 1×.
- 27-language tree-sitter (8 native + 19 regex). Per-function complexity metrics (cyclomatic / nesting / param-count). Type flow analysis (cross-file param/return types). Dependency graph (DOT/Mermaid/JSON).
- Multi-provider LLM client (`src/llm/`): Claude (`v2023-06-01` Anthropic API) + OpenAI-compatible (incl. Azure) + custom shell command. Env auto-detect: `ANTHROPIC_API_KEY` > `OPENAI_API_KEY` > `INDXR_LLM_COMMAND`.
- `init` scaffolds: `.mcp.json`, `.claude/settings.json`, `.cursor/mcp.json`, `.windsurf/mcp.json`, `.codex/config.toml`, CLAUDE.md, .gitignore. Useful list of MCP-host config paths for §8.
- File watcher (notify + notify-debouncer-mini, 300ms default), incremental cache (mtime + xxh3 hash, bincode), git structural diffing (declaration-level markers + GitHub PR API).
- Rust — language mismatch — but transport / token-budgeting / tool-collapse patterns transfer.

### `mengram` — Python AI memory system
- 3-type memory (semantic / episodic / procedural). PostgreSQL + pgvector + HNSW + BM25. ~7K LoC core. Cloud (`pgvector` 1536D OpenAI) + local (sentence-transformers all-MiniLM-L6-v2 384D, Metal GPU support).
- **MCP server stdio + cloud HTTP variants**, **29 tools**, proactive resource pinning pattern: `memory://profile` (auto-pinned cognitive profile), `memory://recent`, `memory://entity/{name}`. Useful for §14 resource design — proactive memory injection beats query-on-demand.
- **Experience-driven procedure evolution**: `episodes.linked_procedure_id` + `failed_at_step` → LLM analyzes failure → evolves procedure → versioned via `parent_version_id`; success-path: 3+ similar episodes → LLM extracts pattern → auto-creates procedure. Novel; relevant to §6 DRIFT_DETECTED state and §17 readiness regression learning.
- 16 tables incl. embeddings / episodes / procedures / triggers / procedure_evolution / memory_triggers (fire_at scheduling). Multi-user isolation via `sub_user_id` column; rate limiting per plan; SSRF protection on webhook URLs.
- Memory agents: Curator (contradiction detection), Connector (pattern finding), Digest (weekly summary). Multi-LLM client (Claude / OpenAI / Ollama).
- Gaps: no envelope encryption, no hash-chained audit, no Langfuse/OTel, no Atlassian, no UIO. Skip Obsidian / VS Code / n8n integrations.
- **Plan refinement candidate:** proactive resource pinning (e.g., orchestrator could expose `orchestrator://session/current/preflight` as auto-pinned to reduce per-call discovery cost).

### `ATLAS` — **NOT** Atlassian. Standalone Go+Python local coding assistant
- 14th repo without Atlassian code. Qwen3.5-9B + V3 pipeline (PlanSearch / DivSampling / Budget Forcing / PR-CoT / Best-of-K, 19 modules) + **Geometric Lens** (C(x) cost field + G(x) XGBoost + BM25/AST RAG). Custom HTTP agent loop, NOT MCP.
- 74.6% LCB pass@1 on 14B variant. Self-hosted on $500 GPU.
- Useful patterns: **grammar-constrained JSON via GBNF** (llama.cpp) for guaranteed valid LLM output (could inform §14 structured outputs); per-file tier classification T0/T1/T2/T3 routing (relevant §17); permission system with default-deny glob patterns (`rm -rf /`, `mkfs*`, `.env`, `*.pem`, `*.key`, `*credentials*`) at `atlas-proxy/permissions.go` — fit §30 write guards.
- Documentation pattern: 13 Mermaid diagrams + multilingual docs (zh-CN, ja, ko) — adopt structure for plan repo.
- Skip: ATLAS itself; standalone competitor design, not orchestrator-friendly.

### `statespace` — **NOT** a state-machine framework. Rust CLI for Markdown data apps
- Misleading name. AGENTS.md explicitly says "stateless CLI." Rust 2024 edition, MSRV 1.85, `#![forbid(unsafe_code)]`.
- Strong patterns: SSRF defense + private-IP blocking + metadata-service blocking (`security.rs`, lines 11-47), env hygiene via `env_clear()` + selective merging + PATH dedup (`sandbox.rs`, lines 11-80), type-driven spec validation (regex compiled at parse not execution), `#[serde(deny_unknown_fields)]`.
- HOWTOAI.md is a strong AI-development guidance template.
- Plan §6 state-machine and §24 job queue are NOT in this repo — gap remains.

### `plano` — Rust/WASM Envoy LLM router (NOT a planner)
- Misleading name (plano = plan). Production agentic proxy on Envoy. **17 LLM providers**: OpenAI, Anthropic, Gemini, Azure, Mistral, Deepseek, Groq, XAI, Ollama, Moonshotai, Zhipu, Qwen, Bedrock, GitHub Models, Xiaomi (`crates/hermesllm/src/providers/id.rs:28-47`).
- **MCP filter type** (`crates/brightstaff/src/handlers/agents/pipeline.rs:200-350`) with session ID tracking + JSON-RPC 2.0 helpers + `transport: streamable-http`. Useful as a real-world MCP-client implementation when orchestrator mediates upstream (§19 Rovo).
- Multi-backend `StateStorage` async trait (Memory + PostgreSQL impls) at `crates/brightstaff/src/state/mod.rs:64-77`. Production OTel auto-instrumentation with custom span attributes from headers. Guardrail filter chains + governor crate rate limiter + PII patterns (`crates/common/src/pii_patterns.rs`) + tiktoken tokenizer.
- `plano_orchestrator_v1` 4B-parameter agent-routing model (NL descriptions matched to request intent) — not relevant to project planning.
- Skip: Plano itself doesn't fit; extract MCP-filter session-management pattern only.

### `eval-view` — **production eval framework — direct §31 + §17 implementation** (high value)
- Python primary (56k SLOC, 202 modules) + TypeScript Node SDK v0.6.2 (Express middleware). 67 test files. Click CLI + Pydantic.
- **LLM-as-judge multi-provider** (OpenAI / Anthropic / Gemini / Grok / Ollama) at `evalview/evaluators/output_evaluator.py:38-160`. **Judge cache** (SQLite + in-memory, 24h TTL) ~80% cost reduction in statistical mode. Code-based checks (regex / JSON-schema) applied **before** LLM call to dock points without API spend.
- **4-tier verdict layer** (`evalview/core/verdict.py`): `SAFE_TO_SHIP` / `SHIP_WITH_QUARANTINE` / `INVESTIGATE` / `BLOCK_RELEASE`. Signals: test_statuses, quarantined_tests, stale_quarantine, cost_delta_ratio, drift_confidence, drift_is_downward, execution_failures. Hard-regression → BLOCK; soft → INVESTIGATE; cost +10% → INVESTIGATE.
- **Drift tracker** (`evalview/core/drift_tracker.py`): temporal OLS slope across check history; gradual decline detection (0.97 → 0.95 → 0.93 flagged). **Drift classifier** (NONE / WEAK / MEDIUM / STRONG) with flipped-prompt counting and suite-size aware thresholds.
- **Golden baseline system** with up to 5 variants per test (`.evalview/golden/`); auto-save + approval workflow (`--approve-generated`); multi-variant clustering for non-deterministic agents (`--statistical --auto-variant`).
- 10 evaluators: tool / sequence / output / cost / latency / hallucination (Ragas-style claim extraction + verification) / safety (LLM + OpenAI Moderation API) / PII / statistical.
- **Test generation** (`evalview generate` / `autopr`): drafts from live agents or production logs; marked `review_status: draft`; `evalview snapshot --approve-generated` promotes; `evalview monitor --incidents` → `evalview autopr --open-pr` opens regression-test PR via `gh pr create` (deterministic, no LLM).
- **Model-drift detection**: separate zero-judge canary suite (`evalview model-check --model claude-opus-4-5`) catches silent provider model updates.
- Security hardening: `sanitize_for_llm()` strips control chars + truncates to MAX_OUTPUT_LENGTH=10000 + escapes delimiters; `create_safe_llm_boundary()` wraps untrusted output before judge call.
- 5 auto-detected eval profiles (chat / tool-use / multi-step / rag / coding) with tailored thresholds. Per-test weight override (defaults: tool 30% / output 50% / sequence 20%). **Forbidden tools = hard fail** (score 0, never auto-healed).
- 19 agent adapters: LangGraph / CrewAI / OpenAI Assistants / Claude Code / OpenClaw / Ollama / Anthropic / OpenAI / Mistral / Cohere / HuggingFace / Goose / Aider / Pydantic AI / Tapescope / MCP / GooseCode / OpenCode + generic HTTP.
- **MCP server** (`evalview mcp serve`, stdio, 8 tools: create_test, run_snapshot, run_check, list_tests, validate_skill, generate_skill_tests, run_skill_test, generate_visual_report). Pytest plugin with `evalview_check` fixture.
- Slack notifier (Block Kit), pre-push git hooks (`evalview install-hooks`), HTML report with flamegraph-style sequence view.
- **Recommended:** adopt eval-view wholesale as the §31 eval implementation. Build adapter for orchestrator's domain (MCP tools instead of just chat), reuse verdict + drift + golden + judge + auto-PR layers as-is.

### `LongTracer` — Python RAG hallucination + tracing framework
- Custom span context manager `with tracer.span(name, run_type, inputs)` (`/longtracer/guard/tracer.py:154-220`); multi-project tracer registry (`LongTracer.get_tracer(project_name)`). Pluggable backends: SQLite (default `~/.longtracer/traces.db`), Postgres, MongoDB, Redis, Memory.
- Verifier: sentence-transformers STS bi-encoder + nli-deberta-v3-xsmall NLI cross-encoder; `VerificationResult` with `trust_score`, `claims`, `flagged_claims`, `hallucinations`, `verdict`.
- Adapters for LangChain / LangGraph / LlamaIndex / Haystack callback systems.
- **No OTel, no Langfuse** — same gap as the other 16 repos. Confirms §27 OTel + Langfuse stack is fully greenfield.
- Useful patterns: span-lifecycle context manager, multi-project isolation pattern, backend factory abstraction. Python-only; reference value, not portable.

### Batch 2 net-new vs prior 13
- **First TS MCP server with the full §16 context-pack pipeline** (context-fabric): drift detection + token budgeting + hybrid ranking + injection guard + briefing assembly. Lift E1–E5 wholesale as the §16 foundation.
- **First Streamable HTTP MCP transport** with session lifecycle (indxr Rust). Best concrete reference for §22.
- **First production eval framework matching §31 + §17 directly** (eval-view): multi-provider LLM-as-judge + verdict layer + drift tracker + golden + auto-PR + model-drift canary. Adopt wholesale.
- **First proactive MCP resource-pinning pattern** (mengram `memory://profile` auto-load) — plan refinement candidate for §14 (e.g., `orchestrator://session/current/preflight` auto-pinned).
- **First experience-driven procedure evolution** (mengram failure → LLM repair → versioned procedure) — relevant for §6 DRIFT_DETECTED handling.
- **First SSRF / sandbox / env-hygiene patterns** (statespace) — fit §30.
- **First MCP-as-client session management** (plano filter type + JSON-RPC) — direct reference for §19 Rovo upstream mediation.
- **First grammar-constrained JSON output** (ATLAS via llama.cpp GBNF) — alternative to JSON-mode for guaranteed-valid structured outputs in §14 / §23.
- **Confirmed: no OTel + Langfuse stack across 18 repos** (LongTracer also lacks). §27 is fully greenfield.
- **Confirmed plan refinement candidates added:**
  - Tool-collapse pattern: 3 compound tools default + N granular behind `--all-tools` flag (indxr) — addresses §34 tool-sprawl risk.
  - Token budgeting against 22+ hardcoded model context sizes (context-fabric) instead of single targetModel.
  - 5-step progressive truncation order: doc comments → private decls → children → leaf files → final (indxr) for §16.
  - FTS5 BM25 with column weights (path 2.0 / summary 1.5 / outline 1.2 / exports 1.0) (context-fabric) as the metadata-search component of §16 hybrid ranking, alongside Qdrant cosine.
  - 4-tier verdict shape (eval-view) for §17 readiness output: SAFE_TO_SHIP / SHIP_WITH_QUARANTINE / INVESTIGATE / BLOCK_RELEASE.
  - Hard-fail forbidden-tools list at evaluator boundary (eval-view) as the shape of write-guard violation handling (§30).

## Batch 3 (agent frameworks + research)

### `agent-maestro` — **TS/Tauri/React multi-agent orchestrator** (high value, §6 + §24)
- Express server + Node CLI + Tauri 2/React 18/Zustand desktop. Same TS stack as plan.
- **Four-mode agent model**: worker / coordinator / coordinated-worker / coordinated-coordinator.
- **Five workflow strategies**: simple / queue / tree / intelligent-batching / **DAG with topological wave execution** (richer than plan's `queued → running → succeeded|failed|retrying`).
- **WebSocket coordination**: 50ms batching, per-entity throttling, 1MB backpressure, immediate-event bypass.
- **File-based persistence**: atomic writes (temp + rename), LRU cache (5000 tasks), secondary indexes, parallel loader, 500ms write batching.
- **Manifest-driven agent spawning**: server generates `~/.maestro/sessions/{sessionId}/manifest.json`, CLI reads + injects full system prompt. Multi-provider spawners (Claude / Codex / Gemini).
- **Per-session git worktrees** (`maestro/{sessionId}` branches) — direct fit for sandboxed M6c VCS provisioning.
- Hierarchical task decomposition (parentId + sessionIds[] many-to-many). Team-of-teams (subTeamIds). Capability-based command gating per mode. Session timeline events (11+ types).
- Tests: Jest (server) + Vitest (CLI/UI) with strong unit coverage; integration tests partial.
- Plan refinement candidates: 4-mode model for §14 actor categorization; DAG topological waves for §24; manifest-driven spawning as `handoff_generate` output shape (§14); per-session worktree for M6c.

### `open-multi-agent` — **TS multi-agent orchestration v1.1.0** (high value, §7 + §14 + §24)
- ~5.5k stars. Drop-in TS implementation of orchestration layer.
- **TaskQueue (469 LoC)** dependency-aware event-driven: states pending → blocked → in_progress → completed/failed/skipped; methods add/skipRemaining/cascadeFailure/cascadeSkip; events task:ready/complete/failed/skipped/all:complete.
- **4 scheduling strategies**: round-robin / least-busy / **capability-match (bidirectional keyword scoring)** / **dependency-first (critical-path: count blocked dependents, sort descending)**.
- **Approval gate** `onApproval(completedTasks, nextTasks) → Promise<boolean>` with skip-cascade on rejection. **Direct fit for §7 PolicyDecisionLayer mid-execution checks.** 13 test cases.
- **MessageBus** (per-agent read-state tracking, point-to-point + broadcast).
- **3-layer Semaphore concurrency**: pool (default 5) + per-agent mutex + tool-level (default 4).
- **MCP stdio integration** with lazy dynamic load of `@modelcontextprotocol/sdk` peer dep.
- **SharedMemory** namespaced KV with `getSummary()` markdown digest auto-injected into prompts.
- **Multi-provider LLM**: Anthropic / OpenAI / Grok / GitHub Copilot / Gemini / Ollama / vLLM / LM Studio / llama.cpp.
- **Trace events** (`onTrace`) with runId correlation — direct hookup for Langfuse/OTel (§27).
- Token budget per agent + retry with exp backoff (cap 30s); loop detection; built-in tools (bash/file_read/file_write/file_edit/grep/glob) with allowlist/denylist + readonly/readwrite/full presets; Zod-validated structured output with one-retry on validation failure.
- 16 runnable examples (orchestration-agent, deep-research, fan-out, multi-perspective-code-review, MCP).
- Vitest 88% coverage. Three runtime deps only (anthropic SDK + openai + zod). Decisions doc explains "won't do" (handoffs, state persistence, A2A) — clean design choices.
- **Recommended:** lift TaskQueue + Scheduler + MessageBus + AgentPool + SharedMemory wholesale for §24; bind approval gate to PolicyDecisionLayer (§7); wire `onTrace` to Langfuse + OTel (§27).

### `agentdiff` — **first cryptographic audit-signing infrastructure** (high value, §30)
- Rust + Agent Trace v0.1.0 JSONL spec (Cognition / Cursor / Vercel / Cloudflare alignment).
- **ed25519 + RFC 8785 JCS canonicalization** (`json-canon` crate). Key ID = first 16 hex chars of SHA256(pubkey).
- **Key registry stored in git refs**: `refs/agentdiff/keys/{key_id}:pub.key` — distributed verification without manual key exchange.
- **3-tier trace storage**: `.git/agentdiff/traces/{branch}.jsonl` (local) → `refs/agentdiff/traces/{branch}` (per-dev) → `refs/agentdiff/meta` (CI consolidated).
- **MCP server** (`agentdiff-mcp.rs`, stdio) with `record_context` tool for pre-commit context capture (writes `.git/agentdiff/pending.json` for ledger attachment).
- **7 agent capture hooks** — direct adopt for §8 install docs:
  - Claude Code: `~/.claude/settings.json` PostToolUse
  - Cursor: `~/.cursor/hooks.json` afterFileEdit + afterTabFileEdit
  - GitHub Copilot: `~/.vscode/extensions/`
  - Windsurf: `~/.codeium/windsurf/hooks.json` post_write_code
  - OpenCode: `~/.config/opencode/plugins/` tool.execute.after
  - Codex: `~/.codex/config.toml` notify
  - Gemini/Antigravity: `~/.gemini/settings.json` BeforeTool/AfterTool
- **Policy-as-TOML** (`.agentdiff/policy.toml`): `max_ai_percent`, `require_attribution`, `require_signed`. Pattern for plan §7 obligations.
- Diff command parses git hunks, maps lines to entries, computes AI-attributed % of PR.
- Rust language; the spec, signing algorithm, and key-registry-in-git pattern transfer.
- **Plan refinement candidate:** adopt git-ref key registry for §30 audit chain (avoids dependency on KMS/Vault for key distribution; works offline; survives squash via UUID dedup).

### `open-edison` — **Python MCP security gateway** (high value, §7 + §30)
- FastMCP 2.11.3 + FastAPI dual-port (MCP on 3000 / mgmt API on 3001). Single-user gateway, GPLv3.
- **Lethal trifecta monitoring** (`/src/middleware/data_access_tracker.py`): three flags — `has_private_data_access` + `has_untrusted_content_exposure` + `has_external_communication`. Blocks completion of all three. **Direct fit for §7 access gate** as a baseline safety check before the cached/vector hits run.
- **Wildcard-pattern permissions JSON** (`/src/permissions.py`): `ToolPermission` / `ResourcePermission` / `PromptPermission` dataclasses with **PUBLIC(0) < PRIVATE(1) < SECRET(2) ACL ranking**. Wildcard patterns (`filesystem/*`, `file:*`, `template:*`). Plan refinement candidate: combine with §7 obligation effects (`allow | deny | require_approval`).
- **Session tracking middleware** with SQLAlchemy ORM (sessions.db); records tool calls, data access summary, blocked counters; served at `/dashboard/sessions.db` for browser-side sql.js queries.
- **OpenTelemetry** wired with opt-out + install-unique deaggregation ID. Counters: tool_calls_total, tool_calls_blocked_total, private_data_access_calls_total, untrusted_public_data_calls_total, write_operation_calls_total. **First OTel-wired repo across 27 evaluated** (uio had Langfuse+Prometheus only).
- **MCP importer** for Cursor / VS Code / Claude Code configs.
- **LangGraph integration** via `@edison.track()` decorator (low-friction agent observability).
- Electron desktop app with auto-updater + Cursor/Claude Code desktop extension (`open-edison-connector.dxt`).
- OAuth manager with FastMCP `FileTokenStorage`.
- React 18 + Vite + Tailwind + sql.js + chart.js + D3 dataflow visualization.
- **Plan refinement candidates:** lethal-trifecta safety check shape; PUBLIC/PRIVATE/SECRET ACL + wildcard permission JSON; dual-port (MCP on 3000 / API on 3001) as alternative to single-port; install-unique deaggregation ID for opt-out OTel.

### `atomic-agents` — Python agent framework (multi-transport MCP **client**)
- Python 3.12+, Instructor 1.14.5 + Pydantic ≥2.11. v2.7.5.
- **First multi-transport MCP CLIENT** seen: STDIO + SSE + HTTP Stream (`MCPTransportType` enum). Persistent ClientSession reuse via AsyncExitStack. Direct reference for §19 Rovo upstream mediation (orchestrator-as-MCP-client).
- **Bidirectional Schema Transformer**: JSON Schema ↔ Pydantic models (`/atomic-agents/atomic_agents/connectors/mcp/schema_transformer.py`).
- **Turn-based session tracking** with UUID `turn_id` (groups multi-agent steps).
- **Dynamic context provider registry** (`BaseDynamicContextProvider`): runtime context injection into system prompt — pattern for §14 elicitation hooks and §16 freshness updates.
- **Hook dispatch with error isolation**: events `parse:error`, `completion:kwargs`, `completion:response`, `completion:error`, `completion:last_attempt`. Per-handler try/except so hook failures don't crash agent.
- **LiteLLM provider-agnostic token counting** (OpenAI, Claude, Gemini, etc.) — useful for §16 token budgeting cross-provider.
- **Prompt-assembly DSL**: `SystemPromptGenerator(background=[...], steps=[...], output_instructions=[...])` + dynamic context providers.
- Streaming with partial Pydantic models (jiter for partial JSON parsing).
- BaseTool / BaseResource / BasePrompt generic abstractions with PEP 560 type capture.
- Python; patterns transfer.

### `agentdiff` net-new highlight (already covered above): **first cryptographic signing**.

### `autoagent` — Python autonomous agent engineering harness
- Two SDK harness templates: OpenAI Agents SDK + Claude SDK side-by-side. Plan §23 sampling fallback reference (host-delegated vs direct-API).
- **ATIF (Agent Trajectory In Flight) trajectory schema** v1.2/v1.6: standardized JSON capturing `source` / `message` / `tool_calls` / `observations` / `reasoning` per step. Could combine with LongTracer span pattern for §27.
- Meta-agent loop with `program.md` as human-authored research directive.
- Harbor benchmark integration. Docker sandboxing. `permission_mode="bypassPermissions"` documented as security trade-off (anti-pattern).
- Python; patterns transfer.

### `three-man-team` — Pure prompt framework (no code, but high-value patterns)
- 3-agent template (Architect "Arch" / Builder "Bob" / Reviewer "Richard") for Claude Code workflows. v1.1.0 (Apr 2026), production-validated (shipped real SaaS).
- **File-based handoff protocol** (no conversation): ARCHITECT-BRIEF → REVIEW-REQUEST → REVIEW-FEEDBACK + shared BUILD-LOG + SESSION-CHECKPOINT. Eliminates token waste structurally, not behaviorally.
- **Persona vocabulary routing** (DeepMind-cited): "you are Richard, 75yo war-era craftsperson with discipline ethic" activates richer training patterns than "you are a code reviewer."
- **Deploy gate**: Architect summarizes → tells Project Owner → PO approves → commit + deploy + log + checkpoint. Prevents "technically correct, wrong for the business."
- **Checkpoint-first resume**: SESSION-CHECKPOINT.md replaces full spec re-read on session start.
- **Token discipline rules** (CLAUDE.md, ~50 lines): Grep-before-Read, no speculation, parallelize tool calls, route >20-line outputs to subagent, no restatement of user input.
- **Three-agent optimum** per cited DeepMind multi-agent research (3–5 with artifact handoffs > solo or large).
- **Documented gotcha**: Builder/Reviewer Agent-tool subagents must run **foreground** — background mode stalls on Edit-tool approval requests with no one to approve. Worth capturing in plan §8 docs/codex.md + docs/claude-code.md.
- Plan-relevant patterns: persona vocabulary routing for §14 prompts; file-based handoff shape for §16 + §18; deploy-gate accountability for §18 + §30; SESSION-CHECKPOINT pattern for §6 state persistence.

### `autoresearch` — Python autonomous LLM-training framework
- 5-minute single-GPU pretraining loop with Muon+AdamW optimizer, BPB (vocab-size-independent bits-per-byte) metric, `program.md`-driven agent mutation loop.
- Useful patterns only: Observe-Hypothesize-Act-Measure-Decide loop, deterministic acceptance metric, pinned validation split for reproducibility, branch-per-experiment isolation.
- Not infrastructure-relevant. Skip.

### Batch 3 net-new vs prior 13 + batch 1 + batch 2
- **First production TS multi-agent orchestration with topological-wave DAG execution** (agent-maestro + open-multi-agent combined). Pickup TaskQueue + 4-strategy Scheduler + approval gate + MessageBus + 3-layer Semaphore + manifest-spawning + per-session worktrees.
- **First cryptographic signing infrastructure** (agentdiff): ed25519 + JCS + git-ref key registry. Direct fit for §30 hash-chained audit (replaces or augments hash chain with per-entry signatures).
- **First lethal-trifecta + PUBLIC/PRIVATE/SECRET ACL + wildcard permissions** (open-edison). Direct fit for §7 access gate baseline + §30 write guards.
- **First multi-transport MCP CLIENT** (atomic-agents): STDIO + SSE + HTTP Stream. Reference for §19 Rovo upstream mediation.
- **First OpenTelemetry-wired MCP-adjacent repo** (open-edison) across 28 repos. Counters template directly applicable to §27.
- **First persona-vocabulary-routing + file-handoff prompt framework** (three-man-team): adopt persona shape for §14 prompts; file-handoff shape for §18 preview/approve/execute serialization; deploy-gate for §18 approval flow; foreground-agent-subagent gotcha for §8 docs.
- **First seven-MCP-host capture-hook inventory with explicit config paths** (agentdiff). Adopt for §8 docs.
- **ATIF trajectory schema** (autoagent) — standardized agent execution capture format; combine with LongTracer span pattern for §27.
- **Plan refinement candidates added:**
  - **Adopt agent-maestro's 4-mode model** (worker / coordinator / coordinated-worker / coordinated-coordinator) for §14 tool actor categorization.
  - **Adopt agent-maestro's 5 workflow strategies** (simple / queue / tree / intelligent-batching / DAG-with-topological-waves) for §24 instead of single linear queue → run pattern.
  - **Adopt open-multi-agent's `onApproval(completedTasks, nextTasks)` callback shape with skip-cascade** as the §7 PolicyDecisionLayer mid-execution check signature.
  - **Adopt open-multi-agent's 4 scheduler strategies** (round-robin / least-busy / capability-match / dependency-first) for §24 worker selection.
  - **Adopt agentdiff's git-ref key registry** (`refs/agentdiff/keys/{key_id}:pub.key`) instead of KMS for v1 audit-chain key distribution; KMS becomes optional post-v1.
  - **Adopt open-edison's lethal-trifecta** as the baseline safety check before §7 access gate runs (cheap, deterministic, complementary to ACL).
  - **Adopt open-edison's PUBLIC(0) < PRIVATE(1) < SECRET(2) ACL ranking** with wildcard-pattern permission JSON as the §7 PolicyDecisionLayer base.
  - **Adopt open-edison's dual-port architecture** (MCP on 3000 / mgmt API on 3001) — clean separation between MCP transport and admin/health/dashboard endpoints.
  - **Adopt agent-maestro's per-session git worktree** pattern (`orchestrator/{sessionId}` branches) for sandboxed M6c VCS provisioning.
  - **Adopt three-man-team's persona vocabulary routing** for §14 prompts (named personas + backstories).
  - **Adopt three-man-team's file-based handoff** structure for §18 preview/approve/execute (BRIEF / REQUEST / FEEDBACK files).
  - **Adopt manifest-driven agent spawning** (agent-maestro pattern) as the shape of §14 `handoff_generate` tool output.
  - **Document foreground-only Agent-subagent gotcha** in §8 docs/claude-code.md (background subagent stalls on Edit approval).

## Batch 4 (Claude tooling + sessions)

### `everything-claude-code` — **canonical Claude Code plugin reference (50K+ stars)**
- 14 agents + 58 skills + 35 commands + 9 rules modules + 11 hook scripts + MCP configs.
- **AGENTS.md** with proactive-triggering orchestration strategy.
- **hooks/hooks.json + 11 implementations**: session-start / session-end / evaluate-session / auto-format / typecheck / console.log-warning / compaction-suggestion / git-push-reminder / PR-URL-logging.
- **14 specialized agents** with YAML frontmatter (planner / architect / tdd-guide / code-reviewer / security-reviewer / build-error-resolver / e2e-runner / refactor-cleaner / doc-updater + 4 lang-specific).
- **35 commands** including `/multi-*` orchestration set.
- **mcp-configs/mcp-servers.json** template for 14 standard MCPs (GitHub, Supabase, Vercel, Railway, ClickHouse, Exa, Context7, etc.).
- **4 real-world CLAUDE.md examples** (saas-nextjs, go-microservice, django-api, rust-api).
- Multi-language (en + zh-CN + zh-TW + ja-JP) and cross-platform (Claude Code / Cursor / Codex / OpenCode) with feature-parity table.
- **Critical gotcha**: `.claude-plugin/plugin.json` MUST NOT declare hooks — Claude v2.1+ auto-loads `hooks/hooks.json` by convention. Capture in §8 docs.
- continuous-learning-v2 skill for instinct-based pattern extraction with confidence scoring.

### `claude-code-best-practice` — **Boris-Cherny-endorsed canonical reference**
- 4th most-starred Pakistan repo. v2.1.107.
- **Ancestor/descendant CLAUDE.md loading** for monorepos: walks UP to root immediately at startup; lazy descendant loading on file read; sibling isolation (different branches don't cross-load).
- **5-level settings hierarchy**: Managed > CLI > local > project > user, with **drop-in `managed-settings.d/*.json`** (numeric-prefix ordering after base settings.json).
- **27 documented hook events but only 6 actually fire in agent contexts** (PreToolUse / PostToolUse / PermissionRequest / PostToolUseFailure / Stop / SubagentStop) — critical gotcha for §14.
- **Frontmatter schemas**: Agent 16 fields (name / description / tools / disallowedTools / model / permissionMode / maxTurns / skills / mcpServers / hooks / memory / background / effort / isolation / initialPrompt / color); Command 14 fields; Skill 14 fields.
- **3-scope MCP precedence**: Subagent > Project > User; settings keys `enableAllProjectMcpServers` / `enabledMcpjsonServers` / `disabledMcpjsonServers`.
- **Reddit-vetted top 4 MCPs**: Context7 (docs) + Playwright (browser) + Claude in Chrome + DeepWiki (repo wiki).
- **Permission deny precedence** + wildcards (`mcp__*`, `mcp__server__tool`, `Bash(rm *)`).
- **Auto Mode** with background safety classifier (replaces manual prompts).
- **MEMORY.md auto-injection**: first 200 lines auto-injected into agent system prompt; topic-file curation when exceeded.
- **`skills:` preloaded** (frontmatter, injected into system prompt) vs **`Skill()` invoked** (dynamic) — distinct mechanisms, easy to confuse.
- **/loop and /schedule** for recurring tasks; **/context / /cost / /stats / /insights** observability commands.
- **/branch / /diff / /rewind** for git checkpointing + worktree.

### `claude-code-production-grade-plugin` — **14-agent enterprise SaaS pipeline (v4.1.0)**
- **4 shared protocols** in `skills/_shared/protocols/`: ux-protocol.md (6 interaction rules) / input-validation.md (5-step Critical/Degraded/Optional classification) / tool-efficiency.md (Grep before Read, parallelize, smart_outline) / conflict-resolution.md (authority-hierarchy table by artifact + dedup by file:line + 2-cycle HARDEN→BUILD loop).
- **Skill frontmatter "Use when..." intent-routing** model — different from keyword-based.
- **4 engagement modes** (Express / Standard / Thorough / Meticulous) propagated to all 14 agents via `settings.md`. Controls interview depth, decision surfacing, output verbosity.
- **`.production-grade.yaml`** config schema (project / paths / preferences / features) auto-generated for brownfield projects.
- **`activation-rules.json`** dual-layer hook matching: keywords + intent regex patterns. UserPromptSubmit hook event. File-based session deduplication (`.orchestrator/activation-log.json`, 30-min window).
- **Brownfield detection** via parallel Glob scans (package.json, go.mod, pyproject.toml, Cargo.toml, pom.xml, src/**, services/**, Dockerfile*, terraform/**) + codebase-context.md safety rules ("NEVER overwrite existing files without explicit approval", "MATCH existing code style", "ADD to existing dirs, don't replace").
- **Two-wave parallel execution**: Wave A (analysis + build, 7+ concurrent agents) → Wave B (execution against code, 4+ agents × 3-4 internal agents).
- **Phase-based router pattern** for large skills (e.g., software-engineer split into context / implementation / cross-cutting / integration / local-dev phases for token efficiency).
- **Polymath 6 dialogue modes**: onboard / research / ideate / advise / translate / synthesize.
- **Workspace artifact structure** under `Claude-Production-Grade-Suite/`: `.protocols/` + `.orchestrator/` (settings, codebase-context, activation-log, per-skill workspaces).
- **Auto-update with consent**: version check vs GitHub release; prompt only if newer.

### `claude-workflow-v2` — **7-agent plugin with adversarial verification**
- 7 specialized agents (orchestrator / code-reviewer / debugger / docs-writer / security-auditor / refactorer / test-architect) with auto-triggering trigger keywords.
- **6-phase workflow**: UNDERSTAND → PLAN → DELEGATE → INTEGRATE → VERIFY → DELIVER.
- **Parallel execution protocol**: ALL `Task` calls MUST be in **single assistant message** for true parallelism (sequential messages break it). Direct constraint to capture in §24.
- **Verification pipeline with adversarial review** (direct fit for §18):
  - Phase 1: 5 parallel verifiers (syntax-check / tests / lint / security / build).
  - Phase 2: 3 adversarial subagents — **false-positive filter / missing-issues finder / context validator**.
  - Phase 3: PASS/FAIL synthesis.
- **Action-first directive**: tool calls before text output, "read first respond second", "never write a paragraph explaining — just do it".
- **Effort scaling**: Instant (typo) / Light (single-file) / Deep (multi-file) / Exhaustive (architecture).
- **PLAN.md persistence** with phases / dependencies / architecture decisions / open questions / progress log — resumable workflow tracking.
- **Hook event registry (JSON)**: PreToolUse(Edit|Write, Bash) / PostToolUse(Edit|Write) / Stop / SessionStart / UserPromptSubmit / Notification.
- **Skill on-demand loading** with "When to Load" sections per skill.

### `claude-agent-builder` — **6-phase agent generation meta-skill**
- **6-phase workflow**: Context Scan → Discovery → Research (parallel 4-track) → Architecture → Build → Verify with explicit approval gate at Phase 3.
- **7 multi-agent patterns** with working examples: Command→Agent→Skills / Research→Consolidate→Plan→Execute / Parallel Specialists / Self-Evolving (memory) / Hook-Guarded / Slash-Command-Handoff / MCP-Powered.
- **Python validation script** (validate_agents.py): YAML frontmatter checks (name lowercase-hyphens / description quality + trigger keywords / tool allowlist / model enum / permissionMode enum / system-prompt 20–2000 words / file naming).
- **Python scaffolding script** (scaffold_agent.py) for 5 primitive types (subagent / skill / command / hook / full-stack).
- **Primitives decision tree** for selecting subagent vs skill vs command vs hook vs MCP.
- **Description trigger keywords**: "Use PROACTIVELY when...", "MUST BE USED when...", "Use after..." — drive auto-delegation.
- Direct fit for §14 `handoff_generate` tool — adopt 6-phase workflow as the prompt template, 7 patterns as a selectable generation library.

### `claude_agent_teams_ui` — **Electron+React multi-agent UI** (novel patterns)
- Electron 40 + React + TypeScript + pnpm workspaces, AGPL-3.0. **Zero outbound network calls** except GitHub auto-updater.
- **MCP server** in workspace subpackage (`mcp-server/`) using **FastMCP** + 7 tool groups (task / kanban / review / message / process / runtime / crossTeam) over stdio.
- **Inbox-file-based async messaging**: `~/.claude/teams/{team}/inboxes/{member}.json` written atomically; fs.watch triggers agent read on next turn. **Async message queue without HTTP/gRPC** — alternative pattern to Redis pub/sub for §24 inter-job messaging.
- **Hunk-level code review** with merge3 conflict resolution (`node-diff3` v3.2.0). Per-hunk accept/reject. Direct fit for M6c PR provisioning approval workflow.
- **6-category token tracking**: claude-md / mentioned-file / tool-output / thinking-text / team-coordination / user-message — per-turn breakdown with phase tracking across compaction. **Plan refinement candidate**: more granular than aggregate token count for §16 budgeting.
- **Post-compact context recovery**: detects compaction via ChunkFactory; re-injects team-management instructions to preserve coordination state. Direct fit for §6 DRIFT_DETECTED handling.
- **Action mode capability injection**: inject capability/constraint blocks (read-only, approve-each-tool) without code change. **Plan refinement candidate** for §7 PolicyDecisionLayer obligations.
- **CrossTeamProtocol**: formal message schema with conversation IDs + chain depth + actionMode flags.
- **Team provisioning state machine**: explicit async stages (spawning → configuring → verifying → ready) with partial-launch recovery markers. Direct fit for §6.
- **SSE real-time events** at `/api/events` with 30s keep-alive — no polling for kanban + process dashboard updates. Direct fit for §24 job progress subscriptions (alternative to MCP `notifications/resources/updated`).
- **TeamInboxReader deterministic message IDs**: `sha256(from + timestamp + text)` — natural dedup. Pattern for §26 webhook delivery dedup keys.
- **Atomic file writes** + file locks for concurrent-write safety. **LRU caching** (LeadSessionParseCache, TaskChangeSummaryCacheRepository).
- **5-column kanban** (TODO → IN_PROGRESS → REVIEW → DONE → APPROVED) with dnd-kit.
- **Multi-provider support** with auto-detection: Anthropic (Claude) + Codex (OpenAI) + Gemini (Google).

### `claude-code-log-analyzer` — **Python session-log parser** (high value §27)
- 3 SQLite DBs (arc_analytics / gate_analytics / chat_analytics) populated from Claude Code JSONL session logs.
- **Comprehensive session-log schema parser**: entry types (user / assistant / tool_use / tool_result / summary / message); fields (timestamp, message.content[], tool_use.{name, tool_use_id, input}, bidirectional tool_use_id linkage).
- **Span extraction**: arc (work unit with duration_minutes / autonomy_level / agents_spawned / human_interrupts / intent / completion_status), agent_session (start/end/duration/message_count/tool_calls/file_path), gate_check (decision / feedback / error_class / execution_time).
- **Multi-format tool-result parser** (`parse_review_result`): 5+ JSON patterns + plain-text + regex fallback.
- **Go-style duration parser** (`parse_go_duration`: `1m24.5s` → seconds, handles ms vs m, fractional, unicode microseconds).
- **Markdown-table + severity-block + JSON issue extraction** from feedback (`extract_issues_from_feedback`).
- **Enums** worth adopting:
  - Autonomy: interactive / quick / build / feature / release.
  - Intent: implement / fix / refactor / test / review / deploy / docs / explore / config / other.
  - Decision: APPROVED / NEEDS_REVISION / ESCALATE / UNKNOWN.
  - ErrorClass: SYSTEMATIC / INCOHERENT / OMISSION / API_ERROR.
  - GateType: review_plan / review_design / review_code / codereview / precommit / validation / qa / audit.
  - Severity: critical / high / medium / low / warning / info.
- Two-pass classification pattern (regex → LLM fallback) reduces API cost. Gemini Flash Lite for boundary detection + decision/error classification.
- Combine with LongTracer span pattern + agentdiff signing for full §27 observability stack.

### `claude-sessions` — Bun Claude Code plugin for session resumption
- Hooks: Stop (async, every Claude response) + SessionEnd (detached `--final-bg` subprocess to avoid blocking shutdown).
- **Incremental Haiku-based summarization** via `claude -p --model haiku --no-session-persistence` CLI (cost-optimized; no API credits consumed via CLI).
- Initial full analysis at first message; delta analysis every 5 messages thereafter; final consolidation on SessionEnd.
- **HTML-comment-delimited markdown checkpoints** in `SESSION_SUMMARIES.md` for idempotent updates.
- Status enum: completed | in-progress | exploring | debugging.
- Stale session auto-finalization (>4 days inactive).
- Polished web UI (Blokjs framework, Tailwind) with localStorage filtering, fuzzy search, status badges, one-click resume command copy.
- Bun-only runtime; gotcha: sessions data unencrypted in `~/.claude/session-tracker/sessions-data.js`.

### Batch 4 net-new vs prior 21
- **Most comprehensive Claude Code host-config inventory** — combine `everything-claude-code` (14 standard MCPs) + `claude-code-best-practice` (Boris-endorsed scope precedence) for §8 docs/claude-code.md.
- **Adversarial verification pattern** (claude-workflow-v2): 5 parallel verifiers + 3 adversarial subagents (false-positive filter / missing-issues finder / context validator) → PASS/FAIL synthesis. Strongest §18 preview/approve/execute pattern in the survey.
- **Critical hook-event-fires-in-agent-context gotcha**: claude-code-best-practice documents that of 27 hook events, **only 6 fire in agent contexts** (PreToolUse / PostToolUse / PermissionRequest / PostToolUseFailure / Stop / SubagentStop). Capture in §14.
- **Inbox-file async messaging** (claude_agent_teams_ui): durable file-based queue with fs.watch triggers, atomic writes, deterministic SHA256 message IDs. Alternative to Redis for §24 inter-job messaging (esp. relevant for single-tenant local deployments).
- **Hunk-level code review** with merge3 (claude_agent_teams_ui) — direct fit for M6c PR provisioning approval workflow.
- **6-category token tracking** (claude_agent_teams_ui): claude-md / mentioned-file / tool-output / thinking-text / team-coordination / user-message — far more useful than aggregate count for §16 budgeting.
- **Post-compact context recovery** (claude_agent_teams_ui) — re-inject coordination state after Claude compacts.
- **Action mode capability injection** (claude_agent_teams_ui): inject "read-only" / "approve-each-tool" constraints without code change. Direct fit for §7 PolicyDecisionLayer obligations.
- **`.production-grade.yaml`** + `activation-rules.json` dual-layer (keywords + intent regex) hook matching with file-based session dedup (claude-code-production-grade-plugin) — direct adopt for §8.
- **4 shared protocols** (claude-code-production-grade-plugin): ux-protocol / input-validation / tool-efficiency / conflict-resolution — adopt as governance layer in plan repo.
- **Brownfield detection** with codebase-context.md safety rules (claude-code-production-grade-plugin) — adopt for tenant onboarding when an existing project is being adopted.
- **Two-wave parallel execution** (claude-code-production-grade-plugin) and **single-message Task-call rule** (claude-workflow-v2) for §24 parallelism.
- **6-phase agent-generation workflow + 7 patterns** (claude-agent-builder) — direct fit for §14 `handoff_generate`.
- **Ancestor/descendant CLAUDE.md loading** (claude-code-best-practice) — adopt for the new repo's monorepo if needed.
- **MEMORY.md auto-injection (200-line limit)** (claude-code-best-practice) — pattern for plan §14 `orchestrator://session/current/preflight` proactive resource pinning.
- **Comprehensive Claude Code session-log JSONL parser** (claude-code-log-analyzer) — direct §27 telemetry source.
- **Six observability enum families** (claude-code-log-analyzer): autonomy / intent / decision / error_class / gate_type / severity — adopt as standard taxonomy for §27 telemetry.
- **Plan refinement candidates added:**
  - **Adopt 6-category token tracking** (claude-md / mentioned-file / tool-output / thinking-text / team-coordination / user-message) for §16 instead of single aggregate.
  - **Adopt action mode injection** as §7 PolicyDecisionLayer obligation shape (read-only / approve-each-tool capability blocks).
  - **Adopt single-message Task-call constraint** for §24 parallelism documentation.
  - **Adopt adversarial verification triplet** (false-positive filter / missing-issues finder / context validator) as §18 preview validation step.
  - **Adopt brownfield detection + codebase-context safety rules** for tenant onboarding (when adopting an existing project repository).
  - **Adopt deterministic message IDs** (`sha256(source + timestamp + content)`) for §26 webhook delivery dedup keys.
  - **Adopt the 4 shared protocols** structure (ux / input-validation / tool-efficiency / conflict-resolution) as the new repo's governance layer.
  - **Adopt the 6-observability-enum taxonomy** (autonomy / intent / decision / error_class / gate_type / severity) for §27 telemetry attributes.
  - **Capture 6-of-27 hook fire-in-agent gotcha** in §14 docs to avoid silent-failure traps.
  - **Capture plugin.json-must-not-declare-hooks gotcha** (Claude v2.1+ auto-loads `hooks/hooks.json`) in §8 docs.

## Batch 5 (frameworks / skills / foundations)

### `project-foundation-workbench` v1.4.0 — **framework governance template** (high value, §6 + §14 + §31)
- The framework that project-foundation (concrete TS monorepo) was built from. Pure templates + standards; no app code.
- **3-tier work decomposition**: REQ-{DOMAIN}-{NNN} → FEAT-{DOMAIN}-{NNN} → SPEC-{DOMAIN}-{FEAT}-{NN}, each spec atomic + implementable in one session, traceability mandatory via FEATURE_INDEX.md. Maps onto §6 + §10 ProjectBlueprint hierarchy.
- **5-category test framework** (UT/IT/ST/PT/E2E) with **mandatory auditable "Not applicable" claims** when ST/PT/E2E skipped — direct fit for §17 readiness rubric and §31 testing strategy.
- **Autonomy policy** (AGENTS.md): execute specs to completion; stop only if (spec done / ambiguity / security decision / unrecoverable error / missing dep). 3-fix-attempt threshold per error then mark blocked + skip. Direct fit for §24 retry policy.
- **PHASE-STATE.json orchestration** (14 phases, schema-validated): tracks `current_phase`, `current_task`, all task statuses, **`locked_spec` for concurrent-safety** (skip on conflict, no waiting). Checkpoints written to `workflow/orchestration/checkpoints/` before stopping. `/resume` command reads latest checkpoint. **More sophisticated than plan §6 enum-only state machine.**
- **14 slash commands**: `/inception` `/decompose [FEAT]` `/groom` `/wave` `/implement [SPEC]` `/review` `/translate-research` `/sync` `/drift-check` `/sync-configs` `/run-wave` `/resume` `/build` `/build-continue`. Adopt as the orchestrator's command surface.
- **Unidirectional sync architecture** (`SYNC.md`): repo (source of truth) → Notion/Linear (read-only visibility), **agents NEVER read tracker state for decisions**. Tracker outage non-blocking. Direct fit for §35 + §10 (orchestrator reads repo, pushes to external).
- **Context source hierarchy**: (1) Project files [highest] (2) Stack reference files (3) Context7 MCP / live docs (4) Training knowledge [lowest]. Adopt explicitly in §14 docs/codex.md + docs/claude-code.md.
- **Notion 3-database schema** (Requirements / Features / Specs) with cross-database relations + Domain select + Status status + views (board by Status/Domain, timeline by Wave). Direct fit for §35 if Notion ever becomes a target.
- **Agent config shim auto-generation**: `scripts/sync-agent-configs.sh` regenerates `.cursor/rules/agents.mdc` and `.github/copilot-instructions.md` from canonical AGENTS.md. Single source of truth pattern. CLAUDE.md is hand-authored (intentionally diverges).
- **Tech Stack Standard v2025** (Matthew Effect rationale): Better Auth (Lucia deprecated Mar 2025) / Drizzle ORM (vs Prisma v7) / tRPC v11 + Hono v4 / Expo SDK 52 (90-100% business logic share, 40-70% UI) / Trigger.dev v3 (vs BullMQ for self-hosted background jobs).
- **PCI DSS 4.0 SAQ A baseline**: script inventory + SRI + CSP monitoring, MFA 15min/8hr session policy for Platform Admins, webhook HMAC + idempotency, RLS multi-tenancy. Direct fit for §30.
- **Large file handling rule**: never read >200 lines all-at-once; use offset+limit (150–200 per read). Adopt as agent operating rule.
- **Plan refinement candidates:** PHASE-STATE.json with lockable checkpoints (richer than §6 enum); 5-category test framework + auditable Not-Applicable; unidirectional sync architecture; agent-config-shim auto-generation; context source hierarchy.

### `ai-setup` (= **`@rely-ai/caliber` v1.42.0**) — production multi-platform config-sync CLI (high value, §17 + §10)
- ~32.5K LoC TS, 68 vitest tests, CI on Node 20+22+Windows. NOT MCP server — bootstrapper/orchestrator for agent configs across **5 platforms** (Claude Code / Cursor / Codex / OpenCode / GitHub Copilot).
- **Deterministic local scoring system** (zero-LLM, 6 categories: existence 25 / quality 25 / grounding 20 / accuracy 15 / freshness 10 / bonus 5 → A/B/C/D grade). **Direct fit for §17 readiness rubric** — could combine with eval-view's 4-tier verdict for layered scoring (deterministic Caliber score + verdict-layer LLM judge).
- **5 LLM provider implementations** with `LLMProvider` abstract interface: Anthropic SDK + Vertex SDK + OpenAI-compat + **Claude CLI seat-based** (`claude -p`) + **Cursor ACP seat-based** (`agent acp --trust`). Fallback chains, model recovery, fast-model tier, streaming with inactivity (120s) + total (600s) timeouts. Plan refinement candidate: seat-based vs API-key provider distinction.
- **Monorepo config discovery** (recursive walk up to 4 levels) + **`scopeDiffToDir()`** maps git diff → affected config scopes for partial regeneration.
- **Backup → staging → manifest** pattern for safe writes (`.caliber/backups/` auto-restore via `caliber undo`).
- **Project fingerprinting** with file tree + code analysis + LLM enrichment, cached by file-tree hash.
- **2-second bootstrap pattern** via `npx @rely-ai/caliber bootstrap` injecting `/setup-caliber` skill into `.claude/skills/`.
- **Pre-commit + SessionEnd hook auto-installation** with `caliber refresh --quiet`.
- **Streaming JSON parser** for partial LLM output extraction.
- 20 subcommands (`bootstrap`, `init`, `score`, `refresh`, `regenerate`, `config`, `hooks`, `learn`, `sources`, `skills`, `publish`, `undo`, `status`, `insights`, `recommend`, `uninstall`).
- Conventional-commits auto-versioning + auto-changelog from git log.
- PostHog telemetry with `CALIBER_NO_TELEMETRY` opt-out.
- Windows: explicit Git Bash requirement for hooks; documented one-terminal-at-a-time + Cursor `npm i` vs `curl|bash` UX.

### `superpowers` v4.3.1 — Claude Code skills library (14 skills, ~6,339 lines)
- Multi-platform install: Claude Code plugin / Cursor plugin / Codex symlink (`~/.agents/skills/superpowers/`) / OpenCode plugin (`~/.config/opencode/plugins/superpowers.js` + skills symlink).
- **`lib/skills-core.js`** (208 lines): YAML frontmatter parsing + skill shadowing (personal override defaults).
- **14 skills with composable sequencing**: brainstorming → writing-plans → subagent-driven-development / dispatching-parallel-agents / executing-plans.
- **Two-stage review gate**: spec compliance review ("don't trust report" — independent code inspection) → code quality review.
- **Iron laws**: "NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE" / "NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST".
- **Skill-first protocol with 1% threshold** ("even 1% chance a skill might apply") — adopt for §14 elicitation hooks.
- **Brainstorming hard gates** with graphviz process diagrams (prevents skipping design phases).
- **Hook-based skill injection**: SessionStart reads `using-superpowers` and injects as JSON context to avoid redundant tool calls.
- **Token usage analysis tool** (Python, JSONL session-transcript parsing): per-subagent input/output/cache breakdown + cost estimation ($3/$15 per M).
- **Anthropic skill-authoring best practices** (degrees of freedom: high/medium/low matching task fragility) — adopt for §14 prompt design.
- **Subagent prompts**: implementer-prompt.md / spec-reviewer-prompt.md / code-quality-reviewer-prompt.md.
- **Windows polyglot wrapper** (`hooks/run-hook.cmd`): CMD + bash dual-language syntax with bash discovery (Git for Windows → PATH fallback).
- Direct fits: §14 (skill-first + iron laws + two-stage review), §18 (verification-before-completion), §27 (token analysis script).

### `agentic-coding-handbook` — Modus Create methodology (empirical 45% faster delivery)
- **8 context strategies** explicitly enumerated: (1) implementation plans / (2) well-crafted prompts / (3) Copilot tools (file/folder/search/terminal) / (4) **MCPs (Jira/Confluence/Figma/GitHub)** / (5) visual mockup attachments / (6) project instructions (.copilot-instructions.md) / (7) workspace indexing / (8) conversational memory + small-first scaling. **Direct fit for §35 — UIO mentions Atlassian MCPs explicitly as standard context source**.
- **7 core workflows**: Spec-First (AI generates plan.md + todo.md) / Auto-Validations (AI runs lint/test/complexity → self-corrects) / TDD / Exploratory (Explore → Plan → Code → Commit) / Visual Feedback / Debugging / **Memory Bank**.
- **3 reasoning methods**: Three Experts (simulate 3 expert perspectives, eliminate flawed reasoning) / Self-Refinement Loop (3x critique iterations) / Zero/One/N-Shot.
- **Memory Bank pattern**: 6 persistent `.md` files (projectbrief / productContext / systemPatterns / techContext / activeContext / progress) → references **`@alioshr/memory-bank-mcp`** as MCP-backed memory layer.
- **Model selection table**: Claude (128K, reasoning/debug/architecture/specs) / GPT-4o (128K, fast scaffolding/frontend/prototyping) / Gemini 2.5 Pro (1M, full-repo/DevOps/infra/microservices).
- **Token efficiency cost comparison**: vague 2100 tok/low-quality vs focused 800 tok/high-quality.
- **MCP security table** (6 best practices): official MCPs / env-var secrets / least-privilege keys / trusted middleware / audit unofficial / never closed-source unaudited.
- **ROVO Agent prompt** for user-story decomposition (Senior Agile Analyst breaking stories into 1-day tasks).
- **"Treat every prompt like a commit"** privacy mantra (PRIVACY.md non-negotiables: never real user data / files with PII / live prod DB / training-on-data tools).
- **Org vs project instructions** distinction (org auto-injected for all org members; project local).
- 7 LLM governance principles ("if you wouldn't merge from junior dev, don't do for LLM").

### `thinking-partner` — Standalone reasoning skill (novel framework)
- Pure prompt-based, no code. Multi-platform via Agent Skills standard (Claude Code / Cursor / Windsurf / Cline / GitHub Copilot).
- **Novel in survey: Orientation Detection (GT0–GT5)**:
  - **GT0** No orientation awareness (inertial)
  - **GT1** Conclusion-preservation (identity fusion — evidence bends to defend conclusion)
  - **GT2** Authority-preservation (fused to role, not conclusion)
  - **GT3** Threat-reduction (physiological state drives discomfort-seeking resolution)
  - **GT4** Completion-seeking (output over accuracy)
  - **GT5** Monitor co-option (defense system locked, counter-evidence triggers more defense)
- **7 cognitive operation pairs**: Decouple/Re-couple, Differentiate/Integrate, Match, Monitor/Interrupt, Hold/Resolve, Compress/Expand. Skill is in *oscillation*, not choosing one pole.
- **150+ mental models** across 17 disciplines (`model-catalog.md`, 842+ lines): general thinking, decision-making, problem-solving, systems, physics, biology, economics, statistics, psychology, communication, creativity, learning, time/resource, game theory, negotiation, resilience, ethics. Each with use-when + key diagnostic question + curated pairings.
- **6-step workflow**: Understand (one clarifying Q) → Detect Orientation (silent diagnosis) → Select 2-3 Models → Apply Conversationally → Challenge & Stress-Test → Synthesize & Close.
- **7 assumption-challenging techniques**: Reversal / Outsider Test / Evidence Demand / Steelman / Time Shift / Pre-Mortem / Base Rate Check / Null Hypothesis.
- **Mechanism-specific interventions**: GT5 sticky → "Do NOT argue content — that feeds the defense"; requires external scaffolding, not argument.
- **5 anti-patterns**: Model Dump / Bias Gotcha / Sophistication Trap / Premature Resolution / Uniform Fix.
- **Session types**: Quick Gut-Check (3-5 exchanges) / Deep Exploration (8-15) / Model Tutorial / Decision Audit.
- Direct fit for §14 prompts (`requirements-decomposer`, `architecture-review`, `readiness-reviewer` — "challenge the blueprint" patterns).

### `CodingRepos` parent meta-repo — research synthesis (no app code)
- **`FRAMEWORK-METHODOLOGY-AND-AUDIT.md`** (4781 lines): 20 failure modes (FM-1 to FM-20) with empirical validation (AlphaCodium 19% baseline, Aider 13.5% stub rate, 96% undetected mutations), 4-layer defense-in-depth architecture, 602 features audited.
- **`GOLDEN-PATH.md`** (1409 lines): tech-stack rationale + 9-layer quality gates + MCP integration model.
- **`MIGRATION-GUIDE.md`** (1001 lines): 7-dim risk-assessment table, Phase 0 (non-invasive, zero code changes) + 5 progressive phases.
- **`FEATURE-AUDIT-REPORT.md`** (6557 lines): extraction traceability across 16 source repos.
- **`repos.txt`**: manifest of 50+ repos in V1/V2/V3 versioning. Largely overlaps with this survey's list.
- **Multi-phase orchestration pattern**: Phase 1 extraction → Phase 2 synthesis. Useful template.

### `Archive/ai-coding-framework` — same v1.5.0 as live + Velocity Ops Engine wrapping
- 25-day-ahead worktree (Apr 15 vs Mar 21) with consulting-practice business layer; **no framework divergences**.
- Useful artifact: SDLC documentation taxonomy (126 KB) — 6-tier enterprise SDLC catalog with 45+ artifact types (PRD / TDD / ADR / SAD / test plan / runbook / threat model). Reference only.
- Velocity Ops Engine charter (10-phase consulting lifecycle, 4 pillars, 12 engagement-shape matrix) — business-layer; not relevant.
- Skip otherwise.

### `perplexity-super-skills` — README-only hub
- Points to 10 external skill repos (no local code). Domain-specific (marketing / sales / finance / legal). Skip.
- Pattern of interest: gap-analysis matrix structure (Perplexity capabilities vs Claude Code additions), workflow + template + decision-tree triptych per skill.

### Batch 5 net-new vs prior 29
- **Caliber's deterministic 6-category scoring** (existence/quality/grounding/accuracy/freshness/bonus = 100pts → A/B/C/D) — direct §17 fit. Zero-LLM cost.
- **Caliber's 5-LLM-provider abstraction** including **seat-based providers** (Claude CLI + Cursor ACP) — alternative to API-key-only auth that none of the prior 29 had.
- **Caliber's monorepo config discovery** (recursive walk + scopeDiffToDir) — pattern for finding MCP server manifests across multi-root projects.
- **Caliber's 2-second bootstrap via skill injection** — fast onboarding.
- **Workbench's PHASE-STATE.json orchestration with lockable checkpoints + resume command** — **more sophisticated than plan §6 enum-only state machine**. Concurrent-safe via spec locking (skip on conflict, no wait).
- **Workbench's 14 slash commands** mapped to pipeline stages — adopt as orchestrator's command surface.
- **Workbench's unidirectional sync architecture** (repo → external tools, never bidirectional) — direct fit for §35 (orchestrator reads repo state, pushes to Notion/Linear, never reads back for decisions).
- **Workbench's context source hierarchy** (project files > stack refs > Context7 > training) — adopt explicitly in §14 docs.
- **Workbench's 5-category test framework** with auditable "Not applicable" claims — adopt for §17 + §31.
- **Workbench's agent-config-shim auto-generation** (`sync-agent-configs.sh` regenerates Cursor/Copilot variants from AGENTS.md) — adopt for §9 canonical-source pattern.
- **Superpowers' iron laws + 1% threshold for skill activation** — operating discipline rules.
- **Superpowers' two-stage review gate** (spec compliance review with "don't trust report" → code quality review) — distinct from claude-workflow-v2's adversarial verification.
- **Thinking-partner's Orientation Detection (GT0-GT5)** — novel framework for detecting agent reasoning capture states. Useful for §14 prompts (esp. challenge / readiness-reviewer).
- **Thinking-partner's 7 cognitive operation pairs + 150+ mental models catalog** — reference for prompt-design library.
- **agentic-coding-handbook's 8 explicit context strategies** (with MCPs as #4) — direct alignment with §35 UIO scope.
- **agentic-coding-handbook's Memory Bank pattern + `@alioshr/memory-bank-mcp` reference** — alternative MCP-backed memory layer for §16.
- **agentic-coding-handbook's MCP security table** (6 practices: official / env-vars / least-privilege / trusted middleware / audit unofficial / never closed-source) — direct §30 + §19 Rovo trust-eval.
- **CodingRepos parent FRAMEWORK-METHODOLOGY-AND-AUDIT.md** — 20 failure modes + empirical validation as risk-register source for §34.
- **Plan refinement candidates added:**
  - **Adopt PHASE-STATE.json + lockable checkpoint pattern** (project-foundation-workbench) for §6 — richer than enum-only state machine; concurrent-safe.
  - **Adopt 5-category test framework with auditable Not-Applicable** for §17 + §31.
  - **Adopt unidirectional sync architecture** (workbench) for §35 — orchestrator reads repo state, pushes to external, never reads back.
  - **Adopt deterministic 6-category scoring** (Caliber) for §17 readiness — combine with eval-view's 4-tier verdict for layered scoring.
  - **Adopt seat-based LLM provider distinction** (Caliber) — Claude CLI / Cursor ACP options alongside API-key for §23.
  - **Adopt 14-slash-command surface** (workbench) — `/inception` / `/decompose` / `/groom` / `/wave` / `/implement` / `/review` / `/sync` / `/drift-check` / `/sync-configs` / `/run-wave` / `/resume` / `/build` / `/build-continue` mapped to plan workflow stages.
  - **Adopt context-source hierarchy** (workbench) explicitly in §8 docs.
  - **Adopt agent-config-shim auto-generation** (workbench `scripts/sync-agent-configs.sh`) for the canonical-source pattern (§9).
  - **Adopt iron laws + 1% skill-activation threshold** (superpowers) as operating discipline language.
  - **Adopt agentic-coding-handbook's Memory Bank** as the documented pattern for `@alioshr/memory-bank-mcp` integration in §16.
  - **Adopt agentic-coding-handbook's 6-practice MCP security table** for §19 Rovo trust evaluation.
  - **Reference 20-failure-mode taxonomy** from FRAMEWORK-METHODOLOGY-AND-AUDIT in §34 risk register.
  - **Adopt thinking-partner's GT0-GT5 orientation detection** for `requirements-decomposer` / `architecture-review` / `readiness-reviewer` prompts in §14 to challenge blueprints.

## Batch 6 (app templates — low yield, mostly skip)

All 8 are generic project templates / starters with little MCP-relevant value. Only patterns worth noting:

- **`full-stack-fastapi-template`** (Tiangolo's canonical) — Python/FastAPI/SQLModel/Alembic/PostgreSQL/Sentry/Traefik. TS-portable patterns: JWT dependency-injection (Hono middleware equivalent), **Pydantic BaseSettings → Zod env validation** with computed fields + post-validation checks, **OpenAPI auto-gen + client codegen via `hey-api/openapi-ts`**, **Sentry conditional init by environment** (alternative or supplement to Langfuse for §27 error tracking), multi-stage Dockerfile + uv cache mounts (translatable to npm-ci cache), **Traefik dynamic service discovery + constraint labels** for multi-service deployment, prestart migrations service in compose. Reference-only.
- **`full-stack-ai-agent-template`** — Python FastAPI cookiecutter. Notable: **Logfire (Pydantic APM)** with conditional `logfire.instrument_*()` for FastAPI / asyncpg / PyMongo / SQLAlchemy / Redis / Celery / PydanticAI — Python-native alternative to Langfuse + OTel for §27. Skip otherwise.
- **`mckays-app-template`** — Mckay Wrigley canonical Next.js + Supabase + Drizzle + Clerk + Stripe. Useful Stripe webhook pattern (`client_reference_id` for Clerk↔Stripe↔DB linkage) but already covered by project-foundation. Skip.
- **`ai_app_template`** — Generic FastAPI + Ollama + Neo4j chatbot boilerplate. Skip.
- **`project-template`** — Josee9988 GitHub scaffolding (issue/PR templates, bash setup script). Skip.
- **`python-project-template`** — Generic Copier Python boilerplate (uv + Ruff + pytest). Skip.
- **`cookiecutter-data-science`** — DrivenData ML project scaffolder (cookiecutter monkey-patching, Jinja2 hierarchical config). Orthogonal. Skip.
- **`generative_ai_project`** — All `.py` files are 1-byte placeholders. Skip.

### Batch 6 net-new
- **Sentry conditional init by environment** (full-stack-fastapi-template) — adopt as alternative or supplement to Langfuse + OTel for §27 error tracking (Sentry handles error capture + breadcrumbs better than Langfuse).
- **`hey-api/openapi-ts`** — TS client generation from OpenAPI schema — useful if orchestrator exposes a REST API alongside MCP for admin/dashboard.
- **Traefik dynamic service discovery + constraint labels** — multi-service deployment reference for `docker-compose.yml` (Section 22).
- **Logfire as Python observability reference** — confirms Sentry/Langfuse/Logfire/OTel are the four common observability stacks; we picked Langfuse + OTel.

## Batch 7 (vibe templates + misc — 7/8 skip, 1 useful)

Mostly skip:
- **`vibe_coding_template`** — markdown context templates (`.cursorrules`, `task_on_hand.md`, `project_context.md`, `technical_details.md`, `development_log.md`). Skip.
- **`vibe-coding-template`** — generic NextJS/FastAPI/Supabase boilerplate with Cursor rules. Skip.
- **`cursor-vibe-coding-template`** — Cursor MCP workflow template (TaskMaster AI / Memory MCP / Context7 / GitHub MCP) with 9 .mdc rule files. Skip.
- **`vibesdk-templates`** — Cloudflare Workers/Vite/Next.js template generator. Skip.
- **`devvit-template-vibe-coding`** — Reddit Devvit platform starter (React 19 + Hono + tRPC, Node 22 serverless). Notable only: README references Devvit MCP server (not implemented here). Skip.
- **`design-ai`** — 33 curated UI design system markdown files (Figma/GitHub/Discord/Airbnb/etc.) in Stitch format. UI styling reference, not MCP. Skip.
- **`openai`** (Archive) — corrupted/abandoned shallow clone of Microsoft Azure-Samples/openai. Cannot analyze. Skip.

Useful (1):
- **`vibe-tuning`** — Claude Code skill implementing 6-step postmortem framework: **CATCH → DIAGNOSE (chain-of-thought trace) → ROOT CAUSE (taxonomy) → FIX (type select) → PROPOSE SAVE → PROPOSE ENFORCE**. Failure-mode taxonomy: Ambiguity / Missing Context / Wrong Tool / Speed over Safety / Pattern Matching / Model Limitation. Fix-type taxonomy: Rule / Tool / Config / Education / Process. **Key insight: "rules without enforcement are just hope"** — Step 6 ENFORCE uses **PreToolUse hooks** for active triggering of dangerous commands (git push / rm / config edits). Useful for §30 write-guards-as-active-enforcement (not just declarative rules) and §34 risk-register feedback loop (failures → rules → enforcement hooks). The meta-pattern of using the methodology on itself (3/7 rules violated immediately after saving without enforcement) is the discovery.

### Batch 7 net-new
- **vibe-tuning's CATCH→DIAGNOSE→ROOT CAUSE→FIX→SAVE→ENFORCE** postmortem framework with explicit enforcement step. Adopt as §30 + §34 pattern: every detected failure mode in the orchestrator should produce a hook-enforced guard, not just a written rule.
- **Failure-mode taxonomy** (Ambiguity / Missing Context / Wrong Tool / Speed over Safety / Pattern Matching / Model Limitation) — useful classification for §34 risk register entries and audit-log error_class field (alongside claude-code-log-analyzer's SYSTEMATIC / INCOHERENT / OMISSION / API_ERROR).
- **Fix-type taxonomy** (Rule / Tool / Config / Education / Process) — adopt for orchestrator's drift-detection remediation suggestions.

## Batch 8 (specs / docs / awesome lists)

### `agents.md` — **canonical AGENTS.md spec** (the format itself)
- The official format spec at agents.md (Next.js docs site). Standard sections: **Dev environment tips** / **Testing instructions** / **PR instructions** / **Coding conventions**. Confirms target format for new repo's AGENTS.md. Reference baseline.

### `adr.github.io` — canonical ADR reference site
- 4 templates documented: **MADR** (Markdown ADR, full + minimal) / **Nygard** (5-section: Title/Status/Context/Decision/Consequences) / **Y-Statement** (compact one-liner formula) / **ISO/IEC 42010:2011** (9-item).
- **START Criteria** (Definition of Ready for ADRs): **S**ignificant / **T**eam-enabled / **A**greed / **R**eviewed / **T**imely.
- **Definition of Done 5-element checklist**: Evidence / Criteria & Alternatives / Agreement / Documentation / Realization-Review-Plan.
- Adopt for plan repo's `docs/adr/` directory.

### `madr` — MADR template framework
- Numbered naming `NNNN-decision-title.md`. Sections: Context/Problem → Decision Drivers → Considered Options → Decision Outcome + **Consequences (Good/Bad/Neutral)** + Pros/Cons + More Info.
- Optional YAML frontmatter: `status / date / decision-makers / consulted / informed`.
- MIT/CC0 dual license. **Recommended template for new repo's `docs/adr/`**.

### `awesome-agentic-patterns` — **167 patterns with deep write-ups (high value)**
- NOT just a link list. Each pattern: problem statement + architectural motivation + solution + code sketches/pseudocode + Mermaid diagrams + trade-offs + production-maturity grading (validated-in-production / emerging / established) + peer-reviewed backing.
- Includes **`llms.txt` + JSON pattern index** for programmatic ingestion.
- **60+ patterns directly relevant**:
  - **Context patterns (19)** — direct fit for §16: auto-compaction (model-specific lane-aware retry with reserve floors), dynamic injection, episodic memory retrieval, semantic filtering, working memory, curated context windowing.
  - **Orchestration patterns (50+)** — direct fit for §24: workspace-native multi-agent (blackboard architecture + MCP), declarative YAML topology, planner-worker separation, sub-agent spawning, tool routing, discrete phase separation, parallel execution, **budget-aware model routing with hard cost caps**, mode-switching by model.
  - **Memory/State patterns**: filesystem-based state, proactive externalization, memory synthesis from logs.
- **Plan refinement candidates by name**: context-window-auto-compaction (model-specific lane-aware retry with reserve floors) for §16; declarative YAML multi-agent topology; budget-aware routing with hard cost caps for §23; layered configuration context.

### `awesome-agent-clis` — 32 agent-ready CLIs inventory
- Across 14 categories. 14 explicitly flagged 🤖 agent-ready: Composio, Tavily, Stripe Projects, Ramp, Resend, wacli, Sendblue, Kapso, Mailcoach, Visa, Sentry Developer, CodeRabbit, Google Workspace CLI, ElevenLabs.
- Each has SKILL.md template under its CLI folder.
- **Standard agent-CLI conventions**: `--json` / `--no-interactive` / `--auto-confirm` / `--format` flags. Adopt for any orchestrator CLI surface.
- Mounts to `~/.claude/skills/`. References Claude Code / Cursor / Codex as host agents.

### Skip
- **`MasteringAgenticAISystems_supplementals`** — NVIDIA Agentic AI Certification course supplementals (10-part curriculum, 18 labs, 402 Python files, cert mappings AWS AIP-C01 / Google PMLE / Microsoft AI-102 / Databricks GenAI / NVIDIA NCP-AAI). Comprehensive but synthesizes patterns already covered. Useful patterns: Neo4j hybrid RAG+KG, NIM/Triton/TensorRT-LLM/MIG production deployments, observability/SLO/circuit breakers/token economics. Skip otherwise.
- **`guides_4_AIagents`** — 60+ research guides for cybersecurity policy + AI governance domain (FedRAMP / MITRE ATLAS / NHI / KG schema design / ArXiv research workflows). Domain-specific. Skip.
- **`ai-consciousness-research`** — Pure philosophical research (TLW grounding, FIGA, L1-L4 interference). Orthogonal. Skip.

### Batch 8 net-new
- **Adopt MADR template** (`NNNN-decision-title.md` + YAML frontmatter + Consequences Good/Bad/Neutral) for `docs/adr/` in new repo.
- **Adopt START Criteria + DoD 5-element checklist** for ADR governance.
- **Adopt awesome-agentic-patterns by name** as the design-space reference for §16 + §24 — context-window-auto-compaction (model-specific lane-aware retry with reserve floors), budget-aware routing with hard cost caps, declarative YAML multi-agent topology, layered configuration context.
- **Adopt agents.md spec section structure** (Dev environment tips / Testing / PR / Coding conventions) for new repo's AGENTS.md.
- **Adopt agent-CLI standard flag conventions** (`--json` / `--no-interactive` / `--auto-confirm` / `--format`) for any orchestrator CLI surface (M0 + M11 admin CLI).

## Batch 9 (remaining miscellanea)

### `Citadel` — **Production agent orchestration with Fleet parallelism** (high value, §6 + §24)
- Claude Code/Codex agent harness. **Fleet Commander pattern**: Wave 1 spawns 2-3 sub-agents in **isolated git worktrees** with no file overlap; after each wave **compress agent outputs to ~500-token discovery briefs** in `.planning/fleet/briefs/`; Wave 2+ injects ALL prior briefs to avoid rediscovery.
- **Scope-conflict prevention via `.planning/coordination/claims/` (file-based, no DB)**.
- **Budget management**: ~700K tokens/wave, ~300K reserved for orchestration.
- **4-tier intent routing**: pattern match → session state → keywords → LLM.
- **Campaign persistence**: stateful multi-session in `.planning/campaigns/{slug}.md`.
- **16-axis architectural rubric** (`citadel.md`) covering DX / docs / technical / positioning / presentation / security / process.
- **5-section skill format**: Identity / Orientation / Protocol / Quality Gates / Exit (50+ skills).
- **Roles**: Archon (vision/decomposition) / Fleet (parallelism) / Marshal (single-phase) / Specialists (domain).
- **Telemetry contract**: event-based logging (campaign-start / agent-complete / wave-complete).
- **Plan refinement candidates**: Discovery-brief compression (~500 tokens) for §24 to share state across waves without re-rediscovery; claim-based scope coordination (file-based) as alternative to BullMQ locks for single-tenant; 4-tier intent routing for §14 tool dispatch.

### `hindsight` — Production agent memory platform (vectorize-io, §16 + §25 alt reference)
- **FastMCP HTTP server (`api/mcp.py`) with 26 tools**: retain / recall / reflect + bank management + memory ops + mental models + directives.
- **Three-op model** (retain / recall / reflect) is cleaner than mengram's 29 tools.
- **Multi-strategy retrieval**: semantic + BM25 + graph + temporal + reranking. State-of-the-art on LongMemEval benchmarks vs RAG/KG.
- **Disposition-aware reasoning** (empathy/skepticism traits) on banks of memories.
- 14+ integrations: CrewAI / LangGraph / LiteLLM / Claude Code / Pydantic AI / AG2 / Llamaindex.
- SDKs: Python / TypeScript / Rust + native embeddings + Docker.
- Reference architecture for §16 + §25 alongside agentic-rag-for-dummies (Qdrant hybrid) and uio (BGE-M3 multi-vector).

### `gstack` v0.16.2.0 — Garry Tan's "software factory" Claude Code orchestrator
- 1000+ commits, weekly releases, real numbers: 140K net LOC/week.
- **23+ specialized agent roles** (CEO / eng manager / designer / QA / release engineer + 50 skill subdirs: `/office-hours` `/plan-ceo-review` `/review` `/qa` `/design-review` `/ship` `/land-and-deploy` `/investigate` `/codex` `/cso` `/browse` `/canary` `/freeze` `/guard` `/retro`).
- **Architecture: long-lived Bun server + persistent Chromium daemon** (~100-200ms latency vs 3-5s cold starts) — stateful browser sessions with retained cookies/tabs. Compiled Bun binaries (58 MB), native SQLite for cookie decryption.
- **Test suite**: skill evals (LLM-based), e2e tests, OWASP/STRIDE audits.
- Hyper-specialized for Claude Code; reference for §14 prompt-design library + §31 testing strategy.

### `get-shit-done` (gsd) — task orchestration framework (CodingRepos v1.22.4 = older; agent-repos v1.36.0 = canonical)
- Same codebase, two clones. v1.36.0 is current (40K+ monthly npm downloads).
- **Workflow discipline (.clinerules)**: `/gsd:plan-phase → /gsd:execute-phase → /gsd:verify-work` enforced.
- 31 agent definitions in `agents/` (planner / executor / verifier / researchers / debugger / auditor + specialized roles).
- Spec-driven: Questions → Research → Requirements → Roadmap → Discuss/Plan/Execute/Verify cycles. Wave-parallel execution + atomic git commits + UAT verification + quick-mode for ad-hoc.
- Multi-host (Claude / OpenCode / Gemini / Copilot / Cursor / Cline). Windows compatibility via `@file:` protocol.
- Refinement of SpecKit/BMAD category with leaner UX.

### `zeroshot` — Multi-agent orchestration CLI (`@covibes/zeroshot` v5.4.0)
- Node.js CLI for **planner → implementer → validators loops** until verified/rejected.
- **Architecture**: conductor classification + message bus + **SQLite ledger** + guidance system + provider registry.
- TUI: TypeScript backend + Rust frontend (tui-rs).
- Multi-provider (Claude / Codex / Gemini / OpenCode).
- **Useful pattern**: SQLite ledger for agent-execution history (alternative to plan §9 Postgres for single-tenant local).

### `grain` v0.2.0 — Anti-slop Python linter (useful for §31)
- Detects AI-generated code patterns: obvious comments, vague TODOs, hedge words, restated docstrings.
- Python/Markdown/commit-msg checks + custom `.grain.toml` rules + pre-commit integration + inline suppressions.
- Stdlib-only.
- **Adopt as TS equivalent** for §31 — combine with velocity-ops-engine's anti-stub guardrails (12 patterns) + ai-coding-framework's banned-patterns semgrep rules + claude-workflow-v2's adversarial verification triplet.

### Skip
- **`WFGY`** — Philosophical reasoning text artifact; 131-problem dataset packaged as TXT. Not code. Skip.
- **`prediction-terminal`** — Sports prediction ML platform (React + FastAPI). Orthogonal. Skip.
- **`ouroboros`** — Explorer returned a description of the orchestrator plan v5 itself rather than the repo, suggesting it's empty / irrelevant / or repo content closely mirrors the plan. Skip.

### Batch 9 net-new
- **Citadel's Fleet pattern** (high value): discovery-brief compression to ~500 tokens + claim-based scope coordination + 4-tier intent routing. Direct §6 + §24 reference.
- **hindsight's three-op model** (retain/recall/reflect) + multi-strategy retrieval (semantic + BM25 + graph + temporal + reranking). Cleaner than mengram for §16 + §25.
- **zeroshot's SQLite ledger** for agent execution history — alternative single-tenant store for §9.
- **grain anti-slop linter** — adopt as TS equivalent in §31.
- **gstack's persistent daemon pattern** (~100ms vs 3-5s cold) for stateful browser sessions if orchestrator ever needs interactive web testing.
- **gsd's `/plan → /execute → /verify` workflow discipline** — enforce as orchestrator's standard cycle (matches workbench's slash command surface).

---

# Final synthesis — 73 Archive repos + 5 originals

## Final tally
- **Survey total**: 5 originals (atl-mcp adjacent) + 73 Archive = **78 repos** evaluated.
- **High-value (Tier 1) repos**: ~25.
- **Medium-value (Tier 2) repos**: ~20.
- **Skip**: ~33.

## Highest-leverage finds across the entire survey

### Critical adjacent systems / direct integration partners
1. **`uio`** — IS the UIO from plan §35. Production Python FastAPI + TypeScript MCP server + Hatchet + Qdrant + BGE-M3 + MinerU. Orchestrator should call its MCP `uio_ingest` tool and reuse pre-computed vectors via `source_id` keying.

### MCP scaffolding (TS/Node)
2. **`simple-commands-mcp`** — `@modelcontextprotocol/sdk@1.17.3` stdio scaffold reference.
3. **`context-fabric`** — `@modelcontextprotocol/sdk@1.27.1`. Full §16 context-pack pipeline with 5-engine architecture (E1 Capture / E2 Anchor / E3 Router / E4 Governor / E5 Weaver) + InjectionGuard + PathGuard.
4. **`indxr`** — Best Streamable HTTP transport reference (axum + tokio + SSE + session lifecycle, Rust v2025-03-26 spec). Adopt the transport architecture pattern.
5. **`mcp_daemon`** — Multi-transport `Transport` trait abstraction (stdio + WebSocket + HTTP/2 + SSE + InMemory). Reference for §22 architecture.
6. **`mcpd`** — MCP aggregator/proxy pattern. Direct architectural model for §19 Rovo upstream mediation.

### Orchestration + state machines (§6 + §24)
7. **`open-multi-agent`** — TS multi-agent v1.1.0 (5.5k stars). TaskQueue (469 LoC) + 4 schedulers + approval gate + MessageBus + 3-layer Semaphore + SharedMemory. Drop-in for the orchestration layer.
8. **`agent-maestro`** — TS Tauri/React multi-agent UI. 4-mode model + 5 workflow strategies (incl. **DAG with topological waves**) + manifest-driven spawning + per-session git worktrees.
9. **`Citadel`** — Fleet pattern: discovery-brief compression + claim-based scope coordination + 4-tier intent routing.
10. **`project-foundation-workbench`** — PHASE-STATE.json with lockable checkpoints + 14 slash commands + unidirectional sync architecture + 5-category test framework + agent-config-shim auto-generation. **More sophisticated than plan §6 enum-only state machine.**

### Storage + auth + scaffolding (§9 + §20)
11. **`project-foundation`** — Drizzle PGlite/Postgres dual-mode + migration runner + rate limiter + HMAC session token + RBAC + observability + idempotent upsert + Stripe webhook signature verification.

### Vector + embeddings + retrieval (§16 + §25)
12. **`agentic-rag-for-dummies`** — Qdrant hybrid (dense+sparse) + parent-child chunking (2000-10000 char parents, 500/100 children) + LangGraph map-reduce. Python; patterns transfer.
13. **`hindsight`** — Three-op (retain/recall/reflect) memory model + multi-strategy retrieval (semantic+BM25+graph+temporal+reranking). FastMCP-based.
14. **`mengram`** — 3-type memory (semantic/episodic/procedural) + experience-driven procedure evolution. PostgreSQL+pgvector.
15. **`codebase-memory-mcp`** — 11-signal algorithmic embeddings (no LLM dep) + tree-sitter 66-language + multi-host auto-config (10 hosts).

### Observability + audit (§27 + §30)
16. **`agentdiff`** — **First cryptographic signing infrastructure**: ed25519 + RFC 8785 JCS canonicalization + git-ref key registry. Direct fit for §30 hash-chained audit.
17. **`open-edison`** — **Lethal trifecta** (private + untrusted + external = block) + PUBLIC/PRIVATE/SECRET ACL + wildcard permissions + first OTel-wired MCP-adjacent repo.
18. **`claude-code-log-analyzer`** — Comprehensive Claude Code session-log JSONL parser + 6 observability enum families (autonomy/intent/decision/error_class/gate_type/severity).

### Eval + readiness (§17 + §31)
19. **`eval-view`** — Production eval framework: multi-provider LLM-as-judge + 4-tier verdict + drift tracker + golden + auto-PR + model-drift canary. Adopt wholesale.
20. **`ai-setup` (= Caliber)** — Deterministic 6-category scoring (existence/quality/grounding/accuracy/freshness/bonus → A/B/C/D). Combine with eval-view's verdict layer.

### Governance + docs
21. **`ai-coding-framework`** — Linux Foundation AGENTS.md format, `modules/mcp-development.md` + `modules/mcp-governance.md`, six-dim conformance rubric, banned-patterns semgrep, OWASP LLM checklist.
22. **`velocity-ops-engine`** — `modules/mcp-development.md` + `modules/mcp-governance.md`, anti-stub guardrails (12 patterns) with should-catch/should-pass fixtures, enforcement-v2 hooks.
23. **`everything-claude-code`** — Canonical 50K-star reference: 14 agents + 58 skills + 35 commands + 11 hook scripts + multi-language docs + cross-platform parity.
24. **`claude-code-best-practice`** — Boris-endorsed reference: ancestor/descendant CLAUDE.md loading + 5-level settings + 27-event hook spec (only 6 fire in agents).
25. **`agents.md` + `madr` + `adr.github.io`** — Canonical AGENTS.md spec + MADR ADR template + ADR governance (START + DoD).

### Pattern catalog
26. **`awesome-agentic-patterns`** — 167 patterns with code sketches + Mermaid + grading. Direct §16 + §24 design-space reference.

## Plan refinement candidates (consolidated)

**Stack:**
- PGlite > SQLite for dev/test (project-foundation) — same Postgres dialect, no migration drift.
- `exactOptionalPropertyTypes: true` (PAE precedent).
- Linux Foundation AGENTS.md (Jan 2026) format (ai-coding-framework + agents.md spec).
- MADR template for `docs/adr/` (madr).
- Six-dim conformance rubric (ai-coding-framework `benchmarks/rubric.md`).

**§6 state machine + §24 queue:**
- **PHASE-STATE.json with lockable checkpoints** (workbench) — richer than enum-only; concurrent-safe.
- **Adopt 4 workflow strategies** (agent-maestro): simple / queue / tree / **DAG with topological waves**.
- **Adopt 4 scheduler strategies** (open-multi-agent): round-robin / least-busy / capability-match / dependency-first.
- **Adopt approval-gate callback** (open-multi-agent): `onApproval(completedTasks, nextTasks) → Promise<boolean>` with skip-cascade on rejection — direct PolicyDecisionLayer signature.
- **Adopt Citadel's discovery-brief compression** (~500-token wave summaries) + **claim-based scope coordination** (file-based for single-tenant).
- **Adopt single-message Task-call constraint** (claude-workflow-v2) for parallelism docs.
- **Adopt manifest-driven agent spawning** (agent-maestro) as `handoff_generate` output shape.
- **Adopt per-session git worktree** (`orchestrator/{sessionId}` branches) for sandboxed M6c VCS provisioning.

**§7 PolicyDecisionLayer + §30 access gate / write guards:**
- **Adopt UIO compliance gate** structure (similarity / blending / verbatim / adjacency / rate-limit / license-class).
- **Adopt open-edison's lethal trifecta** as baseline safety check.
- **Adopt PUBLIC(0) < PRIVATE(1) < SECRET(2) ACL ranking** with wildcard permission JSON (open-edison).
- **Adopt action mode capability injection** (read-only / approve-each-tool) from claude_agent_teams_ui.
- **Adopt agentdiff's git-ref key registry** for v1 audit-chain key distribution (KMS becomes optional post-v1).
- **Adopt 4 shared protocols** (claude-code-production-grade-plugin): ux / input-validation / tool-efficiency / conflict-resolution.

**§14 MCP surface:**
- **Adopt 4-mode agent model** (agent-maestro): worker / coordinator / coordinated-worker / coordinated-coordinator.
- **Adopt skill-first protocol with 1% threshold** (superpowers).
- **Adopt iron laws** (superpowers): "NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE", "NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST".
- **Adopt two-stage review gate** (superpowers): spec compliance → code quality.
- **Adopt persona vocabulary routing** (three-man-team) for prompts.
- **Adopt 6-phase agent-generation workflow + 7 patterns** (claude-agent-builder) for `handoff_generate`.
- **Adopt thinking-partner's GT0–GT5 orientation detection** for `architecture-review` / `readiness-reviewer` prompts.
- **Adopt tool-collapse pattern**: 3 compound tools default + N granular via `--all-tools` flag (indxr) — addresses §34 tool-sprawl risk.
- **Adopt proactive resource pinning** (mengram `memory://profile`) for `orchestrator://session/current/preflight`.

**§16 context packs:**
- **Adopt 6-category token tracking** (claude_agent_teams_ui): claude-md / mentioned-file / tool-output / thinking-text / team-coordination / user-message — instead of single aggregate.
- **Adopt 5-step progressive truncation** (indxr): doc comments → private decls → children → leaf files → final.
- **Adopt 22-model context-size table** (context-fabric) for budgeting against configured model.
- **Adopt FTS5 BM25 with column weights** (context-fabric: path 2.0 / summary 1.5 / outline 1.2 / exports 1.0) as metadata-search component of hybrid ranking.
- **Adopt awesome-agentic-patterns by name**: context-window-auto-compaction (model-specific lane-aware retry with reserve floors), budget-aware routing with hard cost caps, declarative YAML topology, layered configuration context.
- **Adopt agentic-coding-handbook's Memory Bank** + `@alioshr/memory-bank-mcp` reference.

**§17 readiness:**
- **Adopt 4-tier verdict** (eval-view): SAFE_TO_SHIP / SHIP_WITH_QUARANTINE / INVESTIGATE / BLOCK_RELEASE.
- **Adopt deterministic 6-category scoring** (Caliber): existence/quality/grounding/accuracy/freshness/bonus → A/B/C/D, combined with eval-view's verdict for layered scoring.
- **Adopt 5-category test framework** (workbench) with auditable Not-Applicable: UT / IT / ST / PT / E2E.
- **Adopt 5-section skill format** (Citadel): Identity / Orientation / Protocol / Quality Gates / Exit.
- **Adopt confidence-gate JSON** (velocity-ops-engine + ai-coding-framework): `{ check: { checked: bool, confidence: 0–100 } }`.
- **Adopt numeric `confidenceScore: 0..1`** alongside categorical `Confidence` enum (PAE).

**§18 preview/approve/execute:**
- **Adopt adversarial verification triplet** (claude-workflow-v2): false-positive filter + missing-issues finder + context validator → PASS/FAIL synthesis.
- **Adopt deploy-gate accountability** (three-man-team): summarize → tell PO → PO approves → commit → log → checkpoint.
- **Adopt three-man-team file-based handoff**: BRIEF / REQUEST / FEEDBACK files for serialization.
- **Adopt hunk-level review** (claude_agent_teams_ui) for M6c PR provisioning.

**§22 transport:**
- **Adopt indxr's Streamable HTTP architecture** (axum-equivalent + SSE + 1h sliding TTL + 1000 concurrent + session lifecycle). Best concrete reference.
- **Adopt WebSocket batching + per-entity throttling + 1MB backpressure** (agent-maestro) as backpressure pattern.
- **Adopt dual-port architecture** (open-edison): MCP on 3000 / mgmt API on 3001 for clean separation.
- **Adopt SSE keep-alive (30s)** + no-polling pattern (claude_agent_teams_ui) for resource subscriptions.

**§23 sampling:**
- **Adopt seat-based vs API-key provider distinction** (Caliber): Claude CLI / Cursor ACP options alongside API-key.
- **Adopt grammar-constrained JSON via GBNF** (ATLAS) as alternative to JSON-mode for guaranteed-valid structured outputs.
- **Adopt 17-LLM-provider abstraction** (plano) for fallback chains.

**§26 webhooks:**
- **Adopt Stripe-style HMAC verification + tests** (project-foundation).
- **Adopt deterministic message IDs** `sha256(source + timestamp + content)` (claude_agent_teams_ui) for delivery dedup keys.
- **Adopt bundled signature corpus pattern** (PAE + agentdiff: per-host event-ID headers).

**§27 observability:**
- **Adopt Langfuse + Prometheus + structlog** (uio).
- **Adopt OTel counters template** (open-edison): tool_calls_total / tool_calls_blocked_total / private_data_access_calls_total / write_operation_calls_total.
- **Adopt install-unique deaggregation ID** (open-edison) for opt-out telemetry.
- **Adopt agentdiff's Agent Trace v0.1.0 JSONL spec** (Cognition / Cursor / Vercel / Cloudflare alignment).
- **Adopt 6-observability-enum taxonomy** (claude-code-log-analyzer): autonomy / intent / decision / error_class / gate_type / severity.
- **Adopt Sentry conditional init by environment** (full-stack-fastapi-template) as supplement for error capture.

**§30 security + audit chain:**
- **Adopt agentdiff's ed25519 + JCS + git-ref key registry** for §30 audit chain (v1; KMS post-v1).
- **Adopt anti-stub guardrails (12 patterns)** + should-catch/should-pass fixtures (velocity-ops-engine).
- **Adopt banned-patterns semgrep YAML + bash anti-stub scanner** (ai-coding-framework + velocity-ops-engine — different enforcement layers).
- **Adopt `grain` anti-slop linter** as TS equivalent for AI-generated-code drift.
- **Adopt CATCH→DIAGNOSE→ROOT CAUSE→FIX→SAVE→ENFORCE** postmortem (vibe-tuning) — every detected failure produces a hook-enforced guard, not just a written rule.
- **Adopt failure-mode taxonomy** (vibe-tuning + claude-code-log-analyzer): Ambiguity / Missing Context / Wrong Tool / Speed over Safety / Pattern Matching / Model Limitation × SYSTEMATIC / INCOHERENT / OMISSION / API_ERROR.

**§31 testing:**
- **Adopt eval-view wholesale** (Python+Node, 56k SLOC, MCP-server-included): multi-provider LLM-as-judge with caching, verdict layer, drift tracker, golden baselines, auto-PR from incidents, model-drift canary.

**§34 risk register:**
- **Adopt 20-failure-mode taxonomy** from CodingRepos parent's FRAMEWORK-METHODOLOGY-AND-AUDIT.md.

**§35 UIO integration:**
- **Direct partner**: call UIO's MCP `uio_ingest` and pull pre-computed vectors from `uio_books_raw_v1` keyed by `source_id`.
- **Adopt agentic-coding-handbook's 8 context strategies** (with MCPs as #4) for documented context-source taxonomy.
- **Adopt unidirectional sync architecture** (workbench): orchestrator reads repo state, pushes to external (Notion/Linear/Jira), never reads back for decisions.

**Operational:**
- **PgBouncer transaction-mode requirement**: `statement_cache_size=0` (uio).
- **BGE-M3 sparse format conversion**: Qdrant wants `{idx: val}`, FlagEmbedding returns `{indices, values}` (uio gotcha).
- **stdio servers MUST log to file (Winston) — never stdout** (simple-commands-mcp + Anthropic guidance).
- **Plugin.json MUST NOT declare hooks** — Claude v2.1+ auto-loads `hooks/hooks.json` (everything-claude-code gotcha).
- **Only 6 of 27 hook events fire in agent contexts** (claude-code-best-practice gotcha): PreToolUse / PostToolUse / PermissionRequest / PostToolUseFailure / Stop / SubagentStop.
- **Foreground-only Agent-tool subagents** in Claude Code (three-man-team gotcha): background mode stalls on Edit approval.
- **Large file handling**: never read >200 lines all-at-once; offset+limit (workbench).

## Bottom-line state by Milestone (78-repo synthesis)

| Milestone | Coverage | Greenfield gaps |
|---|---|---|
| **M0 scaffold** | Saturated | None — multi-source scaffolding ready (project-foundation HTTP + simple-commands-mcp stdio + indxr Streamable HTTP + Caliber-style configs) |
| **M1 storage + types** | Solid (project-foundation drizzle + workbench types/specs) | Encrypted token store + audit hash chain still bespoke (libsodium / agentdiff ed25519 pattern) |
| **M2 Atlassian providers** | Partial (PAE provider + retry, project-foundation idempotent upsert, PAE Confluence-fingerprint corpus pattern) | Jira REST + Confluence v2 REST + ADF + storage renderer + Rovo allowlist + OAuth 3LO = greenfield |
| **M3 VCS provider** | Partial (PAE provider, project-foundation Stripe-style HMAC) | Bitbucket Cloud REST + GitHub adapter + per-provider webhook signature = greenfield |
| **M4 blueprint + sampling** | Partial (PAE Handlebars + claude-agent-builder 6-phase workflow + 3 reasoning methods) | MCP `sampling/createMessage` integration + deterministic temperature-0 fixtures = greenfield |
| **M5 provisioning planner** | Partial (PAE comparison-matrix + project-foundation idempotent upsert + workbench scope-signature + claude-workflow-v2 effort scaling) | Actor attribution (labels / metadata blocks / commit trailers / PR descriptions) + obligation engine + structured outputSchema = greenfield |
| **M6a–c executors** | Partial (project-foundation `Transport<T>` + agent-maestro per-session worktrees + Citadel claim coordination + open-multi-agent TaskQueue) | BullMQ wiring + idempotency keys table + audit hash chain + writeGuards = greenfield |
| **M7 context packs** | Strong (context-fabric 5-engine + agentic-rag-for-dummies hybrid retrieval + uio MinerU + hindsight three-op + 6-category token tracking + indxr 5-step truncation + thinking-partner challenge prompts) | Trace-link traversal logic + access-gate three-mode = greenfield (compose from references) |
| **M8 readiness** | Strong (eval-view 4-tier verdict + Caliber 6-category scoring + workbench 5-category tests + ai-coding-framework 6-dim rubric + velocity-ops-engine confidence artifact) | Thread together; mostly composition |
| **M9 handoff** | Solid (claude-agent-builder 6-phase + 7-pattern + agent-maestro manifest spawning + workbench agent-config-shim) | Cross-host parity script (AGENTS.md → CLAUDE.md / .cursor/rules / .github/copilot-instructions / .codex/config.toml) — assemble from workbench + Caliber + everything-claude-code |
| **M10 webhooks + subscriptions** | Partial (project-foundation Stripe HMAC + claude_agent_teams_ui SSE + deterministic message IDs) | Atlassian + Bitbucket signature verification + Redis dedup + GraphChangeEvent normalization + ACL invalidation on permission events = greenfield |
| **M11 notifications + evals + hardening** | Strong (eval-view full eval framework + project-foundation pluggable Transport for Slack/Teams + grain anti-slop linter + agentdiff signing + Citadel telemetry contract) | Slack/Teams adapters + ops runbook = greenfield (assemble) |

## Final summary across 78 repos
- **Process / governance / agent instruction**: Massively saturated. Pick one canonical AGENTS.md (workbench's LF format), one canonical CLAUDE.md, adopt MADR for ADRs. The rest is excess.
- **TypeScript scaffolding (HTTP / auth / rate-limit / observability stub / drizzle / migrations)**: Solid (project-foundation + PAE).
- **Domain patterns (provider abstraction / retry / evidence-scoring / conditional templating / pipeline)**: Solid (PAE + open-multi-agent + agent-maestro + Citadel).
- **MCP scaffolding** (TS): Adequate via simple-commands-mcp (stdio @1.17.3) + context-fabric (@1.27.1) + indxr (Streamable HTTP architecture). Spec-version porting (mcpd Rust → TS Zod) is pending work.
- **Atlassian (Jira / Confluence / Rovo / ADF / OAuth 3LO)**: Still **greenfield** — no working clients across 78 repos. PAE pluggable-provider pattern + project-foundation idempotent-upsert + uio compliance-gate are templates only.
- **VCS (Bitbucket / GitHub / GitLab)**: Still **greenfield**. Stripe-style webhook signature verification (project-foundation) is the closest model. Per-session worktrees (agent-maestro) is the M6c sandbox pattern.
- **Vector / embeddings (Qdrant + BGE-M3)**: Multiple references (uio with full multi-vector + hybrid retrieval, agentic-rag-for-dummies hybrid Qdrant, hindsight three-op, codebase-memory-mcp algorithmic-no-LLM alternative, mengram pgvector). Implementation is greenfield but pattern library is rich.
- **Queue (BullMQ + idempotency + DLQ)**: Still greenfield. Agent-maestro file-based + open-multi-agent TaskQueue are pattern references; Hatchet (uio) and zeroshot SQLite ledger are alternatives to consider.
- **Envelope encryption / KMS / hash-chained audit**: agentdiff's ed25519 + git-ref key registry replaces the KMS dependency for v1; libsodium secretbox is still the implementation choice.
- **Access gate + write guards + policy engine + redaction + injection scanning**: Patterns and checklists abundant (open-edison lethal trifecta + ACL + wildcard permissions; UIO compliance gate; context-fabric InjectionGuard + PathGuard; velocity-ops-engine + ai-coding-framework + grain banned patterns; vibe-tuning ENFORCE step). Implementation is greenfield assembly.
- **OTel + Langfuse + preflight telemetry**: open-edison wires OTel; uio wires Langfuse + Prometheus + structlog + DCGM; LongTracer + autoagent provide trajectory schemas. Implementation is greenfield assembly across these references.
- **MinerU / UIO document extraction**: **uio is the partner.** Plan §35 should call its MCP `uio_ingest` and reuse vectors directly via `source_id` keying. No need to reimplement.

**Final count of remaining greenfield work** (informed by but not provided by 78 repos):
- Jira REST client + create-meta + ADF helpers + storage-format renderer + Rovo allowlist enforcer + OAuth 3LO
- Confluence v2 REST client + storage representation + content-properties + optional ADF
- Bitbucket Cloud REST + GitHub adapter + Git-provider webhook signature verification + Redis dedup
- BullMQ workers + idempotency-keys table
- Envelope-encrypted token store (libsodium) + hash-chained audit log (informed by agentdiff)
- Three-mode access gate (local / remote_check / cached_acl)
- Code-based PolicyDecisionLayer with `allow | deny | require_approval` + obligations
- gitleaks redaction + entropy detection + injection-pattern scanner with untrusted-data markers
- Qdrant + BGE-M3 wiring + tenant-scoped collection naming
- Trace-link traversal + hybrid relevance ranking implementation
- MCP SDK integration (transports + tool/resource/prompt registration + sampling + elicitation + completions + subscriptions + session capability registry) — TS-side
- Streamable HTTP transport implementation (informed by indxr Rust pattern)
- OTel + Langfuse exporter wiring with §27 attribute schema
- Conformance test suite via MCP inspector
- Slack + Teams notification adapters
- Operations runbook
