# Remaining Phases — Handoff for Next Session

**Audience**: a Claude Code session continuing M4 onward. You have zero context from prior sessions. Read this top to bottom, then pick up at Phase 2 / M4.

**Rule before doing anything**: see [`~/.claude/projects/C--Users-Chris-Documents-git-atl-mcp/memory/feedback_verify_inability_before_handoff.md`](file:///c/Users/Chris/.claude/projects/C--Users-Chris-Documents-git-atl-mcp/memory/feedback_verify_inability_before_handoff.md). Don't ask the operator to do something manually until you've actually attempted it and it has failed. Especially: don't ask for credentials/keys/IDs you can fetch yourself via the API or filesystem.

---

## 1. Companion docs (read first)

| Doc | Purpose |
|---|---|
| [`agent-context-orchestrator-mcp-plan-v6.md`](../agent-context-orchestrator-mcp-plan-v6.md) | Canonical spec. §28 = milestones; §29 = build prompts; §10 = domain model; §40 = findings table mapping each adoption to a partner. |
| [`docs/build-orchestration.md`](build-orchestration.md) | Build sequence wiring v6 milestones to partner guides. **§5 has the master M0→M11 table; §7 has cross-cutting concerns; §10 is the v1 DoD.** |
| [`docs/partners/`](partners/) | 42 partner integration guides (3 P0 + 2 P1 + 29 pattern-lift + 8 spec-docs). Each adoption point in v6 has a corresponding guide. |
| [`docs/adr/`](adr/) | MADR-formatted decisions. 0000–0004 already exist. Each milestone produces ADR(s) for non-obvious choices. |

If a question is answerable from these four locations, prefer them over inferring from code. If a question is about *current* code state, prefer the code over the planning docs (the docs may have drifted slightly).

---

## 2. Current state (as of audit 2026-04-25, post-Phase-A.1 closure)

**Production-quality**: M0 (runtime scaffold), M1 (domain + storage), M2 (Atlassian providers + preflight), M3 (Bitbucket VCS adapter + worktree manager + webhook signatures).

**M4–M11 status**: surface area exists in `src/workflows/`, `src/queue/`, `src/coordination/`, `src/evals/`, `src/planning/`, `src/context/`, but the workflow bodies **DO NOT meet v6 §28 acceptance**. They are wired only when their `MILESTONE_N_ENABLED` flag is set; default is `false`. **Each milestone's first task is to replace the stub body BEFORE flipping the flag.** See `docs/audit-findings-2026-04-25.md` F-001 for the full inventory of stubs.

**Flag → tool mapping** (default off):
- `MILESTONE_4_ENABLED` → `project_intake_create`, `project_blueprint_generate`, `project_blueprint_update`
- `MILESTONE_5_ENABLED` → `project_provision_preview`
- `MILESTONE_6A_ENABLED` → `project_provision_execute`
- `MILESTONE_7_ENABLED` → `context_pack_generate`, `context_get`
- `MILESTONE_8_ENABLED` → `readiness_validate`
- `MILESTONE_9_ENABLED` → `handoff_generate`
- `MILESTONE_10_ENABLED` → `webhook_ingest`

**Test count**: run `npm test` for the current count. Postgres parity tests remain skipped unless `DATABASE_URL` is set.

**Source files**: 83+ in `src/`, 38 in `tests/`.

**End-to-end flows that work today**:
- `npm test` — typecheck + 186 tests in ~15s.
- `npm run build && npm start` — boots the MCP server (stdio + HTTP transport on :3000, mgmt API on :3001). `npm run start:http` and `npm run start:stdio` are cross-platform wrappers.
- `npm run preflight` — composes the full stack against real `lateapexllc.atlassian.net`, runs `runPreflight`, prints JSON profile to stdout, persists to `project_profiles` table, exits 0/1 on warnings. **Verified working against real Atlassian.**

**Patterns to reuse** (do not reinvent):
- **Composition root**: `src/compositionRoot.ts` builds the dependency graph from env. Wire new providers (M4 sampling, M6a queue, M7 Qdrant, etc.) into this same factory. Tests can ignore it and compose subsets manually.
- **Per-milestone CLI**: `scripts/preflight-cli.ts` is the template. Each milestone that needs end-to-end smoke against real services gets a similar `scripts/<milestone>-cli.ts` so the operator can validate against real systems without booting the full MCP server.
- **Tool registry**: `src/mcp/toolRegistry.ts` is the central registry; `buildServer.ts` installs ONE dispatcher. New MCP tools register via `registry.register({...})`, not by hooking the SDK directly.
- **Fixture-then-real testing**: write fixture-driven integration tests first (covers wire shapes); add a CLI for real-API smoke when credentials are available. Audit pass after smoke catches wire-shape mismatches the fixtures hid (we caught one in M2 — Confluence v2 `/spaces/{id}` requires numeric, not key).
- **F-031 invariant**: `src/` must NEVER write to stdout. Use the pino file logger via `src/observability/logger.ts`. `npm run lint:no-stdout` and a vitest test enforce it.
- **`exactOptionalPropertyTypes: true`**: when passing optional props to a strict-typed parameter, spread conditionally: `...(value !== undefined ? { key: value } : {})`.

**ADRs decided**:
- 0000 — ADR process (MADR + START + DoD)
- 0001 — PGlite for dev, Postgres 16 for deployed
- 0002 — Token encryption uses `@noble/ciphers` xchacha20poly1305
- 0003 — Confluence storage default; ADF behind feature flag
- 0004 — Bitbucket app-password default; OAuth deferred

---

## 3. Operating context (env, creds, vault)

**`.env` is gitignored**, populated, and contains:
- Atlassian: `ATLASSIAN_AUTH_MODE=api_token`, `ATLASSIAN_SITE_URL=https://lateapexllc.atlassian.net`, `JIRA_BASE_URL`, `CONFLUENCE_BASE_URL=...wiki`, `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN` (in vault as item `atlassian-api-token-jira-cli`).
- Smoke targets: `JIRA_PROJECT_KEY=SAM1` (the `(Example) Billing System Dev` team-managed project), `CONFLUENCE_SPACE_KEY=SD` (`Software Development` space).
- Token store: `TOKEN_MASTER_KEY` (32-byte random base64; generated locally).

**Real Atlassian creds work** — preflight runs successfully against `lateapexllc.atlassian.net` today. Token fingerprint validated, both Jira `discoverProjectCapabilities` and Confluence `discoverSpaceCapabilities` return populated profiles.

**No Bitbucket Cloud creds**. The operator's actual VCS infra is GitLab self-hosted (`git.lateapexllc.com`) + GitHub. v6 firmly targets Bitbucket Cloud for v1 (§3); GitLab/GitHub adapters are post-v1. **The worktree manager works against any local git repo** — set `WORKTREE_SOURCE_REPO_PATH` + `WORKTREE_ROOT` to use it against the operator's real GitLab/GitHub repos.

**No UIO partner creds**. The vault contains `uio-burst-*` items (Cloudflare R2, RunPod, Tailscale, "UIO Burst API") — those are a *different* uio-burst compute system, NOT the v6 §35.1 Universal Intake Orchestrator. UIO partner stays disabled (`UIO_ENABLED=false`); preflight reports it as such with no warning.

**Bitwarden vault access**: BW CLI is installed at `~/bin/bw`. Items can be queried via `bw list items --search <term>` and `bw get item <name>`. **Important**: prior session leaked a BW session key into the transcript and asked the operator to `bw lock`. Do NOT request another vault session unless absolutely needed and the operator initiates. If you need a credential and it's not in `.env`, name the env var precisely; the operator handles BW lookup themselves.

**Postgres parity tests skip without `DATABASE_URL`**. CI should set it; local dev runs PGlite-only and that's fine.

---

## 4. Phase 2 — Earn the shippable slice (M4 → M5 → M6a)

This is the longest coherent stretch. M6a is the first user-visible deliverable. Three milestones, each builds tightly on the previous. Estimated 3–4 sessions if you take them one at a time.

### Phase 2.1 — M4: Blueprint workflow + LLM sampling

**v6 ref**: §28 M4. **§29 Prompt 5**.

**Deliverable**: `project_intake_create`, `project_blueprint_generate`, `project_blueprint_update`, blueprint validator, host-delegated MCP sampling integration. Optionally accepts UIO document references (skip in v1; UIO disabled).

**Acceptance**: raw markdown requirements → structured `ProjectBlueprint`. Open questions emitted when info is missing. Deterministic blueprint at temperature 0 (snapshot tests). Sampling traces appear in Langfuse (M11 wires Langfuse; M4 just emits the trace events).

**Partner patterns to consume**:
- [`docs/partners/pae.md`](partners/pae.md) — Handlebars conditional template selector for prompt routing.
- [`docs/partners/claude-agent-builder.md`](partners/claude-agent-builder.md) — 6-phase workflow shape for blueprint generation.
- [`docs/partners/agentic-coding-handbook.md`](partners/agentic-coding-handbook.md) — 3 reasoning methods (Three Experts / Self-Refinement / Zero-One-N-Shot).
- [`docs/partners/uio.md`](partners/uio.md) — adapter calls for `uio_ingest` (skip in v1; types in place from M2).

**New surface area to add**:
- `src/workflows/intakeWorkflow.ts` + `src/workflows/blueprintWorkflow.ts`.
- `src/validators/blueprintValidator.ts` — Zod schemas + semantic checks.
- `src/mcp/sampling.ts` — host-delegated `sampling/createMessage` adapter (only when client advertises sampling per `McpSessionProfile`).
- `src/mcp/tools/projectIntake.ts` — registers `project_intake_create`, `project_blueprint_generate`, `project_blueprint_update` via the central `toolRegistry`.
- `prompts/intake-interview.md`, `prompts/blueprint-generation.md` — first §29 prompts emitted as files.
- Wire blueprint repository — already exists (`projectRepository`); just use it.

**Composition + CLI**:
- Add to `compositionRoot.ts`: a sampling adapter (or a stub when no MCP client is connected); the new workflows.
- Add `scripts/blueprint-cli.ts` — takes a markdown file path, outputs structured blueprint. Lets you smoke-test against real LLM sampling without booting the MCP server.
- Sampling needs an LLM provider. Two options: (a) require the client to provide it (real MCP host scenario); (b) for the CLI smoke, use Anthropic SDK directly with `ANTHROPIC_API_KEY` env (operator supplies — likely have it).

**Smoke test target**: take a real requirements doc (operator provides one, or synthesize a small one), run `npm run blueprint -- --input requirements.md`, get back a structured blueprint with goals, requirements, epics, open questions.

**Likely gotchas**:
- MCP host-delegated sampling is per-session; the CLI bypasses MCP and calls the LLM provider directly. Two code paths; share the prompt rendering logic.
- `exactOptionalPropertyTypes` will bite you on partial blueprint construction. Use the same conditional-spread pattern as M2.
- Atlassian's `customFieldMap` (from M2's preflight) is consumed here — when M5 generates issue payloads, it'll need to map blueprint fields to `customfield_NNNNN`.

**Known gaps to defer to M5/M6a**:
- 4-tier confidence verdict from eval-view → M8.
- Adversarial verification triplet on blueprint output → introduced in M5 preview gate.

### Phase 2.2 — M5: Provisioning planner

**v6 ref**: §28 M5. **§29 Prompt 6**.

**Deliverable**: artifact plan generator (Confluence pages, Jira issues, VCS branches+files+PRs), actor-attribution in the plan (labels, metadata blocks, commit trailers), policy decisions per planned action, structured output schemas, `project_provision_preview` MCP tool, **adversarial verification triplet** running on the preview output.

**Acceptance**: dry-run shows create/update/no-op/blocked actions with actor attribution. **No remote writes during preview.** Plan includes estimated request count. Adversarial triplet PASS/FAIL recorded with the preview.

**Partner patterns to consume**:
- [`docs/partners/pae.md`](partners/pae.md) — comparison-matrix shape + signal-weighted policy scoring.
- [`docs/partners/project-foundation.md`](partners/project-foundation.md) — idempotent upsert pattern.
- [`docs/partners/project-foundation-workbench.md`](partners/project-foundation-workbench.md) — scope-signature + 14 slash commands.
- [`docs/partners/claude-workflow-v2.md`](partners/claude-workflow-v2.md) — adversarial verification triplet (3 critics in parallel).
- [`docs/partners/three-man-team.md`](partners/three-man-team.md) — file-based BRIEF/REQUEST/FEEDBACK handoff.

**New surface area**:
- `src/workflows/provisioningWorkflow.ts` — plan generation + preview path.
- `src/planning/artifactPlan.ts` — domain shape for the plan output.
- `src/planning/actorAttribution.ts` — already exists (`src/providers/atlassian/auth/actorAttribution.ts`); extend to plan-level annotation.
- `src/review/adversarialTriplet.ts` — three parallel critic LLM calls + synthesis.
- `src/mcp/tools/projectProvision.ts` — registers `project_provision_preview`.

**Composition + CLI**: extend `compositionRoot.ts`; add `scripts/provision-preview-cli.ts` that reads a blueprint and prints the plan + triplet verdict.

**Smoke test target**: against a real existing blueprint (M4 output), generate the plan, verify the dry-run output, verify NO writes happen against `lateapexllc.atlassian.net`.

**Critical**: the preview MUST NOT write to remote systems. Only after M6a does anything actually mutate Atlassian state. The adversarial triplet runs on the preview's output, before any execute path is even available.

### Phase 2.3 — M6a: Jira provisioning executor (FIRST SHIPPABLE SLICE)

**v6 ref**: §28 M6a. **§29 Prompt 7**. **This is the slice boundary** — the orchestrator becomes user-visible here.

**Deliverable**: BullMQ worker integration, `project_provision_execute` for Jira-only targets, idempotency-key handling, policy enforcement (including adversarial-triplet PASS gate), job resource exposure via MCP, **audit log with hash-chain integrity AND ed25519 signatures over JCS-canonicalized records (key registry in `refs/orchestrator/keys/`)**, actor-attribution writes (labels, description metadata block, audit entry), graph update after writes.

**Acceptance**: same plan twice does NOT duplicate Jira issues. Generated issue keys/IDs and actor labels stored. Job state observable via MCP resource. Audit hash chain validates end-to-end. Audit signatures verify against the git-ref key registry.

**Partner patterns to consume**:
- [`docs/partners/open-multi-agent.md`](partners/open-multi-agent.md) — TaskQueue + 4 schedulers + approval-gate callback + skip-cascade.
- [`docs/partners/citadel.md`](partners/citadel.md) — claim-based scope coordination + discovery-brief compression.
- [`docs/partners/agentdiff.md`](partners/agentdiff.md) — **ed25519 + JCS canonicalization + git-ref key registry**. This is the audit signing pipeline.
- [`docs/partners/project-foundation.md`](partners/project-foundation.md) — pluggable Transport pattern for queue worker abstraction.

**New surface area**:
- `src/queue/provisionQueue.ts` — BullMQ queue + worker. Requires Redis (the docker-compose Redis is already configured).
- `src/queue/jobs/provisionJob.ts` — the job that calls Jira's createIssue/updateIssue with idempotency.
- `src/security/auditChain.ts` — ed25519 signing + JCS canonicalization (use `@noble/curves` + `canonicalize`). The repo + schema already exist; add the signing pipeline.
- `src/storage/repositories/keyRegistryRepository.ts` — git-ref key registry (`refs/orchestrator/keys/{key_id}:pub.key`). Shells out to `git update-ref` + `git push`.
- `src/mcp/tools/projectProvisionExecute.ts` — registers `project_provision_execute` + the job-state resource.
- `src/coordination/claimsManager.ts` — Citadel claim-based coordination at `.planning/coordination/claims/`.

**Composition + CLI**:
- Add Redis client, BullMQ queue, signing pipeline, key registry to `compositionRoot.ts`.
- `scripts/provision-execute-cli.ts` for end-to-end smoke against real Atlassian. **CAUTION: this writes to real Jira.** Use a sandbox project (NOT SAM1, which is the example/sandbox) or a fresh test issue type. Document the cleanup procedure.
- ed25519 keypair bootstrap: `scripts/audit-keys-init.ts` — generates the keypair, registers the public key to `refs/orchestrator/keys/<key_id>`, pushes to `origin`. One-time per deployment.

**Smoke test target**: write 2-3 real Jira issues to a test project. Verify:
1. Re-running the same plan does NOT create duplicates (idempotency check via `ensure-jira-issue-tracking.ts` upsert pattern).
2. Each issue has the actor-attribution label `orchestrator-actor-<fingerprint>`.
3. Each write produces an `AuditEntry` with valid hash chain + ed25519 signature.
4. `git fetch origin refs/orchestrator/keys/<key_id>` retrieves the public key.
5. CLI command `audit verify --since HEAD~1` reports zero failures.

**M6a is the longest single milestone**. It introduces queue, audit signing, key registry, claims coordination, and the first real-write code path. Plan 2-3 sessions for it. After M6a passes, you have a "thing that works end-to-end" — the v6 §37 first shippable slice.

---

## 5. Phase 3 — Complete provisioning (M6b + M6c)

Same executor framework as M6a; just adds Confluence + VCS targets.

### M6b — Confluence provisioning executor

**v6 ref**: §28 M6b. **§29 Prompt 8**.

**Deliverable**: Confluence page provisioning in the same executor (storage representation default per ADR 0003). Metadata in content properties + labels + visible metadata block in the page body.

**Acceptance**: idempotent (no dup pages). Content properties persist across updates. Metadata block preserved against manual edits.

**New code is small** — leverages M2's `confluenceRestProvider` + M6a's executor. Add a `confluenceProvisionJob.ts` mirroring `provisionJob.ts`.

### M6c — VCS branch + PR provisioning executor

**v6 ref**: §28 M6c. **§29 Prompt 9**.

**Deliverable**: VCS provisioning in the same executor. Generated files committed in **per-session worktrees** (already built in M3). Branch + PR per session. Commit trailers carry actor attribution. PR description carries metadata block. **Hunk-level review** in preview (`node-diff3`).

**Acceptance**: idempotent (no dup PRs; subsequent runs update the existing PR). Default-branch commits refused unless override. Hunk-level accept/reject works.

**Partner patterns**:
- [`docs/partners/agent-maestro.md`](partners/agent-maestro.md) — per-session worktree pattern (already implemented in M3 — reuse).
- [`docs/partners/claude-agent-teams-ui.md`](partners/claude-agent-teams-ui.md) — hunk-level review with `node-diff3`.
- [`docs/partners/agentdiff.md`](partners/agentdiff.md) — commit trailers (`Orchestrator-Actor-Fingerprint`, `Orchestrator-Audit-Id`).

**Real Bitbucket smoke** would need credentials. **Operator's actual VCS is GitLab/GitHub**, so M6c may be the right time to either (a) build a thin GitLab adapter for real-system smoke, or (b) accept fixture-only verification for v1 and gate the real smoke on a future Bitbucket workspace.

---

## 6. Phase 4 — Make it useful to agents (M7, M8, M9)

After M6 lands, these three are largely independent of each other. Could parallelize.

### M7 — Context resources + packs

**v6 ref**: §28 M7. **§29 Prompt 10**.

**Heaviest standalone milestone**. Introduces:
- Qdrant + BGE-M3 embeddings (or UIO vector reuse if UIO is enabled — currently it's not).
- `context_pack_generate`, `context_get`, MCP resources for project + issue context.
- 6-category token budgeting (already typed in `domain/tokenBudget.ts`).
- 5-step progressive truncation (indxr F-052 pattern).
- 22-model context-size table (context-fabric F-041).
- FTS5 BM25 ranking with column weights (context-fabric F-042).
- Redaction (gitleaks-rule-compatible).
- Prompt-injection scanning (context-fabric F-043).
- Lethal trifecta + ACL ranking + access gate integration (open-edison F-126).

**Partners**: context-fabric (5 patterns), agentic-rag-for-dummies, uio (if enabled), thinking-partner, open-edison.

**Plan 2 sessions**. Qdrant integration is the heaviest external dependency since M0.

### M8 — Readiness validation

**v6 ref**: §28 M8. **§29 Prompt 11 (combined with M9)**.

**Deliverable**: `readiness_validate` tool, layered scoring (deterministic 6-cat A/B/C/D from Caliber + LLM-judged 4-tier verdict from eval-view), 5-cat test framework with auditable Not-Applicable.

**Partner**: [`docs/partners/eval-view.md`](partners/eval-view.md) — wholesale dependency on the eval-view package. Operator needs `EVAL_VIEW_ENABLED=true` + provider key. Document gracefully degrading to deterministic 6-cat only when eval-view absent.

### M9 — Agent handoff

**v6 ref**: §28 M9. **§29 Prompt 11 (combined with M8)**.

**Deliverable**: `handoff_generate` returning `ManifestSpawn`, `build-agent-handoff` prompt, single canonical source emitting `AGENTS.md` + Cursor/Codex/Copilot configs in parity. `scripts/syncAgentConfigs.ts` regenerates host configs.

**Partners**: claude-agent-builder (6-phase + 7-pattern), agent-maestro (manifest spawning + 4-mode classification), project-foundation-workbench (agent-config-shim auto-generation), Caliber, everything-claude-code.

---

## 7. Phase 5 — Make it operate (M10 + M11)

### M10 — Webhook ingestion + resource subscriptions

**v6 ref**: §28 M10. **§29 Prompt 12**.

**Deliverable**: webhook ingress endpoint, Atlassian + Bitbucket webhook handlers, signature verification (`src/security/webhookSignatures.ts`), deterministic repository-backed dedup with `sha256(source+timestamp+rawBody)` keys, normalized `GraphChangeEvent` pipeline, resource pagination, session-aware subscriptions, SSE 30s keep-alive.

**Acceptance**: Confluence/Jira edits land in graph within SLO. Duplicate deliveries discarded. Subscribed agents receive `notifications/resources/updated` without polling. Drift on orchestrator-generated artifacts flagged in readiness report.

### M11 — Notifications, evals, hardening

**v6 ref**: §28 M11. **§29 Prompt 13**.

**Deliverable**: notification provider (Slack + Teams via pluggable `Transport<T>`), full eval-view integration (golden datasets + LLM judges + drift tracker + auto-PR + model-drift canary), TS `grain`-equivalent anti-slop linter, banned-patterns semgrep + bash anti-stub scanners, MCP conformance tests, SLO metrics export, deployment runbook.

**Acceptance**: notifications fire on provisioning + waiver events. Eval framework gates merges on `SAFE_TO_SHIP` or `SHIP_WITH_QUARANTINE` verdict. Anti-slop linter blocks AI-generated tells. Operations runbook covers deploy/backup/restore/DR.

**Last milestone**. After M11 passes, v1 is shippable per [`docs/build-orchestration.md`](build-orchestration.md) §10 Definition of Done.

---

## 8. How to operate as the next session

1. **Pick the milestone you're starting on.** Read its §28 entry in v6, the corresponding §29 prompt, and the partner guides cited in §6 of [`build-orchestration.md`](build-orchestration.md).
2. **Create tasks via TaskCreate.** Break the milestone into 6–10 tasks. Mark in-progress as you start, completed as you finish. The user has been responding to this cadence.
3. **Read existing code before extending.** `src/compositionRoot.ts` and `scripts/preflight-cli.ts` are the templates for new wiring. The `toolRegistry` is the only way to register new MCP tools. Don't reinvent.
4. **Write fixture-driven tests first**, real-API smoke when you have credentials. The audit pass after smoke (per the M2 lesson) catches wire-shape bugs the fixtures hide. Document any new ADRs.
5. **End-of-milestone summary should include**: tests added/total, source files added, ADRs written, real-API smoke result (if applicable), known gaps, and what's needed before the next milestone.
6. **`bw lock` reminder**: at the start of any session that touches Bitwarden, remind the operator to `bw lock` afterward. The operator authorizes vault access explicitly; do not assume it persists between sessions.

### Disciplines to maintain

| Discipline | Source | Enforcement |
|---|---|---|
| File-only logger; never `console.*` in `src/` | simple-commands-mcp F-031 | `npm run lint:no-stdout` + a vitest test |
| Focused modules | project-foundation-workbench F-207 | split files when it improves reviewability or ownership |
| TypeScript strict + `exactOptionalPropertyTypes: true` | tsconfig.json | `npm run typecheck` |
| Two-stage review (spec compliance → code quality) | superpowers F-107 | manual at PR review |
| Iron laws (no completion without verification, no code without failing test first) | superpowers F-106 | manual; PolicyObligation in M6a |
| ADR for non-obvious decisions | adr.github.io F-123 + madr F-122 | `docs/adr/` |
| Verify-before-handoff | `~/.claude/projects/.../memory/feedback_verify_inability_before_handoff.md` | manual |
| Single-message Task-call constraint (when emitting Claude Code plugins) | claude-workflow-v2 F-083 | future docs/claude-code.md |

### Per-milestone deliverable shape

Each milestone produces (based on M0/M1/M2/M3 cadence):

- **Source code** in `src/` matching the v6 §8 layout.
- **Unit + integration tests** in `tests/`.
- **Composition wiring** in `src/compositionRoot.ts` (when applicable).
- **CLI script** in `scripts/` for operator-facing real-API smoke.
- **One or more ADRs** for non-obvious decisions.
- **Updated `.env.example`** with new env vars.
- **End-of-milestone summary message** to the operator listing test count, files, ADRs, smoke result, gaps.

---

## 9. Things flagged at end of M3 the operator may want addressed

These are open questions, not blockers:

1. **VCS reality**: operator's git infra is GitLab self-hosted (`git.lateapexllc.com`) + GitHub. v6 targets Bitbucket Cloud. Decide: (a) operator sets up a free Bitbucket Cloud workspace for the orchestrator's own VCS use, (b) build a thin GitLab adapter as a v1.x extension before M6c, (c) skip live VCS smoke until later. M6c needs this answered.
2. **OAuth bootstrap CLI**: deferred for both Atlassian (M2) and Bitbucket (M3). Needed when first deployment uses OAuth instead of token/password. Approximately 1 session of work each. Not blocking; API tokens are fully working.
3. **`/createmeta` drill-down for team-managed required fields**: M2 noted that team-managed Jira projects return empty `requiredFields[]` from the per-project `/createmeta` endpoint; full required-field discovery requires per-issue-type drill-down. M5 will need this when generating issue payloads.
4. **~~MCP server doesn't yet expose preflight tools~~** — RESOLVED. `src/server.ts:21` calls `buildCompositionRoot()` and wires `registerCompositionTools` so `project_preflight_check` + `project_profile_get` are exposed unconditionally. Other M4–M11 tools register only when their `MILESTONE_N_ENABLED` flag is set.
5. **Master key is in `.env`** for v1; KMS migration is post-v1 (per ADR 0002). Production deployments should rotate `TOKEN_MASTER_KEY` at the same cadence as the audit-signing private key (when M6a lands).

---

## 10. Quick reference: file inventory

```
src/
├── server.ts                    # Entry; M4 needs to wire compositionRoot in
├── compositionRoot.ts           # Dependency graph factory; extend per milestone
├── config.ts + config/env.ts    # Typed env loader + defensive helpers
├── observability/logger.ts      # File-only pino (F-031)
├── domain/                      # 19 entity files; barrel index
├── storage/
│   ├── db.ts                    # Dual-mode PGlite + Postgres
│   ├── schema/*.ts              # 10 Drizzle tables
│   ├── migrations/0001_init.sql # Hand-authored, applies to both
│   └── repositories/            # 9 tenant-scoped DAOs + factory
├── security/
│   ├── policyDecisionLayer.ts   # Interface + buildDecision helper
│   ├── policyAdapters/codePolicyAdapter.ts
│   ├── tokenEncryption.ts + .testDouble.ts + tokenStore.ts
│   └── webhookSignatures.ts     # M3; used by M10
├── providers/
│   ├── Provider.ts
│   ├── http/                    # restClient, retry, pagination
│   ├── atlassian/
│   │   ├── auth/                # apiToken, oauth3lo (scaffolded), actorAttribution
│   │   ├── jiraProvider.ts + jiraRestProvider.ts
│   │   ├── confluenceProvider.ts + confluenceRestProvider.ts
│   │   ├── adf.ts
│   │   └── confluenceStorageRenderer.ts
│   ├── vcs/
│   │   ├── VcsProvider.ts
│   │   ├── bitbucket/auth/appPassword.ts + bitbucketRestProvider.ts
│   │   └── worktreeManager.ts   # Provider-agnostic; works against any git repo
│   └── uio/uioMcpAdapter.ts     # Reachability stub; M4 fills full ingest
├── preflight/preflightWorkflow.ts
├── mcp/
│   ├── buildServer.ts + toolRegistry.ts
│   ├── sessionCapabilities.ts + registerResources.ts + registerTools.ts
│   ├── transport/stdio.ts + http.ts
│   └── tools/projectPreflight.ts
└── server/mgmtApi.ts            # Port 3001 dual-port pattern
scripts/
├── lint-no-stdout.mjs
└── preflight-cli.ts             # Template for future per-milestone CLIs
tests/
├── unit/                        # 40+ test files across domain, security, providers, mcp
├── integration/                 # Storage, providers (real-fixture), preflight, worktrees
└── lint/no-stdout.test.ts       # F-031 invariant guard
docs/
├── build-orchestration.md       # The big-picture build guide
├── remaining-phases.md          # ← this file
├── adr/                         # 0000–0004 (process, PGlite, encryption, ADF, Bitbucket auth)
└── partners/                    # 42 partner integration guides
.env / .env.example              # .env is gitignored; .example tracked
docker-compose.yml + Dockerfile  # M0 + M3 with env_file
package.json                     # Scripts: build, test, typecheck, dev, preflight, lint:no-stdout
AGENTS.md + CLAUDE.md + README.md
```

---

## 11. The first command the next session should run

```bash
cd C:/Users/Chris/Documents/git/atl-mcp
npm test 2>&1 | tail -10
npm run preflight 2>&1 | tail -15
```

If both pass, the system is in a known-good state and you can proceed with whatever milestone is next. If something fails, fix it before adding new code — don't layer new milestones on a broken baseline.

Then read v6 §28 M4 + §29 Prompt 5 + the partner guides cited in §4.1 of this doc, and start.
