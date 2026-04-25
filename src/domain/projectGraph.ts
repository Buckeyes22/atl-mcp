// ProjectGraph is a derived view over TraceLinks for a project. It is not
// persisted as its own table — it is materialized on demand by joining the
// traceLinks table with the artifacts they reference (and deduplicating).
// M1 only defines the type; the materializer lands with M7 context-pack assembly.

import type { ArtifactRef } from "./artifactRef.js";
import type { TraceLink } from "./traceLink.js";

export interface ProjectGraphNode {
  readonly artifactRef: ArtifactRef;
  /** Count of inbound + outbound edges; used by relevance ranking. */
  readonly degree: number;
}

export interface ProjectGraph {
  readonly tenantId: string;
  readonly projectId: string;
  readonly nodes: readonly ProjectGraphNode[];
  readonly edges: readonly TraceLink[];
  readonly materializedAt: string;
}
