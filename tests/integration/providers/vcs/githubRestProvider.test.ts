import { describe, expect, it } from "vitest";
import { pino } from "pino";
import { createRestClient, type FetchLike } from "../../../../src/providers/http/restClient.js";
import { createGithubRestProvider } from "../../../../src/providers/vcs/github/githubRestProvider.js";

const silentLogger = pino({ level: "silent" });

function makeFetch(): FetchLike {
  return async (url, init) => {
    const u = new URL(url);
    const path = u.pathname;
    const m = init.method;

    if (path === "/user" && m === "GET") {
      return jsonRes(200, { login: "octocat" });
    }
    if (path === "/repos/acme/widgets" && m === "GET") {
      return jsonRes(200, repo("widgets", "main"));
    }
    if (path === "/repos/acme/widgets/branches/main/protection" && m === "GET") {
      return jsonRes(200, {
        required_status_checks: { contexts: ["ci/test"] },
        required_pull_request_reviews: { required_approving_review_count: 1 },
      });
    }
    if (path === "/repos/acme/widgets/branches" && m === "GET") {
      return jsonRes(200, [
        { name: "main", commit: { sha: "base-sha" }, protected: true },
        { name: "feature/x", commit: { sha: "feature-sha" }, protected: false },
      ]);
    }
    if (path === "/repos/acme/widgets/git/ref/heads/main" && m === "GET") {
      return jsonRes(200, { ref: "refs/heads/main", object: { sha: "base-sha" } });
    }
    if (path === "/repos/acme/widgets/git/refs" && m === "POST") {
      const body = init.body ? JSON.parse(init.body) : {};
      return jsonRes(201, { ref: body.ref, object: { sha: body.sha } });
    }
    if (path === "/repos/acme/widgets/contents/README.md" && m === "GET") {
      return jsonRes(200, {
        path: "README.md",
        content: Buffer.from("hello github", "utf8").toString("base64"),
        encoding: "base64",
        sha: "file-sha",
      });
    }
    if (path === "/repos/acme/widgets/contents/docs/context.md" && m === "GET") {
      return jsonRes(404, { message: "Not Found" });
    }
    if (path === "/repos/acme/widgets/contents/docs/context.md" && m === "PUT") {
      const body = init.body ? JSON.parse(init.body) : {};
      return jsonRes(200, {
        commit: {
          sha: "commit-sha",
          message: body.message,
          author: { name: "Orchestrator", date: "2026-04-26T00:00:00Z" },
        },
      });
    }
    if (path === "/repos/acme/widgets/pulls" && m === "POST") {
      const body = init.body ? JSON.parse(init.body) : {};
      return jsonRes(201, pull(7, body.title, body.body, body.head, body.base));
    }
    if (path === "/repos/acme/widgets/pulls/7" && m === "GET") {
      return jsonRes(200, pull(7, "Existing PR", "body", "feature/x", "main"));
    }
    if (path === "/repos/acme/widgets/pulls/7" && m === "PATCH") {
      const body = init.body ? JSON.parse(init.body) : {};
      return jsonRes(200, pull(7, body.title ?? "Existing PR", body.body ?? "body", "feature/x", "main"));
    }
    if (path === "/repos/acme/newrepo" && m === "GET") {
      return jsonRes(404, { message: "Not Found" });
    }
    if (path === "/orgs/acme/repos" && m === "POST") {
      const body = init.body ? JSON.parse(init.body) : {};
      return jsonRes(201, repo(body.name, "main"));
    }
    return jsonRes(404, { error: `unexpected ${m} ${path}` });
  };
}

function jsonRes(status: number, body: unknown): ReturnType<FetchLike> {
  return Promise.resolve({
    statusCode: status,
    headers: { "content-type": "application/json" },
    body: { text: async () => JSON.stringify(body), json: async () => body },
  });
}

function repo(name: string, defaultBranch: string) {
  return {
    name,
    full_name: `acme/${name}`,
    private: true,
    html_url: `https://github.com/acme/${name}`,
    default_branch: defaultBranch,
  };
}

function pull(id: number, title: string, body: string, head: string, base: string) {
  return {
    number: id,
    title,
    body,
    state: "open",
    head: { ref: head },
    base: { ref: base },
    html_url: `https://github.com/acme/widgets/pull/${id}`,
  };
}

function makeProvider(fetchImpl: FetchLike) {
  const restClient = createRestClient({
    baseUrl: "https://api.github.com",
    userAgent: "test",
    getAuthHeader: async () => "Bearer ghp_test",
    logger: silentLogger,
    fetchOverride: fetchImpl,
  });
  return createGithubRestProvider({
    token: "ghp_test",
    logger: silentLogger,
    restClient,
  });
}

describe("githubRestProvider", () => {
  it("implements repository discovery, branches, files, PRs, and repo creation", async () => {
    const provider = makeProvider(makeFetch());

    await expect(provider.healthCheck()).resolves.toMatchObject({ reachable: true });
    await expect(provider.discoverRepoCapabilities("acme", "widgets")).resolves.toMatchObject({
      provider: "github",
      workspace: "acme",
      repoSlug: "widgets",
      defaultBranch: "main",
      branchProtectionRules: ["status:ci/test", "reviews:1"],
    });
    await expect(provider.listBranches({ workspace: "acme", repoSlug: "widgets" })).resolves.toHaveLength(2);
    await expect(provider.createBranch({
      workspace: "acme",
      repoSlug: "widgets",
      newBranchName: "feature/y",
      fromRef: "main",
    })).resolves.toEqual({ name: "feature/y", targetCommitSha: "base-sha" });
    await expect(provider.getFile({
      workspace: "acme",
      repoSlug: "widgets",
      path: "README.md",
      ref: "main",
    })).resolves.toMatchObject({ contents: "hello github", commitSha: "file-sha" });
    await expect(provider.putFile({
      workspace: "acme",
      repoSlug: "widgets",
      branch: "feature/y",
      path: "docs/context.md",
      contents: "context",
      commitMessage: "chore: context",
    })).resolves.toMatchObject({ sha: "commit-sha", message: "chore: context" });
    await expect(provider.createPullRequest({
      workspace: "acme",
      repoSlug: "widgets",
      title: "Context",
      description: "body",
      sourceBranch: "feature/y",
      destinationBranch: "main",
    })).resolves.toMatchObject({ id: 7, state: "OPEN", sourceBranch: "feature/y" });
    await expect(provider.getPullRequest({
      workspace: "acme",
      repoSlug: "widgets",
      pullRequestId: 7,
    })).resolves.toMatchObject({ id: 7, title: "Existing PR" });
    await expect(provider.updatePullRequest({
      workspace: "acme",
      repoSlug: "widgets",
      pullRequestId: 7,
      title: "Updated",
    })).resolves.toMatchObject({ id: 7, title: "Updated" });
    await expect(provider.createRepository({
      workspace: "acme",
      slug: "newrepo",
      isPrivate: true,
    })).resolves.toMatchObject({
      workspace: "acme",
      slug: "newrepo",
      alreadyExisted: false,
      url: "https://github.com/acme/newrepo",
    });
  });
});
