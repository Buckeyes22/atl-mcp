import { describe, expect, it } from "vitest";
import { emptyBlueprint } from "../../../src/domain/projectBlueprint.js";
import { validateBlueprint } from "../../../src/validators/blueprintValidator.js";

const FROZEN = "2026-04-25T00:00:00.000Z";

describe("validateBlueprint", () => {
  it("reports missing requirements as open-question validation findings", () => {
    const blueprint = emptyBlueprint(
      { id: "proj-1", tenantId: "default", name: "Billing Portal", key: "BP" },
      FROZEN,
    );

    const result = validateBlueprint(blueprint);

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({
      code: "requirements.missing",
      message: "Blueprint must include at least one requirement.",
      severity: "error",
    });
    expect(result.openQuestions).toContain("What are the core functional requirements?");
  });

  it("accepts a blueprint with goals, requirements, acceptance signals, and a test plan", () => {
    const blueprint = {
      ...emptyBlueprint({ id: "proj-2", tenantId: "default", name: "Ready", key: "RDY" }, FROZEN),
      goals: ["Reduce support handoffs"],
      requirements: [
        {
          id: "REQ-001",
          title: "Account owner can export invoice history",
          description: "Account owners need CSV exports for invoice history.",
          type: "functional" as const,
          priority: "must" as const,
          acceptanceSignals: ["CSV contains invoices for the selected date range"],
          sourceRefs: [{ kind: "blueprint_section" as const, id: "proj-2:intake" }],
        },
      ],
      testingStrategy: {
        categories: [
          { category: "UT" as const, applicable: true, toolingNotes: "vitest" },
          { category: "E2E" as const, applicable: true, toolingNotes: "fixture flow" },
        ],
      },
    };

    const result = validateBlueprint(blueprint);

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.openQuestions).toEqual([]);
  });
});
