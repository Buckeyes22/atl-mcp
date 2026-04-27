// admin.projects.list / admin.projects.get — operator project list + detail.
// Reads from projectRepository and joins with audit + jobs for the detail view.

import { z } from "zod";
import type { AuditEntry } from "../../../domain/auditEntry.js";
import type { ProjectBlueprint } from "../../../domain/projectBlueprint.js";
import { defaultTenantScope } from "../../../domain/tenantScope.js";
import { PROJECT_STATES } from "../../../domain/projectState.js";
import { readOptionalString } from "../../../config/env.js";
import type { ProvisionJobRecord } from "../../../storage/repositories/provisionJobRepository.js";
import { defaultPageEntries } from "../../../workflows/confluencePagesWorkflow.js";
import type { AdminToolDeps } from "../registry.js";
import type { ToolRegistry } from "../../toolRegistry.js";

const ARTIFACT_STATUS = z.enum(["missing", "planned", "linked", "error"]);
const HANDOFF_STATUS = z.enum(["not_ready", "ready", "blocked"]);
const LINK_HEALTH = z.enum(["ok", "warning", "broken", "unknown"]);
const CHAIN_STATUS = z.enum(["missing", "planned", "linked", "ready", "not_ready", "blocked", "error"]);

const ARTIFACT_COMMON = {
  lastSyncedAt: z.string().optional(),
  provenance: z.string().optional(),
  linkHealth: LINK_HEALTH.optional(),
  blockingReason: z.string().optional(),
};

const CONTEXT_SUMMARY = z.object({
  packCount: z.number().int().nonnegative(),
  plannedCount: z.number().int().nonnegative(),
  status: CHAIN_STATUS,
  uri: z.string().optional(),
  ...ARTIFACT_COMMON,
});

const READINESS_SUMMARY = z.object({
  verdict: z.enum(["not_ready", "ready", "blocked"]),
  score: z.number().int().min(0).max(100),
  gateCount: z.number().int().nonnegative(),
  blockedCount: z.number().int().nonnegative(),
  status: CHAIN_STATUS,
  ...ARTIFACT_COMMON,
});

const AUDIT_SUMMARY = z.object({
  eventCount: z.number().int().nonnegative(),
  latestAt: z.string().nullable(),
  status: CHAIN_STATUS,
  ...ARTIFACT_COMMON,
});

const QUEUE_SUMMARY = z.object({
  openJobs: z.number().int().nonnegative(),
  queuedJobs: z.number().int().nonnegative(),
  runningJobs: z.number().int().nonnegative(),
  failedJobs: z.number().int().nonnegative(),
  status: CHAIN_STATUS,
  ...ARTIFACT_COMMON,
});

const TRACE_ROW = z.object({
  id: z.string(),
  requirementId: z.string(),
  featureId: z.string(),
  featureTitle: z.string(),
  jiraIssueKey: z.string().nullable(),
  jiraIssueUrl: z.string().nullable(),
  confluenceTitle: z.string().nullable(),
  confluenceUrl: z.string().nullable(),
  repoPath: z.string().nullable(),
  pullRequestUrl: z.string().nullable(),
  contextPackUri: z.string().nullable(),
  readinessGate: z.string(),
  handoffBundleId: z.string().nullable(),
  status: CHAIN_STATUS,
  blockingReason: z.string().optional(),
});

const LATEST_EVENT = z.object({
  timestamp: z.string(),
  actor: z.string(),
  toolName: z.string(),
  outcome: z.string(),
});

const PHASE_SUMMARY = z.object({
  phaseId: z.string(),
  label: z.string(),
  readinessPercent: z.number().int().min(0).max(100),
  state: z.string(),
  status: z.enum(["current", "blocked", "complete", "planned"]),
  nextPhaseId: z.string().optional(),
  blockingReason: z.string().optional(),
});

const AGENT_LANE_SUMMARY = z.object({
  readyHandoffs: z.number().int().nonnegative(),
  queuedJobs: z.number().int().nonnegative(),
  runningJobs: z.number().int().nonnegative(),
  failedJobs: z.number().int().nonnegative(),
  blockedJobs: z.number().int().nonnegative(),
  staleHandoffs: z.number().int().nonnegative(),
  pendingApprovals: z.number().int().nonnegative(),
});

const ARTIFACT_SUMMARY = z.object({
  jira: z.object({
    projectKey: z.string().nullable(),
    projectUrl: z.string().nullable(),
    issueCount: z.number().int().nonnegative(),
    plannedCount: z.number().int().nonnegative(),
    status: ARTIFACT_STATUS,
    ...ARTIFACT_COMMON,
  }),
  confluence: z.object({
    spaceId: z.string().nullable(),
    spaceUrl: z.string().nullable(),
    pageCount: z.number().int().nonnegative(),
    plannedCount: z.number().int().nonnegative(),
    status: ARTIFACT_STATUS,
    ...ARTIFACT_COMMON,
  }),
  vcs: z.object({
    repoUrl: z.string().nullable(),
    fileCount: z.number().int().nonnegative(),
    status: ARTIFACT_STATUS,
    ...ARTIFACT_COMMON,
  }),
  handoff: z.object({
    bundleCount: z.number().int().nonnegative(),
    status: HANDOFF_STATUS,
    uri: z.string().optional(),
    ...ARTIFACT_COMMON,
  }),
  context: CONTEXT_SUMMARY.optional(),
  readiness: READINESS_SUMMARY.optional(),
  audit: AUDIT_SUMMARY.optional(),
  queue: QUEUE_SUMMARY.optional(),
  traceRows: z.array(TRACE_ROW).optional(),
});

const ARTIFACT_DETAIL = z.object({
  jira: ARTIFACT_SUMMARY.shape.jira.extend({
    cards: z.array(z.object({
      kind: z.enum(["epic", "story", "task"]),
      nodeId: z.string(),
      title: z.string(),
      issueKey: z.string().optional(),
      issueUrl: z.string().optional(),
    })),
  }),
  confluence: ARTIFACT_SUMMARY.shape.confluence.extend({
    pages: z.array(z.object({
      templateSlug: z.string(),
      title: z.string(),
      pageId: z.string().optional(),
      pageUrl: z.string().optional(),
    })),
  }),
  vcs: ARTIFACT_SUMMARY.shape.vcs,
  handoff: ARTIFACT_SUMMARY.shape.handoff.extend({
    latestBundleId: z.string().optional(),
  }),
  context: CONTEXT_SUMMARY.optional(),
  readiness: READINESS_SUMMARY.optional(),
  audit: AUDIT_SUMMARY.optional(),
  queue: QUEUE_SUMMARY.optional(),
  traceRows: z.array(TRACE_ROW).optional(),
});

const PROJECT_SUMMARY = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  state: z.enum(PROJECT_STATES as readonly [string, ...string[]]),
  schemaVersion: z.number(),
  blueprintVersion: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  openJobs: z.number().int().nonnegative(),
  atlassianProjectKey: z.string().optional(),
  artifactSummary: ARTIFACT_SUMMARY,
  latestEvent: LATEST_EVENT.optional(),
  phaseSummary: PHASE_SUMMARY.optional(),
  agentLaneSummary: AGENT_LANE_SUMMARY.optional(),
});

const LIST_OUTPUT = z.object({
  projects: z.array(PROJECT_SUMMARY),
});

const GET_INPUT = z.object({ key: z.string().min(1) });

const GET_OUTPUT = z.object({
  project: PROJECT_SUMMARY,
  blueprint: z.unknown(),
  recentAudit: z.array(z.object({
    id: z.string(),
    timestamp: z.string(),
    actor: z.string(),
    toolName: z.string(),
    outcome: z.string(),
    chainHash: z.string(),
    outputArtifactIds: z.array(z.string()).optional(),
  })),
  recentJobs: z.array(z.object({
    id: z.string(),
    status: z.string(),
    queuedAt: z.string(),
    updatedAt: z.string(),
    error: z.string().optional(),
    result: z.unknown().optional(),
  })),
  allowedTransitions: z.array(z.enum(PROJECT_STATES as readonly [string, ...string[]])),
  artifactSummary: ARTIFACT_DETAIL,
  latestEvent: LATEST_EVENT.optional(),
  phaseSummary: PHASE_SUMMARY.optional(),
  agentLaneSummary: AGENT_LANE_SUMMARY.optional(),
});

export function registerProjectsAdminTools(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.projects.list",
      description: "List all projects with state, readiness, open-job count.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { title: "Admin: list projects", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler() {
      const scope = defaultTenantScope();
      const projects = await deps.repositories.project.list(scope);
      const recentJobs = await deps.repositories.provisionJob.recent(scope, 200);
      const openCounts = new Map<string, number>();
      for (const j of recentJobs) {
        if (j.status === "queued" || j.status === "running") {
          openCounts.set(j.projectId, (openCounts.get(j.projectId) ?? 0) + 1);
        }
      }
      const summaries = await Promise.all(projects.map(async (p) => {
        const auditEntries = await deps.repositories.audit.readChainForProject(scope, p.id);
        const projectJobs = recentJobs.filter((j) => j.projectId === p.id);
        const artifactSummary = buildArtifactSummary(p, projectJobs, auditEntries);
        return {
          id: p.id,
          key: p.key,
          name: p.name,
          state: p.state,
          schemaVersion: p.schemaVersion,
          blueprintVersion: p.blueprintVersion,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          openJobs: openCounts.get(p.id) ?? 0,
          ...(p.atlassianProjectKey ? { atlassianProjectKey: p.atlassianProjectKey } : {}),
          artifactSummary,
          ...(buildLatestEvent(auditEntries) ? { latestEvent: buildLatestEvent(auditEntries) } : {}),
          phaseSummary: buildPhaseSummary(p, artifactSummary),
          agentLaneSummary: buildAgentLaneSummary(p, projectJobs, artifactSummary),
        };
      }));
      const output = LIST_OUTPUT.parse({ projects: summaries });
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  });

  registry.register({
    definition: {
      name: "admin.projects.get",
      description: "Project detail: blueprint JSON, recent audit, recent jobs, allowed state transitions.",
      inputSchema: {
        type: "object",
        properties: { key: { type: "string" } },
        required: ["key"],
        additionalProperties: false,
      },
      annotations: { title: "Admin: project detail", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler(params) {
      const { key } = GET_INPUT.parse(params);
      const scope = defaultTenantScope();
      const project = await deps.repositories.project.findByKey(scope, key);
      if (!project) throw new Error(`unknown project: ${key}`);

      const auditEntries = await deps.repositories.audit.readChainForProject(scope, project.id);
      const recentAudit = auditEntries
        .slice(-20)
        .reverse()
        .map((e) => ({
          id: e.id,
          timestamp: e.timestamp,
          actor: e.actor.mcpPrincipalId,
          toolName: e.toolName,
          outcome: e.errorState ?? "ok",
          chainHash: e.prevHash,
          ...(e.outputArtifactIds ? { outputArtifactIds: [...e.outputArtifactIds] } : {}),
        }));

      const allJobs = await deps.repositories.provisionJob.recent(scope, 100);
      const projectJobs = allJobs.filter((j) => j.projectId === project.id);
      const recentJobs = projectJobs
        .slice(0, 20)
        .map((j) => ({
          id: j.id,
          status: j.status,
          queuedAt: j.queuedAt,
          updatedAt: j.updatedAt,
          ...(j.error ? { error: j.error } : {}),
          ...(j.result !== undefined ? { result: j.result } : {}),
        }));

      // Allowed transitions per src/domain/projectState.ts
      const transitions = ALLOWED_NEXT[project.state] ?? [];
      const artifactDetail = buildArtifactDetail(project, projectJobs, auditEntries);
      const latestEvent = buildLatestEvent(auditEntries);
      const phaseSummary = buildPhaseSummary(project, artifactDetail);
      const agentLaneSummary = buildAgentLaneSummary(project, projectJobs, artifactDetail);

      const summary = {
        id: project.id,
        key: project.key,
        name: project.name,
        state: project.state,
        schemaVersion: project.schemaVersion,
        blueprintVersion: project.blueprintVersion,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        openJobs: recentJobs.filter((j) => j.status === "queued" || j.status === "running").length,
        ...(project.atlassianProjectKey ? { atlassianProjectKey: project.atlassianProjectKey } : {}),
        artifactSummary: artifactDetail,
        ...(latestEvent ? { latestEvent } : {}),
        phaseSummary,
        agentLaneSummary,
      };

      const output = GET_OUTPUT.parse({
        project: summary,
        blueprint: project,
        recentAudit,
        recentJobs,
        allowedTransitions: transitions,
        artifactSummary: artifactDetail,
        ...(latestEvent ? { latestEvent } : {}),
        phaseSummary,
        agentLaneSummary,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  });
}

// Mirror of VALID_TRANSITIONS in src/domain/projectState.ts. Kept inline so the
// admin layer doesn't need to expose the underlying canTransition helper.
const ALLOWED_NEXT: Readonly<Record<string, readonly string[]>> = {
  DRAFT_INTAKE: ["CLARIFICATION_NEEDED", "BLUEPRINT_READY", "ARCHIVED"],
  CLARIFICATION_NEEDED: ["DRAFT_INTAKE", "BLUEPRINT_READY", "ARCHIVED"],
  BLUEPRINT_READY: ["PREFLIGHT_PASSED", "CLARIFICATION_NEEDED", "ARCHIVED"],
  PREFLIGHT_PASSED: ["PROVISIONING_PREVIEWED", "BLUEPRINT_READY", "DRIFT_DETECTED", "ARCHIVED"],
  PROVISIONING_PREVIEWED: ["PROVISIONED", "BLUEPRINT_READY", "ARCHIVED"],
  PROVISIONED: ["LINKED", "DRIFT_DETECTED", "ARCHIVED"],
  LINKED: ["VALIDATED", "DRIFT_DETECTED", "ARCHIVED"],
  VALIDATED: ["READY_FOR_BUILD", "VALIDATION_FAILED", "DRIFT_DETECTED", "ARCHIVED"],
  READY_FOR_BUILD: ["DRIFT_DETECTED", "ARCHIVED"],
  VALIDATION_FAILED: ["BLUEPRINT_READY", "ARCHIVED"],
  DRIFT_DETECTED: ["BLUEPRINT_READY", "PREFLIGHT_PASSED", "ARCHIVED"],
  ARCHIVED: [],
};

type ArtifactSummary = z.infer<typeof ARTIFACT_SUMMARY>;
type ArtifactDetail = z.infer<typeof ARTIFACT_DETAIL>;

interface ArtifactCollections {
  readonly jiraProjectKeys: readonly string[];
  readonly jiraIssueKeys: readonly string[];
  readonly confluenceIds: readonly string[];
  readonly vcsUrls: readonly string[];
  readonly handoffIds: readonly string[];
}

function buildArtifactSummary(
  project: ProjectBlueprint,
  jobs: readonly ProvisionJobRecord[],
  auditEntries: readonly AuditEntry[],
): ArtifactSummary {
  const detail = buildArtifactDetail(project, jobs, auditEntries);
  return {
    jira: {
      projectKey: detail.jira.projectKey,
      projectUrl: detail.jira.projectUrl,
      issueCount: detail.jira.issueCount,
      plannedCount: detail.jira.plannedCount,
      status: detail.jira.status,
      ...(detail.jira.lastSyncedAt ? { lastSyncedAt: detail.jira.lastSyncedAt } : {}),
      ...(detail.jira.provenance ? { provenance: detail.jira.provenance } : {}),
      ...(detail.jira.linkHealth ? { linkHealth: detail.jira.linkHealth } : {}),
      ...(detail.jira.blockingReason ? { blockingReason: detail.jira.blockingReason } : {}),
    },
    confluence: {
      spaceId: detail.confluence.spaceId,
      spaceUrl: detail.confluence.spaceUrl,
      pageCount: detail.confluence.pageCount,
      plannedCount: detail.confluence.plannedCount,
      status: detail.confluence.status,
      ...(detail.confluence.lastSyncedAt ? { lastSyncedAt: detail.confluence.lastSyncedAt } : {}),
      ...(detail.confluence.provenance ? { provenance: detail.confluence.provenance } : {}),
      ...(detail.confluence.linkHealth ? { linkHealth: detail.confluence.linkHealth } : {}),
      ...(detail.confluence.blockingReason ? { blockingReason: detail.confluence.blockingReason } : {}),
    },
    vcs: detail.vcs,
    handoff: {
      bundleCount: detail.handoff.bundleCount,
      status: detail.handoff.status,
      ...(detail.handoff.uri ? { uri: detail.handoff.uri } : {}),
      ...(detail.handoff.lastSyncedAt ? { lastSyncedAt: detail.handoff.lastSyncedAt } : {}),
      ...(detail.handoff.provenance ? { provenance: detail.handoff.provenance } : {}),
      ...(detail.handoff.linkHealth ? { linkHealth: detail.handoff.linkHealth } : {}),
      ...(detail.handoff.blockingReason ? { blockingReason: detail.handoff.blockingReason } : {}),
    },
    ...(detail.context ? { context: detail.context } : {}),
    ...(detail.readiness ? { readiness: detail.readiness } : {}),
    ...(detail.audit ? { audit: detail.audit } : {}),
    ...(detail.queue ? { queue: detail.queue } : {}),
    ...(detail.traceRows ? { traceRows: detail.traceRows } : {}),
  };
}

function buildArtifactDetail(
  project: ProjectBlueprint,
  jobs: readonly ProvisionJobRecord[],
  auditEntries: readonly AuditEntry[],
): ArtifactDetail {
  const artifacts = collectArtifacts(auditEntries);
  const jiraProjectKey = project.atlassianProjectKey
    ?? firstStringFromJobs(jobs, ["jiraProjectKey"])
    ?? artifacts.jiraProjectKeys[0]
    ?? null;
  const confluenceSpaceId = firstStringFromJobs(jobs, ["confluenceSpaceId", "spaceId"])
    ?? inferConfluenceSpace(project)
    ?? null;
  const repoUrl = firstStringFromJobs(jobs, ["repoUrl"])
    ?? artifacts.vcsUrls[0]
    ?? null;
  const jiraProjectUrl = jiraProjectUrlFor(jiraProjectKey);
  const confluenceSpaceUrl = confluenceSpaceUrlFor(confluenceSpaceId);
  const jiraCards = jiraCardsFor(project, artifacts.jiraIssueKeys);
  const confluencePages = confluencePagesFor(project, confluenceSpaceId, artifacts.confluenceIds);
  const issueCount = maxNonNegative([
    artifacts.jiraIssueKeys.length,
    jiraCards.filter((card) => card.issueKey).length,
    ...numbersFromJobs(jobs, ["issuesCreated", "totalCreated"]),
  ]);
  const pageCount = maxNonNegative([
    artifacts.confluenceIds.length,
    ...numbersFromJobs(jobs, ["pagesCreated", "totalPages"]),
  ]);
  const fileCount = maxNonNegative(numbersFromJobs(jobs, ["filesSeeded", "totalFiles"]));
  const jiraFailed = failedJobFor(jobs, "jira");
  const confluenceFailed = failedJobFor(jobs, "confluence");
  const vcsFailed = failedJobFor(jobs, "vcs");
  const handoffIds = artifacts.handoffIds.length > 0
    ? [...artifacts.handoffIds]
    : auditEntries.filter((entry) => entry.toolName === "admin.lifecycle.handoff.bundle").map((entry) => entry.id);
  const bundleCount = unique(handoffIds).length;
  const handoffBlocked = project.state === "VALIDATION_FAILED" || project.state === "DRIFT_DETECTED";
  const lastSyncedAt = latestTimestamp(project.updatedAt, jobs, auditEntries);
  const jiraStatus = artifactStatus(jiraFailed, jiraProjectKey !== null || issueCount > 0, jiraCards.length);
  const confluenceStatus = artifactStatus(confluenceFailed, confluenceSpaceId !== null || pageCount > 0, confluencePages.length);
  const vcsStatus = artifactStatus(vcsFailed, repoUrl !== null || fileCount > 0, 0);
  const handoffStatus = handoffBlocked ? "blocked" : bundleCount > 0 || project.state === "READY_FOR_BUILD" ? "ready" : "not_ready";
  const handoffUri = bundleCount > 0 || project.state === "READY_FOR_BUILD" ? `mcp://handoff/${encodeURIComponent(project.key)}` : undefined;
  const contextSummary = buildContextSummary(project, bundleCount, lastSyncedAt, handoffBlocked);
  const readinessSummary = buildReadinessSummary(project, jobs, jiraStatus, confluenceStatus, vcsStatus, handoffStatus, lastSyncedAt);
  const auditSummary = buildAuditSummary(auditEntries, lastSyncedAt);
  const queueSummary = buildQueueSummary(jobs, lastSyncedAt);

  return {
    jira: {
      projectKey: jiraProjectKey,
      projectUrl: jiraProjectUrl,
      issueCount,
      plannedCount: jiraCards.length,
      status: jiraStatus,
      lastSyncedAt,
      provenance: "audit artifacts + provisioning job result",
      linkHealth: linkHealthFor(jiraStatus),
      ...(jiraFailed ? { blockingReason: failedJobError(jobs, "jira") ?? "Jira provisioning failed" } : {}),
      cards: jiraCards,
    },
    confluence: {
      spaceId: confluenceSpaceId,
      spaceUrl: confluenceSpaceUrl,
      pageCount,
      plannedCount: confluencePages.length,
      status: confluenceStatus,
      lastSyncedAt,
      provenance: "Confluence page plan + audit artifacts",
      linkHealth: linkHealthFor(confluenceStatus),
      ...(confluenceFailed ? { blockingReason: failedJobError(jobs, "confluence") ?? "Confluence provisioning failed" } : {}),
      pages: confluencePages,
    },
    vcs: {
      repoUrl,
      fileCount,
      status: vcsStatus,
      lastSyncedAt,
      provenance: "VCS provisioning job result",
      linkHealth: linkHealthFor(vcsStatus),
      ...(vcsFailed ? { blockingReason: failedJobError(jobs, "vcs") ?? "VCS provisioning failed" } : {}),
    },
    handoff: {
      bundleCount,
      status: handoffStatus,
      ...(handoffUri ? { uri: handoffUri } : {}),
      lastSyncedAt,
      provenance: "handoff audit bundle",
      linkHealth: linkHealthFor(handoffStatus),
      ...(handoffBlocked ? { blockingReason: stateBlockingReason(project.state) } : {}),
      ...(handoffIds[0] ? { latestBundleId: handoffIds[0] } : {}),
    },
    context: contextSummary,
    readiness: readinessSummary,
    audit: auditSummary,
    queue: queueSummary,
    traceRows: traceRowsFor(project, jiraCards, confluencePages, repoUrl, contextSummary.uri, handoffIds[0]),
  };
}

function buildContextSummary(
  project: ProjectBlueprint,
  bundleCount: number,
  lastSyncedAt: string,
  blocked: boolean,
): NonNullable<ArtifactSummary["context"]> {
  const packCount = lifecycleIndex(project.state) >= lifecycleIndex("LINKED") || bundleCount > 0 ? 1 : 0;
  const status = blocked ? "blocked" : packCount > 0 ? "linked" : "planned";
  return {
    packCount,
    plannedCount: 1,
    status,
    ...(packCount > 0 ? { uri: `mcp://context-packs/${encodeURIComponent(project.key)}` } : {}),
    lastSyncedAt,
    provenance: "blueprint + source pins + audit chain",
    linkHealth: linkHealthFor(status),
    ...(blocked ? { blockingReason: stateBlockingReason(project.state) } : {}),
  };
}

function buildReadinessSummary(
  project: ProjectBlueprint,
  jobs: readonly ProvisionJobRecord[],
  jiraStatus: "missing" | "planned" | "linked" | "error",
  confluenceStatus: "missing" | "planned" | "linked" | "error",
  vcsStatus: "missing" | "planned" | "linked" | "error",
  handoffStatus: "not_ready" | "ready" | "blocked",
  lastSyncedAt: string,
): NonNullable<ArtifactSummary["readiness"]> {
  const failedJobs = jobs.filter((job) => job.status === "failed").length;
  const blockedArtifacts = [jiraStatus, confluenceStatus, vcsStatus].filter((status) => status === "error").length
    + (handoffStatus === "blocked" ? 1 : 0)
    + failedJobs
    + (project.state === "VALIDATION_FAILED" || project.state === "DRIFT_DETECTED" ? 1 : 0);
  const score = readinessScoreForState(project.state);
  const verdict = blockedArtifacts > 0 ? "blocked" : project.state === "READY_FOR_BUILD" || score >= 88 ? "ready" : "not_ready";
  const status = verdict === "ready" ? "ready" : verdict === "blocked" ? "blocked" : "planned";
  return {
    verdict,
    score,
    gateCount: 7,
    blockedCount: blockedArtifacts,
    status,
    lastSyncedAt,
    provenance: "lifecycle state + artifact link health + queue failures",
    linkHealth: linkHealthFor(status),
    ...(blockedArtifacts > 0 ? { blockingReason: readinessBlockingReason(project, failedJobs) } : {}),
  };
}

function buildAuditSummary(
  auditEntries: readonly AuditEntry[],
  lastSyncedAt: string,
): NonNullable<ArtifactSummary["audit"]> {
  const latest = auditEntries[auditEntries.length - 1];
  return {
    eventCount: auditEntries.length,
    latestAt: latest?.timestamp ?? null,
    status: auditEntries.length > 0 ? "linked" : "missing",
    lastSyncedAt,
    provenance: "signed project audit chain",
    linkHealth: auditEntries.length > 0 ? "ok" : "unknown",
  };
}

function buildQueueSummary(
  jobs: readonly ProvisionJobRecord[],
  lastSyncedAt: string,
): NonNullable<ArtifactSummary["queue"]> {
  const queuedJobs = jobs.filter((job) => job.status === "queued").length;
  const runningJobs = jobs.filter((job) => job.status === "running").length;
  const failedJobs = jobs.filter((job) => job.status === "failed").length;
  const openJobs = queuedJobs + runningJobs;
  const status = failedJobs > 0 ? "blocked" : openJobs > 0 ? "planned" : jobs.length > 0 ? "linked" : "missing";
  return {
    openJobs,
    queuedJobs,
    runningJobs,
    failedJobs,
    status,
    lastSyncedAt,
    provenance: "provision job repository",
    linkHealth: linkHealthFor(status),
    ...(failedJobs > 0 ? { blockingReason: `${failedJobs} failed provisioning job(s)` } : {}),
  };
}

function traceRowsFor(
  project: ProjectBlueprint,
  jiraCards: ArtifactDetail["jira"]["cards"],
  confluencePages: ArtifactDetail["confluence"]["pages"],
  repoUrl: string | null,
  contextPackUri: string | undefined,
  handoffBundleId: string | undefined,
): NonNullable<ArtifactSummary["traceRows"]> {
  const rows: NonNullable<ArtifactSummary["traceRows"]> = [];
  const requirementsById = new Map(project.requirements.map((requirement) => [requirement.id, requirement]));
  const featureRows = project.features.length > 0
    ? project.features
    : project.requirements.map((requirement) => ({
        id: requirement.id,
        title: requirement.title,
        requirementIds: [requirement.id],
      }));

  featureRows.slice(0, 12).forEach((feature, index) => {
    const requirementIds = Array.isArray(feature.requirementIds) ? feature.requirementIds : [];
    const requirementId = requirementIds[0] ?? project.requirements[index]?.id ?? feature.id;
    const requirement = requirementsById.get(requirementId);
    const jiraCard = jiraCards[index] ?? jiraCards[0];
    const page = confluencePages[index % Math.max(1, confluencePages.length)];
    const repoPath = repoUrl ? `docs/features/${slugTitle(feature.id)}.md` : null;
    const status = jiraCard?.issueKey && page?.pageUrl && contextPackUri && handoffBundleId
      ? "ready"
      : jiraCard?.issueKey || page?.pageUrl || contextPackUri
        ? "planned"
        : "missing";
    rows.push({
      id: `${project.key}:${feature.id}:${requirementId}`,
      requirementId,
      featureId: feature.id,
      featureTitle: titleForTraceFeature(feature, requirement),
      jiraIssueKey: jiraCard?.issueKey ?? null,
      jiraIssueUrl: jiraCard?.issueUrl ?? null,
      confluenceTitle: page?.title ?? null,
      confluenceUrl: page?.pageUrl ?? null,
      repoPath,
      pullRequestUrl: null,
      contextPackUri: contextPackUri ?? null,
      readinessGate: requirement ? `${requirement.priority}:${requirement.type}` : "blueprint",
      handoffBundleId: handoffBundleId ?? null,
      status,
    });
  });
  return rows;
}

function titleForTraceFeature(
  feature: Readonly<{ id: string; title?: unknown }>,
  requirement: ProjectBlueprint["requirements"][number] | undefined,
): string {
  if (typeof feature.title === "string" && feature.title.length > 0) return feature.title;
  if (requirement && typeof requirement.title === "string" && requirement.title.length > 0) return requirement.title;
  return feature.id;
}

function buildLatestEvent(auditEntries: readonly AuditEntry[]): z.infer<typeof LATEST_EVENT> | undefined {
  const latest = auditEntries[auditEntries.length - 1];
  if (!latest) return undefined;
  return {
    timestamp: latest.timestamp,
    actor: latest.actor.mcpPrincipalId,
    toolName: latest.toolName,
    outcome: latest.errorState ?? "ok",
  };
}

function buildPhaseSummary(project: ProjectBlueprint, summary: ArtifactSummary): z.infer<typeof PHASE_SUMMARY> {
  const phaseIndex = phaseIndexForState(project.state);
  const phase = CONTROL_PHASES[phaseIndex] ?? DEFAULT_CONTROL_PHASE;
  const nextPhase = CONTROL_PHASES[phaseIndex + 1];
  const blocked = project.state === "VALIDATION_FAILED" || project.state === "DRIFT_DETECTED" || (summary.readiness?.blockedCount ?? 0) > 0;
  return {
    phaseId: phase.id,
    label: phase.label,
    readinessPercent: readinessScoreForState(project.state),
    state: project.state,
    status: blocked ? "blocked" : project.state === "READY_FOR_BUILD" ? "complete" : "current",
    ...(nextPhase ? { nextPhaseId: nextPhase.id } : {}),
    ...(blocked ? { blockingReason: summary.readiness?.blockingReason ?? stateBlockingReason(project.state) } : {}),
  };
}

function buildAgentLaneSummary(
  project: ProjectBlueprint,
  jobs: readonly ProvisionJobRecord[],
  summary: ArtifactSummary,
): z.infer<typeof AGENT_LANE_SUMMARY> {
  const queuedJobs = jobs.filter((job) => job.status === "queued").length;
  const runningJobs = jobs.filter((job) => job.status === "running").length;
  const failedJobs = jobs.filter((job) => job.status === "failed").length;
  const staleHandoffs = summary.handoff.status === "blocked" ? 1 : 0;
  return {
    readyHandoffs: summary.handoff.status === "ready" ? 1 : 0,
    queuedJobs,
    runningJobs,
    failedJobs,
    blockedJobs: failedJobs + staleHandoffs + (project.state === "VALIDATION_FAILED" || project.state === "DRIFT_DETECTED" ? 1 : 0),
    staleHandoffs,
    pendingApprovals: 0,
  };
}

const DEFAULT_CONTROL_PHASE = { id: "inception", label: "Inception", states: ["DRAFT_INTAKE"] } as const;

const CONTROL_PHASES: ReadonlyArray<{
  readonly id: string;
  readonly label: string;
  readonly states: readonly string[];
}> = [
  { id: "inception", label: "Inception", states: ["DRAFT_INTAKE"] },
  { id: "requirements", label: "Requirements", states: ["CLARIFICATION_NEEDED"] },
  { id: "blueprint", label: "Blueprint", states: ["BLUEPRINT_READY"] },
  { id: "preflight", label: "Preflight", states: ["PREFLIGHT_PASSED"] },
  { id: "provisioning", label: "Provisioning", states: ["PROVISIONING_PREVIEWED", "PROVISIONED"] },
  { id: "context", label: "Context", states: ["LINKED"] },
  { id: "readiness", label: "Readiness", states: ["VALIDATED"] },
  { id: "handoff", label: "Handoff", states: ["READY_FOR_BUILD"] },
  { id: "build", label: "Build", states: [] },
];

function phaseIndexForState(state: string): number {
  if (state === "VALIDATION_FAILED" || state === "DRIFT_DETECTED") return 4;
  const index = CONTROL_PHASES.findIndex((phase) => phase.states.includes(state));
  return index < 0 ? 0 : index;
}

function lifecycleIndex(state: string): number {
  const order = [
    "DRAFT_INTAKE",
    "CLARIFICATION_NEEDED",
    "BLUEPRINT_READY",
    "PREFLIGHT_PASSED",
    "PROVISIONING_PREVIEWED",
    "PROVISIONED",
    "LINKED",
    "VALIDATED",
    "READY_FOR_BUILD",
  ];
  const index = order.indexOf(state);
  return index < 0 ? 0 : index;
}

function readinessScoreForState(state: string): number {
  const scores: Readonly<Record<string, number>> = {
    DRAFT_INTAKE: 8,
    CLARIFICATION_NEEDED: 14,
    BLUEPRINT_READY: 28,
    PREFLIGHT_PASSED: 42,
    PROVISIONING_PREVIEWED: 55,
    PROVISIONED: 66,
    LINKED: 78,
    VALIDATED: 88,
    READY_FOR_BUILD: 100,
    VALIDATION_FAILED: 52,
    DRIFT_DETECTED: 60,
    ARCHIVED: 0,
  };
  return scores[state] ?? 0;
}

function linkHealthFor(status: string): "ok" | "warning" | "broken" | "unknown" {
  if (status === "linked" || status === "ready") return "ok";
  if (status === "planned" || status === "not_ready") return "warning";
  if (status === "error" || status === "blocked") return "broken";
  return "unknown";
}

function readinessBlockingReason(project: ProjectBlueprint, failedJobs: number): string {
  if (failedJobs > 0) return `${failedJobs} failed provisioning job(s)`;
  return stateBlockingReason(project.state);
}

function stateBlockingReason(state: string): string {
  if (state === "DRIFT_DETECTED") return "Drift detected; rerun validation before handoff";
  if (state === "VALIDATION_FAILED") return "Validation failed; fix readiness gates before handoff";
  return "Readiness gates are not complete";
}

function failedJobError(jobs: readonly ProvisionJobRecord[], kind: "jira" | "confluence" | "vcs"): string | undefined {
  return jobs.find((job) => job.status === "failed" && jobLooksLike(job, kind))?.error;
}

function latestTimestamp(
  fallback: string,
  jobs: readonly ProvisionJobRecord[],
  auditEntries: readonly AuditEntry[],
): string {
  const candidates = [
    fallback,
    ...jobs.map((job) => job.updatedAt),
    ...auditEntries.map((entry) => entry.timestamp),
  ].filter((value) => value.length > 0);
  return candidates.sort((a, b) => b.localeCompare(a))[0] ?? fallback;
}

function collectArtifacts(auditEntries: readonly AuditEntry[]): ArtifactCollections {
  const jiraProjectKeys: string[] = [];
  const jiraIssueKeys: string[] = [];
  const confluenceIds: string[] = [];
  const vcsUrls: string[] = [];
  const handoffIds: string[] = [];

  for (const entry of auditEntries) {
    for (const artifact of entry.outputArtifactIds ?? []) {
      if (artifact.startsWith("jira_project:")) addUnique(jiraProjectKeys, artifact.slice("jira_project:".length));
      if (artifact.startsWith("jira:")) addUnique(jiraIssueKeys, artifact.slice("jira:".length));
      if (artifact.startsWith("confluence:")) addUnique(confluenceIds, artifact.slice("confluence:".length));
      if (artifact.startsWith("vcs:")) addUnique(vcsUrls, artifact.slice("vcs:".length));
      if (artifact.startsWith("handoff:")) addUnique(handoffIds, artifact.slice("handoff:".length));
    }
  }

  return { jiraProjectKeys, jiraIssueKeys, confluenceIds, vcsUrls, handoffIds };
}

function jiraCardsFor(project: ProjectBlueprint, issueKeys: readonly string[]): ArtifactDetail["jira"]["cards"] {
  if (project.adoptedJiraCards && project.adoptedJiraCards.length > 0) {
    const cards = project.adoptedJiraCards.flatMap((rawCard, index) => {
      const raw = recordValue(rawCard);
      if (!raw) return [];
      const issueKey = stringValue(raw["issueKey"]) ?? stringValue(raw["key"]) ?? stringValue(raw["nodeId"]);
      const nodeId = stringValue(raw["nodeId"]) ?? issueKey;
      const title = stringValue(raw["title"]) ?? issueKey;
      if (!issueKey || !nodeId || !title) return [];
      const issueUrl = jiraIssueUrlFor(issueKey);
      return [{
        kind: jiraCardKind(raw["kind"], index),
        nodeId,
        title,
        issueKey,
        ...(issueUrl ? { issueUrl } : {}),
      }];
    });
    if (cards.length > 0) return cards;
  }

  const cards: ArtifactDetail["jira"]["cards"] = [];
  let index = 0;
  for (const epic of project.epics) {
    const issueKey = issueKeys[index];
    cards.push({
      kind: "epic",
      nodeId: epic.id,
      title: epic.title,
      ...(issueKey ? { issueKey } : {}),
      ...(issueKey ? { issueUrl: jiraIssueUrlFor(issueKey) ?? undefined } : {}),
    });
    index += 1;
    for (const story of epic.stories) {
      const storyIssueKey = issueKeys[index];
      cards.push({
        kind: "story",
        nodeId: story.id,
        title: story.title,
        ...(storyIssueKey ? { issueKey: storyIssueKey } : {}),
        ...(storyIssueKey ? { issueUrl: jiraIssueUrlFor(storyIssueKey) ?? undefined } : {}),
      });
      index += 1;
    }
  }
  return cards;
}

function jiraCardKind(value: unknown, index: number): "epic" | "story" | "task" {
  if (value === "epic" || value === "story" || value === "task") return value;
  return index === 0 ? "epic" : "story";
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function confluencePagesFor(
  project: ProjectBlueprint,
  spaceId: string | null,
  pageIds: readonly string[],
): ArtifactDetail["confluence"]["pages"] {
  return defaultPageEntries(project).map((page, index) => {
    const pageId = pageIds[index];
    const pageUrl = pageId ? confluencePageUrlFor(spaceId, pageId, page.title) : null;
    return {
      templateSlug: page.templateSlug,
      title: page.title,
      ...(pageId ? { pageId } : {}),
      ...(pageUrl ? { pageUrl } : {}),
    };
  });
}

function inferConfluenceSpace(project: ProjectBlueprint): string | undefined {
  for (const epic of project.epics) {
    for (const ref of epic.confluenceRefs) {
      if (ref.startsWith("confluence:")) return ref.slice("confluence:".length);
    }
  }
  return undefined;
}

function artifactStatus(failed: boolean, linked: boolean, plannedCount: number): "missing" | "planned" | "linked" | "error" {
  if (failed) return "error";
  if (linked) return "linked";
  if (plannedCount > 0) return "planned";
  return "missing";
}

function failedJobFor(jobs: readonly ProvisionJobRecord[], kind: "jira" | "confluence" | "vcs"): boolean {
  return jobs.some((job) => job.status === "failed" && jobLooksLike(job, kind));
}

function jobLooksLike(job: ProvisionJobRecord, kind: "jira" | "confluence" | "vcs"): boolean {
  const id = job.id.toLowerCase();
  if (id.includes(kind)) return true;
  const result = recordValue(job.result);
  if (!result) return false;
  if (kind === "jira") return "jiraProjectKey" in result || "issuesCreated" in result || "totalCreated" in result;
  if (kind === "confluence") return "confluenceSpaceId" in result || "spaceId" in result || "pagesCreated" in result;
  return "repoUrl" in result || "filesSeeded" in result || "totalFiles" in result;
}

function firstStringFromJobs(jobs: readonly ProvisionJobRecord[], keys: readonly string[]): string | undefined {
  for (const job of jobs) {
    const result = recordValue(job.result);
    if (!result) continue;
    for (const key of keys) {
      const value = result[key];
      if (typeof value === "string" && value.length > 0) return value;
    }
  }
  return undefined;
}

function numbersFromJobs(jobs: readonly ProvisionJobRecord[], keys: readonly string[]): readonly number[] {
  const values: number[] = [];
  for (const job of jobs) {
    const result = recordValue(job.result);
    if (!result) continue;
    for (const key of keys) {
      const value = result[key];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) values.push(Math.floor(value));
      if (Array.isArray(value)) values.push(value.length);
    }
  }
  return values;
}

function recordValue(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  return value as Readonly<Record<string, unknown>>;
}

function maxNonNegative(values: readonly number[]): number {
  return values.reduce((max, value) => (value > max ? value : max), 0);
}

function addUnique(target: string[], value: string): void {
  if (value.length > 0 && value !== "undefined" && value !== "null" && !target.includes(value)) target.push(value);
}

function unique(values: readonly string[]): readonly string[] {
  const deduped: string[] = [];
  for (const value of values) addUnique(deduped, value);
  return deduped;
}

function jiraProjectUrlFor(projectKey: string | null): string | null {
  const baseUrl = atlassianSiteBaseUrl();
  if (!baseUrl || !projectKey) return null;
  return `${baseUrl}/jira/software/projects/${encodeURIComponent(projectKey)}/summary`;
}

function jiraIssueUrlFor(issueKey: string): string | null {
  const baseUrl = atlassianSiteBaseUrl();
  if (!baseUrl) return null;
  return `${baseUrl}/browse/${encodeURIComponent(issueKey)}`;
}

function confluenceSpaceUrlFor(spaceId: string | null): string | null {
  const baseUrl = confluenceBaseUrl();
  if (!baseUrl || !spaceId) return null;
  return `${baseUrl}/spaces/${encodeURIComponent(spaceId)}`;
}

function confluencePageUrlFor(spaceId: string | null, pageId: string, title: string): string | null {
  const spaceUrl = confluenceSpaceUrlFor(spaceId);
  if (!spaceUrl || !/^\d+$/.test(pageId)) return null;
  return `${spaceUrl}/pages/${encodeURIComponent(pageId)}/${encodeURIComponent(slugTitle(title))}`;
}

function atlassianSiteBaseUrl(): string | undefined {
  return stripWikiPath(
    cleanBaseUrl(readOptionalString("ATLASSIAN_SITE_URL"))
      ?? cleanBaseUrl(readOptionalString("JIRA_BASE_URL"))
      ?? cleanBaseUrl(readOptionalString("CONFLUENCE_BASE_URL")),
  );
}

function confluenceBaseUrl(): string | undefined {
  const configured = cleanBaseUrl(readOptionalString("CONFLUENCE_BASE_URL"));
  if (configured) return configured;
  const site = atlassianSiteBaseUrl();
  return site ? `${site}/wiki` : undefined;
}

function cleanBaseUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.replace(/\/+$/, "");
  }
}

function stripWikiPath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.endsWith("/wiki") ? value.slice(0, -"/wiki".length) : value;
}

function slugTitle(title: string): string {
  return title.trim().replace(/\s+/g, "-");
}
