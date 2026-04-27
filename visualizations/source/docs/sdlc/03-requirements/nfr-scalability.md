---
title: NFR — Scalability
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, executive]
sdlc_category: 03-requirements
related: [agent-context-orchestrator-mcp-plan-v6.md §7.3, docs/sdlc/15-capacity/]
---

# Non-Functional Requirements — Scalability

> **TL;DR:** v1 scales vertically — single instance, single Postgres. Designed limits: 1000 concurrent MCP sessions, 100+ active projects per instance, 10/min provisioning jobs sustained. Multi-tenant horizontal scale is post-v1 (v6 §7.3) and the runway is documented but not implemented. Single-tenant single-process is intentional for v1 simplicity.

The scalability story is honest: v1 isn't trying to be SaaS. The targets are bounded by what one process + one DB can sustain.

---

## Single-tenant v1 scalability targets

| Dimension | Target | Constraint |
|---|---|---|
| Concurrent MCP sessions | 1000 | `MCP_HTTP_MAX_CONCURRENT_SESSIONS` |
| Active projects per instance | 100+ | DB row count + memory for cached profiles |
| Concurrent provisioning jobs | 10 | BullMQ worker count (configurable) |
| Audit chain length | unbounded | Postgres row count + verifier walk time |
| Tool calls per second | 50/s sustained | CPU + DB |
| Webhook deliveries per second | 100/s sustained | DB write capacity |

Vertical scaling: when a target is approached, scale the host (more CPU, more memory, faster disk, more Postgres connections).

## Multi-tenant runway (post-v1)

v6 §7.3 documents the path to multi-tenant. Key design properties already in place:

- **Tenant scope is a domain concept.** Every storage row has tenant scope; `assertTenantMatches` is enforced.
- **Sessions can resolve to a tenant.** `resolveScope()` is the seam (currently returns the default single tenant).
- **Audit chain per-tenant** is the major refactor; current schema is single-key-registry single-chain.
- **Token storage per-tenant** requires envelope encryption with per-tenant master keys (PCO-57 prerequisite).

What multi-tenant adds:

- Per-tenant isolation guarantees in the threat model.
- Per-tenant SLO accounting.
- Per-tenant capacity limits.
- Per-tenant cost attribution.
- Multi-replica HA.

What v1 design choices preserve for multi-tenant:

- Domain types include tenant scope from M1.
- Storage repositories enforce tenant scope.
- Provider abstractions don't assume single-tenant.

What v1 doesn't preserve (must refactor for multi-tenant):

- Audit chain key registry is single-tenant.
- Token store master key is global.
- Some workflow caches assume process-global state.

## Scalability anti-goals (v1)

- **Multi-region active-active.** Out.
- **Horizontal scale beyond 1 process.** Out.
- **Multi-tenant isolation.** Documented runway, not implementation.
- **Geo-distributed audit chain.** Single registry git ref; one location.
- **Massive concurrency (10k+ sessions).** Out — would require architectural changes (load balancer, session affinity, shared session state).

## What forces a v2 scale-out

Triggers that mean "v1 isn't enough":

- Customer count > 1 (multi-tenant required).
- Concurrent sessions consistently > 800.
- Provisioning queue lag p99 > 60 s sustained.
- Postgres CPU > 70% sustained.
- Single-instance unavailability becomes customer-impacting.

When any of these is true, the conversation shifts from "tune v1" to "design v2."

## Capacity planning for v1

Detailed in [`../15-capacity/capacity-planning.md`](../15-capacity/capacity-planning.md). Briefly:

- Expected at one team / one project: low — < 10 sessions/day, < 100 audit entries/day.
- Expected at one team / many projects: medium — 100s of audit entries/day.
- Expected at multiple teams (still single tenant): higher load. v1 targets cover this.
- Expected at SaaS scale: not v1. Multi-tenant required.

## Sizing recommendations

For a v1 single-tenant production deploy:

| Component | Sizing |
|---|---|
| Application host | 1 vCPU, 1 GB RAM (baseline); 2 vCPU, 2 GB if active |
| Postgres | 1 vCPU, 2 GB RAM, 50 GB disk (start); grows with audit chain length |
| Network | Modest; bursty during webhook surge |
| Audit registry git host | Standard git host (GitHub / Bitbucket / self-hosted) |
| Secret manager | Cloud platform native |

These are starting points. [`../15-capacity/`](../15-capacity/) updates as benchmarks land.

## Linked artifacts

- **Spec:** v6 §7.3 (multi-tenant runway), §22.1 (transport limits)
- **Capacity planning:** [`../15-capacity/`](../15-capacity/)
- **Sibling NFRs:** [`nfr-availability.md`](nfr-availability.md), [`nfr-performance.md`](nfr-performance.md), [`nfr-security.md`](nfr-security.md)
- **Tracked tickets:** PCO-51 (per-tenant key isolation spike), PCO-57 (envelope encryption refactor)

---

*Last reviewed: 2026-04-25 by Chris.*
