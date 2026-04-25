// Project repository. Stores ProjectBlueprint as a row + JSONB blueprint payload.
// All public methods require a TenantScope; assertTenantMatches guards on read.

import { and, eq } from "drizzle-orm";
import type { Database } from "../db.js";
import { projects, type NewProjectRow, type ProjectRow } from "../schema/projects.js";
import type { ProjectBlueprint } from "../../domain/projectBlueprint.js";
import {
  assertTenantMatches,
  type TenantScope,
} from "../../domain/tenantScope.js";

export interface ProjectRepository {
  create(scope: TenantScope, blueprint: ProjectBlueprint): Promise<ProjectBlueprint>;
  findById(scope: TenantScope, id: string): Promise<ProjectBlueprint | undefined>;
  findByKey(scope: TenantScope, key: string): Promise<ProjectBlueprint | undefined>;
  update(scope: TenantScope, blueprint: ProjectBlueprint): Promise<ProjectBlueprint>;
  list(scope: TenantScope): Promise<readonly ProjectBlueprint[]>;
}

export function createProjectRepository(db: Database): ProjectRepository {
  return {
    async create(scope, blueprint) {
      if (blueprint.tenantId !== scope.tenantId) {
        throw new Error(`blueprint.tenantId (${blueprint.tenantId}) must match scope (${scope.tenantId})`);
      }
      const row: NewProjectRow = {
        id: blueprint.id,
        tenantId: blueprint.tenantId,
        key: blueprint.key,
        name: blueprint.name,
        state: blueprint.state,
        schemaVersion: blueprint.schemaVersion,
        blueprintVersion: blueprint.blueprintVersion,
        blueprint,
        createdAt: new Date(blueprint.createdAt),
        updatedAt: new Date(blueprint.updatedAt),
      };
      await db.insert(projects).values(row);
      return blueprint;
    },

    async findById(scope, id) {
      const rows = await db
        .select()
        .from(projects)
        .where(and(eq(projects.tenantId, scope.tenantId), eq(projects.id, id)))
        .limit(1);
      const row = rows[0];
      if (!row) return undefined;
      assertTenantMatches(scope, row, "projects");
      return rowToBlueprint(row);
    },

    async findByKey(scope, key) {
      const rows = await db
        .select()
        .from(projects)
        .where(and(eq(projects.tenantId, scope.tenantId), eq(projects.key, key)))
        .limit(1);
      const row = rows[0];
      if (!row) return undefined;
      assertTenantMatches(scope, row, "projects");
      return rowToBlueprint(row);
    },

    async update(scope, blueprint) {
      if (blueprint.tenantId !== scope.tenantId) {
        throw new Error(`blueprint.tenantId (${blueprint.tenantId}) must match scope (${scope.tenantId})`);
      }
      const result = await db
        .update(projects)
        .set({
          name: blueprint.name,
          state: blueprint.state,
          schemaVersion: blueprint.schemaVersion,
          blueprintVersion: blueprint.blueprintVersion,
          blueprint,
          updatedAt: new Date(blueprint.updatedAt),
        })
        .where(and(eq(projects.tenantId, scope.tenantId), eq(projects.id, blueprint.id)))
        .returning();
      if (result.length === 0) {
        throw new Error(`project not found for update: id=${blueprint.id} tenant=${scope.tenantId}`);
      }
      return blueprint;
    },

    async list(scope) {
      const rows = await db
        .select()
        .from(projects)
        .where(eq(projects.tenantId, scope.tenantId));
      return rows.map(rowToBlueprint);
    },
  };
}

function rowToBlueprint(row: ProjectRow): ProjectBlueprint {
  // The blueprint JSONB column contains the canonical ProjectBlueprint shape.
  return row.blueprint as ProjectBlueprint;
}
