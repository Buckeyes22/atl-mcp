import type { TraceLink } from "../../../src/domain/traceLink.js";
import type { TenantScope } from "../../../src/domain/tenantScope.js";
import type { TraceLinkRepository } from "../../../src/storage/repositories/traceLinkRepository.js";

export function createInMemoryTraceLinkRepository(): TraceLinkRepository {
  const links: TraceLink[] = [];
  return {
    async create(scope: TenantScope, link: TraceLink): Promise<TraceLink> {
      if (link.tenantId !== scope.tenantId) throw new Error("tenant mismatch");
      links.push(link);
      return link;
    },
    async findByProject(_scope, projectId) {
      return links.filter((link) => link.projectId === projectId);
    },
    async findBySource(_scope, kind, id) {
      return links.filter((link) => link.source.kind === kind && link.source.id === id);
    },
    async delete(_scope, id) {
      const index = links.findIndex((link) => link.id === id);
      if (index >= 0) links.splice(index, 1);
    },
  };
}
