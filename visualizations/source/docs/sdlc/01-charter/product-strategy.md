---
title: Product Strategy
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [executive, engineer]
sdlc_category: 01-charter
related: [docs/sdlc/01-charter/README.md, agent-context-orchestrator-mcp-plan-v6.md §1, §2]
---

# Product Strategy

> **TL;DR:** atl-mcp solves the bottleneck between "we know what to build" and "build agents can start." That bottleneck is mechanical (epics, stories, scaffolding) but high-stakes (bad scaffolding propagates for months). v1's bet: a single-tenant tool that does this deterministically, with a defensible audit trail, will be valued enough to justify continued investment. Strategy is to ship M6a (first shippable slice) as the validating moment.

The strategy doc complements the charter ([`README.md`](README.md)). The charter answers "what is this?"; this doc answers "why is this worth doing, and how do we know it's working?"

---

## The problem we're solving

Every engineering initiative has a startup cost. Translating "here's what we want to build" into the artifacts a team (or a build agent) can begin work on is mechanical:

- Epics with clear scope.
- Stories with acceptance criteria.
- Architecture summary.
- Test strategy.
- Release plan.
- Repo scaffolding with branching conventions.
- Agent-context manifest for build agents.

This work is not creative. It's pattern-matching against precedent. Done well, it takes 1-2 weeks and the team starts well. Done badly, the consequences propagate for months — bad acceptance criteria produce bad PRs; bad scaffolding produces bad agent context; bad context produces bad implementation.

The problem with doing it well is that "well" requires:

- Knowledge of the target Atlassian / Bitbucket workspace conventions.
- Discipline about scope (don't over-spec, don't under-spec).
- Idempotency (can re-run as requirements evolve).
- Auditability (decisions traceable; provisions reversible).

Manually getting all four right consistently is hard. Hiring a "scaffolding expert" doesn't scale. The pattern is automate-able.

## The bet

v1 is a bet that:

1. **The orchestrator can produce scaffolding good enough that the operator's edit pass is small** (not "good enough to skip review entirely" — that's not the bet).
2. **Idempotent re-runs are valuable** — when requirements evolve, the orchestrator catches up without manual diff-resolution.
3. **The audit trail matters** — for compliance, for forensics, for trust between the operator and the build agents downstream.
4. **The MCP integration is the lever** — exposing this as MCP makes it consumable by every agentic AI build agent without per-host special-casing.

If this bet pays off, atl-mcp becomes the layer between "human intent" and "agentic build" — a critical piece of the AI-engineering toolchain.

If the bet doesn't pay off, the work still produced:

- A reference implementation of the patterns (audit chain, policy decision layer, MCP server design).
- Substantial domain knowledge captured in the v6 spec + 42 partner guides.
- A portfolio-grade demonstration of senior engineering (the dogfooding frame).

The downside is bounded; the upside is significant.

## The validating moment

**v1 ships when M6a is operational.**

M6a (Jira provisioning executor) is the first shippable slice because:

- It produces real, customer-visible output (Jira issues exist).
- It exercises the full pipeline (intake → blueprint → plan → execute).
- It validates the audit chain in production-shaped scenarios.
- It validates the policy decision layer.
- Subsequent milestones (M6b/c, M7+) extend; M6a is the spine.

If atl-mcp ships M6a and produces useful Jira projects: the bet is paying off. Continue investment.

If M6a ships but the output requires heavy operator editing: the bet needs revisiting. Adjust scope or strategy.

## Success criteria (v1)

The 6 success criteria from the charter ([`README.md`](README.md)):

1. End-to-end provisioning in < 10 minutes.
2. Idempotent re-runs.
3. Verifiable audit log.
4. Build agent successfully implements a story end-to-end against the provisioned scaffolding.
5. Preflight catches 80%+ of misconfigurations pre-write.
6. System passes its own readiness rubric at "Ready" tier.

These gate v1.0.0. Each is testable; each has a corresponding measurement plan.

## What we're NOT betting on

Equally important to name:

- **NOT betting that this becomes SaaS.** v1 is single-tenant on-prem. SaaS is post-v1, with separate strategic decision.
- **NOT betting that LLMs replace human judgment.** atl-mcp's outputs go through human review. The orchestrator generates scaffolding; humans approve.
- **NOT betting that build agents replace humans.** The orchestrator's output is consumed by build agents AND by humans. Both can use the same workspace.
- **NOT betting on a specific build-agent vendor.** Build-agent-agnostic is a deliberate design choice; market dynamics aren't in our control.

## Strategic decision history

### v5 → v6

The v5 plan was earlier; v6 reflects the synthesis of 42 partner integration guides. v6 §0 documents what changed:

- Strategic shift: orchestration MCP, not API wrapper.
- Adoption of audit chain pattern (ADR-0005) from agentdiff.
- Adoption of MADR + adr.github.io for ADR governance.
- Adoption of test-first iron law from superpowers.
- Adoption of postmortem framework from vibe-tuning.

The v6 spec is the canonical strategy artifact. This doc summarizes; the spec is authoritative.

### Single-tenant for v1

Considered: multi-tenant from day one. Rejected because:

- Multi-tenant complexity exceeds v1's capacity to ship.
- Single-tenant validates the core value proposition first.
- Multi-tenant runway is documented (v6 §7.3); future migration is feasible.

### Atlassian + Bitbucket only

Considered: GitHub from v1. Rejected because:

- Bounded scope ships sooner.
- Atlassian + Bitbucket integration is deeper (more features per provider).
- Adding GitHub is a distinct workstream; doing it later is fine.

This was a real tradeoff — many engineering teams use GitHub. v1 deferred them deliberately; the partner-integration approach is "build deep first, breadth second."

## Strategic risks

### Build-agent ecosystem shifts

If MCP loses traction or a competing protocol displaces it: atl-mcp's value proposition narrows. Mitigation: the underlying orchestration logic can be exposed via REST too if needed; MCP is the surface, not the substance.

### LLM cost trajectory

LLM costs per call are decreasing rapidly. Eval-view (multi-provider judges) is cost-significant; if costs spike again, the eval-view pattern becomes harder to justify. Mitigation: eval-view is configurable (skip-able for low-stakes operations).

### Atlassian platform changes

Atlassian's API or pricing could change in ways that impact atl-mcp. Mitigation: the provider abstraction (`src/providers/atlassian/`) is replaceable; if Atlassian becomes hostile, the provider can adapt or be replaced.

### Build-agent failure modes

If build agents (Claude Code, Cursor, etc.) produce systematically bad output, atl-mcp's downstream consumers fail. Mitigation: atl-mcp doesn't control build-agent quality; it ensures its OWN output is good. The audit chain captures everything for forensic review.

## Linked artifacts

- **Charter parent:** [`README.md`](README.md)
- **Non-goals:** [`non-goals.md`](non-goals.md)
- **Spec:** v6 §1 (Mission), §2 (Strategic design), §0 (v6 review summary)
- **Multi-tenant runway:** v6 §7.3
- **Build sequence:** [`../../build-orchestration.md`](../../build-orchestration.md)
- **ADRs:** [`../../adr/`](../../adr/)
- **Decision log:** [`../12-governance/decision-log.md`](../12-governance/decision-log.md)

---

*Last reviewed: 2026-04-25 by Chris.*
