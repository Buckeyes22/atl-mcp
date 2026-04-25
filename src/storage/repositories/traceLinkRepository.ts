import { and, eq } from "drizzle-orm";
import type { Database } from "../db.js";
import { traceLinks, type NewTraceLinkRow } from "../schema/traceLinks.js";
import type { TraceLink } from "../../domain/traceLink.js";
import type { TenantScope } from "../../domain/tenantScope.js";

export interface TraceLinkRepository {
  create(scope: TenantScope, link: TraceLink): Promise<TraceLink>;
  findByProject(scope: TenantScope, projectId: string): Promise<readonly TraceLink[]>;
  findBySource(scope: TenantScope, sourceKind: string, sourceId: string): Promise<readonly TraceLink[]>;
  findByTarget(scope: TenantScope, targetKind: string, targetId: string): Promise<readonly TraceLink[]>;
  delete(scope: TenantScope, id: string): Promise<void>;
}

export function createTraceLinkRepository(db: Database): TraceLinkRepository {
  return {
    async create(scope, link) {
      if (link.tenantId !== scope.tenantId) {
        throw new Error(`traceLink.tenantId must match scope`);
      }
      const row: NewTraceLinkRow = {
        id: link.id,
        tenantId: link.tenantId,
        projectId: link.projectId,
        sourceKind: link.source.kind,
        sourceId: link.source.id,
        targetKind: link.target.kind,
        targetId: link.target.id,
        relation: link.relation,
        payload: link,
        createdAt: new Date(link.createdAt),
      };
      await db.insert(traceLinks).values(row);
      return link;
    },

    async findByProject(scope, projectId) {
      const rows = await db
        .select()
        .from(traceLinks)
        .where(and(eq(traceLinks.tenantId, scope.tenantId), eq(traceLinks.projectId, projectId)));
      return rows.map((r) => r.payload as TraceLink);
    },

    async findBySource(scope, sourceKind, sourceId) {
      const rows = await db
        .select()
        .from(traceLinks)
        .where(
          and(
            eq(traceLinks.tenantId, scope.tenantId),
            eq(traceLinks.sourceKind, sourceKind),
            eq(traceLinks.sourceId, sourceId),
          ),
        );
      return rows.map((r) => r.payload as TraceLink);
    },

    async findByTarget(scope, targetKind, targetId) {
      const rows = await db
        .select()
        .from(traceLinks)
        .where(
          and(
            eq(traceLinks.tenantId, scope.tenantId),
            eq(traceLinks.targetKind, targetKind),
            eq(traceLinks.targetId, targetId),
          ),
        );
      return rows.map((r) => r.payload as TraceLink);
    },

    async delete(scope, id) {
      await db
        .delete(traceLinks)
        .where(and(eq(traceLinks.tenantId, scope.tenantId), eq(traceLinks.id, id)));
    },
  };
}
