// F-006 closure tests: real adversarial triplet via host-delegated sampling
// + deterministic fallback that fails closed in non-dev tiers.

import { describe, expect, it } from "vitest";
import { runAdversarialTriplet } from "../../../src/review/adversarialTriplet.js";
import type { ArtifactPlan } from "../../../src/planning/artifactPlan.js";
import type { SamplingAdapter, SamplingRequest, SamplingResult } from "../../../src/mcp/sampling.js";

const FROZEN = "2026-04-25T00:00:00.000Z";

function basePlan(): ArtifactPlan {
  return {
    id: "plan-1",
    projectId: "proj-1",
    blueprintVersion: 1,
    jiraProjectKey: "PLN",
    actorAttribution: {
      principalId: "agent@example.com",
      fingerprint: "abc",
      authMode: "api_token",
      jiraLabel: "orchestrator-actor-abc",
      metadataBlock: "<!-- -->",
    },
    actions: [
      {
        id: "act-1",
        action: "create",
        target: "jira_issue",
        blueprintRef: { kind: "blueprint_section", id: "STORY-001" },
        issueType: "Story",
        summary: "User can export",
        description: ["desc"],
        labels: [],
        idempotencyKey: "proj-1:STORY-001",
        policy: {
          id: "pd-1",
          tenantId: "default",
          projectId: "proj-1",
          toolName: "project_provision_preview",
          effect: "allow",
          reasons: [],
          obligations: [],
          evaluatedAt: FROZEN,
          confidenceCategorical: "high",
          confidenceScore: 1,
          checks: [],
        },
      },
    ],
    estimatedRequestCount: 1,
  };
}

function staticSampler(answers: Record<string, SamplingResult>): SamplingAdapter {
  return {
    async sample(req: SamplingRequest): Promise<SamplingResult> {
      const key = req.trace.promptVersion;
      return answers[key] ?? { used: false, reason: "no answer registered" };
    },
  };
}

const passResponse: SamplingResult = { used: true, provider: "test", text: '{"pass": true, "findings": []}' };
const failResponse: SamplingResult = {
  used: true,
  provider: "test",
  text: '{"pass": false, "findings": ["concrete issue"]}',
};

describe("runAdversarialTriplet — F-006", () => {
  it("PASS when all 3 LLM critics pass and synthesizer says PASS", async () => {
    const sampling = staticSampler({
      "triplet-false_positive_filter.v1": passResponse,
      "triplet-missing_issues_finder.v1": passResponse,
      "triplet-context_validator.v1": passResponse,
      "triplet-synthesizer.v1": { used: true, provider: "test", text: "All clear.\nPASS" },
    });
    const result = await runAdversarialTriplet(basePlan(), { sampling, tier: "production", now: () => FROZEN });
    expect(result.verdict).toBe("PASS");
    expect(result.critics).toHaveLength(3);
  });

  it("FAIL when any critic fails, even if synthesizer says PASS", async () => {
    const sampling = staticSampler({
      "triplet-false_positive_filter.v1": passResponse,
      "triplet-missing_issues_finder.v1": failResponse,
      "triplet-context_validator.v1": passResponse,
      "triplet-synthesizer.v1": { used: true, provider: "test", text: "PASS" },
    });
    const result = await runAdversarialTriplet(basePlan(), { sampling, tier: "production", now: () => FROZEN });
    expect(result.verdict).toBe("FAIL");
  });

  it("fail-closed in production tier when sampling is unavailable", async () => {
    const sampling = staticSampler({});
    const result = await runAdversarialTriplet(basePlan(), { sampling, tier: "production", now: () => FROZEN });
    expect(result.verdict).toBe("FAIL");
  });

  it("dev tier: deterministic critics PASS for a well-formed plan when sampling unavailable", async () => {
    const sampling = staticSampler({});
    const result = await runAdversarialTriplet(basePlan(), { sampling, tier: "dev", now: () => FROZEN });
    expect(result.verdict).toBe("PASS");
  });

  it("dev tier: deterministic critics FAIL when an action lacks blueprintRef", async () => {
    const sampling = staticSampler({});
    const plan = basePlan();
    const broken: ArtifactPlan = {
      ...plan,
      actions: plan.actions.map((a) => ({ ...a, blueprintRef: { kind: "blueprint_section" as const, id: "" } })),
    };
    const result = await runAdversarialTriplet(broken, { sampling, tier: "dev", now: () => FROZEN });
    expect(result.verdict).toBe("FAIL");
  });
});
