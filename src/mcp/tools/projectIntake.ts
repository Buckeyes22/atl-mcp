import { z } from "zod";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { IntakeSource } from "../../domain/projectIntake.js";
import type { TenantScope } from "../../domain/tenantScope.js";
import type { BlueprintWorkflow } from "../../workflows/blueprintWorkflow.js";
import type { BlueprintReviseWorkflow } from "../../workflows/blueprintReviseWorkflow.js";
import type { IntakeWorkflow } from "../../workflows/intakeWorkflow.js";
import type { ToolRegistry } from "../toolRegistry.js";

const RAW_SOURCE = z.object({ kind: z.literal("raw_markdown"), markdown: z.string().min(1) });
const UIO_DOC_SOURCE = z.object({
  kind: z.literal("uio_document"),
  uioSourceId: z.string().min(1),
  uioChunkIndices: z.array(z.number().int().nonnegative()).optional(),
});
const UIO_FILE_SOURCE = z.object({
  kind: z.literal("uio_file_upload"),
  garageKey: z.string().min(1),
  mimeType: z.string().min(1),
});
const INTAKE_INPUT = z.object({
  projectId: z.string().min(1).optional(),
  name: z.string().min(1),
  key: z.string().min(1),
  source: z.discriminatedUnion("kind", [RAW_SOURCE, UIO_DOC_SOURCE, UIO_FILE_SOURCE]),
});
const GENERATE_INPUT = z.object({
  projectId: z.string().min(1),
  useSampling: z.boolean().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
});
const UPDATE_INPUT = z.object({
  projectId: z.string().min(1),
  patch: z.unknown(),
});
const REVISE_INPUT = z.object({
  projectId: z.string().min(1),
  revisionRequest: z.string().min(4),
  useSampling: z.boolean().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
});

export interface ProjectIntakeToolsDeps {
  readonly registry: ToolRegistry;
  readonly resolveScope: () => TenantScope;
  readonly intakeWorkflow: IntakeWorkflow;
  readonly blueprintWorkflow: BlueprintWorkflow;
  readonly reviseWorkflow?: BlueprintReviseWorkflow;
}

export function registerProjectIntakeTools(deps: ProjectIntakeToolsDeps): void {
  deps.registry.register({
    definition: {
      name: "project_intake_create",
      description: "Capture raw markdown or UIO-backed requirements and create a draft project intake.",
      inputSchema: intakeSchema(),
      annotations: { title: "Project intake create", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async handler(raw) {
      const params = INTAKE_INPUT.parse(raw);
      const result = await deps.intakeWorkflow.create(deps.resolveScope(), {
        name: params.name,
        key: params.key,
        source: normalizeSource(params.source),
        ...(params.projectId !== undefined ? { projectId: params.projectId } : {}),
      });
      const output = { projectId: result.blueprint.id, state: result.blueprint.state, sourcePins: result.blueprint.sourcePins };
      return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
    },
  });

  deps.registry.register({
    definition: {
      name: "project_blueprint_generate",
      description: "Generate a normalized ProjectBlueprint from stored intake, using sampling when available.",
      inputSchema: generateSchema(),
      annotations: { title: "Project blueprint generate", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async handler(raw) {
      const params = GENERATE_INPUT.parse(raw);
      const result = await deps.blueprintWorkflow.generate(deps.resolveScope(), {
        projectId: params.projectId,
        ...(params.useSampling !== undefined ? { useSampling: params.useSampling } : {}),
        ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
        ...(params.maxTokens !== undefined ? { maxTokens: params.maxTokens } : {}),
      });
      const output = {
        projectId: result.blueprint.id,
        state: result.blueprint.state,
        blueprintVersion: result.blueprint.blueprintVersion,
        validation: result.validation,
        sampling: result.sampling,
        blueprint: result.blueprint,
      };
      return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
    },
  });

  deps.registry.register({
    definition: {
      name: "project_blueprint_update",
      description: "Apply a human-approved ProjectBlueprint patch and re-run validation.",
      inputSchema: updateSchema(),
      annotations: { title: "Project blueprint update", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async handler(raw) {
      const params = UPDATE_INPUT.parse(raw);
      const result = await deps.blueprintWorkflow.update(deps.resolveScope(), {
        projectId: params.projectId,
        patch: params.patch,
      });
      const output = {
        projectId: result.blueprint.id,
        state: result.blueprint.state,
        blueprintVersion: result.blueprint.blueprintVersion,
        validation: result.validation,
        blueprint: result.blueprint,
      };
      return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
    },
  });

  if (deps.reviseWorkflow) {
    const reviseWorkflow = deps.reviseWorkflow;
    deps.registry.register({
      definition: {
        name: "project_blueprint_revise",
        description: "Propose a ProjectBlueprint patch in response to an operator revision request. Read-only; the operator applies the patch via project_blueprint_update.",
        inputSchema: reviseSchema(),
        annotations: { title: "Project blueprint revise", readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
      },
      async handler(raw) {
        const params = REVISE_INPUT.parse(raw);
        const result = await reviseWorkflow.revise(deps.resolveScope(), {
          projectId: params.projectId,
          revisionRequest: params.revisionRequest,
          ...(params.useSampling !== undefined ? { useSampling: params.useSampling } : {}),
          ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
          ...(params.maxTokens !== undefined ? { maxTokens: params.maxTokens } : {}),
        });
        const output = {
          projectId: result.projectId,
          proposedPatch: result.proposedPatch,
          critiqueNotes: result.critiqueNotes,
          diff: result.diff,
          sampling: result.sampling,
        };
        return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
      },
    });
  }
}

function normalizeSource(source: z.infer<typeof INTAKE_INPUT>["source"]): IntakeSource {
  if (source.kind === "raw_markdown") return source;
  if (source.kind === "uio_file_upload") return source;
  return {
    kind: "uio_document",
    uioSourceId: source.uioSourceId,
    ...(source.uioChunkIndices !== undefined ? { uioChunkIndices: source.uioChunkIndices } : {}),
  };
}

function intakeSchema(): Tool["inputSchema"] {
  return {
    type: "object",
    properties: {
      projectId: { type: "string" },
      name: { type: "string" },
      key: { type: "string" },
      source: {
        oneOf: [
          { type: "object", properties: { kind: { const: "raw_markdown" }, markdown: { type: "string" } }, required: ["kind", "markdown"], additionalProperties: false },
          {
            type: "object",
            properties: { kind: { const: "uio_document" }, uioSourceId: { type: "string" }, uioChunkIndices: { type: "array", items: { type: "number" } } },
            required: ["kind", "uioSourceId"],
            additionalProperties: false,
          },
          { type: "object", properties: { kind: { const: "uio_file_upload" }, garageKey: { type: "string" }, mimeType: { type: "string" } }, required: ["kind", "garageKey", "mimeType"], additionalProperties: false },
        ],
      },
    },
    required: ["name", "key", "source"],
    additionalProperties: false,
  };
}

function generateSchema(): Tool["inputSchema"] {
  return {
    type: "object",
    properties: { projectId: { type: "string" }, useSampling: { type: "boolean" }, temperature: { type: "number" }, maxTokens: { type: "number" } },
    required: ["projectId"],
    additionalProperties: false,
  };
}

function updateSchema(): Tool["inputSchema"] {
  return {
    type: "object",
    properties: { projectId: { type: "string" }, patch: { type: "object" } },
    required: ["projectId", "patch"],
    additionalProperties: false,
  };
}

function reviseSchema(): Tool["inputSchema"] {
  return {
    type: "object",
    properties: {
      projectId: { type: "string" },
      revisionRequest: { type: "string", minLength: 4 },
      useSampling: { type: "boolean" },
      temperature: { type: "number" },
      maxTokens: { type: "number" },
    },
    required: ["projectId", "revisionRequest"],
    additionalProperties: false,
  };
}
