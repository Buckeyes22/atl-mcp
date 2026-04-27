// Round-trip test for the M6c VCS scaffold workflow. Uses a fake VcsProvider
// that records every createRepository + putFile call, asserts the workflow
// emits the expected file set and the expected number of commits.

import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createVcsRepoScaffoldWorkflow } from "../../../src/workflows/vcsRepoScaffoldWorkflow.js";
import { createVelocityContentRegistry } from "../../../src/velocity/contentRegistry.js";
import { emptyBlueprint } from "../../../src/domain/projectBlueprint.js";
import type {
  CreateRepositoryArgs,
  PutFileArgs,
  VcsCommit,
  VcsProvider,
  VcsRepositoryCreated,
} from "../../../src/providers/vcs/VcsProvider.js";

interface RecordedCalls {
  createRepository: CreateRepositoryArgs[];
  putFile: PutFileArgs[];
}

function fakeVcs(recorded: RecordedCalls, alreadyExisted = false): VcsProvider {
  return {
    name: "fake-vcs",
    kind: "vcs.bitbucket",
    async healthCheck() { return { reachable: true, checkedAt: new Date().toISOString() }; },
    async createRepository(args): Promise<VcsRepositoryCreated> {
      recorded.createRepository.push(args);
      return {
        workspace: args.workspace,
        slug: args.slug,
        url: `https://bitbucket.org/${args.workspace}/${args.slug}`,
        defaultBranch: "main",
        alreadyExisted,
      };
    },
    async discoverRepoCapabilities() { throw new Error("not used in scaffold test"); },
    async listBranches() { return []; },
    async createBranch() { throw new Error("not used"); },
    async getFile() { return undefined; },
    async putFile(args): Promise<VcsCommit> {
      recorded.putFile.push(args);
      return {
        sha: `sha-${recorded.putFile.length}`,
        message: args.commitMessage,
      };
    },
    async createPullRequest() { throw new Error("not used"); },
    async getPullRequest() { throw new Error("not used"); },
    async updatePullRequest() { throw new Error("not used"); },
  };
}

describe("vcsRepoScaffoldWorkflow.execute", () => {
  it("creates the repo once and seeds every scaffold file", async () => {
    const recorded: RecordedCalls = { createRepository: [], putFile: [] };
    const workflow = createVcsRepoScaffoldWorkflow({
      registry: createVelocityContentRegistry(),
      vcs: fakeVcs(recorded),
    });
    const now = new Date().toISOString();
    const blueprint = {
      ...emptyBlueprint({ id: randomUUID(), tenantId: "default", name: "Scaffold Test", key: "ST" }, now),
    };

    const result = await workflow.execute(blueprint, { workspace: "myws", repoSlug: "st" });

    expect(recorded.createRepository.length).toBe(1);
    expect(recorded.createRepository[0]).toMatchObject({ workspace: "myws", slug: "st", isPrivate: true });

    expect(recorded.putFile.length).toBe(result.filesSeeded);
    expect(result.filesSeeded).toBeGreaterThan(5);
    expect(result.repoUrl).toBe("https://bitbucket.org/myws/st");
    expect(result.defaultBranch).toBe("main");
    expect(result.alreadyExisted).toBe(false);
    expect(result.initialCommitId).toMatch(/^sha-\d+$/);

    // Every putFile uses the typed field names (contents, commitMessage),
    // and goes against the default branch returned by createRepository.
    for (const call of recorded.putFile) {
      expect(call.workspace).toBe("myws");
      expect(call.repoSlug).toBe("st");
      expect(call.branch).toBe("main");
      expect(typeof call.contents).toBe("string");
      expect(call.commitMessage).toMatch(/^seed:/);
    }

    // Spot-check that the canonical seed files are in the set.
    const paths = recorded.putFile.map((c) => c.path);
    for (const p of ["README.md", "CONTEXT.md", "AGENTS.md", "CLAUDE.md", ".gitignore"]) {
      expect(paths).toContain(p);
    }
  });

  it("does not seed files when the repo already exists", async () => {
    const recorded: RecordedCalls = { createRepository: [], putFile: [] };
    const workflow = createVcsRepoScaffoldWorkflow({
      registry: createVelocityContentRegistry(),
      vcs: fakeVcs(recorded, true),
    });
    const now = new Date().toISOString();
    const blueprint = emptyBlueprint({ id: randomUUID(), tenantId: "default", name: "Existing Repo", key: "ER" }, now);

    const result = await workflow.execute(blueprint, { workspace: "myws", repoSlug: "existing" });

    expect(recorded.createRepository.length).toBe(1);
    expect(recorded.putFile).toEqual([]);
    expect(result).toMatchObject({
      repoUrl: "https://bitbucket.org/myws/existing",
      defaultBranch: "main",
      filesSeeded: 0,
      alreadyExisted: true,
    });
    expect(result.initialCommitId).toBeUndefined();
  });
});
