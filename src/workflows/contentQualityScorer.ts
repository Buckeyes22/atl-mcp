import type { ProjectBlueprint } from "../domain/projectBlueprint.js";
import type { ContentQualityFinding, ContentQualityGrade } from "../domain/contentQuality.js";

export interface ScoreProjectContentQualityInput {
  readonly project: ProjectBlueprint;
  readonly artifactSummary?: {
    readonly traceRows?: readonly unknown[];
    readonly jira?: { readonly issueCount?: number; readonly plannedCount?: number; readonly status?: string };
    readonly confluence?: { readonly pageCount?: number; readonly plannedCount?: number; readonly status?: string };
    readonly handoff?: { readonly status?: string };
  };
  readonly now?: () => string;
}

export interface ContentQualityScoreResult {
  readonly score: number;
  readonly grade: ContentQualityGrade;
  readonly findings: readonly ContentQualityFinding[];
  readonly recommendations: readonly string[];
  readonly deterministic: true;
}

export function scoreProjectContentQuality(input: ScoreProjectContentQualityInput): ContentQualityScoreResult {
  const project = input.project;
  const findings: ContentQualityFinding[] = [
    completenessFinding(project),
    traceabilityFinding(project, input.artifactSummary),
    sourceGroundingFinding(project),
    freshnessFinding(project, input.now ? input.now() : new Date().toISOString()),
    consistencyFinding(project),
    actionabilityFinding(project),
  ];
  const score = Math.max(0, Math.min(100, Math.round(findings.reduce((sum, finding) => sum + finding.score, 0))));
  return {
    score,
    grade: gradeFor(score),
    findings,
    recommendations: findings
      .filter((finding) => finding.status !== "pass")
      .map((finding) => recommendationFor(finding.id)),
    deterministic: true,
  };
}

function completenessFinding(project: ProjectBlueprint): ContentQualityFinding {
  let score = 0;
  if (project.goals.length > 0) score += 4;
  if (project.requirements.length > 0) score += 5;
  if (project.epics.length > 0) score += 4;
  if (project.epics.some((epic) => epic.stories.length > 0)) score += 4;
  if (project.risks.length > 0 || project.openQuestions.length === 0) score += 3;
  return finding("completeness", "Completeness", score, 20, "goals, requirements, epics, stories, and risk/open-question coverage");
}

function traceabilityFinding(
  project: ProjectBlueprint,
  artifactSummary: ScoreProjectContentQualityInput["artifactSummary"],
): ContentQualityFinding {
  const requirementsWithSources = project.requirements.filter((requirement) => requirement.sourceRefs.length > 0).length;
  const linkedRequirements = project.requirements.length > 0
    ? Math.round((requirementsWithSources / project.requirements.length) * 10)
    : 0;
  const traceRows = artifactSummary?.traceRows?.length ?? 0;
  const linkedArtifacts = [
    artifactSummary?.jira?.status,
    artifactSummary?.confluence?.status,
    artifactSummary?.handoff?.status,
  ].filter((status) => status === "linked" || status === "ready").length;
  const score = Math.min(18, linkedRequirements + Math.min(5, traceRows) + linkedArtifacts);
  return finding("traceability", "Traceability", score, 18, "requirements should connect to source refs and generated artifacts");
}

function sourceGroundingFinding(project: ProjectBlueprint): ContentQualityFinding {
  const sourcePinScore = Math.min(10, project.sourcePins.length * 5);
  const checksumScore = project.sourcePins.some((pin) => pin.contentChecksum) ? 4 : 0;
  const intakeScore = project.intake ? 2 : 0;
  return finding("source-grounding", "Source grounding", sourcePinScore + checksumScore + intakeScore, 16, "source pins and checksums preserve provenance");
}

function freshnessFinding(project: ProjectBlueprint, nowIso: string): ContentQualityFinding {
  const ageMs = Math.max(0, new Date(nowIso).getTime() - new Date(project.updatedAt).getTime());
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  const score = ageDays <= 14 ? 14 : ageDays <= 45 ? 10 : ageDays <= 90 ? 6 : 2;
  return finding("freshness", "Freshness", score, 14, `${Math.round(ageDays)} day(s) since last project update`);
}

function consistencyFinding(project: ProjectBlueprint): ContentQualityFinding {
  const requirementIds = new Set(project.requirements.map((requirement) => requirement.id));
  const missingRefs = project.features.reduce((sum, feature) => (
    sum + feature.requirementIds.filter((id) => !requirementIds.has(id)).length
  ), 0);
  const duplicateReqs = project.requirements.length - new Set(project.requirements.map((requirement) => requirement.id)).size;
  const openQuestionsPenalty = Math.min(6, project.openQuestions.length * 2);
  const score = Math.max(0, 14 - missingRefs * 3 - duplicateReqs * 3 - openQuestionsPenalty);
  return finding("consistency", "Consistency", score, 14, "feature links, duplicate IDs, and open questions should not conflict");
}

function actionabilityFinding(project: ProjectBlueprint): ContentQualityFinding {
  const requirementSignals = project.requirements.filter((requirement) => requirement.acceptanceSignals.length > 0).length;
  const storyCriteria = project.epics.flatMap((epic) => epic.stories).filter((story) => story.acceptanceCriteria.length > 0).length;
  const reqScore = project.requirements.length > 0 ? Math.round((requirementSignals / project.requirements.length) * 9) : 0;
  const storyCount = project.epics.flatMap((epic) => epic.stories).length;
  const storyScore = storyCount > 0 ? Math.round((storyCriteria / storyCount) * 9) : 0;
  const hasNextWork = project.epics.some((epic) => epic.stories.length > 0) ? 2 : 0;
  return finding("actionability", "Actionability", reqScore + storyScore + hasNextWork, 18, "acceptance signals and story criteria make work assignable");
}

function finding(id: string, label: string, score: number, maxScore: number, detail: string): ContentQualityFinding {
  const bounded = Math.max(0, Math.min(maxScore, score));
  const ratio = bounded / maxScore;
  return {
    id,
    label,
    score: bounded,
    maxScore,
    status: ratio >= 0.75 ? "pass" : ratio >= 0.45 ? "warn" : "fail",
    detail,
  };
}

function gradeFor(score: number): ContentQualityGrade {
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  return "D";
}

function recommendationFor(id: string): string {
  const map: Record<string, string> = {
    completeness: "Add missing goals, requirements, epics, stories, or risk notes.",
    traceability: "Link requirements to source refs, Jira cards, Confluence pages, and trace rows.",
    "source-grounding": "Attach source pins with checksums for briefs or imported documents.",
    freshness: "Refresh the blueprint or rerun readiness before assigning build work.",
    consistency: "Resolve open questions and broken requirement references.",
    actionability: "Add acceptance signals and verification criteria before handoff.",
  };
  return map[id] ?? "Review the content quality finding.";
}
