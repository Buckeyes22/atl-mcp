---
title: NFR — Availability
owner: Chris
status: accepted (aspirational for v1)
last_reviewed: 2026-04-25
version: 1.0.0
audience: [executive, operator, engineer]
sdlc_category: 03-requirements
related: [docs/sdlc/08-operations/slo-sli.md, docs/sdlc/10-dr-bcp/recovery-objectives.md, docs/sdlc/03-requirements/nfr-performance.md]
---

# Non-Functional Requirements — Availability

> **TL;DR:** Aspirational v1 targets — 99.5% MCP transport uptime monthly, 99.9% mgmt API `/healthz` uptime monthly, MTTR < 30 min for P1, MTTR < 5 min for P0 detection. Audit chain availability is on-disk persistent (no separate target). Single-tenant single-process — no built-in HA. Targets are calibrated to single-tenant single-maintainer ops; multi-tenant v2 will tighten.

NFRs that depend on operational history are **aspirational** in v1; revisit with measured data once available. The targets shape monitoring + alerting + capacity planning today.

---

## Targets (aspirational)

| Metric | Target | Measurement | Monthly budget |
|---|---|---|---|
| MCP transport uptime | ≥ 99.5% / month | `mcp_session_init_total` minus failures + planned-maintenance windows | ~3.6 hours unplanned |
| Mgmt API `/healthz` uptime | ≥ 99.9% / month | Synthetic poll from operator location | ~43 minutes unplanned |
| MTTR for P0 detection | < 5 min to acknowledge | Per-incident measurement | per-incident |
| MTTR for P1 detection | < 30 min to acknowledge | Per-incident measurement | per-incident |
| MTTR for P0 incidents (full recovery) | < 4 hours | Per-incident measurement | per-incident |
| Planned maintenance | ≤ 4 hours per quarter | Pre-announced; recorded in change log | ~1.3h per month |

Targets are calibrated to single-tenant single-maintainer ops. Multi-tenant v2 will tighten.

The 99.5% / 99.9% choice (transport vs. mgmt):
- **Transport** is broader surface; more failure modes (provider issues, capacity hits, etc.). 99.5% is realistic.
- **Mgmt API** is narrower (loopback, simple endpoints). 99.9% is reasonable since "down" almost always means the whole process is down.

---

## What "available" means

- **Transport available** means an MCP client can complete capability negotiation and issue at least one tool call within the SLO latency budget. (Latency is per [`nfr-performance.md`](nfr-performance.md); availability is whether the transport accepts traffic at all.)
- **Mgmt API available** means `/healthz` returns 200 within ≤ 500 ms.
- **Storage available** is implicit in transport availability (failed DB → failed transport → counted as down).
- **Audit chain available** means writes succeed; reads (verifier) succeed. This is non-negotiable per v6 §30.1; if the audit chain can't accept a write, the calling operation fails closed (and that fail-closed is itself counted toward downtime).

A "degraded but functional" state (e.g., one provider down but MCP still responds) is partial-down per the SLO. The exact accounting depends on the operation:
- If the degraded state affects > 30% of traffic: counted as down.
- Otherwise: counted as a degradation but not down.

---

## What's deliberately NOT highly-available in v1

- **Single replica.** No hot standby. The container can be restarted by the deploy platform; that's a brief outage.
- **Single Postgres instance.** No replicas or read replicas. Postgres outage = full orchestrator outage.
- **Single audit signing key.** No HSM cluster, no multi-key signing.
- **Single deployment region.** No cross-region active-active.
- **No automatic failover.** Manual cold-restore per [`../10-dr-bcp/failover.md`](../10-dr-bcp/failover.md).

This is intentional. v1's complexity budget is focused on the orchestration core; HA is post-v1 multi-tenant work (v6 §7.3). Customers requiring 99.95%+ availability are not v1's target; they're post-v1.

---

## Failure budget

For 99.5% monthly uptime: ~3.6 hours of unplanned downtime per 30 days. Plus ~1.3h/month average planned maintenance.

A typical month, then: ~5 hours of unavailability acceptable. If consumed faster: development cycle prioritizes the cause.

For 99.9% mgmt API: ~43 minutes per month. Tighter because `/healthz` is a small surface — failing means the process is fundamentally broken, not "this one feature is down."

### What if the budget is consumed faster?

- **One miss in a quarter:** investigate; document; carry on.
- **Two misses in a quarter:** development cycle prioritizes root-cause work over new features.
- **Three misses:** halt feature work until back to target. Either the targets are wrong or the design needs a refactor.

This isn't a contract; it's an operational discipline. v1 single-maintainer means the discipline is self-imposed.

---

## Dependencies that affect availability

| Dependency | Impact when down |
|---|---|
| Postgres | All read + write operations fail; transport degrades immediately |
| Atlassian Cloud | Provisioning operations fail; reads from cached profile still work |
| Bitbucket Cloud | VCS provisioning fails |
| Audit chain key registry git ref | Cannot rotate keys; existing signing continues; new entries possible if active key resolves |
| Secret manager | Restart blocks until recovered |
| Network egress | Provider calls fail |
| LLM sampling provider (M4+) | Blueprint generation fails; readiness verdict degrades |

Dependency outages aren't counted against the orchestrator's uptime SLO directly — see [`../08-operations/slo-sli.md`](../08-operations/slo-sli.md) for the carve-out logic. We don't penalize ourselves for Atlassian outages; we DO count failed responses to clients (the client doesn't care whose fault it is).

---

## Maintenance windows

For v1: ad-hoc, announced when needed. Operator notifies stakeholders in advance (typical: 24-48 hours before scheduled maintenance).

Post-v1: quarterly maintenance windows announced 14 days prior; affecting ≤ 1 hour of customer-visible service.

Maintenance counts against the planned budget, not the unplanned budget. A 30-minute migration window is fine; a 30-minute crash is in the unplanned bucket.

---

## How we measure

### Synthetic monitoring

For mgmt `/healthz`: ideally an external poller hits the endpoint at a regular interval (every 1 min). Each failure (non-200 response) counts toward downtime.

For v1 single-maintainer: synthetic monitoring is light-weight (a cron job + alert; no fancy uptime-monitoring service required). Post-v1: integrate with a third-party uptime service.

### Production traffic-derived

For MCP transport: derive availability from `mcp_session_init_total{outcome="failure"}` rate vs. `outcome="success"`.

A spike in failures = degraded availability. A complete absence of `outcome="success"` for > 1 min = "down."

### Per-incident records

Major incidents (SEV-1 / SEV-2) get explicit downtime accounting in their postmortem. Manually summed at month-end.

---

## What can break availability

Per [`../14-incidents/failure-mode-taxonomy.md`](../14-incidents/failure-mode-taxonomy.md):

- **Protocol invariant violation** (Incident A class) — clients drop; tooling-encoded invariant is the prevention.
- **Schema drift** (Incident B class) — DB writes fail; rehearsal is the prevention.
- **Capacity exhaustion** — resource cap hit; vertical scale + monitoring is the prevention.
- **Dependency drift** — vendor changes break; integration tests + bounded retries are the prevention.
- **Auth lifecycle** — token expiration breaks calls; documented rotations are the prevention.

Each class has a corresponding alert + runbook entry.

---

## Recovery objectives

Distinct from SLOs (which are running-state availability), recovery objectives ([`../10-dr-bcp/recovery-objectives.md`](../10-dr-bcp/recovery-objectives.md)) cover post-incident:

- **RTO 4 hours** — maximum acceptable time to restore service after a major incident.
- **RPO 5 minutes** — maximum acceptable data loss measured in time.
- **Audit chain RPO** — informally 0; the chain is integrity-critical.

These are aspirational v1 targets pending DR drill measurements.

---

## Linked artifacts

- **Sibling NFRs:** [`nfr-performance.md`](nfr-performance.md), [`nfr-security.md`](nfr-security.md), [`nfr-scalability.md`](nfr-scalability.md)
- **SLO definitions:** [`../08-operations/slo-sli.md`](../08-operations/slo-sli.md)
- **Recovery objectives:** [`../10-dr-bcp/recovery-objectives.md`](../10-dr-bcp/recovery-objectives.md)
- **Failure modes:** [`../14-incidents/failure-mode-taxonomy.md`](../14-incidents/failure-mode-taxonomy.md)
- **Multi-tenant runway:** v6 §7.3
- **Spec:** v6 §27.6 (SLO targets)
- **Compliance scope:** [`compliance-scope.md`](compliance-scope.md)

---

*Last reviewed: 2026-04-25 by Chris.*
