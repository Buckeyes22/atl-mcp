import { and, eq } from "drizzle-orm";
import type { Database } from "../db.js";
import { policyDecisions, type NewPolicyDecisionRow } from "../schema/policyDecisions.js";
import type { PolicyDecision } from "../../domain/policyDecision.js";
import type { TenantScope } from "../../domain/tenantScope.js";

export interface PolicyDecisionRepository {
  insert(scope: TenantScope, decision: PolicyDecision): Promise<PolicyDecision>;
  findById(scope: TenantScope, id: string): Promise<PolicyDecision | undefined>;
  listForProject(scope: TenantScope, projectId: string): Promise<readonly PolicyDecision[]>;
}

export function createPolicyDecisionRepository(db: Database): PolicyDecisionRepository {
  return {
    async insert(scope, decision) {
      if (decision.tenantId !== scope.tenantId) {
        throw new Error(`policyDecision.tenantId must match scope`);
      }
      const row: NewPolicyDecisionRow = {
        id: decision.id,
        tenantId: decision.tenantId,
        projectId: decision.projectId ?? null,
        toolName: decision.toolName,
        effect: decision.effect,
        confidenceCategorical: decision.confidenceCategorical,
        confidenceScore: decision.confidenceScore,
        payload: decision,
        evaluatedAt: new Date(decision.evaluatedAt),
      };
      await db.insert(policyDecisions).values(row);
      return decision;
    },

    async findById(scope, id) {
      const rows = await db
        .select()
        .from(policyDecisions)
        .where(and(eq(policyDecisions.tenantId, scope.tenantId), eq(policyDecisions.id, id)))
        .limit(1);
      const row = rows[0];
      return row ? (row.payload as PolicyDecision) : undefined;
    },

    async listForProject(scope, projectId) {
      const rows = await db
        .select()
        .from(policyDecisions)
        .where(
          and(
            eq(policyDecisions.tenantId, scope.tenantId),
            eq(policyDecisions.projectId, projectId),
          ),
        );
      return rows.map((r) => r.payload as PolicyDecision);
    },
  };
}
