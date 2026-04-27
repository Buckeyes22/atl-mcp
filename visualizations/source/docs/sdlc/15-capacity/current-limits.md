---
title: Current Capacity Limits
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, operator, executive]
sdlc_category: 15-capacity
related: [docs/sdlc/03-requirements/nfr-scalability.md, agent-context-orchestrator-mcp-plan-v6.md §22.1]
---

# Current Capacity Limits

> **TL;DR:** Documented limits at each layer for v1 single-tenant. Most limits are configurable; defaults reflect "comfortable v1" sizing. Numbers are designed-for, not benchmarked-for — until [`benchmarks.md`](benchmarks.md) has real data, treat these as sizing guidance.

A capacity limit is a deliberate ceiling that prevents some specific failure mode. This doc inventories them.

---

## MCP transport limits

### Concurrent sessions

- **Default:** 1000 (`MCP_HTTP_MAX_CONCURRENT_SESSIONS`).
- **What it bounds:** memory + file descriptors + DB connection holders.
- **Failure mode if exceeded:** new session attempts return a clear error (not silently queued or hung).
- **Source:** v6 §22.1, indxr F-051.
- **When to raise:** observed cap-hits in production; AND host can support more (memory/CPU available).

### Session TTL

- **Default:** 3600 seconds (1 hour) sliding (`MCP_HTTP_SESSION_TTL_SECONDS`).
- **What it bounds:** stale sessions consuming slots.
- **Failure mode if too short:** clients have to reconnect frequently; UX cost.
- **Failure mode if too long:** session table grows; DB pressure.
- **When to tune:** if observed reconnect rates are high (raise TTL); if session count grows unboundedly (lower TTL).

### SSE keep-alive

- **Default:** 25,000 ms (`MCP_HTTP_SSE_KEEP_ALIVE_MS`).
- **What it bounds:** intermediate proxies / firewalls timing out idle connections.
- **Failure mode if too long:** proxies drop the SSE stream; clients see broken sessions.
- **Failure mode if too short:** unnecessary keep-alive traffic.
- **Source:** indxr F-051; tuned to be just under common 30 s proxy timeout.

## Mgmt REST limits

### Bind

- **Default:** loopback (`MGMT_API_HOST=127.0.0.1`).
- **What it bounds:** attack surface.
- **Override:** allowed in dev; warning in non-dev tier; hard error in production tier.

### Concurrent requests

- **Default:** unbounded (the mgmt surface is read-only + small).
- **What it would bound:** DoS protection.
- **When to add a limit:** if mgmt API is bound non-loopback in some scenario.

## Storage limits

### Postgres connection pool

- **Default:** 10 connections (typical).
- **What it bounds:** DB-side concurrency.
- **Failure mode if exhausted:** new queries block until a connection frees; alert on `db_query_failure_rate`.
- **When to raise:** if pool exhaustion alert fires AND Postgres has headroom.

### Migration runner advisory lock

- **Default:** single advisory lock (no concurrent runners).
- **What it bounds:** prevents concurrent migrations from racing.
- **Failure mode if held by dead session:** migrations block; runbook entry covers diagnosis.

## Audit chain

### Chain length

- **Default:** unbounded.
- **What it implies:** DB row count grows monotonically (audit chain is never pruned).
- **Sizing:** a typical project produces 100-1000 audit entries during its lifetime. At 100 active projects, ~100k entries. At 100 chars per row average: ~10 MB / 100k rows. Plus indexes: ~30 MB. Negligible at v1 scale.

### Verifier walk time

- **Default:** O(N) in chain length.
- **At v1 scale:** < 10 s for 100k entries.
- **At post-v1 scale:** consider checkpoint/sample verification to avoid full walks.

## Provisioning queue (M6+)

### Queue depth

- **Default:** unbounded, alert at >100 deep.
- **What it bounds:** memory + Redis size; operational latency before jobs start.
- **Failure mode if growing unboundedly:** provisioning is overwhelmed; pause / scale workers.

### Worker count

- **Default:** 1 worker process (v1 single-replica).
- **What it bounds:** concurrency of long-running provisioning.
- **When to raise:** queue lag p99 > 30 s sustained.

### Job timeout

- **Default:** 300,000 ms (5 minutes) (`PROVISION_JOB_TIMEOUT_MS`).
- **What it bounds:** runaway jobs.
- **When to tune:** if legitimate jobs exceed; consider splitting plans.

## Tokens + secrets

### Token store size

- **Default:** unbounded, but realistically ≤ 100 rows for v1 (one per provider per workspace).
- **What it implies:** sealing/opening cost is constant per token; total memory negligible.

### Master key rotation cadence

- **Default:** at-will, not scheduled.
- **What it bounds:** the operational ceremony (each rotation requires the re-encrypt drill).
- **When to tune:** post-v1 when envelope encryption (PCO-57) lands; rotation becomes cheap.

## Webhook ingestion (M10+)

### Dedup table size

- **Default:** retained 30 days (per [`../05-data/retention.md`](../05-data/retention.md)).
- **What it bounds:** dedup window; growth bounded by retention.
- **Failure mode if pruning fails:** table grows; index gets slow; alert.

### Per-source rate

- **Default:** unbounded application-side.
- **What it bounds:** if rate-limiting at the application layer is desired (it isn't currently).
- **When to add:** if a source becomes a DoS vector. v1 deployment puts rate-limit at the network edge instead.

## Resource limits (host-level)

### Memory

- **Default node `--max-old-space-size`:** 1 GB.
- **Failure mode if exceeded:** OOM crash; alerting; deploy platform restarts.

### File descriptors

- **Default OS ulimit:** 4096 recommended.
- **What it bounds:** open connections + log files + audit keypair handle.
- **Failure mode if exceeded:** "too many open files" errors; alert + restart.

### Disk

- **Logs:** size-bounded by rotation (planned M11); manual rotation in v1.
- **Audit chain:** grows with chain length; ~10 MB / 100k entries.
- **Postgres:** grows with workload + audit retention.

## Aggregate "v1 sizing"

A v1 production deploy targets:

| Dimension | Target |
|---|---|
| Active MCP sessions | 100 typical, 1000 cap |
| Active projects | 100 |
| Audit entries / day | 1k typical, 10k peak |
| Provisioning jobs / day | 50 |
| Webhook deliveries / day | 1k |
| Memory baseline | 512 MB |
| Memory peak | 1 GB |
| Disk total | 50 GB |

These are starting points. [`capacity-planning.md`](capacity-planning.md) details the scale-up triggers.

## Linked artifacts

- **Spec:** v6 §22.1 (transport limits)
- **NFR scalability:** [`../03-requirements/nfr-scalability.md`](../03-requirements/nfr-scalability.md)
- **NFR performance:** [`../03-requirements/nfr-performance.md`](../03-requirements/nfr-performance.md)
- **Sibling:** [`capacity-planning.md`](capacity-planning.md), [`benchmarks.md`](benchmarks.md), [`load-test-runbook.md`](load-test-runbook.md)
- **SLO:** [`../08-operations/slo-sli.md`](../08-operations/slo-sli.md)
- **Cost:** [`../16-cost/cost-model.md`](../16-cost/cost-model.md)

---

*Last reviewed: 2026-04-25 by Chris.*
