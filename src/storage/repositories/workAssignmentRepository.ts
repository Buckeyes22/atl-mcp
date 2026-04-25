import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../db.js";
import { workAssignments, type NewWorkAssignmentRow, type WorkAssignmentRow } from "../schema/workAssignments.js";
import type { TenantScope } from "../../domain/tenantScope.js";
import type { WorkAssignmentRecord, WorkAssignmentStatus } from "../../domain/workAssignment.js";

export interface WorkAssignmentRepository {
  create(scope: TenantScope, record: WorkAssignmentRecord): Promise<WorkAssignmentRecord>;
  get(scope: TenantScope, id: string): Promise<WorkAssignmentRecord | undefined>;
  findByWorkRef(scope: TenantScope, input: { readonly projectId: string; readonly workKind: string; readonly workId: string }): Promise<WorkAssignmentRecord | undefined>;
  listByProject(scope: TenantScope, projectId: string): Promise<readonly WorkAssignmentRecord[]>;
  assign(scope: TenantScope, input: {
    readonly id: string;
    readonly assignedAgentId: string;
    readonly assignedBy: string;
    readonly updatedAt: string;
  }): Promise<WorkAssignmentRecord>;
  updateStatus(scope: TenantScope, input: { readonly id: string; readonly status: WorkAssignmentStatus; readonly updatedAt: string }): Promise<WorkAssignmentRecord>;
}

export function createWorkAssignmentRepository(db: Database): WorkAssignmentRepository {
  return {
    async create(scope, record) {
      assertScope(scope, record);
      const row: NewWorkAssignmentRow = {
        id: record.id,
        tenantId: record.tenantId,
        projectId: record.projectId,
        workKind: record.workRef.kind,
        workId: record.workRef.id,
        status: record.status,
        assignedAgentId: record.assignedAgentId ?? null,
        assignedBy: record.assignedBy ?? null,
        payload: record,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
      };
      await db.insert(workAssignments).values(row);
      return record;
    },

    async get(scope, id) {
      const rows = await db
        .select()
        .from(workAssignments)
        .where(and(eq(workAssignments.tenantId, scope.tenantId), eq(workAssignments.id, id)))
        .limit(1);
      return rows[0] ? rowToRecord(rows[0]) : undefined;
    },

    async findByWorkRef(scope, input) {
      const rows = await db
        .select()
        .from(workAssignments)
        .where(and(
          eq(workAssignments.tenantId, scope.tenantId),
          eq(workAssignments.projectId, input.projectId),
          eq(workAssignments.workKind, input.workKind),
          eq(workAssignments.workId, input.workId),
        ))
        .orderBy(desc(workAssignments.updatedAt))
        .limit(1);
      return rows[0] ? rowToRecord(rows[0]) : undefined;
    },

    async listByProject(scope, projectId) {
      const rows = await db
        .select()
        .from(workAssignments)
        .where(and(eq(workAssignments.tenantId, scope.tenantId), eq(workAssignments.projectId, projectId)))
        .orderBy(desc(workAssignments.updatedAt));
      return rows.map(rowToRecord);
    },

    async assign(scope, input) {
      const existing = await this.get(scope, input.id);
      if (!existing) throw new Error(`work assignment not found: ${input.id}`);
      const next: WorkAssignmentRecord = {
        ...existing,
        assignedAgentId: input.assignedAgentId,
        assignedBy: input.assignedBy,
        status: "assigned",
        updatedAt: input.updatedAt,
      };
      await db
        .update(workAssignments)
        .set({
          assignedAgentId: next.assignedAgentId,
          assignedBy: next.assignedBy,
          status: next.status,
          payload: next,
          updatedAt: new Date(next.updatedAt),
        })
        .where(and(eq(workAssignments.tenantId, scope.tenantId), eq(workAssignments.id, input.id)));
      return next;
    },

    async updateStatus(scope, input) {
      const existing = await this.get(scope, input.id);
      if (!existing) throw new Error(`work assignment not found: ${input.id}`);
      const next: WorkAssignmentRecord = {
        ...existing,
        status: input.status,
        updatedAt: input.updatedAt,
      };
      await db
        .update(workAssignments)
        .set({
          status: next.status,
          payload: next,
          updatedAt: new Date(next.updatedAt),
        })
        .where(and(eq(workAssignments.tenantId, scope.tenantId), eq(workAssignments.id, input.id)));
      return next;
    },
  };
}

function assertScope(scope: TenantScope, record: WorkAssignmentRecord): void {
  if (record.tenantId !== scope.tenantId) {
    throw new Error("workAssignment.tenantId must match scope");
  }
}

function rowToRecord(row: WorkAssignmentRow): WorkAssignmentRecord {
  return row.payload as WorkAssignmentRecord;
}
