import type { ArtifactRef } from "./artifactRef.js";

export type ContentQualityGrade = "A" | "B" | "C" | "D";
export type ContentQualityFindingStatus = "pass" | "warn" | "fail";

export interface ContentQualityFinding {
  readonly id: string;
  readonly label: string;
  readonly score: number;
  readonly maxScore: number;
  readonly status: ContentQualityFindingStatus;
  readonly detail: string;
}

export interface ContentQualityLlmCritique {
  readonly status: "unavailable" | "available";
  readonly summary?: string;
  readonly confidence?: number;
  readonly notes?: readonly string[];
}

export interface ContentQualityReport {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly artifactRef: ArtifactRef;
  readonly score: number;
  readonly grade: ContentQualityGrade;
  readonly findings: readonly ContentQualityFinding[];
  readonly recommendations: readonly string[];
  readonly deterministic: boolean;
  readonly llmCritique?: ContentQualityLlmCritique;
  readonly generatedAt: string;
}
