---
title: Postmortem Template (CATCH → ENFORCE)
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, operator]
sdlc_category: 14-incidents
related: [docs/sdlc/templates/postmortem-template.md, docs/partners/vibe-tuning.md]
---

# Postmortem Template

> **TL;DR:** Use the template at [`../templates/postmortem-template.md`](../templates/postmortem-template.md). Framework: CATCH → DIAGNOSE → ROOT CAUSE → FIX → SAVE → ENFORCE (vibe-tuning F-099, v6 §30.3). Blameless. Filed in [`incident-library.md`](incident-library.md). DR drills follow the same shape.

The postmortem is a process document, not a punishment. The goal: durable improvement over short-term blame.

This doc is the policy + framework. The fillable template is in `templates/`.

---

## When to write a postmortem

| Trigger | When |
|---|---|
| SEV-1 incident | Always; within 5 business days |
| SEV-2 incident | Always; within 10 business days |
| SEV-3 incident | If the same class recurs > twice; within 15 days |
| DR drill failure | Always |
| Near-miss with high blast radius | At operator discretion |

For v1 single-maintainer: same triggers; the postmortem is for future-you (and for operators who follow).

## Framework

### CATCH

How was it noticed? What was the time-to-detect?

- Trigger: alert / customer / engineer / drill / audit.
- Detection latency.
- Initial responder.

If detection was slow, the slow detection itself is a finding.

### DIAGNOSE

Timestamped log of what was tried + the outcomes. Include hypotheses tested AND ruled out.

This section becomes invaluable for the next responder facing similar symptoms.

### ROOT CAUSE

Both:

- **Proximate cause** — the immediate trigger.
- **Distal cause** — the system / process / decision that allowed it.

Stop at the layer you can act on. "People make mistakes" is true but not something you can fix.

### FIX

What stopped the bleeding. Distinct from prevention work.

### SAVE

Artifacts captured. Logs, dumps, screenshots, failing tests. Linked.

### ENFORCE

The durable changes. **Most important section.** Each item:

- What gets implemented (specific).
- Owner.
- Tracking ticket.
- Due date.
- Verification (how we know it's fixed).

Vague ENFORCE = postmortem theater.

## Blameless discipline

Names of *systems*, *decisions*, and *processes* are fair game. Names of people in failure narratives are not.

Anti-pattern:

> "Chris pushed a console.log to main and broke MCP clients."

Pro-pattern:

> "M0's code review didn't have a tooling check for stdout writes; the PR shipped with one. The discipline gap is the finding, not the individual change."

Same root cause, different framing. The blameless framing surfaces the systemic issue.

## Cross-references

Each postmortem links to:

- [`failure-mode-taxonomy.md`](failure-mode-taxonomy.md) — does this fit a known mode? If not, propose adding.
- [`fix-type-taxonomy.md`](fix-type-taxonomy.md) — does the fix type fit? If not, propose adding.
- The runbook entry that's updated as a result.
- The new tests that lock in prevention.

## Linked artifacts

- **Template:** [`../templates/postmortem-template.md`](../templates/postmortem-template.md)
- **Spec:** v6 §30.3 (postmortem framework)
- **F-099 (vibe-tuning source):** [`../../partners/vibe-tuning.md`](../../partners/vibe-tuning.md)
- **Sibling:** [`failure-mode-taxonomy.md`](failure-mode-taxonomy.md), [`fix-type-taxonomy.md`](fix-type-taxonomy.md), [`incident-library.md`](incident-library.md), [`blameless-review.md`](blameless-review.md)
- **Operational:** [`../08-operations/runbook.md`](../08-operations/runbook.md), [`../08-operations/on-call-playbook.md`](../08-operations/on-call-playbook.md)

---

*Last reviewed: 2026-04-25 by Chris.*
