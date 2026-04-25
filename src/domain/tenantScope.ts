// TenantScope is the gate that every storage call must pass through.
// v1 is single-tenant by default ("default"), but the storage layer is
// tenant-aware from day one so multi-tenant SaaS (post-v1, v6 §7.3) is a
// drop-in and not a rewrite.

export interface TenantScope {
  readonly tenantId: string;
  /** Audit context: who initiated the call (optional, populated by middleware). */
  readonly principalId?: string;
}

export const DEFAULT_TENANT_ID = "default" as const;

export function defaultTenantScope(): TenantScope {
  return { tenantId: DEFAULT_TENANT_ID };
}

export function makeTenantScope(tenantId: string, principalId?: string): TenantScope {
  if (!tenantId || tenantId.trim().length === 0) {
    throw new Error("TenantScope.tenantId must be a non-empty string");
  }
  return principalId !== undefined
    ? { tenantId, principalId }
    : { tenantId };
}

/** Throws if a value is missing the tenantId column — defensive guard for repository methods. */
export function assertTenantMatches(scope: TenantScope, row: { tenantId: string }, kind: string): void {
  if (row.tenantId !== scope.tenantId) {
    throw new TenantScopeViolationError(
      `${kind} row tenantId=${row.tenantId} does not match scope tenantId=${scope.tenantId}`,
    );
  }
}

export class TenantScopeViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantScopeViolationError";
  }
}
