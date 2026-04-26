import { randomUUID } from "node:crypto";
import type { ContextPack } from "../domain/contextPack.js";
import type { AgentMemoryRecallResult, ContextPackAgentMemory } from "../domain/agentMemory.js";
import { emptyBudget } from "../domain/tokenBudget.js";
import type { TenantScope } from "../domain/tenantScope.js";
import type { ProjectRepository } from "../storage/repositories/projectRepository.js";
import { estimateTokens } from "../context/modelContext.js";
import { redactUnsafeContent } from "../context/redaction.js";
import { auditPayloadHash } from "../security/auditChain.js";

interface ContextMemoryRecallInput {
  readonly projectId: string;
  readonly issueKey?: string;
  readonly query: string;
  readonly limit: number;
}

type ContextMemoryRecall = (scope: TenantScope, input: ContextMemoryRecallInput) => Promise<AgentMemoryRecallResult>;

export function createContextPackWorkflow(deps: {
  readonly projectRepository: ProjectRepository;
  readonly targetModel: string;
  readonly budgetTokens: number;
  readonly recallMemory?: ContextMemoryRecall;
  readonly now?: () => string;
}) {
  const now = deps.now ?? (() => new Date().toISOString());
  return {
    async generate(scope: TenantScope, input: { readonly projectId: string; readonly issueKey?: string }): Promise<ContextPack> {
      const project = await deps.projectRepository.findById(scope, input.projectId);
      if (!project) throw new Error(`project not found: ${input.projectId}`);
      const intakeText = project.intake?.source.kind === "raw_markdown" ? project.intake.source.markdown : "";
      const summary = truncate(redactUnsafeContent([project.name, ...project.goals, intakeText].join("\n")), deps.budgetTokens);
      const agentMemory = deps.recallMemory
        ? await buildAgentMemorySection(scope, deps.recallMemory, {
            projectId: project.id,
            ...(input.issueKey !== undefined ? { issueKey: input.issueKey } : {}),
            query: [project.name, ...project.goals, ...project.requirements.map((r) => r.title)].join(" "),
            limit: 10,
          })
        : undefined;
      const used = estimateTokens(summary);
      const budget = {
        ...emptyBudget(deps.targetModel, deps.budgetTokens),
        usedTokens: used,
        byCategory: { ...emptyBudget(deps.targetModel, deps.budgetTokens).byCategory, userMessage: used },
        sections: [{ name: "summary", tokens: used, truncated: used >= deps.budgetTokens }],
        ...(used >= deps.budgetTokens ? { truncationStep: 5 as const } : {}),
      };
      return {
        id: randomUUID(),
        tenantId: scope.tenantId,
        projectId: project.id,
        ...(input.issueKey !== undefined ? { issueKey: input.issueKey } : {}),
        title: `${project.name} context`,
        summary,
        goals: project.goals,
        nonGoals: project.nonGoals,
        acceptanceCriteria: project.requirements.flatMap((r) => r.acceptanceSignals),
        implementationPlan: project.epics.flatMap((e) => e.stories.map((s) => s.userStory)),
        testPlan: project.testingStrategy.categories.map((c) => c.category),
        linkedArtifacts: [],
        relevantFiles: [],
        risks: project.risks,
        openQuestions: project.openQuestions,
        tokenBudget: budget,
        sourcePins: project.sourcePins,
        ...(agentMemory ? { agentMemory } : {}),
        generatedAt: now(),
        regenerationKey: buildRegenerationKey(project.id, input.issueKey, project.blueprintVersion, agentMemory),
        freshness: "current",
        accessDecision: "allowed",
      };
    },
  };
}

function truncate(text: string, budgetTokens: number): string {
  const maxChars = budgetTokens * 4;
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

async function buildAgentMemorySection(
  scope: TenantScope,
  recallMemory: ContextMemoryRecall,
  input: ContextMemoryRecallInput,
): Promise<ContextPackAgentMemory | undefined> {
  const recall = await recallMemory(scope, input);
  if (recall.entries.length === 0) return undefined;
  return {
    entries: recall.entries.map((match) => ({
      id: match.entry.id,
      kind: match.entry.kind,
      text: truncate(match.entry.text, 250),
      tags: match.entry.tags,
      score: match.score,
      createdAt: match.entry.createdAt,
      ...(match.entry.issueKey !== undefined ? { issueKey: match.entry.issueKey } : {}),
    })),
    recall: {
      deterministicAvailable: true,
      vectorAvailable: recall.vectorAvailable,
      vectorAttempted: recall.vectorAttempted,
      limit: input.limit,
      ...(recall.query !== undefined ? { query: recall.query } : {}),
    },
  };
}

function buildRegenerationKey(
  projectId: string,
  issueKey: string | undefined,
  blueprintVersion: number,
  agentMemory: ContextPackAgentMemory | undefined,
): string {
  const base = `${projectId}:${issueKey ?? "project"}:${blueprintVersion}`;
  if (!agentMemory) return base;
  const memoryHash = auditPayloadHash(agentMemory.entries.map((entry) => ({
    id: entry.id,
    score: entry.score,
    text: entry.text,
  }))).slice(0, 16);
  return `${base}:memory:${memoryHash}`;
}
