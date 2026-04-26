// blueprintReviseWorkflow — operator-driven blueprint refinement. Reads the
// current blueprint, builds a critic-persona prompt with the operator's
// revision request, calls the host's sampling adapter, and returns a
// proposed patch + critique notes + structured diff. Read-only at the
// storage layer; the operator applies the patch via the existing
// `project_blueprint_update` tool when they're satisfied.
//
// The intended path:
//   1. Operator calls `project_blueprint_revise({projectId, revisionRequest})`
//   2. Receives `proposedPatch` + `critiqueNotes` + `diff`
//   3. Reviews; optionally edits `proposedPatch`
//   4. Calls `project_blueprint_update({projectId, patch: <edited>})`
//
// Step 4 is what touches the project record; this tool itself does not
// persist, which is why it doesn't emit an audit-chain entry.

import { z } from "zod";
import type { ProjectBlueprint } from "../domain/projectBlueprint.js";
import type { TenantScope } from "../domain/tenantScope.js";
import type { ProjectRepository } from "../storage/repositories/projectRepository.js";
import { createDisabledSamplingAdapter, type SamplingAdapter, type SamplingResult } from "../mcp/sampling.js";
import { blueprintPatchSchema, type BlueprintUpdatePatch } from "./blueprintWorkflow.js";
import type { VelocityContentRegistry } from "../velocity/contentRegistry.js";
import { buildBlueprintCritiquePrompt } from "../velocity/critiquePromptScaffold.js";

export interface BlueprintReviseInput {
  readonly projectId: string;
  readonly revisionRequest: string;
  readonly useSampling?: boolean;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly sampling?: SamplingAdapter;
}

export interface BlueprintRevisionDiff {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly changed: readonly string[];
}

export interface BlueprintReviseResult {
  readonly projectId: string;
  readonly proposedPatch: BlueprintUpdatePatch;
  readonly critiqueNotes: readonly string[];
  readonly diff: BlueprintRevisionDiff;
  readonly sampling: SamplingResult;
}

export interface BlueprintReviseWorkflow {
  revise(scope: TenantScope, input: BlueprintReviseInput): Promise<BlueprintReviseResult>;
}

const reviseResponseSchema = z.object({
  patch: blueprintPatchSchema,
  critiqueNotes: z.array(z.string()).optional().default([]),
}).strict();

const PATCH_FIELDS = [
  "name",
  "goals",
  "nonGoals",
  "requirements",
  "features",
  "epics",
  "risks",
  "openQuestions",
] as const;

const WRAPPER_SHAPE_FIELDS = ["patch", "proposedPatch", "critiqueNotes", "notes"] as const;

type ReviseResponseParse =
  | { readonly ok: true; readonly patch: BlueprintUpdatePatch; readonly critiqueNotes: readonly string[] }
  | { readonly ok: false; readonly reason: string };

export function createBlueprintReviseWorkflow(deps: {
  readonly projectRepository: ProjectRepository;
  readonly registry: VelocityContentRegistry;
  readonly sampling?: SamplingAdapter;
}): BlueprintReviseWorkflow {
  const sampling = deps.sampling ?? createDisabledSamplingAdapter("sampling not configured");
  return {
    async revise(scope, input) {
      const existing = await deps.projectRepository.findById(scope, input.projectId);
      if (!existing) throw new Error(`project not found: ${input.projectId}`);
      const sampler = input.sampling ?? sampling;

      const prompt = await buildBlueprintCritiquePrompt({ registry: deps.registry }, existing, input.revisionRequest);

      const sampled = input.useSampling === false
        ? { used: false as const, reason: "sampling disabled by request" }
        : await sampler.sample({
          prompt: prompt.text,
          maxTokens: input.maxTokens ?? 4096,
          temperature: input.temperature ?? 0.2,
          trace: { projectId: existing.id, blueprintVersion: existing.blueprintVersion, promptVersion: "blueprint-revise.v1" },
        });

      let proposedPatch: BlueprintUpdatePatch = {};
      let critiqueNotes: readonly string[] = [];
      if (sampled.used && sampled.text.trim().length > 0) {
        const parsed = parseReviseResponse(sampled.text);
        if (parsed.ok) {
          proposedPatch = parsed.patch;
          critiqueNotes = parsed.critiqueNotes;
        } else {
          critiqueNotes = [`sampling response parse failed: ${parsed.reason}`];
        }
      } else {
        critiqueNotes = [
          `sampling unavailable (${sampled.used === false ? sampled.reason ?? "no host" : "empty response"}); cannot propose a patch automatically — run the operator-edit path manually`,
        ];
      }

      const diff = computeDiff(existing, proposedPatch);
      return { projectId: existing.id, proposedPatch, critiqueNotes, diff, sampling: sampled };
    },
  };
}

function parseReviseResponse(text: string): ReviseResponseParse {
  const trimmed = stripJsonFence(text);
  let obj: unknown;
  try {
    obj = JSON.parse(trimmed);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `invalid JSON (${message})` };
  }

  const parsed = reviseResponseSchema.safeParse(obj);
  if (parsed.success) {
    return { ok: true, patch: parsed.data.patch, critiqueNotes: parsed.data.critiqueNotes };
  }

  const barePatch = parseBarePatch(obj);
  if (barePatch.ok) return barePatch;
  return { ok: false, reason: barePatch.reason };
}

function stripJsonFence(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function parseBarePatch(obj: unknown): ReviseResponseParse {
  if (!isRecord(obj)) {
    return { ok: false, reason: "expected a JSON object" };
  }
  if (WRAPPER_SHAPE_FIELDS.some((field) => hasOwn(obj, field))) {
    return { ok: false, reason: "response used an unsupported wrapper shape" };
  }
  if (!PATCH_FIELDS.some((field) => hasOwn(obj, field))) {
    return { ok: false, reason: "response did not include any blueprint patch fields" };
  }

  const parsed = blueprintPatchSchema.safeParse(obj);
  if (!parsed.success) {
    return { ok: false, reason: parsed.error.issues.map((issue) => issue.message).join("; ") };
  }
  return { ok: true, patch: parsed.data, critiqueNotes: [] };
}

function computeDiff(existing: ProjectBlueprint, patch: BlueprintUpdatePatch): BlueprintRevisionDiff {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  if (patch.name !== undefined && patch.name !== existing.name) changed.push("name");

  if (patch.goals !== undefined) {
    const before = new Set(existing.goals);
    const after = new Set(patch.goals);
    for (const g of after) if (!before.has(g)) added.push(`goals: ${g}`);
    for (const g of before) if (!after.has(g)) removed.push(`goals: ${g}`);
  }
  if (patch.nonGoals !== undefined) {
    const before = new Set(existing.nonGoals);
    const after = new Set(patch.nonGoals);
    for (const g of after) if (!before.has(g)) added.push(`nonGoals: ${g}`);
    for (const g of before) if (!after.has(g)) removed.push(`nonGoals: ${g}`);
  }

  // For arrays of objects (requirements/features/epics/risks), use id as the key.
  for (const field of ["requirements", "features", "epics", "risks"] as const) {
    const after = patch[field];
    if (after === undefined) continue;
    const beforeById = objectArrayById(existing[field]);
    const afterById = objectArrayById(after);

    for (const [id, afterItem] of afterById) {
      if (!beforeById.has(id)) {
        added.push(`${field}: ${id}`);
      } else if (stableStringify(beforeById.get(id)) !== stableStringify(afterItem)) {
        changed.push(`${field}: ${id}`);
      }
    }
    for (const id of beforeById.keys()) {
      if (!afterById.has(id)) removed.push(`${field}: ${id}`);
    }
  }

  return { added, removed, changed };
}

function objectArrayById(items: readonly unknown[]): Map<string, unknown> {
  const byId = new Map<string, unknown>();
  items.forEach((item, index) => {
    byId.set(objectId(item) ?? `#${index + 1}`, item);
  });
  return byId;
}

function objectId(item: unknown): string | undefined {
  if (!isRecord(item)) return undefined;
  const raw = item.id;
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;

  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = stableValue(value[key]);
  }
  return sorted;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}
