// admin.migrations.list — applied + pending schema migrations.
// Reads the available SQL files from src/storage/migrations/ and joins with the
// schema_migrations table contents (deps.db.listAppliedMigrationVersions).

import { z } from "zod";
import { listMigrations } from "../../../storage/migrationRunner.js";
import type { AdminToolDeps } from "../registry.js";
import type { ToolRegistry } from "../../toolRegistry.js";

const MIGRATION = z.object({
  version: z.string(),
  applied: z.boolean(),
  sizeBytes: z.number().int().nonnegative(),
  primaryOps: z.array(z.string()),
});

const OUTPUT = z.object({
  migrations: z.array(MIGRATION),
  appliedCount: z.number().int().nonnegative(),
  pendingCount: z.number().int().nonnegative(),
});

const PRIMARY_OPS = /^\s*(CREATE\s+TABLE|ALTER\s+TABLE|CREATE\s+INDEX|DROP\s+TABLE|ADD\s+COLUMN|CREATE\s+UNIQUE\s+INDEX|CREATE\s+TYPE)\b/gim;

function detectPrimaryOps(sql: string): string[] {
  const matches = sql.match(PRIMARY_OPS) ?? [];
  return [...new Set(matches.map((m) => m.toUpperCase().replace(/\s+/g, " ").trim()))].slice(0, 6);
}

export function registerMigrationsAdminTool(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.migrations.list",
      description: "All available migrations (src/storage/migrations/) joined with schema_migrations applied state.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { title: "Admin: migrations", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler() {
      const files = await listMigrations();
      const appliedSet = new Set(await deps.db.listAppliedMigrationVersions());

      const migrations = files.map((f) => ({
        version: f.version,
        applied: appliedSet.has(f.version),
        sizeBytes: Buffer.byteLength(f.sql, "utf8"),
        primaryOps: detectPrimaryOps(f.sql),
      }));

      const output = OUTPUT.parse({
        migrations,
        appliedCount: migrations.filter((m) => m.applied).length,
        pendingCount: migrations.filter((m) => !m.applied).length,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  });
}
