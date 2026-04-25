// Project state machine per v6 §6. Persisted on ProjectBlueprint.state.

export type ProjectState =
  | "DRAFT_INTAKE"
  | "CLARIFICATION_NEEDED"
  | "BLUEPRINT_READY"
  | "PREFLIGHT_PASSED"
  | "PROVISIONING_PREVIEWED"
  | "PROVISIONED"
  | "LINKED"
  | "VALIDATED"
  | "READY_FOR_BUILD"
  | "VALIDATION_FAILED"
  | "DRIFT_DETECTED"
  | "ARCHIVED";

export const PROJECT_STATES: readonly ProjectState[] = [
  "DRAFT_INTAKE",
  "CLARIFICATION_NEEDED",
  "BLUEPRINT_READY",
  "PREFLIGHT_PASSED",
  "PROVISIONING_PREVIEWED",
  "PROVISIONED",
  "LINKED",
  "VALIDATED",
  "READY_FOR_BUILD",
  "VALIDATION_FAILED",
  "DRIFT_DETECTED",
  "ARCHIVED",
] as const;

const VALID_TRANSITIONS: Readonly<Record<ProjectState, readonly ProjectState[]>> = {
  DRAFT_INTAKE: ["CLARIFICATION_NEEDED", "BLUEPRINT_READY", "ARCHIVED"],
  CLARIFICATION_NEEDED: ["DRAFT_INTAKE", "BLUEPRINT_READY", "ARCHIVED"],
  BLUEPRINT_READY: ["PREFLIGHT_PASSED", "CLARIFICATION_NEEDED", "ARCHIVED"],
  PREFLIGHT_PASSED: ["PROVISIONING_PREVIEWED", "BLUEPRINT_READY", "DRIFT_DETECTED", "ARCHIVED"],
  PROVISIONING_PREVIEWED: ["PROVISIONED", "BLUEPRINT_READY", "ARCHIVED"],
  PROVISIONED: ["LINKED", "DRIFT_DETECTED", "ARCHIVED"],
  LINKED: ["VALIDATED", "DRIFT_DETECTED", "ARCHIVED"],
  VALIDATED: ["READY_FOR_BUILD", "VALIDATION_FAILED", "DRIFT_DETECTED", "ARCHIVED"],
  READY_FOR_BUILD: ["DRIFT_DETECTED", "ARCHIVED"],
  VALIDATION_FAILED: ["BLUEPRINT_READY", "ARCHIVED"],
  DRIFT_DETECTED: ["BLUEPRINT_READY", "PREFLIGHT_PASSED", "ARCHIVED"],
  ARCHIVED: [],
};

export function canTransition(from: ProjectState, to: ProjectState): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export class IllegalStateTransitionError extends Error {
  constructor(public readonly from: ProjectState, public readonly to: ProjectState) {
    super(`illegal state transition: ${from} → ${to}`);
    this.name = "IllegalStateTransitionError";
  }
}
