import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const workAssignments = pgTable(
  "work_assignments",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    workKind: text("work_kind").notNull(),
    workId: text("work_id").notNull(),
    status: text("status").notNull(),
    assignedAgentId: text("assigned_agent_id"),
    assignedBy: text("assigned_by"),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantProjectIdx: index("work_assignments_tenant_project_idx").on(t.tenantId, t.projectId),
    tenantProjectWorkIdx: index("work_assignments_tenant_project_work_idx").on(t.tenantId, t.projectId, t.workKind, t.workId),
    tenantStatusIdx: index("work_assignments_tenant_status_idx").on(t.tenantId, t.status),
  }),
);

export type WorkAssignmentRow = typeof workAssignments.$inferSelect;
export type NewWorkAssignmentRow = typeof workAssignments.$inferInsert;
