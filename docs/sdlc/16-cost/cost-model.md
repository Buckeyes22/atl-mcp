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

<figure>

<svg viewBox="0 0 1200 600" xmlns="http://www.w3.org/2000/svg" font-family="IBM Plex Sans, system-ui">
  <text x="40" y="28" font-family="IBM Plex Mono" font-size="10.5" letter-spacing="1.4" fill="#9a9690">USD / MONTH · ORDER-OF-MAGNITUDE · v1 SINGLE-TENANT · ASSUMPTIONS BELOW</text>

  <!-- chart frame -->
  <g transform="translate(120,80)">
    <!-- y axis grid -->
    <g font-family="IBM Plex Mono" font-size="10" fill="#9a9690">
      <line x1="0" y1="0"   x2="780" y2="0"   stroke="#e3e0d8"/>
      <line x1="0" y1="80"  x2="780" y2="80"  stroke="#e3e0d8"/>
      <line x1="0" y1="160" x2="780" y2="160" stroke="#e3e0d8"/>
      <line x1="0" y1="240" x2="780" y2="240" stroke="#e3e0d8"/>
      <line x1="0" y1="320" x2="780" y2="320" stroke="#e3e0d8"/>
      <line x1="0" y1="400" x2="780" y2="400" stroke="#1a1a1c"/>
      <text x="-8" y="4"   text-anchor="end">$2000</text>
      <text x="-8" y="84"  text-anchor="end">$1500</text>
      <text x="-8" y="164" text-anchor="end">$1000</text>
      <text x="-8" y="244" text-anchor="end">$500</text>
      <text x="-8" y="324" text-anchor="end">$250</text>
      <text x="-8" y="404" text-anchor="end">$0</text>
    </g>

    <!-- ============ DEV/STAGING ============ -->
    <!-- total ~$120, scale: 400px = $2000 -->
    <g transform="translate(60,376)">
      <!-- compute $60 -->
      <rect x="0" y="0"  width="120" height="12" fill="#1f6e54"/>
      <!-- db $0 (pglite) -->
      <!-- audit kms $5 -->
      <rect x="0" y="-1" width="120" height="1" fill="#6e1a82"/>
      <!-- backups $5 -->
      <rect x="0" y="-2" width="120" height="1" fill="#b96b16"/>
      <!-- observability $20 -->
      <rect x="0" y="-6" width="120" height="4" fill="#1f5f8a"/>
      <!-- network $10 -->
      <rect x="0" y="-8" width="120" height="2" fill="#7a4408"/>
      <!-- atlassian $0 (free tier) -->
      <text x="60" y="36" text-anchor="middle" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#1a1a1c">DEV / STAGING</text>
      <text x="60" y="-18" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" fill="#1a1a1c">~$95/mo</text>
    </g>

    <!-- ============ SMALL PROD ============ -->
    <!-- total ~$650 -->
    <g transform="translate(280,376)">
      <!-- compute $180 -->
      <rect x="0" y="-36" width="120" height="36" fill="#1f6e54"/>
      <!-- db $200 (RDS small) -->
      <rect x="0" y="-76" width="120" height="40" fill="#11364f"/>
      <!-- audit kms $20 -->
      <rect x="0" y="-80" width="120" height="4" fill="#6e1a82"/>
      <!-- backups $30 -->
      <rect x="0" y="-86" width="120" height="6" fill="#b96b16"/>
      <!-- observability $80 -->
      <rect x="0" y="-102" width="120" height="16" fill="#1f5f8a"/>
      <!-- network $40 -->
      <rect x="0" y="-110" width="120" height="8" fill="#7a4408"/>
      <!-- atlassian $100 -->
      <rect x="0" y="-130" width="120" height="20" fill="#43434a"/>
      <text x="60" y="36" text-anchor="middle" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#1a1a1c">SMALL PROD</text>
      <text x="60" y="20" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" fill="#6f6e6a">~10 users · ~5 repos</text>
      <text x="60" y="-138" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" fill="#1a1a1c">~$650/mo</text>
    </g>

    <!-- ============ MID PROD ============ -->
    <!-- total ~$1850 -->
    <g transform="translate(540,376)">
      <!-- compute $400 -->
      <rect x="0" y="-80" width="120" height="80" fill="#1f6e54"/>
      <!-- db $500 -->
      <rect x="0" y="-180" width="120" height="100" fill="#11364f"/>
      <!-- audit kms $40 -->
      <rect x="0" y="-188" width="120" height="8" fill="#6e1a82"/>
      <!-- backups $80 -->
      <rect x="0" y="-204" width="120" height="16" fill="#b96b16"/>
      <!-- observability $250 -->
      <rect x="0" y="-254" width="120" height="50" fill="#1f5f8a"/>
      <!-- network $150 -->
      <rect x="0" y="-284" width="120" height="30" fill="#7a4408"/>
      <!-- atlassian $430 -->
      <rect x="0" y="-370" width="120" height="86" fill="#43434a"/>
      <text x="60" y="36" text-anchor="middle" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#1a1a1c">MID PROD</text>
      <text x="60" y="20" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" fill="#6f6e6a">~50 users · ~30 repos</text>
      <text x="60" y="-378" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" fill="#1a1a1c">~$1850/mo</text>
    </g>

    <!-- legend in chart -->
    <g transform="translate(660,40)" font-family="IBM Plex Sans" font-size="11" fill="#1a1a1c">
      <rect width="2" height="200" x="-12" fill="#c8c3b6"/>
      <g><rect width="14" height="10" y="0"  fill="#1f6e54"/><text x="22" y="9">compute (host)</text></g>
      <g><rect width="14" height="10" y="22" fill="#11364f"/><text x="22" y="31">postgres (managed)</text></g>
      <g><rect width="14" height="10" y="44" fill="#6e1a82"/><text x="22" y="53">KMS (audit + envelope)</text></g>
      <g><rect width="14" height="10" y="66" fill="#b96b16"/><text x="22" y="75">backups + retention</text></g>
      <g><rect width="14" height="10" y="88" fill="#1f5f8a"/><text x="22" y="97">observability stack</text></g>
      <g><rect width="14" height="10" y="110" fill="#7a4408"/><text x="22" y="119">egress + network</text></g>
      <g><rect width="14" height="10" y="132" fill="#43434a"/><text x="22" y="141">Atlassian seats *</text></g>
      <text x="0" y="172" font-family="IBM Plex Mono" font-size="10" fill="#6f6e6a">* shown for budgetary completeness;</text>
      <text x="0" y="186" font-family="IBM Plex Mono" font-size="10" fill="#6f6e6a">  not an atl-mcp cost — customer pays</text>
      <text x="0" y="200" font-family="IBM Plex Mono" font-size="10" fill="#6f6e6a">  Atlassian directly. excluded from total.</text>
    </g>
  </g>

  <!-- assumptions block -->
  <g transform="translate(40,510)">
    <rect width="1120" height="70" fill="#faf9f6" stroke="#c8c3b6"/>
    <text x="20" y="22" font-family="IBM Plex Mono" font-size="10" letter-spacing="1.4" fill="#9a9690">ASSUMPTIONS</text>
    <g font-family="IBM Plex Sans" font-size="11.5" fill="#43434a">
      <text x="20" y="42">• AWS list price (us-east-1), 2026 estimate · 1-yr reserved compute · gp3 storage · CloudWatch + 1× log aggregator</text>
      <text x="20" y="60">• KMS = customer-managed key + ~10k audit-sign requests/mo for small prod · backups = 30-day PITR + 90-day cold</text>
    </g>
  </g>
</svg>

<figcaption><strong>V17 — v1 deployment — monthly cost stack.</strong> Order-of-magnitude monthly cost for a v1 deployment at three scales. The shape of the stack matters more than the absolute numbers — managed Postgres dominates as soon as you leave dev, and observability (logs + metrics retention) overtakes compute by mid-prod. Atlassian seats are shown for budgetary context only; they are not an atl-mcp cost. Re-run the worksheet in `cost-model.md` with your cloud's pricing — the percentages will hold. (See <a href="../../visualizations/v17-cost-stack.html">full visualization page</a>.)</figcaption>
</figure>


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
