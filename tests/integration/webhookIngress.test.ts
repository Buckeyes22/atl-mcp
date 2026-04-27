import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { pino } from "pino";
import { defaultTenantScope } from "../../src/domain/tenantScope.js";
import { createWebhookIngressRunner } from "../../src/webhooks/ingressServer.js";
import type { WebhookDeliveryRepository } from "../../src/storage/repositories/webhookDeliveryRepository.js";

const SECRET = "webhook-secret";
const scope = defaultTenantScope();

describe("webhook HTTP ingress", () => {
  it("verifies the raw-body signature and deduplicates persisted deliveries", async () => {
    const deliveries = inMemoryDeliveries();
    const runner = createWebhookIngressRunner({
      port: 0,
      host: "127.0.0.1",
      logger: pino({ level: "silent" }),
      deliveries,
      secrets: { github: SECRET },
      resolveScope: () => scope,
    });
    const rawBody = JSON.stringify({ repo: "acme/widgets" });
    const signature = `sha256=${createHmac("sha256", SECRET).update(rawBody).digest("hex")}`;

    const first = await runner.app.fetch(new Request("http://localhost/webhooks/github", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": signature,
        "x-github-delivery": "delivery-1",
      },
      body: rawBody,
    }));
    const second = await runner.app.fetch(new Request("http://localhost/webhooks/github", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": signature,
        "x-github-delivery": "delivery-1",
      },
      body: rawBody,
    }));

    await expect(first.json()).resolves.toMatchObject({
      accepted: true,
      event: { source: "github", artifactRef: { kind: "vcs_repo", id: "acme/widgets" } },
    });
    await expect(second.json()).resolves.toMatchObject({ accepted: false });
  });

  it("rejects invalid signatures before JSON parsing", async () => {
    const runner = createWebhookIngressRunner({
      port: 0,
      host: "127.0.0.1",
      logger: pino({ level: "silent" }),
      deliveries: inMemoryDeliveries(),
      secrets: { jira: SECRET },
      resolveScope: () => scope,
    });

    const res = await runner.app.fetch(new Request("http://localhost/webhooks/jira", {
      method: "POST",
      headers: { "x-hub-signature": "sha256=abcd" },
      body: "{not json",
    }));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ error: "webhook signature verification failed" });
  });
});

function inMemoryDeliveries(): WebhookDeliveryRepository {
  const seen = new Set<string>();
  return {
    async recordOnce(_, input) {
      if (seen.has(input.id)) return false;
      seen.add(input.id);
      return true;
    },
    async exists(_, id) {
      return seen.has(id);
    },
  };
}
