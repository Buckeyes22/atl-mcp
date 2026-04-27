import { describe, expect, it } from "vitest";
import { emptyBlueprint } from "../../../src/domain/projectBlueprint.js";
import { scoreProjectContentQuality } from "../../../src/workflows/contentQualityScorer.js";

const FROZEN = "2026-04-27T00:00:00.000Z";

describe("contentQualityScorer", () => {
  it("scores grounded, actionable project content highly", () => {
    const blueprint = {
      ...emptyBlueprint({ id: "proj-good", tenantId: "default", name: "Good", key: "GOOD" }, FROZEN),
      goals: ["Ship a reliable requirements assistant"],
      requirements: [
        {
          id: "REQ-001",
          title: "PM can generate requirements",
          description: "Generate normalized requirements from pasted briefs.",
          type: "functional" as const,
          priority: "must" as const,
          acceptanceSignals: ["Jira preview includes generated stories"],
          sourceRefs: [{ kind: "blueprint_section" as const, id: "proj-good:raw-intake" }],
        },
      ],
      epics: [
        {
          id: "EPIC-1",
          title: "Assist",
          outcome: "PM can produce previewable Jira work",
          stories: [
            {
              id: "STORY-1",
              title: "Create preview",
              userStory: "As a PM I can preview Jira work before creation.",
              acceptanceCriteria: ["Preview includes epics and stories"],
              implementationNotes: [],
              testNotes: [],
              contextRefs: [],
              dependencies: [],
              estimatedComplexity: "M" as const,
            },
          ],
          confluenceRefs: [],
          dependencies: [],
        },
      ],
      sourcePins: [
        {
          artifactRef: { kind: "blueprint_section" as const, id: "proj-good:raw-intake" },
          version: "sha256:abc",
          contentChecksum: "abc",
          pinnedAt: FROZEN,
        },
      ],
    };

    const result = scoreProjectContentQuality({ project: blueprint, now: () => FROZEN });

    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.grade).toBe("A");
    expect(result.findings.map((finding) => finding.id)).toEqual(expect.arrayContaining(["completeness", "traceability", "actionability"]));
  });

  it("flags incomplete and ungrounded project content", () => {
    const blueprint = emptyBlueprint({ id: "proj-thin", tenantId: "default", name: "Thin", key: "THIN" }, FROZEN);

    const result = scoreProjectContentQuality({ project: blueprint, now: () => FROZEN });

    expect(result.score).toBeLessThan(60);
    expect(result.grade).toBe("D");
    expect(result.findings.find((finding) => finding.id === "completeness")?.status).toBe("fail");
    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});
