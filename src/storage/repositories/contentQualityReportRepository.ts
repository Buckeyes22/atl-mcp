import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../db.js";
import { contentQualityReports, type ContentQualityReportRow, type NewContentQualityReportRow } from "../schema/contentQualityReports.js";
import type { TenantScope } from "../../domain/tenantScope.js";
import type { ContentQualityReport } from "../../domain/contentQuality.js";

export interface ContentQualityReportRepository {
  insert(scope: TenantScope, report: ContentQualityReport): Promise<ContentQualityReport>;
  findLatestForProject(scope: TenantScope, projectId: string): Promise<ContentQualityReport | undefined>;
  findLatestForArtifact(scope: TenantScope, input: { readonly artifactKind: string; readonly artifactId: string }): Promise<ContentQualityReport | undefined>;
  listByProject(scope: TenantScope, projectId: string): Promise<readonly ContentQualityReport[]>;
}

export function createContentQualityReportRepository(db: Database): ContentQualityReportRepository {
  return {
    async insert(scope, report) {
      if (report.tenantId !== scope.tenantId) {
        throw new Error("contentQualityReport.tenantId must match scope");
      }
      const row: NewContentQualityReportRow = {
        id: report.id,
        tenantId: report.tenantId,
        projectId: report.projectId,
        artifactKind: report.artifactRef.kind,
        artifactId: report.artifactRef.id,
        score: report.score,
        grade: report.grade,
        payload: report,
        generatedAt: new Date(report.generatedAt),
      };
      await db.insert(contentQualityReports).values(row);
      return report;
    },

    async findLatestForProject(scope, projectId) {
      const rows = await db
        .select()
        .from(contentQualityReports)
        .where(and(eq(contentQualityReports.tenantId, scope.tenantId), eq(contentQualityReports.projectId, projectId)))
        .orderBy(desc(contentQualityReports.generatedAt))
        .limit(1);
      return rows[0] ? rowToReport(rows[0]) : undefined;
    },

    async findLatestForArtifact(scope, input) {
      const rows = await db
        .select()
        .from(contentQualityReports)
        .where(and(
          eq(contentQualityReports.tenantId, scope.tenantId),
          eq(contentQualityReports.artifactKind, input.artifactKind),
          eq(contentQualityReports.artifactId, input.artifactId),
        ))
        .orderBy(desc(contentQualityReports.generatedAt))
        .limit(1);
      return rows[0] ? rowToReport(rows[0]) : undefined;
    },

    async listByProject(scope, projectId) {
      const rows = await db
        .select()
        .from(contentQualityReports)
        .where(and(eq(contentQualityReports.tenantId, scope.tenantId), eq(contentQualityReports.projectId, projectId)))
        .orderBy(desc(contentQualityReports.generatedAt));
      return rows.map(rowToReport);
    },
  };
}

function rowToReport(row: ContentQualityReportRow): ContentQualityReport {
  return row.payload as ContentQualityReport;
}
