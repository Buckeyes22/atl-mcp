import { and, eq } from "drizzle-orm";
import type { Database } from "../db.js";
import { contextPacks, type NewContextPackRow } from "../schema/contextPacks.js";
import type { ContextPack } from "../../domain/contextPack.js";
import type { TenantScope } from "../../domain/tenantScope.js";

export interface ContextPackRepository {
  insert(scope: TenantScope, pack: ContextPack): Promise<ContextPack>;
  findById(scope: TenantScope, id: string): Promise<ContextPack | undefined>;
  findByRegenerationKey(scope: TenantScope, regenerationKey: string): Promise<ContextPack | undefined>;
}

export function createContextPackRepository(db: Database): ContextPackRepository {
  return {
    async insert(scope, pack) {
      if (pack.tenantId !== scope.tenantId) {
        throw new Error(`contextPack.tenantId must match scope`);
      }
      const row: NewContextPackRow = {
        id: pack.id,
        tenantId: pack.tenantId,
        projectId: pack.projectId,
        issueKey: pack.issueKey ?? null,
        regenerationKey: pack.regenerationKey,
        payload: pack,
        generatedAt: new Date(pack.generatedAt),
      };
      await db.insert(contextPacks).values(row);
      return pack;
    },

    async findById(scope, id) {
      const rows = await db
        .select()
        .from(contextPacks)
        .where(and(eq(contextPacks.tenantId, scope.tenantId), eq(contextPacks.id, id)))
        .limit(1);
      const row = rows[0];
      return row ? (row.payload as ContextPack) : undefined;
    },

    async findByRegenerationKey(scope, regenerationKey) {
      const rows = await db
        .select()
        .from(contextPacks)
        .where(
          and(
            eq(contextPacks.tenantId, scope.tenantId),
            eq(contextPacks.regenerationKey, regenerationKey),
          ),
        )
        .limit(1);
      const row = rows[0];
      return row ? (row.payload as ContextPack) : undefined;
    },
  };
}
