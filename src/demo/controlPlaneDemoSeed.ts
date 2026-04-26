import { randomUUID } from "node:crypto";
import { emptyBlueprint, type ProjectBlueprint } from "../domain/projectBlueprint.js";
import type { ProjectState } from "../domain/projectState.js";
import { defaultTenantScope } from "../domain/tenantScope.js";
import type { JiraProjectSummary, JiraProvider } from "../providers/atlassian/jiraProvider.js";
import type { Repositories } from "../storage/repositories/index.js";
import type { AuditSigner } from "../security/auditChain.js";
import { sha256Text } from "../security/auditChain.js";
import { appendOperatorAudit } from "../mcp/admin/auditedWrite.js";

export type DemoSeedMode = "auto" | "jira" | "sample";

export interface ControlPlaneDemoSeedInput {
  readonly mode?: DemoSeedMode;
  readonly maxProjects?: number;
  readonly operatorBadge?: string;
}

export interface ControlPlaneDemoSeedResult {
  readonly source: "jira" | "sample";
  readonly projectsCreated: number;
  readonly projectsUpdated: number;
  readonly jobsUpserted: number;
  readonly auditEntriesAppended: number;
  readonly projectKeys: readonly string[];
  readonly dataLimited?: { readonly reason: string };
}

export interface ControlPlaneDemoSeedDeps {
  readonly repositories: Repositories;
  readonly auditSigner: AuditSigner;
  readonly providers: {
    readonly jira: JiraProvider | undefined;
  };
}

interface SeedProject {
  readonly key: string;
  readonly name: string;
  readonly jiraId: string;
  readonly projectTypeKey: string;
  readonly leadDisplayName: string;
  readonly state: ProjectState;
  readonly focus: string;
  readonly repoSlug: string;
  readonly confluenceSpaceId: string;
}

const SAMPLE_PROJECTS: readonly SeedProject[] = [
  {
    key: "PCO",
    name: "Platform Control Orchestrator",
    jiraId: "10001",
    projectTypeKey: "software",
    leadDisplayName: "Avery Stone",
    state: "READY_FOR_BUILD",
    focus: "agent-ready Atlassian and VCS workspaces",
    repoSlug: "platform-control-orchestrator",
    confluenceSpaceId: "PCO",
  },
  {
    key: "CX",
    name: "Customer Experience Portal",
    jiraId: "10002",
    projectTypeKey: "software",
    leadDisplayName: "Mina Patel",
    state: "VALIDATED",
    focus: "self-service onboarding and account workflows",
    repoSlug: "customer-experience-portal",
    confluenceSpaceId: "CX",
  },
  {
    key: "DATA",
    name: "Data Governance Hub",
    jiraId: "10003",
    projectTypeKey: "business",
    leadDisplayName: "Theo Nguyen",
    state: "LINKED",
    focus: "lineage, stewardship, and retention controls",
    repoSlug: "data-governance-hub",
    confluenceSpaceId: "DATA",
  },
  {
    key: "OPS",
    name: "Support Operations Automation",
    jiraId: "10004",
    projectTypeKey: "service_desk",
    leadDisplayName: "Jordan Lee",
    state: "PROVISIONED",
    focus: "ticket triage, escalation, and knowledge routing",
    repoSlug: "support-operations-automation",
    confluenceSpaceId: "OPS",
  },
  {
    key: "BILL",
    name: "Billing Modernization",
    jiraId: "10005",
    projectTypeKey: "software",
    leadDisplayName: "Riley Brooks",
    state: "DRIFT_DETECTED",
    focus: "subscription lifecycle and invoice reliability",
    repoSlug: "billing-modernization",
    confluenceSpaceId: "BILL",
  },
];

const JIRA_PROJECT_STATES: readonly ProjectState[] = [
  "READY_FOR_BUILD",
  "VALIDATED",
  "LINKED",
  "PROVISIONED",
  "PREFLIGHT_PASSED",
] as const;

export async function seedControlPlaneDemo(
  deps: ControlPlaneDemoSeedDeps,
  input: ControlPlaneDemoSeedInput = {},
): Promise<ControlPlaneDemoSeedResult> {
  const scope = defaultTenantScope();
  const maxProjects = input.maxProjects ?? 6;
  const operatorBadge = input.operatorBadge ?? "demo-seed";
  const { projects, source, dataLimited } = await resolveSeedProjects(deps.providers.jira, input.mode ?? "auto", maxProjects);

  let projectsCreated = 0;
  let projectsUpdated = 0;
  let jobsUpserted = 0;
  let auditEntriesAppended = 0;
  const projectKeys: string[] = [];

  for (const seed of projects) {
    const existing = await findExistingProject(deps.repositories, seed.key);
    const now = new Date().toISOString();
    const blueprint = buildBlueprint(seed, {
      id: existing?.id ?? randomUUID(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      ...(existing?.blueprintVersion !== undefined ? { existingVersion: existing.blueprintVersion } : {}),
    });

    if (existing) {
      await deps.repositories.project.update(scope, blueprint);
      projectsUpdated += 1;
    } else {
      await deps.repositories.project.create(scope, blueprint);
      projectsCreated += 1;
    }

    for (const job of buildJobs(seed, blueprint.id)) {
      const current = await deps.repositories.provisionJob.get(scope, job.id);
      if (current) {
        await deps.repositories.provisionJob.update(scope, job.id, {
          status: job.status,
          result: job.result,
          ...(job.error ? { error: job.error } : {}),
        });
      } else {
        await deps.repositories.provisionJob.create(scope, {
          id: job.id,
          projectId: blueprint.id,
          status: job.status,
        });
        await deps.repositories.provisionJob.update(scope, job.id, {
          status: job.status,
          result: job.result,
          ...(job.error ? { error: job.error } : {}),
        });
      }
      jobsUpserted += 1;
    }

    const audits = await appendIntegrationAudits(deps, seed, blueprint.id, operatorBadge);
    auditEntriesAppended += audits;
    projectKeys.push(seed.key);
  }

  return {
    source,
    projectsCreated,
    projectsUpdated,
    jobsUpserted,
    auditEntriesAppended,
    projectKeys,
    ...(dataLimited ? { dataLimited } : {}),
  };
}

async function resolveSeedProjects(
  jira: JiraProvider | undefined,
  mode: DemoSeedMode,
  maxProjects: number,
): Promise<{
  readonly projects: readonly SeedProject[];
  readonly source: "jira" | "sample";
  readonly dataLimited?: { readonly reason: string };
}> {
  if (mode !== "sample" && jira) {
    try {
      const cloudProjects = await jira.listProjects({ maxResults: maxProjects });
      if (cloudProjects.length > 0) {
        return {
          source: "jira",
          projects: cloudProjects.slice(0, maxProjects).map((project, index) => fromJiraProject(project, index)),
        };
      }
      if (mode === "jira") return { source: "jira", projects: [] };
    } catch (err) {
      if (mode === "jira") throw err;
      const reason = err instanceof Error ? err.message : String(err);
      return {
        source: "sample",
        projects: SAMPLE_PROJECTS.slice(0, maxProjects),
        dataLimited: { reason: `Jira project listing failed; loaded sample integrated projects instead (${reason})` },
      };
    }
  }

  return {
    source: "sample",
    projects: SAMPLE_PROJECTS.slice(0, maxProjects),
    ...(mode !== "sample" && !jira
      ? { dataLimited: { reason: "Jira provider is not configured; loaded sample integrated projects instead" } }
      : {}),
  };
}

function fromJiraProject(project: JiraProjectSummary, index: number): SeedProject {
  const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || project.key.toLowerCase();
  return {
    key: project.key,
    name: project.name,
    jiraId: project.id,
    projectTypeKey: project.projectTypeKey ?? "software",
    leadDisplayName: project.leadDisplayName ?? "Jira project lead",
    state: JIRA_PROJECT_STATES[index % JIRA_PROJECT_STATES.length] ?? "PROVISIONED",
    focus: `${project.name} delivery work imported from Jira`,
    repoSlug: slug,
    confluenceSpaceId: project.key,
  };
}

async function findExistingProject(repositories: Repositories, key: string): Promise<ProjectBlueprint | undefined> {
  const scope = defaultTenantScope();
  const byKey = await repositories.project.findByKey(scope, key);
  if (byKey) return byKey;
  const all = await repositories.project.list(scope);
  return all.find((project) => project.atlassianProjectKey === key);
}

function buildBlueprint(
  seed: SeedProject,
  ids: { readonly id: string; readonly createdAt: string; readonly updatedAt: string; readonly existingVersion?: number },
): ProjectBlueprint {
  const blueprintVersion = Math.max(ids.existingVersion ?? 1, seed.state === "READY_FOR_BUILD" ? 9 : 6);
  const base = emptyBlueprint(
    { id: ids.id, tenantId: "default", key: seed.key, name: seed.name },
    ids.createdAt,
  );

  return {
    ...base,
    state: seed.state,
    blueprintVersion,
    goals: [
      `Integrate Jira project ${seed.key} into the atl-mcp lifecycle.`,
      `Prepare agent-ready handoff context for ${seed.focus}.`,
      "Keep Jira, Confluence, VCS, and audit references visible to operators.",
    ],
    nonGoals: [
      "Replacing Jira as the source of delivery status.",
      "Bulk migration of historical attachments in this seed dataset.",
    ],
    stakeholders: [
      { id: "STK-1", name: seed.leadDisplayName, role: "Jira project lead", interests: ["delivery status", "handoff readiness", "traceability"] },
      { id: "STK-2", name: "Platform Operations", role: "Operator", interests: ["audit evidence", "provider health", "safe provisioning"] },
    ],
    requirements: [
      requirement(seed, "REQ-1", "Jira project is adopted", "The existing Jira project appears as an atl-mcp project with the adopted badge."),
      requirement(seed, "REQ-2", "Lifecycle artifacts are linked", "The handoff packet includes Jira, Confluence, and repository references."),
      requirement(seed, "REQ-3", "Operator audit chain is populated", "Provisioning actions are visible in recent audit entries for the project."),
      requirement(seed, "REQ-4", "Agent handoff is build-ready", "The generated blueprint includes requirements, epics, risks, and release notes."),
    ],
    features: [
      { id: "FEAT-1", title: "Adopted project dashboard", description: `Surface ${seed.key} status, owner, and lifecycle state in the control plane.`, requirementIds: ["REQ-1"], priority: "must" },
      { id: "FEAT-2", title: "Provisioning artifact trail", description: "Show Jira issue tree, Confluence space, repo, and handoff bundle references.", requirementIds: ["REQ-2", "REQ-3"], priority: "must" },
      { id: "FEAT-3", title: "Agent-ready blueprint", description: "Carry enough context for a build agent to start without re-reading Jira manually.", requirementIds: ["REQ-4"], priority: "should" },
    ],
    epics: [
      epic(seed, "EPIC-1", "Adoption and linkage", ["REQ-1", "REQ-2"]),
      epic(seed, "EPIC-2", "Handoff readiness", ["REQ-3", "REQ-4"]),
    ],
    architecture: {
      summary: `${seed.name} is represented in atl-mcp as an adopted Jira project with linked Confluence and VCS artifacts.`,
      components: [
        { id: "COMP-1", name: "Jira project", responsibility: `Source project ${seed.key} (${seed.projectTypeKey})`, dependencies: [] },
        { id: "COMP-2", name: "Confluence space", responsibility: `Documentation workspace ${seed.confluenceSpaceId}`, dependencies: ["COMP-1"] },
        { id: "COMP-3", name: "Repository scaffold", responsibility: `Build workspace ${seed.repoSlug}`, dependencies: ["COMP-1"] },
      ],
      decisions: ["ADR-SEED-1"],
    },
    risks: [
      { id: "RISK-1", description: "Jira metadata can drift after the seed import.", severity: "medium", likelihood: "possible", mitigation: "Run provider preflight before provisioning changes." },
      { id: "RISK-2", description: "Repository or Confluence links may require provider credentials before live execution.", severity: "low", likelihood: "likely", mitigation: "Surface dataLimited markers and keep the handoff packet explicit." },
    ],
    openQuestions: [
      { id: "OQ-1", question: `Should ${seed.key} use the default Bitbucket workspace or a team-specific workspace?`, raisedBy: "demo-seed", raisedAt: ids.updatedAt },
    ],
    testingStrategy: {
      categories: [
        { category: "IT", applicable: true, toolingNotes: "Verify project list/detail, provision tab, audit entries, and job tables render populated data." },
        { category: "E2E", applicable: true, toolingNotes: "Run preview paths without network and live provider tests only when credentials are present." },
      ],
    },
    securityPrivacy: {
      classification: "PRIVATE",
      piiHandling: "Seed data uses project metadata and does not include customer records or credentials.",
      threatModelRefs: [`jira_project:${seed.key}`],
      owaspLlmCoverage: ["prompt-injection-boundary", "tool-output-validation", "auditability"],
    },
    releasePlan: {
      milestones: [
        { id: "M1", name: "Adopt Jira project" },
        { id: "M2", name: "Provision artifacts" },
        { id: "M3", name: "Ready for build" },
      ],
      rolloutStrategy: "Operator reviews seeded project state, then replaces sample links with live provider output as credentials are enabled.",
    },
    sourcePins: [
      {
        artifactRef: { kind: "jira_project", id: seed.key },
        version: seed.jiraId,
        contentChecksum: sha256Text(`${seed.key}:${seed.name}:${seed.focus}`),
        pinnedAt: ids.updatedAt,
      },
    ],
    atlassianProjectKey: seed.key,
    createdAt: ids.createdAt,
    updatedAt: ids.updatedAt,
  };
}

function requirement(seed: SeedProject, id: string, title: string, description: string): ProjectBlueprint["requirements"][number] {
  return {
    id,
    title,
    description,
    type: "functional",
    priority: "must",
    acceptanceSignals: [`${seed.key} detail view shows ${title.toLowerCase()}.`],
    sourceRefs: [{ kind: "jira_project", id: seed.key, excerpt: `${seed.name}: ${seed.focus}` }],
  };
}

function epic(seed: SeedProject, id: string, title: string, requirementIds: readonly string[]): ProjectBlueprint["epics"][number] {
  return {
    id,
    title,
    outcome: `${title} completed for ${seed.key}.`,
    confluenceRefs: [`confluence:${seed.confluenceSpaceId}`],
    dependencies: [],
    stories: requirementIds.map((requirementId, index) => ({
      id: `${id}-S${index + 1}`,
      title: `${title}: ${requirementId}`,
      userStory: `As an operator, I can inspect ${seed.key} ${requirementId} evidence from the control plane.`,
      acceptanceCriteria: [
        "Project detail renders the linked blueprint section.",
        "Recent audit or job rows support the displayed state.",
      ],
      implementationNotes: [`Use adopted Jira project key ${seed.key}.`],
      testNotes: ["Admin read tools return structuredContent consumed by the UI."],
      contextRefs: [`jira_project:${seed.key}`, `repo:${seed.repoSlug}`],
      dependencies: [],
      estimatedComplexity: index === 0 ? "M" : "S",
    })),
  };
}

interface SeedJob {
  readonly id: string;
  readonly status: "queued" | "running" | "completed" | "failed";
  readonly result: Readonly<Record<string, unknown>>;
  readonly error?: string;
}

function buildJobs(seed: SeedProject, projectId: string): readonly SeedJob[] {
  const base = `demo-${seed.key.toLowerCase()}`;
  const failed = seed.state === "DRIFT_DETECTED";
  return [
    {
      id: `${base}-jira`,
      status: "completed",
      result: { projectId, jiraProjectKey: seed.key, issuesCreated: 18, traceRows: 4, source: "seed" },
    },
    {
      id: `${base}-confluence`,
      status: "completed",
      result: { projectId, confluenceSpaceId: seed.confluenceSpaceId, pagesCreated: 7, contextPackUri: `mcp://context-packs/${seed.key}`, source: "seed" },
    },
    {
      id: `${base}-vcs`,
      status: failed ? "failed" : "completed",
      result: { projectId, repoUrl: `https://bitbucket.org/demo/${seed.repoSlug}`, filesSeeded: failed ? 0 : 10, readinessScore: failed ? 60 : 100, source: "seed" },
      ...(failed ? { error: "Repository default branch drift detected during validation" } : {}),
    },
  ];
}

async function appendIntegrationAudits(
  deps: ControlPlaneDemoSeedDeps,
  seed: SeedProject,
  projectId: string,
  operatorBadge: string,
): Promise<number> {
  const common = { projectKey: seed.key, operatorBadge, source: "control-plane-seed" };
  const entries = [
    { tool: "admin.projects.adopt", input: { ...common, atlassianProjectKey: seed.key }, outputArtifactIds: [`jira_project:${seed.key}`] },
    { tool: "admin.lifecycle.jira.execute", input: { ...common, jiraProjectKey: seed.key }, outputArtifactIds: [`jira:${seed.key}-EPIC-1`, `jira:${seed.key}-STORY-1`] },
    { tool: "admin.lifecycle.confluence.execute", input: { ...common, spaceId: seed.confluenceSpaceId }, outputArtifactIds: [`confluence:${seed.confluenceSpaceId}`] },
    { tool: "admin.lifecycle.vcs.execute", input: { ...common, repoSlug: seed.repoSlug }, outputArtifactIds: [`vcs:https://bitbucket.org/demo/${seed.repoSlug}`] },
    { tool: "admin.lifecycle.handoff.bundle", input: common, outputArtifactIds: [`handoff:${seed.key}`] },
  ] as const;

  for (const entry of entries) {
    await appendOperatorAudit(deps, {
      tool: entry.tool,
      input: entry.input,
      projectId,
      operatorBadge,
      outputArtifactIds: entry.outputArtifactIds,
    });
  }
  return entries.length;
}
