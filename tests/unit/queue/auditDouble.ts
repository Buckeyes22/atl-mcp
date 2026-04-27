import type { AuditEntry } from "../../../src/domain/auditEntry.js";
import type { TenantScope } from "../../../src/domain/tenantScope.js";
import type { AuditAppendInput, AuditRepository, ChainVerification } from "../../../src/storage/repositories/auditRepository.js";

export function createInMemoryAuditRepository(): AuditRepository {
  const entries: AuditEntry[] = [];
  return {
    async append(scope: TenantScope, input: AuditAppendInput): Promise<AuditEntry> {
      if (input.entry.tenantId !== scope.tenantId) throw new Error("tenant mismatch");
      const prevHash = input.entry.prevHash ?? "0";
      const entry = { ...input.entry, prevHash };
      entries.push(entry);
      return entry;
    },
    async readChainForProject(_scope, projectId) {
      return entries.filter((entry) => (entry.projectId ?? null) === projectId);
    },
    async verifyChain(): Promise<ChainVerification> {
      return { entriesChecked: entries.length, mismatches: [] };
    },
  };
}
