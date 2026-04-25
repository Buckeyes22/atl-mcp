// JiraProvider interface. Concrete implementations: jiraRestProvider (M2 +
// M6a), rovoMcpProvider (read-only mediator; M2 stub).
//
// M2 surface: capability discovery (project, issue types, required fields,
// custom field map, link types). Write methods are typed but unused until M6a.

import type { Provider } from "../Provider.js";
import type { JiraProjectProfile } from "../../domain/projectProfile.js";
import type { AdfDocument } from "./adf.js";

export interface JiraProvider extends Provider {
  readonly kind: "atlassian.jira";
  /** Discover everything project_preflight_check needs about a Jira project. */
  discoverProjectCapabilities(projectKeyOrId: string): Promise<JiraProjectProfile>;
  /**
   * List projects visible to the authenticated principal. Used by the
   * operator control plane (admin.atlassian.projects.list) to surface Cloud
   * inventory for adoption. First page only in v1.
   */
  listProjects(opts?: { readonly maxResults?: number }): Promise<readonly JiraProjectSummary[]>;
  /** Search by JQL. Stubbed in M2; full impl + pagination in M5. */
  searchByJql(jql: string, opts?: { maxResults?: number }): Promise<readonly JiraIssue[]>;
  /** Fetch a single issue. */
  getIssue(keyOrId: string): Promise<JiraIssue>;
  /** Create an issue. M5/M6a wires this into provisioning. */
  createIssue(input: CreateIssueInput): Promise<JiraIssue>;
  /** Update an issue. */
  updateIssue(keyOrId: string, patch: UpdateIssuePatch): Promise<JiraIssue>;
}

export interface JiraProjectSummary {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly projectTypeKey?: string;
  readonly style?: string;
  readonly leadDisplayName?: string;
}

export interface JiraIssue {
  readonly id: string;
  readonly key: string;
  readonly fields: Readonly<Record<string, unknown>>;
}

export interface CreateIssueInput {
  readonly projectKey: string;
  readonly issueType: string;
  readonly summary: string;
  /** ADF document for the description; null/undefined → no description. */
  readonly description?: AdfDocument | null;
  /** Free-form custom field map. Caller is responsible for using customField IDs (`customfield_NNNNN`). */
  readonly fields?: Readonly<Record<string, unknown>>;
  readonly labels?: readonly string[];
  /** Optional idempotency key passthrough; restClient generates one when absent. */
  readonly idempotencyKey?: string;
}

export interface UpdateIssuePatch {
  readonly summary?: string;
  readonly description?: AdfDocument | null;
  readonly fields?: Readonly<Record<string, unknown>>;
  readonly labels?: readonly string[];
}

/**
 * ADF document — full type lives in src/providers/atlassian/adf.ts.
 * Re-exported here to avoid forcing every consumer to import from two places.
 */
export type { AdfDocument } from "./adf.js";
