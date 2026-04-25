import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Persistent state for `project_provision_execute` jobs (M6a, interim).
 * Replaces the in-memory `globalProvisionJobStore` so job records survive
 * server restart. Eventual target is BullMQ + Redis per v6 §24; this is
 * the F-011 closure path documented in audit-remediation-plan-2026-04-25.md.
 */
export const provisionJobs = pgTable(
  "provision_jobs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    status: text("status").notNull(),
    result: jsonb("result"),
    error: text("error"),
    payload: jsonb("payload").notNull(),
    queuedAt: timestamp("queued_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("provision_jobs_tenant_idx").on(t.tenantId),
    tenantProjectUpdatedIdx: index("provision_jobs_tenant_project_updated_idx").on(
      t.tenantId,
      t.projectId,
      t.updatedAt,
    ),
    tenantStatusIdx: index("provision_jobs_tenant_status_idx").on(t.tenantId, t.status),
  }),
);

export type ProvisionJobRow = typeof provisionJobs.$inferSelect;
export type NewProvisionJobRow = typeof provisionJobs.$inferInsert;
