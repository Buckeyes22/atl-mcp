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

<figure>

<svg viewBox="0 0 1200 660" xmlns="http://www.w3.org/2000/svg" font-family="IBM Plex Sans, system-ui">
  <defs>
    <marker id="ar14" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#43434a"/>
    </marker>
  </defs>

  <text x="40" y="28" font-family="IBM Plex Mono" font-size="10.5" letter-spacing="1.4" fill="#9a9690">v1 · SINGLE-TENANT · COLD RESTORE · NO AUTOMATIC FAILOVER (HOT STANDBY = v2)</text>

  <!-- start -->
  <g transform="translate(490,52)">
    <rect width="220" height="56" rx="28" fill="#1a1a1c"/>
    <text x="110" y="34" text-anchor="middle" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#fff">incident detected</text>
  </g>

  <!-- decision: process up? -->
  <g transform="translate(490,150)">
    <polygon points="110,0 220,40 110,80 0,40" fill="#fbeed8" stroke="#b96b16"/>
    <text x="110" y="36" text-anchor="middle" font-family="IBM Plex Sans" font-size="12" font-weight="500" fill="#7a4408">does the container</text>
    <text x="110" y="52" text-anchor="middle" font-family="IBM Plex Sans" font-size="12" font-weight="500" fill="#7a4408">stay up after restart?</text>
  </g>
  <line x1="600" y1="108" x2="600" y2="150" stroke="#43434a" marker-end="url(#ar14)"/>

  <!-- yes -> scenario 1 -->
  <g transform="translate(80,160)">
    <rect width="280" height="120" rx="3" fill="#dceee5" stroke="#1f6e54"/>
    <text x="14" y="22" font-family="IBM Plex Mono" font-size="10" letter-spacing="1.2" fill="#0e3d2f">SCENARIO 1 · process crash</text>
    <text x="14" y="44" font-family="IBM Plex Sans" font-size="14" font-weight="600" fill="#0e3d2f">automatic recovery</text>
    <text x="14" y="64" font-family="IBM Plex Sans" font-size="11.5" fill="#0e3d2f">platform restart policy applies.</text>
    <text x="14" y="80" font-family="IBM Plex Sans" font-size="11.5" fill="#0e3d2f">passive observation; no action.</text>
    <text x="14" y="104" font-family="IBM Plex Mono" font-size="11" fill="#1f6e54">RTO &lt; 5 min</text>
  </g>
  <path d="M490,180 L360,210" stroke="#43434a" fill="none" marker-end="url(#ar14)"/>
  <text x="380" y="184" font-family="IBM Plex Mono" font-size="10.5" fill="#1f6e54">yes</text>

  <!-- no -> next decision: host alive? -->
  <g transform="translate(490,290)">
    <polygon points="110,0 220,40 110,80 0,40" fill="#fbeed8" stroke="#b96b16"/>
    <text x="110" y="36" text-anchor="middle" font-family="IBM Plex Sans" font-size="12" font-weight="500" fill="#7a4408">is the host (VM /</text>
    <text x="110" y="52" text-anchor="middle" font-family="IBM Plex Sans" font-size="12" font-weight="500" fill="#7a4408">k8s node) reachable?</text>
  </g>
  <line x1="600" y1="234" x2="600" y2="290" stroke="#43434a" marker-end="url(#ar14)"/>
  <text x="608" y="266" font-family="IBM Plex Mono" font-size="10.5" fill="#b8281d">no</text>

  <!-- yes -> scenario 2 -->
  <g transform="translate(80,300)">
    <rect width="280" height="120" rx="3" fill="#fbeed8" stroke="#b96b16"/>
    <text x="14" y="22" font-family="IBM Plex Mono" font-size="10" letter-spacing="1.2" fill="#7a4408">SCENARIO 2 · won't start</text>
    <text x="14" y="44" font-family="IBM Plex Sans" font-size="14" font-weight="600" fill="#7a4408">triage in runbook</text>
    <g font-family="IBM Plex Sans" font-size="11.5" fill="#7a4408">
      <text x="14" y="64">bad migration · missing env var ·</text>
      <text x="14" y="80">corrupted keypair · DB unreachable</text>
    </g>
    <text x="14" y="104" font-family="IBM Plex Mono" font-size="11" fill="#b96b16">RTO &lt; 30 min · forward-fix or rollback</text>
  </g>
  <path d="M490,330 L360,360" stroke="#43434a" fill="none" marker-end="url(#ar14)"/>
  <text x="380" y="324" font-family="IBM Plex Mono" font-size="10.5" fill="#1f6e54">yes</text>

  <!-- next decision: db ok? -->
  <g transform="translate(490,430)">
    <polygon points="110,0 220,40 110,80 0,40" fill="#fbeed8" stroke="#b96b16"/>
    <text x="110" y="36" text-anchor="middle" font-family="IBM Plex Sans" font-size="12" font-weight="500" fill="#7a4408">is Postgres healthy</text>
    <text x="110" y="52" text-anchor="middle" font-family="IBM Plex Sans" font-size="12" font-weight="500" fill="#7a4408">and uncorrupted?</text>
  </g>
  <line x1="600" y1="374" x2="600" y2="430" stroke="#43434a" marker-end="url(#ar14)"/>
  <text x="608" y="406" font-family="IBM Plex Mono" font-size="10.5" fill="#b8281d">no</text>

  <!-- yes -> scenario 3 -->
  <g transform="translate(840,300)">
    <rect width="280" height="160" rx="3" fill="#dde9f2" stroke="#1f5f8a"/>
    <text x="14" y="22" font-family="IBM Plex Mono" font-size="10" letter-spacing="1.2" fill="#11364f">SCENARIO 3 · host loss</text>
    <text x="14" y="44" font-family="IBM Plex Sans" font-size="14" font-weight="600" fill="#11364f">provision a new host</text>
    <g font-family="IBM Plex Sans" font-size="11.5" fill="#11364f">
      <text x="14" y="64">deploy same image @ same tag</text>
      <text x="14" y="80">re-mount existing audit keypair</text>
      <text x="14" y="96">— continues the chain.</text>
      <text x="14" y="120">verify /healthz · /readyz</text>
      <text x="14" y="136">re-point DNS / LB</text>
    </g>
    <text x="14" y="156" font-family="IBM Plex Mono" font-size="11" fill="#1f5f8a">RTO &lt; 4 hr</text>
  </g>
  <path d="M710,330 L840,360" stroke="#43434a" fill="none" marker-end="url(#ar14)"/>
  <text x="780" y="328" font-family="IBM Plex Mono" font-size="10.5" fill="#1f6e54">yes</text>

  <!-- yes -> healthy (left) -->
  <g transform="translate(80,440)">
    <rect width="280" height="100" rx="3" fill="#dceee5" stroke="#1f6e54"/>
    <text x="14" y="22" font-family="IBM Plex Mono" font-size="10" letter-spacing="1.2" fill="#0e3d2f">NOT A FAILOVER</text>
    <text x="14" y="44" font-family="IBM Plex Sans" font-size="14" font-weight="600" fill="#0e3d2f">app-level issue</text>
    <text x="14" y="66" font-family="IBM Plex Sans" font-size="11.5" fill="#0e3d2f">go to runbook §triage; alerting</text>
    <text x="14" y="84" font-family="IBM Plex Sans" font-size="11.5" fill="#0e3d2f">may already be telling you what.</text>
  </g>
  <path d="M490,470 L360,490" stroke="#43434a" fill="none" marker-end="url(#ar14)"/>
  <text x="380" y="464" font-family="IBM Plex Mono" font-size="10.5" fill="#1f6e54">yes</text>

  <!-- no -> scenario 4 -->
  <g transform="translate(840,490)">
    <rect width="280" height="160" rx="3" fill="#fbe7e4" stroke="#b8281d"/>
    <text x="14" y="22" font-family="IBM Plex Mono" font-size="10" letter-spacing="1.2" fill="#7a1d14">SCENARIO 4 · DB loss / corruption</text>
    <text x="14" y="44" font-family="IBM Plex Sans" font-size="14" font-weight="600" fill="#7a1d14">restore from PITR</text>
    <g font-family="IBM Plex Sans" font-size="11.5" fill="#7a1d14">
      <text x="14" y="64">page on-call · capture state</text>
      <text x="14" y="80">restore to last clean point</text>
      <text x="14" y="96">verify audit chain post-restore</text>
      <text x="14" y="112">— may surface gap; review.</text>
    </g>
    <text x="14" y="146" font-family="IBM Plex Mono" font-size="11" fill="#b8281d">RTO &lt; 4 hr · RPO ≤ 7 days</text>
  </g>
  <path d="M710,470 L840,520" stroke="#43434a" fill="none" marker-end="url(#ar14)"/>
  <text x="780" y="498" font-family="IBM Plex Mono" font-size="10.5" fill="#b8281d">no</text>
</svg>

<figcaption><strong>V14 — DR — what failed? decision tree.</strong> Four DR scenarios, mapped to one decision tree. The branches are deliberately ordered by recovery cost — Scenario 1 is automatic; 2 is fast triage; 3 is host re-provision (audit keypair re-mounted, chain unbroken); 4 is the only one that touches stored state. v1 has no automatic failover — that's a v2 change documented in v6 §7.3. (See <a href="../../visualizations/v14-dr-tree.html">full visualization page</a>.)</figcaption>
</figure>


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
