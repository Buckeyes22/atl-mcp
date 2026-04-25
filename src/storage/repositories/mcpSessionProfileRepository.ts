import { and, eq } from "drizzle-orm";
import type { Database } from "../db.js";
import { mcpSessionProfiles, type NewMcpSessionProfileRow } from "../schema/mcpSessionProfiles.js";
import type { PersistedMcpSessionProfile } from "../../domain/mcpSessionProfile.js";
import type { TenantScope } from "../../domain/tenantScope.js";

export interface McpSessionProfileRepository {
  upsert(scope: TenantScope, profile: PersistedMcpSessionProfile): Promise<PersistedMcpSessionProfile>;
  findById(scope: TenantScope, id: string): Promise<PersistedMcpSessionProfile | undefined>;
  list(scope: TenantScope): Promise<readonly PersistedMcpSessionProfile[]>;
}

export function createMcpSessionProfileRepository(db: Database): McpSessionProfileRepository {
  return {
    async upsert(scope, profile) {
      if (profile.tenantId !== scope.tenantId) {
        throw new Error(`profile.tenantId must match scope`);
      }
      const insertRow: NewMcpSessionProfileRow = {
        id: profile.id,
        tenantId: profile.tenantId,
        protocolVersion: profile.protocolVersion,
        clientName: profile.clientInfo.name,
        agentMode: profile.agentMode ?? null,
        payload: profile,
        createdAt: new Date(profile.createdAt),
        lastSeenAt: new Date(profile.lastSeenAt),
      };
      await db
        .insert(mcpSessionProfiles)
        .values(insertRow)
        .onConflictDoUpdate({
          target: mcpSessionProfiles.id,
          set: {
            protocolVersion: profile.protocolVersion,
            clientName: profile.clientInfo.name,
            agentMode: profile.agentMode ?? null,
            payload: profile,
            lastSeenAt: new Date(profile.lastSeenAt),
          },
        });
      return profile;
    },

    async findById(scope, id) {
      const rows = await db
        .select()
        .from(mcpSessionProfiles)
        .where(and(eq(mcpSessionProfiles.tenantId, scope.tenantId), eq(mcpSessionProfiles.id, id)))
        .limit(1);
      const row = rows[0];
      return row ? (row.payload as PersistedMcpSessionProfile) : undefined;
    },

    async list(scope) {
      const rows = await db
        .select()
        .from(mcpSessionProfiles)
        .where(eq(mcpSessionProfiles.tenantId, scope.tenantId));
      return rows.map((r) => r.payload as PersistedMcpSessionProfile);
    },
  };
}
