import { eq } from "drizzle-orm";
import type { TenantScope } from "../../domain/tenantScope.js";
import type { Database } from "../db.js";
import { webhookDeliveries, type NewWebhookDeliveryRow } from "../schema/webhookDeliveries.js";

export interface WebhookDeliveryRepository {
  recordOnce(
    scope: TenantScope,
    input: { readonly id: string; readonly source: string; readonly observedAt: string },
  ): Promise<boolean>;
  exists(scope: TenantScope, id: string): Promise<boolean>;
}

export function createWebhookDeliveryRepository(db: Database): WebhookDeliveryRepository {
  return {
    async recordOnce(scope, input) {
      const row: NewWebhookDeliveryRow = {
        id: input.id,
        tenantId: scope.tenantId,
        source: input.source,
        observedAt: new Date(input.observedAt),
        createdAt: new Date(),
      };
      const inserted = await db
        .insert(webhookDeliveries)
        .values(row)
        .onConflictDoNothing()
        .returning();
      return inserted.length === 1;
    },

    async exists(scope, id) {
      const rows = await db
        .select({ id: webhookDeliveries.id })
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.id, id))
        .limit(1);
      return rows.some((row) => row.id === id);
    },
  };
}
