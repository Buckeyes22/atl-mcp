// ACL entry observed for a principal × artifact tuple. M7 access gate consults
// these (with TTL refresh on permission webhooks). Classification per
// open-edison F-126 (PUBLIC/PRIVATE/SECRET).

import type { ArtifactRef } from "./artifactRef.js";

export type AclDecision = "allowed" | "denied";
export type AclSource =
  | "jira_permission_check"
  | "confluence_content_permission"
  | "vcs_repo_permission";
export type AclClassification = "PUBLIC" | "PRIVATE" | "SECRET";

export interface AclEntry {
  readonly tenantId: string;
  readonly projectId: string;
  readonly artifactRef: ArtifactRef;
  readonly principalId: string;
  readonly decision: AclDecision;
  readonly observedAt: string;
  readonly source: AclSource;
  readonly classification: AclClassification;
}
