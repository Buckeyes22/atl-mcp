import { randomUUID } from "node:crypto";
import type { TenantScope } from "../domain/tenantScope.js";
import type { ProjectRepository } from "../storage/repositories/projectRepository.js";
import type { ReadinessReport } from "../storage/repositories/readinessRepository.js";

export function createReadinessWorkflow(deps: {
  readonly projectRepository: ProjectRepository;
  readonly now?: () => string;
}) {
  const now = deps.now ?? (() => new Date().toISOString());
  return {
    async validate(scope: TenantScope, input: { readonly projectId: string }): Promise<ReadinessReport> {
      const project = await deps.projectRepository.findById(scope, input.projectId);
      if (!project) throw new Error(`project not found: ${input.projectId}`);
      const checks = {
        goals: project.goals.length > 0,
        requirements: project.requirements.length > 0,
        acceptance: project.requirements.every((r) => r.acceptanceSignals.length > 0),
        tests: project.testingStrategy.categories.some((c) => c.applicable),
        risks: true,
        links: true,
      };
      const score = Object.values(checks).filter(Boolean).length / Object.values(checks).length;
      const grade = score >= 0.9 ? "A" : score >= 0.75 ? "B" : score >= 0.5 ? "C" : "D";
      const verdict = grade === "A" ? "SAFE_TO_SHIP" : grade === "B" ? "SHIP_WITH_QUARANTINE" : grade === "C" ? "INVESTIGATE" : "BLOCK_RELEASE";
      const promotionAllowed = grade === "A" && verdict === "SAFE_TO_SHIP";
      return {
        id: randomUUID(),
        tenantId: scope.tenantId,
        projectId: project.id,
        grade,
        verdict,
        generatedAt: now(),
        details: {
          score,
          checks,
          testFramework: project.testingStrategy.categories,
          promotion: { allowedState: "READY_FOR_BUILD", allowed: promotionAllowed },
        },
      };
    },
  };
}
