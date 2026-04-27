import { describe, expect, it } from "vitest";
import { emptyBlueprint } from "../../../src/domain/projectBlueprint.js";
import { emptyBudget } from "../../../src/domain/tokenBudget.js";
import type { ContextPack } from "../../../src/domain/contextPack.js";

const FROZEN_TS = "2026-04-25T00:00:00.000Z";

describe("ProjectBlueprint serialization (snapshot)", () => {
  it("emptyBlueprint produces a stable shape", () => {
    const blueprint = emptyBlueprint(
      { id: "proj-1", tenantId: "default", name: "Smoke", key: "PCO" },
      FROZEN_TS,
    );
    expect(blueprint).toMatchSnapshot();
  });

  it("emptyBlueprint with goals + nonGoals carries them through", () => {
    const blueprint = emptyBlueprint(
      {
        id: "proj-2",
        tenantId: "default",
        name: "With Goals",
        key: "WG",
        goals: ["ship m1", "ship m2"],
        nonGoals: ["multi-tenant in v1"],
      },
      FROZEN_TS,
    );
    expect(blueprint.goals).toEqual(["ship m1", "ship m2"]);
    expect(blueprint.nonGoals).toEqual(["multi-tenant in v1"]);
    expect(blueprint).toMatchSnapshot();
  });

  it("JSON.stringify round-trip preserves blueprint structure", () => {
    const blueprint = emptyBlueprint(
      { id: "proj-3", tenantId: "default", name: "Round Trip", key: "RT" },
      FROZEN_TS,
    );
    const round = JSON.parse(JSON.stringify(blueprint));
    expect(round).toEqual(blueprint);
  });
});

describe("ContextPack serialization (snapshot)", () => {
  it("a minimal pack matches snapshot", () => {
    const pack: ContextPack = {
      id: "pack-1",
      tenantId: "default",
      projectId: "proj-1",
      issueKey: "PCO-1",
      title: "Smoke pack",
      summary: "A minimal pack for snapshot testing",
      goals: ["one"],
      nonGoals: [],
      acceptanceCriteria: ["passes test"],
      implementationPlan: ["write code"],
      testPlan: ["assert"],
      linkedArtifacts: [
        { kind: "jira_issue", id: "PCO-1" },
      ],
      relevantFiles: [{ path: "src/server.ts" }],
      risks: [],
      openQuestions: [],
      tokenBudget: emptyBudget("claude-sonnet-4-6", 8000),
      sourcePins: [],
      generatedAt: FROZEN_TS,
      regenerationKey: "rk-001",
      freshness: "current",
      accessDecision: "allowed",
    };
    expect(pack).toMatchSnapshot();
    // Round-trip
    expect(JSON.parse(JSON.stringify(pack))).toEqual(pack);
  });
});
