import { doublePrecision, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const policyDecisions = pgTable(
  "policy_decisions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id"),
    toolName: text("tool_name").notNull(),
    effect: text("effect").notNull(),
    confidenceCategorical: text("confidence_categorical").notNull(),
    confidenceScore: doublePrecision("confidence_score").notNull(),
    payload: jsonb("payload").notNull(),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("policy_decisions_tenant_idx").on(t.tenantId),
    tenantProjectIdx: index("policy_decisions_tenant_project_idx").on(t.tenantId, t.projectId),
  }),
);

export type PolicyDecisionRow = typeof policyDecisions.$inferSelect;
export type NewPolicyDecisionRow = typeof policyDecisions.$inferInsert;
