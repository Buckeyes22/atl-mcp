// Additional sub-plans on ProjectBlueprint. M1 keeps these as deliberately
// minimal type stubs — the rich shape lands incrementally with M4 (planner)
// and M8 (readiness validation). Stored as JSONB columns inside the blueprint
// row, so adding fields is non-breaking.

export interface ArchitecturePlan {
  readonly summary: string;
  readonly components: readonly Component[];
  readonly decisions: readonly string[];     // ADR ids referenced
}

export interface Component {
  readonly id: string;
  readonly name: string;
  readonly responsibility: string;
  readonly dependencies: readonly string[];
}

export type TestCategory = "UT" | "IT" | "ST" | "PT" | "E2E";

/**
 * 5-category test framework per project-foundation-workbench F-077.
 * "Not Applicable" claims must be auditable — record a reason.
 */
export interface TestingStrategy {
  readonly categories: ReadonlyArray<{
    readonly category: TestCategory;
    readonly applicable: boolean;
    readonly notApplicableReason?: string;
    readonly toolingNotes?: string;
  }>;
}

export interface SecurityPrivacyPlan {
  readonly classification: "PUBLIC" | "PRIVATE" | "SECRET";
  readonly piiHandling: string;
  readonly threatModelRefs: readonly string[];
  readonly owaspLlmCoverage: readonly string[];   // OWASP LLM Top-10 item ids
}

export interface ReleasePlan {
  readonly milestones: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly targetDate?: string;     // ISO8601 (optional; project-internal)
  }>;
  readonly rolloutStrategy: string;
}
