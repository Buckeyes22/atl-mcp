---
title: FinOps
owner: Chris
status: accepted (lightweight v1)
last_reviewed: 2026-04-25
version: 1.0.0
audience: [executive, operator]
sdlc_category: 16-cost
related: [docs/sdlc/16-cost/cost-model.md]
---

# FinOps — Tag, Track, Report, Alarm

> **TL;DR:** v1 FinOps is lightweight: tag cloud resources by project, track monthly spend by category, report quarterly, alarm on >20% MoM growth or >50% MoM in LLM line. Heavier FinOps (chargeback, showback, optimization automation) is post-v1 multi-tenant work.

For a single-tenant on-prem deployment, full FinOps tooling is overkill. The discipline still matters; the implementation is light.

---

## The four pillars

### Tag

Cloud resources used by atl-mcp get tagged consistently:

| Tag | Value example |
|---|---|
| `project` | `atl-mcp` |
| `environment` | `dev` / `staging` / `production` |
| `owner` | `chris` (or the maintainer) |
| `cost-category` | `compute` / `db` / `storage` / `network` |
| `tier` | `production` (helps cost allocation) |

In dev / on-prem: tagging may not apply. Document the resource manifest (host, disk, etc.) instead.

For LLM provider calls: each provider's billing dashboard separates by API key. Use a dedicated key for atl-mcp so the spend is identifiable.

### Track

Monthly spend rollup by category:

| Month | Compute | DB | Storage | LLM | Other | Total |
|---|---|---|---|---|---|---|
| 2026-04 | — | — | — | — | — | — |
| 2026-05 | — | — | — | — | — | — |
| ... |

Source: cloud billing console + LLM provider invoices. Pulled monthly.

### Report

Quarterly review:

- Trend over the last 3 months.
- Largest line items.
- Anomalies (sudden growth, unexpected charges).
- Forecast for next quarter.

For v1 single-maintainer: a 30-min calendar reminder once a quarter. Outputs: a paragraph in the project's quarterly status doc + any necessary actions.

### Alarm

Automated alerts when:

- **Total spend > 20% MoM increase** (without explanation).
- **LLM spend > 50% MoM increase** (most volatile category; usually a sampling-rate change).
- **Storage spend > 30% MoM increase** (unusual; usually a leak in retention).

Implementation: cloud platform billing alerts → email / Slack / on-call.

## Cost attribution (single-tenant v1)

In single-tenant: all spend attributes to the one customer. Attribution is simple.

For internal use (e.g., the dogfooded portfolio version): cost is the maintainer's. Track for budget awareness, not chargeback.

## Cost vs. SLO tradeoffs

When SLOs and cost compete:

- **Latency SLO miss + capacity-bound:** vertical scale (cost up).
- **Capacity headroom + low SLO threat:** opportunity to scale down (cost down).
- **LLM-driven cost spike:** reduce sampling or use smaller models (cost down, quality risk).

These are operator-level decisions. Document them with rationale; they're audit-worthy when material.

## Optimization opportunities

Common levers (also in [`cost-model.md`](cost-model.md)):

1. **Cache more.** Reduces upstream calls (Atlassian / Bitbucket) and LLM calls.
2. **Smaller models for non-critical paths.** A draft pre-blueprint can use a smaller model; the production blueprint uses Sonnet.
3. **Skip eval-view triplet on low-stakes operations.** v6 §31.1 supports cost-tier-based selection.
4. **Right-size DB.** Most v1 workloads run fine on a 2 vCPU / 4 GB Postgres.
5. **Manage backup retention.** Shorter PITR window saves storage.

Each optimization has a quality / availability cost. Don't optimize blindly.

## What FinOps is NOT (in v1)

- **Real-time chargeback.** Single-tenant; no need.
- **Showback to internal teams.** No internal teams in v1.
- **Cost-aware autoscaling.** Single replica; no autoscaling yet.
- **Reserved-instance / committed-use discounts.** v1 is small enough that this isn't worth the complexity.

These all become relevant post-v1 (multi-tenant SaaS).

## Post-v1 FinOps (preview)

When commercializing:

- **Per-customer cost attribution.** Each tenant gets a unit cost; pricing reflects.
- **Cost-aware policy decisions.** "Don't run 3-provider eval-view if customer's plan doesn't include it."
- **Reserved capacity.** Lock in compute / DB pricing.
- **Margin tracking.** Cost vs. price per customer per period.

[`pricing-runway.md`](pricing-runway.md) is the corresponding pricing-side doc.

## Linked artifacts

- **Sibling:** [`cost-model.md`](cost-model.md), [`pricing-runway.md`](pricing-runway.md)
- **Capacity:** [`../15-capacity/capacity-planning.md`](../15-capacity/capacity-planning.md) (capacity drives cost)
- **SLOs:** [`../08-operations/slo-sli.md`](../08-operations/slo-sli.md) (SLO competes with cost)

---

*Last reviewed: 2026-04-25 by Chris.*
