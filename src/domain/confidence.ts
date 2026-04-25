// Dual confidence representation per PAE F-018 + velocity-ops-engine F-007 +
// ai-coding-framework F-005. Categorical for human-friendly gating; numeric
// for evidence-weighted comparisons. Both representations always present on
// PolicyDecision and any check that produces confidence.

export type ConfidenceCategorical = "high" | "medium" | "low";

export interface ConfidenceScore {
  readonly categorical: ConfidenceCategorical;
  /** 0..1 fraction. Compare with tolerance, not equality. */
  readonly numeric: number;
}

const HIGH_THRESHOLD = 0.8;
const MEDIUM_THRESHOLD = 0.5;

export function fromNumeric(numeric: number): ConfidenceScore {
  if (numeric < 0 || numeric > 1 || !Number.isFinite(numeric)) {
    throw new Error(`confidence numeric must be in [0,1], got ${numeric}`);
  }
  let categorical: ConfidenceCategorical;
  if (numeric >= HIGH_THRESHOLD) categorical = "high";
  else if (numeric >= MEDIUM_THRESHOLD) categorical = "medium";
  else categorical = "low";
  return { categorical, numeric };
}

/** Aggregate per-check integer-percent confidences (0–100) into a 0..1 fraction. */
export function aggregateChecks(checks: ReadonlyArray<{ confidence: number }>): number {
  if (checks.length === 0) return 0;
  const sum = checks.reduce((acc, c) => acc + Math.max(0, Math.min(100, c.confidence)), 0);
  return sum / (100 * checks.length);
}
