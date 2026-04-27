import { describe, expect, it } from "vitest";
import { createIntakeWorkflow } from "../../../src/workflows/intakeWorkflow.js";
import { createInMemoryProjectRepository } from "./inMemoryProjectRepository.js";
import { defaultTenantScope } from "../../../src/domain/tenantScope.js";
import type { UioAdapter } from "../../../src/providers/uio/uioMcpAdapter.js";

const FROZEN = "2026-04-25T00:00:00.000Z";
const scope = defaultTenantScope();

describe("createIntakeWorkflow", () => {
  it("persists raw markdown intake with a deterministic source pin", async () => {
    const repo = createInMemoryProjectRepository();
    const workflow = createIntakeWorkflow({ projectRepository: repo, now: () => FROZEN });

    const result = await workflow.create(scope, {
      projectId: "proj-raw",
      name: "Raw Intake",
      key: "RAW",
      source: { kind: "raw_markdown", markdown: "# Raw Intake\n\n## Requirements\n- must: Ship it" },
    });

    expect(result.blueprint.state).toBe("DRAFT_INTAKE");
    expect(result.blueprint.intake?.source.kind).toBe("raw_markdown");
    expect(result.blueprint.sourcePins).toEqual([
      expect.objectContaining({
        artifactRef: { kind: "blueprint_section", id: "proj-raw:raw-intake" },
        version: "sha256:21c4af07c74795619db8bb8b95b04d650aa110f1fa54224f01f37b6aa7556fcd",
        pinnedAt: FROZEN,
      }),
    ]);
  });

  it("pins UIO source id and chunk indices without fetching vectors", async () => {
    const repo = createInMemoryProjectRepository();
    const calls: string[] = [];
    const uio: UioAdapter = {
      enabled: true,
      async probe() {
        return undefined;
      },
      async getCatalogEntry(sourceId) {
        calls.push(`catalog:${sourceId}`);
        return { sourceId, title: "Imported PRD", version: "v1" };
      },
      async ingest() {
        throw new Error("not expected");
      },
      async status() {
        throw new Error("not expected");
      },
    };
    const workflow = createIntakeWorkflow({ projectRepository: repo, uio, now: () => FROZEN });

    const result = await workflow.create(scope, {
      projectId: "proj-uio",
      name: "UIO Intake",
      key: "UIO",
      source: { kind: "uio_document", uioSourceId: "SRC-1", uioChunkIndices: [0, 2] },
    });

    expect(calls).toEqual(["catalog:SRC-1"]);
    expect(result.blueprint.intake?.source.kind).toBe("uio_document");
    expect(result.blueprint.sourcePins[0]).toEqual(
      expect.objectContaining({
        artifactRef: { kind: "uio_source", id: "SRC-1" },
        uioSourceId: "SRC-1",
        uioChunkIndices: [0, 2],
      }),
    );
  });
});
