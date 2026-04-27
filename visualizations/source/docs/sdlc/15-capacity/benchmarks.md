---
title: Benchmarks
owner: Chris
status: draft (no real benchmarks yet; framework only)
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, operator]
sdlc_category: 15-capacity
related: [docs/sdlc/07-testing/perf-plan.md, docs/sdlc/15-capacity/load-test-runbook.md]
---

# Benchmarks

> **TL;DR:** No real benchmark runs exist yet. This doc is the framework for when they happen. Each benchmark: workload, environment, target, result. Results archived per run; comparison across runs detects regressions. Numbers in the NFR + capacity docs ([`../03-requirements/nfr-performance.md`](../03-requirements/nfr-performance.md), [`current-limits.md`](current-limits.md)) are aspirational until this fills out.

The discipline: a benchmark exists only when it has been run. Aspirational targets are documented elsewhere as targets, not benchmarks.

---

## Status

| Benchmark | Status | Last run | Result |
|---|---|---|---|
| Latency: `health_check` | Not run | — | — |
| Latency: `project_preflight_check` (Jira) | Not run | — | — |
| Latency: `project_intake_create` | Not run | — | — |
| Latency: `project_blueprint_generate` | Not run | — | — |
| Throughput: audit chain writes | Not run | — | — |
| Throughput: MCP tool calls | Not run | — | — |
| Concurrency: 1000 concurrent MCP sessions | Not run | — | — |
| Memory: 24-hour soak | Not run | — | — |
| Storage: audit chain growth rate | Not run | — | — |

(Each row gets populated when the benchmark is actually run.)

## Benchmark structure

For each benchmark in [`../07-testing/perf-plan.md`](../07-testing/perf-plan.md):

### Workload

The exact load shape — concurrency, rate, payload size, duration, ramp-up.

### Environment

Where it ran — staging or DR-only env; host specs; DB version; external systems used.

### Target

Pass criteria — p50, p99, throughput, error rate, resource ceilings.

### Result

What was measured — actual p50, actual p99, etc. Plus any anomalies observed.

### Archive

Where the result file lives — typically `perf/results/<benchmark>-<UTC-ts>.json`.

## Per-benchmark detail (example template)

When a benchmark is run, replace the placeholder below with the actual result:

### Latency: `project_preflight_check` (Jira)

- **Last run:** YYYY-MM-DDTHH:MM:SSZ
- **Workload:**
  - Operation: `project_preflight_check` against Jira project with 200 issue types.
  - Concurrency: 10 simultaneous MCP sessions.
  - Rate: 1 call per session per second.
  - Duration: 10 minutes.
  - Ramp-up: linear, 60 sec.
- **Environment:**
  - System under test: atl-mcp v0.X.Y on staging.
  - Host: 2 vCPU, 2 GB RAM.
  - Atlassian: sandbox site with seed data.
- **Target:**
  - p50 < 1 s.
  - p99 < 5 s.
  - 0 errors.
- **Result:**
  - Actual p50: TBD.
  - Actual p99: TBD.
  - Errors: TBD.
- **Archive:** `perf/results/preflight-jira-YYYYMMDD.json`.

(This template is repeated for each benchmark in the plan.)

## Comparison across runs

When a benchmark has been run more than once:

| Run | p50 | p99 | Errors | Notes |
|---|---|---|---|---|
| 2026-04-15 | — | — | — | Baseline (when established) |
| 2026-04-22 | — | — | — | After PCO-XX optimization |
| 2026-04-29 | — | — | — | Regression — see investigation |

Comparison surfaces regressions; gaps between runs surface needs for new benchmarks.

## Regression policy

- **p99 latency drift > 20%:** investigate.
- **Throughput drop > 10%:** investigate.
- **Resource ceiling change (memory growth):** investigate.

"Investigate" doesn't mean "fail the release" — sometimes drift is genuine improvement cost (e.g., a new feature added work). The investigation determines whether to accept or fix.

## Why this doc exists despite being empty

Documenting the framework is the precursor to running the benchmarks. Without the framework:

- It's unclear what to measure.
- Results aren't comparable across runs.
- Investments in benchmark infrastructure don't have a target.

The framework is the artifact today. The actual numbers fill in over time.

## When benchmarks become required

- **At v0.1 release** (M6a ships): baseline benchmarks for the major tools.
- **At each minor release:** re-run baselines; compare; flag regressions.
- **At suspected regression:** ad-hoc runs to bisect.
- **At capacity-planning review:** quarterly.

## Linked artifacts

- **Plan:** [`../07-testing/perf-plan.md`](../07-testing/perf-plan.md)
- **Sibling:** [`current-limits.md`](current-limits.md), [`capacity-planning.md`](capacity-planning.md), [`load-test-runbook.md`](load-test-runbook.md)
- **NFRs:** [`../03-requirements/nfr-performance.md`](../03-requirements/nfr-performance.md)
- **SLOs:** [`../08-operations/slo-sli.md`](../08-operations/slo-sli.md)

---

*Last reviewed: 2026-04-25 by Chris.*
