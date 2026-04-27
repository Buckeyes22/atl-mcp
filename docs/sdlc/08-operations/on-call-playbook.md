---
title: On-Call Playbook
owner: Chris
status: accepted (single-maintainer v1)
last_reviewed: 2026-04-25
version: 1.0.0
audience: [operator]
sdlc_category: 08-operations
related: [docs/sdlc/08-operations/runbook.md, docs/sdlc/08-operations/alerting.md, docs/sdlc/14-incidents/]
---

# On-Call Playbook

> **TL;DR:** Single maintainer in v1 — "rotation" is one name. The discipline matters anyway: when an alert fires, follow the script. Acknowledge, triage, mitigate, communicate, postmortem. This doc is intentionally short for v1; expand when there's a real rotation.

The playbook is operational discipline, not novel engineering. The runbook ([`runbook.md`](runbook.md)) covers symptoms; this doc covers the human process around them.

---

## Rotation

| Role | Person | Schedule | Contact |
|---|---|---|---|
| Primary on-call | Chris | 24/7 (single maintainer) | ctanferno22@gmail.com |
| Secondary | n/a | n/a | n/a |
| Escalation | n/a (project owner == primary) | n/a | n/a |

When v2 lands and there's a real team, expand: weekly rotation, named secondary, named escalation, contact methods per priority.

## When an alert fires

### Step 1: Acknowledge (≤ 5 min for P0, ≤ 30 min for P1)

Acknowledge the alert in whatever system fires it. The act of acknowledging:

- Tells the alerting system you're working on it (silences re-pages).
- Time-stamps the start of response (used for MTTA — mean time to acknowledge).

### Step 2: Triage

Open the runbook entry the alert points to ([`runbook.md`](runbook.md)). Run the diagnostic commands. Form a hypothesis.

If the alert doesn't have a runbook entry — that's a finding. Add one after the incident.

### Step 3: Mitigate

Apply the runbook's action steps. Goal at this stage: **restore service**, even if root cause is unclear.

If the action steps don't work or the situation is novel: escalate. In v1, escalating means "post in `#incidents` and / or text Chris." In v2+ with a real team, follow the escalation matrix.

### Step 4: Communicate

For any incident lasting > 15 min OR P0 of any duration:

- Post the incident state in `#incidents` (or whatever channel the org uses).
- Update every 30 min while the incident is active. State updates: what's happening, what you've tried, what's next, ETA if known.
- Notify external stakeholders (customers, sponsor) per severity.

For v1 single-maintainer: the audit log + the incident timeline doc are the comms record.

### Step 5: Stabilize

Mark the alert resolved when:

- The metric is back below threshold AND
- You've confirmed via a different signal (logs, manual check) that the system is actually healthy AND
- You've documented enough state to write a postmortem.

### Step 6: Postmortem

Within 5 business days for P0, 10 for P1, 15 for P2.

Use the postmortem template ([`../templates/postmortem-template.md`](../templates/postmortem-template.md)). File in [`../14-incidents/library/`](../14-incidents/library/) (when that directory has incidents).

Key sections:

- **CATCH** — how was it detected, time to detect.
- **DIAGNOSE** — timestamped log of investigation.
- **ROOT CAUSE** — proximate + distal.
- **FIX** — what stopped the bleeding.
- **SAVE** — artifacts captured (logs, dumps, runbook updates).
- **ENFORCE** — durable changes; tickets filed; owner; due dates.

The framework is from vibe-tuning F-099 (`docs/partners/vibe-tuning.md`); adopted in v6 §30.3.

---

## Severity escalation rubric

When you're not sure if it's P0 or P1, here's the test:

- **P0** if any of: customer-impacting, security incident, data loss, audit chain integrity in question, > 30% of clients affected.
- **P1** if any of: SLO at risk, single feature broken for some clients, recoverable within hours.
- **P2** if any of: trending toward an SLO miss, single non-critical feature degraded, tracked but not urgent.

When in doubt between P0 and P1: P0. Easier to step down than to retroactively step up.

## Communication templates

### Initial alert post (P0)

```
🚨 P0 — [short title]

Detected: HH:MM UTC
Symptom: <what users are seeing>
Impact: <who/what is affected>
On-call: Chris (acknowledged HH:MM UTC)
Status: Triaging
Next update: HH:MM UTC
```

### Status update

```
Update: [short title]
HH:MM UTC

What's known: <findings>
What's been tried: <actions>
Next step: <plan>
ETA: <best estimate or "unknown">
Next update: HH:MM UTC
```

### Resolved

```
✅ Resolved — [short title]
Resolved: HH:MM UTC

Root cause: <one paragraph>
Fix: <what was done>
Postmortem: <link, due by DD>
```

## What NOT to do during an incident

- **Don't** make speculative fixes without verifying the hypothesis. Each speculative change adds confounding variables.
- **Don't** skip captures. "Restart and see if it fixes it" loses evidence.
- **Don't** roll back the audit chain. See [`runbook.md` § "Audit chain signature mismatch"](runbook.md#entry-audit-chain-signature-mismatch).
- **Don't** forget to communicate. A 30-min silent fix is worse than a 60-min fix with three updates.

## Tools / access required

For an effective on-call response, the responder needs:

- Access to `./orchestrator.log` (file system / SSH).
- Access to the Postgres DB (read at minimum).
- Access to the deploy platform (Docker / k8s) for restart / config inspection.
- Access to the Atlassian / Bitbucket admin console (rotating tokens, checking webhooks).
- Access to the key registry git repo.
- Permissions to run the offline audit verifier.

In v1 with single maintainer: all on Chris's local machine + Atlassian admin account.

## Linked artifacts

- **Sibling docs:** [`runbook.md`](runbook.md), [`alerting.md`](alerting.md), [`monitoring.md`](monitoring.md), [`slo-sli.md`](slo-sli.md), [`observability-stack.md`](observability-stack.md)
- **Postmortem template:** [`../templates/postmortem-template.md`](../templates/postmortem-template.md)
- **Incident library:** [`../14-incidents/incident-library.md`](../14-incidents/incident-library.md)
- **Spec:** v6 §27.6 (SLOs), §30.3 (postmortem framework)

---

*Last reviewed: 2026-04-25 by Chris.*
