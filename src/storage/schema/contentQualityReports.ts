import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const contentQualityReports = pgTable(
  "content_quality_reports",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    artifactKind: text("artifact_kind").notNull(),
    artifactId: text("artifact_id").notNull(),
    score: integer("score").notNull(),
    grade: text("grade").notNull(),
    payload: jsonb("payload").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantProjectIdx: index("content_quality_tenant_project_idx").on(t.tenantId, t.projectId),
    tenantArtifactIdx: index("content_quality_tenant_artifact_idx").on(t.tenantId, t.artifactKind, t.artifactId),
    tenantProjectGeneratedIdx: index("content_quality_project_generated_idx").on(t.tenantId, t.projectId, t.generatedAt),
  }),
);

export type ContentQualityReportRow = typeof contentQualityReports.$inferSelect;
export type NewContentQualityReportRow = typeof contentQualityReports.$inferInsert;
