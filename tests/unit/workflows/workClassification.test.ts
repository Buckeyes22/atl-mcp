import { describe, expect, it } from "vitest";
import { classifyWorkItem, recommendAgentsForWork } from "../../../src/workflows/workClassification.js";

describe("workClassification", () => {
  it("classifies UI stories as frontend work with actionable skill tags", () => {
    const result = classifyWorkItem({
      workRef: { kind: "blueprint_story", id: "STORY-UI" },
      title: "Build role-specific React project form",
      description: "Create the responsive page layout, validation states, and CSS for uploaded briefs.",
      acceptanceCriteria: ["form works on mobile", "CSS has no horizontal overflow"],
    });

    expect(result.workType).toBe("frontend");
    expect(result.skillTags).toEqual(expect.arrayContaining(["react", "css", "form"]));
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("classifies provider stories as integration work", () => {
    const result = classifyWorkItem({
      workRef: { kind: "jira_issue", id: "PCO-42" },
      title: "Wire Jira and Confluence provisioning preview",
      description: "Call Atlassian provider APIs and preserve idempotency keys.",
      acceptanceCriteria: ["Jira preview returns epics and stories"],
    });

    expect(result.workType).toBe("integration");
    expect(result.skillTags).toEqual(expect.arrayContaining(["jira", "confluence", "api"]));
  });

  it("ranks matching live agents before generic profiles", () => {
    const classification = classifyWorkItem({
      workRef: { kind: "blueprint_story", id: "STORY-API" },
      title: "Add backend repository and admin API",
      description: "Implement database schema, repository methods, and admin MCP tool handlers.",
      acceptanceCriteria: ["integration tests pass"],
    });

    const recommendations = recommendAgentsForWork({
      classification,
      sessions: [
        {
          sessionId: "live-backend",
          clientName: "codex-backend",
          clientVersion: "1.0.0",
          featuresEnabled: ["sampling", "tools"],
          featuresDisabled: [],
          protocolVersion: "2024-11-05",
          negotiatedAt: "2026-04-27T00:00:00.000Z",
        },
      ],
      profiles: [
        {
          id: "profile-docs",
          tenantId: "default",
          protocolVersion: "2024-11-05",
          clientInfo: { name: "docs-agent" },
          clientCapabilities: { roots: true, sampling: false, elicitation: false, tasks: false },
          enabledServerFeatures: [],
          disabledFeatureReasons: {},
          agentMode: "worker",
          createdAt: "2026-04-27T00:00:00.000Z",
          lastSeenAt: "2026-04-27T00:00:00.000Z",
        },
      ],
    });

    expect(recommendations[0]?.agentId).toBe("live-backend");
    expect(recommendations[0]?.score).toBeGreaterThan(recommendations[1]?.score ?? 0);
  });
});
