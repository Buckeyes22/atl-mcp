// Audit repository — append-only with hash-chain ordering per (tenant, project).
// In M1 the chain uses sha256(prev.payload || curr.payload) for prevHash; in
// M6a this is replaced by ed25519 + JCS canonicalization (agentdiff F-117).
// The persisted columns are the same in both regimes, so M6a swaps the
// signing pipeline without a schema change.

import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { auditPayloadHash } from "../../security/auditChain.js";
import type { Database } from "../db.js";
import { auditEntries, type NewAuditEntryRow } from "../schema/auditEntries.js";
import type { AuditEntry } from "../../domain/auditEntry.js";
import type { TenantScope } from "../../domain/tenantScope.js";

export interface AuditAppendInput {
  /** Provide everything except sequence + prevHash; the repo computes those. */
  readonly entry: Omit<AuditEntry, "prevHash"> & { prevHash?: string };
}

export interface AuditRepository {
  append(scope: TenantScope, input: AuditAppendInput): Promise<AuditEntry>;
  readChainForProject(scope: TenantScope, projectId: string | null): Promise<readonly AuditEntry[]>;
  /** Verify hash-chain integrity for a given (tenant, project). Returns mismatches. */
  verifyChain(scope: TenantScope, projectId: string | null): Promise<ChainVerification>;
}

export interface ChainVerification {
  readonly entriesChecked: number;
  readonly mismatches: ReadonlyArray<{ entryId: string; reason: string }>;
}

export function createAuditRepository(db: Database): AuditRepository {
  return {
    async append(scope, input) {
      if (input.entry.tenantId !== scope.tenantId) {
        throw new Error(`auditEntry.tenantId must match scope`);
      }
      // Determine sequence + prevHash by reading the latest entry for (tenant, project).
      const projectClause = input.entry.projectId
        ? eq(auditEntries.projectId, input.entry.projectId)
        : isNull(auditEntries.projectId);
      const last = await db
        .select()
        .from(auditEntries)
        .where(and(eq(auditEntries.tenantId, scope.tenantId), projectClause))
        .orderBy(desc(auditEntries.sequence))
        .limit(1);
      const prevSeq = last[0]?.sequence ?? 0;
      const computedPrevHash = last[0] ? auditPayloadHash(last[0].payload) : "0";
      const prevHash = input.entry.prevHash ?? computedPrevHash;

      const sequence = prevSeq + 1;
      const finalEntry: AuditEntry = {
        ...input.entry,
        prevHash,
      };

      const row: NewAuditEntryRow = {
        id: finalEntry.id,
        tenantId: finalEntry.tenantId,
        projectId: finalEntry.projectId ?? null,
        sequence,
        toolName: finalEntry.toolName,
        actorPrincipalFingerprint: finalEntry.actor.mcpPrincipalFingerprint,
        inputHash: finalEntry.inputHash,
        prevHash,
        signatureKeyId: finalEntry.signature.keyId,
        signatureValue: finalEntry.signature.value,
        payload: finalEntry,
        timestamp: new Date(finalEntry.timestamp),
      };
      await db.insert(auditEntries).values(row);
      return finalEntry;
    },

    async readChainForProject(scope, projectId) {
      const projectClause = projectId
        ? eq(auditEntries.projectId, projectId)
        : isNull(auditEntries.projectId);
      const rows = await db
        .select()
        .from(auditEntries)
        .where(and(eq(auditEntries.tenantId, scope.tenantId), projectClause))
        .orderBy(asc(auditEntries.sequence));
      return rows.map((r) => r.payload as AuditEntry);
    },

    async verifyChain(scope, projectId) {
      const projectClause = projectId
        ? eq(auditEntries.projectId, projectId)
        : isNull(auditEntries.projectId);
      const rows = await db
        .select()
        .from(auditEntries)
        .where(and(eq(auditEntries.tenantId, scope.tenantId), projectClause))
        .orderBy(asc(auditEntries.sequence));
      const mismatches: Array<{ entryId: string; reason: string }> = [];
      let prevPayloadHash = "0";
      for (const row of rows) {
        if (row.prevHash !== prevPayloadHash) {
          mismatches.push({ entryId: row.id, reason: `prevHash mismatch (got ${row.prevHash}, expected ${prevPayloadHash})` });
        }
        prevPayloadHash = auditPayloadHash(row.payload);
      }
      return { entriesChecked: rows.length, mismatches };
    },
  };
}
