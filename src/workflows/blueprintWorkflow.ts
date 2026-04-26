import { z } from "zod";
import type { ProjectBlueprint } from "../domain/projectBlueprint.js";
import type { OpenQuestion } from "../domain/requirement.js";
import type { TenantScope } from "../domain/tenantScope.js";
import type { ProjectRepository } from "../storage/repositories/projectRepository.js";
import { validateBlueprint, type BlueprintValidationResult } from "../validators/blueprintValidator.js";
import { createDisabledSamplingAdapter, type SamplingAdapter, type SamplingResult } from "../mcp/sampling.js";
import { parseMarkdownBlueprint } from "./markdownBlueprintParser.js";
import type { VelocityContentRegistry } from "../velocity/contentRegistry.js";
import { buildScaffoldedBlueprintPrompt } from "../velocity/promptScaffold.js";

export interface BlueprintGenerateInput {
  readonly projectId: string;
  readonly useSampling?: boolean;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly sampling?: SamplingAdapter;
}

export interface BlueprintGenerateResult {
  readonly blueprint: ProjectBlueprint;
  readonly validation: BlueprintValidationResult;
  readonly sampling: SamplingResult;
}

export const blueprintPatchSchema = z.object({
  name: z.string().min(1).optional(),
  goals: z.array(z.string()).optional(),
  nonGoals: z.array(z.string()).optional(),
  requirements: z.array(z.unknown()).optional(),
  features: z.array(z.unknown()).optional(),
  epics: z.array(z.unknown()).optional(),
  risks: z.array(z.unknown()).optional(),
  openQuestions: z.array(z.unknown()).optional(),
}).passthrough();

const patchSchema = blueprintPatchSchema;

export type BlueprintUpdatePatch = z.infer<typeof patchSchema>;

export interface BlueprintWorkflow {
  generate(scope: TenantScope, input: BlueprintGenerateInput): Promise<BlueprintGenerateResult>;
  update(scope: TenantScope, input: { readonly projectId: string; readonly patch: unknown }): Promise<BlueprintGenerateResult>;
}

export function createBlueprintWorkflow(deps: {
  readonly projectRepository: ProjectRepository;
  readonly sampling?: SamplingAdapter;
  readonly now?: () => string;
  /**
   * Optional velocity-ops content registry. When provided, blueprint
   * generation uses the scaffolded prompt (phase protocols + agent
   * personas) instead of the minimal fallback prompt.
   */
  readonly velocityRegistry?: VelocityContentRegistry;
}): BlueprintWorkflow {
  const sampling = deps.sampling ?? createDisabledSamplingAdapter("sampling not configured");
  const now = deps.now ?? (() => new Date().toISOString());
  return {
    async generate(scope, input) {
      const existing = await findProject(deps.projectRepository, scope, input.projectId);
      const sampler = input.sampling ?? sampling;
      const prompt = deps.velocityRegistry
        ? (await buildScaffoldedBlueprintPrompt({ registry: deps.velocityRegistry }, existing)).text
        : buildPrompt(existing);
      const promptVersion = deps.velocityRegistry ? "blueprint-generation.v2-velocity" : "blueprint-generation.v1";
      const sampled = input.useSampling === false
        ? { used: false as const, reason: "sampling disabled by request" }
        : await sampler.sample({
          prompt,
          maxTokens: input.maxTokens ?? 4096,
          temperature: input.temperature ?? 0,
          trace: { projectId: existing.id, blueprintVersion: existing.blueprintVersion, promptVersion },
        });
      const generated = sampled.used && sampled.text.trim().length > 0
        ? applyPatch(existing, parseSampledPatch(sampled.text), now())
        : deterministicBlueprint(existing, now());
      const finalized = withValidationState(generated, now());
      await deps.projectRepository.update(scope, finalized.blueprint);
      return { ...finalized, sampling: sampled };
    },
    async update(scope, input) {
      const existing = await findProject(deps.projectRepository, scope, input.projectId);
      const updated = applyPatch(existing, patchSchema.parse(input.patch), now());
      const finalized = withValidationState(updated, now());
      await deps.projectRepository.update(scope, finalized.blueprint);
      return { ...finalized, sampling: { used: false, reason: "manual update" } };
    },
  };
}

async function findProject(repo: ProjectRepository, scope: TenantScope, id: string): Promise<ProjectBlueprint> {
  const project = await repo.findById(scope, id);
  if (!project) throw new Error(`project not found: ${id}`);
  return project;
}

function deterministicBlueprint(existing: ProjectBlueprint, updatedAt: string): ProjectBlueprint {
  const markdown = existing.intake?.source.kind === "raw_markdown" ? existing.intake.source.markdown : "";
  const parsed = parseMarkdownBlueprint(markdown, existing.id);
  return {
    ...existing,
    ...parsed,
    blueprintVersion: existing.blueprintVersion + 1,
    updatedAt,
  };
}

function applyPatch(existing: ProjectBlueprint, patch: BlueprintUpdatePatch, updatedAt: string): ProjectBlueprint {
  return {
    ...existing,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.goals !== undefined ? { goals: patch.goals } : {}),
    ...(patch.nonGoals !== undefined ? { nonGoals: patch.nonGoals } : {}),
    requirements: patch.requirements as ProjectBlueprint["requirements"] | undefined ?? existing.requirements,
    features: patch.features as ProjectBlueprint["features"] | undefined ?? existing.features,
    epics: patch.epics as ProjectBlueprint["epics"] | undefined ?? existing.epics,
    risks: patch.risks as ProjectBlueprint["risks"] | undefined ?? existing.risks,
    openQuestions: patch.openQuestions as ProjectBlueprint["openQuestions"] | undefined ?? existing.openQuestions,
    blueprintVersion: existing.blueprintVersion + 1,
    updatedAt,
  };
}

function withValidationState(blueprint: ProjectBlueprint, raisedAt: string): {
  readonly blueprint: ProjectBlueprint;
  readonly validation: BlueprintValidationResult;
} {
  const validation = validateBlueprint(blueprint);
  const openQuestions = validation.openQuestions.map<OpenQuestion>((question, index) => ({
    id: `OQ-${String(index + 1).padStart(3, "0")}`,
    question,
    raisedBy: "intake",
    raisedAt,
  }));
  return {
    validation,
    blueprint: {
      ...blueprint,
      state: validation.valid ? "BLUEPRINT_READY" : "CLARIFICATION_NEEDED",
      openQuestions,
    },
  };
}

function buildPrompt(blueprint: ProjectBlueprint): string {
  const markdown = blueprint.intake?.source.kind === "raw_markdown"
    ? blueprint.intake.source.markdown
    : JSON.stringify(blueprint.intake?.source ?? {}, null, 2);
  return [
    "Use Three Experts, Self-Refinement, and Zero-One-N-Shot reasoning silently.",
    "Return only JSON fields that can patch ProjectBlueprint.",
    "<untrusted-intake>",
    markdown,
    "</untrusted-intake>",
  ].join("\n");
}

function parseSampledPatch(text: string): BlueprintUpdatePatch {
  return parseBlueprintPatchText(text);
}

/** Reusable patch-from-text parser for blueprint synthesis + revision flows. */
export function parseBlueprintPatchText(text: string): BlueprintUpdatePatch {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
  return patchSchema.parse(JSON.parse(trimmed));
}
