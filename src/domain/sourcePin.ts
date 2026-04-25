// Pinned reference to an artifact at a specific version + content checksum.
// Carried in ProjectBlueprint and ContextPack. Enables drift detection
// (v6 §6.3 + context-fabric F-044 SHA256-based drift) and deterministic
// regeneration of context packs.

import type { ArtifactRef } from "./artifactRef.js";

export interface SourcePin {
  readonly artifactRef: ArtifactRef;
  /** Version in source semantics: Confluence page version, Jira updated ts, Git SHA. */
  readonly version: string;
  /** sha256 of the content body at this version. */
  readonly contentChecksum: string;
  readonly pinnedAt: string;       // ISO8601
  readonly uioSourceId?: string;
  readonly uioChunkIndices?: readonly number[];
}
