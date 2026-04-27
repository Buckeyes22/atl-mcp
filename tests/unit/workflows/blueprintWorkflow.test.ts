import { describe, expect, it } from "vitest";
import { createBlueprintWorkflow } from "../../../src/workflows/blueprintWorkflow.js";
import { createInMemoryProjectRepository } from "./inMemoryProjectRepository.js";
import { defaultTenantScope } from "../../../src/domain/tenantScope.js";

const FROZEN = "2026-04-25T00:00:00.000Z";
const scope = defaultTenantScope();

const MARKDOWN = `# Billing Portal

## Goals
- Reduce support handoffs
- Give account owners self-service billing records

## Non-Goals
- Payment processing

## Stakeholders
- Finance Ops - approver - invoice accuracy

## Requirements
- must: Account owner can export invoice history. Acceptance: CSV contains invoices for the selected date range.
- should: Admin can resend failed invoice emails. Acceptance: Resend action records an audit event.

## Architecture
Use the existing customer portal and billing ledger API.

## Risks
- high: Ledger API rate limits could block bulk export. Mitigation: batch by month.

## Testing
- UT: parser and ledger range helpers
- E2E: export happy path

## Release
Pilot with Finance Ops before general availability.
`;

describe("createBlueprintWorkflow", () => {
  it("turns fixture markdown into a deterministic ProjectBlueprint", async () => {
    const repo = createInMemoryProjectRepository();
    await repo.seedIntakeProject({
      id: "proj-1",
      tenantId: scope.tenantId,
      name: "Billing Portal",
      key: "BP",
      rawMarkdown: MARKDOWN,
      now: FROZEN,
    });
    const workflow = createBlueprintWorkflow({ projectRepository: repo, now: () => FROZEN });

    const result = await workflow.generate(scope, {
      projectId: "proj-1",
      temperature: 0,
      useSampling: false,
    });

    expect(result.blueprint.state).toBe("BLUEPRINT_READY");
    expect(result.blueprint.goals).toEqual([
      "Reduce support handoffs",
      "Give account owners self-service billing records",
    ]);
    expect(result.blueprint.requirements).toHaveLength(2);
    expect(result.blueprint.requirements[0]?.acceptanceSignals).toEqual([
      "CSV contains invoices for the selected date range.",
    ]);
    expect(result.blueprint.epics[0]?.stories).toHaveLength(2);
    expect(result.validation.valid).toBe(true);
    expect(result.sampling.used).toBe(false);
    expect(result.blueprint).toMatchSnapshot();
  });

  it("adds open questions and keeps clarification state when markdown is incomplete", async () => {
    const repo = createInMemoryProjectRepository();
    await repo.seedIntakeProject({
      id: "proj-2",
      tenantId: scope.tenantId,
      name: "Incomplete",
      key: "INC",
      rawMarkdown: "# Incomplete\n\n## Goals\n- Improve onboarding\n",
      now: FROZEN,
    });
    const workflow = createBlueprintWorkflow({ projectRepository: repo, now: () => FROZEN });

    const result = await workflow.generate(scope, {
      projectId: "proj-2",
      temperature: 0,
      useSampling: false,
    });

    expect(result.blueprint.state).toBe("CLARIFICATION_NEEDED");
    expect(result.blueprint.openQuestions.map((q) => q.question)).toContain(
      "What are the core functional requirements?",
    );
    expect(result.validation.valid).toBe(false);
  });
});
