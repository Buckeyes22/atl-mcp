// ProjectProfile is the live snapshot of capability discovery (v6 §28 M2).
// M1 defines the persisted shape; M2 populates it. Sub-profiles are
// deliberately minimal stubs in M1 — they expand as their owning provider
// lands.

export interface JiraProjectProfile {
  readonly projectKey: string;
  readonly projectId: string;
  readonly projectType: "company-managed" | "team-managed";
  readonly issueTypes: readonly string[];
  readonly requiredFields: Readonly<Record<string, readonly string[]>>;  // issueType → required field names
  readonly customFieldMap: Readonly<Record<string, string>>;             // human name → field id
}

export interface ConfluenceSpaceProfile {
  readonly spaceKey: string;
  readonly spaceId: string;
  readonly bodyRepresentations: readonly ("storage" | "atlas_doc_format")[];
}

export interface VcsRepoProfile {
  readonly provider: "bitbucket_cloud" | "github" | "gitlab";
  readonly workspace: string;
  readonly repoSlug: string;
  readonly defaultBranch: string;
  readonly branchProtectionRules: readonly string[];
}

export interface VectorStoreProfile {
  readonly reachable: boolean;
  readonly collections: readonly string[];
  readonly embeddingEndpoint: { reachable: boolean; model?: string };
}

export interface AuthCapabilityProfile {
  readonly modes: readonly ("api_token" | "oauth3lo" | "service_account")[];
  readonly oauthScopesGranted: readonly string[];
  readonly tokenRotationConfigured: boolean;
}

export interface WebhookRegistrationProfile {
  readonly registered: ReadonlyArray<{ source: string; eventTypes: readonly string[] }>;
}

export interface UioPartnerProfile {
  readonly baseUrlReachable: boolean;
  readonly qdrantReachable: boolean;
  readonly defaultCollectionExists: boolean;
  readonly apiKeyValid: boolean;
}

export type ProfileWarningTarget =
  | "jira"
  | "confluence"
  | "vcs"
  | "vector"
  | "auth"
  | "webhooks"
  | "uio";

export type ProfileWarningSeverity = "info" | "warn" | "error";

export interface ProfileWarning {
  readonly id: string;
  readonly target: ProfileWarningTarget;
  readonly code: string;
  readonly severity: ProfileWarningSeverity;
  readonly message: string;
}

export type AccessGateMode = "local" | "remote_check" | "cached_acl";

export interface ProjectProfile {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly generatedAt: string;
  readonly expiresAt: string;
  readonly accessGateMode: AccessGateMode;
  readonly jira: JiraProjectProfile;
  readonly confluence: ConfluenceSpaceProfile;
  readonly vcs: VcsRepoProfile;
  readonly vector: VectorStoreProfile;
  readonly auth: AuthCapabilityProfile;
  readonly webhooks: WebhookRegistrationProfile;
  readonly uio?: UioPartnerProfile;
  readonly warnings: readonly ProfileWarning[];
}
