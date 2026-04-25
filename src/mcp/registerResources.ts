// Diagnostic resources required by v6 §2 (M0 Acceptance):
//   orchestrator://session/current/capabilities — always available; debug aid.
//   orchestrator://session/current/preflight    — STUB in M0; populated in M2.
//
// The preflight resource is auto-pinned per the mengram F-053 pattern when the
// client supports proactive resource pinning. M0 ships the resource as a stub
// so consumers can subscribe immediately; payload becomes meaningful once M2
// implements project_preflight_check.

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
  type ResourceTemplate,
} from "@modelcontextprotocol/sdk/types.js";
import type { SessionRegistry, McpSessionProfile } from "./sessionCapabilities.js";
import type { Logger } from "pino";
import type { ProvisionJobRepository } from "../storage/repositories/provisionJobRepository.js";
import type { TenantScope } from "../domain/tenantScope.js";
import { defaultTenantScope } from "../domain/tenantScope.js";
import type { ProjectRepository } from "../storage/repositories/projectRepository.js";
import type { ContextPackRepository } from "../storage/repositories/contextPackRepository.js";
import type { ReadinessRepository } from "../storage/repositories/readinessRepository.js";
import type { TraceLinkRepository } from "../storage/repositories/traceLinkRepository.js";

export const SESSION_CAPABILITIES_URI = "orchestrator://session/current/capabilities";
export const SESSION_PREFLIGHT_URI = "orchestrator://session/current/preflight";

export const PUBLIC_RESOURCE_TEMPLATE_URIS = [
  "orchestrator://project/{projectId}/context",
  "orchestrator://project/{projectId}/readiness",
  "orchestrator://project/{projectId}/linked-artifacts",
  "orchestrator://issue/{issueKey}/context",
  "orchestrator://issue/{issueKey}/handoff",
  "orchestrator://issue/{issueKey}/acceptance-criteria",
  "orchestrator://issue/{issueKey}/linked-artifacts",
  "orchestrator://job/{jobId}",
] as const;

export function listPublicResourceTemplates(): readonly ResourceTemplate[] {
  return [
    {
      uriTemplate: "orchestrator://project/{projectId}/context",
      name: "Project context",
      description: "Latest generated or regenerable project-level context pack.",
      mimeType: "application/json",
    },
    {
      uriTemplate: "orchestrator://project/{projectId}/readiness",
      name: "Project readiness",
      description: "Latest deterministic readiness report for a project.",
      mimeType: "application/json",
    },
    {
      uriTemplate: "orchestrator://project/{projectId}/linked-artifacts",
      name: "Project linked artifacts",
      description: "Trace-linked Jira, Confluence, and VCS artifacts for a project.",
      mimeType: "application/json",
    },
    {
      uriTemplate: "orchestrator://issue/{issueKey}/context",
      name: "Issue context",
      description: "Issue-scoped context pack. Falls back to a not_found envelope when no pack exists yet.",
      mimeType: "application/json",
    },
    {
      uriTemplate: "orchestrator://issue/{issueKey}/handoff",
      name: "Issue handoff",
      description: "Build-agent handoff metadata for an issue.",
      mimeType: "application/json",
    },
    {
      uriTemplate: "orchestrator://issue/{issueKey}/acceptance-criteria",
      name: "Issue acceptance criteria",
      description: "Acceptance criteria derived from the blueprint story matching an issue key or story id.",
      mimeType: "application/json",
    },
    {
      uriTemplate: "orchestrator://issue/{issueKey}/linked-artifacts",
      name: "Issue linked artifacts",
      description: "Trace-linked artifacts for a Jira issue or blueprint story id.",
      mimeType: "application/json",
    },
    {
      uriTemplate: "orchestrator://job/{jobId}",
      name: "Provisioning job",
      description: "Persistent provisioning job status and result.",
      mimeType: "application/json",
    },
  ];
}

interface RegisterArgs {
  server: Server;
  sessionRegistry: SessionRegistry;
  /** Returns the session id associated with the current request, if known. */
  resolveCurrentSessionId: () => string | undefined;
  logger: Logger;
  /** Optional persistent provision job repository (M6a; F-011 closure). */
  provisionJobs?: ProvisionJobRepository;
  projectRepository?: ProjectRepository;
  contextPacks?: ContextPackRepository;
  readiness?: ReadinessRepository;
  traceLinks?: TraceLinkRepository;
  /** Resolves the tenant scope used to read job state. */
  resolveScope?: (sessionId: string | undefined) => TenantScope;
}

export function registerResources({
  server,
  sessionRegistry,
  resolveCurrentSessionId,
  logger,
  provisionJobs,
  projectRepository,
  contextPacks,
  readiness,
  traceLinks,
  resolveScope,
}: RegisterArgs): void {
  const scopeResolver = resolveScope ?? (() => defaultTenantScope());
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: SESSION_CAPABILITIES_URI,
        name: "Session capabilities",
        description: "Negotiated MCP capabilities for the current session. Diagnostic.",
        mimeType: "application/json",
      },
      {
        uri: SESSION_PREFLIGHT_URI,
        name: "Session preflight",
        description: "Project preflight summary. Stubbed until M2 implements project_preflight_check.",
        mimeType: "application/json",
      },
      {
        uri: "orchestrator://jobs/recent",
        name: "Recent provisioning jobs",
        description: "Recent project_provision_execute job states.",
        mimeType: "application/json",
      },
    ],
  }));

  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates: [...listPublicResourceTemplates()],
  }));

  server.setRequestHandler(SubscribeRequestSchema, async () => ({}));
  server.setRequestHandler(UnsubscribeRequestSchema, async () => ({}));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    const scope = scopeResolver(resolveCurrentSessionId());
    if (uri === SESSION_CAPABILITIES_URI) {
      const sessionId = resolveCurrentSessionId();
      const profile = sessionId ? sessionRegistry.get(sessionId) : undefined;
      const payload = renderCapabilitiesPayload(profile);
      logger.debug({ uri, sessionId, hasProfile: !!profile }, "session capabilities resource read");
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(payload, null, 2) }],
      };
    }
    if (uri === SESSION_PREFLIGHT_URI) {
      const payload = renderPreflightStub();
      logger.debug({ uri }, "session preflight resource read (stub)");
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(payload, null, 2) }],
      };
    }
    if (uri === "orchestrator://jobs/recent") {
      const recent = provisionJobs ? await provisionJobs.recent(scope) : [];
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(recent, null, 2) }],
      };
    }
    if (uri.startsWith("orchestrator://job/")) {
      const id = uri.slice("orchestrator://job/".length);
      const job = provisionJobs ? await provisionJobs.get(scope, id) : undefined;
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(job ?? { status: "not_found", id }, null, 2) }],
      };
    }
    const parsed = parsePublicResourceUri(uri);
    if (parsed) {
      const payload = await renderPublicResourcePayload({
        scope,
        parsed,
        ...(projectRepository ? { projectRepository } : {}),
        ...(contextPacks ? { contextPacks } : {}),
        ...(readiness ? { readiness } : {}),
        ...(traceLinks ? { traceLinks } : {}),
      });
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(payload, null, 2) }],
      };
    }
    throw new Error(`unknown resource uri: ${uri}`);
  });
}

function renderCapabilitiesPayload(profile: McpSessionProfile | undefined): Record<string, unknown> {
  if (!profile) {
    return {
      status: "no_session",
      reason: "no MCP session has been initialized in the current request context",
    };
  }
  return {
    status: "active",
    sessionId: profile.sessionId,
    negotiatedProtocolVersion: profile.negotiatedProtocolVersion,
    negotiatedAt: profile.negotiatedAt,
    clientInfo: profile.clientInfo,
    clientCapabilities: profile.clientCapabilities,
    serverCapabilities: profile.serverCapabilities,
    featuresEnabled: profile.featuresEnabled,
    featuresDisabled: profile.featuresDisabled,
  };
}

function renderPreflightStub(): Record<string, unknown> {
  return {
    status: "stub",
    milestone: "M0",
    note: "project_preflight_check lands in M2. This resource is exposed now so consumers can subscribe.",
    schemaVersion: 1,
  };
}

type PublicResource =
  | { readonly kind: "project"; readonly id: string; readonly view: "context" | "readiness" | "linked-artifacts" }
  | { readonly kind: "issue"; readonly id: string; readonly view: "context" | "handoff" | "acceptance-criteria" | "linked-artifacts" };

function parsePublicResourceUri(uri: string): PublicResource | undefined {
  const project = /^orchestrator:\/\/project\/([^/]+)\/(context|readiness|linked-artifacts)$/.exec(uri);
  if (project) {
    const id = decodeURIComponent(project[1] ?? "");
    const view = project[2];
    if (view === "context" || view === "readiness" || view === "linked-artifacts") {
      return { kind: "project", id, view };
    }
  }
  const issue = /^orchestrator:\/\/issue\/([^/]+)\/(context|handoff|acceptance-criteria|linked-artifacts)$/.exec(uri);
  if (issue) {
    const id = decodeURIComponent(issue[1] ?? "");
    const view = issue[2];
    if (view === "context" || view === "handoff" || view === "acceptance-criteria" || view === "linked-artifacts") {
      return { kind: "issue", id, view };
    }
  }
  return undefined;
}

async function renderPublicResourcePayload(args: {
  readonly scope: TenantScope;
  readonly parsed: PublicResource;
  readonly projectRepository?: ProjectRepository;
  readonly contextPacks?: ContextPackRepository;
  readonly readiness?: ReadinessRepository;
  readonly traceLinks?: TraceLinkRepository;
}): Promise<Record<string, unknown>> {
  if (args.parsed.kind === "project") {
    if (args.parsed.view === "readiness") {
      const report = args.readiness ? await args.readiness.findLatestForProject(args.scope, args.parsed.id) : undefined;
      return { resource: args.parsed, found: Boolean(report), readiness: report ?? null };
    }
    if (args.parsed.view === "linked-artifacts") {
      const links = args.traceLinks ? await args.traceLinks.findByProject(args.scope, args.parsed.id) : [];
      return { resource: args.parsed, linkedArtifacts: links };
    }
    const project = args.projectRepository ? await args.projectRepository.findById(args.scope, args.parsed.id) : undefined;
    const pack = args.contextPacks
      ? await args.contextPacks.findByRegenerationKey(args.scope, `${args.parsed.id}:project:${project?.blueprintVersion ?? 1}`)
      : undefined;
    return {
      resource: args.parsed,
      found: Boolean(project),
      contextPack: pack ?? null,
      project: project
        ? {
            id: project.id,
            key: project.key,
            name: project.name,
            state: project.state,
            blueprintVersion: project.blueprintVersion,
            goals: project.goals,
            acceptanceCriteria: project.requirements.flatMap((req) => req.acceptanceSignals),
          }
        : null,
    };
  }

  if (args.parsed.view === "linked-artifacts") {
    const links = args.traceLinks ? await args.traceLinks.findByTarget(args.scope, "jira_issue", args.parsed.id) : [];
    return { resource: args.parsed, linkedArtifacts: links };
  }
  if (args.parsed.view === "acceptance-criteria") {
    const story = args.projectRepository ? await findStoryByIssueLikeKey(args.projectRepository, args.scope, args.parsed.id) : undefined;
    return {
      resource: args.parsed,
      found: Boolean(story),
      acceptanceCriteria: story?.acceptanceCriteria ?? [],
      story: story ? { id: story.id, title: story.title } : null,
    };
  }
  if (args.parsed.view === "handoff") {
    return {
      resource: args.parsed,
      issueKey: args.parsed.id,
      contextPackUri: `orchestrator://issue/${encodeURIComponent(args.parsed.id)}/context`,
      status: "available_after_handoff_generate",
    };
  }
  return {
    resource: args.parsed,
    status: "not_found",
    note: "Generate an issue-scoped context pack with context_pack_generate before reading this URI.",
  };
}

async function findStoryByIssueLikeKey(
  projectRepository: ProjectRepository,
  scope: TenantScope,
  issueKey: string,
) {
  const projects = await projectRepository.list(scope);
  for (const project of projects) {
    for (const epic of project.epics) {
      const story = epic.stories.find((candidate) => candidate.id === issueKey || `${project.key}-${candidate.id}` === issueKey);
      if (story) return story;
    }
  }
  return undefined;
}
