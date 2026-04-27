---
description: "PostgreSQL patterns: schema boundaries, transactions, indexing, and migration discipline"
globs: ["db/**/*.ts", "db/**/*.sql", "migrations/**/*.sql", "migrations/**/*.ts", "alembic/**/*.py", "app/**/*.py", "src/**/*.ts"]
alwaysApply: false
---

# PostgreSQL — Data Platform Module

**Targets:** PostgreSQL 15+
**Appended to base CLAUDE.md when PostgreSQL is the primary relational store.**

---

## Data Modeling

1. Model domain concepts explicitly. Avoid generic JSON blobs when stable relational structure exists.
2. Use database constraints intentionally:
   - primary keys
   - foreign keys
   - unique constraints
   - check constraints
3. Treat timestamps and nullability as part of the business contract, not an afterthought.

## Migrations

4. All schema changes must land through reviewed migrations.
5. Do not edit historical migrations after they are shared or merged.
6. Keep destructive changes staged: add new column -> backfill -> switch reads/writes -> drop old column later.

## Query and Transaction Discipline

7. Multi-step write workflows that must stay consistent belong in transactions.
8. Keep transaction scope tight and predictable. Do not hold locks across avoidable network calls.
9. Avoid N+1 query patterns in application code. Shape reads intentionally.

## Indexing and Operations

10. Add indexes for real query paths, not by superstition.
11. Review sort, filter, and join patterns before adding indexes or denormalization.
12. Treat connection-pool sizing and statement timeouts as operational requirements, especially for API workloads.


## Engine Vertical Integration

When this module is used in a client engagement, check the relevant industry vertical config in `engine/verticals/` for:
- **Compliance signals** that affect technology choices (e.g., HIPAA → encryption at rest, GLBA → audit logging)
- **Pain points** that the technology stack should address
- **Recommended services** that pair with this stack

Cross-reference `engine/verticals/{industry}.md` before making data storage, authentication, and API design decisions for client work.
