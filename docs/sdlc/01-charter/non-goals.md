---
title: Non-Goals
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [executive, engineer, integrator]
sdlc_category: 01-charter
related: [docs/sdlc/01-charter/README.md, agent-context-orchestrator-mcp-plan-v6.md §3, §4]
---

# Non-Goals

> **TL;DR:** Things we are NOT building in v1, with rationale. This list is as important as the goals — it prevents scope creep and makes "why aren't you doing X?" answerable. v6 §3 (Assumptions) and §4 (Non-Goals) are the canonical source; this doc consolidates and explains.

A non-goal isn't an absence of work; it's an explicit decision. If a non-goal becomes a goal later, that's a strategic shift requiring an ADR or charter update.

---

## Multi-tenant SaaS hosting

**Status:** Out of v1.
**Source:** v6 §7.3 (multi-tenant runway).

### What this means

The orchestrator runs as a single-tenant deployment. One instance per organization. No customer isolation needs to be enforced at the application layer — the OS / VM / cluster is the isolation boundary.

### Why we're not doing this

Multi-tenant adds significant complexity:

- Per-tenant audit chain key registry (instead of one git ref).
- Per-tenant token store master keys (depends on PCO-57 envelope encryption).
- Per-tenant data isolation in every query (every repository).
- Per-tenant rate-limiting + capacity allocation.
- Per-tenant billing telemetry.
- Cross-tenant attack surface in the threat model.

For v1, this complexity isn't justified by the value proposition. Single-tenant validates the core orchestration logic first.

### What it would take

The runway is documented in v6 §7.3:

- PCO-51 (per-tenant key isolation) is the spike that explores the design.
- PCO-57 (envelope encryption) is a prerequisite for per-tenant token isolation.
- Schema migrations to add tenant_id everywhere it's needed.
- Audit chain refactor (per-tenant chain heads).
- Multi-tenant attack surface added to the threat model.

This is real work. Estimate: ~200-400 engineering hours when the team's ready.

### When we'd revisit

When commercializing — see [`../16-cost/pricing-runway.md`](../16-cost/pricing-runway.md).

## Persistent agent memory across sessions

**Status:** Out of v1.
**Source:** v6 §4 non-goals; see `docs/partners/hindsight.md` for the considered approach.

### What this means

Build agents (Claude Code, Cursor, etc.) maintain their own memory across sessions. atl-mcp doesn't store agent-specific memory.

### Why we're not doing this

- **Scope.** Memory is agent-specific; treating it as orchestrator-level concern conflates roles.
- **Privacy.** Agent memory often contains sensitive intermediate context; storing it server-side raises new concerns.
- **Already covered by host.** Most build-agent hosts have their own memory mechanisms (Cursor's `.cursor/rules`, Claude Code's CLAUDE.md, etc.).

### What we provide instead

Context packs (M7+) — bounded, redacted, model-targeted slices of project state delivered on request. Stateless from atl-mcp's perspective; the build agent uses them and discards.

### When we'd revisit

If the multi-agent / multi-host story demands shared memory state across sessions (unlikely for v1's use case), revisit. Hindsight (the partner doc) describes a viable approach.

## GitHub, GitLab, Linear

**Status:** Out of v1.
**Source:** v6 §3 non-goals.

### What this means

VCS support is Bitbucket Cloud only. Issue-tracker support is Jira only. Confluence is the wiki.

### Why we're not doing this

- **Bounded scope.** Each provider integration is meaningful work (auth flows, capability discovery, write semantics). Adding three more triples the work.
- **Customer concentration assumption.** v1 assumes Atlassian + Bitbucket customers; expanding requires customer demand we don't yet have.
- **The `Provider.ts` interface is the design lever.** It's designed to add new providers. Adding GitHub is a follow-on workstream, not a rewrite.

### What it would take

For each new provider:

- Auth implementation.
- Capability discovery.
- REST client with retry / pagination / rate-limit.
- Write semantics (idempotent + audited).
- Test surface (mocked + live).

Estimate: ~80-120 hours per provider once the abstraction is mature.

### When we'd revisit

When a customer needs a non-Bitbucket VCS specifically. The provider abstraction is the wedge.

## Bitbucket Data Center / Server (on-prem Atlassian)

**Status:** Out of v1.
**Source:** v6 §3 non-goals.

### What this means

Bitbucket Cloud only. Customers running Bitbucket on-prem (Data Center / Server) are not supported in v1.

### Why we're not doing this

- **Different APIs.** Cloud and Data Center have meaningfully different REST APIs.
- **Different auth.** Cloud uses app passwords / OAuth; DC has different mechanisms.
- **Smaller customer base** for the type of customer atl-mcp targets.

### When we'd revisit

If a customer requires DC support specifically. The implementation is straightforward (parallel `BitbucketDCProvider`); the customer-validation gate is the missing piece.

## OpenAPI codegen for the admin REST API

**Status:** Out of v1.
**Source:** v6 §40 F-151.

### What this means

The mgmt REST API (`/healthz`, `/readyz`, `/metrics`, plus M11 admin endpoints) is hand-typed in TypeScript. No OpenAPI spec; no codegen for client libraries.

### Why we're not doing this

- **Surface is small.** Few endpoints; hand-coding is fine.
- **Single consumer.** Operators reach mgmt API via curl / scripts; no need for typed clients.
- **Maintenance cost.** OpenAPI specs drift from implementation; codegen adds another build step.

### When we'd revisit

When mgmt API surface grows (post-v1) AND there are external consumers (operators using a typed client library). For v1: not warranted.

## Customer-facing UI

**Status:** Out of v1.
**Source:** v6 §3.

### What this means

No web UI for atl-mcp itself. Operators interact via mgmt REST + Atlassian/Bitbucket UIs (which atl-mcp provisions content into). Build agents interact via MCP.

### Why we're not doing this

- **UI is its own discipline.** Frontend stack, state management, auth flow, design system — all separate from the core orchestration logic.
- **Atlassian provides the UI.** Once atl-mcp provisions a Jira project, the operator and build agents use Jira's UI. atl-mcp doesn't need to recreate it.
- **Premature scope expansion.** Build the orchestration; don't get distracted.

### When we'd revisit

When operator workflows require a UI atl-mcp doesn't have (e.g., a project provisioning wizard). Unlikely for v1's narrow scope.

## Compliance certifications (SOC2, HIPAA, ISO 27001)

**Status:** Out of v1.
**Source:** [`../03-requirements/compliance-scope.md`](../03-requirements/compliance-scope.md).

### What this means

No formal certifications pursued. atl-mcp documents its security posture but doesn't undergo audit.

### Why we're not doing this

- **Pre-customer.** v1 is reference / portfolio; no customer requires certifications yet.
- **Cost.** SOC2 Type 1 alone is months of work + $$. Type 2 is a year.
- **Distraction.** Certifications are achieved at the cost of feature velocity.

### When we'd revisit

When commercializing AND customers require it. Year 1 of commercial: SOC2 Type 1. Year 2: Type 2. HIPAA / ISO if customer demand.

## Real-time collaboration features

**Status:** Out of v1.
**Source:** Implicit in single-tenant scope.

### What this means

If two operators run the orchestrator simultaneously, the PHASE-STATE.json (v6 §6.1) serializes their work. There's no "I see what you're doing in real time."

### Why we're not doing this

Atlassian / Bitbucket already provide collaboration UIs. atl-mcp's role is provisioning, not collaboration. Mixing the two would be scope creep.

## Mobile clients

**Status:** Out of v1.
**Source:** Implicit in scope.

### What this means

No iOS / Android app. The build-agent ecosystem is desktop-centric; mobile MCP clients are rare.

### Why we're not doing this

No customer demand. Out of scope for the value proposition.

## Spec-changes that violate iron laws

**Status:** Always out (this is meta, not just v1).
**Source:** [`../13-quality/iron-laws.md`](../13-quality/iron-laws.md).

### What this means

The iron laws (verify before claiming done; test-first for new behavior) don't bend. A spec change that proposes shipping without test coverage is rejected.

### Why we're not doing this

The discipline IS the project. Without iron laws, the project becomes a different (worse) thing.

---

## How non-goals get added

When a new non-goal is identified:

1. Document in this file with a section per the template above.
2. If material: cite an ADR or v6 spec section.
3. Cross-link from related docs.
4. Surface in [`../12-governance/decision-log.md`](../12-governance/decision-log.md).

## How non-goals get removed (promoted to goals)

Rare. Requires:

1. ADR documenting the change.
2. Charter update.
3. Decision log entry.

The process exists to prevent silent scope drift.

## Linked artifacts

- **Charter parent:** [`README.md`](README.md)
- **Strategy:** [`product-strategy.md`](product-strategy.md)
- **Spec:** v6 §3 (Assumptions), §4 (Non-Goals), §7.3 (multi-tenant runway), §40 (deferred items)
- **Decision log:** [`../12-governance/decision-log.md`](../12-governance/decision-log.md)
- **Compliance:** [`../03-requirements/compliance-scope.md`](../03-requirements/compliance-scope.md)
- **Pricing runway:** [`../16-cost/pricing-runway.md`](../16-cost/pricing-runway.md)
- **Demo limitations:** [`../../demo/known-limitations.md`](../../demo/known-limitations.md)

---

*Last reviewed: 2026-04-25 by Chris.*
