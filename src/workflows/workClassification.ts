import type { PersistedMcpSessionProfile } from "../domain/mcpSessionProfile.js";
import type {
  AgentRecommendation,
  WorkClassification,
  WorkRef,
  WorkRiskLevel,
  WorkType,
} from "../domain/workAssignment.js";

export interface ClassifyWorkInput {
  readonly workRef: WorkRef;
  readonly title: string;
  readonly description?: string;
  readonly acceptanceCriteria?: readonly string[];
  readonly labels?: readonly string[];
}

export interface RecommendationSession {
  readonly sessionId: string;
  readonly protocolVersion: string;
  readonly clientName?: string;
  readonly clientVersion?: string;
  readonly negotiatedAt: string;
  readonly featuresEnabled: readonly string[];
  readonly featuresDisabled: readonly { readonly feature: string; readonly reason: string }[];
}

export interface RecommendAgentsInput {
  readonly classification: WorkClassification;
  readonly sessions: readonly RecommendationSession[];
  readonly profiles: readonly PersistedMcpSessionProfile[];
}

const TAGS_BY_TYPE: Record<WorkType, readonly string[]> = {
  frontend: ["frontend", "react", "css", "ui", "form"],
  backend: ["backend", "typescript", "api", "database", "repository"],
  integration: ["integration", "jira", "confluence", "provider", "api"],
  test: ["test", "vitest", "coverage", "verification"],
  docs: ["docs", "confluence", "markdown", "requirements"],
  infra: ["infra", "docker", "redis", "postgres", "queue"],
  security: ["security", "auth", "token", "policy", "privacy"],
  data: ["data", "schema", "migration", "reporting"],
  unknown: ["triage"],
};

const KEYWORDS: Record<Exclude<WorkType, "unknown">, readonly string[]> = {
  frontend: ["react", "jsx", "css", "ui", "page", "layout", "form", "button", "mobile", "viewport", "browser"],
  backend: ["backend", "repository", "database", "schema", "admin", "handler", "api", "server", "zod", "storage"],
  integration: ["jira", "confluence", "provider", "webhook", "atlassian", "mcp", "rest", "oauth", "idempotency"],
  test: ["test", "vitest", "coverage", "regression", "assert", "fixture", "verification"],
  docs: ["docs", "documentation", "confluence", "markdown", "brief", "requirements", "copy"],
  infra: ["docker", "redis", "postgres", "deploy", "queue", "worker", "runtime", "transport"],
  security: ["auth", "token", "permission", "policy", "pii", "privacy", "secret", "audit", "access"],
  data: ["data", "analytics", "report", "migration", "schema", "dataset", "quality", "score"],
};

export function classifyWorkItem(input: ClassifyWorkInput): WorkClassification {
  const text = normalize([
    input.title,
    input.description ?? "",
    ...(input.acceptanceCriteria ?? []),
    ...(input.labels ?? []),
  ].join(" "));
  const scores = Object.entries(KEYWORDS).map(([type, words]) => ({
    type: type as Exclude<WorkType, "unknown">,
    count: words.filter((word) => text.includes(word)).length,
  })).sort((a, b) => b.count - a.count);
  const best = scores[0];
  const workType: WorkType = best && best.count > 0 ? best.type : "unknown";
  const matched = workType === "unknown" ? [] : KEYWORDS[workType].filter((word) => text.includes(word));
  const skillTags = unique([
    ...TAGS_BY_TYPE[workType],
    ...matched,
  ]).slice(0, 8);
  const riskLevel = riskFor(text, workType, scores.filter((score) => score.count > 0).length);
  const confidence = confidenceFor(best?.count ?? 0, matched.length, workType);
  return {
    workType,
    skillTags,
    riskLevel,
    confidence,
    explanation: matched.length > 0
      ? `${workType} classification from matched terms: ${matched.slice(0, 4).join(", ")}`
      : "no strong classification terms matched",
  };
}

export function recommendAgentsForWork(input: RecommendAgentsInput): readonly AgentRecommendation[] {
  const live = input.sessions.map((session) => scoreAgent({
    agentId: session.sessionId,
    label: session.clientName ?? session.sessionId,
    source: "live",
    text: [session.clientName, session.clientVersion, ...session.featuresEnabled].filter(Boolean).join(" "),
    enabledFeatureCount: session.featuresEnabled.length,
    workerLike: true,
  }, input.classification));
  const profiles = input.profiles.map((profile) => scoreAgent({
    agentId: profile.id,
    label: profile.clientInfo.title ?? profile.clientInfo.name,
    source: "profile",
    text: [
      profile.clientInfo.name,
      profile.clientInfo.title ?? "",
      profile.clientInfo.version ?? "",
      profile.agentMode ?? "",
      ...profile.enabledServerFeatures,
      ...profileSkillTags(profile),
    ].join(" "),
    enabledFeatureCount: profile.enabledServerFeatures.length,
    workerLike: profile.agentMode === "worker" || profile.agentMode === "coordinated-worker",
  }, input.classification));
  return [...live, ...profiles]
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, 8);
}

function scoreAgent(agent: {
  readonly agentId: string;
  readonly label: string;
  readonly source: "live" | "profile";
  readonly text: string;
  readonly enabledFeatureCount: number;
  readonly workerLike: boolean;
}, classification: WorkClassification): AgentRecommendation {
  const agentText = normalize(agent.text);
  const matchedTags = classification.skillTags.filter((tag) => agentText.includes(normalize(tag)));
  const typeMatched = agentText.includes(classification.workType);
  const featureScore = Math.min(20, agent.enabledFeatureCount * 4);
  const matchScore = matchedTags.length * 16 + (typeMatched ? 18 : 0);
  const liveBonus = agent.source === "live" ? 10 : 0;
  const workerBonus = agent.workerLike ? 8 : 0;
  const score = Math.min(100, Math.round(matchScore + featureScore + liveBonus + workerBonus));
  const reasons = [
    ...(matchedTags.length > 0 ? [`matched ${matchedTags.slice(0, 4).join(", ")}`] : []),
    ...(typeMatched ? [`declares ${classification.workType} affinity`] : []),
    ...(agent.source === "live" ? ["currently connected"] : ["persisted session profile"]),
  ];
  return {
    agentId: agent.agentId,
    label: agent.label,
    score,
    matchedTags,
    reasons: reasons.length > 0 ? reasons : ["no explicit specialization match"],
    source: agent.source,
  };
}

function profileSkillTags(profile: PersistedMcpSessionProfile): readonly string[] {
  const maybe = profile as PersistedMcpSessionProfile & {
    readonly specializations?: readonly string[];
    readonly skillTags?: readonly string[];
  };
  return maybe.specializations ?? maybe.skillTags ?? [];
}

function riskFor(text: string, workType: WorkType, matchedTypes: number): WorkRiskLevel {
  if (/(security|auth|token|secret|migration|payment|permission|external|delete|destructive)/.test(text)) return "high";
  if (workType === "unknown" || matchedTypes > 2 || /(database|provider|webhook|queue|deploy)/.test(text)) return "medium";
  return "low";
}

function confidenceFor(bestCount: number, matchedCount: number, workType: WorkType): number {
  if (workType === "unknown") return 0.35;
  return Math.min(0.95, 0.55 + bestCount * 0.1 + matchedCount * 0.03);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}
