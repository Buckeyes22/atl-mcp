// ContextPack is the per-task agent-context bundle assembled by M7
// (`context_pack_generate`). M1 defines the persisted shape only.

import type { ArtifactRef, RepoFileRef } from "./artifactRef.js";
import type { OpenQuestion, Risk } from "./requirement.js";
import type { SourcePin } from "./sourcePin.js";
import type { TokenBudgetReport } from "./tokenBudget.js";
import type { ContextPackAgentMemory } from "./agentMemory.js";

export type ContextPackFreshness = "current" | "stale" | "dirty";
export type ContextPackAccessDecision = "allowed" | "denied" | "requires_remote_check";

export interface ContextPack {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly issueKey?: string;
  readonly title: string;
  readonly summary: string;
  readonly goals: readonly string[];
  readonly nonGoals: readonly string[];
  readonly acceptanceCriteria: readonly string[];
  readonly implementationPlan: readonly string[];
  readonly testPlan: readonly string[];
  readonly linkedArtifacts: readonly ArtifactRef[];
  readonly relevantFiles: readonly RepoFileRef[];
  readonly risks: readonly Risk[];
  readonly openQuestions: readonly OpenQuestion[];
  readonly tokenBudget: TokenBudgetReport;
  readonly sourcePins: readonly SourcePin[];
  readonly agentMemory?: ContextPackAgentMemory;
  readonly generatedAt: string;
  /** Deterministic seed; same regenerationKey → byte-identical pack regen. */
  readonly regenerationKey: string;
  readonly freshness: ContextPackFreshness;
  readonly accessDecision: ContextPackAccessDecision;
}
