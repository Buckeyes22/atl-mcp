# Audit Findings + Remediation Summary

> **Mirror of the Confluence centerpiece page** at [`ACO/Audit Findings + Remediation Summary`](https://lateapexllc.atlassian.net/wiki/spaces/ACO).
> **This is the most important page in the project.** If you're an interviewer reading for self-critique, start here.

---

## Methodology

Three sources fed this list:

1. **Self-review.** Routine review during ADR drafting and milestone sign-off.
2. **Repo-extraction findings.** A delta-audit comparing the v6 spec to the implementation, captured in [`repo-extraction-findings.md`](../../repo-extraction-findings.md) at repo root.
3. **Security review.** Pass over the security-relevant code (token store, audit chain, policy layer, webhook verification) using the security-review skill.

---

## Findings table

| ID | Title | Severity | Status | Linked Jira |
|---|---|---|---|---|
| F-01 | `console.log` in `src/mcp/sessionCapabilities.ts` shipped in M0 | High | Fixed | [PCO-16](https://lateapexllc.atlassian.net/browse/PCO-16) |
| F-02 | `lint:no-stdout` misses dynamic `process.stdout.write` aliases | Medium | Acknowledged | [PCO-12](https://lateapexllc.atlassian.net/browse/PCO-12) |
| F-03 | Token store doesn't rotate the master encryption key | High | Deferred | [PCO-57](https://lateapexllc.atlassian.net/browse/PCO-57) |
| F-04 | ADF renderer drops nested table cells on round-trip | Medium | Acknowledged | [PCO-58](https://lateapexllc.atlassian.net/browse/PCO-58) |
| F-05 | Audit chain genesis block has no signature (chicken-and-egg) | Low | Documented intentionally | (in [ADR-0005](../adr/0005-audit-signing-pipeline.md)) |
| F-06 | OAuth 3LO refresh races with concurrent calls | Medium | Acknowledged | [PCO-59](https://lateapexllc.atlassian.net/browse/PCO-59) |
| F-07 | No integration test exercises a 429-then-success retry path | Medium | Fixed | (commit covered by [PCO-3](https://lateapexllc.atlassian.net/browse/PCO-3)) |
| F-08 | Pagination cursor in Confluence v2 silently truncates at 250 entries | Medium | Acknowledged | [PCO-30](https://lateapexllc.atlassian.net/browse/PCO-30) |
| F-09 | Storage migration rehearsal can't represent vacuumed-row schemas | Low | Deferred | [PCO-56](https://lateapexllc.atlassian.net/browse/PCO-56) |
| F-10 | Race in planner when two sessions provision overlapping namespaces | High | Deferred (M5 dependency) | [PCO-46](https://lateapexllc.atlassian.net/browse/PCO-46) |
| F-11 | Per-tenant key isolation not implemented (multi-tenant runway) | Medium (single-tenant) / High (multi-tenant) | Out of v1 scope | [PCO-51](https://lateapexllc.atlassian.net/browse/PCO-51) |
| F-12 | Several domain modules previously imported `console` | Low | Fixed | [PCO-16](https://lateapexllc.atlassian.net/browse/PCO-16) |
| F-13 | Confluence space provisioning had to use v1 API; v2 had a `representation` validation bug at time of seeding | Low | Acknowledged (revisit when v2 stabilizes) | (this Demo Ops epic) |
| F-14 | Workflow has 3 statuses not 5 (next-gen Kanban template constraint) | Low | Acknowledged in seed plan | (this Demo Ops epic) |
| F-15 | Hand-applied SQL migrations couldn't represent "run against a snapshot first" | High | Fixed | [PCO-13](https://lateapexllc.atlassian.net/browse/PCO-13) |

---

## The most embarrassing finding

### F-01: `console.log` in `src/mcp/sessionCapabilities.ts` shipped in M0

I shipped M0 with a `console.log` in `src/mcp/sessionCapabilities.ts` and didn't notice until M1 added the `lint:no-stdout` check. The first MCP client connection failed silently because stdout corruption is invisible to the writer.

This is a clean example of why protocol-level invariants must be encoded as automated checks *before* any production code that depends on them. The CLAUDE.md operating rule ("never write to stdout from `src/`") was respected by convention but not by tooling. M0 didn't have the lint check, so the convention slipped.

The lesson generalized into the project's iron law: **invariants are tooling, not vibes**. Everywhere else in the project, I treat "the rule must be enforced" as a tooling requirement, not a documentation one. The `lint:no-stdout` check is the most-tested CI rule in the project precisely because of this incident.

---

## What's deferred and why

### F-03 — Master key rotation

Requires envelope encryption with per-row data keys. Significant refactor; not justified for single-tenant v1. Will revisit when multi-tenant runway opens (v6 §7.3).

**Workaround in place:** The runbook documents a re-encrypt drill that must be rehearsed before any master-key rotation. Manual but safe.

### F-09 — Rehearsal vs vacuumed-row schemas

Pglite's vacuum behavior differs subtly from full Postgres. Acceptable for v1 because the gap is documented and the rehearsal still catches 95%+ of issues.

**Workaround:** Rehearsals targeting migrations that touch indexed columns must run against a true Postgres snapshot, not pglite. Documented in the test fixture.

### F-10 — Planner race

Depends on M5 (planner) being implemented first. Will land with PHASE-STATE.json concurrency control per v6 §6.1. The race is theoretical until M5 ships, so prioritization is fine.

### F-11 — Per-tenant isolation

Out of v1 scope by design. Multi-tenant runway documented in v6 §7.3. The tracking spike ([PCO-51](https://lateapexllc.atlassian.net/browse/PCO-51)) explores the refactor surface so it's not a surprise when we get there.

### F-13 — Confluence v2 API representation bug

When seeding the ACO space, v2 `POST /wiki/api/v2/spaces` returned 400 with "Representation cannot be null" despite the request including a valid `description.plain.representation`. Fell back to v1 successfully. Filed as a low-severity acknowledgment because the v1 endpoint is documented stable.

### F-14 — 3 statuses, not 5

Jira's next-gen Kanban template provides To Do / In Progress / Done. The original plan called for 5 statuses (Backlog / Ready / In Progress / Review / Done). Adapted because customizing the workflow is theater unless wired to gating logic. The Definition of Ready and Definition of Done pages serve the gating role instead — see [`ACO/Engineering Practice`](https://lateapexllc.atlassian.net/wiki/spaces/ACO).

---

## What I'd do differently if starting over

Three things.

1. **`lint:no-stdout` in M0, not M1.** The protocol invariant should have been the very first CI check, before the first source line. Putting it in M1 cost real reliability.
2. **Migration runner in M1, not M2.** The hand-applied migrations of M1 generated F-15. The runner should have been built first.
3. **Demo plan before milestone 0.** The dogfooding frame should drive what gets built first. I'm reverse-engineering the demo from completed milestones; if I'd started with the demo target, I'd have prioritized different surfaces (M6a, the first shippable slice, would be done already).

---

## What this page proves

If you're a senior interviewer, this page proves three things:

1. **Knowledge of own work.** Specific findings, specific tickets, specific severities.
2. **Honest self-assessment.** F-01 names a shipped bug. F-11 names a multi-tenant gap. Neither is hidden.
3. **Forward thinking.** Each deferred item has a workaround, a fix tracker, and a rationale.

If you're a junior interviewer, this page proves the candidate can write a postmortem and tell the difference between "fix it" and "document and defer it."

---

## Linked artifacts

- **Methodology source:** [`repo-extraction-findings.md`](../../repo-extraction-findings.md) in repo root
- **Tracked Jira tickets:** PCO-12, PCO-13, PCO-16, PCO-30, PCO-46, PCO-51, PCO-56, PCO-57, PCO-58, PCO-59
- **ADRs:** [ADR-0001](../adr/0001-pglite-for-dev.md), [ADR-0002](../adr/0002-token-encryption-noble-ciphers.md), [ADR-0003](../adr/0003-confluence-storage-default-adf-flagged.md), [ADR-0004](../adr/0004-bitbucket-app-password-vs-oauth.md), [ADR-0005](../adr/0005-audit-signing-pipeline.md), [ADR-0006](../adr/0006-operator-control-plane-admin-mcp-tools.md), [ADR-0007](../adr/0007-project-scoped-persistent-agent-memory.md), [ADR-0008](../adr/0008-frontend-plus-mcp-shared-workflow.md), [ADR-0009](../adr/0009-github-v1-after-bitbucket-parity.md)
- **Spec sections** that document deferred / out-of-scope items: v6 §3, §4, §7.3, §28
- **Confluence mirror:** [`ACO/Audit Findings + Remediation Summary`](https://lateapexllc.atlassian.net/wiki/spaces/ACO)

*Last reviewed: 2026-04-27 by Chris.*
