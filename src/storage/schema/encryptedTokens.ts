import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Envelope-encrypted token store.
 * - Each record holds a per-record data key wrapped by the master key.
 * - The actual token (e.g., Atlassian API token) is encrypted with the data key.
 * - Master key never touches this table; loaded from env / KMS at process start.
 *
 * Schema is intentionally narrow: this table only holds what the encryption
 * layer needs to round-trip a token. Application context (which provider,
 * which scopes) lives in adjacent application-specific tables.
 */
export const encryptedTokens = pgTable(
  "encrypted_tokens",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    /** Caller-defined logical key (e.g., "jira:cloudId:user@example.com"). */
    logicalKey: text("logical_key").notNull(),
    /** Algorithm tag — currently always xchacha20poly1305. */
    algo: text("algo").notNull(),
    /** Base64 of the per-record data key, wrapped by the master key. */
    wrappedDataKey: text("wrapped_data_key").notNull(),
    /** Base64 nonce used to wrap the data key. */
    wrapNonce: text("wrap_nonce").notNull(),
    /** Base64 of the ciphertext (token encrypted with data key). */
    ciphertext: text("ciphertext").notNull(),
    /** Base64 nonce used for the ciphertext. */
    nonce: text("nonce").notNull(),
    /** Identifier of the master key version used; rotates on key rotation. */
    masterKeyId: text("master_key_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantLogicalIdx: uniqueIndex("encrypted_tokens_tenant_logical_idx").on(t.tenantId, t.logicalKey),
    tenantIdx: index("encrypted_tokens_tenant_idx").on(t.tenantId),
  }),
);

export type EncryptedTokenRow = typeof encryptedTokens.$inferSelect;
export type NewEncryptedTokenRow = typeof encryptedTokens.$inferInsert;
