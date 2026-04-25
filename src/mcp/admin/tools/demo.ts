import { z } from "zod";
import { seedControlPlaneDemo } from "../../../demo/controlPlaneDemoSeed.js";
import type { AdminToolDeps } from "../registry.js";
import type { ToolRegistry } from "../../toolRegistry.js";

const INPUT = z.object({
  mode: z.enum(["auto", "jira", "sample"]).optional(),
  maxProjects: z.number().int().min(1).max(25).optional(),
  operatorBadge: z.string().optional(),
}).strict();

const OUTPUT = z.object({
  source: z.enum(["jira", "sample"]),
  projectsCreated: z.number().int().nonnegative(),
  projectsUpdated: z.number().int().nonnegative(),
  jobsUpserted: z.number().int().nonnegative(),
  auditEntriesAppended: z.number().int().nonnegative(),
  projectKeys: z.array(z.string()),
  dataLimited: z.object({ reason: z.string() }).optional(),
});

export function registerDemoAdminTools(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.demo.seed",
      description: "Seed the operator control plane with integrated Jira-style projects. Uses live Jira project names when configured, otherwise loads sample integrated projects.",
      inputSchema: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["auto", "jira", "sample"] },
          maxProjects: { type: "number", minimum: 1, maximum: 25 },
          operatorBadge: { type: "string" },
        },
        additionalProperties: false,
      },
      annotations: { title: "Admin: seed demo projects", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async handler(params) {
      const input = INPUT.parse(params ?? {});
      const result = await seedControlPlaneDemo(deps, {
        ...(input.mode ? { mode: input.mode } : {}),
        ...(input.maxProjects !== undefined ? { maxProjects: input.maxProjects } : {}),
        ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
      });
      const output = OUTPUT.parse(result);
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  });
}
