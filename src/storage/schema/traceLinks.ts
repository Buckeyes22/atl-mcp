import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const traceLinks = pgTable(
  "trace_links",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    sourceKind: text("source_kind").notNull(),
    sourceId: text("source_id").notNull(),
    targetKind: text("target_kind").notNull(),
    targetId: text("target_id").notNull(),
    relation: text("relation").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantProjectIdx: index("trace_links_tenant_project_idx").on(t.tenantId, t.projectId),
    sourceIdx: index("trace_links_source_idx").on(t.tenantId, t.sourceKind, t.sourceId),
    targetIdx: index("trace_links_target_idx").on(t.tenantId, t.targetKind, t.targetId),
  }),
);

export type TraceLinkRow = typeof traceLinks.$inferSelect;
export type NewTraceLinkRow = typeof traceLinks.$inferInsert;
