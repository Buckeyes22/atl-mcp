---
description: "TimescaleDB patterns: hypertables, retention, continuous aggregates, and time-series query rules"
globs: ["db/**/*.sql", "migrations/**/*.sql", "src/**/*.ts", "app/**/*.py", "src/lib/analytics/**/*.ts"]
alwaysApply: false
---

# TimescaleDB — Time-Series Module

**Targets:** PostgreSQL + TimescaleDB
**Appended to base CLAUDE.md when time-series workloads are in use.**

---

## Time-Series Modeling

1. Treat the event timestamp as a first-class key part of the data model.
2. Define chunking, retention, compression, and aggregate strategy deliberately; do not treat TimescaleDB as generic Postgres with extra features bolted on later.
3. Separate raw ingestion tables from aggregated/reporting surfaces.

## Query and Aggregation Rules

4. Prefer continuous aggregates or reviewed pre-aggregation for dashboards over repeated raw-table scans.
5. Make time bucketing explicit. Avoid hidden assumptions about timezone, sampling interval, or gap-filling.
6. Distinguish event time from ingestion time.

## Operations

7. Retention and compression policies are product behavior, not only ops tuning. They affect what history the system can explain.
8. Keep backfill and late-arriving data rules explicit for analytics and alerting features.
