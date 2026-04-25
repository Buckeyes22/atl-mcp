// jiraRestProvider — Jira REST v3 implementation.
//
// M2 surface (per v6 §28 M2):
//   - discoverProjectCapabilities() via GET /rest/api/3/issue/createmeta/{projectIdOrKey}/issuetypes
//     (the non-deprecated endpoint; the older /createmeta?projectKeys=... is deprecated as of 2024)
//   - getIssue / searchByJql / createIssue / updateIssue (typed; minimal body)
//
// M6a expands createIssue/updateIssue with idempotency-key plumbing for
// retries + ADF formatting. M2 ships the wire shape so M5 planner can
// produce request payloads.

import type { Logger } from "pino";
import type { JiraProvider, JiraIssue, CreateIssueInput, UpdateIssuePatch, JiraProjectSummary } from "./jiraProvider.js";
import type { JiraProjectProfile } from "../../domain/projectProfile.js";
import type { AtlassianAuthProvider } from "./auth/types.js";
import type { ProviderHealth } from "../Provider.js";
import { createRestClient, type RestClient, type RestClientConfig } from "../http/restClient.js";

export interface JiraRestProviderConfig {
  readonly baseUrl: string;       // e.g. https://your-site.atlassian.net
  readonly auth: AtlassianAuthProvider;
  readonly logger: Logger;
  readonly userAgent?: string;
  /** Test injection for restClient. */
  readonly restClient?: RestClient;
}

export function createJiraRestProvider(config: JiraRestProviderConfig): JiraProvider {
  const client =
    config.restClient ??
    createRestClient({
      baseUrl: config.baseUrl,
      userAgent: config.userAgent ?? "atl-mcp-orchestrator/0.1.0",
      getAuthHeader: () => config.auth.getAuthHeader(),
      logger: config.logger,
    } satisfies RestClientConfig);

  async function discoverProjectCapabilities(projectKeyOrId: string): Promise<JiraProjectProfile> {
    // Step 1: project itself.
    const project = await client.request<JiraProjectResponse>({
      method: "GET",
      path: `/rest/api/3/project/${encodeURIComponent(projectKeyOrId)}`,
    });

    // Step 2: createmeta — issue types (no `fields` per-type on this endpoint).
    const createMeta = await client.request<JiraCreateMetaResponse>({
      method: "GET",
      path: `/rest/api/3/issue/createmeta/${encodeURIComponent(projectKeyOrId)}/issuetypes`,
    });

    // Step 3: per-issue-type field drill-down (F-010 closure).
    // The /createmeta/{key}/issuetypes endpoint does not return field metadata
    // for team-managed projects; required fields must be discovered per type
    // via /createmeta/{key}/issuetypes/{issueTypeId}.
    const perTypeFields = await Promise.all(
      createMeta.body.issueTypes.map(async (t) => {
        try {
          const res = await client.request<JiraCreateMetaFieldsResponse>({
            method: "GET",
            path: `/rest/api/3/issue/createmeta/${encodeURIComponent(projectKeyOrId)}/issuetypes/${encodeURIComponent(t.id)}`,
          });
          const required = (res.body.fields ?? [])
            .filter((f) => f.required && !f.hasDefaultValue)
            .map((f) => f.name);
          return [t.name, required] as const;
        } catch {
          // Fall back to the (likely empty) inline `fields` if the per-type call fails.
          const fallback = (t.fields ?? [])
            .filter((f) => f.required && !f.hasDefaultValue)
            .map((f) => f.name);
          return [t.name, fallback] as const;
        }
      }),
    );

    // Step 4: custom field map (paginated; M2 fetches first page only and emits a warning if more pages exist).
    const fields = await client.request<readonly JiraField[]>({
      method: "GET",
      path: `/rest/api/3/field`,
    });

    const issueTypes = createMeta.body.issueTypes.map((t) => t.name);
    const requiredFields: Record<string, string[]> = Object.fromEntries(perTypeFields.map(([k, v]) => [k, [...v]]));
    const customFieldMap: Record<string, string> = {};
    for (const f of fields.body) {
      if (f.custom) customFieldMap[f.name] = f.id;
    }

    const projectType: "company-managed" | "team-managed" =
      project.body.style === "next-gen" ? "team-managed" : "company-managed";

    return {
      projectKey: project.body.key,
      projectId: project.body.id,
      projectType,
      issueTypes,
      requiredFields,
      customFieldMap,
    };
  }

  return {
    name: "jira-rest",
    kind: "atlassian.jira",

    async healthCheck(): Promise<ProviderHealth> {
      const start = Date.now();
      try {
        await client.request({ method: "GET", path: "/rest/api/3/myself" });
        return { reachable: true, checkedAt: new Date().toISOString(), latencyMs: Date.now() - start };
      } catch (err) {
        return {
          reachable: false,
          checkedAt: new Date().toISOString(),
          details: err instanceof Error ? err.message : String(err),
        };
      }
    },

    discoverProjectCapabilities,

    async listProjects(opts): Promise<readonly JiraProjectSummary[]> {
      const max = opts?.maxResults ?? 50;
      const res = await client.request<JiraProjectSearchResponse>({
        method: "GET",
        path: `/rest/api/3/project/search?maxResults=${encodeURIComponent(String(max))}`,
      });
      return res.body.values.map((p) => ({
        id: p.id,
        key: p.key,
        name: p.name,
        ...(p.projectTypeKey ? { projectTypeKey: p.projectTypeKey } : {}),
        ...(p.style ? { style: p.style } : {}),
        ...(p.lead?.displayName ? { leadDisplayName: p.lead.displayName } : {}),
      }));
    },

    async searchByJql(jql, opts) {
      // M2 returns first page only. Cursor-based pagination via nextPageToken
      // is wired in M5 (planner needs full result sets for dependency analysis).
      const res = await client.request<JiraSearchResponse>({
        method: "POST",
        path: "/rest/api/3/search/jql",
        body: { jql, maxResults: opts?.maxResults ?? 50 },
      });
      return res.body.issues.map(toJiraIssue);
    },

    async getIssue(keyOrId) {
      const res = await client.request<JiraIssueResponse>({
        method: "GET",
        path: `/rest/api/3/issue/${encodeURIComponent(keyOrId)}`,
      });
      return toJiraIssue(res.body);
    },

    async createIssue(input: CreateIssueInput) {
      const fields: Record<string, unknown> = {
        project: { key: input.projectKey },
        issuetype: { name: input.issueType },
        summary: input.summary,
        ...(input.description !== undefined && input.description !== null
          ? { description: input.description }
          : {}),
        ...(input.labels !== undefined ? { labels: input.labels } : {}),
        ...(input.fields ?? {}),
      };
      const res = await client.request<JiraIssueResponse>({
        method: "POST",
        path: "/rest/api/3/issue",
        body: { fields },
        ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
      });
      return toJiraIssue(res.body);
    },

    async updateIssue(keyOrId: string, patch: UpdateIssuePatch) {
      const fields: Record<string, unknown> = {
        ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.labels !== undefined ? { labels: patch.labels } : {}),
        ...(patch.fields ?? {}),
      };
      await client.request({
        method: "PUT",
        path: `/rest/api/3/issue/${encodeURIComponent(keyOrId)}`,
        body: { fields },
      });
      // Re-fetch for the updated representation.
      const res = await client.request<JiraIssueResponse>({
        method: "GET",
        path: `/rest/api/3/issue/${encodeURIComponent(keyOrId)}`,
      });
      return toJiraIssue(res.body);
    },
  };
}

function toJiraIssue(raw: JiraIssueResponse): JiraIssue {
  return { id: raw.id, key: raw.key, fields: raw.fields ?? {} };
}

// ----- Wire types (subset; full Atlassian REST schemas are large) -----

interface JiraProjectResponse {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  /** "next-gen" indicates team-managed; "classic" / "software" indicates company-managed. */
  readonly style?: string;
}

interface JiraProjectSearchResponse {
  readonly values: ReadonlyArray<{
    readonly id: string;
    readonly key: string;
    readonly name: string;
    readonly projectTypeKey?: string;
    readonly style?: string;
    readonly lead?: { readonly displayName?: string };
  }>;
  readonly isLast?: boolean;
  readonly maxResults?: number;
  readonly startAt?: number;
}

interface JiraCreateMetaResponse {
  readonly issueTypes: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly fields?: ReadonlyArray<{
      readonly fieldId: string;
      readonly name: string;
      readonly required: boolean;
      readonly hasDefaultValue: boolean;
    }>;
  }>;
}

interface JiraCreateMetaFieldsResponse {
  readonly fields: ReadonlyArray<{
    readonly fieldId: string;
    readonly name: string;
    readonly required: boolean;
    readonly hasDefaultValue: boolean;
  }>;
}

interface JiraField {
  readonly id: string;
  readonly name: string;
  readonly custom: boolean;
}

interface JiraIssueResponse {
  readonly id: string;
  readonly key: string;
  readonly fields?: Record<string, unknown>;
}

// Jira's new /search/jql endpoint (replacing the deprecated /search) uses
// cursor-based pagination, NOT the legacy startAt/maxResults/total.
// Real shape: { isLast, issues, nextPageToken }.
interface JiraSearchResponse {
  readonly issues: readonly JiraIssueResponse[];
  readonly isLast?: boolean;
  readonly nextPageToken?: string;
}
