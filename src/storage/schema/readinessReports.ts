import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Readiness reports are produced by M8 (`readiness_validate`). M1 only ships
 * the persisted shape so other code can store partial readiness signals
 * (for example, M2 preflight warnings) before the full M8 rubric lands.
 */
export const readinessReports = pgTable(
  "readiness_reports",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    /** Categorical grade A/B/C/D from Caliber (F-091). Optional until M8. */
    grade: text("grade"),
    /** LLM 4-tier verdict from eval-view (F-046). Optional until M8. */
    verdict: text("verdict"),
    payload: jsonb("payload").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantProjectIdx: index("readiness_reports_tenant_project_idx").on(t.tenantId, t.projectId),
  }),
);

export type ReadinessReportRow = typeof readinessReports.$inferSelect;
export type NewReadinessReportRow = typeof readinessReports.$inferInsert;
