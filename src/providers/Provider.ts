// Common base for all providers (Atlassian Jira/Confluence, Bitbucket VCS,
// optional Rovo MCP, UIO partner, etc.). PAE F-015 — every provider exposes
// a `name`, a `healthCheck`, and a `capabilities()` snapshot for preflight.
//
// Concrete providers extend the relevant typed interface (JiraProvider,
// ConfluenceProvider, VcsProvider). Workflows depend on the typed interfaces;
// the base only carries cross-cutting concerns.

export interface Provider {
  readonly name: string;
  readonly kind: ProviderKind;
  healthCheck(): Promise<ProviderHealth>;
}

export type ProviderKind =
  | "atlassian.jira"
  | "atlassian.confluence"
  | "vcs.bitbucket"
  | "vcs.github"
  | "vcs.gitlab"
  | "uio"
  | "notification.slack"
  | "notification.teams";

export interface ProviderHealth {
  readonly reachable: boolean;
  readonly checkedAt: string;
  readonly details?: string;
  readonly latencyMs?: number;
}
