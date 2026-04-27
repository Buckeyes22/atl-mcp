---
title: Performance Test Template
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, operator]
sdlc_category: templates
related: [docs/sdlc/07-testing/perf-plan.md, docs/sdlc/15-capacity/benchmarks.md]
---

# Perf Test: [test name]

> **TL;DR:** What this test exercises, the workload, the success threshold, and the link to the result archive.

Each performance test is a self-contained spec — defining the workload precisely is more valuable than running it once on a beefy laptop.

---

## Goal

What question does this test answer? Examples:

- "Can the orchestrator sustain 50 concurrent MCP sessions for 10 minutes without OOM?"
- "What's the p99 latency of `project_preflight_check` against a real Atlassian site with 200 issue types?"
- "How does the audit-write throughput scale from 1 to 10 concurrent writers?"

A good perf test answers ONE question. Compound goals get split into multiple tests.

## Workload

Define the load precisely:

- **Operation(s):** which MCP tool(s) or API endpoint(s).
- **Concurrency:** number of simultaneous clients.
- **Rate:** calls/sec or "as fast as possible".
- **Payload size:** request/response shapes; small/medium/large profile.
- **Duration:** how long the test runs.
- **Ramp-up:** flat vs. linear ramp from 0 to peak.

Concrete example:

| Parameter | Value |
|---|---|
| Operation | `project_preflight_check` against Jira |
| Concurrency | 10 simultaneous MCP sessions |
| Rate | 1 call per session per second |
| Payload | Jira project with 200 issue types, 50 custom fields |
| Duration | 10 minutes |
| Ramp-up | Linear over first 60 seconds |

## Environment

Where the test runs:

- **System under test:** version, deployment tier (dev / staging / prod-replica).
- **Hardware:** CPU, RAM, disk, network.
- **Database:** Postgres version, connection pool size, current row counts in relevant tables.
- **External dependencies:** Atlassian / Bitbucket / UIO endpoints; sandbox or live; rate-limit posture.
- **Observability:** what counters / traces / logs are collected during the run.

Tests run on different environments produce different numbers; environment is part of the test result.

## Success criteria

What the test must demonstrate. Each criterion is a clear pass/fail:

- **Latency:** p50 < X ms, p99 < Y ms, p99.9 < Z ms.
- **Throughput:** sustained ≥ N ops/sec.
- **Error rate:** < 0.1% over the run.
- **Resource ceiling:** RSS < N MB, file descriptors < M, no OOM, no log warnings of class W.
- **Correctness invariants:** every audit entry verifies; no orphaned rows.

Don't include criteria you don't measure. If you measure something not in the criteria, decide whether it should be added.

## Adversarial workload (optional)

Load shapes designed to break things:

- Pathologically large payloads.
- Mixed read/write under contention.
- Slow upstream (Atlassian responding at p99 floor).
- Burst-then-idle patterns.

The point isn't to fail; it's to know what the failure mode looks like and document it.

## Procedure

Step-by-step run instructions. Reproducible, not improvised.

```bash
# 1. Bring up the system under test
docker compose -f docker-compose.perf.yml up -d

# 2. Seed reference data
node scripts/perf/seed-jira-fixture.mjs --issue-types 200 --custom-fields 50

# 3. Run load
node scripts/perf/run-test.mjs --workload ./perf/workloads/preflight-jira.json --duration 600 --output ./perf/results/$(date -u +%Y%m%dT%H%M%SZ).json

# 4. Collect counters
curl -s http://localhost:3001/metrics > ./perf/results/$(date -u +%Y%m%dT%H%M%SZ).metrics

# 5. Tear down
docker compose -f docker-compose.perf.yml down
```

If the procedure is non-trivial, the load harness scripts get checked in alongside the test definition.

## Result archive

How and where results are stored:

- File path or storage bucket.
- Filename convention (`<test-name>-<UTC-timestamp>.json`).
- Retention (e.g., "keep last 12; older are archived").

Comparison across runs requires a stable archive.

## Known prior runs

| Date | Result | Notes |
|---|---|---|
| YYYY-MM-DD | PASS / FAIL | Brief context, link to result file |

The history is part of the test artifact. A test that passes today but the trend is degrading is itself a finding.

## Linked artifacts

- Workload definition: `perf/workloads/<name>.json`
- Run harness: `scripts/perf/...`
- Test plan: [`docs/sdlc/07-testing/perf-plan.md`](../07-testing/perf-plan.md)
- Capacity: [`docs/sdlc/15-capacity/`](../15-capacity/)
- SLOs: [`docs/sdlc/08-operations/slo-sli.md`](../08-operations/slo-sli.md)

---

## Style rules

- **One question per test.** Don't compound goals.
- **Workload is precise.** "Realistic load" is not a workload.
- **Success criteria are measurable.** "Fast enough" is not a criterion.
- **Reproducible.** A perf test that can't be re-run is a screenshot, not a test.
- **Archive results.** Compare across versions; don't run, screenshot, throw away.
