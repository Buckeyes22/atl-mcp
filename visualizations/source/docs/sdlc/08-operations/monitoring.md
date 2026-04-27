---
title: Monitoring
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [operator, engineer]
sdlc_category: 08-operations
related: [agent-context-orchestrator-mcp-plan-v6.md §27, docs/sdlc/08-operations/observability-stack.md, docs/sdlc/08-operations/alerting.md]
---

# Monitoring

> **TL;DR:** Prometheus counters at `/metrics` (port 3001, loopback). Langfuse traces for LLM/sampling spans. Pino file-based structured logs. Six observability counter classes per v6 §27.2 (tool calls, blocked calls, private-data access, untrusted-public-data calls, write operations, audit emissions). Counters drive SLI computation; traces support investigation.

This doc is the *what we measure* view. Sibling docs cover *how we alert on it* ([`alerting.md`](alerting.md)) and *the deeper observability stack* ([`observability-stack.md`](observability-stack.md)).

---

## Counter inventory

Per v6 §27.2, six counter classes plus standard HTTP/process metrics:

### MCP / orchestration counters

| Counter | Labels | What it measures |
|---|---|---|
| `mcp_session_init_total` | `outcome` (success / failure / client_close) | Session-start outcomes |
| `mcp_tool_calls_total` | `tool`, `outcome` (success / failure / blocked) | Tool invocations |
| `mcp_tool_calls_blocked_total` | `tool`, `reason` (policy_deny / lethal_trifecta / require_approval) | Blocked operations (subset of mcp_tool_calls_total when outcome=blocked) |
| `mcp_tool_call_duration_seconds` | `tool` | Histogram of latency per tool |

### Trust-boundary counters

| Counter | Labels | What it measures |
|---|---|---|
| `private_data_access_calls_total` | `actor_kind`, `intent` | Reads of PRIVATE-classified content |
| `untrusted_public_data_calls_total` | `source_kind` | Operations consuming UNTRUSTED inputs |
| `write_operation_calls_total` | `provider`, `intent`, `outcome` | External writes |
| `audit_entries_appended_total` | `kind` | Audit chain growth |

### Provider / dependency counters

| Counter | Labels | What it measures |
|---|---|---|
| `provider_call_total` | `provider`, `method`, `outcome` | Outbound REST calls |
| `provider_retry_total` | `provider`, `reason` (429 / 5xx / network) | Retries triggered |
| `provider_call_duration_seconds` | `provider`, `method` | Histogram of provider latency |

### Storage / queue counters

| Counter | Labels | What it measures |
|---|---|---|
| `db_query_total` | `outcome` | DB query outcomes |
| `db_query_duration_seconds` | (none — all queries pooled) | DB latency histogram |
| `provision_queue_depth` | (gauge) | Current queue depth |
| `provision_queue_lag_seconds` | (histogram) | Enqueue → start lag |
| `provision_jobs_total` | `outcome` | Job completion outcomes |

### Mgmt + process counters

| Counter | Labels | What it measures |
|---|---|---|
| `mgmt_request_total` | `path`, `method`, `code` | HTTP requests to mgmt API |
| `nodejs_eventloop_lag_seconds` | (histogram) | Event-loop lag (standard Node metric) |
| `process_resident_memory_bytes` | (gauge) | RSS |
| `nodejs_active_handles_total` | (gauge) | Open handles (FDs, sockets) |

## Where counters are exposed

- **Endpoint:** `GET http://127.0.0.1:3001/metrics` (loopback by default).
- **Format:** Prometheus text format.
- **Authentication:** none on `/metrics` (loopback-only, so the network is the access control).

If `MGMT_API_HOST` is bound to non-loopback in non-dev: there's a startup warning, and the operator must add network-level access control. The application doesn't enforce auth on `/metrics` itself.

## Trace inventory

LLM-relevant operations emit traces to Langfuse (when configured):

- **Sampling spans** — every MCP sampling call. Includes prompt template, model, token count, latency, outcome.
- **Blueprint workflow spans** — intake → blueprint pipeline.
- **Provisioning spans** — plan → execute path.

Trace context is propagated via OpenTelemetry headers when calling Atlassian / Bitbucket so distributed traces can be assembled.

## Log inventory

Structured logs via pino (file destination only — see [`../13-quality/anti-slop.md`](../13-quality/anti-slop.md) and [`observability-stack.md`](observability-stack.md)).

- **Log levels in use:** `trace` (off in prod), `debug` (off in prod), `info`, `warn`, `error`, `fatal`.
- **Common fields:** `service`, `version`, `tier`, `pid`, `traceId`, `spanId`, `tenantId`, `projectId`, `operation`, `outcome`.
- **File:** `LOG_FILE_PATH` (default `./orchestrator.log`).
- **Rotation:** size-based (planned for M11; currently manual / ops-platform handled).

## Mapping counters to SLIs

| SLI | Counter formula |
|---|---|
| MCP session success | `sum(rate(mcp_session_init_total{outcome="success"}[7d])) / sum(rate(mcp_session_init_total{outcome=~"success\|failure"}[7d]))` |
| Tool call p99 | `histogram_quantile(0.99, mcp_tool_call_duration_seconds_bucket[7d])` |
| Mgmt availability | `sum(rate(mgmt_request_total{path="/healthz",code=~"2.."}[30d])) / sum(rate(mgmt_request_total{path="/healthz"}[30d]))` |
| Audit chain freshness | `time() - audit_chain_last_verified_timestamp` |
| Provider call success | see [`slo-sli.md`](slo-sli.md) |
| Queue lag p99 | `histogram_quantile(0.99, provision_queue_lag_seconds_bucket[7d])` |

The full SLI/SLO mapping is in [`slo-sli.md`](slo-sli.md).

## Mapping counters to alerts

| Alert | Counter / formula | Threshold | Runbook entry |
|---|---|---|---|
| MCP session failure rate | `mcp_session_init_total{outcome="failure"}` rate | > 1% sustained 5 min | "MCP clients drop within ~100 ms" |
| Provider 429 spike | `provider_retry_total{reason="429"}` rate | > 10/min sustained | "Atlassian rate-limit exhaustion" |
| Audit chain stale | freshness gauge | > 5 min | "Audit chain signature mismatch" |
| Queue lag elevated | `provision_queue_lag_seconds_bucket` | p99 > 30 s sustained 10 min | New entry to add |
| Webhook signature failures | `mcp_tool_calls_blocked_total{reason="webhook_signature_invalid"}` rate | > 0.1/sec sustained | "Webhook 401 spike" |

Full alert config in [`alerting.md`](alerting.md).

## Dashboards

For v1, dashboards are read-on-demand from `/metrics` via `prometheus`-compatible tools. Post-v1, defined Grafana panels per category:

- **Overview** — session success, tool latency, queue depth, audit freshness.
- **Provider** — provider call success, retry rate, 429 rate, latency by provider.
- **Workload** — tool calls by tool, write operations by intent, queue depth.
- **Security** — blocked calls, lethal-trifecta detections, webhook signature failures, audit emissions.
- **Resource** — event-loop lag, memory, handles.

## What's NOT yet wired

Be explicit:

- The full counter set above is **specified** by v6 §27.2 but not all are implemented yet. M11 is the harden-and-finalize milestone for observability.
- Langfuse traces are wired only when `LANGFUSE_*` env vars are set.
- Grafana dashboards are post-v1.

When a counter is referenced as "M11", it's a tracking item.

## Linked artifacts

- **Spec:** v6 §27 (full observability stack)
- **Code:** `src/observability/` (logger, counters)
- **Sibling docs:** [`observability-stack.md`](observability-stack.md), [`alerting.md`](alerting.md), [`slo-sli.md`](slo-sli.md), [`runbook.md`](runbook.md)
- **Partner ref:** `docs/partners/eval-view.md` (eval gates feed Langfuse-style traces)

---

*Last reviewed: 2026-04-25 by Chris.*
