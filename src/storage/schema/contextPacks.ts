import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const contextPacks = pgTable(
  "context_packs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    issueKey: text("issue_key"),
    regenerationKey: text("regeneration_key").notNull(),
    payload: jsonb("payload").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantProjectIdx: index("context_packs_tenant_project_idx").on(t.tenantId, t.projectId),
    regenIdx: index("context_packs_regen_key_idx").on(t.tenantId, t.regenerationKey),
  }),
);

export type ContextPackRow = typeof contextPacks.$inferSelect;
export type NewContextPackRow = typeof contextPacks.$inferInsert;
