import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const agentMemoryEntries = pgTable(
  "agent_memory_entries",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    agentKey: text("agent_key").notNull(),
    sessionId: text("session_id"),
    issueKey: text("issue_key"),
    kind: text("kind").notNull(),
    text: text("text").notNull(),
    tags: jsonb("tags").notNull(),
    sourceRefs: jsonb("source_refs").notNull(),
    contentHash: text("content_hash").notNull(),
    embeddingRef: text("embedding_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    tenantProjectAgentIdx: index("agent_memory_tenant_project_agent_idx").on(t.tenantId, t.projectId, t.agentKey),
    tenantProjectIssueIdx: index("agent_memory_tenant_project_issue_idx").on(t.tenantId, t.projectId, t.issueKey),
    tenantProjectKindIdx: index("agent_memory_tenant_project_kind_idx").on(t.tenantId, t.projectId, t.kind),
    tenantProjectUpdatedIdx: index("agent_memory_tenant_project_updated_idx").on(t.tenantId, t.projectId, t.updatedAt),
    dedupeIdx: uniqueIndex("agent_memory_active_dedupe_idx").on(t.tenantId, t.projectId, t.agentKey, t.contentHash),
  }),
);

export type AgentMemoryEntryRow = typeof agentMemoryEntries.$inferSelect;
export type NewAgentMemoryEntryRow = typeof agentMemoryEntries.$inferInsert;
