// bitbucketRestProvider — Bitbucket Cloud REST 2.0 implementation of VcsProvider.
//
// API base: https://api.bitbucket.org/2.0
// Endpoints used:
//   GET  /repositories/{workspace}/{repo}                          — repo metadata
//   GET  /repositories/{workspace}/{repo}/branch-restrictions      — branch protection rules
//   GET  /repositories/{workspace}/{repo}/refs/branches            — list branches (paginated)
//   POST /repositories/{workspace}/{repo}/refs/branches            — create branch
//   GET  /repositories/{workspace}/{repo}/src/{ref}/{path}         — read file
//   POST /repositories/{workspace}/{repo}/src                      — multipart commit (write file)
//   GET  /repositories/{workspace}/{repo}/pullrequests/{id}        — get PR
//   POST /repositories/{workspace}/{repo}/pullrequests             — create PR
//   PUT  /repositories/{workspace}/{repo}/pullrequests/{id}        — update PR
//
// Bitbucket's "src" endpoint accepts multipart form data for file writes — a
// quirk vs Jira/Confluence which take JSON bodies. We handle this in putFile.

import type { Logger } from "pino";
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
import type { VcsRepoProfile } from "../../../domain/projectProfile.js";
import type { ProviderHealth } from "../../Provider.js";
import type { BitbucketAuth } from "./auth/appPassword.js";
import { createRestClient, type RestClient, type RestClientConfig } from "../../http/restClient.js";

const BITBUCKET_API_BASE = "https://api.bitbucket.org/2.0";

export interface BitbucketRestProviderConfig {
  readonly auth: BitbucketAuth;
  readonly logger: Logger;
  readonly userAgent?: string;
  readonly baseUrl?: string;
  readonly restClient?: RestClient;
}

export function createBitbucketRestProvider(config: BitbucketRestProviderConfig): VcsProvider {
  const baseUrl = config.baseUrl ?? BITBUCKET_API_BASE;
  const client =
    config.restClient ??
    createRestClient({
      baseUrl,
      userAgent: config.userAgent ?? "atl-mcp-orchestrator/0.1.0",
      getAuthHeader: () => config.auth.getAuthHeader(),
      logger: config.logger,
    } satisfies RestClientConfig);

  function repoPath(workspace: string, repoSlug: string): string {
    return `/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repoSlug)}`;
  }

  return {
    name: "bitbucket-rest",
    kind: "vcs.bitbucket",

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
      const path = repoPath(args.workspace, args.slug);
      try {
        const res = await client.request<BitbucketRepoResponse>({
          method: "POST",
          path,
          body: {
            scm: "git",
            is_private: args.isPrivate,
            ...(args.description !== undefined ? { description: args.description } : {}),
          },
        });
        return {
          workspace: args.workspace,
          slug: args.slug,
          url: res.body.links?.html?.href ?? `https://bitbucket.org/${args.workspace}/${args.slug}`,
          defaultBranch: res.body.mainbranch?.name ?? "main",
          alreadyExisted: false,
        };
      } catch (err) {
        // Bitbucket returns 400 when the repo already exists. Map to an
        // idempotent return so re-running M6c against an existing repo is
        // a no-op rather than a hard failure.
        const message = err instanceof Error ? err.message : String(err);
        if (/already exists|409|400/i.test(message)) {
          const existing = await client.request<BitbucketRepoResponse>({ method: "GET", path });
          return {
            workspace: args.workspace,
            slug: args.slug,
            url: existing.body.links?.html?.href ?? `https://bitbucket.org/${args.workspace}/${args.slug}`,
            defaultBranch: existing.body.mainbranch?.name ?? "main",
            alreadyExisted: true,
          };
        }
        throw err;
      }
    },

    async discoverRepoCapabilities(workspace: string, repoSlug: string): Promise<VcsRepoProfile> {
      const repo = await client.request<BitbucketRepoResponse>({
        method: "GET",
        path: repoPath(workspace, repoSlug),
      });
      let branchProtectionRules: string[] = [];
      try {
        const restrictions = await client.request<BitbucketBranchRestrictionPage>({
          method: "GET",
          path: `${repoPath(workspace, repoSlug)}/branch-restrictions`,
          query: { pagelen: 50 },
        });
        branchProtectionRules = restrictions.body.values.map((r) => `${r.kind}:${r.pattern}`);
      } catch {
        // 403/404 is normal if the user has no admin permission; leave empty.
      }
      return {
        provider: "bitbucket_cloud",
        workspace,
        repoSlug,
        defaultBranch: repo.body.mainbranch?.name ?? "main",
        branchProtectionRules,
      };
    },

    async listBranches(args: ListBranchesArgs): Promise<readonly VcsBranch[]> {
      const query: Record<string, string | number> = { pagelen: args.maxResults ?? 50 };
      if (args.namePrefix) query["q"] = `name ~ "${args.namePrefix}"`;
      const res = await client.request<BitbucketBranchPage>({
        method: "GET",
        path: `${repoPath(args.workspace, args.repoSlug)}/refs/branches`,
        query,
      });
      return res.body.values.map((b) => ({
        name: b.name,
        targetCommitSha: b.target.hash,
      }));
    },

    async createBranch(args: CreateBranchArgs): Promise<VcsBranch> {
      const res = await client.request<BitbucketBranch>({
        method: "POST",
        path: `${repoPath(args.workspace, args.repoSlug)}/refs/branches`,
        body: {
          name: args.newBranchName,
          target: { hash: args.fromRef ?? "HEAD" },
        },
      });
      return { name: res.body.name, targetCommitSha: res.body.target.hash };
    },

    async getFile(args: GetFileArgs): Promise<VcsFileContent | undefined> {
      try {
        const res = await client.request<string>({
          method: "GET",
          path: `${repoPath(args.workspace, args.repoSlug)}/src/${encodeURIComponent(args.ref)}/${encodeBitbucketPath(args.path)}`,
          headers: { accept: "application/octet-stream, text/plain, */*" },
        });
        const contents = typeof res.body === "string" ? res.body : JSON.stringify(res.body);
        return {
          path: args.path,
          contents,
          commitSha: res.headers["etag"] ?? args.ref,
        };
      } catch (err) {
        if (err instanceof Error && err.message.includes("→ 404")) return undefined;
        throw err;
      }
    },

    async putFile(args: PutFileArgs): Promise<VcsCommit> {
      // Bitbucket's POST /src accepts multipart/form-data with one form field
      // per file path. Our REST client posts JSON only, so we build a
      // multipart body manually and skip the JSON content-type.
      const boundary = `----orchestrator-${Date.now().toString(36)}`;
      const parts: string[] = [];
      const push = (name: string, value: string): void => {
        parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);
      };
      push("branch", args.branch);
      push("message", args.commitMessage);
      if (args.author) push("author", `${args.author.name} <${args.author.email}>`);
      // The path itself is the field name; value is the file contents.
      parts.push(
        `--${boundary}\r\nContent-Disposition: form-data; name="${args.path}"; filename="${args.path}"\r\n` +
          `Content-Type: text/plain; charset=utf-8\r\n\r\n${args.contents}\r\n`,
      );
      parts.push(`--${boundary}--\r\n`);
      const body = parts.join("");

      // RestClient JSON-stringifies bodies; for multipart we have to bypass
      // by sending the body pre-serialized via a string body + override the
      // content-type header. Our client hardcodes JSON; rather than rebuild
      // it, we use undici directly via a one-off fetch-like wrapper below.
      const res = await postMultipart({
        baseUrl,
        path: `${repoPath(args.workspace, args.repoSlug)}/src`,
        authHeader: await config.auth.getAuthHeader(),
        userAgent: config.userAgent ?? "atl-mcp-orchestrator/0.1.0",
        boundary,
        body,
      });

      // Bitbucket's POST /src returns 201 with no body but a Location header
      // pointing to the new commit. Extract the sha.
      const location = res.headers["location"] ?? "";
      const sha = location.split("/").pop() ?? "";
      return { sha, message: args.commitMessage };
    },

    async createPullRequest(args: CreatePullRequestArgs): Promise<VcsPullRequest> {
      const body: Record<string, unknown> = {
        title: args.title,
        source: { branch: { name: args.sourceBranch } },
        destination: { branch: { name: args.destinationBranch } },
        ...(args.description !== undefined ? { description: args.description } : {}),
        ...(args.closeSourceBranch !== undefined ? { close_source_branch: args.closeSourceBranch } : {}),
      };
      const res = await client.request<BitbucketPullRequest>({
        method: "POST",
        path: `${repoPath(args.workspace, args.repoSlug)}/pullrequests`,
        body,
      });
      return toPullRequest(res.body);
    },

    async getPullRequest(args: GetPullRequestArgs): Promise<VcsPullRequest> {
      const res = await client.request<BitbucketPullRequest>({
        method: "GET",
        path: `${repoPath(args.workspace, args.repoSlug)}/pullrequests/${args.pullRequestId}`,
      });
      return toPullRequest(res.body);
    },

    async updatePullRequest(args: UpdatePullRequestArgs): Promise<VcsPullRequest> {
      const body: Record<string, unknown> = {
        ...(args.title !== undefined ? { title: args.title } : {}),
        ...(args.description !== undefined ? { description: args.description } : {}),
      };
      const res = await client.request<BitbucketPullRequest>({
        method: "PUT",
        path: `${repoPath(args.workspace, args.repoSlug)}/pullrequests/${args.pullRequestId}`,
        body,
      });
      return toPullRequest(res.body);
    },
  };
}

function toPullRequest(raw: BitbucketPullRequest): VcsPullRequest {
  return {
    id: raw.id,
    title: raw.title,
    ...(raw.description !== undefined ? { description: raw.description } : {}),
    state: raw.state.toUpperCase() as PullRequestState,
    sourceBranch: raw.source.branch.name,
    destinationBranch: raw.destination.branch.name,
    ...(raw.links?.html?.href !== undefined ? { url: raw.links.html.href } : {}),
  };
}

/**
 * Bitbucket's `src/{ref}/{path}` endpoint expects the path to use forward
 * slashes per segment (no encoding of slash) but each segment encoded.
 */
function encodeBitbucketPath(path: string): string {
  return path
    .split("/")
    .filter((s) => s.length > 0)
    .map(encodeURIComponent)
    .join("/");
}

/**
 * One-off multipart POST. Used only for Bitbucket's /src file write endpoint.
 * Our regular REST client doesn't do multipart; rather than complicate it
 * with a multipart code path used by exactly one provider's one endpoint,
 * we keep this isolated.
 */
async function postMultipart(args: {
  baseUrl: string;
  path: string;
  authHeader: string;
  userAgent: string;
  boundary: string;
  body: string;
}): Promise<{ statusCode: number; headers: Record<string, string> }> {
  const { request } = await import("undici");
  const url = (args.baseUrl.endsWith("/") ? args.baseUrl.slice(0, -1) : args.baseUrl) + args.path;
  const res = await request(url, {
    method: "POST",
    headers: {
      authorization: args.authHeader,
      "user-agent": args.userAgent,
      "content-type": `multipart/form-data; boundary=${args.boundary}`,
      accept: "application/json",
    },
    body: args.body,
  });
  // Drain body to release connection.
  await res.body.text().catch(() => undefined);
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(res.headers)) {
    if (v === undefined) continue;
    headers[k.toLowerCase()] = Array.isArray(v) ? (v[0] ?? "") : String(v);
  }
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`bitbucket multipart POST failed: ${res.statusCode}`);
  }
  return { statusCode: res.statusCode, headers };
}

// ----- Wire types (subset) -----

interface BitbucketRepoResponse {
  readonly uuid: string;
  readonly slug: string;
  readonly name: string;
  readonly mainbranch?: { name: string; type: string };
  readonly is_private?: boolean;
  readonly links?: {
    readonly html?: { href: string };
    readonly self?: { href: string };
  };
}

interface BitbucketBranch {
  readonly name: string;
  readonly target: { hash: string };
}

interface BitbucketBranchPage {
  readonly values: readonly BitbucketBranch[];
  readonly next?: string;
  readonly page?: number;
  readonly pagelen?: number;
}

interface BitbucketBranchRestrictionPage {
  readonly values: ReadonlyArray<{ kind: string; pattern: string }>;
}

interface BitbucketPullRequest {
  readonly id: number;
  readonly title: string;
  readonly description?: string;
  readonly state: string;
  readonly source: { branch: { name: string } };
  readonly destination: { branch: { name: string } };
  readonly links?: { html?: { href: string } };
}
