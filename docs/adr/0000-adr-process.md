---
status: accepted
date: 2026-04-25
deciders: [orchestrator-team]
consulted: []
informed: [build-agents]
---

# 0000. ADR process for the orchestrator

## Context

Architectural decisions in this repo span: technology choices (storage, queue, transports), interface contracts (ProviderInterface shapes, MCP capability gating), security postures (audit signing, ACL classification), and integration scopes (which partner repos are vendored vs pattern-lifted). Without a process, decisions accumulate in commit messages and Slack threads, which neither future maintainers nor build agents can reliably reconstruct.

## Decision Drivers

- Build agents (Codex, Claude Code) consume ADRs as primary context — they need a stable, machine-parseable shape.
- The repo already commits to the v6 spec + 42 partner guides as authoritative; ADRs sit alongside as the decision-log layer.
- Existing community standards (MADR + adr.github.io) are mature and tool-supported.

## Considered Options

1. **MADR template + adr.github.io governance** — community-maintained, machine-parseable, conformance-friendly.
2. **Nygard 5-section template** — simpler but less machine-parseable; no Good/Bad/Neutral split.
3. **Custom ADR format** — full control, zero ecosystem benefit.
4. **No ADRs; rely on commit messages** — current state; rejected up front.

## Decision Outcome

Adopt **MADR 4.0 template** ([`docs/partners/madr.md`](../partners/madr.md), F-122) with **adr.github.io START Criteria + Definition of Done** ([`docs/partners/adr-github-io.md`](../partners/adr-github-io.md), F-123) as the governance layer.

### Format

- File location: `docs/adr/`.
- Filename: `NNNN-decision-title.md` (zero-padded, sequential per merge to main).
- YAML frontmatter required: `status` (one of `proposed | accepted | superseded | deprecated`), `date` (ISO-8601), `deciders`, optional `consulted` + `informed`.
- Section headings (in order): Context → Decision Drivers → Considered Options → Decision Outcome → Consequences (Good/Bad/Neutral subsections) → optional More Information.

### START Criteria (Definition of Ready before opening an ADR)

- **S**ignificant — impacts API, architecture, security posture, or operational cost.
- **T**eam-enabled — implementation capacity exists.
- **A**greed — primary `deciders` aligned (supermajority).
- **R**eviewed — at least one architect-level review on the PR.
- **T**imely — non-urgent batched monthly; urgent decisions fast-track via §30.5 escalation.

### Definition of Done (before merging an ADR PR)

1. Decision recorded in `docs/adr/NNNN-*.md` with valid frontmatter.
2. Rationale documented (Decision Drivers + Decision Outcome explain *why*).
3. Alternatives considered (≥2 in Considered Options with rejection reasons).
4. Consequences listed (≥1 Good, ≥1 Bad, optional Neutral; quantified where possible).
5. Status set to `accepted` (or `proposed` if pending sign-off).

### Numbering

- Numbers assigned at PR-merge time, not at PR-open time.
- Two parallel branches each writing `NNNN-*.md` resolve via merge: the second to merge bumps to `NNNN+1`.

### Status transitions

- `proposed` → `accepted` (when sign-off complete).
- `accepted` → `superseded` (link to successor ADR via `superseded-by` frontmatter field).
- `accepted` → `deprecated` (no replacement; explain in Decision Outcome amendment).

## Consequences

### Good

- Build agents have a deterministic, structured decision log to consume.
- Decision-log discipline matches the discipline already applied to v6 spec + partner guides.
- Community-standard format enables tooling reuse (e.g., adr-tools CLI, future ADR indexers).

### Bad

- Mild process overhead per decision (~30 min to author + review an ADR).
- Decisions made informally before this ADR landed are not retroactively captured (they live in v6 plan + partner guides instead).

### Neutral

- "Significant" is project-relative — needs operationalization in practice. Ambiguous cases default to: write the ADR.
- ADR review may slow time-sensitive decisions; the START "Timely" criterion has a documented fast-track exception for those cases.

## More Information

- v6 plan §8 (repo structure includes `docs/adr/` with example ADR filenames).
- v6 plan §9 (technology choices section references MADR + START + DoD).
- [`docs/partners/madr.md`](../partners/madr.md), [`docs/partners/adr-github-io.md`](../partners/adr-github-io.md).
