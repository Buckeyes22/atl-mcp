# Operational Runbook

> **↗ Canonical version:** [`docs/sdlc/08-operations/runbook.md`](../sdlc/08-operations/runbook.md). This file is the interview-audience mirror; the SDLC version is authoritative for engineering use.
> **Mirror of the Confluence centerpiece page** at [`ACO/Operational Runbook`](https://lateapexllc.atlassian.net/wiki/spaces/ACO).
> **TL;DR:** What atl-mcp is responsible for, how to tell when it's healthy, and what to do when it isn't. Three documented incidents at the bottom.

---

## What this service is responsible for

- Producing Jira + Confluence + Bitbucket workspace artifacts on demand from a project profile.
- Maintaining a tamper-evident audit log of every external write.
- Serving MCP context to build agents (resources, tools, prompts).

## What this service is NOT responsible for

- Long-running agent state. Agents persist their own memory; we're a context provider, not a memory store (v6 §4).
- Multi-tenant isolation. Single-tenant only in v1 (v6 §7.3).

---

## Health checks

| Endpoint | Returns | What it proves |
|---|---|---|
| `GET /admin/health` | 200 + JSON | Process is up; admin port is reachable |
| `GET /admin/health/db` | 200 + migration version | DB is reachable; migrations are at expected version |
| `GET /admin/health/audit` | 200 + chain length + last verified timestamp | Audit chain integrity verified within last N minutes |
| `GET /admin/health/upstream` | 200 + Atlassian/VCS rate-limit headroom | External systems reachable and not rate-limited |

Contract verified by [`tests/integration/mgmtApi.test.ts`](../../tests/integration/mgmtApi.test.ts).

---

## Common alerts

### Migration runner stuck

**Symptom:** `/admin/health/db` returns "migration applied but not recorded".
**Root cause:** A partial migration that crashed before the metadata commit.
**Action:** Inspect [`src/storage/migrationRunner.ts`](../../src/storage/migrationRunner.ts) idempotency check; rehearse the failed migration on a snapshot before re-running. The rehearsal harness is at [`tests/integration/storage/migrationRehearsal.test.ts`](../../tests/integration/storage/migrationRehearsal.test.ts).

### Audit chain signature mismatch

**Symptom:** `/admin/health/audit` returns "verifier failed at entry K".
**Root cause:** Either (a) key rotation occurred without a registry update, or (b) tampering. Treat as (b) until proven (a).
**Action:** Do NOT roll back — rolling back the chain is itself an audit event. Open the verifier output, identify the failing entry, look for a key registry git ref change near the entry's timestamp. If a key rotation ran without a registry update, file an incident and run the offline verifier across the entire chain to bound the damage.

### Atlassian API rate limit exhausted

**Symptom:** 429 responses spike. The retry layer in [`src/providers/http/retry.ts`](../../src/providers/http/retry.ts) backs off, but if rates stay capped, queue depth grows.
**Action:** Pause the planner; investigate whether discovery is being run too aggressively. Check `/admin/health/upstream` for headroom. Consider lowering preflight cache TTL.

### OAuth 3LO refresh races

**Symptom:** intermittent 401s under concurrent calls. Tracked as [PCO-59](https://lateapexllc.atlassian.net/browse/PCO-59).
**Action:** Workaround is to fall back to API token auth (set `ATLASSIAN_AUTH_MODE=api_token`). Long-term fix is to serialize refresh through a single-flight cache.

### Stdout corruption (legacy)

**Symptom:** MCP clients drop the connection within the first 100ms of session start.
**Root cause:** Some module wrote to stdout. The lint catches the literal form (`process.stdout.write`, `console.log`); [PCO-12](https://lateapexllc.atlassian.net/browse/PCO-12) documents an open gap for alias forms.
**Action:** Run `npm run lint:no-stdout`. If it passes, grep for `WriteStream` and `process.std*` directly. If still nothing, attach a debugger to the MCP transport and trace the first bytes written to stdout.

---

## Common incidents

### Incident A — M0 stdout leak

**Timeline.** Shipped M0 with a `console.log` in `src/mcp/sessionCapabilities.ts`. First MCP client connection failed silently. Caught when M1 added the `lint:no-stdout` check.

**Root cause.** Protocol-level invariant (no stdout from `src/`) was respected by convention but not by tooling. M0 did not have the lint check.

**Fix.** Removed the offending log; added [`scripts/lint-no-stdout.mjs`](../../scripts/lint-no-stdout.mjs) as a pre-commit + CI check. Documented the rule in [`CLAUDE.md`](../../CLAUDE.md).

**How we prevent it now.** Lint runs in CI; failure fails the build. [PCO-12](https://lateapexllc.atlassian.net/browse/PCO-12) documents an open gap (alias forms slip through).

**Lesson.** Invariants are tooling, not vibes.

### Incident B — Migration applied to wrong-shaped DB

**Timeline.** A new migration assumed an indexed column existed; in dev (pglite) the index was vacuumed-out, masking the assumption.

**Root cause.** Hand-applied SQL migrations couldn't represent "run this against a snapshot first." The team ran the migration in dev, got green, and pushed. Prod failed.

**Fix.** Replaced raw SQL apply with a migration runner that supports rehearsal mode ([PCO-13](https://lateapexllc.atlassian.net/browse/PCO-13)). Rehearsal applies migrations to a temp DB populated from a prod-shaped seed, then verifies invariants before signing off.

**How we prevent it now.** Rehearsal is mandatory in CI; [`tests/integration/storage/migrationRehearsal.test.ts`](../../tests/integration/storage/migrationRehearsal.test.ts) guards against regressions.

**Lesson.** "Works in dev" is unsafe when dev and prod can diverge silently. Test against a prod-shaped surface.

### Incident C — Encryption key rotation broke token reads

**Timeline.** Master encryption key was rotated; existing token rows could no longer be decrypted.

**Root cause.** The token store assumed a single active master key. There's no migration path for re-encrypting existing rows.

**Fix.** Restored the previous key from secret storage; rotated only the "next" key. Documented as known limitation; [PCO-57](https://lateapexllc.atlassian.net/browse/PCO-57) tracks the long-term fix (envelope encryption with per-row data keys).

**How we prevent it now.** The runbook requires a re-encrypt drill before any master-key rotation. The drill is documented; tracked as part of PCO-57.

**Lesson.** Crypto rotation is a system, not a key change. Plan the rotation procedure before issuing the key.

---

## Configuration

Env vars per v6 §20. Required:

```text
ATLASSIAN_SITE_URL=https://<your-site>.atlassian.net
ATLASSIAN_AUTH_MODE=api_token | oauth3lo | service_account
ATLASSIAN_EMAIL=<email>
ATLASSIAN_API_TOKEN=<token>          # if api_token
# OAuth 3LO vars if oauth3lo (see v6 §20)

VCS_PROVIDER=bitbucket
BB_WORKSPACE=<workspace>
BB_APP_PASSWORD=<password>           # ADR-0004
# Or BB_OAUTH_* if OAuth

DATABASE_URL=postgres://...          # or pglite path in dev (ADR-0001)
AUDIT_SIGNING_KEY_REGISTRY_REF=refs/heads/audit-keys

ADMIN_PORT=3030
MCP_PORT=3031
```

Loader: [`src/config/env.ts`](../../src/config/env.ts).

---

## Deploy process

1. Build the image: `docker build -t atl-mcp:<tag> .` (uses [`Dockerfile`](../../Dockerfile) at repo root).
2. Run database migrations in rehearsal mode against a snapshot of prod.
3. Promote: deploy the new image; run migrations in normal mode against prod.
4. Verify `/admin/health` and `/admin/health/audit` after deploy.

A new milestone (M11) will harden this with proper canary + rollback. Currently manual.

---

## Linked artifacts

- **Code:** [`src/config/env.ts`](../../src/config/env.ts), [`src/storage/migrationRunner.ts`](../../src/storage/migrationRunner.ts), [`src/security/policyDecisionLayer.ts`](../../src/security/policyDecisionLayer.ts)
- **Tests:** [`tests/integration/mgmtApi.test.ts`](../../tests/integration/mgmtApi.test.ts), [`tests/integration/storage/migrationRehearsal.test.ts`](../../tests/integration/storage/migrationRehearsal.test.ts)
- **Spec:** v6 §20, §22, §27 (observability + SLOs), §28 (milestones)
- **Jira:** [PCO-12](https://lateapexllc.atlassian.net/browse/PCO-12), [PCO-13](https://lateapexllc.atlassian.net/browse/PCO-13), [PCO-57](https://lateapexllc.atlassian.net/browse/PCO-57), [PCO-59](https://lateapexllc.atlassian.net/browse/PCO-59)

*Last reviewed: 2026-04-25 by Chris.*
