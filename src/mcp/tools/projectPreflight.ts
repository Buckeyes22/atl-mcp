// project_preflight_check + project_profile_get tools.
// Registers into the central ToolRegistry — buildServer wires the dispatcher.

import { z } from "zod";
import type { Logger } from "pino";
import { runPreflight, type PreflightDeps, type PreflightInput } from "../../preflight/preflightWorkflow.js";
import type { TenantScope } from "../../domain/tenantScope.js";
import type { ProjectProfile } from "../../domain/projectProfile.js";
import type { ToolRegistry } from "../toolRegistry.js";

const PREFLIGHT_INPUT = z.object({
  projectId: z.string().min(1),
  jiraProjectKeyOrId: z.string().min(1),
  confluenceSpaceKeyOrId: z.string().min(1),
  vcsWorkspace: z.string().optional(),
  vcsRepoSlug: z.string().optional(),
  ttlSeconds: z.number().int().positive().optional(),
});

const PROFILE_GET_INPUT = z.object({
  projectId: z.string().min(1),
  profileId: z.string().optional(),
});

export interface ProjectPreflightToolsDeps {
  readonly registry: ToolRegistry;
  readonly logger: Logger;
  readonly resolveScope: () => TenantScope;
  readonly buildPreflightDeps: (scope: TenantScope) => Promise<PreflightDeps>;
  readonly persistProfile: (scope: TenantScope, profile: ProjectProfile) => Promise<void>;
  readonly fetchLatestProfile: (scope: TenantScope, projectId: string) => Promise<ProjectProfile | undefined>;
}

export function registerProjectPreflightTools(deps: ProjectPreflightToolsDeps): void {
  const { registry, logger, resolveScope, buildPreflightDeps, persistProfile, fetchLatestProfile } = deps;

  registry.register({
    definition: {
      name: "project_preflight_check",
      description:
        "Discover Jira + Confluence + VCS + UIO partner capabilities for a project. " +
        "Persists the resulting ProjectProfile and returns its id + warnings.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string" },
          jiraProjectKeyOrId: { type: "string" },
          confluenceSpaceKeyOrId: { type: "string" },
          vcsWorkspace: { type: "string" },
          vcsRepoSlug: { type: "string" },
          ttlSeconds: { type: "number" },
        },
        required: ["projectId", "jiraProjectKeyOrId", "confluenceSpaceKeyOrId"],
        additionalProperties: false,
      },
      annotations: {
        title: "Project preflight check",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async handler(rawParams) {
      const params = PREFLIGHT_INPUT.parse(rawParams);
      const scope = resolveScope();
      const preflightDeps = await buildPreflightDeps(scope);
      const input: PreflightInput = {
        tenantId: scope.tenantId,
        projectId: params.projectId,
        jiraProjectKeyOrId: params.jiraProjectKeyOrId,
        confluenceSpaceKeyOrId: params.confluenceSpaceKeyOrId,
        ...(params.vcsWorkspace !== undefined ? { vcsWorkspace: params.vcsWorkspace } : {}),
        ...(params.vcsRepoSlug !== undefined ? { vcsRepoSlug: params.vcsRepoSlug } : {}),
        ...(params.ttlSeconds !== undefined ? { ttlSeconds: params.ttlSeconds } : {}),
      };
      const profile = await runPreflight(input, preflightDeps);
      await persistProfile(scope, profile);
      logger.info(
        { profileId: profile.id, projectId: profile.projectId, warningCount: profile.warnings.length },
        "preflight completed",
      );
      return {
        content: [{ type: "text", text: JSON.stringify({ profileId: profile.id, warnings: profile.warnings }, null, 2) }],
        structuredContent: { profileId: profile.id, warnings: profile.warnings },
      };
    },
  });

  registry.register({
    definition: {
      name: "project_profile_get",
      description: "Fetch the latest persisted ProjectProfile for a project.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string" },
          profileId: { type: "string" },
        },
        required: ["projectId"],
        additionalProperties: false,
      },
      annotations: {
        title: "Project profile get",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async handler(rawParams) {
      const params = PROFILE_GET_INPUT.parse(rawParams);
      const scope = resolveScope();
      const profile = await fetchLatestProfile(scope, params.projectId);
      if (!profile) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "no profile found for project" }, null, 2) }],
          structuredContent: { found: false },
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(profile, null, 2) }],
        structuredContent: { found: true, profile },
      };
    },
  });
}
