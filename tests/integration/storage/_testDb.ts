import { pino, type Logger } from "pino";
import { createDbHandle, type DbHandle } from "../../../src/storage/db.js";

export function silentLogger(): Logger {
  return pino({ level: "silent" });
}

/** Spin up a fresh in-memory PGlite database with all migrations applied. */
export async function createTestDb(): Promise<DbHandle> {
  const handle = await createDbHandle({
    devMode: true,
    logger: silentLogger(),
  });
  const result = await handle.migrate();
  if (result.applied.length === 0 && result.skipped.length === 0) {
    throw new Error("test db: no migrations applied or skipped — listMigrations() returned empty?");
  }
  return handle;
}
