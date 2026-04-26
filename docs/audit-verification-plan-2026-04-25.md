# Audit — Verification Follow-up Plan (2026-04-25)

**Companion to**: [`audit-findings-2026-04-25.md`](audit-findings-2026-04-25.md). This plan closes the seven items listed under **"What I did NOT verify"** in that report. Each item's pass criteria and procedure are concrete enough for an operator (or a follow-up audit session) to execute end-to-end.

**Operating rule**: every check below ends in evidence (command + truncated output, or a passing test name). A check is closed only when that evidence is appended to the audit findings file under the corresponding "Verified on YYYY-MM-DD" footnote.

---

## V-1. Real-Bitbucket Cloud smoke

**Acceptance bar tested**: v6 §28 M3 — "Bitbucket Cloud adapter passes contract tests" against the real API (fixtures already pass).

**Why deferred**: no Bitbucket Cloud credentials. Operator's primary VCS is GitLab self-hosted + GitHub.

**Prerequisites**:
1. A Bitbucket Cloud workspace (free tier is sufficient).
2. A user account with **Repositories: Read/Write** + **Pull Requests: Read/Write** scopes.
3. An app password minted at https://bitbucket.org/account/settings/app-passwords/.
4. A throwaway repo (≥1 commit on the default branch) inside the workspace.

**Operator decision required first** — pick one and document in an ADR:
- (a) Stand up a Bitbucket Cloud workspace specifically for the orchestrator's smoke surface (cheapest; aligns with v6 §3).
- (b) Defer until M6c and instead build a GitLab adapter (1 session) — this also unblocks operator's actual infra.
- (c) Accept fixture-only verification for v1 and gate the real smoke on a future BB workspace.

**Procedure** (assumes option a):
1. Add to `.env`:
   ```
   BITBUCKET_USERNAME=<user>
   BITBUCKET_APP_PASSWORD=<app password>
   BITBUCKET_WORKSPACE=<workspace>
   BITBUCKET_REPO_SLUG=<throwaway repo slug>
   ```
2. Build a small CLI matching the preflight pattern:
   ```
   scripts/bitbucket-smoke-cli.ts
   ```
   - calls `discoverRepoCapabilities`, `getRepository`, `getFile`, `putFiles` (single-file commit on a throwaway branch), `createPullRequest`, then deletes the throwaway branch.
   - logs each call's status + latency.
3. Run: `npm run bitbucket:smoke` (add the script to `package.json`).
4. Diff each TS interface in `src/providers/vcs/bitbucket/bitbucketRestProvider.ts` against the real response shapes — same procedure used in audit Pass 3 for Atlassian (`curl ... | jq | keys`).

**Pass criteria**:
- Every call returns 2xx; latencies <2s p95.
- Worktree-style branch (`orchestrator/<sessionId>`) is created, committed to, PR'd, and cleaned up.
- No fields appear in real responses that aren't modeled in the TS interfaces (and vice versa). If they do, file follow-up findings.

**Failure handling**:
- 401/403 → app-password scope mismatch; expand scopes and retry.
- Field shape mismatch → log as a wire-shape finding (high-priority); do not patch silently.

**Estimated time**: 1 session (creds + CLI) + 1 session if wire-shape fixes are needed.

---

## V-2. POSIX worktree behavior

**Acceptance bar tested**: v6 §28 M3 — "Worktree acquire/release works on POSIX AND Windows."

**Why deferred**: audit ran on Windows 11; no CI matrix exists in the repo.

**Prerequisites**:
- Repository wired to GitHub Actions (or equivalent CI runner) with Linux + macOS images available.
- `git` 2.40+ available on each runner (default on `ubuntu-latest` and `macos-latest`).

**Procedure**:
1. Add `.github/workflows/ci.yml` (new file):
   ```yaml
   name: ci
   on: [push, pull_request]
   jobs:
     test:
       strategy:
         matrix:
           os: [ubuntu-latest, macos-latest, windows-latest]
       runs-on: ${{ matrix.os }}
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: '22' }
         - run: npm ci
         - run: npm run typecheck
         - run: npm run lint:no-stdout
         - run: npm test
   ```
2. Push and let CI run.
3. Confirm `tests/integration/providers/vcs/worktreeManager.test.ts` passes on all three matrix entries (7/7 each).

**Pass criteria**:
- All 3 matrix runs green.
- No platform-specific timeouts (the worktree tests today take ~3.6s; allow up to 10s on macOS).

**Failure handling**:
- Path-separator bugs likely surface in `worktreesRoot` / `sourceRepoPath` joins. Fix at the implementation site; do not branch on `process.platform` unless the bug is fundamentally OS-divergent.
- File-locking failures on macOS APFS may surface; investigate `git worktree add` flag differences.

**Estimated time**: 1–2 hours to add CI; iterative for any platform fixes.

---

## V-3. Postgres parity (M1)

**Acceptance bar tested**: v6 §28 M1 — "Migration rehearsal test passes (parity between PGlite and Postgres)." Two tests skip today gated on `DATABASE_URL`.

**Why deferred**: `DATABASE_URL` not set in this audit's environment.

**Prerequisites**:
- Docker available (the repo's `docker-compose.yml` already includes Postgres).
- Or a managed Postgres 16+ instance reachable from the test runner.

**Procedure**:
1. Bring up Postgres:
   ```
   docker compose up -d postgres
   ```
2. Apply the database URL:
   ```
   export DATABASE_URL=postgres://orchestrator:dev@localhost:5432/orchestrator
   ```
3. Run the migration rehearsal suite specifically:
   ```
   npx vitest run tests/integration/storage/migrationRehearsal.test.ts
   ```
4. Confirm both previously-skipped tests now run and pass:
   - `migration rehearsal: Postgres > creates the expected M1 tables`
   - `migration rehearsal: Postgres > re-running migrations is idempotent`
5. Add `DATABASE_URL` to the CI `test` job (V-2's matrix) using a service container:
   ```yaml
   services:
     postgres:
       image: postgres:16
       env: { POSTGRES_PASSWORD: dev, POSTGRES_USER: orchestrator, POSTGRES_DB: orchestrator }
       ports: ['5432:5432']
       options: --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
   ```

**Pass criteria**:
- Total test count rises from 206/2-skipped to 208/0-skipped on the matrix run that has `DATABASE_URL` set.
- PGlite vs Postgres catalog snapshots match byte-for-byte (the parity test asserts this).

**Failure handling**:
- Drizzle dialect divergence (e.g., `serial` vs `bigint`) → fix at the schema level, not the migration level.
- PGlite version skew (it tracks Postgres 16.x) → bump PGlite if Postgres minor version moves; flag if Postgres 17 lands and PGlite hasn't.

**Estimated time**: <1 hour for first run; the schema is small.

---

## V-4. MCP inspector / real-client smoke (M0)

**Acceptance bar tested**: v6 §28 M0 — "MCP inspector lists the health tool over both [transports]." Currently verified only via vitest (`tests/unit/buildServer.test.ts`); transport-level negotiation untested end-to-end.

**Why deferred**: no MCP inspector running in the audit environment.

**Prerequisites**:
- Node 22+.
- `@modelcontextprotocol/inspector` (npx-runnable; no global install needed).
- Built dist: `npm run build`.

**Procedure** (stdio):
1. Boot the inspector against stdio:
   ```
   npx @modelcontextprotocol/inspector node dist/server.js
   ```
2. In the inspector UI:
   - Confirm `tools/list` includes: `health_check`, `project_preflight_check`, `project_profile_get`, `project_intake_create`, `project_blueprint_generate`, `project_blueprint_update`, `project_provision_preview`, `project_provision_execute`, `context_pack_generate`, `context_get`, `readiness_validate`, `handoff_generate`, `webhook_ingest`.
   - Confirm `resources/list` includes: `orchestrator://session/current/capabilities`, `orchestrator://session/current/preflight`, `orchestrator://jobs/recent`.
   - Invoke `health_check`. Verify `structuredContent` matches the Zod schema in `src/mcp/registerTools.ts:11-20`.
3. Capture the session-capabilities resource read; confirm `negotiatedProtocolVersion` is non-empty (i.e., not `"pending-initialize"` after initialize).

**Procedure** (HTTP):
1. Start the server: `MCP_TRANSPORT=http npm start &`
2. Point inspector at `http://localhost:3000/mcp` (Streamable HTTP mode).
3. Repeat the tools/list + resources/list verification.
4. Verify session-id header (`mcp-session-id`) round-trip.

**Pass criteria**:
- All 13 tools listed on each transport.
- All 3 resources readable.
- Session-capabilities resource shows the actual negotiated `protocolVersion` after initialize completes — this surfaces the F-001-adjacent bug noted in `src/transport/stdio.ts:51-65` and `src/transport/http.ts:159-176` where the placeholder `"pending-initialize"` profile may never be replaced. **If the negotiated version stays `"pending-initialize"`, file a separate finding.**

**Failure handling**:
- Inspector compatibility issues with SDK 1.27+ → pin to an older inspector version; document in an ADR.

**Estimated time**: 1–2 hours.

---

## V-5. UIO real reachability

**Acceptance bar tested**: v6 §28 M2 — "UIO partner reachability when configured." Currently `UIO_ENABLED=false` so reachability is intentionally not exercised.

**Why deferred**: UIO partner is not deployed for this operator's environment. The vault contains `uio-burst-*` items (Cloudflare R2 / RunPod / Tailscale / "UIO Burst API") which are a *different* compute system per `docs/remaining-phases.md` §3.

**Operator decision required**:
- (a) Disabled in v1 (current); preflight reports `enabled: false` and emits no UIO warnings. Pass criteria below.
- (b) Stand up a UIO partner deployment per `docs/partners/uio.md` §9 — a non-trivial integration. Defer to post-v1.

**Procedure for (a) — verify the disabled path stays accurate**:
1. Run `npm run preflight` against the configured `.env`.
2. Confirm the output JSON has **no** `uio` key (or has `uio.baseUrlReachable: false` if the operator did set creds for testing).
3. Confirm `warnings[]` does not include any `target: "uio"` entries when `UIO_ENABLED=false`. (If `UIO_ENABLED=true` and any reach probe failed, the warning *should* be there.)
4. Add a single regression test at `tests/integration/preflight.test.ts` asserting: when no UIO adapter is provided, the resulting profile has no `uio` field and no UIO warnings.

**Pass criteria for (a)**:
- Preflight output JSON validates structurally (no UIO field when disabled).
- The new regression test passes.

**Pass criteria for (b)**: same as the original audit Pass 3 procedure, run with real UIO endpoints.

**Estimated time**: <1 hour for (a); 2+ sessions for (b).

---

## V-6. Eval-view real verdict (M11)

**Acceptance bar tested**: v6 §28 M11 — "Verdict layer gates merges on `SAFE_TO_SHIP` or `SHIP_WITH_QUARANTINE`." Today only the deterministic 6-cat scoring exists (and even that is a stub per F-001).

**Why deferred**: M11 not yet started; eval-view partner not configured.

**Prerequisites**:
- M11 has shipped (see `docs/remaining-phases.md` §7).
- `EVAL_VIEW_ENABLED=true` and a provider key (eval-view supports OpenAI/Anthropic).

**Procedure** (when M11 lands):
1. Confirm `tests/evals/` directory exists and contains golden datasets per `docs/partners/eval-view.md`.
2. Run `npm run eval` (script TBD); confirm verdict ∈ {`SAFE_TO_SHIP`, `SHIP_WITH_QUARANTINE`, `INVESTIGATE`, `BLOCK_RELEASE`}.
3. Confirm CI fails on `INVESTIGATE` or `BLOCK_RELEASE`.
4. Confirm fallback path: when `EVAL_VIEW_ENABLED=false`, the verdict layer degrades to deterministic 6-cat only and the system still ships (per v6 §34 risk row "Eval-view partner unavailable").

**Pass criteria**: deferred until M11 lands.

**Estimated time**: 0 today; ~1 session post-M11.

---

## V-7. `sampling/createMessage` host-delegated path (M4)

**Acceptance bar tested**: v6 §28 M4 — "Sampling call traces appear in Langfuse." Currently only the disabled-adapter path is unit-tested (`tests/unit/mcp/sampling.test.ts`).

**Why deferred**: requires an MCP host that advertises the `sampling` capability (Claude Desktop, an inspector with sampling enabled, or a custom test harness).

**Prerequisites**:
- Claude Desktop (or another MCP host with sampling support) installed locally.
- Orchestrator built and registered as an MCP server in the host's config (e.g., `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, or the equivalent on Windows).
- Optional: Langfuse account + `LANGFUSE_*` env vars (M4 wires the trace; M11 wires the actual Langfuse client per v6 §27).

**Procedure**:
1. Register the orchestrator with the host:
   ```json
   {
     "mcpServers": {
       "atl-mcp-orchestrator": {
         "command": "node",
         "args": ["<abs-path>/dist/server.js"],
         "env": { "MCP_TRANSPORT": "stdio", "...": "..." }
       }
     }
   }
   ```
2. From Claude Desktop, invoke `project_intake_create` with a small markdown document, then `project_blueprint_generate` with `useSampling: true`.
3. Inspect the orchestrator's log file (`./orchestrator.log`) for the line emitted from `src/mcp/sampling.ts:createHostDelegatedSamplingAdapter`. The trace event payload is what M11 ships to Langfuse.
4. Confirm the returned blueprint differs from the deterministic-fallback shape (i.e., the LLM response was actually applied via `parseSampledPatch`).

**Pass criteria**:
- Sampling adapter is **not** the disabled stub; trace event includes `projectId`, `blueprintVersion`, `promptVersion: "blueprint-generation.v1"`.
- Generated blueprint has fields populated by the LLM, not just the markdown parser fallback.
- Re-running with `temperature: 0` produces a deterministic snapshot (M4 acceptance: "Blueprint is deterministic for snapshot tests at temperature 0").

**Failure handling**:
- If the host doesn't surface sampling: confirm via `tools/list` whether the server's session capability profile records `clientCapabilities.sampling`. If absent, the host doesn't support sampling and the adapter correctly falls back.
- If the adapter throws: check `resolveCurrentSessionId()` returns a non-undefined sessionId in stdio mode (`STDIO_SESSION_ID`).

**Estimated time**: 1 session.

---

## Closing the audit's "did NOT verify" section

When each item above has been executed, append a line to the audit findings file under a new section:

```markdown
## Verifications closed since 2026-04-25

- V-1 (Bitbucket smoke) — closed YYYY-MM-DD by <method>; evidence: <link/file>.
- V-2 (POSIX worktree) — ...
- ...
```

Do not delete the original "What I did NOT verify" section — it is the historical record. The closures sit alongside it.
