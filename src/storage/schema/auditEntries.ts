import { bigint, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const auditEntries = pgTable(
  "audit_entries",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id"),
    /** Monotonically increasing sequence per (tenant, project). Enables hash-chain ordering. */
    sequence: bigint("sequence", { mode: "number" }).notNull(),
    toolName: text("tool_name").notNull(),
    actorPrincipalFingerprint: text("actor_principal_fingerprint").notNull(),
    inputHash: text("input_hash").notNull(),
    prevHash: text("prev_hash").notNull(),
    /** Signature placeholder in M1; replaced with ed25519 in M6a. */
    signatureKeyId: text("signature_key_id").notNull().default(""),
    signatureValue: text("signature_value").notNull().default(""),
    payload: jsonb("payload").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("audit_entries_tenant_idx").on(t.tenantId),
    tenantProjectSeqIdx: index("audit_entries_tenant_project_seq_idx").on(t.tenantId, t.projectId, t.sequence),
  }),
);

export type AuditEntryRow = typeof auditEntries.$inferSelect;
export type NewAuditEntryRow = typeof auditEntries.$inferInsert;
