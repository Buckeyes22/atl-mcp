import { describe, expect, it } from "vitest";
import { createToolRegistry } from "../../../src/mcp/toolRegistry.js";
import { registerProjectIntakeTools } from "../../../src/mcp/tools/projectIntake.js";
import { createInMemoryProjectRepository } from "../workflows/inMemoryProjectRepository.js";
import { createIntakeWorkflow } from "../../../src/workflows/intakeWorkflow.js";
import { createBlueprintWorkflow } from "../../../src/workflows/blueprintWorkflow.js";
import { defaultTenantScope } from "../../../src/domain/tenantScope.js";

const FROZEN = "2026-04-25T00:00:00.000Z";

describe("registerProjectIntakeTools", () => {
  it("registers M4 intake and blueprint tools through the central registry", () => {
    const registry = createToolRegistry();
    const repo = createInMemoryProjectRepository();

    registerProjectIntakeTools({
      registry,
      resolveScope: defaultTenantScope,
      intakeWorkflow: createIntakeWorkflow({ projectRepository: repo, now: () => FROZEN }),
      blueprintWorkflow: createBlueprintWorkflow({ projectRepository: repo, now: () => FROZEN }),
    });

    expect(registry.list().map((tool) => tool.name)).toEqual([
      "project_intake_create",
      "project_blueprint_generate",
      "project_blueprint_update",
    ]);
  });

  it("creates intake and generates a blueprint via tool handlers", async () => {
    const registry = createToolRegistry();
    const repo = createInMemoryProjectRepository();
    registerProjectIntakeTools({
      registry,
      resolveScope: defaultTenantScope,
      intakeWorkflow: createIntakeWorkflow({ projectRepository: repo, now: () => FROZEN }),
      blueprintWorkflow: createBlueprintWorkflow({ projectRepository: repo, now: () => FROZEN }),
    });

    await registry.get("project_intake_create")?.({
      projectId: "proj-tool",
      name: "Tool Project",
      key: "TOOL",
      source: {
        kind: "raw_markdown",
        markdown: "# Tool Project\n\n## Goals\n- Ship\n\n## Requirements\n- must: User can export data. Acceptance: Export includes current account data.\n\n## Testing\n- UT: export mapper\n",
      },
    });
    const result = await registry.get("project_blueprint_generate")?.({
      projectId: "proj-tool",
      useSampling: false,
      temperature: 0,
    });

    expect(result?.structuredContent).toMatchObject({
      projectId: "proj-tool",
      state: "BLUEPRINT_READY",
      validation: { valid: true },
    });
  });
});
