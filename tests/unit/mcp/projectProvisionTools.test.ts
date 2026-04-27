import { describe, expect, it } from "vitest";
import { createToolRegistry } from "../../../src/mcp/toolRegistry.js";
import { registerProjectProvisionTools } from "../../../src/mcp/tools/projectProvision.js";
import { defaultTenantScope } from "../../../src/domain/tenantScope.js";
import type { ArtifactPlan } from "../../../src/planning/artifactPlan.js";

const FROZEN = "2026-04-25T00:00:00.000Z";

describe("registerProjectProvisionTools", () => {
  it("rejects invalid execute plans before delegating to execution", async () => {
    const registry = createToolRegistry();
    let called = false;
    registerProjectProvisionTools({
      registry,
      resolveScope: defaultTenantScope,
      execute: async () => {
        called = true;
        return { jobId: "job", jobResourceUri: "orchestrator://provision/jobs/job" };
      },
    });

    const result = await registry.get("project_provision_execute")?.({
      plan: { id: "plan-1" },
      approved: true,
      approvalEvidence: {
        approvedBy: "reviewer@example.com",
        approvedAt: FROZEN,
        previewPlanId: "plan-1",
        projectProfileId: "profile-1",
      },
    });

    expect(called).toBe(false);
    expect(result?.isError).toBe(true);
    expect(result?.structuredContent).toMatchObject({ error: "invalid execute input" });
  });

  it("delegates valid execute input to the configured queue seam", async () => {
    const registry = createToolRegistry();
    let observedPlanId = "";
    registerProjectProvisionTools({
      registry,
      resolveScope: defaultTenantScope,
      execute: async (_, input) => {
        observedPlanId = input.plan.id;
        return { jobId: "plan-1", jobResourceUri: "orchestrator://provision/jobs/plan-1" };
      },
    });

    const result = await registry.get("project_provision_execute")?.({
      plan: plan(),
      approved: true,
      approvalEvidence: {
        approvedBy: "reviewer@example.com",
        approvedAt: FROZEN,
        previewPlanId: "plan-1",
        projectProfileId: "profile-1",
      },
    });

    expect(observedPlanId).toBe("plan-1");
    expect(result?.structuredContent).toEqual({
      jobId: "plan-1",
      jobResourceUri: "orchestrator://provision/jobs/plan-1",
    });
  });
});

function plan(): ArtifactPlan {
  return {
    id: "plan-1",
    projectId: "profile-1",
    blueprintVersion: 1,
    jiraProjectKey: "PCO",
    actorAttribution: {
      principalId: "reviewer@example.com",
      fingerprint: "fingerprint",
      authMode: "api_token",
      jiraLabel: "atl-mcp",
      metadataBlock: "metadata",
    },
    actions: [],
    estimatedRequestCount: 0,
    triplet: { verdict: "PASS", critics: [], synthesizedAt: FROZEN },
  };
}
