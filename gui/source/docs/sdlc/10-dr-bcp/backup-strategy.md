---
title: Backup Strategy
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [operator, engineer]
sdlc_category: 10-dr-bcp
related: [docs/sdlc/10-dr-bcp/recovery-objectives.md, docs/sdlc/10-dr-bcp/audit-chain-recovery.md]
---

# Backup Strategy

> **TL;DR:** Postgres point-in-time recovery (PITR) via the cloud platform's managed backup. Audit signing keys backed up via the secret manager (master + audit keypair). Audit chain entries are reconstructible from PITR + the chain integrity itself; the registry git ref is replicated to a secondary git host. Daily snapshots; PITR retains ≤ 7 days; long-retention quarterly snapshots for the audit chain only.

The backup strategy is conservative on purpose: the audit chain has critical integrity requirements; tokens are sensitive but recoverable; project profiles and blueprints are recreatable from the source intake.

---

## What gets backed up

| Asset | Backup method | Retention | RPO contribution |
|---|---|---|---|
| Postgres DB (all tables) | Cloud platform managed PITR | 7 days continuous + daily snapshots 30 days + quarterly long-term | ≤ 5 minutes (PITR window) |
| Audit signing keypair (private) | Secret manager versioning | Indefinite | Per secret-manager versioning |
| Audit signing key registry (public) | Git ref replicated to a secondary git host | Indefinite (git history) | Per git replication lag |
| TOKEN_MASTER_KEY | Secret manager versioning | Indefinite | Per secret-manager versioning |
| Source code | Git (canonical), GitHub mirror | Indefinite | Per push lag |
| Container images | Container registry retention policy | Latest 30 tags | Per push |
| Logs (forensic) | File rotation + archive to object storage (when M11) | 90 days hot, 1 year cold | Per archive cadence |
| Configuration (env values, deployment manifests) | Source-controlled where possible; secret manager otherwise | Indefinite | Per change |

Things that are NOT backed up:

- Pglite data (dev only; ephemeral).
- Test fixtures (recreatable from source).
- Audit-trace JSONL files (rebuildable from auditEntries).

## Where backups live

For staging / production:

- **Postgres backups** in the cloud provider's managed backup service (AWS RDS automated backups, GCP Cloud SQL automated backups, equivalents). Cross-region replication if available.
- **Secrets** in the secret manager's native versioning + cross-region replication.
- **Audit registry git ref** mirrored to a secondary git host (e.g., GitHub primary + Bitbucket Cloud secondary, or vice versa).

## What "backup" means for each

### Postgres

PITR via WAL archiving — recovery to any point within the retention window. Daily logical snapshots provide additional safety net for "I deleted the wrong rows" scenarios.

Verification: monthly restore drill against a non-prod target. The drill is documented in [`dr-test-schedule.md`](dr-test-schedule.md).

### Audit signing keys

Versioned in the secret manager. When rotation happens, the old version stays for the retention period (default 7 days for the master key, indefinite for the audit keypair — the audit keypair must be kept indefinitely so historical entries remain verifiable).

### Audit chain registry

The git ref is the source of truth for which public key was active when. Replication to a secondary git host means even if the primary is gone, the registry survives.

The replication procedure: a cron job (M11) runs `git fetch primary && git push secondary`. RPO depends on cron interval (recommended: every 15 min).

### Source code

Git's distributed nature handles this; mirror to GitHub (or equivalent) for visibility / archive.

### Container images

Registry retention policy: keep latest 30 tags. Beyond that, releases are reproducible from source if needed (re-build the image from the tag).

## Restore procedures

Detailed per-asset procedures in:

- Postgres: [`recovery-objectives.md`](recovery-objectives.md) and [`failover.md`](failover.md).
- Audit chain: [`audit-chain-recovery.md`](audit-chain-recovery.md).
- Tokens: rotate from source (Atlassian / Bitbucket); re-seal via mgmt REST.
- Master key: secret manager rollback to previous version + restart.

## Backup verification

The discipline: a backup is only as good as the last successful restore.

- **Postgres:** monthly restore drill. Restore to a non-prod target; run a sanity query; tear down.
- **Audit chain:** quarterly verifier-against-restored-chain drill. Pull the registry from the secondary; restore the auditEntries from PITR; run the offline verifier.
- **Secrets:** secret manager generally provides this automatically; confirm versioning is on for each secret.

Failed drills are SEV-2 incidents — the backup didn't work, which means the next real failure is much worse.

## What backups do NOT protect against

- **Application bugs that corrupt data subtly over time.** PITR recovers to a point; if the bug shipped weeks ago, recovery to before the bug means losing weeks of legitimate data.
- **Compromise of the secret manager.** If the secret manager is compromised, the backups of secrets are also compromised. Mitigation: separate trust boundary for the audit chain (registry git ref on a different host).
- **Deletion of all backups by an admin.** "Defense in depth" includes admin-action policies on the cloud provider — append-only retention, MFA-required deletion.

These limitations frame the DR strategy in [`failover.md`](failover.md).

## Costs

Backup storage costs scale with retention × rate-of-change. For a single-tenant v1, expect:

- Postgres backups: < 10 GB per month at the early stages, growing slowly.
- Logs in object storage: < 1 GB per month at v1 scale.
- Secret manager: negligible.
- Container registry: ~150 MB × 30 tags = ~5 GB.

Rough monthly backup cost: < $20 in cloud storage at v1 scale. Cost model in [`../16-cost/cost-model.md`](../16-cost/cost-model.md).

## Linked artifacts

- **Sibling docs:** [`recovery-objectives.md`](recovery-objectives.md), [`failover.md`](failover.md), [`audit-chain-recovery.md`](audit-chain-recovery.md), [`dr-test-schedule.md`](dr-test-schedule.md)
- **Code:** `src/storage/migrationRunner.ts` (rehearsal mode is a backup discipline)
- **Spec:** v6 §30.1 (audit chain durability)
- **Cost:** [`../16-cost/cost-model.md`](../16-cost/cost-model.md)

---

*Last reviewed: 2026-04-25 by Chris.*
