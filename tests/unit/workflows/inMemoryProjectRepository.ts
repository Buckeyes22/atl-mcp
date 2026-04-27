import { emptyBlueprint, type ProjectBlueprint } from "../../../src/domain/projectBlueprint.js";
import type { TenantScope } from "../../../src/domain/tenantScope.js";
import type { ProjectRepository } from "../../../src/storage/repositories/projectRepository.js";

export interface InMemoryProjectRepository extends ProjectRepository {
  seedIntakeProject(input: {
    readonly id: string;
    readonly tenantId: string;
    readonly name: string;
    readonly key: string;
    readonly rawMarkdown: string;
    readonly now: string;
  }): Promise<ProjectBlueprint>;
}

export function createInMemoryProjectRepository(): InMemoryProjectRepository {
  const projects = new Map<string, ProjectBlueprint>();
  return {
    async seedIntakeProject(input) {
      const blueprint = {
        ...emptyBlueprint(input, input.now),
        intake: {
          source: { kind: "raw_markdown" as const, markdown: input.rawMarkdown },
          capturedAt: input.now,
        },
      };
      projects.set(keyFor(input.tenantId, input.id), blueprint);
      return blueprint;
    },
    async create(scope, blueprint) {
      assertScope(scope, blueprint);
      projects.set(keyFor(scope.tenantId, blueprint.id), blueprint);
      return blueprint;
    },
    async findById(scope, id) {
      return projects.get(keyFor(scope.tenantId, id));
    },
    async findByKey(scope, key) {
      return [...projects.values()].find((p) => p.tenantId === scope.tenantId && p.key === key);
    },
    async update(scope, blueprint) {
      assertScope(scope, blueprint);
      projects.set(keyFor(scope.tenantId, blueprint.id), blueprint);
      return blueprint;
    },
    async list(scope) {
      return [...projects.values()].filter((p) => p.tenantId === scope.tenantId);
    },
  };
}

function keyFor(tenantId: string, projectId: string): string {
  return `${tenantId}:${projectId}`;
}

function assertScope(scope: TenantScope, blueprint: ProjectBlueprint): void {
  if (scope.tenantId !== blueprint.tenantId) {
    throw new Error("tenant mismatch");
  }
}
