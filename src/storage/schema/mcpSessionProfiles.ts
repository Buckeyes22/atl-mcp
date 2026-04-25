import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const mcpSessionProfiles = pgTable(
  "mcp_session_profiles",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    protocolVersion: text("protocol_version").notNull(),
    clientName: text("client_name").notNull(),
    agentMode: text("agent_mode"),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("mcp_session_profiles_tenant_idx").on(t.tenantId),
  }),
);

export type McpSessionProfileRow = typeof mcpSessionProfiles.$inferSelect;
export type NewMcpSessionProfileRow = typeof mcpSessionProfiles.$inferInsert;
