---
title: Recovery Objectives (RTO / RPO)
owner: Chris
status: accepted (aspirational for v1)
last_reviewed: 2026-04-25
version: 1.0.0
audience: [operator, executive, auditor]
sdlc_category: 10-dr-bcp
related: [docs/sdlc/10-dr-bcp/backup-strategy.md, docs/sdlc/08-operations/slo-sli.md]
---

# Recovery Time / Recovery Point Objectives

> **TL;DR:** RTO 4 hours, RPO 5 minutes for v1 single-tenant. RTO is dominated by manual cold-restore steps. RPO is bounded by Postgres PITR. Audit chain has a stricter informal target: 0 lost entries (because lost entries are a security incident, not just data loss).

These are aspirational v1 numbers. Once there's operational history (real incidents, real restore drills), they get tightened or honestly relaxed based on data.

---

## RTO targets

| Scenario | RTO target | Why |
|---|---|---|
| Single-process crash | < 5 min | Restart by deploy platform; health check confirms |
| Image-tag rollback | < 30 min | Re-deploy procedure per [`../09-deployment/release-process.md`](../09-deployment/release-process.md) |
| Data-corruption recovery (PITR) | < 4 hours | Restore from PITR; replay any audit-relevant entries; smoke-test |
| Full host loss | < 4 hours | Same as data-corruption + provision new host |
| Audit chain integrity event | best-effort | Treat as security incident, not standard recovery |

The 4-hour target is aspirational. v1 hasn't tested it; the [`dr-test-schedule.md`](dr-test-schedule.md) drills will produce real measurements.

## RPO targets

| Asset | RPO target | Backed by |
|---|---|---|
| Postgres data | ≤ 5 minutes | PITR window; WAL archive |
| Audit chain | 0 (target) | Same Postgres PITR; chain integrity ensures detection of any loss |
| Secrets | n/a (versioned indefinitely) | Secret manager |
| Audit signing keys | n/a (indefinite retention) | Secret manager + git replication |
| Configuration | n/a (source-controlled) | Git |

The 0-RPO target on the audit chain is informal — the actual mechanism is PITR-bounded (≤5 min), but a lost entry is treated as a security incident regardless of "objective."

## Why these numbers (and not better)

### Why not RTO < 1 hour?

For v1 single-tenant:

- The cost of always-on hot-standby is significant.
- Single-maintainer responses dominate the recovery time (acknowledge + diagnose + decide), not the technology.
- Customer impact tolerates 4 hours given the use case (project provisioning isn't real-time critical).

Multi-tenant v2 will tighten this — the customer impact distribution changes.

### Why not RPO < 5 minutes?

PITR is the cheapest mechanism with the broadest tooling support. Sub-5-minute RPO requires synchronous replication, which doubles cost and adds latency to writes.

Audit chain entries: the chain construction is synchronous (write blocks until chain entry persists), so loss requires losing the WAL itself. PITR captures WAL.

### Why not "no downtime"?

No downtime requires multi-replica with rolling deploys. Single-tenant v1 has one replica by design. Multi-replica is the post-v1 multi-tenant runway (v6 §7.3).

## Components by recovery class

### Tier A — Cannot lose

- Audit chain entries.
- Audit signing keypair history.

Loss here is a SEV-1 security incident. Recovery procedure: [`audit-chain-recovery.md`](audit-chain-recovery.md).

### Tier B — Recoverable with some impact

- Project profiles + blueprints (DB rows).
- Encrypted token rows (rotateable from source if lost).
- Provisioning job state (queue rows).

Loss here means re-running operations. Recovery from PITR is the normal path.

### Tier C — Acceptable to lose

- Logs older than 90 days (rotated out anyway).
- Pglite dev data (recreatable).
- Test fixtures (in source).

## Measurement

Measured during DR drills (see [`dr-test-schedule.md`](dr-test-schedule.md)):

- **Time to acknowledge** (operator notices + acknowledges).
- **Time to triage** (root cause hypothesized).
- **Time to recover** (service restored).
- **Data loss observed** (compared against backup timestamp).

Drill reports are filed in [`../14-incidents/library/`](../14-incidents/library/) (when populated).

## What if we miss the target?

- **One miss:** investigate; record the miss; identify the gap.
- **Three misses in 12 months:** the target is wrong or the design is wrong. Revisit.
- **Customer-impacting miss:** SEV-2 incident; postmortem with ENFORCE actions.

## Linked artifacts

- **Sibling docs:** [`backup-strategy.md`](backup-strategy.md), [`failover.md`](failover.md), [`audit-chain-recovery.md`](audit-chain-recovery.md), [`dr-test-schedule.md`](dr-test-schedule.md)
- **SLOs (different concept; service-time):** [`../08-operations/slo-sli.md`](../08-operations/slo-sli.md)
- **Postmortem framework:** [`../14-incidents/postmortem-template.md`](../14-incidents/postmortem-template.md)

---

*Last reviewed: 2026-04-25 by Chris.*
