# Code Quality + Functionality Audit Findings - 2026-04-25

**Scope**: whole-codebase audit of `src/`, `tests/`, `scripts/`, `docs/`, configs, runtime wiring, MCP tool/resource behavior, and generated-output drift. `node_modules/` excluded. `dist/` treated as generated runtime output.

**Audit mode**: read-only for external systems. No provisioning, Jira writes, Confluence writes, VCS branch/PR writes, migrations against external databases, or remediation patches.

**Environment**:
- CWD: `C:\Users\Chris\Documents\git\atl-mcp`
- Node: `v24.15.0`
- npm: `11.12.1`
- Git metadata: unavailable (`fatal: not a git repository...`)

## Summary

- **Total findings**: 12
  - Critical: 1
  - High: 7
  - Medium: 4
  - Low: 0
- **Quality gates**:
  - `npm run typecheck`: PASS
  - `npm test`: PASS, 232 passed / 6 skipped / 47 files
  - `npm run lint:no-stdout`: PASS
  - `npm run lint:anti-stub`: PASS
  - `npm run build`: PASS
- **Read-only live checks**:
  - `npm run preflight`: PASS against configured Atlassian; Jira required fields populated.
  - `ATLASSIAN_LIVE_TEST=1` live Atlassian test: PASS, 2 tests.
  - Bitbucket/UIO live tests: not run; no live toggles/creds configured for this audit.
- **Runtime smoke**:
  - Source runtime via `npx tsx --env-file=.env src/server.ts`: PASS for `/healthz`, `/readyz`, `/metrics`.
  - Built runtime via `node dist/server.js`: FAIL; see F-001.
  - HTTP MCP initialize + `tools/list` via source runtime: PASS.
  - Session capability resource read via source runtime: FAILS negotiated-value expectation; see F-004.

## Findings

### F-001: Built `dist` runtime cannot start because SQL migrations are not copied

- **Severity**: Critical
- **Category**: functionality, operations, generated drift
- **Evidence**:
  ```text
  $ npm start
  > node dist/server.js
  Exit code: 1
  ```
  ```text
  $ node --env-file=.env --input-type=module -e "import('./dist/compositionRoot.js')..."
  Error: ENOENT: no such file or directory, scandir
  'C:\Users\Chris\Documents\git\atl-mcp\dist\storage\migrations'
  ```
  `src/storage/migrationRunner.ts` sets `MIGRATIONS_DIR = join(HERE, "migrations")`, but `dist/storage/` has no `migrations/` directory after `npm run build`.
- **Impact**: `npm start`, `npm run start:*`, the package `bin`, and the Docker runtime path all fail before the server can boot.
- **Suggested remediation**: make `npm run build` copy `src/storage/migrations/*.sql` into `dist/storage/migrations/`, or change the migration runner to resolve packaged SQL assets from a stable runtime path. Add a smoke test that runs the built server or at least `buildCompositionRoot()` from `dist`.
- **Verification needed**: `npm run build && node --env-file=.env dist/server.js` starts successfully and `/healthz` returns 200.
- **Blocks**: M0 runtime acceptance, Docker deployment, any packaged release.

### F-002: Startup failure fallback logging is broken under ESM

- **Severity**: High
- **Category**: operations, observability
- **Evidence**:
  `src/server.ts` catches startup failure and calls:
  ```ts
  const { writeFileSync } = require("node:fs") as typeof import("node:fs");
  ```
  The project is `"type": "module"`, so `require` is not available in ESM. When `npm start` fails, the command exits with no diagnostic output and no `orchestrator-startup-error.log` is created.
- **Impact**: startup failures are silent, which hides root causes such as F-001 and missing env vars.
- **Suggested remediation**: import `writeFileSync` statically from `node:fs`, or use `await import("node:fs")` in the catch block. Add a test or smoke script that forces startup failure and asserts the fallback log is written.
- **Verification needed**: run the server with a deliberately missing `TOKEN_MASTER_KEY`; confirm nonzero exit plus `orchestrator-startup-error.log` with the actual error.
- **Blocks**: reliable operations and troubleshooting.

### F-003: `start:http` and `start:stdio` scripts are not Windows-compatible

- **Severity**: High
- **Category**: operations, portability
- **Evidence**:
  ```text
  $ npm run start:http
  > MCP_TRANSPORT=http node dist/server.js
  'MCP_TRANSPORT' is not recognized as an internal or external command
  ```
  The audit ran on Windows/PowerShell, which is this workspace's active environment.
- **Impact**: documented/package runtime scripts fail for Windows operators.
- **Suggested remediation**: use a cross-platform env runner (`cross-env`) or replace these scripts with small Node/tsx wrapper scripts that set `process.env.MCP_TRANSPORT`.
- **Verification needed**: `npm run start:http` and `npm run start:stdio` work on Windows, Linux, and macOS CI.
- **Blocks**: local runtime smoke on Windows.

### F-004: Session capability resource never records negotiated protocol/client data

- **Severity**: High
- **Category**: functionality, MCP wiring
- **Evidence**:
  HTTP MCP smoke initialized successfully, then reading `orchestrator://session/current/capabilities` returned:
  ```json
  {
    "status": "active",
    "negotiatedProtocolVersion": "pending-initialize",
    "clientCapabilities": {},
    "featuresEnabled": []
  }
  ```
  `src/transport/http.ts` and `src/transport/stdio.ts` explicitly register `"pending-initialize"` and empty capabilities.
- **Impact**: M0's negotiated-capabilities acceptance is not met. M4 host-delegated sampling will stay disabled even for clients that advertise sampling, because `featuresEnabled` is derived from an empty capability object.
- **Suggested remediation**: capture initialize params/results through the MCP SDK-supported hook or transport event path and update `SessionRegistry` with actual `protocolVersion`, `clientInfo`, and `clientCapabilities`.
- **Verification needed**: HTTP and stdio MCP smokes show the client's protocol version and sampling capability after initialize.
- **Blocks**: M0 capability contract, M4 sampling, feature gating.

### F-005: `project_provision_execute` accepts an unvalidated write plan

- **Severity**: High
- **Category**: security, functionality
- **Evidence**:
  `src/mcp/tools/projectProvision.ts` defines:
  ```ts
  const EXECUTE_INPUT = z.object({
    plan: z.unknown(),
    approved: z.boolean(),
  });
  ...
  const plan = params.plan as ArtifactPlan;
  ```
- **Impact**: if `MILESTONE_6A_ENABLED=true`, a write-capable tool can receive arbitrary JSON and cast it to `ArtifactPlan`. Malformed plans can crash after a job is created or, worse, reach provider calls with unchecked fields.
- **Suggested remediation**: add a Zod schema for `ArtifactPlan` and nested planned actions, including `triplet.verdict`, actor attribution, action kind, target, blueprint refs, labels, idempotency keys, and Jira fields. Reject invalid input before job creation.
- **Verification needed**: tests prove malformed plans return `isError: true` without calling `jira.createIssue`; valid plans still execute.
- **Blocks**: safe M6a enablement.

### F-006: External-write policy obligations are not fully enforced

- **Severity**: High
- **Category**: security, safety
- **Evidence**:
  `src/security/policyAdapters/codePolicyAdapter.ts` returns `require_approval` for `mutate_external` with obligations:
  ```ts
  require_human_approval
  require_preview
  require_access_gate_allow
  ```
  `src/queue/jobs/provisionJob.ts` only checks `deny` and `require_approval && !input.approved`; it does not verify a fresh preview, access-gate/lethal-trifecta result, or persist the policy decision.
- **Impact**: the policy layer is called, but most obligations are advisory. A caller with `approved: true` bypasses preview freshness and access-gate enforcement.
- **Suggested remediation**: turn obligations into enforceable checks at execute time: verify preview/triplet identity, fresh preflight/profile, access-gate allow, and persist the policy decision/audit evidence.
- **Verification needed**: unit tests where missing fresh preview or access-gate failure prevents any provider write.
- **Blocks**: M6a write-path safety.

### F-007: Provision execution is synchronous and bypasses the BullMQ/Redis queue surface

- **Severity**: High
- **Category**: functionality, operations
- **Evidence**:
  `src/mcp/tools/projectProvision.ts` creates a job row and then immediately awaits execution:
  ```ts
  await jobs.create(... status: "running")
  const result = await executeFn(...)
  await jobs.update(... status: "completed")
  ```
  `src/queue/worker.ts` is marked deprecated and says `createBullMqProvisionQueue` is a forward-compat seam. `ts-prune` reports `createBullMqProvisionQueue` and `globalProvisionJobStore` as unused.
- **Impact**: `project_provision_execute` does not behave like a real asynchronous job. Long Jira writes block the MCP request; restart/resume/worker isolation and Redis-backed queue semantics are absent.
- **Suggested remediation**: wire BullMQ behind `project_provision_execute`: enqueue, return job URI immediately, have a worker process execute and update `provisionJobRepository`.
- **Verification needed**: execute returns a queued job before provider completion; resource state transitions queued -> running -> completed/failed; worker survives server request lifecycle.
- **Blocks**: M6a queue acceptance and production write-path reliability.

### F-008: `webhook_ingest` has no signature verification and only in-memory deduplication

- **Severity**: High
- **Category**: security, functionality
- **Evidence**:
  `src/workflows/webhookIngestionWorkflow.ts` uses:
  ```ts
  const seen = new Set<string>();
  ...
  if (seen.has(id)) return { accepted: false };
  seen.add(id);
  ```
  `src/mcp/tools/projectWorkflows.ts` accepts `{ source, timestamp, content }` only. No signature header/secret is passed to the workflow, despite `src/security/webhookSignatures.ts` existing.
- **Impact**: if `MILESTONE_10_ENABLED=true`, any caller can inject webhook-shaped graph events, and deduplication resets on process restart.
- **Suggested remediation**: require provider-specific signature metadata at the tool/API boundary, verify with `webhookSignatures`, persist dedup keys with TTL, and reject unsigned or invalid webhook events.
- **Verification needed**: invalid signatures are rejected; duplicate signed events are rejected across process restart or repository-backed storage.
- **Blocks**: M10 webhook ingestion.

### F-009: Docker/compose deployment is not wired to the intended deployed storage mode

- **Severity**: High
- **Category**: operations, storage
- **Evidence**:
  `docker-compose.yml` starts Postgres and Redis, but leaves these orchestrator env vars commented:
  ```yaml
  # DATABASE_DEV_MODE: "false"
  # DATABASE_URL: postgres://orchestrator:dev@postgres:5432/orchestrator
  # REDIS_URL: redis://redis:6379
  ```
  `src/compositionRoot.ts` defaults `DATABASE_DEV_MODE` to `true`, so the container uses in-memory PGlite unless overridden.
- **Impact**: even after F-001 is fixed, the default compose orchestrator service will not use the Postgres service it depends on, and runtime state is ephemeral.
- **Suggested remediation**: set `DATABASE_DEV_MODE=false`, `DATABASE_URL`, and `REDIS_URL` in the orchestrator service or document that compose's orchestrator service is dev-only and intentionally ephemeral.
- **Verification needed**: `docker compose up orchestrator` shows migrations applied to Postgres and state survives container restart.
- **Blocks**: deployed-mode parity and Docker acceptance.

### F-010: Documentation claims are stale relative to current code and audit evidence

- **Severity**: Medium
- **Category**: docs
- **Evidence**:
  `README.md` says:
  ```md
  Status: M0 (Scaffold) in progress
  npm run build && npm start
  ```
  `docs/remaining-phases.md` says:
  ```md
  Test count: 212 passing, 2 skipped, 38 test files.
  npm run build && npm start - boots the MCP server
  ```
  Current audit: 232 passing / 6 skipped / 47 files, and `npm start` fails due F-001.
- **Impact**: the next operator/session will follow stale startup and milestone status guidance.
- **Suggested remediation**: update README and remaining-phases after F-001/F-003 are fixed. Keep test counts either current or remove exact counts from handoff docs.
- **Verification needed**: documented quick-start commands run successfully from a clean checkout.
- **Blocks**: handoff accuracy.

### F-011: Superseded: file-size guard removed by operator decision

- **Severity**: Medium
- **Category**: maintainability, quality
- **Evidence**:
  On 2026-04-25 the operator requested complete removal of the file-size guard.
- **Impact**: oversized files are no longer a blocking invariant; reviewers should still split files when that improves reviewability or ownership.
- **Suggested remediation**: none.
- **Verification needed**: `package.json`, CI, `scripts/`, and `tests/lint/` contain no file-size guard wiring.
- **Blocks**: none.

### F-012: Test taxonomy/docs mention provider contract tests, but no `tests/contract/` exists

- **Severity**: Medium
- **Category**: test, docs
- **Evidence**:
  `AGENTS.md` says:
  ```md
  tests/contract/ - provider contract tests (lands with M2)
  ```
  Current test directories are only:
  ```text
  fixtures
  integration
  lint
  unit
  ```
- **Impact**: provider behavior is covered by unit/integration/live tests, but the documented contract-test category has not landed. This weakens portability for future GitHub/GitLab/VCS providers and makes the test taxonomy inaccurate.
- **Suggested remediation**: either add `tests/contract/` with provider contract suites, or update AGENTS.md to say contract coverage is represented by current integration fixtures until the directory lands.
- **Verification needed**: `tests/contract/` exists and runs in `npm test`, or AGENTS.md no longer claims it has landed.
- **Blocks**: provider portability discipline.

## What I Did Not Verify

- Real Bitbucket Cloud smoke: skipped; no `BITBUCKET_LIVE_TEST=1` or credentials configured for this audit.
- UIO live smoke: skipped; UIO is disabled in the configured environment.
- Postgres parity locally: skipped in the default suite because `DATABASE_URL` was not set locally. CI has a Linux Postgres job, but this audit did not run GitHub Actions.
- Docker build/run: not executed; findings are based on Dockerfile/compose review plus the built `dist` runtime failure.
- Git history, blame, changed-files scope, and branch status: unavailable because `.git` metadata is absent.

## Recommended Next Actions

1. Fix F-001 first: packaged runtime cannot boot.
2. Fix F-002 and F-003 so startup failures are visible and scripts work on Windows.
3. Fix F-004 before enabling M4 sampling-dependent workflows.
4. Keep M6a/M10 milestone flags off until F-005 through F-008 are closed.
5. Update README/remaining-phases after runtime fixes land.

## Closure Notes

Implemented on 2026-04-25:

- F-001 closed: `npm run build` now copies SQL migrations into `dist/storage/migrations`; built HTTP runtime smoke returned 200 from `/healthz` and `/readyz`.
- F-002 closed: startup fallback logging uses ESM-safe `writeFileSync`; forced missing `TOKEN_MASTER_KEY` wrote `orchestrator-startup-error.log`.
- F-003 closed: `start`, `start:http`, and `start:stdio` use the cross-platform `scripts/start-server.mjs` wrapper.
- F-004 closed: HTTP and stdio transports record initialize params through `SessionRegistry`; HTTP initialize smoke showed negotiated protocol/client capabilities.
- F-005 closed: `project_provision_execute` validates `ArtifactPlan` and approval evidence with Zod before queue/provider delegation.
- F-006 closed for M6a Jira execution: executor enforces triplet PASS, preview/profile identity, local access gate, profile freshness, approval evidence, and persists policy decisions.
- F-007 closed for request-path behavior: `project_provision_execute` delegates to BullMQ through `ProvisionQueue` and returns a job resource URI instead of awaiting provider writes.
- F-008 closed: `webhook_ingest` requires signed raw bodies, verifies Hub-style HMACs, parses JSON only after verification, and persists dedup keys in `webhook_deliveries`.
- F-009 closed in config: compose now sets `DATABASE_DEV_MODE=false`, `DATABASE_URL`, and `REDIS_URL` for the orchestrator service.
- F-010 closed for audited stale claims: README, `.env.example`, and remaining-phases docs were refreshed to current runtime, feature-flag, webhook, and test-count guidance.
- F-012 closed: `tests/contract/` now exists and is exercised by `npm test`.

F-011 superseded by operator decision on 2026-04-25: the file-size guard was removed entirely. Oversized-file cleanup is no longer tracked as a blocking invariant; split files when it improves reviewability or ownership.
