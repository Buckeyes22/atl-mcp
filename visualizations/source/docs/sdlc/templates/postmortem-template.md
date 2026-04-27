---
title: Postmortem Template (CATCH → ENFORCE)
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, operator]
sdlc_category: templates
related: [docs/sdlc/14-incidents/postmortem-template.md, docs/partners/vibe-tuning.md]
---

# Postmortem: [YYYY-MM-DD] [short incident name]

> **TL;DR:** One sentence on what happened, one on impact, one on root cause. The exec summary.

Adapted from the CATCH → DIAGNOSE → ROOT CAUSE → FIX → SAVE → ENFORCE framework (vibe-tuning F-099, v6 §30.3). Postmortems are blameless: they describe systems and decisions, not people.

---

## Metadata

| Field | Value |
|---|---|
| Incident ID | INC-YYYY-NN |
| Date opened | YYYY-MM-DD HH:MM (timezone) |
| Date closed | YYYY-MM-DD HH:MM (timezone) |
| Severity | SEV-1 \| SEV-2 \| SEV-3 |
| Owner | Chris |
| Reviewers | <names> |
| Customer-impacting? | Yes / No |
| Data loss? | Yes / No / Pending |

---

## CATCH — How was it noticed?

How the incident first surfaced. This is the **detection** record, separate from when the issue actually started.

- **Trigger:** alert / customer report / engineer noticed / scheduled drill / audit finding.
- **First responder:** who acknowledged.
- **Time-to-detect:** elapsed from incident-start to first acknowledgement.

If detection was slow, that's itself a finding for the ENFORCE section.

## DIAGNOSE — Investigation timeline

A timestamped log of what was tried. Be specific. Include:

| Time (UTC) | Actor | Action | Outcome |
|---|---|---|---|
| HH:MM | <responder> | Ran `/admin/health` | 200 OK; rules out X |
| HH:MM | <responder> | Tailed `orchestrator.log` | Saw error pattern Y |
| HH:MM | <responder> | Hypothesized Z; tested by … | Confirmed/ruled out |
| HH:MM | <responder> | Applied fix attempt 1 | Did/did not resolve |

Include hypotheses that were tested and **rejected** — the path-not-taken is part of what future incidents learn from.

## ROOT CAUSE — Why did it happen?

The proximate cause and the distal cause. Both matter.

- **Proximate cause:** The immediate trigger ("`console.log` in `src/mcp/sessionCapabilities.ts` corrupted the JSON-RPC stream").
- **Distal cause:** The system / process / decision that allowed the proximate cause ("M0 didn't have lint:no-stdout, so the convention was unenforced").

If you can't articulate both, keep digging. Stop at the layer that's actionable — not "people make mistakes" (always true; not actionable).

## FIX — What stopped the bleeding?

The immediate remediation that resolved the incident. Distinct from the prevention work in ENFORCE.

- **Action taken.**
- **Time-to-mitigate:** elapsed from detection to symptom resolved.
- **Verification:** how we knew the fix worked.
- **Rollback considered?** Was rollback an option? Why or why not?

## SAVE — What artifacts captured?

What did we preserve from this incident for future use?

- Diagnostic state captured (logs, dumps, screenshots) — link to attachment storage.
- Failing test added (if applicable) — file path.
- Updated runbook entry — link.
- New ADR if a decision changed — link.
- New monitoring/alert added — what it alerts on.

If we didn't save anything, the incident's lesson is one re-occurrence away from being lost.

## ENFORCE — How do we prevent this class?

The durable changes. **This section is the one that matters most.** A postmortem with weak ENFORCE is a postmortem that won't prevent recurrence.

For each prevention item:

1. **What** specifically gets implemented (not "improve testing" — "add an integration test for the 429-then-success retry path").
2. **Owner** (single name).
3. **Tracking ticket** (PCO-XX).
4. **Due date.**
5. **How we'll verify it actually prevents recurrence** (not just "it's done" — "the next M0-style incident is now caught by lint:no-stdout").

Avoid vague items like "more code review" or "better testing." Vague items are how postmortems drift from artifacts to theater.

### Was the failure mode in our taxonomy?

Cross-reference [`docs/sdlc/14-incidents/failure-mode-taxonomy.md`](../14-incidents/failure-mode-taxonomy.md). If the failure mode is new, propose adding it.

### Was the fix type in our taxonomy?

Cross-reference [`docs/sdlc/14-incidents/fix-type-taxonomy.md`](../14-incidents/fix-type-taxonomy.md). If the fix type is new, propose adding it.

---

## Lessons

The one-paragraph durable summary. Read it aloud to someone who wasn't there. If they get the takeaway, this section is doing its job.

Example: "Protocol-level invariants must be encoded as automated checks before any production code that depends on them. The convention 'never write to stdout from src/' was insufficient because it was a convention. Tooling — `lint:no-stdout` enforced in CI — is what makes the rule reliable."

## Linked artifacts

- Runbook entry (if symptom is recurring): `docs/sdlc/08-operations/runbook.md` § <symptom>
- Failed test (if applicable): `tests/...`
- New ADR (if applicable): `docs/adr/NNNN-...md`
- Tracking tickets: PCO-XX, PCO-YY
- Related incidents: INC-YYYY-MM
- Spec sections affected: v6 §X.Y

---

## Style rules

- **Blameless.** Names of *systems*, *decisions*, and *processes* are fair game; names of people in failure narratives are not.
- **Timestamped.** Diagnostics are a timeline, not a story.
- **Hypotheses-first.** Document what was tested, including what was wrong. Saves the next responder hours.
- **ENFORCE is concrete.** No item that can't be tracked to a ticket with a due date.
- **Short.** Aim for 2-4 pages. Postmortems read by humans in a hurry, not artifact-warehouses.
