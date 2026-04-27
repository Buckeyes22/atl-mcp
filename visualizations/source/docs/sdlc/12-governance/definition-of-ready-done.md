---
title: Definition of Ready / Definition of Done
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer]
sdlc_category: 12-governance
related: [docs/sdlc/13-quality/iron-laws.md, AGENTS.md]
---

# Definition of Ready / Definition of Done

> **TL;DR:** A ticket is **Ready** when scope, acceptance criteria, and dependencies are clear. **Done** when behavior is shipped, tests pass, audit chain is intact, and docs reflect reality. Neither bar is negotiable. Use the checklists below.

The DoR / DoD discipline isn't bureaucratic — it's the boundary between work that lands cleanly and work that drags.

---

## Definition of Ready

A ticket is Ready when all of the following are true. If any item is missing: ticket stays in Backlog.

### General

- [ ] **Scope is bounded.** One concern; doable in a reasonable PR.
- [ ] **Acceptance criteria are explicit.** "Works correctly" doesn't count; specific assertions do.
- [ ] **Linked spec / ADR.** What v6 section, partner guide, or ADR drives this?
- [ ] **Linked component / module.** Where does the code go?
- [ ] **Dependencies named.** What other tickets / changes must land first?
- [ ] **Risk surfaced.** Anything risky (schema break, API change, security touch) called out.

### Adding behavior

- [ ] **Test plan named.** What test would prove this works? (Iron law: failing-test-first.)
- [ ] **Counter / span planned.** What observability does this add? (Per [`../08-operations/observability-stack.md`](../08-operations/observability-stack.md).)
- [ ] **Audit obligation named.** Does this state-change need an audit entry?

### Schema changes

- [ ] **Migration drafted.** SQL ready (or in this ticket's scope).
- [ ] **Rehearsal post-conditions named.** What invariants does the migration satisfy?
- [ ] **Reverse migration considered.** If breaking change: paired reverse documented.

### Security touch

- [ ] **Threat model implication assessed.** Does this add to or modify the threat surface?
- [ ] **Classification reviewed.** Does this touch PRIVATE / SECRET data?
- [ ] **Audit chain implication assessed.** Does this change what gets audited?

If a ticket can't satisfy DoR after a reasonable attempt: it's the wrong scope. Decompose.

---

## Definition of Done

A ticket is Done when all of the following are true. No exceptions.

### General

- [ ] **Acceptance criteria pass.** Every one of them.
- [ ] **Tests written first** (per iron law). Failing-without / passing-with.
- [ ] **CI gates green.** Cumulative gates per [`../09-deployment/ci-cd.md`](../09-deployment/ci-cd.md).
- [ ] **Code review complete.** Two-stage per [`code-review.md`](code-review.md).
- [ ] **PR merged.** No "almost done" tickets.

### Documentation

- [ ] **Doc updated where reality changed.** Spec, ADR, runbook, threat model — whichever applies.
- [ ] **No broken cross-links** introduced.
- [ ] **Frontmatter `last_reviewed` bumped** on touched SDLC docs.

### Observability

- [ ] **Counters increment** at expected call sites.
- [ ] **Audit entry written** for any state change.
- [ ] **Log lines** at appropriate levels.

### Schema

- [ ] **Migration applied** in dev + staging.
- [ ] **Rehearsal passed** in CI.
- [ ] **Schema doc** ([`../05-data/schema.md`](../05-data/schema.md)) reflects the change.

### Security touch

- [ ] **Threat model updated** if the surface changed.
- [ ] **Controls matrix updated** if a control is added / changed.
- [ ] **Security test added** if a new threat is in scope.
- [ ] **Audit chain entry shape verified** for state changes.

### Operational readiness

- [ ] **Runbook updated** if a new alert / symptom can fire.
- [ ] **Alert added** if a new metric needs alerting.
- [ ] **SLO impact assessed** if latency / availability changes.

A ticket that can't satisfy DoD after the implementation: incomplete. Don't close it.

---

## Why these checklists

### Why DoR is rigorous

Vague tickets produce drift. A ticket without explicit acceptance criteria invites "we built it but you wanted X" surprises. The discipline pushes ambiguity upstream where it's cheaper.

### Why DoD covers documentation + ops

Code that ships without doc + ops updates is half-shipped. The next on-call rotation pays for it. Bundling them into the close criteria makes them part of the work, not afterthoughts.

### Why no "exceptions"

Exceptions to DoD become the new normal. v1 single-maintainer: the discipline keeps the docs honest. Post-v1 team: the discipline scales without arguments per ticket.

---

## Practical workflow

For a typical feature ticket:

1. **Author drafts** ticket: scope, criteria, dependencies.
2. **Author reviews** against DoR; revises until ready.
3. **Move to Ready** column.
4. **Pick up; implement** following test-first.
5. **PR open** → review → CI green → merge.
6. **Author reviews** PR + ticket against DoD.
7. **Mark Done.**

The cadence: tickets pass DoR before pickup, pass DoD before close. No "we'll come back to update the docs."

## Linked artifacts

- **Iron laws:** [`../13-quality/iron-laws.md`](../13-quality/iron-laws.md)
- **Code review:** [`code-review.md`](code-review.md)
- **CI gates:** [`../09-deployment/ci-cd.md`](../09-deployment/ci-cd.md)
- **Observability:** [`../08-operations/observability-stack.md`](../08-operations/observability-stack.md)
- **AGENTS.md** ("PR instructions"): [`../../../AGENTS.md`](../../../AGENTS.md)
- **CLAUDE.md** (operating rules): [`../../../CLAUDE.md`](../../../CLAUDE.md)

---

*Last reviewed: 2026-04-25 by Chris.*
