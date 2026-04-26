import { randomUUID } from "node:crypto";
import type { ArtifactRef } from "../../domain/artifactRef.js";
import type { TenantScope } from "../../domain/tenantScope.js";
import type { ConfluenceProvider } from "../../providers/atlassian/confluenceProvider.js";
import type { TraceLinkRepository } from "../../storage/repositories/traceLinkRepository.js";

export interface ConfluenceProvisionAction {
  readonly projectId: string;
  readonly blueprintRef: ArtifactRef;
  readonly spaceId: string;
  readonly title: string;
  readonly bodyStorage: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export function createConfluenceProvisionExecutor(deps: {
  readonly confluence: ConfluenceProvider;
  readonly traceLink: TraceLinkRepository;
}) {
  return {
    async execute(scope: TenantScope, action: ConfluenceProvisionAction): Promise<{ createdPageId?: string; skipped?: boolean }> {
      const existing = await deps.traceLink.findBySource(scope, action.blueprintRef.kind, action.blueprintRef.id);
      if (existing.some((link) => link.projectId === action.projectId && link.target.kind === "confluence_page")) {
        return { skipped: true };
      }
      const page = await deps.confluence.createPage({
        spaceId: action.spaceId,
        title: action.title,
        body: { representation: "storage", value: appendMetadataBlock(action.bodyStorage, action.metadata) },
        idempotencyKey: `${action.projectId}:${action.blueprintRef.id}:confluence`,
      });
      await deps.confluence.setContentProperty(page.id, "orchestrator.metadata", action.metadata);
      await deps.traceLink.create(scope, {
        id: randomUUID(),
        tenantId: scope.tenantId,
        projectId: action.projectId,
        source: action.blueprintRef,
        target: { kind: "confluence_page", id: page.id, version: String(page.version) },
        relation: "documents",
        createdAt: new Date().toISOString(),
        observedBy: "project_provision_execute",
      });
      return { createdPageId: page.id };
    },
  };
}

function appendMetadataBlock(body: string, metadata: Readonly<Record<string, unknown>>): string {
  return `${body}\n<!-- orchestrator-metadata: ${JSON.stringify(metadata)} -->`;
}
