import type { ArtifactRef } from "../domain/artifactRef.js";
import type { PolicyDecision } from "../domain/policyDecision.js";

export type PlannedActionKind = "create" | "update" | "no_op" | "blocked";
export type PlannedTarget = "jira_issue" | "confluence_page" | "vcs_file" | "vcs_pull_request";

export interface PlanActorAttribution {
  readonly principalId: string;
  readonly fingerprint: string;
  readonly authMode: "api_token" | "oauth3lo" | "service_account";
  readonly jiraLabel: string;
  readonly metadataBlock: string;
}

export interface PlannedJiraIssueAction {
  readonly id: string;
  readonly action: PlannedActionKind;
  readonly target: "jira_issue";
  readonly blueprintRef: ArtifactRef;
  readonly issueType: "Epic" | "Story" | "Task";
  readonly summary: string;
  readonly description: readonly string[];
  readonly labels: readonly string[];
  readonly idempotencyKey: string;
  readonly policy: PolicyDecision;
  readonly blockedReason?: string;
}

export interface PlannedConfluencePageAction {
  readonly id: string;
  readonly action: PlannedActionKind;
  readonly target: "confluence_page";
  readonly blueprintRef: ArtifactRef;
  readonly spaceId: string;
  readonly title: string;
  readonly bodyStorage: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly idempotencyKey: string;
  readonly policy: PolicyDecision;
  readonly blockedReason?: string;
}

export interface PlannedVcsFileAction {
  readonly id: string;
  readonly action: PlannedActionKind;
  readonly target: "vcs_file";
  readonly blueprintRef: ArtifactRef;
  readonly workspace: string;
  readonly repoSlug: string;
  readonly branch: string;
  readonly baseBranch: string;
  readonly path: string;
  readonly contents: string;
  readonly commitMessage: string;
  readonly idempotencyKey: string;
  readonly policy: PolicyDecision;
  readonly blockedReason?: string;
}

export interface PlannedVcsPullRequestAction {
  readonly id: string;
  readonly action: PlannedActionKind;
  readonly target: "vcs_pull_request";
  readonly blueprintRef: ArtifactRef;
  readonly workspace: string;
  readonly repoSlug: string;
  readonly sourceBranch: string;
  readonly destinationBranch: string;
  readonly title: string;
  readonly description: string;
  readonly idempotencyKey: string;
  readonly policy: PolicyDecision;
  readonly blockedReason?: string;
}

export type PlannedArtifactAction =
  | PlannedJiraIssueAction
  | PlannedConfluencePageAction
  | PlannedVcsFileAction
  | PlannedVcsPullRequestAction;

export interface ArtifactPlan {
  readonly id: string;
  readonly projectId: string;
  readonly blueprintVersion: number;
  readonly jiraProjectKey: string;
  readonly actorAttribution: PlanActorAttribution;
  readonly actions: readonly PlannedArtifactAction[];
  readonly estimatedRequestCount: number;
  readonly triplet?: AdversarialTripletResult;
}

export interface AdversarialTripletResult {
  readonly verdict: "PASS" | "FAIL";
  readonly critics: readonly TripletCriticResult[];
  readonly synthesizedAt: string;
}

export interface TripletCriticResult {
  readonly name: "false_positive_filter" | "missing_issues_finder" | "context_validator";
  readonly pass: boolean;
  readonly findings: readonly string[];
}
