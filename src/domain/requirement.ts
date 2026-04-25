// Sub-types of ProjectBlueprint that capture intent and risk.
// Kept as type-only definitions in M1; richer behavior (decomposition,
// validation rules) lands with M4 (blueprint workflow).

import type { SourceRef } from "./artifactRef.js";

export type RequirementType = "functional" | "non_functional" | "constraint" | "assumption";
export type RequirementPriority = "must" | "should" | "could" | "wont";

export interface Requirement {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly type: RequirementType;
  readonly priority: RequirementPriority;
  readonly acceptanceSignals: readonly string[];
  readonly sourceRefs: readonly SourceRef[];
}

export interface Feature {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly requirementIds: readonly string[];
  readonly priority: RequirementPriority;
}

export interface Stakeholder {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly interests: readonly string[];
}

export type RiskSeverity = "low" | "medium" | "high" | "critical";

export interface Risk {
  readonly id: string;
  readonly description: string;
  readonly severity: RiskSeverity;
  readonly likelihood: "rare" | "possible" | "likely" | "almost_certain";
  readonly mitigation: string;
  /** Optional FM-NN cross-reference to v6 §34 risk register. */
  readonly failureModeId?: string;
}

export interface OpenQuestion {
  readonly id: string;
  readonly question: string;
  readonly raisedBy: string;     // principalId or "intake"
  readonly raisedAt: string;     // ISO8601
  readonly resolvedAt?: string;
  readonly resolution?: string;
}
