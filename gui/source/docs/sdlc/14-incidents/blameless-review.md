---
title: Blameless Review Process
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, operator, executive]
sdlc_category: 14-incidents
related: [docs/sdlc/14-incidents/postmortem-template.md, docs/sdlc/14-incidents/incident-library.md]
---

# Blameless Review Process

> **TL;DR:** Postmortems describe systems, decisions, and processes — never people. The framing isn't "Chris pushed a console.log"; it's "M0 had no automated stdout check; the convention slipped." Same root cause, different operating mode for the team. Blameless review surfaces systemic gaps; blameful review hides them.

A blameless culture isn't kindness — it's accuracy. Naming individuals as the cause of failures gets you the ones who made the mistake; naming the systemic gap gets you the prevention.

---

## Why blameless

### The accuracy argument

Almost every incident involves a person doing a thing. "Chris merged the bad change" is true. But it's not the cause:

- Why did the change pass review? → Review didn't have a checklist that would have caught it.
- Why did the test suite pass? → No test exercised this surface.
- Why was the convention "no stdout from src/" not enforced? → No tool checked.

Each layer points away from the individual and toward systemic gaps. The gaps are what's actionable.

### The retention argument

If postmortems blame people: people hide failures. The next incident gets worse because it gets covered up.

If postmortems blame systems: people surface failures. They become learning opportunities.

### The recurrence argument

A blameful conclusion ("Chris should be more careful") doesn't prevent the next person from making the same mistake. A systemic conclusion ("the lint check is now mandatory") does.

---

## What "blameless" looks like in practice

### In the postmortem document

Refer to:

- **Roles, not names** in failure narratives. "The reviewer didn't catch X" beats "Chris didn't catch X."
- **Systems** as the actor. "M0's CI pipeline lacked..." beats "Chris's PR lacked..."
- **Decisions** with their rationale. "The decision to defer the lint check until M1" — context for why it was reasonable at the time, not a judgment that it was wrong.

Names are appropriate in:

- The metadata (who's the postmortem owner).
- The diagnostic timeline (factual record of who did what during response).
- The ENFORCE actions (who owns the followup).

Names are NOT appropriate in:

- The root cause section.
- The lesson statement.
- The narrative explaining "what went wrong."

### In incident comms

Status updates avoid blame:

> Update: T+30m. Diagnosed as a stdout-corruption bug. Reverting now.

Not:

> Update: T+30m. Chris's recent PR introduced a console.log; reverting.

The distinction matters. Both convey the fix; one teaches the team to attribute, the other teaches the team to learn.

### In review meetings

When discussing past incidents:

- Ask: "What would have prevented this?" (system-focused).
- Don't ask: "Who let this through?" (person-focused).

If a meeting drifts toward blame, the facilitator (== the postmortem owner; for v1 single-maintainer, the same person) redirects.

---

## When blameless feels uncomfortable

### "But it really was a person's fault"

Sometimes it really was an individual decision. That's still a process question:

- What context was the person operating in?
- What information did they have / not have?
- What tooling could have caught it?

If the answer is "they had all the information and tooling and made a bad choice anyway" — that's an HR / management question, not a postmortem question. The postmortem focuses on the systemic learning regardless.

### "Won't this let people off the hook?"

No. Accountability comes from:

- Pattern recognition (recurring incidents from the same person/team).
- Performance management (separate from postmortems).
- Public commitment to ENFORCE actions.

The postmortem's job is preventing recurrence. Holding people accountable is a separate concern with separate processes.

### "Names are useful for context"

Yes — in metadata + the diagnostic timeline. The narrative ("what went wrong") is where blameless framing matters most.

---

## Anti-patterns to avoid

### "Pretend nothing happened"

Some teams interpret "blameless" as "don't talk about it." That's not blameless; that's avoidant.

Blameless means honest discussion with systemic framing. The discussion still happens — it just produces durable lessons instead of resentment.

### "Blame the previous team"

"The team before us made this decision" is just person-blame in disguise. Same problem; same fix: focus on what about the system / process / context produced the decision.

### "Document everything except who did it"

If the postmortem leaves out the diagnostic timeline because names appear in it: it loses the operational record. Names in metadata are fine; the abstraction happens in narrative.

### "Disagree with the framing in private"

If reviewers disagree with a postmortem's framing (e.g., they think the conclusion lets someone off too easy), the disagreement should be explicit + recorded, not muttered. Surfaces the real concern.

---

## Roles in the review

For a v1 single-maintainer setup:

- **Postmortem author:** the maintainer.
- **Postmortem reviewer:** also the maintainer (with self-review discipline).
- **Stakeholder feedback:** if any external stakeholders care, they get the postmortem to read.

For multi-team post-v1:

- **Author:** the on-call who handled the incident.
- **Reviewer:** a peer who wasn't on-call.
- **Approver:** engineering lead.
- **Distribution:** broader team for learning.

The blameless discipline applies regardless of team size.

---

## What gets reviewed

Not just postmortems:

- **Drill reports.** DR drills produce postmortem-shaped reports; same blameless framing.
- **Audit findings.** When new findings surface, the framing is "what gap allowed this?" not "who missed this?"
- **Near-misses.** A bug that was caught before deploy is still worth reviewing if the catch was lucky.

---

## Long-term outcomes

A team that does blameless review well:

- Has rich incident libraries that anyone can learn from.
- Has tooling that catches what humans missed (because the patterns are visible).
- Has people who report mistakes immediately rather than hiding them.
- Has institutional memory that survives turnover.

The compounding effect is significant. Years of blameless reviews produce teams that operate at a different level.

## Linked artifacts

- **Sibling:** [`postmortem-template.md`](postmortem-template.md), [`failure-mode-taxonomy.md`](failure-mode-taxonomy.md), [`fix-type-taxonomy.md`](fix-type-taxonomy.md), [`incident-library.md`](incident-library.md)
- **Operations:** [`../08-operations/on-call-playbook.md`](../08-operations/on-call-playbook.md)
- **Spec:** v6 §30.3 (postmortem framework — implicitly blameless via vibe-tuning F-099)

---

*Last reviewed: 2026-04-25 by Chris.*
