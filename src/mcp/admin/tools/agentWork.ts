import { randomUUID } from "node:crypto";
import { z } from "zod";
import { defaultTenantScope } from "../../../domain/tenantScope.js";
import type { WorkAssignmentRecord, WorkRef } from "../../../domain/workAssignment.js";
import { classifyWorkItem, recommendAgentsForWork } from "../../../workflows/workClassification.js";
import { appendOperatorAudit } from "../auditedWrite.js";
import type { AdminToolDeps } from "../registry.js";
import type { ToolRegistry } from "../../toolRegistry.js";

const WORK_REF = z.object({
  kind: z.enum(["blueprint_story", "blueprint_task", "jira_issue"]),
  id: z.string().min(1),
  title: z.string().optional(),
}).strict();

const PROJECT_WORK_INPUT = z.object({
  projectKey: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  workRef: WORK_REF,
}).strict();

const LIST_INPUT = z.object({
  projectKey: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
}).strict();

const ASSIGN_INPUT = PROJECT_WORK_INPUT.extend({
  assignedAgentId: z.string().min(1),
  assignedBy: z.string().min(1),
  reason: z.string().min(4),
  operatorBadge: z.string().optional(),
}).strict();

export function registerAgentWorkAdminTools(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.agent.work.classify",
      description: "Classify a blueprint story, task, or Jira issue for developer assignment. Read-only.",
      inputSchema: projectWorkSchema(),
      annotations: { title: "Admin: classify work", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler(raw) {
      const input = PROJECT_WORK_INPUT.parse(raw);
      const project = await resolveProject(deps, input);
      const item = resolveWorkItem(project, normalizeWorkRef(input.workRef));
      const classification = classifyWorkItem(item);
      return json({ projectId: project.id, projectKey: project.key, workItem: item, classification });
    },
  });

  registry.register({
    definition: {
      name: "admin.agent.work.recommend",
      description: "Classify work and rank matching live/persisted agents. Read-only.",
      inputSchema: projectWorkSchema(),
      annotations: { title: "Admin: recommend agents", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler(raw) {
      const input = PROJECT_WORK_INPUT.parse(raw);
      const scope = defaultTenantScope();
      const project = await resolveProject(deps, input);
      const item = resolveWorkItem(project, normalizeWorkRef(input.workRef));
      const classification = classifyWorkItem(item);
      const recommendations = recommendAgentsForWork({
        classification,
        sessions: deps.agentSessionRegistry.list().map((session) => ({
          sessionId: session.sessionId,
          protocolVersion: session.negotiatedProtocolVersion,
          ...(session.clientInfo?.name ? { clientName: session.clientInfo.name } : {}),
          ...(session.clientInfo?.version ? { clientVersion: session.clientInfo.version } : {}),
          negotiatedAt: session.negotiatedAt,
          featuresEnabled: session.featuresEnabled,
          featuresDisabled: session.featuresDisabled,
        })),
        profiles: await deps.repositories.mcpSessionProfile.list(scope),
      });
      return json({ projectId: project.id, projectKey: project.key, workItem: item, classification, recommendations });
    },
  });

  registry.register({
    definition: {
      name: "admin.agent.work.assign",
      description: "Confirm a developer-selected agent assignment for a story/task. Audit-logged.",
      inputSchema: {
        ...projectWorkSchema(),
        properties: {
          ...projectWorkSchema().properties,
          assignedAgentId: { type: "string" },
          assignedBy: { type: "string" },
          reason: { type: "string", minLength: 4 },
          operatorBadge: { type: "string" },
        },
        required: ["workRef", "assignedAgentId", "assignedBy", "reason"],
      },
      annotations: { title: "Admin: assign work", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async handler(raw) {
      const input = ASSIGN_INPUT.parse(raw);
      const scope = defaultTenantScope();
      const project = await resolveProject(deps, input);
      const item = resolveWorkItem(project, normalizeWorkRef(input.workRef));
      const classification = classifyWorkItem(item);
      const recommendations = recommendAgentsForWork({
        classification,
        sessions: deps.agentSessionRegistry.list().map((session) => ({
          sessionId: session.sessionId,
          protocolVersion: session.negotiatedProtocolVersion,
          ...(session.clientInfo?.name ? { clientName: session.clientInfo.name } : {}),
          ...(session.clientInfo?.version ? { clientVersion: session.clientInfo.version } : {}),
          negotiatedAt: session.negotiatedAt,
          featuresEnabled: session.featuresEnabled,
          featuresDisabled: session.featuresDisabled,
        })),
        profiles: await deps.repositories.mcpSessionProfile.list(scope),
      });
      const now = new Date().toISOString();
      const existing = await deps.repositories.workAssignment.findByWorkRef(scope, {
        projectId: project.id,
        workKind: input.workRef.kind,
        workId: input.workRef.id,
      });
      const base: WorkAssignmentRecord = existing ?? {
        id: randomUUID(),
        tenantId: scope.tenantId,
        projectId: project.id,
        workRef: { kind: input.workRef.kind, id: input.workRef.id, title: item.title },
        classification,
        recommendedAgents: recommendations,
        status: "suggested",
        createdAt: now,
        updatedAt: now,
      };
      const created = existing ? base : await deps.repositories.workAssignment.create(scope, base);
      const assignment = await deps.repositories.workAssignment.assign(scope, {
        id: created.id,
        assignedAgentId: input.assignedAgentId,
        assignedBy: input.assignedBy,
        updatedAt: now,
      });
      const audit = await appendOperatorAudit(deps, {
        tool: "admin.agent.work.assign",
        input,
        projectId: project.id,
        operatorBadge: input.operatorBadge ?? input.assignedBy,
        outputArtifactIds: [`work-assignment:${assignment.id}`],
      });
      return json({ assignment, auditEntryId: audit.id });
    },
  });

  registry.register({
    definition: {
      name: "admin.agent.work.list",
      description: "List developer work assignments for a project.",
      inputSchema: {
        type: "object",
        properties: { projectKey: { type: "string" }, projectId: { type: "string" } },
        additionalProperties: false,
      },
      annotations: { title: "Admin: list work assignments", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler(raw) {
      const input = LIST_INPUT.parse(raw);
      const scope = defaultTenantScope();
      const project = await resolveProject(deps, input);
      const assignments = await deps.repositories.workAssignment.listByProject(scope, project.id);
      return json({ projectId: project.id, projectKey: project.key, assignments });
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

function normalizeWorkRef(ref: z.infer<typeof WORK_REF>): WorkRef {
  return {
    kind: ref.kind,
    id: ref.id,
    ...(ref.title ? { title: ref.title } : {}),
  };
}

function resolveWorkItem(project: Awaited<ReturnType<typeof resolveProject>>, ref: WorkRef) {
  if (ref.kind === "blueprint_story" || ref.kind === "blueprint_task") {
    const story = project.epics.flatMap((epic) => epic.stories).find((candidate) => candidate.id === ref.id);
    if (story) {
      return {
        workRef: { ...ref, title: story.title },
        title: story.title,
        description: story.userStory,
        acceptanceCriteria: story.acceptanceCriteria,
        labels: [project.key, story.estimatedComplexity],
      };
    }
  }
  return {
    workRef: ref,
    title: ref.title ?? ref.id,
    description: "",
    acceptanceCriteria: [],
    labels: [project.key],
  };
}

function projectWorkSchema() {
  return {
    type: "object" as const,
    properties: {
      projectKey: { type: "string" },
      projectId: { type: "string" },
      workRef: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["blueprint_story", "blueprint_task", "jira_issue"] },
          id: { type: "string" },
          title: { type: "string" },
        },
        required: ["kind", "id"],
        additionalProperties: false,
      },
    },
    required: ["workRef"],
    additionalProperties: false,
  };
}

function json(output: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
    structuredContent: output,
  };
}
