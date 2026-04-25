import type { Logger } from "pino";
import type { VcsRepoProfile } from "../../../domain/projectProfile.js";
import type { ProviderHealth } from "../../Provider.js";
import {
  createRestClient,
  ProviderClientError,
  type RestClient,
  type RestClientConfig,
} from "../../http/restClient.js";
import type {
  CreateBranchArgs,
  CreatePullRequestArgs,
  CreateRepositoryArgs,
  GetFileArgs,
  GetPullRequestArgs,
  ListBranchesArgs,
  PullRequestState,
  PutFileArgs,
  UpdatePullRequestArgs,
  VcsBranch,
  VcsCommit,
  VcsFileContent,
  VcsProvider,
  VcsPullRequest,
  VcsRepositoryCreated,
} from "../VcsProvider.js";

const GITHUB_API_BASE = "https://api.github.com";

export interface GithubRestProviderConfig {
  readonly token: string;
  readonly logger: Logger;
  readonly userAgent?: string;
  readonly baseUrl?: string;
  readonly restClient?: RestClient;
}

export function createGithubRestProvider(config: GithubRestProviderConfig): VcsProvider {
  const baseUrl = config.baseUrl ?? GITHUB_API_BASE;
  const client =
    config.restClient ??
    createRestClient({
      baseUrl,
      userAgent: config.userAgent ?? "atl-mcp-orchestrator/0.1.0",
      getAuthHeader: async () => `Bearer ${config.token}`,
      logger: config.logger,
    } satisfies RestClientConfig);

  return {
    name: "github-rest",
    kind: "vcs.github",

    async healthCheck(): Promise<ProviderHealth> {
      const start = Date.now();
      try {
        await client.request({ method: "GET", path: "/user" });
        return { reachable: true, checkedAt: new Date().toISOString(), latencyMs: Date.now() - start };
      } catch (err) {
        return {
          reachable: false,
          checkedAt: new Date().toISOString(),
          details: err instanceof Error ? err.message : String(err),
        };
      }
    },

    async createRepository(args: CreateRepositoryArgs): Promise<VcsRepositoryCreated> {
      try {
        const existing = await client.request<GithubRepo>({
          method: "GET",
          path: repoPath(args.workspace, args.slug),
        });
        return toRepositoryCreated(args.workspace, existing.body, true);
      } catch (err) {
        if (!isNotFound(err)) throw err;
      }

      const created = await client.request<GithubRepo>({
        method: "POST",
        path: `/orgs/${encodeURIComponent(args.workspace)}/repos`,
        body: {
          name: args.slug,
          private: args.isPrivate,
          ...(args.description !== undefined ? { description: args.description } : {}),
        },
      });
      return toRepositoryCreated(args.workspace, created.body, false);
    },

    async discoverRepoCapabilities(workspace: string, repoSlug: string): Promise<VcsRepoProfile> {
      const repo = await client.request<GithubRepo>({
        method: "GET",
        path: repoPath(workspace, repoSlug),
      });
      let branchProtectionRules: readonly string[] = [];
      try {
        const protection = await client.request<GithubBranchProtection>({
          method: "GET",
          path: `${repoPath(workspace, repoSlug)}/branches/${encodeURIComponent(repo.body.default_branch)}/protection`,
        });
        branchProtectionRules = branchProtectionToRules(protection.body);
      } catch (err) {
        if (!isNotFound(err)) throw err;
      }
      return {
        provider: "github",
        workspace,
        repoSlug,
        defaultBranch: repo.body.default_branch,
        branchProtectionRules,
      };
    },

    async listBranches(args: ListBranchesArgs): Promise<readonly VcsBranch[]> {
      const branches = await client.request<readonly GithubBranch[]>({
        method: "GET",
        path: `${repoPath(args.workspace, args.repoSlug)}/branches`,
        query: { per_page: args.maxResults ?? 100 },
      });
      const mapped = branches.body.map((branch) => ({
        name: branch.name,
        targetCommitSha: branch.commit.sha,
        ...(branch.protected !== undefined ? { isProtected: branch.protected } : {}),
      }));
      const prefix = args.namePrefix;
      return prefix ? mapped.filter((branch) => branch.name.startsWith(prefix)) : mapped;
    },

    async createBranch(args: CreateBranchArgs): Promise<VcsBranch> {
      const fromRef = args.fromRef ?? "main";
      const source = await client.request<GithubRef>({
        method: "GET",
        path: `${repoPath(args.workspace, args.repoSlug)}/git/ref/heads/${encodeGitPath(fromRef)}`,
      });
      const created = await client.request<GithubRef>({
        method: "POST",
        path: `${repoPath(args.workspace, args.repoSlug)}/git/refs`,
        body: {
          ref: `refs/heads/${args.newBranchName}`,
          sha: source.body.object.sha,
        },
      });
      return { name: stripHeadsPrefix(created.body.ref), targetCommitSha: created.body.object.sha };
    },

    async getFile(args: GetFileArgs): Promise<VcsFileContent | undefined> {
      try {
        const file = await client.request<GithubContent | readonly GithubContent[]>({
          method: "GET",
          path: `${repoPath(args.workspace, args.repoSlug)}/contents/${encodeGitPath(args.path)}`,
          query: { ref: args.ref },
        });
        const body = file.body;
        if (isGithubContentArray(body) || body.type === "dir") return undefined;
        return {
          path: body.path,
          contents: Buffer.from(body.content.replace(/\s+/g, ""), "base64").toString("utf8"),
          commitSha: body.sha,
        };
      } catch (err) {
        if (isNotFound(err)) return undefined;
        throw err;
      }
    },

    async putFile(args: PutFileArgs): Promise<VcsCommit> {
      const existing = await this.getFile({
        workspace: args.workspace,
        repoSlug: args.repoSlug,
        path: args.path,
        ref: args.branch,
      });
      const response = await client.request<GithubPutFileResponse>({
        method: "PUT",
        path: `${repoPath(args.workspace, args.repoSlug)}/contents/${encodeGitPath(args.path)}`,
        body: {
          message: args.commitMessage,
          content: Buffer.from(args.contents, "utf8").toString("base64"),
          branch: args.branch,
          ...(existing ? { sha: existing.commitSha } : {}),
          ...(args.author ? { committer: { name: args.author.name, email: args.author.email } } : {}),
        },
      });
      return {
        sha: response.body.commit.sha,
        message: response.body.commit.message,
        ...(response.body.commit.author?.name !== undefined ? { authorName: response.body.commit.author.name } : {}),
        ...(response.body.commit.author?.date !== undefined ? { authoredAt: response.body.commit.author.date } : {}),
      };
    },

    async createPullRequest(args: CreatePullRequestArgs): Promise<VcsPullRequest> {
      const pr = await client.request<GithubPullRequest>({
        method: "POST",
        path: `${repoPath(args.workspace, args.repoSlug)}/pulls`,
        body: {
          title: args.title,
          head: args.sourceBranch,
          base: args.destinationBranch,
          ...(args.description !== undefined ? { body: args.description } : {}),
        },
      });
      return toPullRequest(pr.body);
    },

    async getPullRequest(args: GetPullRequestArgs): Promise<VcsPullRequest> {
      const pr = await client.request<GithubPullRequest>({
        method: "GET",
        path: `${repoPath(args.workspace, args.repoSlug)}/pulls/${args.pullRequestId}`,
      });
      return toPullRequest(pr.body);
    },

    async updatePullRequest(args: UpdatePullRequestArgs): Promise<VcsPullRequest> {
      const pr = await client.request<GithubPullRequest>({
        method: "PATCH",
        path: `${repoPath(args.workspace, args.repoSlug)}/pulls/${args.pullRequestId}`,
        body: {
          ...(args.title !== undefined ? { title: args.title } : {}),
          ...(args.description !== undefined ? { body: args.description } : {}),
        },
      });
      return toPullRequest(pr.body);
    },
  };
}

function repoPath(workspace: string, repoSlug: string): string {
  return `/repos/${encodeURIComponent(workspace)}/${encodeURIComponent(repoSlug)}`;
}

function encodeGitPath(path: string): string {
  return path
    .split("/")
    .filter((segment) => segment.length > 0)
    .map(encodeURIComponent)
    .join("/");
}

function stripHeadsPrefix(ref: string): string {
  return ref.startsWith("refs/heads/") ? ref.slice("refs/heads/".length) : ref;
}

function isNotFound(err: unknown): boolean {
  return err instanceof ProviderClientError && err.status === 404;
}

function toRepositoryCreated(workspace: string, repo: GithubRepo, alreadyExisted: boolean): VcsRepositoryCreated {
  return {
    workspace,
    slug: repo.name,
    url: repo.html_url,
    defaultBranch: repo.default_branch || "main",
    alreadyExisted,
  };
}

function branchProtectionToRules(protection: GithubBranchProtection): readonly string[] {
  const rules: string[] = [];
  for (const context of protection.required_status_checks?.contexts ?? []) {
    rules.push(`status:${context}`);
  }
  const reviewCount = protection.required_pull_request_reviews?.required_approving_review_count;
  if (reviewCount !== undefined) rules.push(`reviews:${reviewCount}`);
  return rules;
}

function toPullRequest(raw: GithubPullRequest): VcsPullRequest {
  return {
    id: raw.number,
    title: raw.title,
    ...(raw.body !== null && raw.body !== undefined ? { description: raw.body } : {}),
    state: githubState(raw),
    sourceBranch: raw.head.ref,
    destinationBranch: raw.base.ref,
    url: raw.html_url,
  };
}

function githubState(raw: GithubPullRequest): PullRequestState {
  if (raw.state === "open") return "OPEN";
  return raw.merged === true ? "MERGED" : "DECLINED";
}

function isGithubContentArray(value: GithubContent | readonly GithubContent[]): value is readonly GithubContent[] {
  return Array.isArray(value);
}

interface GithubRepo {
  readonly name: string;
  readonly full_name: string;
  readonly private: boolean;
  readonly html_url: string;
  readonly default_branch: string;
}

interface GithubBranchProtection {
  readonly required_status_checks?: { readonly contexts?: readonly string[] };
  readonly required_pull_request_reviews?: { readonly required_approving_review_count?: number };
}

interface GithubBranch {
  readonly name: string;
  readonly commit: { readonly sha: string };
  readonly protected?: boolean;
}

interface GithubRef {
  readonly ref: string;
  readonly object: { readonly sha: string };
}

interface GithubContent {
  readonly type?: "file" | "dir" | "symlink" | "submodule";
  readonly path: string;
  readonly content: string;
  readonly encoding: "base64";
  readonly sha: string;
}

interface GithubPutFileResponse {
  readonly commit: {
    readonly sha: string;
    readonly message: string;
    readonly author?: {
      readonly name?: string;
      readonly date?: string;
    };
  };
}

interface GithubPullRequest {
  readonly number: number;
  readonly title: string;
  readonly body?: string | null;
  readonly state: "open" | "closed";
  readonly merged?: boolean;
  readonly head: { readonly ref: string };
  readonly base: { readonly ref: string };
  readonly html_url: string;
}
