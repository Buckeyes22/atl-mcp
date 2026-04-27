import { describe, expect, it } from "vitest";
import { createDisabledSamplingAdapter } from "../../src/mcp/sampling.js";
import { runAdversarialTriplet } from "../../src/review/adversarialTriplet.js";

describe("contract suite scaffold", () => {
  it("keeps contract tests wired into the default suite", async () => {
    const triplet = await runAdversarialTriplet({
      id: "plan",
      projectId: "project",
      blueprintVersion: 1,
      jiraProjectKey: "PCO",
      actorAttribution: {
        principalId: "user@example.com",
        fingerprint: "fingerprint",
        authMode: "api_token",
        jiraLabel: "atl-mcp",
        metadataBlock: "metadata",
      },
      actions: [],
      estimatedRequestCount: 0,
    }, { sampling: createDisabledSamplingAdapter("contract"), tier: "dev", now: () => "2026-04-25T00:00:00.000Z" });

    expect(triplet.verdict).toBe("FAIL");
    expect(triplet.critics.map((critic) => critic.name)).toEqual([
      "false_positive_filter",
      "missing_issues_finder",
      "context_validator",
    ]);
  });
});
