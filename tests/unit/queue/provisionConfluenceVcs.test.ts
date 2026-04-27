import { describe, expect, it } from "vitest";
import { createConfluenceProvisionExecutor } from "../../../src/queue/jobs/confluenceProvisionJob.js";
import { createVcsProvisionExecutor } from "../../../src/queue/jobs/vcsProvisionJob.js";
import { defaultTenantScope } from "../../../src/domain/tenantScope.js";
import { createInMemoryTraceLinkRepository } from "./traceLinkDouble.js";
import type { ConfluenceProvider } from "../../../src/providers/atlassian/confluenceProvider.js";
import type { VcsProvider } from "../../../src/providers/vcs/VcsProvider.js";

const scope = defaultTenantScope();

describe("M6b/M6c provisioning executors", () => {
  it("creates a Confluence page once and stores metadata as a content property", async () => {
    let creates = 0;
    let properties = 0;
    const confluence: ConfluenceProvider = {
      name: "fake-confluence",
      kind: "atlassian.confluence",
      async healthCheck() { return { reachable: true, checkedAt: "now" }; },
      async discoverSpaceCapabilities() { throw new Error("not used"); },
      async getPage(id) { return { id, spaceId: "S", title: "T", version: 1, body: undefined }; },
      async createPage(input) {
        creates += 1;
        return { id: `page-${creates}`, spaceId: input.spaceId, title: input.title, version: 1, body: input.body };
      },
      async updatePage() { throw new Error("not used"); },
      async getContentProperty() { return undefined; },
      async setContentProperty() { properties += 1; return { key: "orchestrator", value: {}, version: 1 }; },
    };
    const traceLink = createInMemoryTraceLinkRepository();
    const executor = createConfluenceProvisionExecutor({ confluence, traceLink });
    const action = {
      projectId: "proj",
      blueprintRef: { kind: "blueprint_section" as const, id: "EPIC-001" },
      spaceId: "S",
      title: "Overview",
      bodyStorage: "<p>Overview</p>",
      metadata: { blueprintVersion: 1 },
    };

    const first = await executor.execute(scope, action);
    const second = await executor.execute(scope, action);

    expect(first.createdPageId).toBe("page-1");
    expect(second.skipped).toBe(true);
    expect(creates).toBe(1);
    expect(properties).toBe(1);
  });

  it("creates a VCS branch, file, and PR once with actor trailers", async () => {
    let prs = 0;
    const vcs: VcsProvider = {
      name: "fake-vcs",
      kind: "vcs.bitbucket",
      async healthCheck() { return { reachable: true, checkedAt: "now" }; },
      async discoverRepoCapabilities() { throw new Error("not used"); },
      async listBranches() { return []; },
      async createBranch(args) { return { name: args.newBranchName, targetCommitSha: "base" }; },
      async getFile() { return undefined; },
      async putFile(args) { return { sha: "commit-1", message: args.commitMessage }; },
      async createPullRequest(args) { prs += 1; return { id: 1, title: args.title, description: args.description, state: "OPEN", sourceBranch: args.sourceBranch, destinationBranch: args.destinationBranch }; },
      async getPullRequest() { throw new Error("not used"); },
      async updatePullRequest() { throw new Error("not used"); },
    };
    const traceLink = createInMemoryTraceLinkRepository();
    const executor = createVcsProvisionExecutor({ vcs, traceLink });
    const action = {
      projectId: "proj",
      blueprintRef: { kind: "blueprint_section" as const, id: "HANDOFF" },
      workspace: "W",
      repoSlug: "R",
      branch: "orchestrator/proj",
      baseBranch: "main",
      path: "docs/context.md",
      contents: "context",
      actorFingerprint: "abc123",
    };

    const first = await executor.execute(scope, action);
    const second = await executor.execute(scope, action);

    expect(first.pullRequestId).toBe(1);
    expect(second.skipped).toBe(true);
    expect(prs).toBe(1);
  });
});
