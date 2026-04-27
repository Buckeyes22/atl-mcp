import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { createWebhookIngestionWorkflow } from "../../../src/workflows/webhookIngestionWorkflow.js";
import { createNotificationWorkflow } from "../../../src/workflows/notificationWorkflow.js";
import { runEvalGate } from "../../../src/evals/evalGate.js";
import { scanAntiStubPatterns } from "../../../src/security/antiStubScanner.js";
import { defaultTenantScope } from "../../../src/domain/tenantScope.js";
import type { WebhookDeliveryRepository } from "../../../src/storage/repositories/index.js";

const SECRET = "webhook-secret";

describe("M10-M11 workflows", () => {
  it("deduplicates webhook deliveries and normalizes graph events", async () => {
    const deliveries = memoryDeliveries();
    const workflow = createWebhookIngestionWorkflow({ deliveries, secrets: { jira: SECRET } });
    const rawBody = JSON.stringify({ issue: "PCO-1" });
    const input = {
      source: "jira",
      timestamp: "2026-04-25T00:00:00.000Z",
      signatureHeader: sign(rawBody),
      rawBody,
    };

    const first = await workflow.ingest(defaultTenantScope(), input);
    const second = await workflow.ingest(defaultTenantScope(), input);

    expect(first.accepted).toBe(true);
    expect(first.event?.artifactRef).toEqual({ kind: "jira_issue", id: "PCO-1" });
    expect(second.accepted).toBe(false);
  });

  it("rejects unsigned or tampered webhook deliveries", async () => {
    const workflow = createWebhookIngestionWorkflow({ deliveries: memoryDeliveries(), secrets: { jira: SECRET } });
    const rawBody = JSON.stringify({ issue: "PCO-1" });

    await expect(
      workflow.ingest(defaultTenantScope(), {
        source: "jira",
        timestamp: "2026-04-25T00:00:00.000Z",
        signatureHeader: sign(rawBody),
        rawBody: JSON.stringify({ issue: "PCO-2" }),
      }),
    ).rejects.toThrow("webhook signature verification failed");
  });

  it("sends provisioning notifications through pluggable transports", async () => {
    const sent: unknown[] = [];
    const workflow = createNotificationWorkflow({ transports: [{ async send(message) { sent.push(message); } }] });

    await workflow.notifyProvisioningComplete({ projectId: "proj", artifactIds: ["PCO-1"] });

    expect(sent).toHaveLength(1);
  });

  it("gates eval verdicts and blocks stub patterns", () => {
    expect(runEvalGate({ verdict: "SAFE_TO_SHIP", score: 0.92 }).allowed).toBe(true);
    expect(runEvalGate({ verdict: "INVESTIGATE", score: 0.7 }).allowed).toBe(false);
    expect(scanAntiStubPatterns("export function x(){ throw new Error('TODO'); }").violations[0]?.code).toBe("anti_stub.todo_throw");
  });
});

function sign(body: string): string {
  return `sha256=${createHmac("sha256", SECRET).update(body).digest("hex")}`;
}

function memoryDeliveries(): WebhookDeliveryRepository {
  const ids = new Set<string>();
  return {
    async recordOnce(_, input) {
      if (ids.has(input.id)) return false;
      ids.add(input.id);
      return true;
    },
    async exists(_, id) {
      return ids.has(id);
    },
  };
}
