---
title: Failover
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [operator]
sdlc_category: 10-dr-bcp
related: [docs/sdlc/10-dr-bcp/recovery-objectives.md, docs/sdlc/10-dr-bcp/backup-strategy.md, agent-context-orchestrator-mcp-plan-v6.md §7.3]
---

# Failover

> **TL;DR:** v1 single-tenant: cold restore from backup, no automatic failover. Steps: provision a new host, restore Postgres from PITR, mount the audit keypair (from secret manager), start the container at the same tag, verify health. Multi-tenant v2 will support hot standby; runway in v6 §7.3.

The strategy is intentionally conservative: failover automation introduces complexity that's not warranted for single-tenant v1. The procedure here is manual but rehearsed.

---

## Failover scenarios

### Scenario 1: Application process crash

**Definition:** the atl-mcp container exits unexpectedly.

**Detection:** liveness probe fails; deploy platform restarts.

**Recovery:** automatic. Deploy platform's restart policy applies.

**Operator action:** none (passive observation). If the restart loop fails, escalate to Scenario 2.

**RTO:** < 5 min (deploy platform's restart cadence).

### Scenario 2: Application process won't start

**Definition:** restart loop fails. Crashes immediately on start.

**Detection:** alerting on `service_down`.

**Recovery:** triage in [`../08-operations/runbook.md`](../08-operations/runbook.md). Common causes:

- Bad migration (rollback or fix).
- Missing required env var (provisioning gap).
- Corrupted audit keypair file (re-mount from secret).
- DB unreachable (cascade to Scenario 4).

**Operator action:** identify root cause; choose between forward-fix and rollback per [`../09-deployment/release-process.md`](../09-deployment/release-process.md).

**RTO:** < 30 min (triage + fix or rollback).

### Scenario 3: Host loss (the machine running the container is gone)

**Definition:** the host (VM / k8s node) is gone — terminated, lost, network-isolated.

**Detection:** alerting; cloud platform's instance health checks.

**Recovery:** provision a new host; deploy the same image at the same tag; mount the same secrets / configs.

**Operator action:**

```bash
# 1. Confirm host is actually lost (not network blip)
# Cloud-platform-specific: check instance status

# 2. Provision new host (cloud-platform-specific)
# - For Docker Compose deployment: spin up a new VM, install Docker, pull the image
# - For k8s: the controller usually handles this automatically when the node is removed

# 3. Mount/inject secrets and config (per secrets-provisioning.md)

# 4. Start the container
docker run -d \
  --env-file /etc/atl-mcp/env \
  -v /etc/atl-mcp/audit-keys:/data/audit-keys:ro \
  -v /var/log/atl-mcp:/data/logs \
  -p 3000:3000 -p 127.0.0.1:3001:3001 \
  atl-mcp:vX.Y.Z

# 5. Verify
curl http://<new-host>:3001/healthz
curl http://<new-host>:3001/readyz
curl http://<new-host>:3001/admin/health/audit  # M11
```

**Notes:**

- The new host doesn't need a new audit signing keypair. Re-using the existing one is correct (continues the chain).
- DNS / load balancer may need to point at the new host; depends on deployment topology.

**RTO:** < 4 hours.

### Scenario 4: DB loss / corruption

**Definition:** Postgres is gone or returns corrupted data.

**Detection:** `/admin/health/db` returns errors; queries fail.

**Recovery:** restore from PITR.

**Operator action:**

```bash
# 1. Determine the last known-good time
# Check audit chain integrity at recent timestamps
# Identify a target restore time

# 2. Provision new Postgres (or restore in place if the cloud platform supports it)
# Cloud-platform-specific:
# - AWS RDS: aws rds restore-db-instance-to-point-in-time
# - GCP Cloud SQL: gcloud sql instances clone --point-in-time=<ts>

# 3. Confirm the restored DB has expected schema
psql "$NEW_DATABASE_URL" -c "SELECT * FROM _migrations ORDER BY applied_at DESC LIMIT 5"

# 4. Run audit chain verification end-to-end
node scripts/audit-verify.mjs --against-restored

# 5. Update DATABASE_URL in app config; restart application

# 6. Verify
curl /healthz; curl /readyz; curl /admin/health/audit
```

**Notes:**

- If audit chain verification fails on the restored DB: the restore time was too recent (after corruption); pick an earlier time.
- Restored DB will lack any audit entries between the restore time and now; treat the gap as a security event (entries that were emitted in the interim are lost from the chain). [`audit-chain-recovery.md`](audit-chain-recovery.md) details the procedure for this.

**RTO:** < 4 hours.

### Scenario 5: Secret store loss

**Definition:** the secret manager is unreachable or returns errors.

**Detection:** application can't read `TOKEN_MASTER_KEY`, `DATABASE_URL`, audit keypair location, etc.

**Recovery:** depends on what's lost.

- Secret manager outage (transient): wait for recovery; the app retries on startup.
- Specific secret deleted: rotate the secret from source (re-derive `TOKEN_MASTER_KEY`, re-issue Atlassian token, etc.). For TOKEN_MASTER_KEY rotation: see [`../06-security/token-storage.md`](../06-security/token-storage.md).
- Entire secret manager lost (worst case): bootstrap the secret manager from cold storage / break-glass procedures (cloud-provider-specific).

**Operator action:** triage by what specifically is lost. Most cases are platform-side outages, not data loss.

**RTO:** transient: per cloud SLA. Data loss: hours-to-days.

### Scenario 6: Audit signing key loss

**Definition:** the audit keypair file or secret is gone.

**Detection:** application fails to start (key not found).

**Recovery:** the historical chain stays verifiable as long as the public-half is in the registry git ref. The private-half going missing means we can't sign new entries with the same key — rotate.

**Operator action:**

1. Confirm the public-half is intact in the registry git ref.
2. Rotate to a new keypair per [`../06-security/audit-chain-threat-model.md`](../06-security/audit-chain-threat-model.md) "Key rotation procedure."
3. Document the rotation (trigger, timing, action) in audit-chain entries (signed with the new key).

**RTO:** < 4 hours including the rotation procedure.

---

## What v1 does NOT support

- **Hot standby.** No always-on second instance.
- **Automatic failover orchestration.** No leader election, no quorum.
- **Cross-region active-active.** Out of scope until multi-tenant.
- **Sub-minute failover.** Not technically achievable with the current backup model.

These are post-v1 features. v6 §7.3 documents the multi-tenant runway; failover automation lands when multi-tenant does.

## Failover testing

DR drills exercise these scenarios — see [`dr-test-schedule.md`](dr-test-schedule.md). Each drill is logged; failed drills are SEV-2.

## Linked artifacts

- **Sibling docs:** [`backup-strategy.md`](backup-strategy.md), [`recovery-objectives.md`](recovery-objectives.md), [`audit-chain-recovery.md`](audit-chain-recovery.md), [`dr-test-schedule.md`](dr-test-schedule.md)
- **Operations:** [`../08-operations/runbook.md`](../08-operations/runbook.md), [`../08-operations/on-call-playbook.md`](../08-operations/on-call-playbook.md)
- **Deployment:** [`../09-deployment/release-process.md`](../09-deployment/release-process.md)
- **Security:** [`../06-security/audit-chain-threat-model.md`](../06-security/audit-chain-threat-model.md), [`../06-security/token-storage.md`](../06-security/token-storage.md)
- **Spec:** v6 §7.3 (multi-tenant runway)

---

*Last reviewed: 2026-04-25 by Chris.*
