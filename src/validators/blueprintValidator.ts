import { z } from "zod";
import type { ProjectBlueprint } from "../domain/projectBlueprint.js";

export type BlueprintValidationSeverity = "error" | "warning";

export interface BlueprintValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: BlueprintValidationSeverity;
}

export interface BlueprintValidationResult {
  readonly valid: boolean;
  readonly issues: readonly BlueprintValidationIssue[];
  readonly openQuestions: readonly string[];
}

const sourceRefSchema = z.object({
  kind: z.string(),
  id: z.string().min(1),
  excerpt: z.string().optional(),
});

const requirementSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  type: z.enum(["functional", "non_functional", "constraint", "assumption"]),
  priority: z.enum(["must", "should", "could", "wont"]),
  acceptanceSignals: z.array(z.string()),
  sourceRefs: z.array(sourceRefSchema),
});

const blueprintSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string().min(1),
  key: z.string().min(1),
  state: z.string().min(1),
  schemaVersion: z.number().int().positive(),
  blueprintVersion: z.number().int().positive(),
  goals: z.array(z.string()),
  nonGoals: z.array(z.string()),
  requirements: z.array(requirementSchema),
  openQuestions: z.array(z.object({ question: z.string().min(1) }).passthrough()),
  testingStrategy: z.object({
    categories: z.array(z.object({ category: z.string().min(1), applicable: z.boolean() }).passthrough()),
  }),
}).passthrough();

export function validateBlueprint(blueprint: ProjectBlueprint): BlueprintValidationResult {
  const issues: BlueprintValidationIssue[] = [];
  const openQuestions: string[] = [];
  const shape = blueprintSchema.safeParse(blueprint);
  if (!shape.success) {
    for (const issue of shape.error.issues) {
      issues.push({
        code: "blueprint.shape",
        message: `${issue.path.join(".")}: ${issue.message}`,
        severity: "error",
      });
    }
  }

  if (blueprint.goals.length === 0) {
    issues.push({ code: "goals.missing", message: "Blueprint must include at least one goal.", severity: "error" });
    openQuestions.push("What project outcome should this work optimize for?");
  }
  if (blueprint.requirements.length === 0) {
    issues.push({
      code: "requirements.missing",
      message: "Blueprint must include at least one requirement.",
      severity: "error",
    });
    openQuestions.push("What are the core functional requirements?");
  }
  const missingAcceptance = blueprint.requirements.filter((r) => r.acceptanceSignals.length === 0);
  if (missingAcceptance.length > 0) {
    issues.push({
      code: "requirements.acceptanceSignals.missing",
      message: "Each requirement must include at least one acceptance signal.",
      severity: "error",
    });
    openQuestions.push("What observable acceptance signal proves each requirement is satisfied?");
  }
  if (blueprint.testingStrategy.categories.filter((c) => c.applicable).length === 0) {
    issues.push({
      code: "testingStrategy.missing",
      message: "Blueprint must identify at least one applicable test category.",
      severity: "error",
    });
    openQuestions.push("Which test categories apply to this project?");
  }

  return { valid: issues.filter((i) => i.severity === "error").length === 0, issues, openQuestions };
}
