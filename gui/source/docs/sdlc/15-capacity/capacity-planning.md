---
title: Capacity Planning
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, operator, executive]
sdlc_category: 15-capacity
related: [docs/sdlc/15-capacity/current-limits.md, docs/sdlc/03-requirements/nfr-scalability.md]
---

# Capacity Planning

> **TL;DR:** When does v1's single-process single-Postgres design become insufficient? Triggers documented per resource. Scale-up patterns: vertical (more CPU/RAM/disk), then queue-worker count, then DB sizing. v2 (post-v1) when triggers compound: multi-tenant + multi-replica. Numbers are designed-for; benchmarks ([`benchmarks.md`](benchmarks.md)) refine when they land.

Capacity planning is the question "how do we know when to scale, and what do we scale?" The answer for v1: most things scale vertically; some have natural fan-out points.

---

## What we're planning for

Three capacity dimensions:

1. **Concurrent sessions** — how many MCP clients are live at once.
2. **Active projects** — how many projects the orchestrator is managing simultaneously.
3. **Workload velocity** — how many tool calls / jobs / webhooks per unit time.

Each has different bottlenecks, different scale patterns, different failure modes.

## Bottleneck inventory

### CPU

- **Single-process Node:** event-loop bound. Sampling calls + ADF rendering are CPU-heavy at the right scale.
- **Bottleneck signal:** `nodejs_eventloop_lag_seconds` p99 > 100 ms sustained.
- **Scale: vertical first** (more vCPU). Single replica until multi-tenant.
- **Limit:** practical cap ~4-8 vCPU for a Node process; beyond that, fan out to workers.

### Memory

- **Resident set:** 512 MB baseline; up to 1 GB during context-pack generation.
- **Bottleneck signal:** `process_resident_memory_bytes` approaching `--max-old-space-size`.
- **Scale: vertical** (more RAM + raise `--max-old-space-size`).
- **Limit:** when workloads consistently exceed 4 GB, there's an architectural issue (memory leak, large in-memory caches, oversized context packs).

### Disk

- **Logs + audit chain + Postgres data + audit keypair file.**
- **Bottleneck signal:** disk usage above 70%.
- **Scale: vertical** (more disk). Audit chain grows monotonically — plan for that.
- **Predictable growth:** ~1 GB/month per 100 active projects (rough estimate, refines with data).

### Network

- **Outbound to Atlassian / Bitbucket / UIO.**
- **Bottleneck signal:** sustained near-bandwidth saturation (rare at v1 scale).
- **Inbound: webhook bursts.**
- **Scale: vertical** + edge-rate-limit if abused.

### Postgres

- **Connection pool.** Default 10. Scale: raise pool + Postgres `max_connections`.
- **CPU / IOPS.** Scale: vertical.
- **Storage.** Scale: provision more disk; partition / archive when extreme.
- **Bottleneck signal:** `db_query_duration_seconds` p99 climbing; pool exhaustion.

### BullMQ queue (when wired)

- **Queue depth.** Scale: more workers.
- **Worker concurrency.** Scale: vertical first (worker concurrency setting), then horizontal (more worker processes).
- **Redis memory.** Scale: vertical.

### Atlassian / Bitbucket rate limits

- **External cap:** Atlassian has site-wide API limits; we don't control these.
- **Bottleneck signal:** 429 spike rate.
- **Scale: cache more aggressively (preflight TTL); reduce discovery frequency.**

## Scale-up triggers

When does capacity-planning become urgent?

### Trigger 1: SLO breach due to capacity

If MCP tool latency or session-init success rate breaches SLO AND the cause is capacity (not a bug):

- p99 latency: investigate what's slow; scale up the relevant resource.
- session-init failure rate: check session cap; raise if appropriate.

### Trigger 2: Workload velocity exceeds design

If sustained tool-call rate exceeds 50/s (the v1 design point):

- Consider whether the workload is legitimate or a bug.
- If legitimate: vertical scale; consider whether fan-out is needed.

### Trigger 3: Projects-per-instance exceeds 100

If active projects approach or exceed 100:

- Storage size; might need partitioning of audit chain / large tables.
- Provisioning queue load; might need more workers.
- Memory pressure from cached profiles; verify cache hygiene.

### Trigger 4: Multi-tenant pressure

If customer count > 1, that triggers v2. Single-tenant design doesn't have a graceful path past 1 customer.

This is the biggest re-architecture trigger. v6 §7.3 documents the runway.

## Scale-up patterns

### Pattern: vertical scale

Most v1 capacity issues solve here:

1. Identify the bottleneck (CPU, RAM, disk, DB).
2. Provision more of that resource.
3. Restart with new sizing.
4. Verify the bottleneck signal recovered.

Cost: linear in resource. No code changes.

### Pattern: more workers

For queue-bound workloads:

1. Increase BullMQ worker concurrency setting.
2. OR run multiple worker processes (still single-replica orchestrator + multiple worker procs).
3. Verify queue lag recovers.

### Pattern: cache more

For provider-call-bound workloads:

1. Raise preflight cache TTL.
2. Cache ACL decisions longer (with refresh on permission webhooks).
3. Verify upstream call rate drops.

### Pattern: split provisioning plans

For long-running provisioning:

1. If a single plan exceeds `PROVISION_JOB_TIMEOUT_MS`: split into smaller plans.
2. The orchestrator already supports idempotent re-runs; partial completion is fine.

## What forces v2

The triggers that mean "v1 isn't enough":

- Customer count > 1 → multi-tenant (mandatory).
- Sustained workload > 5x v1 design → architectural review.
- Single-instance unavailability becomes customer-impacting → HA required.
- Cross-region latency requirements → regional deployments.

Any of these triggers an architecture conversation. Don't band-aid past them.

## Estimating before benchmarks

Without real benchmark data, capacity planning is rough sizing. Methodology:

1. **Identify the workload class** (MCP tool calls / provisioning jobs / webhook deliveries).
2. **Estimate per-unit cost** from the architecture (e.g., a tool call = 1 DB read + N provider calls + 1 audit write).
3. **Multiply by expected rate.**
4. **Add 50-100% headroom.**
5. **Sanity-check against host capacity.**

Once benchmarks land in [`benchmarks.md`](benchmarks.md), replace estimates with measured values.

## Cost implications

Capacity scales with cost. See [`../16-cost/cost-model.md`](../16-cost/cost-model.md) for the cost model. Key relationships:

- 2x vCPU ≈ 2x cost.
- 2x memory ≈ 1.5x cost.
- 2x storage ≈ 2x cost.
- 2x sampling rate ≈ 2x LLM provider cost (often the dominant variable).

Capacity plans factor cost; the cheapest scaling path isn't always the right one (e.g., adding cache reduces upstream calls AND saves cost).

## Linked artifacts

- **Sibling:** [`current-limits.md`](current-limits.md), [`benchmarks.md`](benchmarks.md), [`load-test-runbook.md`](load-test-runbook.md)
- **NFR:** [`../03-requirements/nfr-scalability.md`](../03-requirements/nfr-scalability.md), [`../03-requirements/nfr-performance.md`](../03-requirements/nfr-performance.md)
- **SLO:** [`../08-operations/slo-sli.md`](../08-operations/slo-sli.md)
- **Cost:** [`../16-cost/`](../16-cost/)
- **Spec:** v6 §7.3 (multi-tenant runway), §22.1 (transport)

---

*Last reviewed: 2026-04-25 by Chris.*
