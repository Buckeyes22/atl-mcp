// Recorded-fixture tests for the Bitbucket Cloud REST provider.

import { describe, expect, it } from "vitest";
import { pino } from "pino";
import { createBitbucketRestProvider } from "../../../../src/providers/vcs/bitbucket/bitbucketRestProvider.js";
import { createBitbucketAppPasswordAuth } from "../../../../src/providers/vcs/bitbucket/auth/appPassword.js";
import { createRestClient, type FetchLike } from "../../../../src/providers/http/restClient.js";

const silentLogger = pino({ level: "silent" });

function makeFetch(): FetchLike {
  return async (url, init) => {
    const u = new URL(url);
    const path = u.pathname;
    const m = init.method;

    if (path === "/2.0/user" && m === "GET") {
      return jsonRes(200, { uuid: "{abc}", display_name: "Test User" });
    }
    if (path === "/2.0/repositories/myws/myrepo" && m === "GET") {
      return jsonRes(200, {
        uuid: "{repo-uuid}",
        slug: "myrepo",
        name: "My Repo",
        mainbranch: { name: "main", type: "branch" },
        is_private: true,
        links: { html: { href: "https://bitbucket.org/myws/myrepo" } },
      });
    }
    if (path === "/2.0/repositories/myws/newrepo" && m === "POST") {
      const body = init.body ? JSON.parse(init.body) : {};
      return jsonRes(201, {
        uuid: "{newrepo-uuid}",
        slug: "newrepo",
        name: "newrepo",
        // mainbranch is null until first push — Bitbucket behavior.
        is_private: body.is_private,
        links: { html: { href: "https://bitbucket.org/myws/newrepo" } },
      });
    }
    if (path === "/2.0/repositories/myws/existsrepo" && m === "POST") {
      return jsonRes(400, { type: "error", error: { message: "Repository already exists." } });
    }
    if (path === "/2.0/repositories/myws/existsrepo" && m === "GET") {
      return jsonRes(200, {
        uuid: "{existsrepo-uuid}",
        slug: "existsrepo",
        name: "existsrepo",
        mainbranch: { name: "main", type: "branch" },
        is_private: true,
        links: { html: { href: "https://bitbucket.org/myws/existsrepo" } },
      });
    }
    if (path === "/2.0/repositories/myws/myrepo/branch-restrictions" && m === "GET") {
      return jsonRes(200, {
        values: [
          { kind: "push", pattern: "main" },
          { kind: "force", pattern: "main" },
        ],
      });
    }
    if (path === "/2.0/repositories/myws/myrepo/refs/branches" && m === "GET") {
      return jsonRes(200, {
        values: [
          { name: "main", target: { hash: "abcdef0123456789" } },
          { name: "feature/x", target: { hash: "1111111111111111" } },
        ],
      });
    }
    if (path === "/2.0/repositories/myws/myrepo/refs/branches" && m === "POST") {
      const body = init.body ? JSON.parse(init.body) : {};
      return jsonRes(201, { name: body.name, target: { hash: "newcommit0000" } });
    }
    if (path.startsWith("/2.0/repositories/myws/myrepo/src/main/") && m === "GET") {
      return Promise.resolve({
        statusCode: 200,
        headers: { "content-type": "text/plain", etag: "abcdef0" },
        body: { text: async () => "file contents go here", json: async () => "file contents go here" },
      });
    }
    if (path === "/2.0/repositories/myws/myrepo/pullrequests" && m === "POST") {
      const body = init.body ? JSON.parse(init.body) : {};
      return jsonRes(201, {
        id: 42,
        title: body.title,
        description: body.description ?? "",
        state: "OPEN",
        source: { branch: { name: body.source.branch.name } },
        destination: { branch: { name: body.destination.branch.name } },
        links: { html: { href: "https://bitbucket.org/myws/myrepo/pull-requests/42" } },
      });
    }
    if (path === "/2.0/repositories/myws/myrepo/pullrequests/42" && m === "GET") {
      return jsonRes(200, {
        id: 42,
        title: "PR #42",
        description: "desc",
        state: "OPEN",
        source: { branch: { name: "feature/x" } },
        destination: { branch: { name: "main" } },
        links: { html: { href: "https://bitbucket.org/myws/myrepo/pull-requests/42" } },
      });
    }
    if (path === "/2.0/repositories/myws/myrepo/pullrequests/42" && m === "PUT") {
      const body = init.body ? JSON.parse(init.body) : {};
      return jsonRes(200, {
        id: 42,
        title: body.title ?? "PR #42",
        description: body.description ?? "desc",
        state: "OPEN",
        source: { branch: { name: "feature/x" } },
        destination: { branch: { name: "main" } },
        links: { html: { href: "https://bitbucket.org/myws/myrepo/pull-requests/42" } },
      });
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

function makeProvider(fetchImpl: FetchLike) {
  const auth = createBitbucketAppPasswordAuth({ username: "chris", appPassword: "tok" });
  const restClient = createRestClient({
    baseUrl: "https://api.bitbucket.org/2.0",
    userAgent: "test",
    getAuthHeader: () => auth.getAuthHeader(),
    logger: silentLogger,
    fetchOverride: fetchImpl,
  });
  return createBitbucketRestProvider({
    auth,
    logger: silentLogger,
    baseUrl: "https://api.bitbucket.org/2.0",
    restClient,
  });
}

describe("bitbucketRestProvider", () => {
  it("healthCheck returns reachable on 200", async () => {
    const provider = makeProvider(makeFetch());
    const h = await provider.healthCheck();
    if (!h.reachable) throw new Error(`unexpected unreachable: ${h.details}`);
    expect(h.reachable).toBe(true);
  });

  it("discoverRepoCapabilities returns repo + branch protection", async () => {
    const provider = makeProvider(makeFetch());
    const profile = await provider.discoverRepoCapabilities("myws", "myrepo");
    expect(profile.provider).toBe("bitbucket_cloud");
    expect(profile.workspace).toBe("myws");
    expect(profile.repoSlug).toBe("myrepo");
    expect(profile.defaultBranch).toBe("main");
    expect(profile.branchProtectionRules).toEqual(["push:main", "force:main"]);
  });

  it("listBranches returns the wire shape mapped", async () => {
    const provider = makeProvider(makeFetch());
    const branches = await provider.listBranches({ workspace: "myws", repoSlug: "myrepo" });
    expect(branches.length).toBe(2);
    expect(branches[0]?.name).toBe("main");
    expect(branches[0]?.targetCommitSha).toBe("abcdef0123456789");
  });

  it("createBranch posts the wire body shape", async () => {
    const provider = makeProvider(makeFetch());
    const b = await provider.createBranch({
      workspace: "myws",
      repoSlug: "myrepo",
      newBranchName: "feature/y",
      fromRef: "main",
    });
    expect(b.name).toBe("feature/y");
    expect(b.targetCommitSha).toBe("newcommit0000");
  });

  it("getFile returns contents at a ref", async () => {
    const provider = makeProvider(makeFetch());
    const f = await provider.getFile({ workspace: "myws", repoSlug: "myrepo", path: "README.md", ref: "main" });
    expect(f).toBeDefined();
    expect(f?.contents).toBe("file contents go here");
  });

  it("createPullRequest returns a normalized VcsPullRequest", async () => {
    const provider = makeProvider(makeFetch());
    const pr = await provider.createPullRequest({
      workspace: "myws",
      repoSlug: "myrepo",
      title: "Smoke",
      sourceBranch: "feature/x",
      destinationBranch: "main",
    });
    expect(pr.id).toBe(42);
    expect(pr.state).toBe("OPEN");
    expect(pr.url).toBe("https://bitbucket.org/myws/myrepo/pull-requests/42");
  });

  it("createRepository posts the wire body and returns a normalized result", async () => {
    const provider = makeProvider(makeFetch());
    const r = await provider.createRepository({ workspace: "myws", slug: "newrepo", isPrivate: true });
    expect(r.workspace).toBe("myws");
    expect(r.slug).toBe("newrepo");
    expect(r.alreadyExisted).toBe(false);
    expect(r.url).toBe("https://bitbucket.org/myws/newrepo");
    // mainbranch null on the wire → fall back to "main" so the first putFile creates it.
    expect(r.defaultBranch).toBe("main");
  });

  it("createRepository against existing slug returns alreadyExisted=true", async () => {
    const provider = makeProvider(makeFetch());
    const r = await provider.createRepository({ workspace: "myws", slug: "existsrepo", isPrivate: true });
    expect(r.alreadyExisted).toBe(true);
    expect(r.defaultBranch).toBe("main");
    expect(r.url).toBe("https://bitbucket.org/myws/existsrepo");
  });

  it("getPullRequest + updatePullRequest round-trip", async () => {
    const provider = makeProvider(makeFetch());
    const pr = await provider.getPullRequest({ workspace: "myws", repoSlug: "myrepo", pullRequestId: 42 });
    expect(pr.title).toBe("PR #42");
    const updated = await provider.updatePullRequest({
      workspace: "myws",
      repoSlug: "myrepo",
      pullRequestId: 42,
      title: "PR #42 (updated)",
    });
    expect(updated.title).toBe("PR #42 (updated)");
  });
});
