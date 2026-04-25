// Code-based PolicyDecisionLayer adapter (v6 §7.2 default for v1).
// No OPA/Rego/Cedar — just TypeScript rules. The interface boundary lets us
// swap to a policy engine post-v1 without touching workflow code (FM-7).
//
// M1 rules (intentionally minimal — richer rules land with later milestones):
//   - read_only            → allow with high confidence
//   - preview              → allow with require_preview obligation
//   - mutate_internal      → allow with require_tenant_scope obligation
//   - mutate_external      → require_approval (operator must explicitly authorize
//                            the first external write per session; M5 wires this
//                            into the provisioning preview flow)

import { randomUUID } from "node:crypto";
import {
  buildDecision,
  type PolicyDecisionLayer,
  type PolicyDecisionRequest,
} from "../policyDecisionLayer.js";
import type { PolicyDecision } from "../../domain/policyDecision.js";
import type { TenantScope } from "../../domain/tenantScope.js";

export function createCodePolicyAdapter(): PolicyDecisionLayer {
  return {
    async decide(scope: TenantScope, request: PolicyDecisionRequest): Promise<PolicyDecision> {
      const baseChecks = [
        { name: "tenant_scope_provided", checked: scope.tenantId.length > 0, confidence: 100 },
        { name: "tool_name_present", checked: request.toolName.length > 0, confidence: 100 },
      ];

      const id = randomUUID();
      const project = request.projectId !== undefined ? { projectId: request.projectId } : {};

      switch (request.intent) {
        case "read_only":
          return buildDecision({
            id,
            tenantId: scope.tenantId,
            ...project,
            toolName: request.toolName,
            effect: "allow",
            reasons: ["read_only intent allowed by code policy"],
            checks: [...baseChecks, { name: "read_only_intent", checked: true, confidence: 100 }],
          });

        case "preview":
          return buildDecision({
            id,
            tenantId: scope.tenantId,
            ...project,
            toolName: request.toolName,
            effect: "allow",
            reasons: ["preview intent allowed; downstream execute requires fresh preflight"],
            obligations: [
              { kind: "require_preview", message: "execute must be preceded by a successful preview" },
              { kind: "require_fresh_preflight", message: "ProjectProfile must not be stale" },
            ],
            checks: [...baseChecks, { name: "preview_intent", checked: true, confidence: 100 }],
          });

        case "mutate_internal":
          return buildDecision({
            id,
            tenantId: scope.tenantId,
            ...project,
            toolName: request.toolName,
            effect: "allow",
            reasons: ["internal mutation scoped to tenant"],
            obligations: [
              { kind: "require_tenant_scope", message: "all storage calls must carry TenantScope" },
            ],
            checks: [...baseChecks, { name: "internal_mutation", checked: true, confidence: 95 }],
          });

        case "mutate_external":
          return buildDecision({
            id,
            tenantId: scope.tenantId,
            ...project,
            toolName: request.toolName,
            effect: "require_approval",
            reasons: ["external mutation requires explicit human approval (FM-12)"],
            obligations: [
              { kind: "require_human_approval", message: "operator must approve first external write per session" },
              { kind: "require_preview", message: "execute must be preceded by a successful preview" },
              { kind: "require_access_gate_allow", message: "lethal trifecta + ACL gate must allow" },
            ],
            checks: [...baseChecks, { name: "external_mutation", checked: true, confidence: 90 }],
          });
      }
    },
  };
}
