---
title: NFR — Performance
owner: Chris
status: accepted (aspirational for v1)
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, operator]
sdlc_category: 03-requirements
related: [docs/sdlc/08-operations/slo-sli.md, docs/sdlc/15-capacity/]
---

# Non-Functional Requirements — Performance

> **TL;DR:** Aspirational targets — p50 MCP tool call < 200 ms, p99 < 2 s. Provisioning queue lag p99 < 30 s. Memory baseline 512 MB, peaks to 1 GB during context-pack generation. Throughput sufficient for 100+ active projects per single-tenant instance. Numbers are pre-benchmark estimates; refine when [`../15-capacity/benchmarks.md`](../15-capacity/benchmarks.md) has real data.

Performance is aspirational at v1 because there's no production traffic at scale. The targets shape what to measure, not what to commit to.

---

## Latency targets

| Operation | p50 target | p99 target | Notes |
|---|---|---|---|
| MCP `health_check` | < 5 ms | < 50 ms | Local; DB-free |
| MCP capability negotiation | < 50 ms | < 200 ms | Per-session at start |
| MCP `project_preflight_check` (against Jira) | < 1 s | < 5 s | Network-bound |
| MCP `project_intake_create` | < 100 ms | < 500 ms | DB write |
| MCP `project_blueprint_generate` | < 5 s | < 30 s | Includes sampling latency |
| MCP `project_provision_preview` | < 500 ms | < 3 s | DB read; planning |
| MCP `project_provision_execute` (Jira plan) | < 30 s sync; full work async | < 60 s sync | Real time depends on plan size |
| MCP `context_pack_generate` | < 2 s | < 10 s | DB read + redaction |
| Mgmt `/healthz` | < 5 ms | < 50 ms | In-process |
| Mgmt `/readyz` | < 50 ms | < 200 ms | DB connectivity check |

The "sync" portion of `project_provision_execute` returns the job ID quickly; full execution is async. p99 < 60 s reflects the time to enqueue, not the time to provision a 50-issue plan.

## Throughput targets

| Workload | Target |
|---|---|
| MCP sessions concurrent | 1000 (per `MCP_HTTP_MAX_CONCURRENT_SESSIONS`) |
| MCP tool calls per second | 50/s sustained at single-process v1 |
| Provisioning jobs per minute | 10/min average; bursts to 60/min for plan execution |
| Audit entry append rate | 100/s sustained (matches DB write capacity) |
| Webhook delivery ingest | 100/s sustained |

These are "plausible v1" numbers. Real targets land in [`../15-capacity/`](../15-capacity/) once we benchmark.

## Resource utilization

| Resource | Baseline | Peak | Constraint |
|---|---|---|---|
| CPU | 0.5 vCPU | 2 vCPU during sampling | Single-process; no parallelism beyond Node concurrency |
| Memory | 512 MB | 1 GB during context-pack generation | Set node `--max-old-space-size` accordingly |
| Disk (logs + audit) | 10 GB initial | grows ~1 GB/month/active project | Log rotation + audit archive |
| Network | Modest (REST + MCP) | Spikes during webhook bursts | Per-host bandwidth |
| File descriptors | < 200 in steady state | spike during HTTP 1000-session test | OS ulimit ≥ 4096 |

## Behavior under load

Specified, not measured (yet):

- **Graceful degradation:** when concurrent sessions hit the cap, new sessions are rejected with a clear error (not silently queued or hanging).
- **Backpressure:** when the provisioning queue is saturated, new jobs return 503 Service Unavailable from the mgmt API.
- **Retry storms:** retry layer uses exponential backoff with jitter; one slow upstream doesn't cascade to a thundering herd.
- **Slow upstream:** when Atlassian / Bitbucket is slow (high p99 latency from them), the orchestrator's p99 drifts up but doesn't OOM.
- **Memory pressure:** GC kicks in before OOM; observed via `nodejs_eventloop_lag_seconds` spikes.

## Performance anti-goals

Things we deliberately don't optimize for in v1:

- **Microsecond-level latency.** Single-process Node + Postgres is not the right substrate for sub-millisecond critical paths.
- **Maximum concurrency.** 1000 sessions is plenty; pushing higher requires re-architecting.
- **Cold start.** Single-tenant; the orchestrator is long-running. We don't optimize for restart time.
- **Memory ultra-efficiency.** 1 GB peak is fine for this use case; no "fit in 64 MB" pressure.

## Measurement

All targets are measured via the counters in [`../08-operations/monitoring.md`](../08-operations/monitoring.md). Histograms expose p50 / p99 / p99.9 directly via Prometheus.

Performance test plan: [`../07-testing/perf-plan.md`](../07-testing/perf-plan.md). Each target should have a corresponding workload + success criterion in that plan.

## Linked artifacts

- **SLOs:** [`../08-operations/slo-sli.md`](../08-operations/slo-sli.md) — formalized into SLOs where applicable
- **Capacity:** [`../15-capacity/`](../15-capacity/) — operational thresholds + benchmarks
- **Test plan:** [`../07-testing/perf-plan.md`](../07-testing/perf-plan.md)
- **Sibling NFRs:** [`nfr-availability.md`](nfr-availability.md), [`nfr-security.md`](nfr-security.md), [`nfr-scalability.md`](nfr-scalability.md)
- **Spec:** v6 §22.1 (transport limits), §27 (observability)

---

*Last reviewed: 2026-04-25 by Chris.*
