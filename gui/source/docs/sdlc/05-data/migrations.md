---
title: Migrations
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, operator]
sdlc_category: 05-data
related: [docs/sdlc/05-data/schema.md, docs/adr/0001-pglite-for-dev.md, docs/sdlc/04-design/module-storage.md]
---

# Migrations

> **TL;DR:** Migrations are SQL files in `src/storage/migrations/`, applied in numerical order by `migrationRunner`. Rehearsal mode (PCO-13) applies pending migrations against a temp DB seeded from a prod-shaped snapshot before applying to target. Rehearsal failures stop the runner. Idempotent — re-runs are safe. Post-mortem origin: Incident B in [`../08-operations/runbook.md`](../08-operations/runbook.md).

The migration discipline is the single most important storage-layer invariant after "schema matches code." Without rehearsal, dev/prod divergence bites silently.

---

## File layout

```
src/storage/migrations/
├── 0001_init.sql
├── 0002_provision_jobs.sql
├── 0003_webhook_deliveries.sql
└── ...
```

Numbered prefix; applied in order. The runner tracks applied migrations in a `_migrations` metadata table (or equivalent).

## Runner contract

```typescript
migrationRunner.run({ mode: "apply" | "rehearse", target: "pglite" | "postgres" })
```

### Apply mode

1. Acquire an advisory lock (single-runner).
2. Read `_migrations` for last-applied id.
3. For each pending migration in order:
   - Begin transaction.
   - Execute migration SQL.
   - Insert metadata row.
   - Commit.
4. Release lock.

### Rehearse mode

1. Spin up a temp DB (pglite for fast iteration; or a Postgres snapshot for prod-shape).
2. Apply prior migrations.
3. Apply pending migration.
4. Run post-condition assertions (per-migration; co-located in the migration file as a comment block or a paired `.test.ts`).
5. If post-conditions hold: report success.
6. If post-conditions fail: report which condition failed + with what state.
7. Tear down temp DB.

Rehearsal **does not** apply to the actual target. It's a pre-flight check.

## Migration authoring rules

1. **Forward-only by default.** No automatic reverse migration. If reverse is required, write a paired migration that reverses; document explicitly.
2. **Idempotent.** Re-applying a migration shouldn't break anything. Use `IF NOT EXISTS` / `IF EXISTS` clauses.
3. **No data loss without explicit acknowledgment.** A migration that drops a column requires an ADR.
4. **Tested in rehearsal.** Every migration has a rehearsal test fixture.
5. **No schema/code drift.** A migration accompanies its corresponding code change in the same PR.

## Schema parity (pglite + Postgres)

Both backends run the same migration files. ADR-0001 chose pglite specifically so dev and prod run identical migrations.

Known discrepancies:
- **Vacuum behavior.** Pglite's vacuum is not identical to Postgres's. PCO-56 documents the gap.
- **Some Postgres extensions** (e.g., `pg_trgm`) aren't available in pglite. Migrations using extensions need special handling — currently we don't.

## Idempotency

The `_migrations` metadata table records `(id, applied_at, runner_version)`. Re-running the runner sees the metadata and skips. Even if the runner crashes mid-migration:

- Crash before metadata insert → next run re-applies (must be idempotent).
- Crash after metadata insert → next run skips (correctly).

The pattern: the migration body is wrapped in a transaction with the metadata insert as the last statement. Either everything commits or nothing commits.

## Post-condition assertions

Per-migration assertions verify the migration achieved its intent:

```sql
-- Migration 0003_webhook_deliveries.sql
CREATE TABLE webhookDeliveries (...);
CREATE UNIQUE INDEX webhook_deliveries_dedup ON webhookDeliveries (source, delivery_id);

-- Post-condition (asserted in rehearsal):
-- SELECT count(*) FROM webhookDeliveries WHERE 1=0;  -- table exists
-- SELECT 1 FROM pg_indexes WHERE indexname = 'webhook_deliveries_dedup';  -- index exists
```

Assertions live in `.assertions.sql` files paired with the migration, OR in a `.test.ts` that the rehearsal harness runs.

## Reverse migrations

When required: a numbered "reverse" migration follows the original.

Example: if `0007_add_column.sql` introduces a breaking change, `0008_revert_add_column.sql` is its reverse, applied if rollback is needed.

We **do not** have automatic reverse generation. Forward-only by default; reverse is explicit per-migration.

## What rehearsal catches (Incident B class)

The rehearsal harness exists because of Incident B (in [`../08-operations/runbook.md`](../08-operations/runbook.md)):

- A migration assumed an indexed column existed.
- In dev (pglite, vacuumed-out indexes), the migration ran fine.
- In prod, the index existed and the migration's SQL behaved differently — fail.

Rehearsal against a prod-shaped snapshot would have caught this. Now mandatory.

## Workflow

When adding a migration:

1. Write the migration SQL.
2. Write the post-condition assertions.
3. Run rehearsal locally: `npm run migrate:rehearse`.
4. If green: commit + PR.
5. CI runs rehearsal again as part of gates.
6. Merge → main → deployment process applies it to staging → production.

## What's NOT in scope (yet)

- **Schema diffing tools** to auto-generate migration files. We hand-write.
- **Online schema changes** (zero-downtime large-table migrations). For v1, brief downtime is acceptable.
- **Data migrations at scale.** Few-row migrations work fine; a 100M-row backfill needs design work.

## Linked artifacts

- **ADR:** [ADR-0001](../../adr/0001-pglite-for-dev.md)
- **Code:** `src/storage/migrationRunner.ts`, `src/storage/migrations/`
- **Test:** `tests/integration/storage/migrationRehearsal.test.ts`
- **Sibling docs:** [`schema.md`](schema.md), [`domain-model.md`](domain-model.md)
- **Runbook:** [`../08-operations/runbook.md`](../08-operations/runbook.md) (Incident B)
- **Tracking:** PCO-13 (rehearsal); PCO-56 (vacuumed-row gap)

---

*Last reviewed: 2026-04-25 by Chris.*
