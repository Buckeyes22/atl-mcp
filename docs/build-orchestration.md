# Build Orchestration: Agent Context Orchestrator MCP Server

This is the single doc to point to when starting the build. It compresses the v6 plan, partner guides, and operational gating into one buildable sequence.

If you read nothing else, read **§5 (Build sequence)** and **§6 (First shippable slice)** below.

---

## 1. Mission

Build an MCP server that turns raw project requirements into an agent-ready Atlassian workspace. The server creates and maintains the Confluence, Jira, and VCS context that implementation agents need to begin work with minimal ambiguity. It is not a Jira/Confluence/Bitbucket API wrapper — it is the orchestration layer above them. Build-agent-agnostic: Codex, Claude Code, and any MCP-capable agent are first-class consumers.

Full spec: [`agent-context-orchestrator-mcp-plan-v6.md`](../agent-context-orchestrator-mcp-plan-v6.md) §1.

---

## 2. How to use this doc

**Audience**: build agents (Claude Code, Codex), implementing engineers, and operators preparing the environment.

**Three companion docs** form the complete picture:

| Doc | Purpose |
|---|---|
| [`agent-context-orchestrator-mcp-plan-v6.md`](../agent-context-orchestrator-mcp-plan-v6.md) | Canonical specification. Source of truth for every decision. |
| [`docs/partners/`](partners/) | 42 partner integration guides (3 P0 + 2 P1 + 29 pattern-lift + 8 spec-docs). Each guide has env vars, configs, glue code, gotchas, validation commands. |
| [`repo-extraction-findings.md`](../repo-extraction-findings.md) | The 78-repo survey. Every finding ID (F-NNN) traces to a specific line range here. |

**Workflow per milestone**:

1. Read the milestone row in **§5** below — note the partner guides, v6 sections, and §29 prompt cited.
2. Open the cited partner guide(s). Read §1 (why), §4 (config), §6 (glue patterns), §7 (gotchas).
3. Open the cited v6 sections for normative spec.
4. Hand the §29 prompt + the relevant partner guides + v6 sections to a build agent.
5. Run the milestone's acceptance check (§5 below).
6. Update an ADR if any pattern was deviated from.

---

## 3. Repo layout

```
atl-mcp/
├── agent-context-orchestrator-mcp-plan-v6.md   ← canonical spec
├── repo-extraction-findings.md                  ← 78-repo survey, line-cited
├── docs/
│   ├── build-orchestration.md                   ← this doc
│   ├── partners/                                ← 42 guides + README
│   │   ├── README.md                            ← partner index
│   │   └── <slug>.md                            ← one per partner
│   └── adr/                                     ← MADR-formatted decisions (to be created)
│       ├── 0000-adr-process.md
│       ├── 0001-...
│       └── 0004-agentdiff-key-registry-replaces-kms-v1.md
└── (build artifacts land in src/, tests/, scripts/, etc. per §8 of v6)
```

ADR template + governance: see [`docs/partners/madr.md`](partners/madr.md) + [`docs/partners/adr-github-io.md`](partners/adr-github-io.md).

---

## 4. Pre-build prerequisites

Before starting Milestone 0, complete these steps. Most are **decisions**, not installations.

### 4.1 Required reading (in order)

1. v6 plan §1–§4 (Mission, Strategic Decision, Assumptions, Non-Goals).
2. v6 plan §5–§7 (Core User Flow, State Machine, High-Level Architecture).
3. v6 plan §28 (Implementation Milestones) + §37 (Immediate Next Step).
4. v6 plan §32 (Definition of Done).
5. [`docs/partners/README.md`](partners/README.md) — the partner index.
6. The 3 P0 partner guides: [`uio.md`](partners/uio.md), [`eval-view.md`](partners/eval-view.md), [`agentdiff.md`](partners/agentdiff.md).

### 4.2 Decisions to make first

| Decision | Default | v6 reference |
|---|---|---|
| Tenancy mode | `single_tenant` for v1 | §3, §7.3 |
| Tenant ID | `default` | §10 (TenantScope) |
| Policy mode | `code` (no OPA/Cedar) | §7.2, FM-7 |
| Atlassian site URL + cloud ID | required from operator | §33 |
| Jira project type | company-managed *or* team-managed (decide once) | §11, §12 |
| VCS provider | Bitbucket Cloud (MVP scope) | §3 non-goals |
| Auth mode | API token *or* OAuth 3LO *or* service-account | §20 |
| Lethal-trifecta enforcement | `enforce` (default yes) | §38.1 |
| UIO partner enabled? | configurable; impacts M2, M4, M7 | [`partners/uio.md`](partners/uio.md) §1 |
| Eval-view partner enabled? | recommended; gates CI in M11 | [`partners/eval-view.md`](partners/eval-view.md) §1 |
| AGENTS.md spec version | LF Jan 2026 (current) | [`partners/agents-md.md`](partners/agents-md.md) |

Full operator checklist: v6 §33.

### 4.3 Local toolchain

- Node.js 22+ (`exactOptionalPropertyTypes: true`).
- pnpm or npm.
- Docker + docker-compose.
- Git ≥2.30.
- For audit signing (M6a): `openssl` (keypair gen) + git push permission to `refs/orchestrator/keys/*` namespace. See [`partners/agentdiff.md`](partners/agentdiff.md) §2.
- For eval-view CI (M11): Python 3.9+, `gh` CLI. See [`partners/eval-view.md`](partners/eval-view.md) §2.

### 4.4 Accounts / credentials

- Atlassian Cloud admin or API-token-permitted user.
- Bitbucket Cloud workspace + repo create permission.
- LLM provider key (Anthropic, OpenAI, Vertex, or seat-based via Claude CLI / Cursor ACP — see [`partners/caliber.md`](partners/caliber.md) §4.3).
- Slack or Teams webhook URL (M11 notifications).
- Sentry DSN (M11; staging/production only — see [`partners/full-stack-fastapi-template.md`](partners/full-stack-fastapi-template.md)).
- (Optional) UIO API key + Qdrant URL.
- (Optional) Eval-view PyPI access + judge-provider key.

---

## 5. Build sequence

Each row links to the milestone's v6 spec, the §29 build-agent prompt, and the partner guides whose patterns the milestone consumes.

| # | Milestone | v6 ref | Prompt | Partner guides |
|---|---|---|---|---|
| **M0** | Scaffold (TS project, dual-transport stdio + Streamable HTTP, dual-port 3000/3001, health tool, session capability registry, Dockerfile, compose) | [§28 M0](../agent-context-orchestrator-mcp-plan-v6.md) | Prompt 1 | [simple-commands-mcp](partners/simple-commands-mcp.md), [indxr](partners/indxr.md), [open-edison](partners/open-edison.md), [project-foundation](partners/project-foundation.md), [mengram](partners/mengram.md) |
| **M1** | Domain model + storage (PGlite-dev / Postgres-prod via Drizzle, tenant-scoped repos, encrypted token store) | §28 M1 | Prompt 2 | [project-foundation](partners/project-foundation.md), [project-foundation-workbench](partners/project-foundation-workbench.md), [pae](partners/pae.md) |
| **M2** | Atlassian providers + capability discovery (Jira REST, Confluence v2, ADF utils, OAuth 3LO, `project_preflight_check`, UIO reachability) | §28 M2 | Prompt 3 | [pae](partners/pae.md), [project-foundation](partners/project-foundation.md), [uio](partners/uio.md) |
| **M3** | VCS provider (Bitbucket Cloud, webhook HMAC, per-session worktree manager) | §28 M3 | Prompt 4 | [project-foundation](partners/project-foundation.md), [agent-maestro](partners/agent-maestro.md) |
| **M4** | Blueprint workflow + sampling (`project_intake_create`, `project_blueprint_generate`, UIO ingest path) | §28 M4 | Prompt 5 | [pae](partners/pae.md), [claude-agent-builder](partners/claude-agent-builder.md), [agentic-coding-handbook](partners/agentic-coding-handbook.md), [uio](partners/uio.md), [agentic-rag-for-dummies](partners/agentic-rag-for-dummies.md) |
| **M5** | Provisioning planner (`project_provision_preview`, actor-attribution plan, adversarial triplet on preview) | §28 M5 | Prompt 6 | [pae](partners/pae.md), [project-foundation](partners/project-foundation.md), [project-foundation-workbench](partners/project-foundation-workbench.md), [claude-workflow-v2](partners/claude-workflow-v2.md), [three-man-team](partners/three-man-team.md) |
| **M6a** | **Jira provisioning executor** (BullMQ, `project_provision_execute` Jira-only, idempotency, ed25519-signed audit chain) ← **first shippable slice ends here** | §28 M6a | Prompt 7 | [open-multi-agent](partners/open-multi-agent.md), [citadel](partners/citadel.md), [agentdiff](partners/agentdiff.md), [project-foundation](partners/project-foundation.md) |
| **M6b** | Confluence provisioning executor (storage representation default, content properties for metadata) | §28 M6b | Prompt 8 | [project-foundation](partners/project-foundation.md), [agentdiff](partners/agentdiff.md) |
| **M6c** | VCS branch + PR provisioning (per-session worktrees, hunk-level review, commit trailers) | §28 M6c | Prompt 9 | [agent-maestro](partners/agent-maestro.md), [claude-agent-teams-ui](partners/claude-agent-teams-ui.md), [agentdiff](partners/agentdiff.md), [three-man-team](partners/three-man-team.md) |
| **M7** | Context resources + packs (6-cat token budgeting, 5-step truncation, 22-model table, FTS5 BM25, redaction, lethal-trifecta gate) | §28 M7 | Prompt 10 | [context-fabric](partners/context-fabric.md), [agentic-rag-for-dummies](partners/agentic-rag-for-dummies.md), [uio](partners/uio.md), [thinking-partner](partners/thinking-partner.md), [open-edison](partners/open-edison.md) |
| **M8** | Readiness validation (deterministic 6-cat A/B/C/D + LLM 4-tier verdict, 5-cat test framework, confidence-gate JSON) | §28 M8 | Prompt 11 (combined) | [eval-view](partners/eval-view.md), [caliber](partners/caliber.md), [project-foundation-workbench](partners/project-foundation-workbench.md), [ai-coding-framework](partners/ai-coding-framework.md), [velocity-ops-engine](partners/velocity-ops-engine.md), [citadel](partners/citadel.md) |
| **M9** | Agent handoff (`handoff_generate`, `ManifestSpawn`, AGENTS.md → Cursor/Codex/Copilot config sync) | §28 M9 | Prompt 11 (combined) | [claude-agent-builder](partners/claude-agent-builder.md), [agent-maestro](partners/agent-maestro.md), [project-foundation-workbench](partners/project-foundation-workbench.md), [caliber](partners/caliber.md), [everything-claude-code](partners/everything-claude-code.md), [agents-md](partners/agents-md.md) |
| **M10** | Webhook ingestion + resource subscriptions (deterministic dedup, `GraphChangeEvent`, SSE 30s keep-alive) | §28 M10 | Prompt 12 | [project-foundation](partners/project-foundation.md), [claude-agent-teams-ui](partners/claude-agent-teams-ui.md), [pae](partners/pae.md), [agentdiff](partners/agentdiff.md) |
| **M11** | Notifications + evals + hardening (Slack/Teams adapters, eval-view CI, anti-slop linter, semgrep, MCP conformance) | §28 M11 | Prompt 13 | [eval-view](partners/eval-view.md), [project-foundation](partners/project-foundation.md), [grain](partners/grain.md), [velocity-ops-engine](partners/velocity-ops-engine.md), [ai-coding-framework](partners/ai-coding-framework.md), [citadel](partners/citadel.md), [agentdiff](partners/agentdiff.md) |

### 5.1 Acceptance bar (per milestone)

Every milestone has an explicit "Acceptance" paragraph in v6 §28. Do not advance until acceptance passes:

- M0: server starts on both transports; MCP inspector lists health tool; both diagnostic resources exposed; `docker compose up` brings up Postgres + Redis.
- M1: dual-mode (PGlite + Postgres) parity; tenant-scoped repos; encrypted token round-trip; migration rehearsal passes.
- M2: providers pass recorded-fixture tests; preflight produces `ProjectProfile` with UIO reachability when configured.
- M3: Bitbucket adapter passes contract tests; worktree acquire/release works on POSIX and Windows.
- M4: raw markdown → structured blueprint; UIO-sourced intake reuses pre-computed vectors via `source_id`.
- M5: dry-run shows create/update/no-op/blocked actions with actor attribution; adversarial-triplet PASS/FAIL recorded with preview.
- **M6a (slice termination)**: same plan twice does not duplicate Jira issues; audit hash chain validates end-to-end; signatures verify against git-ref key registry.
- M6b: Confluence pages idempotent; content properties persist across updates.
- M6c: PRs idempotent; default-branch commits refused unless override; hunk-level accept/reject works.
- M7: agents fetch `orchestrator://issue/{issueKey}/context`; pack is bounded, traceable, deterministic; access gate decides on every cache/vector hit.
- M8: report identifies missing AC/test plans/links/risks; `READY_FOR_BUILD` only when score-grade AND verdict-tier permit.
- M9: `ManifestSpawn` consumed identically by Codex and Claude Code; `syncAgentConfigs.ts` regenerates host configs without drift.
- M10: edits land in graph within SLO; duplicates discarded; subscribed agents receive updates without polling; SSE survives NAT/proxy timeouts.
- M11: provisioning events notify channels; eval-view verdict gates merges on `SAFE_TO_SHIP`/`SHIP_WITH_QUARANTINE`; anti-slop linter blocks AI tells.

---

## 6. First shippable slice (M0 → M6a)

Per v6 §37, the first user-deliverable cuts at **M6a**: Jira-only provisioning with actor attribution and ed25519-signed audit chain. M6b (Confluence) and M6c (VCS) are post-slice increments.

**Slice DoD** (subset of full §32):

- Operator can submit raw markdown requirements via `project_intake_create`.
- Server produces a structured blueprint via `project_blueprint_generate`.
- Server runs `project_preflight_check` and emits a non-stale `ProjectProfile`.
- Server previews Jira changes via `project_provision_preview` with adversarial-triplet PASS gate.
- Server executes via `project_provision_execute` idempotently through BullMQ.
- Same plan twice creates zero duplicate Jira issues.
- Every write produces an `AuditEntry` with hash-chain integrity AND ed25519 signature; public key reachable in `refs/orchestrator/keys/{key_id}`.
- Actor attribution propagates into Jira labels + description metadata blocks.
- Lethal-trifecta + ACL gate authorize every cache/vector hit (when M7 lands; not strictly required for slice).

**Time-budget guidance**: M0–M6a is the production-readiness gate; M6b/M6c add provisioning surface area, M7–M11 add safety, observability, and CI rigor. Do not skip ahead.

---

## 7. Cross-cutting concerns

These threads run through every milestone. Each row maps the concern to its v6 home + relevant partner guides + which milestones touch it.

### 7.1 Security

| Sub-concern | v6 ref | Partner guides | Touched in |
|---|---|---|---|
| Lethal trifecta (PRIVATE × untrusted × external) | §38.1 | [open-edison](partners/open-edison.md) | M7 |
| ACL ranking (PUBLIC/PRIVATE/SECRET) | §38.2, §10 | [open-edison](partners/open-edison.md) | M7 |
| Audit log: hash chain + ed25519 + git-ref key registry | §30.1, §38.7 | [agentdiff](partners/agentdiff.md) | M6a, M6b, M6c, M10 |
| Webhook HMAC verification | §26 | [project-foundation](partners/project-foundation.md), [pae](partners/pae.md) | M3, M10 |
| Anti-slop / anti-stub linting (3 layers) | §30.2 | [velocity-ops-engine](partners/velocity-ops-engine.md), [ai-coding-framework](partners/ai-coding-framework.md), [grain](partners/grain.md) | M11 (CI gate) |
| OWASP LLM Top-10 checklist | §38.6 | [ai-coding-framework](partners/ai-coding-framework.md) | M11 |
| Postmortem framework (CATCH→…→ENFORCE) | §30.3, §30.4, §30.5 | [vibe-tuning](partners/vibe-tuning.md) | post-incident, ops runbook |

### 7.2 Observability

| Sub-concern | v6 ref | Partner guides | Touched in |
|---|---|---|---|
| Langfuse traces | §27.1, §35.2 | [uio](partners/uio.md) (compatible stack) | M4, M7, M8 |
| Prometheus + OTel counters | §27.2 | [open-edison](partners/open-edison.md) | M11 |
| Install-unique deaggregation ID | §27.3 | [open-edison](partners/open-edison.md) | M0 |
| Agent Trace v0.1.0 JSONL | §27.4 | [agentdiff](partners/agentdiff.md) | M11 |
| 6-enum observability taxonomy | §27.5 | [claude-code-log-analyzer](partners/claude-code-log-analyzer.md) | M11 |
| 6-cat token tracking | §10, §16.1 | [caliber](partners/caliber.md), [claude-agent-teams-ui](partners/claude-agent-teams-ui.md) | M7, M8 |
| Sentry conditional init | §27.1 | [full-stack-fastapi-template](partners/full-stack-fastapi-template.md) | M11 |

### 7.3 Testing

| Sub-concern | v6 ref | Partner guides | Touched in |
|---|---|---|---|
| 5-cat test framework (UT/IT/ST/PT/E2E) | §17.4, §31 | [project-foundation-workbench](partners/project-foundation-workbench.md) | M0 onward |
| eval-view 4-tier verdict + drift tracker + golden baselines | §17.2, §31, §35.3 | [eval-view](partners/eval-view.md) | M8, M11 (CI) |
| Adversarial verification triplet | §18.1 | [claude-workflow-v2](partners/claude-workflow-v2.md) | M5 (preview gate) |
| Two-stage review (spec → code quality) | §14.4 | [superpowers](partners/superpowers.md) | M8, code-review CI |
| Iron laws (no completion without verification, no code without failing test) | §14.2, §29.1, §38.5 | [superpowers](partners/superpowers.md) | every milestone (PolicyObligation) |
| MCP conformance suite | §31 | [eval-view](partners/eval-view.md) (driver) | M11 |

### 7.4 Workflow + handoff discipline

| Sub-concern | v6 ref | Partner guides | Touched in |
|---|---|---|---|
| 4-mode agent classification | §10, §14.1 | [agent-maestro](partners/agent-maestro.md) | M9 |
| 4-strategy workflow selection | §6.2, §24.1 | [agent-maestro](partners/agent-maestro.md), [open-multi-agent](partners/open-multi-agent.md) | M5, M6a |
| Per-session git worktrees | §13, §24.5 | [agent-maestro](partners/agent-maestro.md) | M3, M6c |
| Fleet pattern (brief compression + claim coordination) | §24.4, §38.4 | [citadel](partners/citadel.md) | M6a |
| File-based handoff (BRIEF/REQUEST/FEEDBACK) | §18.2 | [three-man-team](partners/three-man-team.md) | M5, M6a |
| Deploy-gate accountability | §18.4 | [three-man-team](partners/three-man-team.md) | M6a, M6b, M6c |
| Single-message Task-call constraint (Claude Code) | §24.6 | [claude-workflow-v2](partners/claude-workflow-v2.md) | every milestone using parallel sub-agents |

### 7.5 Conventions + governance

| Sub-concern | v6 ref | Partner guides | Touched in |
|---|---|---|---|
| AGENTS.md spec | §9 | [agents-md](partners/agents-md.md), [ai-coding-framework](partners/ai-coding-framework.md) | M9 |
| ADR template (MADR) | §8, §9 | [madr](partners/madr.md) | every architectural decision |
| ADR governance (START + DoD) | §9 | [adr-github-io](partners/adr-github-io.md) | every ADR |
| 8 context strategies | §3, §35.4 | [agentic-coding-handbook](partners/agentic-coding-handbook.md) | M7 |
| 167-pattern catalog (4 adopted) | §16.7 | [awesome-agentic-patterns](partners/awesome-agentic-patterns.md) | M7, M8 |
| Skill format (5-section) | §17.6 | [citadel](partners/citadel.md) | M9 |
| GT0–GT5 orientation detection | §29.3 | [thinking-partner](partners/thinking-partner.md) | M5, M7, M8 review prompts |

---

## 8. Partner-guide quick index

42 guides total. Full table with v6-section mapping in [`docs/partners/README.md`](partners/README.md).

**P0 (ship with v6)**: [uio](partners/uio.md), [eval-view](partners/eval-view.md), [agentdiff](partners/agentdiff.md).

**P1 (deferred; could promote to A)**: [context-fabric](partners/context-fabric.md), [hindsight](partners/hindsight.md).

**Pattern-lift (Category B, 29)**: agent-maestro, agentic-rag-for-dummies, ai-coding-framework, atomic-agents, caliber, citadel, claude-agent-builder, claude-agent-teams-ui, claude-code-log-analyzer, claude-code-production-grade-plugin, claude-sessions, claude-workflow-v2, codebase-memory-mcp, full-stack-fastapi-template, grain, indxr, mcp-daemon, mcpd, mengram, open-edison, open-multi-agent, pae, project-foundation, project-foundation-workbench, simple-commands-mcp, superpowers, three-man-team, velocity-ops-engine, vibe-tuning.

**Spec / docs (Category C, 8)**: adr-github-io, agentic-coding-handbook, agents-md, awesome-agentic-patterns, claude-code-best-practice, everything-claude-code, madr, thinking-partner.

---

## 9. Risks (active during build)

Full register: v6 §34 (FM-1..FM-20). Risks that need active management *during* the build (not just post-launch):

| Risk | Where it bites | Mitigation surface |
|---|---|---|
| Tool sprawl (FM-1) | M0 onward — every new MCP tool added | Tool-collapse pattern (§14): default to 3 compound tools + N granular behind `--all-tools` |
| Duplicate writes (FM-2) | M6a/b/c | Idempotency keys + stored remote IDs + queue serialization |
| Wrong Confluence body format (FM-3) | M6b | Default to `storage` representation; ADF behind feature flag |
| Lost actor attribution (FM-5) | M6a/b/c | Propagate via labels + metadata blocks + commit trailers + audit log |
| MCP capability mismatch (FM-8) | every milestone | Record `McpSessionProfile`; gate optional features by session |
| Cached/vector content leaks (FM-9) | M7 | Lethal trifecta + ACL ranking + access gate, fail-closed |
| Context packs too large (FM-10) | M7 | 6-cat budget + 5-step truncation + hybrid ranking |
| Stale context (FM-11) | M7, M10 | Pinned source versions + webhook-driven graph updates |
| Destructive writes (FM-12) | M5, M6a/b/c | Dry-run + approval + adversarial-triplet PASS + writeGuards |
| Atlassian rate limits (FM-13) | M2, M6a/b | Backoff honoring Retry-After (incl. 425/408); request budgeting |
| Webhook duplicate delivery (FM-17) | M10 | Deterministic dedup keys `sha256(source+timestamp+content)` + Redis TTL |
| Audit-log tampering | M6a onward | Hash chain + ed25519 + git-ref key registry; SIEM sink optional |
| AI-generated code drift | M11 (CI) | 3-layer linting: bash anti-stub + semgrep + TS anti-slop |
| Concurrent worker scope conflict | M5, M6a | Citadel claim-based coordination at `.orchestrator/coordination/claims/` |
| Context-window-exhaustion mid-job | every long-running milestone | Checkpoint files + discovery-brief compression for Wave 2+ |
| UIO partner unavailable | M2, M4, M7 | Fallback to orchestrator's own embedding pipeline; preflight warning |
| Eval-view partner unavailable | M11 | CI degrades to local-only test gating; verdict layer falls back to deterministic 6-cat score |

---

## 10. Definition of Done (v1)

Verbatim from v6 §32 (single paragraph, condensed for scannability):

The project is complete when a user can:

- submit raw requirements (or a UIO document reference / file upload),
- the server creates a structured project blueprint,
- the server discovers a non-stale project profile,
- the server previews Confluence + Jira + VCS changes (with adversarial-triplet PASS),
- the server executes approved provisioning idempotently through BullMQ with actor attribution propagated into Jira labels, metadata blocks, commit trailers, and PR descriptions,
- the server creates linked Confluence pages and Jira issues with correct per-project-type behavior,
- the server creates/updates VCS agent-context files via generated branch + PR (per-session worktrees, hunk-level review),
- the server exposes paginated MCP resources with session-aware subscription support and 30s SSE keep-alive,
- the lethal-trifecta + ACL ranking + access-control gate + policy decision layer authorize every cache/vector hit,
- the server ingests webhooks with deterministic dedup-key delivery and keeps the graph current,
- the server validates build readiness against the layered rubric (deterministic 6-cat + LLM 4-tier),
- any compliant MCP agent (Codex, Claude Code, or other) can fetch a `ManifestSpawn` handoff,
- eval-view-driven evals (including model-drift canary) pass,
- secrets are redacted,
- writes are audited with hash-chained ed25519-signed records (public key in `refs/orchestrator/keys/`),
- all persistence + vector + secret paths are tenant-scoped,
- anti-stub guardrails + semgrep + TS anti-slop linter all gate merges,
- the operations runbook covers deploy + backup + restore + DR plus the CATCH→DIAGNOSE→ROOT CAUSE→FIX→SAVE→ENFORCE postmortem framework.

---

## 11. Post-v1 backlog (deferred, recorded)

Tracked in v6 §40 as `Deferred-recorded` rows. Do not pull into v1 scope.

| Deferred | Status | Source ADR (or to-be-written) |
|---|---|---|
| Hatchet as alternative queue | considered; chose BullMQ | `docs/adr/0002-bullmq-default-hatchet-considered.md` |
| KMS / Vault / AWS Secrets Manager for audit keys | considered; chose git-ref registry | `docs/adr/0004-agentdiff-key-registry-replaces-kms-v1.md` |
| Algorithmic 11-signal embeddings (codebase-memory-mcp) | considered; chose BGE-M3 via UIO | `docs/adr/0003-qdrant-bge-m3-default-algorithmic-considered.md` |
| Persistent agent memory (hindsight, mengram, Memory Bank) | out of v1 scope per §4 | §4 non-goals + [`partners/hindsight.md`](partners/hindsight.md) §9 |
| OpenAPI codegen via `hey-api/openapi-ts` (F-151) | skipped | manual TS API definitions until post-v1 |
| Multi-tenant SaaS hosting | runway documented in §7.3 | post-v1 |
| Bitbucket Data Center / Server | out of v1 | post-v1 |
| GitHub / GitLab VCS adapters | M3 stubs only | post-v1 |
| Vendor context-fabric (promote P1 → P0) | currently pattern-lift | re-evaluate at v6.1 |

---

## 12. Operating cadence

Once the system is built, ongoing maintenance follows these cadences:

| Cadence | Activity | Reference |
|---|---|---|
| Per PR | Anti-slop + anti-stub + semgrep + eval-view verdict gates | §11, §30.2, §31 |
| Per merge to main | Audit-log hash-chain validation | §30.1, [`partners/agentdiff.md`](partners/agentdiff.md) §8 |
| Weekly | `evalview doctor` (judge cache health) | [`partners/eval-view.md`](partners/eval-view.md) §7 gotcha 4 |
| Per Claude Code minor release | Re-validate F-203 + F-204 + F-205 (plugin emission rules + hook events + foreground-only) | §20.gotchas, [`partners/everything-claude-code.md`](partners/everything-claude-code.md), [`partners/claude-code-best-practice.md`](partners/claude-code-best-practice.md) |
| Per orchestrator minor version | Re-sync §17.1 weights + §30.2 semgrep ruleset + §38.6 OWASP checklist against upstream sources | [`partners/ai-coding-framework.md`](partners/ai-coding-framework.md) §9 |
| Per orchestrator minor version | Re-sync 4 patterns adopted from awesome-agentic-patterns catalog (catalog grows; do not auto-adopt) | [`partners/awesome-agentic-patterns.md`](partners/awesome-agentic-patterns.md) §7 |
| Quarterly | OWASP LLM Top-10 review for new threat categories | [`partners/ai-coding-framework.md`](partners/ai-coding-framework.md) §7 gotcha 3 |
| Quarterly | Sentry DSN rotation; signed-audit private-key rotation cadence reminder | §30.1, [`partners/agentdiff.md`](partners/agentdiff.md) §9 |
| Annually | adr.github.io + agents.md + MADR spec conformance review | [`partners/adr-github-io.md`](partners/adr-github-io.md), [`partners/agents-md.md`](partners/agents-md.md), [`partners/madr.md`](partners/madr.md) |
| Per incident | Run 6-step postmortem (CATCH → DIAGNOSE → ROOT CAUSE → FIX → SAVE → ENFORCE); classify against §30.4/§30.5 taxonomies | §30.3, [`partners/vibe-tuning.md`](partners/vibe-tuning.md) |
| At every v6 minor version review | Re-confirm hindsight + codebase-memory-mcp deferred status; check if scope reverts | [`partners/hindsight.md`](partners/hindsight.md) §9, [`partners/codebase-memory-mcp.md`](partners/codebase-memory-mcp.md) §9 |

---

## 13. What to do right now

1. Read v6 §1, §2, §28, §32, §37 (~30 min).
2. Read [`docs/partners/README.md`](partners/README.md) (~5 min).
3. Read [`docs/partners/uio.md`](partners/uio.md), [`docs/partners/eval-view.md`](partners/eval-view.md), [`docs/partners/agentdiff.md`](partners/agentdiff.md) (~30 min total).
4. Make the §4.2 decisions. Record any non-default choices in a new ADR (`docs/adr/0001-deployment-defaults.md`).
5. Hand v6 §29 Prompt 1 + the M0 partner guides ([simple-commands-mcp](partners/simple-commands-mcp.md), [indxr](partners/indxr.md), [open-edison](partners/open-edison.md), [project-foundation](partners/project-foundation.md), [mengram](partners/mengram.md)) to a build agent. Start M0.
6. Do not advance past M0 until its acceptance check (§5.1 above) passes.
