import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { ArtifactRef } from "../../../domain/artifactRef.js";
import type { ContentQualityReport } from "../../../domain/contentQuality.js";
import { defaultTenantScope } from "../../../domain/tenantScope.js";
import { scoreProjectContentQuality } from "../../../workflows/contentQualityScorer.js";
import { appendOperatorAudit } from "../auditedWrite.js";
import type { AdminToolDeps } from "../registry.js";
import type { ToolRegistry } from "../../toolRegistry.js";

const PROJECT_INPUT = z.object({
  projectId: z.string().min(1).optional(),
  projectKey: z.string().min(1).optional(),
  operatorBadge: z.string().optional(),
}).strict();

const ARTIFACT_INPUT = PROJECT_INPUT.extend({
  artifactRef: z.object({
    kind: z.string().min(1),
    id: z.string().min(1),
    url: z.string().optional(),
    version: z.string().optional(),
  }).strict(),
}).strict();

export function registerQualityAdminTools(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.quality.score.project",
      description: "Score project content quality and trustworthiness. Deterministic by default; LLM critique is reported unavailable unless configured later.",
      inputSchema: projectSchema(true),
      annotations: { title: "Admin: score project quality", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async handler(raw) {
      const input = PROJECT_INPUT.parse(raw);
      const scope = defaultTenantScope();
      const project = await resolveProject(deps, input);
      const score = scoreProjectContentQuality({ project });
      const report: ContentQualityReport = {
        id: randomUUID(),
        tenantId: scope.tenantId,
        projectId: project.id,
        artifactRef: { kind: "blueprint_section", id: project.id },
        ...score,
        llmCritique: { status: "unavailable" },
        generatedAt: new Date().toISOString(),
      };
      const persisted = await deps.repositories.contentQualityReport.insert(scope, report);
      const audit = await appendOperatorAudit(deps, {
        tool: "admin.quality.score.project",
        input,
        projectId: project.id,
        ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
        outputArtifactIds: [`content-quality:${persisted.id}`],
      });
      return json({ report: persisted, auditEntryId: audit.id });
    },
  });

  registry.register({
    definition: {
      name: "admin.quality.score.artifact",
      description: "Score a specific project artifact using the project quality rubric. Persists a report for the artifact ref.",
      inputSchema: artifactSchema(),
      annotations: { title: "Admin: score artifact quality", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async handler(raw) {
      const input = ARTIFACT_INPUT.parse(raw);
      const scope = defaultTenantScope();
      const project = await resolveProject(deps, input);
      const score = scoreProjectContentQuality({ project });
      const artifactRef = normalizeArtifactRef(input.artifactRef);
      const report: ContentQualityReport = {
        id: randomUUID(),
        tenantId: scope.tenantId,
        projectId: project.id,
        artifactRef,
        ...score,
        llmCritique: { status: "unavailable" },
        generatedAt: new Date().toISOString(),
      };
      const persisted = await deps.repositories.contentQualityReport.insert(scope, report);
      const audit = await appendOperatorAudit(deps, {
        tool: "admin.quality.score.artifact",
        input,
        projectId: project.id,
        ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
        outputArtifactIds: [`content-quality:${persisted.id}`],
      });
      return json({ report: persisted, auditEntryId: audit.id });
    },
  });

  registry.register({
    definition: {
      name: "admin.quality.reports.list",
      description: "List persisted content quality reports for a project.",
      inputSchema: projectSchema(false),
      annotations: { title: "Admin: list quality reports", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler(raw) {
      const input = PROJECT_INPUT.parse(raw);
      const scope = defaultTenantScope();
      const project = await resolveProject(deps, input);
      const reports = await deps.repositories.contentQualityReport.listByProject(scope, project.id);
      return json({ projectId: project.id, projectKey: project.key, reports });
    },
  });
}

interface ProjectLocator {
  readonly projectId?: string | undefined;
  readonly projectKey?: string | undefined;
}

async function resolveProject(deps: AdminToolDeps, input: ProjectLocator) {
  const scope = defaultTenantScope();
  if (input.projectId) {
    const project = await deps.repositories.project.findById(scope, input.projectId);
    if (project) return project;
  }
  if (input.projectKey) {
    const project = await deps.repositories.project.findByKey(scope, input.projectKey);
    if (project) return project;
  }
  throw new Error("projectId or projectKey must resolve to an existing project");
}

function normalizeArtifactRef(input: z.infer<typeof ARTIFACT_INPUT>["artifactRef"]): ArtifactRef {
  return {
    kind: input.kind as ArtifactRef["kind"],
    id: input.id,
    ...(input.url ? { url: input.url } : {}),
    ...(input.version ? { version: input.version } : {}),
  };
}

function projectSchema(includeOperator: boolean) {
  return {
    type: "object" as const,
    properties: {
      projectId: { type: "string" },
      projectKey: { type: "string" },
      ...(includeOperator ? { operatorBadge: { type: "string" } } : {}),
    },
    additionalProperties: false,
  };
}

function artifactSchema() {
  return {
    type: "object" as const,
    properties: {
      projectId: { type: "string" },
      projectKey: { type: "string" },
      operatorBadge: { type: "string" },
      artifactRef: {
        type: "object" as const,
        properties: {
          kind: { type: "string" },
          id: { type: "string" },
          url: { type: "string" },
          version: { type: "string" },
        },
        required: ["kind", "id"],
        additionalProperties: false,
      },
    },
    required: ["artifactRef"],
    additionalProperties: false,
  };
}

function json(output: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
    structuredContent: output,
  };
}
