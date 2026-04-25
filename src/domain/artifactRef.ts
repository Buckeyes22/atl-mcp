// ArtifactRef is the canonical pointer to any external artifact: a Jira issue,
// a Confluence page, a VCS commit/branch/file, or an internal blueprint section.
// Every TraceLink, SourcePin, and AclEntry refers to artifacts via ArtifactRef.

export type ArtifactKind =
  | "jira_issue"
  | "jira_project"
  | "confluence_page"
  | "confluence_space"
  | "vcs_repo"
  | "vcs_branch"
  | "vcs_commit"
  | "vcs_file"
  | "vcs_pull_request"
  | "blueprint_section"
  | "context_pack"
  | "uio_source"
  | "url";

export interface ArtifactRef {
  readonly kind: ArtifactKind;
  /** Stable identifier in the source system (issue key, page id, commit sha, etc). */
  readonly id: string;
  /** Optional human-friendly URL pointer. */
  readonly url?: string;
  /** Optional version pinning hint; full versioning lives on SourcePin. */
  readonly version?: string;
}

/** A pointer back to where information came from. Lighter-weight than ArtifactRef. */
export interface SourceRef {
  readonly kind: ArtifactKind;
  readonly id: string;
  readonly excerpt?: string;   // optional snippet for traceability in agent context
}

export interface RepoFileRef {
  readonly path: string;        // repo-relative; never absolute
  readonly commitSha?: string;
  readonly lineRange?: { start: number; end: number };
}

export function artifactRefKey(ref: ArtifactRef): string {
  return `${ref.kind}:${ref.id}`;
}
