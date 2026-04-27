---
title: ADR Template (MADR 4.0)
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, integrator]
sdlc_category: templates
related: [docs/adr/0000-adr-process.md, docs/partners/madr.md, docs/partners/adr-github-io.md]
---

# ADR-NNNN: [Short title in present-tense imperative]

> **TL;DR:** One-sentence summary of the decision and its primary justification. Reads as a standalone — a reader who reads only this line should understand what's being decided.

## Status

`proposed | accepted | deprecated | superseded by ADR-NNNN`

Date accepted: YYYY-MM-DD.

## Context

What's the situation that requires a decision? Include:

- The problem or forcing function (e.g., "we need persistent storage for audit entries").
- The constraints in play (e.g., "must work in pglite for dev and Postgres for prod; ADR-0001").
- The stakeholders or systems affected.
- Anything that shifted recently to make this a decision-now (e.g., "M1 milestone scoping").

Keep this section to ~3-5 paragraphs. If it's longer, the decision probably has nested decisions that should be split into separate ADRs.

## Decision drivers

The criteria the alternatives are evaluated against. Examples:

- **Operational simplicity** — does this introduce new infra to run/monitor?
- **Spec conformance** — does this satisfy v6 §X?
- **Cost** — runtime, build-time, cognitive.
- **Reversibility** — how hard to back out if wrong?
- **Test surface** — what tests does each option require?

3-7 drivers is the sweet spot.

## Considered options

List 2-5 options. For each:

### Option A: [Name]

- **Summary:** 1-2 sentences.
- **Pros:** bullet list against the drivers above.
- **Cons:** bullet list.
- **References:** prior art, partner-guide finding IDs (`F-XXX`), code paths.

### Option B: [Name]

…

### Option C: [Name]

…

## Decision outcome

> **Chosen option:** "Option X" because …

Two or three sentences explaining the call. Cite the decision drivers most directly. If the choice is contested, name the dissent and why it was overruled.

### Positive consequences

- What gets better. Be concrete.
- Reference v6 §X if this enables a downstream surface.

### Negative consequences

- What gets worse. Be specific.
- What ongoing cost the team is signing up for.
- What this forecloses.

### Open questions

- Things this ADR explicitly does not resolve. Often pointers to follow-up ADRs.

## Validation

How will we know if this was the right call? Examples:

- Specific test that must pass (path).
- Operational metric that must stay below a threshold.
- Audit finding that must remain absent.

If the validation criteria fail in the field, this ADR's status moves to `deprecated` and a successor ADR is filed.

## Linked artifacts

- v6 §X.Y
- Partner: `docs/partners/<slug>.md` (F-XXX)
- Code: `src/...`
- Tests: `tests/...`
- Prior ADRs: `docs/adr/NNNN-...md`
- Issue tracking: PCO-XX

---

## Notes for authors of new ADRs

- ADR numbers are sequential, no gaps.
- New ADRs are `proposed` until reviewed; flip to `accepted` on merge.
- Superseding doesn't delete — both ADRs stay; the old gets `superseded by ADR-NNNN` in its status field.
- Keep ADRs immutable post-acceptance except for status field changes. Corrections happen in successor ADRs.
- Length: 1-2 pages. If you can't say it in 2 pages, the decision isn't decomposed enough.
- Voice: present-tense imperative for the title ("Use ed25519 for audit signatures"), past or present for the body.

For the canonical process governing how ADRs are reviewed, accepted, and superseded, see [`docs/sdlc/12-governance/adr-process.md`](../12-governance/adr-process.md).
