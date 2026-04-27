---
title: Load Test Runbook
owner: Chris
status: accepted (procedure documented; harness planned for M11)
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, operator]
sdlc_category: 15-capacity
related: [docs/sdlc/07-testing/perf-plan.md, docs/sdlc/15-capacity/benchmarks.md]
---

# Load Test Runbook

> **TL;DR:** How to run a load test against atl-mcp. Workload definition + harness invocation + result capture + interpretation. Procedures here apply to perf benchmarks ([`benchmarks.md`](benchmarks.md)) and to capacity-planning drills.

This is the operational doc for the load-testing capability. The benchmark catalog is in [`benchmarks.md`](benchmarks.md); the test plan is in [`../07-testing/perf-plan.md`](../07-testing/perf-plan.md).

---

## Pre-flight

Before running a load test:

1. **Decide what you're answering.** A load test answers ONE question. ("Can we sustain 1000 concurrent sessions?" Not "are we fast enough?")
2. **Pick the environment.** Never production. Staging or a dedicated load-test environment.
3. **Estimate the budget.** Real LLM provider calls cost money; load tests with sampling can be expensive.
4. **Notify stakeholders.** A 10-minute load test that incidentally generates 50,000 audit entries is worth flagging.
5. **Confirm health.** `/healthz`, `/readyz`, `/admin/health/audit` all green before starting.

## Workload definition

Every load test has a workload spec — a JSON file checked into `perf/workloads/<name>.json`:

```json
{
  "name": "preflight-jira-baseline",
  "operation": "project_preflight_check",
  "concurrency": 10,
  "ratePerSession": 1.0,
  "durationSec": 600,
  "rampUpSec": 60,
  "targets": [
    { "tier": "staging", "jiraProjectKey": "STAGE", "confluenceSpaceKey": "STAGE" }
  ],
  "successCriteria": {
    "p50_ms_max": 1000,
    "p99_ms_max": 5000,
    "errorRateMax": 0
  }
}
```

The workload is the source of truth for the test. The harness is just an executor.

## Harness invocation

Once the harness lands (M11 work):

```bash
# Run the test
node scripts/perf/run-test.mjs \
  --workload perf/workloads/preflight-jira-baseline.json \
  --output perf/results/preflight-jira-$(date -u +%Y%m%dT%H%M%SZ).json

# Capture metrics during run
curl -s http://localhost:3001/metrics > perf/results/preflight-jira-$(date -u +%Y%m%dT%H%M%SZ).metrics
```

The harness:
- Spins up the configured concurrency.
- Ramps over `rampUpSec`.
- Holds for `durationSec`.
- Drops cleanly.
- Writes per-call timing + outcome to the output file.
- Computes p50 / p99 / error rate at end.
- Compares against `successCriteria`.

Until the harness lands: manual scripts using `vitest` or `bun` are acceptable for ad-hoc tests.

## During the run

Watch:

- `nodejs_eventloop_lag_seconds` — should stay below 100 ms p99.
- `process_resident_memory_bytes` — should stay below `--max-old-space-size`.
- `mcp_tool_call_duration_seconds` — should match expected per the workload.
- `db_query_duration_seconds` — should not spike unexpectedly.
- `audit_entries_appended_total` — should grow at expected rate.
- Provider 429 rate — should stay manageable.

If any signal deteriorates dramatically: **abort** the test (preserves the system) AND record the abort point.

## After the run

1. **Capture results.** Output file from harness + `/metrics` snapshot + log file.
2. **Compute summary.** p50, p99, p99.9, throughput, error rate.
3. **Compare against success criteria.** Pass / fail.
4. **Compare against prior runs.** Drift > 20% in p99 or > 10% in throughput is investigation-worthy.
5. **Update [`benchmarks.md`](benchmarks.md)** with the result.
6. **Tear down.** Make sure the load-test data doesn't pollute downstream tests.

## Cleanup

Load tests can leave traces:

- Session entries in `mcpSessionProfiles` (TTL-evicted automatically).
- Audit entries (these are forever; don't run load tests against production for this reason).
- Provisioning job rows (if the workload includes provisioning).
- Temp DB / pglite instances (clean up).
- Log file growth.

Schedule cleanup as part of the test:

```bash
# After test
psql "$DATABASE_URL" -c "DELETE FROM mcpSessionProfiles WHERE expiresAt < now()"
# Audit entries: don't delete; they're append-only by design
```

## Interpreting results

### Pass

- All success criteria met.
- No system warnings during run.
- Resource utilization within ceilings.

### Fail (regression)

- One or more criteria missed compared to prior baselines.
- Investigation: what changed? Code, config, data, environment?

### Fail (capacity exceeded)

- Criteria missed because the workload exceeded the v1 design point.
- Investigation: is the workload realistic? If yes, scale-up plan.

### Anomalies

Things that look weird even when criteria pass:

- Unexpected memory growth during steady-state.
- p99 spikes at regular intervals (GC?).
- Provider 429s during a non-provider-heavy workload.
- Audit chain growing faster than expected.

Anomalies are findings even if no criterion failed.

## What load tests don't tell you

- **They don't tell you the system is correct.** Functional tests do.
- **They don't tell you it's secure.** Security tests do.
- **They don't tell you customers will be happy.** UX tests do.
- **They don't tell you about long-term degradation.** Soak tests + production telemetry do.

Load tests are a narrow tool. Use them for capacity questions; use other tools for other questions.

## Linked artifacts

- **Sibling:** [`current-limits.md`](current-limits.md), [`capacity-planning.md`](capacity-planning.md), [`benchmarks.md`](benchmarks.md)
- **Plan:** [`../07-testing/perf-plan.md`](../07-testing/perf-plan.md)
- **Template:** [`../templates/perf-test-template.md`](../templates/perf-test-template.md)
- **Operations:** [`../08-operations/runbook.md`](../08-operations/runbook.md), [`../08-operations/monitoring.md`](../08-operations/monitoring.md)

---

*Last reviewed: 2026-04-25 by Chris.*
