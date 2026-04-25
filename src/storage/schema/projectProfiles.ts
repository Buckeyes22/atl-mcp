import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const projectProfiles = pgTable(
  "project_profiles",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    payload: jsonb("payload").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => ({
    tenantProjectIdx: index("project_profiles_tenant_project_idx").on(t.tenantId, t.projectId),
  }),
);

export type ProjectProfileRow = typeof projectProfiles.$inferSelect;
export type NewProjectProfileRow = typeof projectProfiles.$inferInsert;
