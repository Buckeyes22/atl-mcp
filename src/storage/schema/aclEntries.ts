import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const aclEntries = pgTable(
  "acl_entries",
  {
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    artifactKind: text("artifact_kind").notNull(),
    artifactId: text("artifact_id").notNull(),
    principalId: text("principal_id").notNull(),
    decision: text("decision").notNull(),
    classification: text("classification").notNull(),
    source: text("source").notNull(),
    payload: jsonb("payload").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pkLike: uniqueIndex("acl_entries_pk_like").on(
      t.tenantId,
      t.projectId,
      t.artifactKind,
      t.artifactId,
      t.principalId,
    ),
    tenantProjectIdx: index("acl_entries_tenant_project_idx").on(t.tenantId, t.projectId),
  }),
);

export type AclEntryRow = typeof aclEntries.$inferSelect;
export type NewAclEntryRow = typeof aclEntries.$inferInsert;
