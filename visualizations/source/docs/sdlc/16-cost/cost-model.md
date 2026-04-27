---
title: Cost Model
owner: Chris
status: accepted (estimates only; refines with operational data)
last_reviewed: 2026-04-25
version: 1.0.0
audience: [executive, engineer, operator]
sdlc_category: 16-cost
related: [docs/sdlc/15-capacity/, docs/sdlc/16-cost/finops.md]
---

# Cost Model

> **TL;DR:** v1 single-tenant on-prem cost is dominated by (1) host compute (~$50/mo for a small VM), (2) Postgres (~$100-300/mo managed), (3) LLM provider calls during sampling (variable, $50-500/mo at v1 scale), (4) backup storage (~$5-20/mo). Total v1 monthly: $200-1000 at typical workload. Per-tool / per-project costs surfaced as a footnote when telemetry catches up. SaaS pricing runway in [`pricing-runway.md`](pricing-runway.md).

This is the per-month aggregate model. Per-tool unit costs are interesting but require workload data we don't have yet — those land as we benchmark.

---

## Cost categories

### Compute (host running atl-mcp)

| Component | Spec | Monthly cost (rough) |
|---|---|---|
| VM / pod | 2 vCPU, 2 GB RAM, 50 GB disk | ~$30-80 (cloud-dependent) |
| Network egress | Modest | ~$5-20 |
| Container registry storage | 30 image tags × 150 MB | ~$1-3 |

For self-hosted on-prem: capital cost rather than monthly.

### Postgres

| Tier | Spec | Monthly cost |
|---|---|---|
| Cloud SQL / RDS small | 2 vCPU, 4 GB RAM, 50 GB SSD, automated backups | ~$80-150 |
| Cloud SQL / RDS standard | 4 vCPU, 8 GB RAM, 100 GB SSD, multi-AZ (post-v1) | ~$300-500 |

Postgres dominates infrastructure cost at v1 scale.

### LLM provider calls

The variable cost. Sampling is invoked during:

- Blueprint generation (M4+).
- Adversarial verification triplet (M4+).
- Readiness LLM-judged verdict (M8+).
- Eval-view multi-provider judges (M11+).

Per-call cost depends on provider + model + token count:

| Use | Tokens per call (rough) | Provider | Per-call cost (rough) |
|---|---|---|---|
| Blueprint generation (Claude Sonnet 4.x) | 50k input + 5k output | Anthropic | ~$0.30 |
| Adversarial critique (Claude Sonnet 4.x) | 60k input + 1k output | Anthropic | ~$0.20 |
| Readiness verdict (per provider) | 20k input + 1k output | Anthropic / OpenAI / Google | ~$0.10 each |
| Eval-view triplet judges | 3 × verdict | varies | ~$0.30 |

At v1 scale (10 projects/month, ~5 sampling calls per project): ~$50-150/month in LLM calls.

At higher scale: scales linearly. Eval-view (M11) triples judge calls.

### Backup storage

| Component | Size | Monthly cost |
|---|---|---|
| PITR (7 days) | ~5 GB | ~$1 |
| Daily snapshots (30 days) | ~30 GB | ~$3 |
| Quarterly long-term (4 quarters) | ~20 GB | ~$2 |
| Audit chain backup | (within above) | — |

Total: $5-10/month for a single-tenant deploy.

### External integrations

| Service | Cost |
|---|---|
| Atlassian Cloud | Customer's existing license |
| Bitbucket Cloud | Customer's existing license |
| UIO partner | TBD per partnership |
| Langfuse (if used) | Free tier sufficient at v1 scale; paid tier ~$50/month |

These are typically the customer's existing tooling spend, not atl-mcp's incremental cost.

### Operational

| Item | Cost |
|---|---|
| On-call paging tool | ~$0-50/month (PagerDuty free tier sufficient at v1) |
| Status page | Free tier sufficient |
| Monitoring (Prometheus / Grafana) | Self-hosted free; managed ~$10-50/month |

## Total monthly cost at v1 scale

| Workload size | Compute | DB | LLM | Backup | Misc | **Total** |
|---|---|---|---|---|---|---|
| Light (1-2 projects) | $50 | $100 | $50 | $5 | $50 | **~$255** |
| Typical (10 projects) | $80 | $150 | $150 | $10 | $50 | **~$440** |
| Heavy (50+ projects) | $150 | $300 | $500 | $20 | $50 | **~$1,020** |

Numbers are rough; refines with actual telemetry. The dominant variable is LLM call volume.

## Per-project unit cost (estimate)

For a typical project provisioned end-to-end:

- 1× preflight call (no LLM).
- 1× blueprint generation: ~$0.30 + adversarial triplet ~$0.20 = $0.50.
- 1× readiness validation (3 providers): ~$0.30.
- 5-20 context pack generations (mostly retrieval, modest LLM): ~$0.50.
- Provisioning: no LLM cost; provider API calls only.

Per-project provisioning: **~$1.30 in LLM calls**, plus the share of fixed infra.

Amortized over a full project lifecycle (build agent runs against the workspace, periodic context refreshes): ~$5-20 per project.

## Cost-saving levers

If costs are pressing:

1. **Cache aggressively.** Preflight cache TTL, ACL cache, context pack reuse.
2. **Right-size sampling.** Smaller models for non-critical paths; bigger only where verdict matters.
3. **Skip eval-view triplet** for low-stakes operations (cost-bound: only triplet for production-bound blueprints).
4. **Reduce audit-trail retention** if storage is the issue (NB: audit chain itself is forever).
5. **Vertical scale only when necessary.** Idle headroom is wasted spend.

## Cost growth signals

Track:

- LLM monthly spend (most volatile).
- Postgres storage growth (steady, predictable).
- Backup storage (proportional to PITR retention + snapshot retention).

Surprise cost growth signals: investigate. Often a workload bug producing extra calls.

## What's NOT in this model (yet)

- **Multi-tenant SaaS pricing** — see [`pricing-runway.md`](pricing-runway.md). Different cost structure entirely.
- **Per-tool unit costs** — requires telemetry instrumentation; landing in M11.
- **Customer-side costs** — Atlassian/Bitbucket licenses, build-agent host (Claude Code, Cursor) are not in the orchestrator's cost.
- **Engineering time** — operator time, on-call burden, etc. Captured separately.

## Linked artifacts

- **Sibling:** [`finops.md`](finops.md), [`pricing-runway.md`](pricing-runway.md)
- **Capacity:** [`../15-capacity/`](../15-capacity/) (capacity drives cost)
- **Sampling design:** v6 §23
- **Eval-view:** [`../07-testing/eval-view-integration.md`](../07-testing/eval-view-integration.md) (cost driver)

---

*Last reviewed: 2026-04-25 by Chris.*
