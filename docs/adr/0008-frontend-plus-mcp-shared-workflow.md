---
status: accepted
date: 2026-04-26
deciders: [orchestrator-team]
consulted: [build-agents, operator-control-plane]
informed: [integrators, future-operators]
---

# 0008. Frontend plus MCP over shared orchestration workflows

## Context

The orchestrator has two legitimate entry paths:

- Build agents consume public MCP tools, prompts, and resources.
- Operators use the frontend control plane through loopback `admin.*` MCP tools.

Earlier milestone slices let these paths drift: public provisioning, admin lifecycle tools, and the frontend could each represent similar work with different code paths and different state. That conflicts with the v6 product shape: a headless Agent Context Orchestrator with an operator/admin control plane, not a frontend-only app and not a separate admin product.

## Decision Drivers

- Agent-facing MCP remains the public build-agent contract.
- The frontend stays first-class for internal operation and observability.
- External writes need one policy, idempotency, audit, and trace-link path.
- Feature flags should remain rollback controls, not the primary product shape.
- A single implementation path is easier to verify and explain during review.

## Considered Options

1. **MCP-only product.** Remove or defer the frontend. Simpler surface, but loses the operator workflow already represented by ADR 0006.
2. **Frontend-first product with MCP as a side channel.** Useful for demos, but violates the original headless orchestrator contract.
3. **Frontend plus MCP over shared workflows.** Keep both entry paths and make both call the same backend services.

## Decision Outcome

Adopt option 3.

The canonical product shape is **frontend plus MCP**, backed by shared orchestration workflows. Public MCP tools and loopback admin MCP tools are wrappers around the same planning, provisioning, context, readiness, handoff, audit, and trace-link services. The frontend remains an internal/operator-facing control plane and must not invent state that public MCP cannot also observe.

Completed v1 features default on. Environment flags remain available as rollback switches for operators who need to temporarily hide a surface or disable execution.

## Consequences

### Positive

- Build agents and operators see the same project state.
- Policy decisions, idempotency keys, trace links, and signed audit entries are consistent across entry paths.
- The control plane can stay useful without becoming a parallel API.

### Negative

- Admin tools may need compatibility shims while older frontend pages migrate to shared workflow outputs.
- Tests must cover parity between public MCP and admin MCP for lifecycle actions.

### Neutral

- Future REST endpoints can still be generated as a thin adapter if a later ADR reverses the REST deferral.

## More Information

- ADR 0006: operator control plane admin MCP tools.
- `src/workflows/`
- `src/mcp/tools/`
- `src/mcp/admin/tools/`
