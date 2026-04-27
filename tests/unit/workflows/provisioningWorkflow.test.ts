import { describe, expect, it } from "vitest";
import { createProvisioningWorkflow } from "../../../src/workflows/provisioningWorkflow.js";
import { createInMemoryProjectRepository } from "./inMemoryProjectRepository.js";
import { defaultTenantScope } from "../../../src/domain/tenantScope.js";
import { createCodePolicyAdapter } from "../../../src/security/policyAdapters/codePolicyAdapter.js";

const scope = defaultTenantScope();
const FROZEN = "2026-04-25T00:00:00.000Z";

describe("createProvisioningWorkflow", () => {
  it("previews Jira create actions with attribution, policy decisions, request count, and PASS triplet", async () => {
    const repo = createInMemoryProjectRepository();
    await repo.seedIntakeProject({
      id: "proj-plan",
      tenantId: scope.tenantId,
      name: "Planner",
      key: "PLN",
      rawMarkdown: "# Planner\n\n## Goals\n- Ship\n\n## Requirements\n- must: User can export data. Acceptance: Export includes account data.\n\n## Testing\n- UT: mapper\n",
      now: FROZEN,
    });
    const project = await repo.findById(scope, "proj-plan");
    await repo.update(scope, {
      ...project!,
      state: "BLUEPRINT_READY",
      goals: ["Ship"],
      requirements: [
        {
          id: "REQ-001",
          title: "User can export data",
          description: "User can export data.",
          type: "functional",
          priority: "must",
          acceptanceSignals: ["Export includes account data."],
          sourceRefs: [{ kind: "blueprint_section", id: "proj-plan:raw-intake" }],
        },
      ],
      epics: [
        {
          id: "EPIC-001",
          title: "Delivery",
          outcome: "Ship",
          stories: [
            {
              id: "STORY-001",
              title: "User can export data",
              userStory: "As a user, I can export data.",
              acceptanceCriteria: ["Export includes account data."],
              implementationNotes: [],
              testNotes: ["mapper"],
              contextRefs: [],
              dependencies: [],
              estimatedComplexity: "M",
            },
          ],
          confluenceRefs: [],
          dependencies: [],
        },
      ],
      testingStrategy: { categories: [{ category: "UT", applicable: true }] },
    });
    const workflow = createProvisioningWorkflow({
      projectRepository: repo,
      policy: createCodePolicyAdapter(),
      now: () => FROZEN,
    });

    const preview = await workflow.preview(scope, {
      projectId: "proj-plan",
      jiraProjectKey: "PLN",
      actorPrincipalId: "agent@example.com",
    });

    expect(preview.plan.actions.map((action) => action.target)).toEqual([
      "jira_issue",
      "confluence_page",
      "vcs_file",
      "vcs_pull_request",
    ]);
    expect(preview.plan.actions[0]).toMatchObject({
      action: "create",
      target: "jira_issue",
      issueType: "Story",
      summary: "User can export data",
    });
    expect(preview.plan.actorAttribution.jiraLabel).toMatch(/^orchestrator-actor-/);
    expect(preview.plan.estimatedRequestCount).toBe(4);
    expect(preview.triplet.verdict).toBe("PASS");
    expect(preview.plan.actions[0]?.policy.effect).toBe("allow");
    expect(preview.plan.actions[1]).toMatchObject({
      target: "confluence_page",
      title: "Planner - Delivery",
    });
    expect(preview.plan.actions[2]).toMatchObject({
      target: "vcs_file",
      path: "CONTEXT.md",
    });
    expect(preview.plan.actions[3]).toMatchObject({
      target: "vcs_pull_request",
      sourceBranch: "orchestrator/proj-plan-blueprint-v1",
      destinationBranch: "main",
    });
  });
});
