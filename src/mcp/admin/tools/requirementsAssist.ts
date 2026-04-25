import { z } from "zod";
import { defaultTenantScope } from "../../../domain/tenantScope.js";
import { createBlueprintWorkflow } from "../../../workflows/blueprintWorkflow.js";
import { createIntakeWorkflow } from "../../../workflows/intakeWorkflow.js";
import { scoreProjectContentQuality } from "../../../workflows/contentQualityScorer.js";
import { appendOperatorAudit } from "../auditedWrite.js";
import type { AdminToolDeps } from "../registry.js";
import type { ToolRegistry } from "../../toolRegistry.js";

const BRIEF_INPUT = z.object({
  name: z.string().min(1),
  mimeType: z.string().optional(),
  text: z.string().optional(),
  uioSourceId: z.string().optional(),
  garageKey: z.string().optional(),
}).strict();

const ASSIST_INPUT = z.object({
  name: z.string().min(1),
  key: z.string().min(1),
  description: z.string().min(1),
  briefs: z.array(BRIEF_INPUT).optional(),
  operatorBadge: z.string().optional(),
}).strict();

const GENERATE_INPUT = z.object({
  projectId: z.string().min(1),
  useSampling: z.boolean().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  operatorBadge: z.string().optional(),
}).strict();

const PROVISION_PREVIEW_INPUT = z.object({
  projectId: z.string().min(1).optional(),
  projectKey: z.string().min(1).optional(),
  jiraProjectKey: z.string().min(1).optional(),
}).strict();

export function registerRequirementsAssistAdminTools(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.requirements.assist.preview",
      description: "Preview normalized requirements from pasted project text and brief excerpts. No persistence or Jira writes.",
      inputSchema: assistSchema(false),
      annotations: { title: "Admin: requirements assist preview", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler(raw) {
      const input = ASSIST_INPUT.parse(raw);
      const markdown = intakeMarkdown(input);
      const output = {
        key: normalizeKey(input.key),
        name: input.name,
        markdown,
        suggestedRequirements: suggestedRequirements(markdown),
        sourceCount: 1 + (input.briefs ?? []).length,
        uioRefs: (input.briefs ?? []).filter((brief) => brief.uioSourceId || brief.garageKey).length,
      };
      return json(output);
    },
  });

  registry.register({
    definition: {
      name: "admin.requirements.assist.create_intake",
      description: "Create a draft project intake from Requirements Assist text and uploaded brief excerpts. Audit-logged.",
      inputSchema: assistSchema(true),
      annotations: { title: "Admin: requirements assist create intake", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async handler(raw) {
      const input = ASSIST_INPUT.parse(raw);
      const scope = defaultTenantScope();
      const workflow = createIntakeWorkflow({
        projectRepository: deps.repositories.project,
        ...(deps.providers.uio ? { uio: deps.providers.uio } : {}),
      });
      const result = await workflow.create(scope, {
        name: input.name,
        key: normalizeKey(input.key),
        source: { kind: "raw_markdown", markdown: intakeMarkdown(input) },
      });
      const audit = await appendOperatorAudit(deps, {
        tool: "admin.requirements.assist.create_intake",
        input,
        projectId: result.blueprint.id,
        ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
        outputArtifactIds: [`blueprint:${result.blueprint.id}`],
      });
      return json({
        projectId: result.blueprint.id,
        projectKey: result.blueprint.key,
        state: result.blueprint.state,
        sourcePins: result.blueprint.sourcePins,
        auditEntryId: audit.id,
      });
    },
  });

  registry.register({
    definition: {
      name: "admin.requirements.assist.generate_blueprint",
      description: "Generate a normalized blueprint from a Requirements Assist intake. Audit-logged.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string" },
          useSampling: { type: "boolean" },
          temperature: { type: "number" },
          maxTokens: { type: "number" },
          operatorBadge: { type: "string" },
        },
        required: ["projectId"],
        additionalProperties: false,
      },
      annotations: { title: "Admin: requirements assist blueprint", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async handler(raw) {
      const input = GENERATE_INPUT.parse(raw);
      const scope = defaultTenantScope();
      const workflow = createBlueprintWorkflow({
        projectRepository: deps.repositories.project,
        velocityRegistry: deps.velocityRegistry,
      });
      const result = await workflow.generate(scope, {
        projectId: input.projectId,
        ...(input.useSampling !== undefined ? { useSampling: input.useSampling } : {}),
        ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
        ...(input.maxTokens !== undefined ? { maxTokens: input.maxTokens } : {}),
      });
      const audit = await appendOperatorAudit(deps, {
        tool: "admin.requirements.assist.generate_blueprint",
        input,
        projectId: result.blueprint.id,
        ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
        outputArtifactIds: [`blueprint:${result.blueprint.id}:v${result.blueprint.blueprintVersion}`],
      });
      return json({
        projectId: result.blueprint.id,
        projectKey: result.blueprint.key,
        state: result.blueprint.state,
        blueprintVersion: result.blueprint.blueprintVersion,
        requirements: result.blueprint.requirements,
        epics: result.blueprint.epics,
        openQuestions: result.blueprint.openQuestions,
        validation: result.validation,
        sampling: result.sampling,
        auditEntryId: audit.id,
      });
    },
  });

  registry.register({
    definition: {
      name: "admin.requirements.assist.provision_preview",
      description: "Preview the Jira issue tree for a Requirements Assist project. No Jira writes.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string" },
          projectKey: { type: "string" },
          jiraProjectKey: { type: "string" },
        },
        additionalProperties: false,
      },
      annotations: { title: "Admin: requirements assist Jira preview", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler(raw) {
      const input = PROVISION_PREVIEW_INPUT.parse(raw);
      const scope = defaultTenantScope();
      const project = await findProject(deps, input);
      const plannedNodes = project.epics.flatMap((epic) => [
        { kind: "epic" as const, nodeId: epic.id, title: epic.title },
        ...epic.stories.map((story) => ({ kind: "story" as const, nodeId: story.id, title: story.title })),
      ]);
      const quality = scoreProjectContentQuality({ project });
      return json({
        projectId: project.id,
        projectKey: project.key,
        jiraProjectKey: input.jiraProjectKey ?? project.atlassianProjectKey ?? project.key,
        plannedNodes,
        totalNodes: plannedNodes.length,
        quality,
      });
    },
  });
}

async function findProject(deps: AdminToolDeps, input: z.infer<typeof PROVISION_PREVIEW_INPUT>) {
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

function intakeMarkdown(input: z.infer<typeof ASSIST_INPUT>): string {
  const sourceText = [
    input.description,
    ...(input.briefs ?? []).map((brief) => brief.text ?? ""),
  ].join("\n");
  const requirements = suggestedRequirements(sourceText);
  const lines = [
    `# ${input.name}`,
    "",
    "## Goals",
    `- Deliver ${input.name}.`,
    "",
    "## Requirements",
    ...(requirements.length > 0
      ? requirements.map((requirement) => {
        const title = /\bAcceptance:\s*/i.test(requirement.title)
          ? requirement.title
          : `${requirement.title} Acceptance: Requirement is reviewed and accepted.`;
        return `- ${requirement.priority}: ${title}`;
      })
      : [`- must: ${input.description.trim()} Acceptance: Requirement is reviewed and accepted.`]),
    "",
    "## Testing",
    "- UT: generated blueprint and Jira preview are covered by workflow tests",
    "",
    "## Project description",
    input.description.trim(),
  ];
  for (const brief of input.briefs ?? []) {
    lines.push("", `## Brief: ${brief.name}`);
    if (brief.mimeType) lines.push(`MIME: ${brief.mimeType}`);
    if (brief.text) lines.push(brief.text.trim());
    if (brief.uioSourceId) lines.push(`UIO source: ${brief.uioSourceId}`);
    if (brief.garageKey) lines.push(`UIO file upload: ${brief.garageKey}`);
  }
  return lines.join("\n").trim() + "\n";
}

function suggestedRequirements(markdown: string): readonly { readonly title: string; readonly priority: string }[] {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^(must|should|could|wont)\s*:/i.test(line))
    .map((line) => {
      const [priority, ...rest] = line.split(":");
      return { priority: (priority ?? "must").toLowerCase(), title: rest.join(":").trim() };
    });
}

function normalizeKey(key: string): string {
  return key.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "REQ";
}

function assistSchema(requireOperator: boolean) {
  return {
    type: "object" as const,
    properties: {
      name: { type: "string" },
      key: { type: "string" },
      description: { type: "string" },
      briefs: {
        type: "array",
        items: {
          type: "object" as const,
          properties: {
            name: { type: "string" },
            mimeType: { type: "string" },
            text: { type: "string" },
            uioSourceId: { type: "string" },
            garageKey: { type: "string" },
          },
          required: ["name"],
          additionalProperties: false,
        },
      },
      operatorBadge: { type: "string" },
    },
    required: requireOperator ? ["name", "key", "description"] : ["name", "key", "description"],
    additionalProperties: false,
  };
}

function json(output: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
    structuredContent: output,
  };
}
