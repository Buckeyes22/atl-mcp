import { describe, expect, it } from "vitest";
import { createCodePolicyAdapter } from "../../../src/security/policyAdapters/codePolicyAdapter.js";
import { defaultTenantScope } from "../../../src/domain/tenantScope.js";

const adapter = createCodePolicyAdapter();
const scope = defaultTenantScope();

describe("codePolicyAdapter (M1 baseline)", () => {
  it("read_only intent → allow with high confidence", async () => {
    const decision = await adapter.decide(scope, { toolName: "context_get", intent: "read_only" });
    expect(decision.effect).toBe("allow");
    expect(decision.confidenceCategorical).toBe("high");
    expect(decision.obligations).toEqual([]);
  });

  it("preview intent → allow + require_preview + require_fresh_preflight", async () => {
    const decision = await adapter.decide(scope, { toolName: "project_provision_preview", intent: "preview" });
    expect(decision.effect).toBe("allow");
    const kinds = decision.obligations.map((o) => o.kind);
    expect(kinds).toContain("require_preview");
    expect(kinds).toContain("require_fresh_preflight");
  });

  it("mutate_internal intent → allow + require_tenant_scope", async () => {
    const decision = await adapter.decide(scope, { toolName: "project_intake_create", intent: "mutate_internal" });
    expect(decision.effect).toBe("allow");
    expect(decision.obligations.map((o) => o.kind)).toContain("require_tenant_scope");
  });

  it("mutate_external intent → require_approval (FM-12)", async () => {
    const decision = await adapter.decide(scope, { toolName: "project_provision_execute", intent: "mutate_external" });
    expect(decision.effect).toBe("require_approval");
    const kinds = decision.obligations.map((o) => o.kind);
    expect(kinds).toContain("require_human_approval");
    expect(kinds).toContain("require_preview");
    expect(kinds).toContain("require_access_gate_allow");
  });

  it("decisions carry a unique id and ISO timestamp", async () => {
    const a = await adapter.decide(scope, { toolName: "x", intent: "read_only" });
    const b = await adapter.decide(scope, { toolName: "x", intent: "read_only" });
    expect(a.id).not.toBe(b.id);
    expect(() => new Date(a.evaluatedAt).toISOString()).not.toThrow();
  });
});
