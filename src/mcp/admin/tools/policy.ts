// admin.policy.decisions.list — operator policy/approvals view.
// v1 has no separate "pending approval inbox" state — every decision is
// stored as one record with effect=allow|deny|require_approval. This tool
// returns the most recent decisions across projects so the UI can show
// require_approval ones as a working inbox until a real pending-state lands.

import { z } from "zod";
import { defaultTenantScope } from "../../../domain/tenantScope.js";
import type { AdminToolDeps } from "../registry.js";
import type { ToolRegistry } from "../../toolRegistry.js";
import type { PolicyDecision } from "../../../domain/policyDecision.js";

const INPUT = z.object({
  effect: z.enum(["allow", "deny", "require_approval"]).optional(),
  projectId: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional(),
}).strict();

const DECISION = z.object({
  id: z.string(),
  projectId: z.string().optional(),
  toolName: z.string(),
  effect: z.enum(["allow", "deny", "require_approval"]),
  confidenceCategorical: z.string(),
  confidenceScore: z.number(),
  evaluatedAt: z.string(),
});

const OUTPUT = z.object({
  decisions: z.array(DECISION),
  totalReturned: z.number().int().nonnegative(),
});

function toReturned(d: PolicyDecision) {
  return {
    id: d.id,
    ...(d.projectId ? { projectId: d.projectId } : {}),
    toolName: d.toolName,
    effect: d.effect,
    confidenceCategorical: d.confidenceCategorical,
    confidenceScore: d.confidenceScore,
    evaluatedAt: d.evaluatedAt,
  };
}

export function registerPolicyAdminTools(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.policy.decisions.list",
      description: "Recent policy decisions across projects (filterable by effect / project / limit).",
      inputSchema: {
        type: "object",
        properties: {
          effect: { type: "string", enum: ["allow", "deny", "require_approval"] },
          projectId: { type: "string" },
          limit: { type: "number", minimum: 1, maximum: 500 },
        },
        additionalProperties: false,
      },
      annotations: { title: "Admin: policy decisions", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler(params) {
      const { effect, projectId, limit } = INPUT.parse(params ?? {});
      const scope = defaultTenantScope();
      const cap = limit ?? 50;

      const collected: PolicyDecision[] = [];
      if (projectId) {
        collected.push(...(await deps.repositories.policyDecision.listForProject(scope, projectId)));
      } else {
        const projects = await deps.repositories.project.list(scope);
        for (const p of projects) {
          collected.push(...(await deps.repositories.policyDecision.listForProject(scope, p.id)));
        }
      }
      let filtered = collected;
      if (effect) filtered = filtered.filter((d) => d.effect === effect);
      filtered.sort((a, b) => b.evaluatedAt.localeCompare(a.evaluatedAt));
      const slice = filtered.slice(0, cap);

      const output = OUTPUT.parse({ decisions: slice.map(toReturned), totalReturned: slice.length });
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  });
}
