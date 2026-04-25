// TraceLink connects two artifacts with a typed relation.
// ProjectGraph (a derived view) aggregates these into a queryable graph.

import type { ArtifactRef } from "./artifactRef.js";

export type TraceRelation =
  | "defines"
  | "implements"
  | "depends_on"
  | "documents"
  | "tests"
  | "references"
  | "blocks"
  | "annotates";

export interface TraceLink {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly source: ArtifactRef;
  readonly target: ArtifactRef;
  readonly relation: TraceRelation;
  readonly createdAt: string;
  readonly observedBy?: string;     // tool name that recorded the link
}
