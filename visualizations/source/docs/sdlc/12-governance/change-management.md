---
title: Change Management
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer]
sdlc_category: 12-governance
related: [docs/sdlc/12-governance/adr-process.md, docs/sdlc/12-governance/code-review.md, docs/sdlc/09-deployment/release-process.md]
---

# Change Management

> **TL;DR:** Spec changes → ADR → impl → audit. Code changes → PR → review → CI green → merge → release. Doc changes → PR → review → merge. The shared backbone: every change is reviewed; every release is a tag; every deploy is a known artifact.

Change management is the connective tissue between governance, code review, and release. This doc shows how the pieces fit.

---

## Change classes

| Class | Examples | Process |
|---|---|---|
| Spec change | New v6 section; modified existing section | ADR if material; spec edit + PR |
| Code change (feature) | New tool; new module | Test-first; PR + review; CI green; merge |
| Code change (fix) | Bug fix | Test-first; same path |
| Code change (refactor) | Internal restructure | Existing tests stay green |
| Doc change (SDLC) | This tree | PR + review (lighter than code); merge |
| Doc change (ADR) | New ADR | Per [`adr-process.md`](adr-process.md) |
| Dependency change | Add / remove / upgrade | PR with `npm audit` clean |
| Schema change | Migration | ADR if breaking; rehearsal mandatory; PR |
| Config change | env var, feature flag | PR; ADR if breaking |

## Spec change flow

The v6 spec is the source of truth. Changes:

1. Identify what's changing + why.
2. If material: write an ADR documenting the rationale.
3. Edit the v6 spec section.
4. Update any partner-guide cross-references that touched the section.
5. PR with the spec edit + ADR + downstream cross-references.
6. Review.
7. Merge.

The discipline: spec changes are visible. No silent edits.

## Code change flow

```mermaid
graph LR
    Idea[Idea / requirement] --> Test[Write failing test]
    Test --> Impl[Implement]
    Impl --> Local[Local CI green]
    Local --> PR[Open PR]
    PR --> Review[Two-stage review]
    Review --> CI[CI gates green]
    CI --> Merge[Merge to main]
    Merge --> Release[Tag → release]
    Release --> Deploy[Deploy]
```

Each step has explicit gates. The iron law (test-first per [`../13-quality/iron-laws.md`](../13-quality/iron-laws.md)) gates step 2 → 3.

## Two-stage review

Per [`../13-quality/code-style.md`](../13-quality/code-style.md) + F-107:

1. **Spec-conformance review.** Does this match the spec / ADR / partner guide?
2. **Code-quality review.** Does this meet code-style + idiomatic + maintainable?

Reviewers may overlap or be different people. The two stages are distinct passes.

## Doc change flow

Lighter than code:

1. Edit.
2. PR.
3. Review (one pass; spec-conformance to make sure no contradictions).
4. Merge.

Doc changes don't require test-first. They DO require cross-link integrity (no broken links).

## Dependency upgrades

```bash
# 1. Identify candidates
npm outdated

# 2. Upgrade in a branch
npm install <pkg>@<version>

# 3. Run audit
npm audit

# 4. Run full CI
npm run typecheck && npm test && npm run lint:no-stdout && npm run lint

# 5. PR
```

Dependencies with security advisories upgrade ASAP. Other dependencies upgrade per quarterly review.

Major-version upgrades (e.g., a library v1 → v2): treat as a feature; full review + test coverage.

## Schema changes

Per [`../05-data/migrations.md`](../05-data/migrations.md):

1. Write the migration SQL.
2. Write post-condition assertions.
3. Run rehearsal locally.
4. PR with migration + (if breaking) ADR.
5. CI runs rehearsal again.
6. Merge.
7. Release process applies migration in deploys.

**Schema changes that drop columns or break compatibility require an ADR.**

## Config changes

| Type | Process |
|---|---|
| New env var | PR; document in [`secrets-provisioning.md`](../09-deployment/secrets-provisioning.md) |
| Removed env var | PR; document removal in change log |
| Default value change | PR; ADR if behavior-changing |
| Feature flag flip in CI | PR |
| Production feature flag flip | Manual; document in [`decision-log.md`](decision-log.md) |

## Out-of-band changes

Sometimes changes happen outside the normal flow:

- **Hotfix in production.** Acceptable for SEV-1; PR backfill required within 1 day.
- **Manual schema fix.** Strongly discouraged; document as an incident if it happens.
- **Direct production secret rotation.** Operational; documented in audit chain.

Out-of-band changes are visible because the audit chain catches them. The discipline: prefer normal flow; out-of-band requires postmortem.

## Reverse / undo

| Change type | Reversal |
|---|---|
| Code | git revert + new PR |
| Schema | Reverse migration if available; restore from PITR otherwise |
| ADR | New ADR with `Supersedes` |
| Config | Restore prior value |

Reversal is itself a change — same flow, same review.

## Quarterly review

Every quarter:

- Walk recent decisions; flag any that aged poorly.
- Review the audit findings backlog.
- Update SDLC docs that have drifted.
- Confirm the ADR + decision-log alignment.

For v1 single-maintainer: a calendar reminder. For multi-team: a recurring meeting.

## Linked artifacts

- **ADR process:** [`adr-process.md`](adr-process.md)
- **Decision log:** [`decision-log.md`](decision-log.md)
- **Code review:** [`code-review.md`](code-review.md)
- **Release process:** [`../09-deployment/release-process.md`](../09-deployment/release-process.md)
- **Migrations:** [`../05-data/migrations.md`](../05-data/migrations.md)
- **Iron laws:** [`../13-quality/iron-laws.md`](../13-quality/iron-laws.md)

---

*Last reviewed: 2026-04-25 by Chris.*
