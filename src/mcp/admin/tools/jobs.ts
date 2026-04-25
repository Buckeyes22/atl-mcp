// admin.jobs.list — recent provisioning jobs across all projects.
// Reads from provisionJobRepository.recent (DB-backed; mirrors BullMQ state for v1
// per F-011 interim). When BullMQ state diverges (e.g., job was canceled in
// Redis but DB is stale), we surface the DB state — which is the system of
// record per the audit-remediation plan.

import { z } from "zod";
import { defaultTenantScope } from "../../../domain/tenantScope.js";
import type { AdminToolDeps } from "../registry.js";
import type { ToolRegistry } from "../../toolRegistry.js";

const INPUT = z.object({
  limit: z.number().int().min(1).max(500).optional(),
  projectId: z.string().optional(),
}).strict();

const JOB = z.object({
  id: z.string(),
  projectId: z.string(),
  status: z.enum(["queued", "running", "completed", "failed"]),
  queuedAt: z.string(),
  updatedAt: z.string(),
  error: z.string().optional(),
});

const OUTPUT = z.object({
  jobs: z.array(JOB),
  totalReturned: z.number().int().nonnegative(),
});

export function registerJobsAdminTool(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.jobs.list",
      description: "List recent provisioning jobs (DB-backed snapshot, F-011 interim).",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", minimum: 1, maximum: 500 },
          projectId: { type: "string" },
        },
        additionalProperties: false,
      },
      annotations: { title: "Admin: list jobs", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler(params) {
      const { limit, projectId } = INPUT.parse(params ?? {});
      const scope = defaultTenantScope();
      let rows = await deps.repositories.provisionJob.recent(scope, limit ?? 50);
      if (projectId) rows = rows.filter((r) => r.projectId === projectId);
      const jobs = rows.map((r) => ({
        id: r.id,
        projectId: r.projectId,
        status: r.status,
        queuedAt: r.queuedAt,
        updatedAt: r.updatedAt,
        ...(r.error ? { error: r.error } : {}),
      }));
      const output = OUTPUT.parse({ jobs, totalReturned: jobs.length });
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  });
}
