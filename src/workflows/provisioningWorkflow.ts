import { randomUUID } from "node:crypto";
import type { ProjectBlueprint } from "../domain/projectBlueprint.js";
import type { TenantScope } from "../domain/tenantScope.js";
import type { DeploymentTier } from "../config.js";
import type { PolicyDecisionLayer } from "../security/policyDecisionLayer.js";
import type { ProjectRepository } from "../storage/repositories/projectRepository.js";
import { buildPlanActorAttribution } from "../planning/actorAttribution.js";
import type { ArtifactPlan, PlannedArtifactAction } from "../planning/artifactPlan.js";
import { runAdversarialTriplet } from "../review/adversarialTriplet.js";
import { createDisabledSamplingAdapter, type SamplingAdapter } from "../mcp/sampling.js";

export interface ProvisionPreviewInput {
  readonly projectId: string;
  readonly jiraProjectKey: string;
  readonly confluenceSpaceId?: string;
  readonly vcsWorkspace?: string;
  readonly vcsRepoSlug?: string;
  readonly vcsBaseBranch?: string;
  readonly actorPrincipalId: string;
}

export interface ProvisionPreviewResult {
  readonly plan: ArtifactPlan;
  readonly triplet: NonNullable<ArtifactPlan["triplet"]>;
}

export function createProvisioningWorkflow(deps: {
  readonly projectRepository: ProjectRepository;
  readonly policy: PolicyDecisionLayer;
  readonly sampling?: SamplingAdapter;
  readonly tier?: DeploymentTier;
  readonly now?: () => string;
}) {
  const now = deps.now ?? (() => new Date().toISOString());
  const sampling = deps.sampling ?? createDisabledSamplingAdapter("sampling not configured");
  const tier = deps.tier ?? "dev";
  return {
    async preview(scope: TenantScope, input: ProvisionPreviewInput): Promise<ProvisionPreviewResult> {
      const blueprint = await deps.projectRepository.findById(scope, input.projectId);
      if (!blueprint) throw new Error(`project not found: ${input.projectId}`);
      const actorAttribution = buildPlanActorAttribution({
        principalId: input.actorPrincipalId,
        blueprintVersion: blueprint.blueprintVersion,
        toolName: "project_provision_preview",
      });
      const actions = [
        ...await buildJiraActions(scope, deps.policy, blueprint, input.jiraProjectKey, actorAttribution.jiraLabel),
        ...await buildConfluenceActions(scope, deps.policy, blueprint, input.confluenceSpaceId ?? input.jiraProjectKey),
        ...await buildVcsActions(scope, deps.policy, blueprint, {
          workspace: input.vcsWorkspace ?? input.jiraProjectKey.toLowerCase(),
          repoSlug: input.vcsRepoSlug ?? blueprint.key.toLowerCase(),
          baseBranch: input.vcsBaseBranch ?? "main",
        }),
      ];
      const basePlan: ArtifactPlan = {
        id: randomUUID(),
        projectId: blueprint.id,
        blueprintVersion: blueprint.blueprintVersion,
        jiraProjectKey: input.jiraProjectKey,
        actorAttribution,
        actions,
        estimatedRequestCount: actions.filter((action) => action.action === "create" || action.action === "update").length,
      };
      const triplet = await runAdversarialTriplet(basePlan, { sampling, tier, now });
      return { plan: { ...basePlan, triplet }, triplet };
    },
  };
}

async function buildJiraActions(
  scope: TenantScope,
  policy: PolicyDecisionLayer,
  blueprint: ProjectBlueprint,
  jiraProjectKey: string,
  jiraLabel: string,
): Promise<readonly PlannedArtifactAction[]> {
  const stories = blueprint.epics.flatMap((epic) => epic.stories);
  return Promise.all(stories.map(async (story) => {
    const decision = await policy.decide(scope, {
      toolName: "project_provision_preview",
      projectId: blueprint.id,
      intent: "preview",
      attributes: { target: "jira_issue", storyId: story.id },
    });
    const description = [
      story.userStory,
      ...story.acceptanceCriteria.map((criterion) => `Acceptance: ${criterion}`),
    ];
    return {
      id: randomUUID(),
      action: decision.effect === "deny" ? "blocked" : "create",
      target: "jira_issue",
      blueprintRef: { kind: "blueprint_section", id: story.id },
      issueType: "Story",
      summary: story.title,
      description,
      labels: [jiraLabel, `orchestrator-blueprint-v${blueprint.blueprintVersion}`],
      idempotencyKey: `${blueprint.id}:${story.id}:jira`,
      policy: decision,
      ...(decision.effect === "deny" ? { blockedReason: decision.reasons.join("; ") } : {}),
    } satisfies PlannedArtifactAction;
  }));
}

async function buildConfluenceActions(
  scope: TenantScope,
  policy: PolicyDecisionLayer,
  blueprint: ProjectBlueprint,
  spaceId: string,
): Promise<readonly PlannedArtifactAction[]> {
  return Promise.all(blueprint.epics.map(async (epic) => {
    const decision = await policy.decide(scope, {
      toolName: "project_provision_preview",
      projectId: blueprint.id,
      intent: "preview",
      attributes: { target: "confluence_page", epicId: epic.id },
    });
    return {
      id: randomUUID(),
      action: decision.effect === "deny" ? "blocked" : "create",
      target: "confluence_page",
      blueprintRef: { kind: "blueprint_section", id: epic.id },
      spaceId,
      title: `${blueprint.name} - ${epic.title}`,
      bodyStorage: [
        `<h1>${escapeHtml(epic.title)}</h1>`,
        `<p>${escapeHtml(epic.outcome)}</p>`,
        "<ul>",
        ...epic.stories.map((story) => `<li>${escapeHtml(story.title)}</li>`),
        "</ul>",
      ].join(""),
      metadata: {
        projectId: blueprint.id,
        blueprintVersion: blueprint.blueprintVersion,
        epicId: epic.id,
      },
      idempotencyKey: `${blueprint.id}:${epic.id}:confluence`,
      policy: decision,
      ...(decision.effect === "deny" ? { blockedReason: decision.reasons.join("; ") } : {}),
    } satisfies PlannedArtifactAction;
  }));
}

async function buildVcsActions(
  scope: TenantScope,
  policy: PolicyDecisionLayer,
  blueprint: ProjectBlueprint,
  repo: { readonly workspace: string; readonly repoSlug: string; readonly baseBranch: string },
): Promise<readonly PlannedArtifactAction[]> {
  const branch = `orchestrator/${blueprint.id}-blueprint-v${blueprint.blueprintVersion}`;
  const fileDecision = await policy.decide(scope, {
    toolName: "project_provision_preview",
    projectId: blueprint.id,
    intent: "preview",
    attributes: { target: "vcs_file", path: "CONTEXT.md" },
  });
  const prDecision = await policy.decide(scope, {
    toolName: "project_provision_preview",
    projectId: blueprint.id,
    intent: "preview",
    attributes: { target: "vcs_pull_request", branch },
  });
  return [
    {
      id: randomUUID(),
      action: fileDecision.effect === "deny" ? "blocked" : "create",
      target: "vcs_file",
      blueprintRef: { kind: "blueprint_section", id: "CONTEXT" },
      workspace: repo.workspace,
      repoSlug: repo.repoSlug,
      branch,
      baseBranch: repo.baseBranch,
      path: "CONTEXT.md",
      contents: renderContextFile(blueprint),
      commitMessage: "chore: provision orchestrator context",
      idempotencyKey: `${blueprint.id}:context:vcs-file`,
      policy: fileDecision,
      ...(fileDecision.effect === "deny" ? { blockedReason: fileDecision.reasons.join("; ") } : {}),
    },
    {
      id: randomUUID(),
      action: prDecision.effect === "deny" ? "blocked" : "create",
      target: "vcs_pull_request",
      blueprintRef: { kind: "blueprint_section", id: "HANDOFF" },
      workspace: repo.workspace,
      repoSlug: repo.repoSlug,
      sourceBranch: branch,
      destinationBranch: repo.baseBranch,
      title: `Provision orchestrator context for ${blueprint.key}`,
      description: `Project ${blueprint.name} blueprint v${blueprint.blueprintVersion}.`,
      idempotencyKey: `${blueprint.id}:context:vcs-pr`,
      policy: prDecision,
      ...(prDecision.effect === "deny" ? { blockedReason: prDecision.reasons.join("; ") } : {}),
    },
  ];
}

function renderContextFile(blueprint: ProjectBlueprint): string {
  return [
    `# ${blueprint.name} Context`,
    "",
    `Project key: ${blueprint.key}`,
    `Blueprint version: ${blueprint.blueprintVersion}`,
    "",
    "## Goals",
    ...blueprint.goals.map((goal) => `- ${goal}`),
    "",
    "## Epics",
    ...blueprint.epics.map((epic) => `- ${epic.title}: ${epic.outcome}`),
    "",
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
