---
status: accepted
date: 2026-04-25
deciders: [orchestrator-team]
consulted: [project-foundation-team-pattern]
informed: [build-agents]
---

# 0001. PGlite for local dev; Postgres 16 for deployed mode

## Context

The orchestrator persists tenant-scoped state: project blueprints, trace links, readiness results, audit entries (hash-chained + ed25519-signed per §30.1), session capability profiles, ACL entries. Local development needs zero-friction setup for build agents and contributors; deployed mode needs production-grade Postgres with replication, backup, and PITR. Historically, dev/prod database divergence (SQLite-in-dev vs Postgres-in-prod) causes migration parity bugs that surface only in staging or production.

## Decision Drivers

- Build agents must be able to run `npm test` immediately after clone with no external DB. (M0 acceptance: `docker compose up` succeeds; tests pass before that — implies dev path with no DB daemon.)
- Migrations must be byte-for-byte identical between dev and deployed.
- Deployed mode must use Postgres for ecosystem reasons (BullMQ + Drizzle + ops familiarity).
- Single-tenant in v1; multi-tenant SaaS post-v1 (v6 §7.3 runway).

## Considered Options

1. **PGlite (WASM Postgres) for dev, Postgres 16 for deployed** — same SQL dialect, same migration files, no dev daemon. Pattern lift from project-foundation F-021 ([`docs/partners/project-foundation.md`](../partners/project-foundation.md)).
2. **SQLite for dev, Postgres for deployed** — fast and battle-tested, but SQL dialect divergence (no schemas, different `JSON` semantics, different transaction model) means migrations must be authored twice. Drizzle abstraction helps but does not eliminate divergence.
3. **Postgres in dev too** — eliminates divergence but requires dev to run a daemon (Docker or native). Adds ~30s to first-run setup; some build agents (sandboxed environments) cannot run Docker.
4. **In-memory only for dev** — fastest, but no schema validation; migration rehearsal cannot run.

## Decision Outcome

**Adopt PGlite for local dev (`DATABASE_DEV_MODE=true`) and Postgres 16+ for deployed (`DATABASE_DEV_MODE=false`).** Same Drizzle schemas, same migration files. A migration-rehearsal test (M1 acceptance) verifies parity by running every migration against both backends and snapshotting the resulting catalog.

Selection happens at config-load time in `src/storage/db.ts` (lands with M1):

```ts
function createDbClient(config) {
  if (config.storage.devMode) {
    const pglite = new PGlite(config.storage.url ?? ":memory:");
    return drizzlePGlite(pglite);
  }
  return drizzle(postgres(config.storage.url));
}
```

PGlite limitations are accepted with caveats:
- No PostGIS, no pgvector, no full-text-search extensions in the dev backend. v6 §25 (semantic retrieval) uses Qdrant for vectors and FTS5 (via better-sqlite3 in `src/storage/vector/`) for keyword index, neither of which depends on the Postgres backend. So this limitation does not bite v6 functionally.
- PGlite is single-process; concurrent connections share a WASM instance. Acceptable for dev; deployed Postgres has no such constraint.

## Consequences

### Good

- Zero-daemon dev path. `npm install && npm test` works on a fresh clone.
- Migration-parity test catches dialect divergence at PR-time, not in staging.
- Drizzle's PGlite + node-postgres adapters share schema definitions — no double-authoring.
- Build agents in sandboxed environments (no Docker) can still run the dev path.

### Bad

- Two backend code paths to maintain. Mitigated by sharing all schemas + migrations.
- PGlite WASM startup adds ~50ms per test that touches the DB. Acceptable for unit/integration; tests that need many DB instances may need a fixture pool.
- PGlite version skew vs deployed Postgres major version (PGlite tracks Postgres 16.x; bumping deployed to 17 requires PGlite to catch up, or accepting temporary divergence).

### Neutral

- The pattern is lifted from project-foundation F-021. If project-foundation upstream evolves the pattern (e.g., to a different WASM Postgres build), evaluate via a follow-up ADR. No runtime dependency on project-foundation.

## More Information

- v6 plan §3 (Assumptions) explicitly calls out PGlite as the dev default.
- v6 plan §8 (Repository Structure) places `db.ts` at `src/storage/db.ts`.
- v6 plan §28 M1 (Acceptance) requires the migration-rehearsal test.
- [`docs/partners/project-foundation.md`](../partners/project-foundation.md) §6 shows the dual-mode client pattern.

## Status notes

- 2026-04-25: `src/storage/vector/` referenced in §Decision Outcome lands with M7 and is not present today. F-016 in audit findings; no behavior implication.
