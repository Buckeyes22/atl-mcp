// PolicyDecisionLayer per v6 §7.2.
// Adapter interface that workflows call before consequential operations.
// Returns a structured PolicyDecision with effect (allow/deny/require_approval),
// obligations, reasons, and dual confidence representation.
//
// M1 ships the interface + a minimal "code" adapter that allow-by-default for
// trivial reads and deny-by-default for writes. Richer rules (lethal trifecta
// integration, ACL ranking, action-mode obligations) land with M5 + M7 + M11
// as the surface area becomes meaningful.

import { fromNumeric, type ConfidenceCategorical } from "../domain/confidence.js";
import type {
  PolicyCheck,
  PolicyDecision,
  PolicyEffect,
  PolicyObligation,
} from "../domain/policyDecision.js";
import type { TenantScope } from "../domain/tenantScope.js";

export interface PolicyDecisionRequest {
  readonly toolName: string;
  readonly projectId?: string;
  /** Caller-provided summary of what the tool will do; informs the decision. */
  readonly intent: PolicyIntent;
  /** Free-form context that the adapter may inspect (e.g., target artifact ref). */
  readonly attributes?: Readonly<Record<string, unknown>>;
}

export type PolicyIntent =
  | "read_only"
  | "preview"
  | "mutate_internal"     // touches our own state (e.g., persist a blueprint)
  | "mutate_external";    // touches a remote system (Jira, Confluence, VCS, etc.)

export interface PolicyDecisionLayer {
  decide(scope: TenantScope, request: PolicyDecisionRequest): Promise<PolicyDecision>;
}

/**
 * Helper: builders that adapters can use to compose a PolicyDecision without
 * hand-rolling the confidence aggregation each time.
 */
export function buildDecision(args: {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId?: string;
  readonly toolName: string;
  readonly effect: PolicyEffect;
  readonly reasons: readonly string[];
  readonly obligations?: readonly PolicyObligation[];
  readonly checks: readonly PolicyCheck[];
  readonly nowIso?: string;
}): PolicyDecision {
  const numeric = aggregateScore(args.checks);
  const conf = fromNumeric(numeric);
  return {
    id: args.id,
    tenantId: args.tenantId,
    ...(args.projectId !== undefined ? { projectId: args.projectId } : {}),
    toolName: args.toolName,
    effect: args.effect,
    reasons: args.reasons,
    obligations: args.obligations ?? [],
    evaluatedAt: args.nowIso ?? new Date().toISOString(),
    confidenceCategorical: conf.categorical satisfies ConfidenceCategorical,
    confidenceScore: conf.numeric,
    checks: args.checks,
  };
}

function aggregateScore(checks: readonly PolicyCheck[]): number {
  if (checks.length === 0) return 0.5;
  // Per-check confidence is integer 0–100; aggregate to 0..1 mean across CHECKED checks.
  // Unchecked items count as 0 (uncertain → reduce overall score).
  const sum = checks.reduce((acc, c) => acc + (c.checked ? Math.max(0, Math.min(100, c.confidence)) : 0), 0);
  return sum / (100 * checks.length);
}
