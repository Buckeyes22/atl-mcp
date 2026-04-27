---
title: Observability Stack
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, operator]
sdlc_category: 08-operations
related: [agent-context-orchestrator-mcp-plan-v6.md §27, docs/sdlc/08-operations/monitoring.md, docs/sdlc/13-quality/anti-slop.md]
---

# Observability Stack

> **TL;DR:** Three pillars — **logs** (pino, file destination), **metrics** (Prometheus counters at `/metrics`, port 3001), **traces** (OpenTelemetry span emission to Langfuse when configured). Plus a fourth stream for atl-mcp specifically: **audit-trace JSONL** (v6 §27.4) — a structured event stream that mirrors every consequential operation.

This is the *what stack we use and why* doc. Counter inventory is in [`monitoring.md`](monitoring.md). Alert mapping is in [`alerting.md`](alerting.md).

---

## The four streams

### 1. Logs (Pino, file-only)

- **Library:** [pino](https://github.com/pinojs/pino).
- **Destination:** file (`LOG_FILE_PATH`, default `./orchestrator.log`).
- **Why file, not stdout:** the stdio MCP transport carries JSON-RPC frames over stdout. A log line on stdout corrupts the protocol stream. v6 §22 + CLAUDE.md operating rule. Enforced by `lint:no-stdout` (PCO-12 documents an alias-form gap).
- **Format:** newline-delimited JSON.
- **Common fields:** `time`, `level`, `service`, `version`, `tier` (deployment tier), `pid`, `traceId`, `spanId`, `tenantId`, `projectId`, `operation`, `outcome`.
- **Redaction:** `src/observability/logger.ts` configures pino redact on known secret paths. See [`../06-security/secrets-mgmt.md`](../06-security/secrets-mgmt.md).
- **Levels:** `info` is the production default. `debug` for investigation. `trace` is off in non-dev (high volume).
- **Rotation:** size-based; planned for M11. Currently the deploy platform is expected to handle log files.

### 2. Metrics (Prometheus counters)

- **Endpoint:** `GET http://127.0.0.1:3001/metrics`.
- **Format:** Prometheus text format.
- **Loopback by default:** `MGMT_API_HOST=127.0.0.1`. If bound to non-loopback, startup warns.
- **Counter taxonomy:** v6 §27.5 specifies six categories — see [`monitoring.md`](monitoring.md) for the inventory.
- **Why Prometheus over alternatives:** standard, easy to scrape, well-supported by every observability stack (Grafana, Datadog ingest, NewRelic, etc.).

### 3. Traces (OpenTelemetry → Langfuse)

- **Library:** OpenTelemetry instrumentation; export to Langfuse when `LANGFUSE_*` env vars are set.
- **Spans emitted for:**
  - MCP sampling calls (full prompt, model, token count, latency, outcome).
  - Blueprint workflow spans (intake → blueprint pipeline).
  - Provisioning spans (plan → execute path).
  - Provider HTTP calls (with retry context).
- **Why Langfuse:** purpose-built for LLM-app observability. Spans include prompt/response (with redaction); retains for analysis.
- **Optional in v1:** if `LANGFUSE_*` is not set, spans go to a no-op exporter. No reduction in functionality, just no trace persistence.
- **Trace propagation:** W3C `traceparent` headers on outbound REST calls so distributed traces with Atlassian / Bitbucket can be assembled (when those vendors expose tracing — they don't yet).

### 4. Audit trace JSONL (v6 §27.4)

A unique-to-atl-mcp stream: every consequential operation also emits a structured event into a JSONL file (or DB-backed row in `auditEntries`).

- **Why a separate stream:** the audit chain is a security artifact (signed, tamper-evident). The audit trace is an observability artifact (queryable, sortable, fast to scan). Both reference the same underlying events.
- **Spec:** v6 §27.4.
- **Schema:** `(timestamp, actor, operation, outcome, traceId, projectId, ...)`.

The audit trace is conceptually a denormalized projection of the `auditEntries` table for fast queries.

---

## How the streams relate

A single MCP tool call produces:

- 1+ log lines (info-level entry/exit; warn/error if anything went wrong).
- N counter increments (`mcp_tool_calls_total`, `mcp_tool_call_duration_seconds`, plus per-trust-boundary counters as relevant).
- 1 span in OpenTelemetry, propagated to all internal sub-spans.
- 1 audit entry (signed) AND 1 audit-trace row (denormalized).

Each stream has different ergonomics:

- **Logs**: human-readable post-hoc; grep / jq.
- **Metrics**: aggregate trends; alerting.
- **Traces**: per-request investigation; latency attribution.
- **Audit**: tamper-evident security forensics + structured queryability.

---

## Sampling strategies

### Log sampling

- `info` and above are unsampled (everything captured).
- `debug` is unsampled but only enabled in dev / triage.
- `trace` is unsampled but disabled by default (volume).

### Metric sampling

- Counters are exact (every increment counted).
- Histograms use standard latency buckets; the buckets define the resolution.

### Trace sampling

- All sampling spans are emitted (they're rare and high-value).
- Provider HTTP traces could be sampled at scale; v1 emits all (low volume).

The observability cost / value tradeoff: v1 errs on the side of capturing everything because the volume is low. As traffic grows, sampling becomes a tunable.

---

## What this stack does NOT cover

- **Profiling.** No continuous profiler in v1. Manual heap snapshots / CPU profiles via Node's built-in tools.
- **APM dashboards.** No bundled APM (Datadog APM, NewRelic, etc.). Counters at `/metrics` and traces in Langfuse are the substitute.
- **Real-user monitoring (RUM).** No browser-side observability — atl-mcp doesn't have a UI.
- **Synthetic monitoring.** No external-from-internet probes in v1. Single-tenant deployment usually relies on the deploy platform's health checks.

These are post-v1 considerations. Track in [`../15-capacity/`](../15-capacity/) when the operational reality demands them.

---

## Adding a new observable

When a new operation, error class, or trust-boundary crossing warrants observability:

1. **Log line** at the right level (`info` for normal flow, `warn` for degraded, `error` for handled failures, `fatal` for unrecoverable). Include structured fields (`operation`, `outcome`, `projectId`, etc.).
2. **Counter or histogram** in `src/observability/` — increment / observe at the right moment.
3. **Span** if the operation is a transaction worth attributing latency to.
4. **Audit entry** if the operation crosses a trust boundary or changes state.
5. **Alert** if the metric should page someone — see [`alerting.md`](alerting.md).
6. **Runbook entry** if the alert can fire — see [`runbook.md`](runbook.md).
7. **Threat coverage** if the new operation introduces a new threat — see [`../06-security/threat-model.md`](../06-security/threat-model.md).

The discipline is: observability isn't an afterthought; it lands in the same PR as the new functionality.

## Linked artifacts

- **Spec:** v6 §27 (full observability stack), §27.4 (Agent Trace JSONL spec)
- **Code:** `src/observability/logger.ts`
- **Sibling docs:** [`monitoring.md`](monitoring.md), [`alerting.md`](alerting.md), [`runbook.md`](runbook.md), [`slo-sli.md`](slo-sli.md), [`on-call-playbook.md`](on-call-playbook.md)
- **Lint:** [`../13-quality/anti-slop.md`](../13-quality/anti-slop.md), `scripts/lint-no-stdout.mjs`
- **Audit trail data:** [`../05-data/audit-trail.md`](../05-data/audit-trail.md)

---

*Last reviewed: 2026-04-25 by Chris.*
