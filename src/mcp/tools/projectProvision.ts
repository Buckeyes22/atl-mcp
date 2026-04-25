import { z } from "zod";
import type { ToolRegistry } from "../toolRegistry.js";
import type { TenantScope } from "../../domain/tenantScope.js";
import type { ArtifactPlan } from "../../planning/artifactPlan.js";
import { ARTIFACT_PLAN_SCHEMA } from "../../planning/artifactPlanSchema.js";
import type { ProvisionJobRepository } from "../../storage/repositories/provisionJobRepository.js";

const PREVIEW_INPUT = z.object({
  projectId: z.string().min(1),
  jiraProjectKey: z.string().min(1),
  confluenceSpaceId: z.string().min(1).optional(),
  vcsWorkspace: z.string().min(1).optional(),
  vcsRepoSlug: z.string().min(1).optional(),
  vcsBaseBranch: z.string().min(1).optional(),
  actorPrincipalId: z.string().min(1),
});
const EXECUTE_INPUT = z.object({
  plan: ARTIFACT_PLAN_SCHEMA,
  approved: z.boolean(),
  approvalEvidence: z.object({
    approvedBy: z.string().min(1),
    approvedAt: z.string().min(1),
    previewPlanId: z.string().min(1),
    projectProfileId: z.string().min(1),
  }),
});

export interface ProvisionToolsDeps {
  readonly registry: ToolRegistry;
  readonly resolveScope: () => TenantScope;
  readonly preview?: (scope: TenantScope, input: z.infer<typeof PREVIEW_INPUT>) => Promise<{ readonly plan: ArtifactPlan; readonly triplet: NonNullable<ArtifactPlan["triplet"]> }>;
  readonly execute?: (scope: TenantScope, input: { readonly plan: ArtifactPlan; readonly approved: boolean; readonly approvalEvidence: z.infer<typeof EXECUTE_INPUT>["approvalEvidence"] }) => Promise<{ readonly jobId: string; readonly jobResourceUri: string }>;
  /** Persistent job state (F-011). When omitted, executions still run but job state is not durable. */
  readonly provisionJobs?: ProvisionJobRepository;
}

export function registerProjectProvisionTools(deps: ProvisionToolsDeps): void {
  if (deps.preview) {
    const previewFn = deps.preview;
    deps.registry.register({
      definition: {
        name: "project_provision_preview",
        description: "Generate a dry-run plan for Jira provisioning. Performs no remote writes.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string" },
            jiraProjectKey: { type: "string" },
            confluenceSpaceId: { type: "string" },
            vcsWorkspace: { type: "string" },
            vcsRepoSlug: { type: "string" },
            vcsBaseBranch: { type: "string" },
            actorPrincipalId: { type: "string" },
          },
          required: ["projectId", "jiraProjectKey", "actorPrincipalId"],
          additionalProperties: false,
        },
        annotations: { title: "Project provision preview", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async handler(raw) {
        const params = PREVIEW_INPUT.parse(raw);
        const result = await previewFn(deps.resolveScope(), params);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result };
      },
    });
  }

  if (deps.execute) {
    const executeFn = deps.execute;
    deps.registry.register({
      definition: {
        name: "project_provision_execute",
        description: "Execute an approved Jira-only provisioning plan and expose job state as an MCP resource.",
        inputSchema: {
          type: "object",
          properties: {
            plan: { type: "object" },
            approved: { type: "boolean" },
            approvalEvidence: {
              type: "object",
              properties: {
                approvedBy: { type: "string" },
                approvedAt: { type: "string" },
                previewPlanId: { type: "string" },
                projectProfileId: { type: "string" },
              },
              required: ["approvedBy", "approvedAt", "previewPlanId", "projectProfileId"],
              additionalProperties: false,
            },
          },
          required: ["plan", "approved", "approvalEvidence"],
          additionalProperties: false,
        },
        annotations: { title: "Project provision execute", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
      },
      async handler(raw) {
        const parsed = EXECUTE_INPUT.safeParse(raw);
        if (!parsed.success) {
          return {
            isError: true,
            content: [{ type: "text", text: JSON.stringify({ error: "invalid execute input", issues: parsed.error.issues }, null, 2) }],
            structuredContent: { error: "invalid execute input", issues: parsed.error.issues },
          };
        }
        const params = parsed.data;
        const plan = params.plan as ArtifactPlan;
        const scope = deps.resolveScope();
        try {
          const output = await executeFn(scope, { plan, approved: params.approved, approvalEvidence: params.approvalEvidence });
          return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            isError: true,
            content: [{ type: "text", text: JSON.stringify({ error: message }, null, 2) }],
            structuredContent: { error: message },
          };
        }
      },
    });
  }
}
