---
title: Operational Runbook
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [operator, engineer]
sdlc_category: 08-operations
related: [docs/demo/runbook.md, docs/sdlc/08-operations/alerting.md, docs/sdlc/08-operations/slo-sli.md]
---

# Operational Runbook

> **TL;DR:** Symptom-organized runbook for atl-mcp. If you're on-call, find the symptom your alert fired on and follow the entry. Each entry has a hypothesis tree, diagnostic commands, and a recovery procedure. Three documented incidents at the bottom (Incidents A/B/C) — read these first; they shape the rest of this doc.

This is the canonical operational runbook. The portfolio mirror at [`docs/demo/runbook.md`](../../demo/runbook.md) is a summary for reference readers; **this file is authoritative**.

Entry shape follows [`../templates/runbook-template.md`](../templates/runbook-template.md).

---

## What this service is responsible for

- Producing Jira + Confluence + Bitbucket workspace artifacts on demand from a project profile.
- Maintaining a tamper-evident audit log of every external write.
- Serving MCP context to build agents (resources, tools, prompts).

## What this service is NOT responsible for

- Long-running agent state. Agents persist their own memory; we're a context provider, not a memory store (v6 §4).
- Multi-tenant isolation. Single-tenant only in v1 (v6 §7.3).
- Atlassian / Bitbucket availability. Their outages are theirs.

## Health checks

| Endpoint | Returns | What it proves |
|---|---|---|
| `GET /healthz` | 200 + JSON | Process is up; admin port reachable |
| `GET /readyz` | 200 + JSON | Migrations at expected version; DB reachable |
| `GET /metrics` | text/plain (Prometheus) | Counter exposure works |
| `GET /admin/health/audit` (planned) | 200 + chain length + last verified ts | Audit chain integrity verified within last N minutes |
| `GET /admin/health/upstream` (planned) | 200 + Atlassian/VCS rate-limit headroom | External systems reachable and not rate-limited |

Contract verified by `tests/integration/mgmtApi.test.ts`. Endpoints with `(planned)` are M11 work.

---

## Symptom-organized entries

### Entry: MCP clients drop within ~100 ms of session start

> **Symptom:** A connecting MCP client (Claude Code, Cursor, Codex, etc.) opens a session and the connection closes ~immediately, with no useful error.
> **Severity:** P0 if any client traffic exists in the env.
> **First-touch budget:** 5 minutes.

#### What it might be

1. **Stdout corruption.** Most likely. Some module wrote to stdout, corrupting the JSON-RPC stream. See Incident A.
2. **Capability negotiation mismatch.** Client speaks a newer / older MCP spec.
3. **Auth failure during session init.** Less likely; usually surfaces as a different error.

#### Diagnostic commands

```bash
# Confirm process is running
curl -s http://localhost:3001/healthz | jq

# Look for stdout writes since startup
grep -E '(console\.log|process\.stdout)' src/ tests/  # should be empty in src/

# Run the protocol-stream lint
npm run lint:no-stdout

# Tail the orchestrator log
tail -100 ./orchestrator.log | grep -i 'mcp\|session\|capability'
```

#### Action

1. If `lint:no-stdout` fails: identify the offending file. Fix or revert. Note: PCO-12 documents an alias-form gap; if the literal form passes but stdout is still corrupted, grep `process.stdout` and `WriteStream` directly.
2. If lint passes: capture session-start handshake logs at `debug` level temporarily. Check capability negotiation against `src/mcp/sessionCapabilities.ts`.
3. If auth-failure pattern: consult [Entry: provider 401s](#entry-provider-401-spike) below.

#### Lesson

Invariants are tooling, not vibes. The lint exists because of Incident A.

---

### Entry: Migration runner stuck

> **Symptom:** `/admin/health/db` returns "migration applied but not recorded" or `npm run db:migrate` hangs.
> **Severity:** P1 (won't accept new traffic until resolved).
> **First-touch budget:** 30 minutes.

#### What it might be

1. **Partial migration.** A migration crashed before metadata commit. The runner sees the rows changed but no metadata row. See Incident B.
2. **Lock not released.** Advisory lock held by a dead session.
3. **pglite-vs-Postgres divergence.** Dev passed but prod fails on a vacuum-state difference.

#### Diagnostic commands

```bash
# Check migrations metadata
psql "$DATABASE_URL" -c "SELECT * FROM _migrations ORDER BY applied_at DESC LIMIT 5"

# Check for held advisory locks
psql "$DATABASE_URL" -c "SELECT pid, locktype, granted FROM pg_locks WHERE locktype = 'advisory'"

# Check the migration file the runner is on
ls src/storage/migrations/ | sort
```

#### Action

1. **If partial migration:** rehearse the failed migration in a temp DB ([`tests/integration/storage/migrationRehearsal.test.ts`](../../../tests/integration/storage/migrationRehearsal.test.ts) shows how). Identify the failing post-condition. Fix or back out by writing a compensating migration.
2. **If stale lock:** `SELECT pg_advisory_unlock_all()` from a fresh session, after confirming no live runner. **Confirm** — releasing during a live runner produces a partial migration.
3. **If pglite/Postgres divergence:** rerun the migration against a Postgres-shaped snapshot in rehearsal mode. Document the divergence in `tests/integration/storage/migrationRehearsal.test.ts`.

#### Lesson

"Works in dev" is unsafe when dev and prod can diverge silently. Test against a prod-shaped surface. (Incident B.)

---

### Entry: Audit chain signature mismatch

> **Symptom:** `/admin/health/audit` returns "verifier failed at entry K" or the offline verifier reports a chain break.
> **Severity:** P0. Treat as tampering until proven otherwise.
> **First-touch budget:** Acknowledge in 5 minutes; do not roll back unilaterally.

#### What it might be

1. **Tampering.** DB write that bypassed the application.
2. **Key rotation without registry update.** Operations signed with the new key but the registry still points to the old.
3. **Verifier bug.** The verifier itself is wrong (least likely).

#### Diagnostic commands

```bash
# Identify the failing entry
node scripts/audit-verify.mjs --output failing-entry.json  # M11; planned

# Check key registry git ref status
git -C "$AUDIT_KEY_REGISTRY_REPO" log --oneline -10

# Check active key id
psql "$DATABASE_URL" -c "SELECT key_id, COUNT(*) FROM auditEntries GROUP BY key_id"
```

#### Action

**Do NOT roll back.** Rolling back the chain is itself an audit event and destroys evidence.

1. Capture state: dump `auditEntries`, dump key registry git log, capture all logs. Time-stamp the capture.
2. If rotation-without-registry-update: register the new key in the registry; verifier should accept once registry is current.
3. If tampering suspected: file a security incident. Treat per [`../14-incidents/`](../14-incidents/) postmortem framework. Forensic review of operations during the suspected window.
4. Restore from a known-good audit chain only if directed by incident lead — see [`../10-dr-bcp/audit-chain-recovery.md`](../10-dr-bcp/audit-chain-recovery.md).

#### Lesson

The audit chain isn't just a log; it's evidence. Treat anomalies as evidence-disturbing events.

---

### Entry: Provider 401 spike

> **Symptom:** Atlassian or Bitbucket REST calls returning 401 in unusual numbers.
> **Severity:** P1.
> **First-touch budget:** 30 minutes.

#### What it might be

1. **Token expired.** API token revoked or rotated externally.
2. **OAuth refresh race.** PCO-59. Concurrent refreshes of a 3LO token.
3. **Master encryption key rotated** — sealed tokens can't decrypt.
4. **Account permissions changed.** Token still valid, but the account lost the necessary permission.

#### Diagnostic commands

```bash
# Check provider health
curl -s http://localhost:3001/admin/health/upstream | jq  # M11

# Tail provider client logs
tail -200 ./orchestrator.log | grep -E 'JiraClient|ConfluenceClient|BitbucketClient' | head -50

# Confirm current credential row
psql "$DATABASE_URL" -c "SELECT id, kind, subject, createdAt FROM encryptedTokens WHERE kind='atlassian_api_token' ORDER BY createdAt DESC LIMIT 3"
```

#### Action

1. If token expired: rotate at source (Atlassian/Bitbucket); seal the new token via mgmt REST; verify with a probe call.
2. If OAuth refresh race: fall back to `ATLASSIAN_AUTH_MODE=api_token` until PCO-59 lands (single-flight refresh).
3. If master-key rotation broke decryption: see [`../06-security/token-storage.md`](../06-security/token-storage.md) "Master-key rotation"; you may need to roll back the master key (see Incident C).
4. If permissions changed: the account was modified externally — coordinate with the Atlassian admin.

#### Lesson

Token and credential lifecycles are out-of-band. Operations may break with no code change. The runbook + rotation drill (Incident C) are the recovery.

---

### Entry: Atlassian rate-limit exhaustion (429)

> **Symptom:** Atlassian REST calls returning 429 at a rate that exhausts the retry budget. Queue depth grows.
> **Severity:** P1.
> **First-touch budget:** 30 minutes.

#### What it might be

1. **Discovery loop.** Capability discovery runs too aggressively; cache TTL too low.
2. **Workload spike.** Real load surge.
3. **Other tenant on the same Atlassian site eating the budget.** Shared site issue.

#### Diagnostic commands

```bash
# Inspect retry counters
curl -s http://localhost:3001/metrics | grep -E '(atlassian_retry|atlassian_429)'

# Check queue depth
curl -s http://localhost:3001/metrics | grep provision_queue_depth

# Recent 429 patterns
tail -500 ./orchestrator.log | grep '429' | head -20
```

#### Action

1. Pause the planner: stop accepting new provisioning jobs (M11 admin endpoint or DB flag).
2. Increase preflight cache TTL temporarily.
3. If discovery is the cause: investigate why; if a callsite is in a tight loop, fix.
4. If real load: capacity plan ([`../15-capacity/`](../15-capacity/)) is now relevant; consider scale-out timing.

#### Lesson

Upstream rate limits are a shared resource. Caching and backoff are first-line; capacity is second.

---

### Entry: Webhook 401 spike

> **Symptom:** Webhook deliveries returning 401 (signature invalid) at unusual rates.
> **Severity:** P1 (potential probe attack) or P2 (config drift).
> **First-touch budget:** 30 minutes.

#### What it might be

1. **Probe attack.** Attacker testing the webhook surface.
2. **Source rotated their secret.** Atlassian/Bitbucket changed the shared secret without the orchestrator being updated.
3. **Body modification by proxy.** Some proxies decode/re-encode bodies, breaking signatures.

#### Diagnostic commands

```bash
# Recent webhook events
psql "$DATABASE_URL" -c "SELECT source, count(*), max(receivedAt) FROM webhookDeliveries WHERE receivedAt > now() - interval '1 hour' GROUP BY source"

# Audit entries for signature failures
psql "$DATABASE_URL" -c "SELECT operation, count(*) FROM auditEntries WHERE operation = 'webhook.signature_invalid' AND ts > now() - interval '1 hour' GROUP BY operation"
```

#### Action

1. If probe pattern (no valid Authorization header, varying source IPs): consider rate-limiting at the network edge.
2. If source-rotation: re-seed the shared secret in `encryptedTokens` (kind = `webhook_shared_secret`).
3. If proxy issue: configure the proxy to pass raw bodies through; do not gzip/decode.

#### Lesson

Webhook signature failures are the canary for both attacks and config drift. The audit chain captures both.

---

## Common incidents (the historical record)

Three incidents are documented in detail because their lessons shape the rest of the runbook and the security model.

### Incident A — M0 stdout leak

**Timeline.** Shipped M0 with a `console.log` in `src/mcp/sessionCapabilities.ts`. First MCP client connection failed silently. Caught when M1 added the `lint:no-stdout` check.

**Root cause.** Protocol-level invariant (no stdout from `src/`) was respected by convention but not by tooling. M0 didn't have the lint check.

**Fix.** Removed the offending log; added [`scripts/lint-no-stdout.mjs`](../../../scripts/lint-no-stdout.mjs) as a pre-commit + CI check. Documented the rule in [`CLAUDE.md`](../../../CLAUDE.md).

**Prevention now.** Lint runs in CI; failure fails the build. PCO-12 documents an open gap (alias forms slip through).

**Lesson.** Invariants are tooling, not vibes.

---

### Incident B — Migration applied to wrong-shaped DB

**Timeline.** A new migration assumed an indexed column existed; in dev (pglite) the index was vacuumed-out, masking the assumption. Dev passed; prod failed.

**Root cause.** Hand-applied SQL migrations couldn't represent "run this against a snapshot first." The team ran the migration in dev, got green, and pushed.

**Fix.** Replaced raw SQL apply with a migration runner that supports rehearsal mode (PCO-13). Rehearsal applies migrations to a temp DB populated from a prod-shaped seed, then verifies invariants before signing off.

**Prevention now.** Rehearsal is mandatory in CI; `tests/integration/storage/migrationRehearsal.test.ts` guards against regressions.

**Lesson.** "Works in dev" is unsafe when dev and prod can diverge silently. Test against a prod-shaped surface.

---

### Incident C — Encryption key rotation broke token reads

**Timeline.** Master encryption key was rotated; existing token rows could no longer be decrypted.

**Root cause.** The token store assumed a single active master key. There's no automated migration path for re-encrypting existing rows.

**Fix.** Restored the previous key from secret storage; rotated only the "next" key. Documented as known limitation; PCO-57 tracks the long-term fix (envelope encryption with per-row data keys).

**Prevention now.** The runbook requires a re-encrypt drill before any master-key rotation. The drill is documented in [`../06-security/token-storage.md`](../06-security/token-storage.md).

**Lesson.** Crypto rotation is a system, not a key change. Plan the rotation procedure before issuing the key.

---

## Configuration

Required env vars per [`../09-deployment/secrets-provisioning.md`](../09-deployment/secrets-provisioning.md):

```text
ATLASSIAN_SITE_URL, ATLASSIAN_AUTH_MODE, ATLASSIAN_EMAIL, ATLASSIAN_API_TOKEN
BITBUCKET_WORKSPACE, BITBUCKET_APP_PASSWORD
DATABASE_URL
TOKEN_MASTER_KEY
AUDIT_KEYPAIR_PATH
MCP_HTTP_PORT, MGMT_API_PORT
LOG_LEVEL, LOG_FILE_PATH
```

Loader: `src/config/env.ts`.

## Linked artifacts

- **Demo mirror (reviewer audience):** [`docs/demo/runbook.md`](../../demo/runbook.md)
- **Code:** `src/config/env.ts`, `src/storage/migrationRunner.ts`, `src/security/policyDecisionLayer.ts`
- **Tests:** `tests/integration/mgmtApi.test.ts`, `tests/integration/storage/migrationRehearsal.test.ts`
- **Spec:** v6 §20, §22, §27 (observability + SLOs), §28 (milestones)
- **Sibling:** [`alerting.md`](alerting.md), [`slo-sli.md`](slo-sli.md), [`monitoring.md`](monitoring.md), [`on-call-playbook.md`](on-call-playbook.md), [`observability-stack.md`](observability-stack.md)
- **Tracking:** PCO-12, PCO-13, PCO-57, PCO-59

---

*Last reviewed: 2026-04-25 by Chris.*
