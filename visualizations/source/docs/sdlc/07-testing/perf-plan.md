---
title: Performance Test Plan
owner: Chris
status: draft (planned for M11)
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, operator]
sdlc_category: 07-testing
related: [docs/sdlc/03-requirements/nfr-performance.md, docs/sdlc/15-capacity/, docs/sdlc/templates/perf-test-template.md]
---

# Performance Test Plan

> **TL;DR:** Workloads + targets per NFR-performance. v1 has no benchmark runs yet; this plan is the framework for when we do. Per-test docs follow [`../templates/perf-test-template.md`](../templates/perf-test-template.md). Results archived per test.

The perf plan is a framework, not yet a benchmark history. Numbers in [`../03-requirements/nfr-performance.md`](../03-requirements/nfr-performance.md) are aspirational; this plan describes how to test them.

---

## Test categories

### Latency tests

For each MCP tool + mgmt endpoint with a target in [`../03-requirements/nfr-performance.md`](../03-requirements/nfr-performance.md):

- Single-call latency under no load.
- Single-call latency under typical concurrency.
- p50 / p99 / p99.9 measurement.

### Throughput tests

- MCP tool calls per second sustained.
- Provisioning jobs per minute.
- Webhook delivery rate.

### Concurrency tests

- 1000 concurrent MCP sessions (the documented cap).
- Concurrent provisioning jobs (race conditions).
- Concurrent webhook deliveries.

### Stress tests

- Beyond the documented cap (graceful degradation).
- Pathological payloads.
- Slow upstream (Atlassian at p99 latency floor).

### Long-running

- 24-hour soak: small but constant load; observe memory creep, log growth, audit chain growth.

## Sample test definitions

### Perf-1: `project_preflight_check` against typical Jira project

Per [`../templates/perf-test-template.md`](../templates/perf-test-template.md):

- **Goal:** measure p50 / p99 latency.
- **Workload:** 10 concurrent sessions, 1 call/session/sec, 10 minutes, payload = Jira project with 200 issue types.
- **Success:** p50 < 1 s, p99 < 5 s, no errors.
- **Environment:** staging.

### Perf-2: Audit chain throughput

- **Goal:** sustained audit-write rate.
- **Workload:** 100 audit-emit/sec sustained, 5 minutes.
- **Success:** all entries persisted + signed; chain integrity intact.

### Perf-3: 1000 concurrent MCP sessions

- **Goal:** behavior at the cap.
- **Workload:** ramp up 1000 sessions over 60 sec; hold for 5 min; drop.
- **Success:** all sessions established; capability negotiation < 200 ms p99; no OOM.

### Perf-4: 24-hour soak

- **Goal:** memory leaks, log growth, audit chain growth.
- **Workload:** 5 sessions, 1 tool call / session / 30 sec, 24 hours.
- **Success:** memory stable; logs rotated within retention; chain growth predictable.

## Test environment

- **Local:** for quick spot-checks; not for committed numbers.
- **Staging:** for committed numbers; closest to prod shape.
- **Pre-prod (when exists):** for canary perf comparisons.

Never run perf tests against production traffic.

## Result archive

Results stored at:

- Path: `perf/results/<test-name>-<UTC-ts>.json`.
- Retention: keep last 12 runs per test; older archived.
- Comparison: across runs to detect regressions.

A perf test that's run once and discarded isn't a perf test. The archive is the artifact.

## Regression detection

When perf tests run on each release:

- Compare current run vs. last 3 runs.
- Flag if p99 latency drifted > 20%.
- Flag if throughput dropped > 10%.
- Flag if memory or FD count grew significantly.

Drift triggers investigation, not necessarily a fail. (Some drift is genuine improvement / new feature cost.)

## What's NOT in scope (v1)

- **Continuous perf testing in CI.** Adds CI time; not warranted at v1 scale.
- **Per-PR perf gates.** Out of scope; release-time only.
- **Real production load testing.** Out — single-tenant; not at customer scale.

## Status

- **Plan exists:** yes (this doc).
- **Harness:** planned (M11).
- **Workloads checked in:** planned (M11).
- **Baseline runs:** not yet.
- **Regressions detected:** n/a.

The honest state: v1 has aspirational numbers in NFR docs and this plan as framework. Real benchmarks land in M11 + ongoing.

## Linked artifacts

- **Template:** [`../templates/perf-test-template.md`](../templates/perf-test-template.md)
- **NFRs:** [`../03-requirements/nfr-performance.md`](../03-requirements/nfr-performance.md)
- **Capacity:** [`../15-capacity/`](../15-capacity/)
- **SLOs:** [`../08-operations/slo-sli.md`](../08-operations/slo-sli.md)
- **Sibling:** [`strategy.md`](strategy.md), [`e2e-plan.md`](e2e-plan.md)

---

*Last reviewed: 2026-04-25 by Chris.*
