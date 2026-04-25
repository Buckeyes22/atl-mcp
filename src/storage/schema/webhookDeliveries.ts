import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    source: text("source").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantSourceIdx: index("webhook_deliveries_tenant_source_idx").on(t.tenantId, t.source),
    tenantObservedIdx: index("webhook_deliveries_tenant_observed_idx").on(t.tenantId, t.observedAt),
  }),
);

export type WebhookDeliveryRow = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDeliveryRow = typeof webhookDeliveries.$inferInsert;
