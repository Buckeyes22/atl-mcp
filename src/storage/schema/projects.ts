import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Projects table. Most ProjectBlueprint sub-fields live in `blueprint` JSONB —
 * sub-tables (requirements, epics, stories) are deferred to post-MVP if/when
 * normalization is needed for query performance. v1 reads + writes the whole
 * blueprint atomically, so JSONB is the right shape.
 */
export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    state: text("state").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    blueprintVersion: integer("blueprint_version").notNull(),
    /** Full ProjectBlueprint JSON (minus the columns above which mirror header fields). */
    blueprint: jsonb("blueprint").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("projects_tenant_idx").on(t.tenantId),
    tenantKeyIdx: uniqueIndex("projects_tenant_key_idx").on(t.tenantId, t.key),
  }),
);

export type ProjectRow = typeof projects.$inferSelect;
export type NewProjectRow = typeof projects.$inferInsert;
