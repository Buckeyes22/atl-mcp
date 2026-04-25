import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../db.js";
import { readinessReports, type NewReadinessReportRow, type ReadinessReportRow } from "../schema/readinessReports.js";
import type { TenantScope } from "../../domain/tenantScope.js";

/**
 * M1 ships a minimal readiness shape; M8 fleshes out the full report
 * structure (deterministic 6-cat + LLM 4-tier verdict + 5-cat test framework).
 * The payload column round-trips whatever the M8 writer produces.
 */
export interface ReadinessReport {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly grade?: "A" | "B" | "C" | "D";
  readonly verdict?: "SAFE_TO_SHIP" | "SHIP_WITH_QUARANTINE" | "INVESTIGATE" | "BLOCK_RELEASE";
  readonly generatedAt: string;
  /** Free-form M8 payload. */
  readonly details: Readonly<Record<string, unknown>>;
}

export interface ReadinessRepository {
  insert(scope: TenantScope, report: ReadinessReport): Promise<ReadinessReport>;
  findLatestForProject(scope: TenantScope, projectId: string): Promise<ReadinessReport | undefined>;
}

export function createReadinessRepository(db: Database): ReadinessRepository {
  return {
    async insert(scope, report) {
      if (report.tenantId !== scope.tenantId) {
        throw new Error(`readinessReport.tenantId must match scope`);
      }
      const row: NewReadinessReportRow = {
        id: report.id,
        tenantId: report.tenantId,
        projectId: report.projectId,
        grade: report.grade ?? null,
        verdict: report.verdict ?? null,
        payload: report,
        generatedAt: new Date(report.generatedAt),
      };
      await db.insert(readinessReports).values(row);
      return report;
    },

    async findLatestForProject(scope, projectId) {
      const rows = await db
        .select()
        .from(readinessReports)
        .where(
          and(
            eq(readinessReports.tenantId, scope.tenantId),
            eq(readinessReports.projectId, projectId),
          ),
        )
        .orderBy(desc(readinessReports.generatedAt))
        .limit(1);
      const row: ReadinessReportRow | undefined = rows[0];
      return row ? (row.payload as ReadinessReport) : undefined;
    },
  };
}
