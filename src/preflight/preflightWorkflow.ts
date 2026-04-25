// project_preflight_check workflow — composes all capability discoverers
// into a single ProjectProfile per v6 §10.
//
// Inputs are abstracted: Jira / Confluence / VCS / UIO providers (any may be
// absent). Output is a fully-populated ProjectProfile + a list of
// ProfileWarning. The workflow NEVER throws on partial failure — each
// discovery is independent and contributes a warning instead.

import { randomUUID } from "node:crypto";
import type { Logger } from "pino";
import type { JiraProvider } from "../providers/atlassian/jiraProvider.js";
import type { ConfluenceProvider } from "../providers/atlassian/confluenceProvider.js";
import type { VcsProvider } from "../providers/vcs/VcsProvider.js";
import type { UioAdapter } from "../providers/uio/uioMcpAdapter.js";
import type {
  AccessGateMode,
  AuthCapabilityProfile,
  ConfluenceSpaceProfile,
  JiraProjectProfile,
  ProfileWarning,
  ProjectProfile,
  VcsRepoProfile,
  VectorStoreProfile,
  WebhookRegistrationProfile,
  UioPartnerProfile,
} from "../domain/projectProfile.js";

export interface PreflightInput {
  readonly tenantId: string;
  readonly projectId: string;
  readonly jiraProjectKeyOrId: string;
  readonly confluenceSpaceKeyOrId: string;
  readonly vcsWorkspace?: string;
  readonly vcsRepoSlug?: string;
  /** TTL for the resulting profile in seconds. Default 1 hour. */
  readonly ttlSeconds?: number;
}

export interface PreflightDeps {
  readonly jira?: JiraProvider | undefined;
  readonly confluence?: ConfluenceProvider | undefined;
  readonly vcs?: VcsProvider | undefined;
  readonly uio?: UioAdapter | undefined;
  /** Auth descriptor for the AuthCapabilityProfile section. */
  readonly authMode: "api_token" | "oauth3lo" | "service_account";
  readonly oauthScopesGranted?: readonly string[];
  readonly tokenRotationConfigured?: boolean;
  readonly accessGateMode?: AccessGateMode;
  readonly logger: Logger;
}

export async function runPreflight(input: PreflightInput, deps: PreflightDeps): Promise<ProjectProfile> {
  const warnings: ProfileWarning[] = [];
  const ttlSec = input.ttlSeconds ?? 3600;
  const generatedAt = new Date();
  const expiresAt = new Date(generatedAt.getTime() + ttlSec * 1000);

  const jira = await safeDiscoverJira(deps, input, warnings);
  const confluence = await safeDiscoverConfluence(deps, input, warnings);
  const vcs = await safeDiscoverVcs(deps, input, warnings);
  const uio = await safeProbeUio(deps, warnings);
  const vector = stubVectorProfile(warnings);
  const auth = buildAuthProfile(deps);
  const webhooks = stubWebhookProfile();

  return {
    id: randomUUID(),
    tenantId: input.tenantId,
    projectId: input.projectId,
    generatedAt: generatedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    accessGateMode: deps.accessGateMode ?? "local",
    jira,
    confluence,
    vcs,
    vector,
    auth,
    webhooks,
    ...(uio !== undefined ? { uio } : {}),
    warnings,
  };
}

async function safeDiscoverJira(
  deps: PreflightDeps,
  input: PreflightInput,
  warnings: ProfileWarning[],
): Promise<JiraProjectProfile> {
  if (!deps.jira) {
    warnings.push(makeWarning("jira", "JIRA_PROVIDER_ABSENT", "warn", "no JiraProvider configured"));
    return emptyJiraProfile(input.jiraProjectKeyOrId);
  }
  try {
    return await deps.jira.discoverProjectCapabilities(input.jiraProjectKeyOrId);
  } catch (err) {
    deps.logger.warn({ err, projectKeyOrId: input.jiraProjectKeyOrId }, "jira capability discovery failed");
    warnings.push(
      makeWarning(
        "jira",
        "JIRA_DISCOVERY_FAILED",
        "error",
        `discoverProjectCapabilities failed: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
    return emptyJiraProfile(input.jiraProjectKeyOrId);
  }
}

async function safeDiscoverConfluence(
  deps: PreflightDeps,
  input: PreflightInput,
  warnings: ProfileWarning[],
): Promise<ConfluenceSpaceProfile> {
  if (!deps.confluence) {
    warnings.push(
      makeWarning("confluence", "CONFLUENCE_PROVIDER_ABSENT", "warn", "no ConfluenceProvider configured"),
    );
    return emptyConfluenceProfile(input.confluenceSpaceKeyOrId);
  }
  try {
    return await deps.confluence.discoverSpaceCapabilities(input.confluenceSpaceKeyOrId);
  } catch (err) {
    warnings.push(
      makeWarning(
        "confluence",
        "CONFLUENCE_DISCOVERY_FAILED",
        "error",
        `discoverSpaceCapabilities failed: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
    return emptyConfluenceProfile(input.confluenceSpaceKeyOrId);
  }
}

async function safeDiscoverVcs(
  deps: PreflightDeps,
  input: PreflightInput,
  warnings: ProfileWarning[],
): Promise<VcsRepoProfile> {
  if (!deps.vcs || !input.vcsWorkspace || !input.vcsRepoSlug) {
    warnings.push(makeWarning("vcs", "VCS_NOT_CONFIGURED", "info", "VCS provider not configured (lands with M3)"));
    return {
      provider: "bitbucket_cloud",
      workspace: input.vcsWorkspace ?? "",
      repoSlug: input.vcsRepoSlug ?? "",
      defaultBranch: "main",
      branchProtectionRules: [],
    };
  }
  try {
    return await deps.vcs.discoverRepoCapabilities(input.vcsWorkspace, input.vcsRepoSlug);
  } catch (err) {
    warnings.push(
      makeWarning(
        "vcs",
        "VCS_DISCOVERY_FAILED",
        "error",
        `discoverRepoCapabilities failed: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
    return {
      provider: "bitbucket_cloud",
      workspace: input.vcsWorkspace,
      repoSlug: input.vcsRepoSlug,
      defaultBranch: "main",
      branchProtectionRules: [],
    };
  }
}

async function safeProbeUio(deps: PreflightDeps, warnings: ProfileWarning[]): Promise<UioPartnerProfile | undefined> {
  if (!deps.uio || !deps.uio.enabled) return undefined;
  try {
    const profile = await deps.uio.probe();
    if (profile && (!profile.baseUrlReachable || !profile.qdrantReachable)) {
      warnings.push(
        makeWarning(
          "uio",
          "UIO_PARTIAL_REACH",
          "warn",
          `uio.baseUrlReachable=${profile.baseUrlReachable}, qdrantReachable=${profile.qdrantReachable}`,
        ),
      );
    }
    return profile;
  } catch (err) {
    warnings.push(
      makeWarning(
        "uio",
        "UIO_PROBE_FAILED",
        "warn",
        `uio probe threw: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
    return { baseUrlReachable: false, qdrantReachable: false, defaultCollectionExists: false, apiKeyValid: false };
  }
}

function stubVectorProfile(warnings: ProfileWarning[]): VectorStoreProfile {
  warnings.push(
    makeWarning(
      "vector",
      "VECTOR_NOT_CONFIGURED",
      "info",
      "vector store reachability check lands with M7 (context packs)",
    ),
  );
  return { reachable: false, collections: [], embeddingEndpoint: { reachable: false } };
}

function buildAuthProfile(deps: PreflightDeps): AuthCapabilityProfile {
  return {
    modes: [deps.authMode],
    oauthScopesGranted: deps.oauthScopesGranted ?? [],
    tokenRotationConfigured: deps.tokenRotationConfigured ?? deps.authMode === "oauth3lo",
  };
}

function stubWebhookProfile(): WebhookRegistrationProfile {
  // M10 wires actual webhook discovery; M2 reports empty registration.
  return { registered: [] };
}

function emptyJiraProfile(projectKeyOrId: string): JiraProjectProfile {
  return {
    projectKey: projectKeyOrId,
    projectId: "",
    projectType: "company-managed",
    issueTypes: [],
    requiredFields: {},
    customFieldMap: {},
  };
}

function emptyConfluenceProfile(spaceKeyOrId: string): ConfluenceSpaceProfile {
  return {
    spaceKey: spaceKeyOrId,
    spaceId: "",
    bodyRepresentations: ["storage"],
  };
}

function makeWarning(
  target: ProfileWarning["target"],
  code: string,
  severity: ProfileWarning["severity"],
  message: string,
): ProfileWarning {
  return { id: randomUUID(), target, code, severity, message };
}
