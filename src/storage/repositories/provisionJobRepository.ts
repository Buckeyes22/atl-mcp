// F-011 closure: persistent provision job state.
// Mirrors the in-memory ProvisionJobStore shape so the rest of the codebase
// migrates one read/write at a time. BullMQ + Redis is the eventual target
// (v6 §24); this DB-backed repository is the interim per the audit
// remediation plan.

import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../db.js";
import { provisionJobs, type NewProvisionJobRow, type ProvisionJobRow } from "../schema/provisionJobs.js";
import type { TenantScope } from "../../domain/tenantScope.js";

export type ProvisionJobStatus = "queued" | "running" | "completed" | "failed";

export interface ProvisionJobRecord<T = unknown> {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly status: ProvisionJobStatus;
  readonly result?: T;
  readonly error?: string;
  readonly queuedAt: string;
  readonly updatedAt: string;
}

export interface ProvisionJobRepository {
  create(scope: TenantScope, input: { readonly id: string; readonly projectId: string; readonly status?: ProvisionJobStatus }): Promise<ProvisionJobRecord>;
  update<T>(
    scope: TenantScope,
    id: string,
    patch: Partial<Pick<ProvisionJobRecord<T>, "status" | "result" | "error">>,
  ): Promise<ProvisionJobRecord<T>>;
  get(scope: TenantScope, id: string): Promise<ProvisionJobRecord | undefined>;
  recent(scope: TenantScope, limit?: number): Promise<readonly ProvisionJobRecord[]>;
}

export function createProvisionJobRepository(db: Database): ProvisionJobRepository {
  return {
    async create(scope, input) {
      const now = new Date();
      const status = input.status ?? "queued";
      const row: NewProvisionJobRow = {
        id: input.id,
        tenantId: scope.tenantId,
        projectId: input.projectId,
        status,
        result: null,
        error: null,
        payload: { id: input.id, projectId: input.projectId, status },
        queuedAt: now,
        updatedAt: now,
      };
      await db.insert(provisionJobs).values(row);
      return rowToRecord({ ...row, queuedAt: now, updatedAt: now } as ProvisionJobRow);
    },

    async update<T>(
      scope: TenantScope,
      id: string,
      patch: Partial<Pick<ProvisionJobRecord<T>, "status" | "result" | "error">>,
    ): Promise<ProvisionJobRecord<T>> {
      const now = new Date();
      const existing = await db
        .select()
        .from(provisionJobs)
        .where(and(eq(provisionJobs.tenantId, scope.tenantId), eq(provisionJobs.id, id)))
        .limit(1);
      const row = existing[0];
      if (!row) throw new Error(`provision job not found: ${id}`);
      const next: ProvisionJobRow = {
        ...row,
        status: patch.status ?? row.status,
        result: patch.result !== undefined ? (patch.result as unknown) : row.result,
        error: patch.error !== undefined ? patch.error : row.error,
        updatedAt: now,
      };
      await db
        .update(provisionJobs)
        .set({
          status: next.status,
          result: next.result,
          error: next.error,
          updatedAt: now,
        })
        .where(and(eq(provisionJobs.tenantId, scope.tenantId), eq(provisionJobs.id, id)));
      return rowToRecord(next) as ProvisionJobRecord<T>;
    },

    async get(scope, id) {
      const rows = await db
        .select()
        .from(provisionJobs)
        .where(and(eq(provisionJobs.tenantId, scope.tenantId), eq(provisionJobs.id, id)))
        .limit(1);
      const row = rows[0];
      return row ? rowToRecord(row) : undefined;
    },

    async recent(scope, limit = 20) {
      const rows = await db
        .select()
        .from(provisionJobs)
        .where(eq(provisionJobs.tenantId, scope.tenantId))
        .orderBy(desc(provisionJobs.updatedAt))
        .limit(limit);
      return rows.map(rowToRecord);
    },
  };
}

function rowToRecord(row: ProvisionJobRow): ProvisionJobRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId,
    status: row.status as ProvisionJobStatus,
    ...(row.result !== null && row.result !== undefined ? { result: row.result } : {}),
    ...(row.error !== null && row.error !== undefined ? { error: row.error } : {}),
    queuedAt: row.queuedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
