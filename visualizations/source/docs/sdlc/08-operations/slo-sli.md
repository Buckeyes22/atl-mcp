---
title: SLOs and SLIs
owner: Chris
status: accepted (aspirational for v1)
last_reviewed: 2026-04-25
version: 1.0.0
audience: [operator, engineer, executive]
sdlc_category: 08-operations
related: [agent-context-orchestrator-mcp-plan-v6.md §27.6, docs/sdlc/08-operations/runbook.md, docs/sdlc/08-operations/alerting.md]
---

# Service Level Objectives + Indicators

> **TL;DR:** Aspirational SLOs for v1. Numbers below are targets, not contractual commitments. Measured via Prometheus counters (v6 §27) on the mgmt `/metrics` endpoint and traces in Langfuse. Error-budget policy is informal in v1; revisit when there's actual operational history.

The doc is honest: v1 has no production traffic at scale and limited operational history. The values below are targets we'd want to hold — they shape monitoring, alerting, and capacity planning. Refine with measured data once the project has it.

---

## Service definition

For SLO purposes, "the service" is:

- The MCP transport (port 3000) accepting build-agent requests.
- The mgmt REST API (port 3001) for operators.
- The provisioning queue.
- The audit chain.

External dependencies (Atlassian, Bitbucket, UIO) are out of our SLO scope; their availability is theirs. We commit to bounded *behavior* when they're degraded — see error-budget policy below.

---

## SLO summary

| SLO | Target | Window | Consequence on miss |
|---|---|---|---|
| MCP session establishment success | ≥ 99% | rolling 7 days | P1 review; investigate session-init failures |
| MCP tool call latency p99 | ≤ 2,000 ms | rolling 7 days | P1 review |
| MCP tool call latency p50 | ≤ 200 ms | rolling 7 days | P2; capacity / planner work |
| Mgmt REST `/healthz` availability | ≥ 99.9% | rolling 30 days | P1 if breached |
| Audit chain integrity (verifier passes) | 100% | always | P0 — never miss this |
| Audit chain freshness (last verified within) | ≤ 5 min | always | P1 |
| Provisioning queue lag (job enqueue → start) | p99 ≤ 30 s | rolling 7 days | P2 |
| Provider call success (post-retry) | ≥ 99% | rolling 24 hr (excluding upstream outages) | P1 |
| Lint-of-truth: no stdout writes | 100% | always | P0 in CI; never deploy if violated |

These targets are **aspirational** for v1. Measured baselines are recorded in [`../15-capacity/benchmarks.md`](../15-capacity/benchmarks.md) once data exists.

---

## SLI definitions

Each SLI is computed from a Prometheus counter exposed at `/metrics`. v6 §27.2 specifies the counter shapes.

### SLI: MCP session establishment success rate

```
sli = sum(rate(mcp_session_init_success_total[7d]))
    / sum(rate(mcp_session_init_total[7d]))
```

**Counter:** `mcp_session_init_total{outcome="success|failure"}` (label by outcome).

**Excludes:** sessions where the client closed before completing capability negotiation (counted as `outcome="client_close"`, which is neither success nor failure).

### SLI: MCP tool call latency

```
sli_p50 = histogram_quantile(0.50, mcp_tool_call_duration_seconds_bucket[7d])
sli_p99 = histogram_quantile(0.99, mcp_tool_call_duration_seconds_bucket[7d])
```

**Histogram:** `mcp_tool_call_duration_seconds_bucket{tool=...}` with standard latency buckets (5ms, 10ms, ..., 30s).

**Excludes:** tool calls that error early due to client-side issues (validation failures with deterministic latency); these are tracked in `mcp_tool_call_failures_total` separately.

### SLI: Mgmt REST availability

```
sli = sum(rate(mgmt_request_total{path="/healthz",code=~"2.."}[30d]))
    / sum(rate(mgmt_request_total{path="/healthz"}[30d]))
```

**Counter:** `mgmt_request_total{path,method,code}` exposing standard HTTP attributes.

**Excludes:** requests during deployment windows (≤ 30 s downtime per release).

### SLI: Audit chain integrity

Two derived signals:

- **Pass-rate:** every chain verification run passes (offline verifier, scheduled or on-demand). Tracked as a binary "pass / fail" event, not a continuous percentage.
- **Freshness:** `audit_chain_last_verified_unix` is exposed at `/admin/health/audit`. Alert if `now - audit_chain_last_verified_unix > 5 min` (assuming the verifier runs every 5 min in M11).

### SLI: Provider call success

```
sli = sum(rate(provider_call_total{outcome="success"}[24h]))
    / sum(rate(provider_call_total{outcome=~"success|failure"}[24h]))
```

**Counter:** `provider_call_total{provider="atlassian|bitbucket",method,outcome}`. Outcome includes `success`, `failure`, `upstream_outage` (for explicit upstream-down cases). The numerator excludes `upstream_outage` from both the success-count and the denominator (we don't penalize ourselves for Atlassian outages).

### SLI: Provisioning queue lag

```
sli_p99 = histogram_quantile(0.99, provision_queue_lag_seconds_bucket[7d])
```

**Histogram:** `provision_queue_lag_seconds_bucket` measured as `(job.startedAt - job.enqueuedAt)`.

---

## Error-budget policy

For v1: **informal**. The single maintainer + low traffic mean a formal error-budget policy isn't operationally meaningful. The discipline:

- If an SLO is breached, the next development cycle prioritizes the cause over new features.
- If an SLO is breached three weeks running, halt feature work until back to target.
- If an SLO is breached four weeks running, revisit the SLO — either it's wrong or the design is wrong.

When v2 / multi-tenant lands, formalize the error-budget policy with explicit consume-vs-reset semantics.

---

## Why these specific numbers

**99% MCP session success.** Slightly aggressive for a v1; grants ~7 hours/month of breach. The session-init path is mostly local (capability negotiation); failures here usually indicate a real bug.

**2 s p99 tool call latency.** Bounded by the slowest tool (preflight against Atlassian). If a tool routinely takes longer, it should be async (jobified) rather than synchronous over MCP.

**99.9% mgmt REST availability.** Only `/healthz` because it's the only endpoint with synthetic monitoring. Other endpoints' availability is captured by SLI but not SLO.

**100% audit-chain integrity.** Non-negotiable. Any failure is a security incident, not a SRE incident.

**5 min audit-chain freshness.** Comfortable for offline verification cadence; tight enough that prolonged tampering is detected within a window short enough for forensics.

**99% provider call success.** Excludes upstream outages — when Atlassian is fully down, we don't count it. Captures our own bugs (auth handling, retry config) without penalizing the vendor.

---

## Reporting

For v1, SLO reporting is on-demand via `/metrics` queries. Post-v1, automated dashboards in Grafana — see [`monitoring.md`](monitoring.md).

## Linked artifacts

- **Spec:** v6 §27.6 (SLOs)
- **Sibling docs:** [`monitoring.md`](monitoring.md), [`alerting.md`](alerting.md), [`runbook.md`](runbook.md)
- **Capacity:** [`../15-capacity/benchmarks.md`](../15-capacity/benchmarks.md)
- **Code:** counter definitions in `src/observability/` (when implemented per v6 §27.2)
- **Test plans:** [`../07-testing/perf-plan.md`](../07-testing/perf-plan.md)

---

*Last reviewed: 2026-04-25 by Chris.*
