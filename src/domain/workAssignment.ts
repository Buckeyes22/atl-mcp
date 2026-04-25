export type WorkRefKind = "blueprint_story" | "blueprint_task" | "jira_issue";
export type WorkType = "frontend" | "backend" | "integration" | "test" | "docs" | "infra" | "security" | "data" | "unknown";
export type WorkRiskLevel = "low" | "medium" | "high";
export type WorkAssignmentStatus = "suggested" | "assigned" | "blocked" | "completed";
export type AgentRecommendationSource = "live" | "profile";

export interface WorkRef {
  readonly kind: WorkRefKind;
  readonly id: string;
  readonly title?: string;
}

export interface WorkClassification {
  readonly workType: WorkType;
  readonly skillTags: readonly string[];
  readonly riskLevel: WorkRiskLevel;
  readonly confidence: number;
  readonly explanation: string;
}

export interface AgentRecommendation {
  readonly agentId: string;
  readonly label: string;
  readonly score: number;
  readonly matchedTags: readonly string[];
  readonly reasons: readonly string[];
  readonly source: AgentRecommendationSource;
}

export interface WorkAssignmentRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly workRef: WorkRef;
  readonly classification: WorkClassification;
  readonly recommendedAgents: readonly AgentRecommendation[];
  readonly assignedAgentId?: string;
  readonly assignedBy?: string;
  readonly status: WorkAssignmentStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}
