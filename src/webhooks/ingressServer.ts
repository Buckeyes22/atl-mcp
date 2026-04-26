import { serve } from "@hono/node-server";
import { Hono } from "hono";
import type { Server as HttpServer } from "node:http";
import type { Logger } from "pino";
import type { TenantScope } from "../domain/tenantScope.js";
import { defaultTenantScope } from "../domain/tenantScope.js";
import type { WebhookDeliveryRepository } from "../storage/repositories/webhookDeliveryRepository.js";
import { createWebhookIngestionWorkflow } from "../workflows/webhookIngestionWorkflow.js";

const SUPPORTED_SOURCES = new Set(["jira", "confluence", "bitbucket", "github"]);

export interface WebhookIngressRunner {
  readonly app: Hono;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createWebhookIngressRunner(args: {
  readonly port: number;
  readonly host: string;
  readonly logger: Logger;
  readonly deliveries: WebhookDeliveryRepository;
  readonly secrets: Readonly<Record<string, string>>;
  readonly resolveScope?: () => TenantScope;
}): WebhookIngressRunner {
  const app = new Hono();
  const workflow = createWebhookIngestionWorkflow({
    deliveries: args.deliveries,
    secrets: args.secrets,
  });
  const resolveScope = args.resolveScope ?? defaultTenantScope;
  let httpServer: HttpServer | undefined;

  app.get("/health/live", (c) => c.json({ status: "ok", surface: "webhooks" }));

  app.post("/webhooks/:source", async (c) => {
    const source = c.req.param("source");
    if (!SUPPORTED_SOURCES.has(source)) {
      return c.json({ error: "unsupported webhook source" }, 404);
    }
    const rawBody = await c.req.text();
    const signatureHeader = signatureForSource(c.req.raw.headers, source);
    if (!signatureHeader) {
      return c.json({ error: "missing webhook signature" }, 401);
    }
    const timestamp = deliveryIdForSource(c.req.raw.headers, source) ?? new Date().toISOString();
    try {
      const result = await workflow.ingest(resolveScope(), {
        source,
        timestamp,
        signatureHeader,
        rawBody,
      });
      return c.json(result, result.accepted ? 202 : 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = /not configured/i.test(message) ? 503 : /signature/i.test(message) ? 401 : 400;
      args.logger.warn({ source, err: message }, "webhook ingress rejected delivery");
      return c.json({ error: message }, status);
    }
  });

  return {
    app,
    async start() {
      httpServer = serve({
        fetch: app.fetch,
        port: args.port,
        hostname: args.host,
      }) as unknown as HttpServer;
      args.logger.info({ port: args.port, host: args.host }, "webhook ingress listening");
    },
    async stop() {
      await new Promise<void>((resolve) => {
        if (!httpServer) return resolve();
        httpServer.close(() => resolve());
      });
      args.logger.info("webhook ingress closed");
    },
  };
}

function signatureForSource(headers: Headers, source: string): string | undefined {
  if (source === "github") {
    return headers.get("x-hub-signature-256") ?? headers.get("x-hub-signature") ?? undefined;
  }
  return headers.get("x-hub-signature") ?? headers.get("x-hub-signature-256") ?? undefined;
}

function deliveryIdForSource(headers: Headers, source: string): string | undefined {
  if (source === "github") return headers.get("x-github-delivery") ?? undefined;
  if (source === "bitbucket") return headers.get("x-request-uuid") ?? undefined;
  return headers.get("x-atlassian-webhook-identifier") ?? undefined;
}
