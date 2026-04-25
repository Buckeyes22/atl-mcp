// admin.atlassian.projects.list / admin.projects.adopt — surface the operator's
// Atlassian Cloud project inventory and let them ADOPT an existing Cloud
// project into atl-mcp's lifecycle (writing a ProjectBlueprint with
// state=PROVISIONED + atlassianProjectKey set).

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { defaultTenantScope } from "../../../domain/tenantScope.js";
import { emptyBlueprint, type ProjectBlueprint } from "../../../domain/projectBlueprint.js";
import { appendOperatorAudit } from "../auditedWrite.js";
import type { AdminToolDeps } from "../registry.js";
import type { ToolRegistry } from "../../toolRegistry.js";

// ───── admin.atlassian.projects.list ─────

const ATL_LIST_INPUT = z.object({
  maxResults: z.number().int().min(1).max(100).optional(),
}).strict();

const ATL_LIST_OUTPUT = z.object({
  projects: z.array(z.object({
    id: z.string(),
    key: z.string(),
    name: z.string(),
    projectTypeKey: z.string().optional(),
    style: z.string().optional(),
    leadDisplayName: z.string().optional(),
    adoptedBlueprintId: z.string().optional(),
  })),
  source: z.string(),
  dataLimited: z.object({ reason: z.string() }).optional(),
});

function registerAtlassianProjectsList(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.atlassian.projects.list",
      description: "List Jira projects in the connected Atlassian Cloud (separate from atl-mcp's internal project lifecycle).",
      inputSchema: {
        type: "object",
        properties: { maxResults: { type: "number", minimum: 1, maximum: 100 } },
        additionalProperties: false,
      },
      annotations: { title: "Admin: Atlassian projects", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async handler(params) {
      const { maxResults } = ATL_LIST_INPUT.parse(params ?? {});
      if (!deps.providers.jira) {
        const output = ATL_LIST_OUTPUT.parse({
          projects: [],
          source: "jira not configured",
          dataLimited: { reason: "Jira provider is not configured (set ATLASSIAN_AUTH_MODE + JIRA_BASE_URL)" },
        });
        return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
      }
      const cloudProjects = await deps.providers.jira.listProjects(
        maxResults !== undefined ? { maxResults } : undefined,
      );

      // Cross-reference with adopted blueprints so the UI can show "already adopted" badges.
      const scope = defaultTenantScope();
      const blueprints = await deps.repositories.project.list(scope);
      const adoptedByKey = new Map<string, string>();
      for (const b of blueprints) {
        if (b.atlassianProjectKey) adoptedByKey.set(b.atlassianProjectKey, b.id);
      }

      const output = ATL_LIST_OUTPUT.parse({
        projects: cloudProjects.map((p) => ({
          id: p.id,
          key: p.key,
          name: p.name,
          ...(p.projectTypeKey ? { projectTypeKey: p.projectTypeKey } : {}),
          ...(p.style ? { style: p.style } : {}),
          ...(p.leadDisplayName ? { leadDisplayName: p.leadDisplayName } : {}),
          ...(adoptedByKey.has(p.key) ? { adoptedBlueprintId: adoptedByKey.get(p.key) } : {}),
        })),
        source: "jira /rest/api/3/project/search",
      });
      return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
    },
  });
}

// ───── admin.projects.adopt ─────

const ADOPT_INPUT = z.object({
  atlassianProjectKey: z.string().min(1),
  reason: z.string().min(4),
  operatorBadge: z.string().optional(),
}).strict();

const ADOPT_OUTPUT = z.object({
  ok: z.boolean(),
  blueprintId: z.string(),
  blueprintKey: z.string(),
  state: z.string(),
  auditEntryId: z.string(),
  alreadyAdopted: z.boolean(),
});

function registerProjectsAdopt(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.projects.adopt",
      description: "Adopt an existing Atlassian Cloud project into atl-mcp by creating a ProjectBlueprint with state=PROVISIONED and atlassianProjectKey set. Audit-logged.",
      inputSchema: {
        type: "object",
        properties: {
          atlassianProjectKey: { type: "string" },
          reason: { type: "string", minLength: 4 },
          operatorBadge: { type: "string" },
        },
        required: ["atlassianProjectKey", "reason"],
        additionalProperties: false,
      },
      annotations: { title: "Admin: adopt Atlassian project", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler(params) {
      const input = ADOPT_INPUT.parse(params);
      if (!deps.providers.jira) {
        throw new Error("Jira provider is not configured; cannot adopt");
      }
      const scope = defaultTenantScope();

      // Idempotent: if already adopted, return the existing blueprint info.
      const existing = await deps.repositories.project.list(scope);
      const already = existing.find((b) => b.atlassianProjectKey === input.atlassianProjectKey);
      if (already) {
        const audit = await appendOperatorAudit(deps, {
          tool: "admin.projects.adopt",
          input,
          projectId: already.id,
          ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
        });
        const output = ADOPT_OUTPUT.parse({
          ok: true,
          blueprintId: already.id,
          blueprintKey: already.key,
          state: already.state,
          auditEntryId: audit.id,
          alreadyAdopted: true,
        });
        return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
      }

      // Fetch the Cloud project name via listProjects. (discoverProjectCapabilities doesn't surface
      // the human-readable name today; using the search endpoint avoids extending that surface.)
      const cloud = await deps.providers.jira.listProjects({ maxResults: 100 });
      const match = cloud.find((p) => p.key === input.atlassianProjectKey);
      const displayName = match?.name ?? input.atlassianProjectKey;

      const now = new Date().toISOString();
      const seed: ProjectBlueprint = {
        ...emptyBlueprint(
          {
            id: randomUUID(),
            tenantId: scope.tenantId,
            name: displayName,
            key: input.atlassianProjectKey,
          },
          now,
        ),
        state: "PROVISIONED",
        atlassianProjectKey: input.atlassianProjectKey,
      };
      await deps.repositories.project.create(scope, seed);

      const audit = await appendOperatorAudit(deps, {
        tool: "admin.projects.adopt",
        input,
        projectId: seed.id,
        ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
      });

      const output = ADOPT_OUTPUT.parse({
        ok: true,
        blueprintId: seed.id,
        blueprintKey: seed.key,
        state: seed.state,
        auditEntryId: audit.id,
        alreadyAdopted: false,
      });
      return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
    },
  });
}

export function registerAtlassianAdminTools(deps: AdminToolDeps, registry: ToolRegistry): void {
  registerAtlassianProjectsList(deps, registry);
  registerProjectsAdopt(deps, registry);
}
