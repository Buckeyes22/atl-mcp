---
title: DR Test Schedule
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [operator]
sdlc_category: 10-dr-bcp
related: [docs/sdlc/10-dr-bcp/recovery-objectives.md, docs/sdlc/14-incidents/library/]
---

# Disaster Recovery Test Schedule

> **TL;DR:** Quarterly drills, one per scenario type. Each drill: stage the scenario, time the recovery, capture findings, file a postmortem-style report. A drill that fails (recovery not possible or RTO/RPO breached) is SEV-2 and triggers immediate remediation.

A backup strategy is only as good as the last successful restore. The drill cadence is what makes it real.

---

## Drill cadence

| Quarter | Drill | Scenario covered |
|---|---|---|
| Q1 | Postgres restore drill | Scenario 4 (DB loss / corruption) per [`failover.md`](failover.md) |
| Q2 | Audit chain verification drill | Scenario A (PITR-restored chain) per [`audit-chain-recovery.md`](audit-chain-recovery.md) |
| Q3 | Token store rotation drill | Master-key rotation per [`../06-security/token-storage.md`](../06-security/token-storage.md) Incident C |
| Q4 | Full host loss drill | Scenario 3 (host loss) per [`failover.md`](failover.md) |

Plus ad-hoc drills:

- **Pre-major-release drill** if the release introduces structural changes (new schema, new audit-chain shape).
- **Post-incident drill** to validate that the postmortem's ENFORCE actions actually work.

## Drill procedure

Each drill follows the same shape:

### 1. Plan

- Define the scenario specifically (which failure mode, which scope).
- Define the success criteria (RTO / RPO numbers).
- Pick a target environment (never production for non-trivial drills; staging or a DR-only environment).
- Schedule a window. Notify stakeholders.

### 2. Stage

- Set up the failure condition. Examples:
  - "Stop the Postgres instance" for DB loss.
  - "Delete the audit keypair file" for key loss.
  - "Terminate the VM" for host loss.

### 3. Detect

- Observe how the failure surfaces. Is it caught by alerting? Within the expected window?

### 4. Recover

- Follow the documented recovery procedure. Don't deviate. (Improvising during drills indicates the procedure is wrong.)

### 5. Time

- Record:
  - Time of failure injection.
  - Time of detection.
  - Time of recovery start.
  - Time of full recovery.

Compare against RTO / RPO targets ([`recovery-objectives.md`](recovery-objectives.md)).

### 6. Verify

- Confirm full state restored.
- Confirm audit chain integrity.
- Confirm no data corruption.

### 7. Report

- File a drill report in the incident-library style (CATCH → ENFORCE per [`../14-incidents/postmortem-template.md`](../14-incidents/postmortem-template.md)).
- Capture: what worked, what didn't, what's the gap.
- Track ENFORCE items as tickets (PCO-XX).

### 8. Tear down

- Restore the drill environment to a clean state.
- Confirm production is unaffected (if drill was on staging).

---

## Drill report shape

Drill reports use the same template as incident postmortems but with `incidentType: "DR-drill"` in the frontmatter. Stored in [`../14-incidents/library/`](../14-incidents/library/) alongside real incidents.

Distinguish drill from real because:

- Lessons from drills should be tagged differently (proactive vs. reactive).
- Drill failures aren't customer-impacting but ARE process-bugs.

## Pass / fail criteria per drill

| Drill | Pass criterion | Fail criterion |
|---|---|---|
| Postgres restore | RPO ≤ 5 min observed; restored DB queryable; audit chain validates | Restore fails; takes > 4 hr; data corruption observed |
| Audit chain verification | Verifier passes against restored chain; gap (if any) bounded to PITR window | Verifier fails; chain length anomalous; signature invalid |
| Token rotation | All tokens decryptable with new master key; rotation traceable in registry; old key safely disposed | Tokens unreadable; rotation event missing from audit chain |
| Host loss | Service restored on new host; RTO ≤ 4 hr; no data loss | Restore fails; data inconsistent with pre-failure state |

## What if a drill fails

A failed drill is a **SEV-2 incident** even though there's no customer impact:

- The recovery procedure is broken, OR
- The backup is broken, OR
- The infrastructure is missing.

ENFORCE actions: fix the gap; re-drill within 30 days to confirm.

If a drill fails twice in a row: escalate. Either the procedure is fundamentally wrong or the team's recovery competency is below the documented level.

## Audit trail of drills

Each drill writes:

- The drill setup (creating the failure condition).
- The recovery actions.
- The verification.

Each step is itself an audit entry — yes, the drill's internal operations are audited. This means drills produce real audit chain growth; they're not "free" from a chain-length perspective.

## Production drills

For v1: **don't drill in production.** The risk-reward isn't there for single-tenant single-maintainer.

Post-v1 multi-tenant: chaos engineering / production drills become more relevant. Plan when introducing multi-tenant per v6 §7.3.

## Linked artifacts

- **Sibling docs:** [`backup-strategy.md`](backup-strategy.md), [`recovery-objectives.md`](recovery-objectives.md), [`failover.md`](failover.md), [`audit-chain-recovery.md`](audit-chain-recovery.md)
- **Postmortem template:** [`../14-incidents/postmortem-template.md`](../14-incidents/postmortem-template.md)
- **Incident library:** [`../14-incidents/incident-library.md`](../14-incidents/incident-library.md)
- **Operations:** [`../08-operations/on-call-playbook.md`](../08-operations/on-call-playbook.md)

---

*Last reviewed: 2026-04-25 by Chris.*
