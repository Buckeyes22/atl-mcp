// Migration rehearsal — M1 acceptance: "Migration rehearsal test passes
// (parity between PGlite and Postgres)."
//
// On PGlite: always runs (in-memory, no daemon needed).
// On Postgres: runs only if DATABASE_URL is set in the environment. Otherwise
// skipped with a clear message — devs without a Postgres instance can still
// pass the suite, but CI must run with DATABASE_URL to gate parity.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDbHandle, type DbHandle } from "../../../src/storage/db.js";
import { silentLogger } from "./_testDb.js";

const POSTGRES_URL = process.env["DATABASE_URL"];

interface SchemaSnapshot {
  readonly tables: readonly string[];
  readonly columnsByTable: Readonly<Record<string, readonly string[]>>;
}

async function snapshotSchema(handle: DbHandle): Promise<SchemaSnapshot> {
  // Read pg_catalog directly — works on both backends since PGlite implements it.
  // information_schema is also fine; we use pg_catalog for explicit ordering.
  const tablesQuery = `
    SELECT tablename
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;
  const colsQuery = `
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `;

  // We only have the SqlExecutor mini-interface; run via a private exec on the
  // underlying connection. Both PGlite and postgres-js are reachable through
  // the Drizzle handle's underlying client. We access via select() with a
  // tagged sql expression.
  const { sql } = await import("drizzle-orm");
  const tableRows = normalizeRows<{ tablename: string }>(await handle.db.execute(sql.raw(tablesQuery)));
  const colRows = normalizeRows<{ table_name: string; column_name: string }>(
    await handle.db.execute(sql.raw(colsQuery)),
  );

  const tables = tableRows.map((r) => r.tablename).sort();
  const columnsByTable: Record<string, string[]> = {};
  for (const row of colRows) {
    if (!columnsByTable[row.table_name]) columnsByTable[row.table_name] = [];
    columnsByTable[row.table_name]!.push(row.column_name);
  }
  return { tables, columnsByTable };
}

/**
 * Drizzle's `db.execute(sql.raw(...))` returns different shapes depending on
 * the driver: `Array<Row>` for postgres-js, `{ rows: Array<Row>, ... }` for
 * PGlite. Normalize both to a row array so the test stays driver-agnostic.
 */
function normalizeRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows: unknown }).rows;
    if (Array.isArray(rows)) return rows as T[];
  }
  throw new Error(`unexpected db.execute result shape: ${typeof result}`);
}

describe("migration rehearsal: PGlite", () => {
  let handle: DbHandle;
  beforeEach(async () => {
    handle = await createDbHandle({ devMode: true, logger: silentLogger() });
    await handle.migrate();
  });
  afterEach(async () => {
    await handle.close();
  });

  it("creates the expected M1 tables", async () => {
    const snap = await snapshotSchema(handle);
    const expected = [
      "acl_entries",
      "audit_entries",
      "context_packs",
      "encrypted_tokens",
      "mcp_session_profiles",
      "policy_decisions",
      "project_profiles",
      "projects",
      "readiness_reports",
      "schema_migrations",
      "trace_links",
    ];
    for (const t of expected) {
      expect(snap.tables).toContain(t);
    }
  });

  it("re-running migrations is idempotent", async () => {
    const second = await handle.migrate();
    expect(second.applied).toEqual([]);
    expect(second.skipped.length).toBeGreaterThan(0);
  });
});

describe.runIf(typeof POSTGRES_URL === "string" && POSTGRES_URL.length > 0)(
  "migration rehearsal: Postgres parity (skipped without DATABASE_URL)",
  () => {
    let pglite: DbHandle;
    let postgresHandle: DbHandle;

    beforeEach(async () => {
      pglite = await createDbHandle({ devMode: true, logger: silentLogger() });
      postgresHandle = await createDbHandle({ devMode: false, url: POSTGRES_URL, logger: silentLogger() });
      await pglite.migrate();
      await postgresHandle.migrate();
    });
    afterEach(async () => {
      await pglite.close();
      await postgresHandle.close();
    });

    it("table list matches between backends", async () => {
      const pgliteSnap = await snapshotSchema(pglite);
      const postgresSnap = await snapshotSchema(postgresHandle);
      expect(pgliteSnap.tables).toEqual(postgresSnap.tables);
    });

    it("column list per table matches between backends", async () => {
      const pgliteSnap = await snapshotSchema(pglite);
      const postgresSnap = await snapshotSchema(postgresHandle);
      for (const table of pgliteSnap.tables) {
        expect(pgliteSnap.columnsByTable[table]).toEqual(postgresSnap.columnsByTable[table]);
      }
    });
  },
);
