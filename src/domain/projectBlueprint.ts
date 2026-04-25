// Top-level ProjectBlueprint composing the sub-types in this directory.
// Persisted as a single row in `projects`; sub-types live in JSONB columns.
// schemaVersion travels independently of orchestrator version (v6 §36).

import type { EpicPlan } from "./epicPlan.js";
import type {
  ArchitecturePlan,
  ReleasePlan,
  SecurityPrivacyPlan,
  TestingStrategy,
} from "./blueprintExtras.js";
import type { Feature, OpenQuestion, Requirement, Risk, Stakeholder } from "./requirement.js";
import type { ProjectState } from "./projectState.js";
import type { SourcePin } from "./sourcePin.js";
import type { ProjectIntake } from "./projectIntake.js";

/** Current blueprint schema version. Bump on breaking changes; ship a migrator. */
export const BLUEPRINT_SCHEMA_VERSION = 1 as const;

export interface ProjectBlueprint {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  /** Short stable key (e.g., "PCO" for "Project Context Orchestrator"). */
  readonly key: string;
  readonly state: ProjectState;
  readonly schemaVersion: number;
  /** Bumped on every meaningful blueprint update; freezes on PROVISIONED. */
  readonly blueprintVersion: number;
  readonly goals: readonly string[];
  readonly nonGoals: readonly string[];
  readonly stakeholders: readonly Stakeholder[];
  readonly requirements: readonly Requirement[];
  readonly features: readonly Feature[];
  readonly epics: readonly EpicPlan[];
  readonly architecture: ArchitecturePlan;
  readonly risks: readonly Risk[];
  readonly openQuestions: readonly OpenQuestion[];
  readonly testingStrategy: TestingStrategy;
  readonly securityPrivacy: SecurityPrivacyPlan;
  readonly releasePlan: ReleasePlan;
  readonly sourcePins: readonly SourcePin[];
  readonly intake?: ProjectIntake;
  readonly projectProfileId?: string;
  /**
   * Set when the blueprint was *adopted* from an existing Atlassian Cloud project
   * (admin.projects.adopt) instead of being intaken from scratch. Carries the
   * Cloud project's Jira key so the operator UI can surface the linkage and so
   * future provisioning logic can detect the project already exists upstream.
   */
  readonly atlassianProjectKey?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Minimal seed used when intake creates a brand-new draft. */
export interface NewProjectInput {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly key: string;
  readonly goals?: readonly string[];
  readonly nonGoals?: readonly string[];
}

export function emptyBlueprint(input: NewProjectInput, now: string): ProjectBlueprint {
  return {
    id: input.id,
    tenantId: input.tenantId,
    name: input.name,
    key: input.key,
    state: "DRAFT_INTAKE",
    schemaVersion: BLUEPRINT_SCHEMA_VERSION,
    blueprintVersion: 1,
    goals: input.goals ?? [],
    nonGoals: input.nonGoals ?? [],
    stakeholders: [],
    requirements: [],
    features: [],
    epics: [],
    architecture: { summary: "", components: [], decisions: [] },
    risks: [],
    openQuestions: [],
    testingStrategy: { categories: [] },
    securityPrivacy: {
      classification: "PRIVATE",
      piiHandling: "",
      threatModelRefs: [],
      owaspLlmCoverage: [],
    },
    releasePlan: { milestones: [], rolloutStrategy: "" },
    sourcePins: [],
    createdAt: now,
    updatedAt: now,
  };
}
