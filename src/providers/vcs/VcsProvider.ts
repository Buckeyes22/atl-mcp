// VcsProvider — full interface for M3.
//
// Bitbucket Cloud is the first concrete adapter (v6 §3). Interface is shaped
// so GitHub + GitLab adapters drop in without interface changes. The kind
// union and provider-specific options carry the differences.

import type { Provider } from "../Provider.js";
import type { VcsRepoProfile } from "../../domain/projectProfile.js";

export type VcsProviderKind = "vcs.bitbucket" | "vcs.github" | "vcs.gitlab";

export interface VcsProvider extends Provider {
  readonly kind: VcsProviderKind;

  /**
   * Create a new repository under the given workspace. Idempotent on re-run
   * against an existing slug — returns the existing repo's metadata rather
   * than failing. Used by M6c to scaffold new project repos.
   */
  createRepository(args: CreateRepositoryArgs): Promise<VcsRepositoryCreated>;

  /** Discover repo capabilities for project_preflight_check. */
  discoverRepoCapabilities(workspace: string, repoSlug: string): Promise<VcsRepoProfile>;

  /** List branches matching an optional prefix. Used for drift checks + preflight. */
  listBranches(args: ListBranchesArgs): Promise<readonly VcsBranch[]>;

  /** Create a branch from a base ref (default branch by default). */
  createBranch(args: CreateBranchArgs): Promise<VcsBranch>;

  /** Get a single file's contents at a ref. Returns undefined if missing. */
  getFile(args: GetFileArgs): Promise<VcsFileContent | undefined>;

  /** Create OR update a file on a branch. Returns the resulting commit. */
  putFile(args: PutFileArgs): Promise<VcsCommit>;

  /** Create a pull request from a head ref to a base ref. */
  createPullRequest(args: CreatePullRequestArgs): Promise<VcsPullRequest>;

  /** Get a pull request by id. */
  getPullRequest(args: GetPullRequestArgs): Promise<VcsPullRequest>;

  /** Update a pull request's title or description. */
  updatePullRequest(args: UpdatePullRequestArgs): Promise<VcsPullRequest>;
}

// ----- Common identifiers -----

export interface RepoRef {
  readonly workspace: string;
  readonly repoSlug: string;
}

// ----- Repository creation -----

export interface CreateRepositoryArgs {
  readonly workspace: string;
  readonly slug: string;
  readonly isPrivate: boolean;
  readonly description?: string;
}

export interface VcsRepositoryCreated {
  readonly workspace: string;
  readonly slug: string;
  /** Web URL operators can open in a browser. */
  readonly url: string;
  /** Default branch the repo will use for the first push. */
  readonly defaultBranch: string;
  /** True when the repo already existed (idempotent re-run). */
  readonly alreadyExisted: boolean;
}

// ----- Branches -----

export interface VcsBranch {
  readonly name: string;
  readonly targetCommitSha: string;
  readonly isProtected?: boolean;
}

export interface ListBranchesArgs extends RepoRef {
  readonly namePrefix?: string;
  readonly maxResults?: number;
}

export interface CreateBranchArgs extends RepoRef {
  readonly newBranchName: string;
  /** Source ref to branch from. When omitted, branches from the repo's default branch. */
  readonly fromRef?: string;
}

// ----- Files -----

export interface VcsFileContent {
  readonly path: string;
  readonly contents: string;        // UTF-8; binary files are post-v1
  readonly commitSha: string;
}

export interface GetFileArgs extends RepoRef {
  readonly path: string;
  readonly ref: string;             // branch name OR commit sha
}

export interface PutFileArgs extends RepoRef {
  readonly path: string;
  readonly contents: string;
  readonly branch: string;
  readonly commitMessage: string;
  /** Commit author name + email; defaults are provider-specific. */
  readonly author?: { name: string; email: string };
  /** When provided, the put fails if HEAD of branch ≠ this sha (optimistic concurrency). */
  readonly expectedHeadSha?: string;
}

export interface VcsCommit {
  readonly sha: string;
  readonly message: string;
  readonly authorName?: string;
  readonly authoredAt?: string;     // ISO8601
}

// ----- Pull Requests -----

export type PullRequestState = "OPEN" | "MERGED" | "DECLINED" | "SUPERSEDED";

export interface VcsPullRequest {
  readonly id: number;
  readonly title: string;
  readonly description?: string;
  readonly state: PullRequestState;
  readonly sourceBranch: string;
  readonly destinationBranch: string;
  readonly url?: string;
}

export interface CreatePullRequestArgs extends RepoRef {
  readonly title: string;
  readonly description?: string;
  readonly sourceBranch: string;
  readonly destinationBranch: string;
  readonly closeSourceBranch?: boolean;
}

export interface GetPullRequestArgs extends RepoRef {
  readonly pullRequestId: number;
}

export interface UpdatePullRequestArgs extends RepoRef {
  readonly pullRequestId: number;
  readonly title?: string;
  readonly description?: string;
}
