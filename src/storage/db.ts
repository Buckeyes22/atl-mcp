// Dual-mode DB factory: PGlite for dev, postgres-js for deployed.
// Pattern lift from project-foundation F-021 (see docs/partners/project-foundation.md §6).
//
// Both branches return a Drizzle client with the same schema; consumers see
// `Database` (a unified type alias) and never need to know which backend
// they're talking to.

import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePgLite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { Logger } from "pino";
import { applyMigrations, type SqlExecutor } from "./migrationRunner.js";
import * as schema from "./schema/index.js";

export type Database =
  | PgliteDatabase<typeof schema>
  | PostgresJsDatabase<typeof schema>;

export interface DbHandle {
  readonly db: Database;
  readonly backend: "pglite" | "postgres";
  /** Apply pending migrations. Idempotent. */
  migrate(): Promise<{ applied: string[]; skipped: string[] }>;
  /**
   * Read the versions recorded in schema_migrations. Returns [] if the bootstrap
   * migration has not run yet (table doesn't exist). Used by admin.migrations.list.
   */
  listAppliedMigrationVersions(): Promise<string[]>;
  /** Close underlying connection(s). */
  close(): Promise<void>;
}

export interface DbOptions {
  /** When true, use PGlite (dev). When false, use Postgres. */
  readonly devMode: boolean;
  /**
   * For PGlite: filesystem path or ":memory:" or undefined for default in-memory.
   * For Postgres: full connection string (postgres://...).
   */
  readonly url?: string;
  readonly logger: Logger;
}

export async function createDbHandle(opts: DbOptions): Promise<DbHandle> {
  if (opts.devMode) return await createPgliteHandle(opts);
  return await createPostgresHandle(opts);
}

async function createPgliteHandle(opts: DbOptions): Promise<DbHandle> {
  const pglite = new PGlite(opts.url ?? "memory://");
  await pglite.waitReady;
  const db = drizzlePgLite(pglite, { schema });

  const exec: SqlExecutor = {
    async exec(sql: string) {
      await pglite.exec(sql);
    },
    async selectStrings(sql: string) {
      const res = await pglite.query<Record<string, unknown>>(sql);
      return res.rows.map((row) => {
        const first = Object.values(row)[0];
        return typeof first === "string" ? first : String(first);
      });
    },
  };

  return {
    db,
    backend: "pglite",
    async migrate() {
      return applyMigrations({ exec, logger: opts.logger });
    },
    async listAppliedMigrationVersions() {
      try {
        return await exec.selectStrings(`SELECT version FROM schema_migrations ORDER BY version`);
      } catch {
        return [];
      }
    },
    async close() {
      await pglite.close();
    },
  };
}

async function createPostgresHandle(opts: DbOptions): Promise<DbHandle> {
  if (!opts.url) {
    throw new Error("DATABASE_URL is required when devMode=false");
  }
  const client = postgres(opts.url, {
    // Per uio.md F-202: PgBouncer transaction-mode requires statement_cache_size=0.
    // postgres-js exposes the equivalent via prepare:false; we keep prepare on by
    // default for direct Postgres connections and document the override.
    prepare: true,
    max: 10,
  });
  const db = drizzlePostgres(client, { schema });

  const exec: SqlExecutor = {
    async exec(sql: string) {
      await client.unsafe(sql);
    },
    async selectStrings(sql: string) {
      const rows = await client.unsafe<Array<Record<string, unknown>>>(sql);
      return rows.map((row) => {
        const first = Object.values(row)[0];
        return typeof first === "string" ? first : String(first);
      });
    },
  };

  return {
    db,
    backend: "postgres",
    async migrate() {
      return applyMigrations({ exec, logger: opts.logger });
    },
    async listAppliedMigrationVersions() {
      try {
        return await exec.selectStrings(`SELECT version FROM schema_migrations ORDER BY version`);
      } catch {
        return [];
      }
    },
    async close() {
      await client.end({ timeout: 5 });
    },
  };
}
