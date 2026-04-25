// INTERNAL repository — only the security/tokenStore.ts wrapper should call this.
// The shape here is the on-disk envelope-encrypted record; the public token-store
// API takes plaintext and returns plaintext.

import { and, eq } from "drizzle-orm";
import type { Database } from "../db.js";
import { encryptedTokens, type NewEncryptedTokenRow } from "../schema/encryptedTokens.js";
import type { TenantScope } from "../../domain/tenantScope.js";

export interface EncryptedTokenRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly logicalKey: string;
  readonly algo: string;
  readonly wrappedDataKey: string;
  readonly wrapNonce: string;
  readonly ciphertext: string;
  readonly nonce: string;
  readonly masterKeyId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EncryptedTokenRepository {
  upsert(scope: TenantScope, record: EncryptedTokenRecord): Promise<void>;
  findByLogicalKey(scope: TenantScope, logicalKey: string): Promise<EncryptedTokenRecord | undefined>;
  delete(scope: TenantScope, logicalKey: string): Promise<void>;
  /**
   * List all token records' METADATA only (no plaintext, no ciphertext).
   * Used by admin.secrets.list.
   */
  listMetadata(scope: TenantScope): Promise<readonly EncryptedTokenMetadata[]>;
}

export interface EncryptedTokenMetadata {
  readonly id: string;
  readonly logicalKey: string;
  readonly algo: string;
  readonly masterKeyId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function createEncryptedTokenRepository(db: Database): EncryptedTokenRepository {
  return {
    async upsert(scope, record) {
      if (record.tenantId !== scope.tenantId) {
        throw new Error(`encryptedToken.tenantId must match scope`);
      }
      const row: NewEncryptedTokenRow = {
        id: record.id,
        tenantId: record.tenantId,
        logicalKey: record.logicalKey,
        algo: record.algo,
        wrappedDataKey: record.wrappedDataKey,
        wrapNonce: record.wrapNonce,
        ciphertext: record.ciphertext,
        nonce: record.nonce,
        masterKeyId: record.masterKeyId,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
      };
      await db
        .insert(encryptedTokens)
        .values(row)
        .onConflictDoUpdate({
          target: [encryptedTokens.tenantId, encryptedTokens.logicalKey],
          set: {
            algo: record.algo,
            wrappedDataKey: record.wrappedDataKey,
            wrapNonce: record.wrapNonce,
            ciphertext: record.ciphertext,
            nonce: record.nonce,
            masterKeyId: record.masterKeyId,
            updatedAt: new Date(record.updatedAt),
          },
        });
    },

    async findByLogicalKey(scope, logicalKey) {
      const rows = await db
        .select()
        .from(encryptedTokens)
        .where(
          and(eq(encryptedTokens.tenantId, scope.tenantId), eq(encryptedTokens.logicalKey, logicalKey)),
        )
        .limit(1);
      const row = rows[0];
      if (!row) return undefined;
      return {
        id: row.id,
        tenantId: row.tenantId,
        logicalKey: row.logicalKey,
        algo: row.algo,
        wrappedDataKey: row.wrappedDataKey,
        wrapNonce: row.wrapNonce,
        ciphertext: row.ciphertext,
        nonce: row.nonce,
        masterKeyId: row.masterKeyId,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    },

    async delete(scope, logicalKey) {
      await db
        .delete(encryptedTokens)
        .where(
          and(eq(encryptedTokens.tenantId, scope.tenantId), eq(encryptedTokens.logicalKey, logicalKey)),
        );
    },

    async listMetadata(scope) {
      const rows = await db
        .select({
          id: encryptedTokens.id,
          logicalKey: encryptedTokens.logicalKey,
          algo: encryptedTokens.algo,
          masterKeyId: encryptedTokens.masterKeyId,
          createdAt: encryptedTokens.createdAt,
          updatedAt: encryptedTokens.updatedAt,
        })
        .from(encryptedTokens)
        .where(eq(encryptedTokens.tenantId, scope.tenantId));
      return rows.map((r) => ({
        id: r.id,
        logicalKey: r.logicalKey,
        algo: r.algo,
        masterKeyId: r.masterKeyId,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }));
    },
  };
}
