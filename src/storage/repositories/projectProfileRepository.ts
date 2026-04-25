import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../db.js";
import { projectProfiles, type NewProjectProfileRow } from "../schema/projectProfiles.js";
import type { ProjectProfile } from "../../domain/projectProfile.js";
import type { TenantScope } from "../../domain/tenantScope.js";

export interface ProjectProfileRepository {
  insert(scope: TenantScope, profile: ProjectProfile): Promise<ProjectProfile>;
  findById(scope: TenantScope, id: string): Promise<ProjectProfile | undefined>;
  findLatestForProject(scope: TenantScope, projectId: string): Promise<ProjectProfile | undefined>;
}

export function createProjectProfileRepository(db: Database): ProjectProfileRepository {
  return {
    async insert(scope, profile) {
      if (profile.tenantId !== scope.tenantId) {
        throw new Error(`projectProfile.tenantId must match scope`);
      }
      const row: NewProjectProfileRow = {
        id: profile.id,
        tenantId: profile.tenantId,
        projectId: profile.projectId,
        payload: profile,
        generatedAt: new Date(profile.generatedAt),
        expiresAt: new Date(profile.expiresAt),
      };
      await db.insert(projectProfiles).values(row);
      return profile;
    },

    async findById(scope, id) {
      const rows = await db
        .select()
        .from(projectProfiles)
        .where(and(eq(projectProfiles.tenantId, scope.tenantId), eq(projectProfiles.id, id)))
        .limit(1);
      const row = rows[0];
      return row ? (row.payload as ProjectProfile) : undefined;
    },

    async findLatestForProject(scope, projectId) {
      const rows = await db
        .select()
        .from(projectProfiles)
        .where(
          and(
            eq(projectProfiles.tenantId, scope.tenantId),
            eq(projectProfiles.projectId, projectId),
          ),
        )
        .orderBy(desc(projectProfiles.generatedAt))
        .limit(1);
      const row = rows[0];
      return row ? (row.payload as ProjectProfile) : undefined;
    },
  };
}
