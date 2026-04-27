---
title: Pricing Runway (post-v1 SaaS)
owner: Chris
status: speculative (pre-commercialization)
last_reviewed: 2026-04-25
version: 1.0.0
audience: [executive]
sdlc_category: 16-cost
related: [docs/sdlc/16-cost/cost-model.md, agent-context-orchestrator-mcp-plan-v6.md §7.3]
---

# Pricing Runway — If atl-mcp Becomes SaaS

> **TL;DR:** Speculative. v1 is single-tenant on-prem; SaaS is post-v1. If commercialized: per-project pricing dominates because per-project cost is the most predictable; per-seat or per-tenant tiers add structure. Hosted SaaS, self-managed, and embedded-in-platform are three viable models. The pricing structure should align with how customers actually consume the service.

This doc is forward-looking. It exists so the v1 design choices align with viable v2 commercial models — not because v1 has prices.

---

## The decision space

If commercializing atl-mcp post-v1, three deployment models with different pricing implications:

### Model 1: Hosted SaaS

- **Customer experience:** sign up, point at their Atlassian + Bitbucket, receive an MCP endpoint.
- **Operational cost:** atl-mcp team operates the infra. Multi-tenant from day one (per-tenant data isolation, per-tenant key registry, per-tenant audit chain).
- **Pricing structure:** per-seat (operator + reviewer) or per-project or per-resource. Subscription.
- **Margin pressure:** cost-per-customer must be much less than price-per-customer. Multi-tenant is the cost-efficiency win.

### Model 2: Self-managed

- **Customer experience:** customer deploys atl-mcp themselves; gets the image and the docs.
- **Operational cost:** customer's. atl-mcp team doesn't host.
- **Pricing structure:** licensing (per-instance, per-year). Or open-source with paid support.
- **Margin pressure:** lower revenue per customer; lower cost per customer.

### Model 3: Embedded in a platform

- **Customer experience:** atl-mcp ships as a feature inside a broader platform (e.g., a build-agent vendor's product, a developer-tools platform).
- **Operational cost:** the platform's.
- **Pricing structure:** atl-mcp team gets a cut of platform revenue, or a flat licensing fee.
- **Margin pressure:** depends on platform's pricing power.

Each is viable; each has different v2 architecture implications.

## What v1 design preserves

Several v1 choices are deliberately compatible with all three models:

- **Tenant scope is in the domain model from M1.** Multi-tenant migration is a refactor, not a rebuild.
- **Container image is the deploy unit.** Self-managed customers can run it.
- **MCP transport is open.** Embedded-in-platform integrations are straightforward.
- **Audit chain is verifiable.** Each tenant can verify their own chain (post-v1).

## What v1 doesn't decide

- **Whether to commercialize at all.** v1 is portfolio + reference; commercialization is a separate decision.
- **Which model.** Decide when there's customer demand to validate.
- **Pricing tiers.** Premature without operational cost data.

The v6 §7.3 multi-tenant runway is the architectural prerequisite for any of these models.

## Hypothetical pricing structures (sketch only)

### If hosted SaaS

| Tier | Price/mo | Includes |
|---|---|---|
| Starter | $200 | 5 active projects, 1 operator seat, basic eval-view |
| Team | $1000 | 25 projects, 5 seats, full eval-view |
| Enterprise | custom | unlimited, dedicated support, SOC2-grade audit |

These numbers are illustrative. Real pricing depends on:
- Customer's existing tooling spend (anchor).
- Per-project unit cost (floor).
- Competitive landscape.
- Margin target.

### If self-managed

| Tier | Price | Includes |
|---|---|---|
| Open source | free | the code |
| Paid support | $5000/year | priority support, security advisories |
| Enterprise | custom | air-gap deployment guidance, custom integration |

### If embedded

Revenue share with the host platform. Specifics depend on the partnership.

## Cost-to-serve forecasts

Per [`cost-model.md`](cost-model.md), v1 single-tenant cost is $200-1000/month at typical workload.

Multi-tenant per-tenant cost (post-v1):

- Each tenant adds incremental cost (~50% of single-tenant cost, assuming amortization).
- Shared compute / DB / monitoring across tenants.
- LLM cost is per-tenant (no sharing).

Estimating cost-per-tenant: ~$100-500/month at typical workload, with eval-view as the dominant variable.

## Risks to the runway

- **Multi-tenant security.** A single-tenant breach is one customer; multi-tenant breach is many. The audit chain + key isolation work is non-trivial.
- **Vendor pricing changes.** LLM provider price changes affect cost-to-serve significantly.
- **Atlassian / Bitbucket changes.** Vendor lock-in risk if their pricing or API changes.
- **Customer concentration.** Few-large-customers vs. many-small-customers requires different pricing structures.

## Decision points

When commercialization happens (if it does):

1. Validate model with at least one paying customer.
2. Implement multi-tenant prerequisites (PCO-51 + PCO-57 + audit chain isolation).
3. Build billing telemetry (per-tenant cost attribution).
4. Establish pricing experimentally; iterate.

None of this is v1 work. v1's job is to be defensibly architected for any of these futures.

## Linked artifacts

- **Sibling:** [`cost-model.md`](cost-model.md), [`finops.md`](finops.md)
- **Multi-tenant runway:** v6 §7.3
- **Single-tenant non-goal:** [`../01-charter/non-goals.md`](../01-charter/non-goals.md)
- **Charter:** [`../01-charter/README.md`](../01-charter/README.md)

---

*Last reviewed: 2026-04-25 by Chris.*
