import { describe, expect, it } from "vitest";
import {
  assertTenantMatches,
  defaultTenantScope,
  DEFAULT_TENANT_ID,
  makeTenantScope,
  TenantScopeViolationError,
} from "../../../src/domain/tenantScope.js";

describe("TenantScope helpers", () => {
  it("defaultTenantScope returns DEFAULT_TENANT_ID", () => {
    expect(defaultTenantScope().tenantId).toBe(DEFAULT_TENANT_ID);
  });

  it("makeTenantScope rejects empty / whitespace tenantId", () => {
    expect(() => makeTenantScope("")).toThrow();
    expect(() => makeTenantScope("   ")).toThrow();
  });

  it("makeTenantScope optionally carries principalId", () => {
    expect(makeTenantScope("t1").principalId).toBeUndefined();
    expect(makeTenantScope("t1", "p1").principalId).toBe("p1");
  });

  it("assertTenantMatches passes on equal tenantId", () => {
    expect(() =>
      assertTenantMatches({ tenantId: "default" }, { tenantId: "default" }, "test"),
    ).not.toThrow();
  });

  it("assertTenantMatches throws TenantScopeViolationError on mismatch", () => {
    expect(() =>
      assertTenantMatches({ tenantId: "a" }, { tenantId: "b" }, "test"),
    ).toThrow(TenantScopeViolationError);
  });
});
