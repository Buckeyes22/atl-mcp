import { z } from "zod";
import { AGENT_MEMORY_KINDS, type AgentMemoryKind } from "../../domain/agentMemory.js";
import type { ContextPack } from "../../domain/contextPack.js";
import type { ReadinessReport } from "../../storage/repositories/readinessRepository.js";
import type { ManifestSpawn } from "../../workflows/handoffWorkflow.js";
import type { GraphChangeEvent } from "../../workflows/webhookIngestionWorkflow.js";
import type { TenantScope } from "../../domain/tenantScope.js";
import type { ToolRegistry } from "../toolRegistry.js";

const CONTEXT_INPUT = z.object({ projectId: z.string(), issueKey: z.string().optional() });
const READINESS_INPUT = z.object({ projectId: z.string() });
const HANDOFF_INPUT = z.object({
  projectId: z.string(),
  issueKey: z.string(),
  objective: z.string(),
  acceptanceCriteria: z.array(z.string()),
});
const WEBHOOK_INPUT = z.object({
  source: z.string(),
  timestamp: z.string(),
  signatureHeader: z.string(),
  rawBody: z.string(),
});
const MEMORY_KIND = z.enum(AGENT_MEMORY_KINDS);
const MEMORY_SOURCE_REF = z.object({
  kind: z.string(),
  id: z.string(),
  uri: z.string().optional(),
  title: z.string().optional(),
});
const MEMORY_RETAIN_INPUT = z.object({
  projectId: z.string(),
  kind: MEMORY_KIND,
  text: z.string().min(1),
  tags: z.array(z.string()).optional(),
  issueKey: z.string().optional(),
  sourceRefs: z.array(MEMORY_SOURCE_REF).optional(),
  agentKey: z.string().optional(),
});
const MEMORY_RECALL_INPUT = z.object({
  projectId: z.string(),
  query: z.string().optional(),
  tags: z.array(z.string()).optional(),
  kind: MEMORY_KIND.optional(),
  kinds: z.array(MEMORY_KIND).optional(),
  issueKey: z.string().optional(),
  limit: z.number().int().positive().max(50).optional(),
  agentKey: z.string().optional(),
  includeVector: z.boolean().optional(),
});
const MEMORY_REFLECT_INPUT = z.object({
  projectId: z.string(),
  summary: z.string().min(1),
  sourceMemoryIds: z.array(z.string()).min(1),
  tags: z.array(z.string()).optional(),
  issueKey: z.string().optional(),
  agentKey: z.string().optional(),
});
const MEMORY_FORGET_INPUT = z.object({
  projectId: z.string(),
  memoryId: z.string(),
  reason: z.string().min(4),
  agentKey: z.string().optional(),
});

export interface WorkflowToolsDeps {
  readonly registry: ToolRegistry;
  readonly resolveScope: () => TenantScope;
  readonly generateContextPack?: (scope: TenantScope, input: z.infer<typeof CONTEXT_INPUT>) => Promise<ContextPack>;
  readonly getContextPack?: (scope: TenantScope, regenerationKey: string) => Promise<ContextPack | undefined>;
  readonly validateReadiness?: (scope: TenantScope, input: z.infer<typeof READINESS_INPUT>) => Promise<ReadinessReport>;
  readonly generateHandoff?: (input: z.infer<typeof HANDOFF_INPUT>) => ManifestSpawn;
  readonly ingestWebhook?: (scope: TenantScope, input: z.infer<typeof WEBHOOK_INPUT>) => Promise<{ readonly accepted: boolean; readonly event?: GraphChangeEvent }>;
  readonly memory?: {
    readonly retain: (scope: TenantScope, input: z.infer<typeof MEMORY_RETAIN_INPUT>) => Promise<unknown>;
    readonly recall: (scope: TenantScope, input: z.infer<typeof MEMORY_RECALL_INPUT>) => Promise<unknown>;
    readonly reflect: (scope: TenantScope, input: z.infer<typeof MEMORY_REFLECT_INPUT>) => Promise<unknown>;
    readonly forget: (scope: TenantScope, input: z.infer<typeof MEMORY_FORGET_INPUT>) => Promise<unknown>;
  };
}

export function registerProjectWorkflowTools(deps: WorkflowToolsDeps): void {
  if (deps.generateContextPack) {
    const generate = deps.generateContextPack;
    deps.registry.register({
      definition: {
        name: "context_pack_generate",
        description: "Generate a bounded, redacted context pack for a project or issue.",
        inputSchema: { type: "object", properties: { projectId: { type: "string" }, issueKey: { type: "string" } }, required: ["projectId"], additionalProperties: false },
        annotations: { title: "Context pack generate", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async handler(raw) {
        const params = CONTEXT_INPUT.parse(raw);
        const pack = await generate(deps.resolveScope(), params);
        return { content: [{ type: "text", text: JSON.stringify(pack, null, 2) }], structuredContent: pack };
      },
    });
  }

  if (deps.getContextPack) {
    const get = deps.getContextPack;
    deps.registry.register({
      definition: {
        name: "context_get",
        description: "Get a generated context pack by regeneration key.",
        inputSchema: { type: "object", properties: { regenerationKey: { type: "string" } }, required: ["regenerationKey"], additionalProperties: false },
        annotations: { title: "Context get", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async handler(raw) {
        const params = z.object({ regenerationKey: z.string() }).parse(raw);
        const pack = await get(deps.resolveScope(), params.regenerationKey);
        return { content: [{ type: "text", text: JSON.stringify({ found: Boolean(pack), pack }, null, 2) }], structuredContent: { found: Boolean(pack), pack } };
      },
    });
  }

  if (deps.validateReadiness) {
    const validate = deps.validateReadiness;
    deps.registry.register({
      definition: {
        name: "readiness_validate",
        description: "Validate deterministic project readiness and emit grade/verdict.",
        inputSchema: { type: "object", properties: { projectId: { type: "string" } }, required: ["projectId"], additionalProperties: false },
        annotations: { title: "Readiness validate", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async handler(raw) {
        const report = await validate(deps.resolveScope(), READINESS_INPUT.parse(raw));
        return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }], structuredContent: report };
      },
    });
  }

  if (deps.generateHandoff) {
    const handoff = deps.generateHandoff;
    deps.registry.register({
      definition: {
        name: "handoff_generate",
        description: "Generate a ManifestSpawn handoff with cross-host config text.",
        inputSchema: {
          type: "object",
          properties: { projectId: { type: "string" }, issueKey: { type: "string" }, objective: { type: "string" }, acceptanceCriteria: { type: "array", items: { type: "string" } } },
          required: ["projectId", "issueKey", "objective", "acceptanceCriteria"],
          additionalProperties: false,
        },
        annotations: { title: "Handoff generate", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async handler(raw) {
        const manifest = handoff(HANDOFF_INPUT.parse(raw));
        return { content: [{ type: "text", text: JSON.stringify(manifest, null, 2) }], structuredContent: manifest };
      },
    });
  }

  if (deps.ingestWebhook) {
    const ingest = deps.ingestWebhook;
    deps.registry.register({
      definition: {
        name: "webhook_ingest",
        description: "Normalize and deduplicate webhook payloads into graph change events.",
        inputSchema: {
          type: "object",
          properties: {
            source: { type: "string" },
            timestamp: { type: "string" },
            signatureHeader: { type: "string" },
            rawBody: { type: "string" },
          },
          required: ["source", "timestamp", "signatureHeader", "rawBody"],
          additionalProperties: false,
        },
        annotations: { title: "Webhook ingest", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      },
      async handler(raw) {
        const result = await ingest(deps.resolveScope(), WEBHOOK_INPUT.parse(raw));
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result };
      },
    });
  }

  if (deps.memory) {
    const memory = deps.memory;
    deps.registry.register({
      definition: {
        name: "memory_retain",
        description: "Persist a project-scoped agent memory entry for recall in later MCP sessions.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string" },
            kind: { type: "string", enum: [...AGENT_MEMORY_KINDS] },
            text: { type: "string", minLength: 1 },
            tags: { type: "array", items: { type: "string" } },
            issueKey: { type: "string" },
            sourceRefs: { type: "array", items: { type: "object" } },
            agentKey: { type: "string" },
          },
          required: ["projectId", "kind", "text"],
          additionalProperties: false,
        },
        annotations: { title: "Memory retain", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async handler(raw) {
        const output = await memory.retain(deps.resolveScope(), MEMORY_RETAIN_INPUT.parse(raw));
        return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
      },
    });

    deps.registry.register({
      definition: {
        name: "memory_recall",
        description: "Recall project-scoped agent memory from current or prior MCP sessions.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string" },
            query: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            kind: { type: "string", enum: [...AGENT_MEMORY_KINDS] },
            kinds: { type: "array", items: { type: "string", enum: [...AGENT_MEMORY_KINDS] } },
            issueKey: { type: "string" },
            limit: { type: "number", minimum: 1, maximum: 50 },
            agentKey: { type: "string" },
            includeVector: { type: "boolean" },
          },
          required: ["projectId"],
          additionalProperties: false,
        },
        annotations: { title: "Memory recall", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async handler(raw) {
        const output = await memory.recall(deps.resolveScope(), MEMORY_RECALL_INPUT.parse(raw));
        return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
      },
    });

    deps.registry.register({
      definition: {
        name: "memory_reflect",
        description: "Persist an agent-authored reflection linked to existing project-scoped memory entries.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string" },
            summary: { type: "string", minLength: 1 },
            sourceMemoryIds: { type: "array", items: { type: "string" }, minItems: 1 },
            tags: { type: "array", items: { type: "string" } },
            issueKey: { type: "string" },
            agentKey: { type: "string" },
          },
          required: ["projectId", "summary", "sourceMemoryIds"],
          additionalProperties: false,
        },
        annotations: { title: "Memory reflect", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async handler(raw) {
        const output = await memory.reflect(deps.resolveScope(), MEMORY_REFLECT_INPUT.parse(raw));
        return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
      },
    });

    deps.registry.register({
      definition: {
        name: "memory_forget",
        description: "Soft-delete a project-scoped agent memory entry so future recalls omit it.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string" },
            memoryId: { type: "string" },
            reason: { type: "string", minLength: 4 },
            agentKey: { type: "string" },
          },
          required: ["projectId", "memoryId", "reason"],
          additionalProperties: false,
        },
        annotations: { title: "Memory forget", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      },
      async handler(raw) {
        const output = await memory.forget(deps.resolveScope(), MEMORY_FORGET_INPUT.parse(raw));
        return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
      },
    });
  }
}
