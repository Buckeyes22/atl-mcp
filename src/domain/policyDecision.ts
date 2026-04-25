// PolicyDecision is the output of the PolicyDecisionLayer (v6 §7.2).
// Produced for every consequential tool invocation; persisted in audit trail.
// Confidence shape per PAE F-018 + velocity-ops-engine F-007 (dual categorical
// + numeric); per-check shape per ai-coding-framework F-005.

import type { ConfidenceCategorical } from "./confidence.js";

export type PolicyEffect = "allow" | "deny" | "require_approval";

export type PolicyObligationKind =
  | "require_preview"
  | "require_fresh_preflight"
  | "require_human_approval"
  | "require_access_gate_allow"
  | "require_non_dirty_context"
  | "require_sandbox_target"
  | "require_tenant_scope"
  | "require_read_only_mode"
  | "require_approve_each_tool";

export interface PolicyObligation {
  readonly kind: PolicyObligationKind;
  readonly message: string;
}

export interface PolicyCheck {
  readonly name: string;
  readonly checked: boolean;
  /** Integer percent 0–100 (per-check); aggregated to 0..1 in confidenceScore. */
  readonly confidence: number;
}

export interface PolicyDecision {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId?: string;
  readonly toolName: string;
  readonly effect: PolicyEffect;
  readonly reasons: readonly string[];
  readonly obligations: readonly PolicyObligation[];
  readonly evaluatedAt: string;
  readonly confidenceCategorical: ConfidenceCategorical;
  readonly confidenceScore: number;     // 0..1
  readonly checks: readonly PolicyCheck[];
}
