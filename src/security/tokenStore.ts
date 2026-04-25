// Public token store — wraps the encryption layer + the encryptedTokens repo.
// Workflows call put/get with plaintext; encryption + persistence are internal.

import { randomUUID } from "node:crypto";
import type { Repositories } from "../storage/repositories/index.js";
import type { TenantScope } from "../domain/tenantScope.js";
import type { TokenEncryption } from "./tokenEncryption.js";

export interface TokenStore {
  /** Insert or update a token under (tenant, logicalKey). */
  put(scope: TenantScope, logicalKey: string, plaintext: string): Promise<void>;
  /** Decrypt and return the plaintext, or undefined if not found. */
  get(scope: TenantScope, logicalKey: string): Promise<string | undefined>;
  delete(scope: TenantScope, logicalKey: string): Promise<void>;
}

export function createTokenStore(args: {
  repositories: Pick<Repositories, "encryptedToken">;
  encryption: TokenEncryption;
}): TokenStore {
  const { repositories, encryption } = args;
  return {
    async put(scope, logicalKey, plaintext) {
      const sealed = encryption.seal(plaintext);
      const now = new Date().toISOString();
      await repositories.encryptedToken.upsert(scope, {
        id: randomUUID(),
        tenantId: scope.tenantId,
        logicalKey,
        algo: sealed.algo,
        wrappedDataKey: sealed.wrappedDataKey,
        wrapNonce: sealed.wrapNonce,
        ciphertext: sealed.ciphertext,
        nonce: sealed.nonce,
        masterKeyId: sealed.masterKeyId,
        createdAt: now,
        updatedAt: now,
      });
    },

    async get(scope, logicalKey) {
      const record = await repositories.encryptedToken.findByLogicalKey(scope, logicalKey);
      if (!record) return undefined;
      return encryption.open({
        algo: record.algo,
        wrappedDataKey: record.wrappedDataKey,
        wrapNonce: record.wrapNonce,
        ciphertext: record.ciphertext,
        nonce: record.nonce,
        masterKeyId: record.masterKeyId,
      });
    },

    async delete(scope, logicalKey) {
      await repositories.encryptedToken.delete(scope, logicalKey);
    },
  };
}
