// Unit test for blueprintReviseWorkflow.
// Uses a fake sampler that returns a canned JSON revision; asserts the
// proposed patch is parsed, critique notes round-trip, and the diff
// computes added/removed entries against the existing blueprint.

import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createBlueprintReviseWorkflow } from "../../../src/workflows/blueprintReviseWorkflow.js";
import { createVelocityContentRegistry } from "../../../src/velocity/contentRegistry.js";
import { emptyBlueprint, type ProjectBlueprint } from "../../../src/domain/projectBlueprint.js";
import { defaultTenantScope, type TenantScope } from "../../../src/domain/tenantScope.js";
import type { ProjectRepository } from "../../../src/storage/repositories/projectRepository.js";
import type { SamplingAdapter, SamplingRequest, SamplingResult } from "../../../src/mcp/sampling.js";

function fakeRepo(blueprint: ProjectBlueprint): ProjectRepository {
  return {
    async create(_scope: TenantScope, b: ProjectBlueprint) { return b; },
    async findById(_scope: TenantScope, id: string) { return id === blueprint.id ? blueprint : undefined; },
    async findByKey(_scope: TenantScope, key: string) { return key === blueprint.key ? blueprint : undefined; },
    async update(_scope: TenantScope, b: ProjectBlueprint) { return b; },
    async list() { return [blueprint]; },
  };
}

function fakeSampler(text: string): SamplingAdapter {
  return {
    async sample(_request: SamplingRequest): Promise<SamplingResult> {
      return { used: true, provider: "fake-host", text };
    },
  };
}

describe("blueprintReviseWorkflow.revise", () => {
  it("parses the model response and computes a diff against the existing blueprint", async () => {
    const id = randomUUID();
    const now = new Date().toISOString();
    const existing: ProjectBlueprint = {
      ...emptyBlueprint({ id, tenantId: "default", name: "Test", key: "TST" }, now),
      goals: ["Existing goal A", "Existing goal B"],
      requirements: [
        { id: "REQ-1", title: "OAuth login required", summary: "Operator-facing OAuth flow" },
        { id: "REQ-2", title: "Audit chain integrity", summary: "Tamper-evident logs" },
      ] as ProjectBlueprint["requirements"],
    };
    const sampler = fakeSampler(JSON.stringify({
      patch: {
        goals: ["Existing goal A"],  // dropped goal B
        requirements: [
          // dropped REQ-1 (the OAuth one), kept REQ-2, added REQ-3
          { id: "REQ-2", title: "Audit chain integrity", summary: "Tamper-evident logs" },
          { id: "REQ-3", title: "Magic-link login", summary: "Email-based passwordless flow" },
        ],
      },
      critiqueNotes: [
        "Removed OAuth requirement per the operator's request.",
        "Replaced with a magic-link auth path; consider session-rotation policy.",
      ],
    }));

    const workflow = createBlueprintReviseWorkflow({
      projectRepository: fakeRepo(existing),
      registry: createVelocityContentRegistry(),
      sampling: sampler,
    });

    const result = await workflow.revise(defaultTenantScope(), {
      projectId: id,
      revisionRequest: "remove the OAuth requirement and use magic-link instead",
    });

    expect(result.projectId).toBe(id);
    expect(result.critiqueNotes.length).toBe(2);
    expect(result.critiqueNotes[0]).toMatch(/OAuth/i);

    expect(result.proposedPatch.goals).toEqual(["Existing goal A"]);
    expect((result.proposedPatch.requirements as Array<{ id: string }>).map((r) => r.id)).toEqual(["REQ-2", "REQ-3"]);

    expect(result.diff.removed).toContain("goals: Existing goal B");
    expect(result.diff.removed).toContain("requirements: REQ-1");
    expect(result.diff.added).toContain("requirements: REQ-3");

    expect(result.sampling.used).toBe(true);
  });

  it("returns an explanatory critique note when sampling is disabled", async () => {
    const id = randomUUID();
    const now = new Date().toISOString();
    const existing: ProjectBlueprint = emptyBlueprint({ id, tenantId: "default", name: "Test", key: "TST2" }, now);

    const workflow = createBlueprintReviseWorkflow({
      projectRepository: fakeRepo(existing),
      registry: createVelocityContentRegistry(),
    });

    const result = await workflow.revise(defaultTenantScope(), {
      projectId: id,
      revisionRequest: "tighten scope by removing optional features",
      useSampling: false,
    });

    expect(result.proposedPatch).toEqual({});
    expect(result.critiqueNotes.length).toBeGreaterThan(0);
    expect(result.critiqueNotes[0]).toMatch(/sampling unavailable/i);
    expect(result.diff.added).toEqual([]);
    expect(result.diff.removed).toEqual([]);
  });

  it("reports changed object-array entries when ids stay the same", async () => {
    const id = randomUUID();
    const now = new Date().toISOString();
    const existing: ProjectBlueprint = {
      ...emptyBlueprint({ id, tenantId: "default", name: "Test", key: "TST3" }, now),
      requirements: [
        { id: "REQ-1", title: "OAuth login required", summary: "Operator-facing OAuth flow" },
      ] as ProjectBlueprint["requirements"],
    };
    const sampler = fakeSampler(JSON.stringify({
      patch: {
        requirements: [
          { id: "REQ-1", title: "Magic-link login required", summary: "Operator-facing passwordless flow" },
        ],
      },
      critiqueNotes: ["Changed the auth mechanism without changing the requirement id."],
    }));

    const workflow = createBlueprintReviseWorkflow({
      projectRepository: fakeRepo(existing),
      registry: createVelocityContentRegistry(),
      sampling: sampler,
    });

    const result = await workflow.revise(defaultTenantScope(), {
      projectId: id,
      revisionRequest: "switch OAuth to magic-link but keep the requirement id",
    });

    expect(result.diff.changed).toContain("requirements: REQ-1");
    expect(result.diff.added).toEqual([]);
    expect(result.diff.removed).toEqual([]);
  });

  it("does not accept wrapper-shaped sampled JSON as a bare patch", async () => {
    const id = randomUUID();
    const now = new Date().toISOString();
    const existing: ProjectBlueprint = emptyBlueprint({ id, tenantId: "default", name: "Test", key: "TST4" }, now);
    const sampler = fakeSampler(JSON.stringify({ proposedPatch: { goals: ["hidden wrapper"] }, notes: ["wrong shape"] }));

    const workflow = createBlueprintReviseWorkflow({
      projectRepository: fakeRepo(existing),
      registry: createVelocityContentRegistry(),
      sampling: sampler,
    });

    const result = await workflow.revise(defaultTenantScope(), {
      projectId: id,
      revisionRequest: "add goals",
    });

    expect(result.proposedPatch).toEqual({});
    expect(result.critiqueNotes.join(" ")).toMatch(/parse/i);
    expect(result.diff.added).toEqual([]);
    expect(result.diff.removed).toEqual([]);
    expect(result.diff.changed).toEqual([]);
  });
});
