---
title: Alerting
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [operator, engineer]
sdlc_category: 08-operations
related: [docs/sdlc/08-operations/monitoring.md, docs/sdlc/08-operations/runbook.md, docs/sdlc/08-operations/slo-sli.md]
---

# Alerting

> **TL;DR:** Each alert maps to a counter, a threshold, a severity, and a runbook entry. v1 uses Prometheus alertmanager when wired (post-v1). For now: alerts are specified here; firing relies on the deploy platform's alerting layer or manual checks. P0 = page now; P1 = within business hours; P2 = file ticket.

This is the alert specification. The mechanism (alertmanager / PagerDuty / Slack webhook) is platform-dependent.

---

## Alert priorities

| Priority | Response time | Channel | Examples |
|---|---|---|---|
| **P0 — page now** | < 5 min ack | Phone / SMS via primary on-call | Audit chain integrity failure; service down |
| **P1 — within business hours** | < 30 min ack | Slack / email; phone if no ack | Provider 401 spike; queue lag elevated |
| **P2 — file ticket** | within 1 day | Ticket queue (Jira PCO) | SLO trending toward miss |
| **info** | no SLA | Dashboard / log | Counters for situational awareness |

---

## Alert catalog

Each entry: name, condition, severity, runbook link, mitigation hint.

### Service health

#### `service_down`
- **Condition:** `up{job="atl-mcp"} == 0` for 1 min.
- **Severity:** P0.
- **Runbook:** [`runbook.md` § "MCP clients drop"](runbook.md#entry-mcp-clients-drop-within-100-ms-of-session-start) (broader scope: "service entirely unreachable").
- **Mitigation:** restart; if it doesn't come up, check logs for fatal errors.

#### `mgmt_health_unreachable`
- **Condition:** `mgmt_request_total{path="/healthz",code=~"5.."}` rate > 0.1/sec for 5 min.
- **Severity:** P0.
- **Runbook:** [`runbook.md`](runbook.md) — full process triage.
- **Mitigation:** triage with logs; check DB connectivity; check migration state.

### Audit chain (P0 only — never miss)

#### `audit_chain_signature_invalid`
- **Condition:** any verifier failure detected in last 5 min.
- **Severity:** P0.
- **Runbook:** [`runbook.md` § "Audit chain signature mismatch"](runbook.md#entry-audit-chain-signature-mismatch).
- **Mitigation:** **DO NOT** roll back; capture state; treat as security incident.

#### `audit_chain_stale`
- **Condition:** `time() - audit_chain_last_verified_timestamp > 600` (10 min).
- **Severity:** P0.
- **Runbook:** [`runbook.md` § "Audit chain signature mismatch"](runbook.md#entry-audit-chain-signature-mismatch) (verifier failure root-causing).
- **Mitigation:** trigger an offline verification run; check verifier process is alive.

#### `audit_emit_failure_rate`
- **Condition:** `audit_entries_appended_total{outcome="failure"}` rate > 0.01/sec.
- **Severity:** P1.
- **Runbook:** [`runbook.md`](runbook.md) — audit-write failure section.
- **Mitigation:** check key registry git ref reachability; check DB capacity.

### MCP transport

#### `mcp_session_failure_rate`
- **Condition:** `mcp_session_init_total{outcome="failure"}` rate / `mcp_session_init_total` rate > 0.05 (5%) for 5 min.
- **Severity:** P1.
- **Runbook:** [`runbook.md` § "MCP clients drop"](runbook.md#entry-mcp-clients-drop-within-100-ms-of-session-start).
- **Mitigation:** check stdout corruption; check capability negotiation logs.

#### `mcp_tool_call_p99_high`
- **Condition:** `histogram_quantile(0.99, mcp_tool_call_duration_seconds_bucket[5m]) > 5` (5 s).
- **Severity:** P2.
- **Runbook:** [`runbook.md`](runbook.md) — tool-specific entries.
- **Mitigation:** identify slow tool via label; investigate provider latency / queue lag.

### Providers (Atlassian / Bitbucket)

#### `provider_429_spike`
- **Condition:** `provider_retry_total{reason="429"}` rate > 0.1/sec for 5 min.
- **Severity:** P1.
- **Runbook:** [`runbook.md` § "Atlassian rate-limit exhaustion"](runbook.md#entry-atlassian-rate-limit-exhaustion-429).
- **Mitigation:** pause planner; raise preflight cache TTL.

#### `provider_401_spike`
- **Condition:** `provider_call_total{outcome="failure",code="401"}` rate > 0.05/sec for 5 min.
- **Severity:** P1.
- **Runbook:** [`runbook.md` § "Provider 401 spike"](runbook.md#entry-provider-401-spike).
- **Mitigation:** rotate credentials at source if expired; fall back from oauth3lo to api_token if PCO-59 race.

#### `provider_5xx_spike`
- **Condition:** `provider_call_total{outcome="failure",code=~"5.."}` rate > 0.1/sec for 10 min.
- **Severity:** P2.
- **Runbook:** [`runbook.md`](runbook.md) — provider section.
- **Mitigation:** Atlassian / Bitbucket status page; usually wait it out (retry layer handles).

### Queue / async

#### `provision_queue_lag_high`
- **Condition:** `histogram_quantile(0.99, provision_queue_lag_seconds_bucket[10m]) > 60` (60 s).
- **Severity:** P2.
- **Runbook:** [`runbook.md`](runbook.md) — new entry to add.
- **Mitigation:** check worker count; check DB capacity; check upstream rate limits.

#### `provision_jobs_failed`
- **Condition:** `provision_jobs_total{outcome="failure"}` rate > 0.01/sec for 30 min.
- **Severity:** P1.
- **Runbook:** [`runbook.md`](runbook.md) — provisioning section.
- **Mitigation:** identify failure cause via job state in DB.

### Storage

#### `db_query_failure_rate`
- **Condition:** `db_query_total{outcome="failure"}` rate > 0.01/sec for 5 min.
- **Severity:** P1.
- **Runbook:** [`runbook.md`](runbook.md) — DB connectivity / pool exhaustion.
- **Mitigation:** check connection pool; check DB CPU; check long-running queries.

#### `migration_runner_stuck`
- **Condition:** custom — `/admin/health/db` returns "migration applied but not recorded".
- **Severity:** P1.
- **Runbook:** [`runbook.md` § "Migration runner stuck"](runbook.md#entry-migration-runner-stuck).
- **Mitigation:** check advisory locks; rehearse the failed migration.

### Webhooks

#### `webhook_signature_failure_spike`
- **Condition:** rate of audit entries with `operation="webhook.signature_invalid"` > 0.1/sec for 5 min.
- **Severity:** P1.
- **Runbook:** [`runbook.md` § "Webhook 401 spike"](runbook.md#entry-webhook-401-spike).
- **Mitigation:** investigate probe vs config drift; rotate secret if probe-pattern.

#### `webhook_dedup_replay_spike`
- **Condition:** rate of audit entries with `operation="webhook.duplicate"` > 0.5/sec for 5 min.
- **Severity:** P2.
- **Runbook:** [`runbook.md`](runbook.md) — webhook section.
- **Mitigation:** investigate source; replay attack indication.

### Resource

#### `eventloop_lag_high`
- **Condition:** `histogram_quantile(0.99, nodejs_eventloop_lag_seconds_bucket[5m]) > 0.1` (100 ms).
- **Severity:** P2.
- **Runbook:** capacity / profiling.
- **Mitigation:** profile; common cause is sync work in async path.

#### `memory_high`
- **Condition:** `process_resident_memory_bytes / runtime_max_memory_bytes > 0.85` for 15 min.
- **Severity:** P2.
- **Runbook:** capacity.
- **Mitigation:** profile heap; restart if approaching OOM.

### SLO breach (operational discipline)

#### `slo_breach_session_success`
- **Condition:** rolling-7-day MCP session success < 99%.
- **Severity:** P2.
- **Runbook:** [`slo-sli.md`](slo-sli.md) error-budget policy.
- **Mitigation:** development cycle prioritizes cause.

#### `slo_breach_tool_latency`
- **Condition:** rolling-7-day MCP tool p99 latency > 2 s.
- **Severity:** P2.
- **Runbook:** [`slo-sli.md`](slo-sli.md).
- **Mitigation:** identify offending tool; jobify if appropriate.

---

## Implementation status

- v1: alert specs are documented here. Firing depends on the deployment platform.
- M11: alertmanager rules planned. The yaml will be checked into `ops/alertmanager/atl-mcp.yml` (or similar).
- Post-v1: integrate with PagerDuty / OpsGenie / Slack webhook.

## On-call rotation

Single maintainer in v1; "rotation" is "Chris is on call." Post-v1 multi-team: see [`on-call-playbook.md`](on-call-playbook.md).

## Linked artifacts

- **Sibling docs:** [`monitoring.md`](monitoring.md), [`runbook.md`](runbook.md), [`slo-sli.md`](slo-sli.md), [`on-call-playbook.md`](on-call-playbook.md)
- **Spec:** v6 §27 (observability)

---

*Last reviewed: 2026-04-25 by Chris.*
