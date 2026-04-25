// Migration runner.
//
// Applies SQL files from src/storage/migrations/ in lexical order. Tracks
// applied versions in a `schema_migrations` table (created by 0001_init.sql).
// Idempotent: re-running is a no-op for already-applied versions.
//
// Both backends (PGlite + Postgres) accept the same SQL; we hand-author the
// migrations to keep dialect parity. The migration-rehearsal test verifies
// the resulting catalogs match between backends.

import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Logger } from "pino";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, "migrations");

/**
 * Minimal raw-SQL executor interface. PGlite and postgres-js both expose
 * a similar shape — we adapt them in db.ts so this runner is backend-agnostic.
 */
export interface SqlExecutor {
  exec(sql: string): Promise<void>;
  /** Returns the column-zero string from each row of a query that selects exactly one column. */
  selectStrings(sql: string): Promise<string[]>;
}

export interface MigrationFile {
  readonly version: string;
  readonly path: string;
  readonly sql: string;
}

export async function listMigrations(): Promise<MigrationFile[]> {
  const entries = await readdir(MIGRATIONS_DIR);
  const sqlFiles = entries.filter((e) => e.endsWith(".sql")).sort();
  const files: MigrationFile[] = [];
  for (const name of sqlFiles) {
    const path = join(MIGRATIONS_DIR, name);
    const sql = await readFile(path, "utf8");
    files.push({ version: name.replace(/\.sql$/, ""), path, sql });
  }
  return files;
}

export async function applyMigrations(args: {
  exec: SqlExecutor;
  logger: Logger;
}): Promise<{ applied: string[]; skipped: string[] }> {
  const { exec, logger } = args;
  const applied: string[] = [];
  const skipped: string[] = [];

  const files = await listMigrations();
  if (files.length === 0) {
    logger.warn("no migration files found");
    return { applied, skipped };
  }

  // Apply the first file unconditionally — it creates schema_migrations itself.
  // Subsequent files check schema_migrations to avoid re-application.
  const [first, ...rest] = files;
  if (!first) return { applied, skipped };

  // Detect whether schema_migrations already exists by querying it; if the
  // table doesn't exist we'll get an error, in which case run the bootstrap.
  let schemaTableExists = false;
  try {
    await exec.selectStrings(`SELECT version FROM schema_migrations LIMIT 1`);
    schemaTableExists = true;
  } catch {
    schemaTableExists = false;
  }

  if (!schemaTableExists) {
    logger.info({ version: first.version }, "applying bootstrap migration");
    await exec.exec(first.sql);
    await exec.exec(
      `INSERT INTO schema_migrations(version) VALUES ('${escape(first.version)}') ON CONFLICT DO NOTHING`,
    );
    applied.push(first.version);
  } else {
    const alreadyApplied = await exec.selectStrings(
      `SELECT version FROM schema_migrations WHERE version = '${escape(first.version)}'`,
    );
    if (alreadyApplied.length === 0) {
      // Schema_migrations exists but bootstrap version not recorded — apply it.
      logger.info({ version: first.version }, "applying bootstrap migration (recorded)");
      await exec.exec(first.sql);
      await exec.exec(
        `INSERT INTO schema_migrations(version) VALUES ('${escape(first.version)}') ON CONFLICT DO NOTHING`,
      );
      applied.push(first.version);
    } else {
      skipped.push(first.version);
    }
  }

  for (const file of rest) {
    const already = await exec.selectStrings(
      `SELECT version FROM schema_migrations WHERE version = '${escape(file.version)}'`,
    );
    if (already.length > 0) {
      skipped.push(file.version);
      continue;
    }
    logger.info({ version: file.version }, "applying migration");
    await exec.exec(file.sql);
    await exec.exec(
      `INSERT INTO schema_migrations(version) VALUES ('${escape(file.version)}') ON CONFLICT DO NOTHING`,
    );
    applied.push(file.version);
  }

  return { applied, skipped };
}

/** Single-quote escape for SQL string literals. Used only for hardcoded version strings. */
function escape(s: string): string {
  return s.replace(/'/g, "''");
}
