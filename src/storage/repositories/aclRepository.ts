import { and, eq } from "drizzle-orm";
import type { Database } from "../db.js";
import { aclEntries, type NewAclEntryRow } from "../schema/aclEntries.js";
import type { AclEntry } from "../../domain/aclEntry.js";
import type { TenantScope } from "../../domain/tenantScope.js";

export interface AclRepository {
  upsert(scope: TenantScope, entry: AclEntry): Promise<AclEntry>;
  find(
    scope: TenantScope,
    args: { projectId: string; artifactKind: string; artifactId: string; principalId: string },
  ): Promise<AclEntry | undefined>;
  invalidate(scope: TenantScope, args: { projectId: string; artifactKind: string; artifactId: string }): Promise<void>;
}

export function createAclRepository(db: Database): AclRepository {
  return {
    async upsert(scope, entry) {
      if (entry.tenantId !== scope.tenantId) {
        throw new Error(`aclEntry.tenantId must match scope`);
      }
      const row: NewAclEntryRow = {
        tenantId: entry.tenantId,
        projectId: entry.projectId,
        artifactKind: entry.artifactRef.kind,
        artifactId: entry.artifactRef.id,
        principalId: entry.principalId,
        decision: entry.decision,
        classification: entry.classification,
        source: entry.source,
        payload: entry,
        observedAt: new Date(entry.observedAt),
      };
      await db
        .insert(aclEntries)
        .values(row)
        .onConflictDoUpdate({
          target: [
            aclEntries.tenantId,
            aclEntries.projectId,
            aclEntries.artifactKind,
            aclEntries.artifactId,
            aclEntries.principalId,
          ],
          set: {
            decision: entry.decision,
            classification: entry.classification,
            source: entry.source,
            payload: entry,
            observedAt: new Date(entry.observedAt),
          },
        });
      return entry;
    },

    async find(scope, args) {
      const rows = await db
        .select()
        .from(aclEntries)
        .where(
          and(
            eq(aclEntries.tenantId, scope.tenantId),
            eq(aclEntries.projectId, args.projectId),
            eq(aclEntries.artifactKind, args.artifactKind),
            eq(aclEntries.artifactId, args.artifactId),
            eq(aclEntries.principalId, args.principalId),
          ),
        )
        .limit(1);
      const row = rows[0];
      return row ? (row.payload as AclEntry) : undefined;
    },

    async invalidate(scope, args) {
      await db
        .delete(aclEntries)
        .where(
          and(
            eq(aclEntries.tenantId, scope.tenantId),
            eq(aclEntries.projectId, args.projectId),
            eq(aclEntries.artifactKind, args.artifactKind),
            eq(aclEntries.artifactId, args.artifactId),
          ),
        );
    },
  };
}
