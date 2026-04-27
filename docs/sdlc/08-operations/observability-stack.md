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

<figure>

<svg viewBox="0 0 1200 660" xmlns="http://www.w3.org/2000/svg" font-family="IBM Plex Sans, system-ui">
    <defs>
      <marker id="ar6" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="#43434a"/>
      </marker>
    </defs>

    <!-- top-left meta -->
    <text x="40" y="28" font-family="IBM Plex Mono" font-size="10.5" letter-spacing="1.4" fill="#9a9690">v6 §27 · WHEN TO REACH FOR EACH STREAM</text>

    <!-- Source: atl-mcp process -->
    <g transform="translate(440,52)">
      <rect width="320" height="60" rx="3" fill="#1a1a1c"/>
      <text x="160" y="24" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" letter-spacing="1.2" fill="#c8c3b6">SOURCE</text>
      <text x="160" y="44" text-anchor="middle" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#fff">atl-mcp · src/observability/</text>
    </g>

    <!-- arrows down to four pillars -->
    <g stroke="#43434a" fill="none" marker-end="url(#ar6)">
      <line x1="540" y1="112" x2="180" y2="160"/>
      <line x1="580" y1="112" x2="460" y2="160"/>
      <line x1="620" y1="112" x2="740" y2="160"/>
      <line x1="660" y1="112" x2="1020" y2="160"/>
    </g>

    <!-- ============ PILLAR 1: LOGS ============ -->
    <g transform="translate(40,168)">
      <rect width="280" height="380" rx="3" fill="#dceee5" stroke="#1f6e54" stroke-width="1.5"/>
      <text x="20" y="32" font-family="IBM Plex Mono" font-size="10.5" letter-spacing="1.4" fill="#0e3d2f">PILLAR 1</text>
      <text x="20" y="56" font-family="IBM Plex Sans" font-size="20" font-weight="600" fill="#0e3d2f">Logs</text>
      <text x="20" y="76" font-family="IBM Plex Mono" font-size="11" fill="#0e3d2f">pino · file destination only</text>

      <line x1="20" y1="92" x2="260" y2="92" stroke="#a3c8b8"/>

      <text x="20" y="116" font-family="IBM Plex Mono" font-size="10" fill="#1f6e54">SHAPE</text>
      <text x="20" y="134" font-family="IBM Plex Mono" font-size="11" fill="#0e3d2f">structured JSON lines</text>
      <text x="20" y="150" font-family="IBM Plex Mono" font-size="11" fill="#0e3d2f">redact on secret paths</text>

      <text x="20" y="186" font-family="IBM Plex Mono" font-size="10" fill="#1f6e54">WHY FILE-ONLY</text>
      <text x="20" y="204" font-family="IBM Plex Sans" font-size="11.5" fill="#0e3d2f">stdio MCP requires stdout</text>
      <text x="20" y="220" font-family="IBM Plex Sans" font-size="11.5" fill="#0e3d2f">protocol-purity (Incident A)</text>

      <text x="20" y="256" font-family="IBM Plex Mono" font-size="10" fill="#1f6e54">REACH FOR WHEN…</text>
      <text x="20" y="276" font-family="IBM Plex Sans" font-size="12" fill="#0e3d2f">human-readable post-hoc</text>
      <text x="20" y="294" font-family="IBM Plex Sans" font-size="12" fill="#0e3d2f">grep · jq · raw triage</text>

      <text x="20" y="330" font-family="IBM Plex Mono" font-size="10" fill="#1f6e54">SINK</text>
      <text x="20" y="348" font-family="IBM Plex Mono" font-size="11" fill="#0e3d2f">/var/log/atl-mcp/*.log</text>
      <text x="20" y="364" font-family="IBM Plex Mono" font-size="10.5" fill="#1f6e54">platform tailing optional</text>
    </g>

    <!-- ============ PILLAR 2: METRICS ============ -->
    <g transform="translate(330,168)">
      <rect width="280" height="380" rx="3" fill="#fbeed8" stroke="#b96b16" stroke-width="1.5"/>
      <text x="20" y="32" font-family="IBM Plex Mono" font-size="10.5" letter-spacing="1.4" fill="#7a4408">PILLAR 2</text>
      <text x="20" y="56" font-family="IBM Plex Sans" font-size="20" font-weight="600" fill="#7a4408">Metrics</text>
      <text x="20" y="76" font-family="IBM Plex Mono" font-size="11" fill="#7a4408">Prometheus counters · /metrics</text>

      <line x1="20" y1="92" x2="260" y2="92" stroke="#e3c486"/>

      <text x="20" y="116" font-family="IBM Plex Mono" font-size="10" fill="#b96b16">SHAPE · 6 COUNTER CLASSES (§27.2)</text>
      <g font-family="IBM Plex Mono" font-size="10.5" fill="#1a1a1c">
        <text x="20" y="134">tool_calls_total</text>
        <text x="20" y="150">blocked_calls_total</text>
        <text x="20" y="166">private_data_access_total</text>
        <text x="20" y="182">untrusted_public_calls_total</text>
        <text x="20" y="198">write_operations_total</text>
        <text x="20" y="214">audit_emissions_total</text>
      </g>

      <text x="20" y="246" font-family="IBM Plex Mono" font-size="10" fill="#b96b16">PORT</text>
      <text x="20" y="264" font-family="IBM Plex Mono" font-size="11" fill="#7a4408">3001 · loopback default</text>

      <text x="20" y="298" font-family="IBM Plex Mono" font-size="10" fill="#b96b16">REACH FOR WHEN…</text>
      <text x="20" y="318" font-family="IBM Plex Sans" font-size="12" fill="#7a4408">aggregate trends over time</text>
      <text x="20" y="336" font-family="IBM Plex Sans" font-size="12" fill="#7a4408">SLI computation · alerting</text>

      <text x="20" y="364" font-family="IBM Plex Mono" font-size="10.5" fill="#b96b16">scrape: prom-compat tooling</text>
    </g>

    <!-- ============ PILLAR 3: TRACES ============ -->
    <g transform="translate(620,168)">
      <rect width="280" height="380" rx="3" fill="#ece1f3" stroke="#6e1a82" stroke-width="1.5"/>
      <text x="20" y="32" font-family="IBM Plex Mono" font-size="10.5" letter-spacing="1.4" fill="#3e0d4d">PILLAR 3</text>
      <text x="20" y="56" font-family="IBM Plex Sans" font-size="20" font-weight="600" fill="#3e0d4d">Traces</text>
      <text x="20" y="76" font-family="IBM Plex Mono" font-size="11" fill="#3e0d4d">OTel spans → Langfuse</text>

      <line x1="20" y1="92" x2="260" y2="92" stroke="#c8a3d8"/>

      <text x="20" y="116" font-family="IBM Plex Mono" font-size="10" fill="#6e1a82">SHAPE</text>
      <text x="20" y="134" font-family="IBM Plex Sans" font-size="11.5" fill="#3e0d4d">per-request spans · LLM &amp;</text>
      <text x="20" y="150" font-family="IBM Plex Sans" font-size="11.5" fill="#3e0d4d">sampling-relevant ops</text>

      <text x="20" y="186" font-family="IBM Plex Mono" font-size="10" fill="#6e1a82">PROPAGATION</text>
      <text x="20" y="204" font-family="IBM Plex Sans" font-size="11.5" fill="#3e0d4d">W3C `traceparent` on outbound</text>
      <text x="20" y="220" font-family="IBM Plex Sans" font-size="11.5" fill="#3e0d4d">REST to Atlassian / Bitbucket</text>

      <text x="20" y="256" font-family="IBM Plex Mono" font-size="10" fill="#6e1a82">REACH FOR WHEN…</text>
      <text x="20" y="276" font-family="IBM Plex Sans" font-size="12" fill="#3e0d4d">per-request investigation</text>
      <text x="20" y="294" font-family="IBM Plex Sans" font-size="12" fill="#3e0d4d">latency attribution</text>

      <text x="20" y="330" font-family="IBM Plex Mono" font-size="10" fill="#6e1a82">SINK</text>
      <text x="20" y="348" font-family="IBM Plex Mono" font-size="11" fill="#3e0d4d">Langfuse · only when</text>
      <text x="20" y="364" font-family="IBM Plex Mono" font-size="11" fill="#3e0d4d">LANGFUSE_* env vars set</text>
    </g>

    <!-- ============ +1: AUDIT TRACE JSONL ============ -->
    <g transform="translate(910,168)">
      <rect width="250" height="380" rx="3" fill="#fbe7e4" stroke="#b8281d" stroke-width="1.5"/>
      <text x="20" y="32" font-family="IBM Plex Mono" font-size="10.5" letter-spacing="1.4" fill="#7a1d14">+1 STREAM (atl-mcp specific)</text>
      <text x="20" y="56" font-family="IBM Plex Sans" font-size="18" font-weight="600" fill="#7a1d14">Audit trace</text>
      <text x="20" y="76" font-family="IBM Plex Mono" font-size="11" fill="#7a1d14">JSONL · v6 §27.4</text>

      <line x1="20" y1="92" x2="230" y2="92" stroke="#e3a39a"/>

      <text x="20" y="118" font-family="IBM Plex Mono" font-size="10" fill="#b8281d">VS AUDIT CHAIN</text>
      <text x="20" y="138" font-family="IBM Plex Sans" font-size="12" font-weight="600" fill="#1a1a1c">chain = security artifact</text>
      <text x="20" y="156" font-family="IBM Plex Sans" font-size="11.5" fill="#7a1d14">signed, tamper-evident</text>
      <text x="20" y="180" font-family="IBM Plex Sans" font-size="12" font-weight="600" fill="#1a1a1c">trace = observability artifact</text>
      <text x="20" y="198" font-family="IBM Plex Sans" font-size="11.5" fill="#7a1d14">queryable, sortable, fast scan</text>

      <text x="20" y="234" font-family="IBM Plex Mono" font-size="10" fill="#b8281d">RELATIONSHIP</text>
      <text x="20" y="254" font-family="IBM Plex Sans" font-size="11.5" fill="#7a1d14">both reference the same</text>
      <text x="20" y="270" font-family="IBM Plex Sans" font-size="11.5" fill="#7a1d14">underlying events</text>

      <text x="20" y="306" font-family="IBM Plex Mono" font-size="10" fill="#b8281d">REACH FOR WHEN…</text>
      <text x="20" y="326" font-family="IBM Plex Sans" font-size="12" fill="#7a1d14">"what did the system do for</text>
      <text x="20" y="344" font-family="IBM Plex Sans" font-size="12" fill="#7a1d14">project X?" — audit-grade trail</text>
    </g>

    <!-- bottom band: matrix-style decision row -->
    <g transform="translate(40,580)">
      <text font-family="IBM Plex Mono" font-size="10.5" letter-spacing="1.4" fill="#9a9690">DECISION RULE</text>
      <text y="22" font-family="IBM Plex Sans" font-size="13" fill="#1a1a1c">
        <tspan fill="#0e3d2f" font-weight="600">"is this thing happening?"</tspan> → logs
        <tspan fill="#9a9690"> · </tspan>
        <tspan fill="#7a4408" font-weight="600">"how often, with what trend?"</tspan> → metrics
        <tspan fill="#9a9690"> · </tspan>
        <tspan fill="#3e0d4d" font-weight="600">"why was that one slow?"</tspan> → traces
        <tspan fill="#9a9690"> · </tspan>
        <tspan fill="#7a1d14" font-weight="600">"what did we do for project X?"</tspan> → audit trace
      </text>
    </g>
  </svg>

<figcaption><strong>V6 — Three-pillar observability + audit trace.</strong> atl-mcp's three observability pillars — pino logs (file-only, mandated by stdio MCP protocol-purity), Prometheus metrics on port 3001 (six counter classes per v6 §27.2), and OpenTelemetry traces emitted to Langfuse — plus a fourth purpose-built stream: the audit-trace JSONL (v6 §27.4). The audit chain and audit trace deliberately diverge: the chain is a security artifact (signed, tamper-evident), the trace is an observability artifact (queryable, fast to scan). Both reference the same underlying events. (See <a href="../../visualizations/v06-observability-pillars.html">full visualization page</a>.)</figcaption>
</figure>


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
