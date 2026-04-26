import { randomUUID } from "node:crypto";
import type { ArtifactRef } from "../../domain/artifactRef.js";
import type { TenantScope } from "../../domain/tenantScope.js";
import type { VcsProvider } from "../../providers/vcs/VcsProvider.js";
import type { TraceLinkRepository } from "../../storage/repositories/traceLinkRepository.js";

export interface VcsProvisionAction {
  readonly projectId: string;
  readonly blueprintRef: ArtifactRef;
  readonly workspace: string;
  readonly repoSlug: string;
  readonly branch: string;
  readonly baseBranch: string;
  readonly path: string;
  readonly contents: string;
  readonly actorFingerprint: string;
}

export function createVcsProvisionExecutor(deps: {
  readonly vcs: VcsProvider;
  readonly traceLink: TraceLinkRepository;
}) {
  return {
    async execute(scope: TenantScope, action: VcsProvisionAction): Promise<{ pullRequestId?: number; skipped?: boolean }> {
      if (action.branch === action.baseBranch) throw new Error("refusing to provision directly on default branch");
      const existing = await deps.traceLink.findBySource(scope, action.blueprintRef.kind, action.blueprintRef.id);
      if (existing.some((link) => link.projectId === action.projectId && link.target.kind === "vcs_pull_request")) {
        return { skipped: true };
      }
      await deps.vcs.createBranch({
        workspace: action.workspace,
        repoSlug: action.repoSlug,
        newBranchName: action.branch,
        fromRef: action.baseBranch,
      });
      const commit = await deps.vcs.putFile({
        workspace: action.workspace,
        repoSlug: action.repoSlug,
        branch: action.branch,
        path: action.path,
        contents: action.contents,
        commitMessage: commitMessage(action.actorFingerprint),
      });
      const pr = await deps.vcs.createPullRequest({
        workspace: action.workspace,
        repoSlug: action.repoSlug,
        title: `Provision context for ${action.projectId}`,
        description: `<!-- orchestrator-attribution: {"actorFingerprint":"${action.actorFingerprint}","commit":"${commit.sha}"} -->`,
        sourceBranch: action.branch,
        destinationBranch: action.baseBranch,
      });
      await deps.traceLink.create(scope, {
        id: randomUUID(),
        tenantId: scope.tenantId,
        projectId: action.projectId,
        source: action.blueprintRef,
        target: { kind: "vcs_pull_request", id: String(pr.id), ...(pr.url !== undefined ? { url: pr.url } : {}) },
        relation: "implements",
        createdAt: new Date().toISOString(),
        observedBy: "project_provision_execute",
      });
      return { pullRequestId: pr.id };
    },
  };
}

function commitMessage(actorFingerprint: string): string {
  return [
    "chore: provision orchestrator context",
    "",
    `Orchestrator-Actor-Fingerprint: ${actorFingerprint}`,
  ].join("\n");
}
