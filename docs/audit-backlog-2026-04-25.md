# Code Quality + Functionality Audit Backlog - 2026-04-25

Companion to [`docs/audit-findings-2026-04-25.md`](audit-findings-2026-04-25.md). Items are ordered by dependency and risk. Do not mark a finding closed without the acceptance evidence listed here.

Status update 2026-04-25: B1.1-B1.5, B2.1-B2.4, B3.2-B3.3, B4.1, and B4.3 have implementation evidence in the closure notes. B3.1 has manual built-runtime smoke evidence but no dedicated CI test yet. B4.2 was superseded by operator decision to remove the file-size guard.

## Phase 0: Audit Blockers

- **B0.1 - Restore Git metadata for history-aware review**
  - Findings: audit limitation
  - Work: run future audits from a real Git checkout or restore `.git`.
  - Closure evidence: `git status --short` succeeds.

- **B0.2 - Run deferred external/parity checks**
  - Findings: audit limitation
  - Work: run Bitbucket live test when creds exist, UIO live test when deployed, and local/CI Postgres parity with `DATABASE_URL`.
  - Closure evidence: `BITBUCKET_LIVE_TEST=1`, `UIO_LIVE_TEST=1`, and `DATABASE_URL=... npm test` evidence appended to findings.

## Phase 1: Safety and Correctness

- **B1.1 - Make packaged runtime boot**
  - Findings: F-001
  - Work: copy SQL migrations into `dist/storage/migrations` during build, or resolve migrations from a packaged asset path.
  - Closure evidence: `npm run build && node --env-file=.env dist/server.js` starts; `/healthz` returns 200.

- **B1.2 - Fix startup diagnostics**
  - Findings: F-002
  - Work: replace ESM-invalid `require("node:fs")` fallback in `src/server.ts`.
  - Closure evidence: forced startup failure writes `orchestrator-startup-error.log` containing the real exception.

- **B1.3 - Validate write-capable execute payloads**
  - Findings: F-005
  - Work: add a strict Zod schema for `ArtifactPlan` and nested actions before `project_provision_execute` creates a job or calls providers.
  - Closure evidence: invalid plan test proves no provider call; valid plan test still succeeds.

- **B1.4 - Enforce external-write policy obligations**
  - Findings: F-006
  - Work: verify fresh preview, preflight/profile freshness, access-gate allow, and persist policy decisions before Jira writes.
  - Closure evidence: tests show each missing/failed obligation blocks `jira.createIssue`.

- **B1.5 - Secure webhook ingestion before M10**
  - Findings: F-008
  - Work: require signatures, verify them, and persist dedup keys with TTL.
  - Closure evidence: invalid signatures rejected; duplicates rejected across process restart/storage boundary.

## Phase 2: Runtime Functionality

- **B2.1 - Make transport scripts portable**
  - Findings: F-003
  - Work: replace POSIX inline env assignment with `cross-env` or wrapper scripts.
  - Closure evidence: `npm run start:http` and `npm run start:stdio` pass on Windows/Linux/macOS.

- **B2.2 - Capture real MCP session negotiation**
  - Findings: F-004
  - Work: update `SessionRegistry` from actual initialize params/results instead of placeholder values.
  - Closure evidence: resource read shows actual `protocolVersion`, `clientInfo`, and advertised sampling capability.

- **B2.3 - Wire real async provisioning queue**
  - Findings: F-007
  - Work: enqueue provision jobs through BullMQ/Redis and have a worker update `provisionJobRepository`.
  - Closure evidence: execute returns queued job immediately; job resource transitions through queued/running/completed.

- **B2.4 - Fix Docker deployed-mode storage**
  - Findings: F-009
  - Work: set compose orchestrator env to Postgres/Redis deployed mode or document it as intentionally ephemeral.
  - Closure evidence: `docker compose up orchestrator` uses Postgres, applies migrations, and persists state across restart.

## Phase 3: Test Hardening

- **B3.1 - Add built-runtime smoke coverage**
  - Findings: F-001, F-002, F-003
  - Work: add a test or CI step that runs the built `dist/server.js` with env and probes `/healthz`.
  - Closure evidence: CI fails if migrations/assets are missing from `dist`.

- **B3.2 - Add provider contract-test surface or correct the docs**
  - Findings: F-012
  - Work: create `tests/contract/` for provider contracts, or revise AGENTS.md taxonomy.
  - Closure evidence: `npm test` runs contract tests, or docs accurately describe current fixture/integration coverage.

- **B3.3 - Add execute-path negative tests**
  - Findings: F-005, F-006
  - Work: test malformed plans, missing preview identity, stale preflight, access-gate denial, and policy obligation failures.
  - Closure evidence: all negative cases return errors and assert zero remote provider calls.

## Phase 4: Documentation and Maintainability

- **B4.1 - Refresh README and handoff docs**
  - Findings: F-010
  - Work: update milestone status, test counts, quick-start commands, and known limitations.
  - Closure evidence: every documented command runs from a clean checkout.

- **B4.2 - Superseded: file-size guard removed**
  - Findings: F-011
  - Work: no blocking remediation remains; split large files opportunistically when it improves reviewability or ownership.
  - Closure evidence: `lint:file-size` script/test/CI enforcement removed.

- **B4.3 - Normalize env documentation**
  - Findings: F-010, F-012
  - Work: document live-test toggles, remove or label forward-compat env vars not read by code, and correct `.env.example` header.
  - Closure evidence: code-read env vars and documented env vars intentionally match or are explicitly marked future-scope.
