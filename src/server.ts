#!/usr/bin/env node
// Orchestrator MCP server entry point.
//
// Bootstraps based on MCP_TRANSPORT:
//   stdio  — only stdio (for embedded use; mgmt API still on 3001)
//   http   — only Streamable HTTP (3000) + mgmt API (3001)
//   both   — stdio + HTTP + mgmt (default)
//
// Mgmt API is always on (port 3001) regardless of transport choice.
// Critical: NO console.* anywhere — pino file logger only (simple-commands-mcp F-031).

import { writeFileSync } from "node:fs";
import { buildCompositionRoot } from "./compositionRoot.js";
import { SessionRegistry } from "./mcp/sessionCapabilities.js";
import { registerCompositionTools } from "./mcp/registerCompositionTools.js";
import { createStdioRunner } from "./transport/stdio.js";
import { createHttpRunner } from "./transport/http.js";
import { createMgmtApiRunner } from "./server/mgmtApi.js";
import { createWebhookIngressRunner } from "./webhooks/ingressServer.js";
import { readOptionalString } from "./config/env.js";

async function main(): Promise<void> {
  const startedAt = new Date();
  const root = await buildCompositionRoot();
  const config = root.config;
  const logger = root.logger;
  const sessionRegistry = new SessionRegistry();
  const registerExtraTools = (
    registry: Parameters<typeof registerCompositionTools>[0]["registry"],
    server: Parameters<typeof registerCompositionTools>[0]["server"],
    resolveCurrentSessionId: () => string | undefined,
  ): void => registerCompositionTools({ registry, server, root, sessionRegistry, resolveCurrentSessionId });

  logger.info(
    {
      service: config.serverInfo.name,
      version: config.serverInfo.version,
      transport: config.transport,
      tier: config.deployment.tier,
      pid: process.pid,
    },
    "orchestrator starting",
  );

  const stoppers: Array<() => Promise<void>> = [() => root.close()];

  // Mgmt API always on. Carries the admin MCP transport + operator UI per ADR 0006.
  const oauthCallback = buildAtlassianOAuthCallback(root);
  const mgmt = createMgmtApiRunner({
    config,
    logger,
    sessionRegistry,
    startedAt,
    ...(oauthCallback ? { oauthCallback } : {}),
    adminDeps: {
      config,
      logger,
      db: root.db,
      repositories: root.repositories,
      auditSigner: root.auditSigner,
      providers: root.providers,
      agentSessionRegistry: sessionRegistry,
      provisionQueue: root.provisionQueue,
      velocityRegistry: root.velocityRegistry,
      startedAt,
    },
  });
  await mgmt.start();
  stoppers.push(() => mgmt.stop());

  const webhooks = createWebhookIngressRunner({
    port: config.webhooks.port,
    host: config.webhooks.host,
    logger,
    deliveries: root.repositories.webhookDelivery,
    secrets: root.webhookSecrets,
  });
  await webhooks.start();
  stoppers.push(() => webhooks.stop());

  // MCP transports per config
  if (config.transport === "stdio" || config.transport === "both") {
    const stdio = createStdioRunner({
      config,
      logger,
      sessionRegistry,
      startedAt,
      provisionJobs: root.repositories.provisionJob,
      projectRepository: root.repositories.project,
      contextPacks: root.repositories.contextPack,
      readiness: root.repositories.readiness,
      traceLinks: root.repositories.traceLink,
      registerExtraTools,
    });
    await stdio.start();
    stoppers.push(() => stdio.stop());
  }

  if (config.transport === "http" || config.transport === "both") {
    const http = createHttpRunner({
      config,
      logger,
      sessionRegistry,
      startedAt,
      provisionJobs: root.repositories.provisionJob,
      projectRepository: root.repositories.project,
      contextPacks: root.repositories.contextPack,
      readiness: root.repositories.readiness,
      traceLinks: root.repositories.traceLink,
      registerExtraTools,
    });
    await http.start();
    stoppers.push(() => http.stop());
  }

  logger.info({ transport: config.transport }, "orchestrator ready");

  // Graceful shutdown
  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "shutdown initiated");
    for (const stop of stoppers.reverse()) {
      try {
        await stop();
      } catch (err) {
        logger.error({ err }, "stopper threw during shutdown");
      }
    }
    logger.info("shutdown complete");
    // Give pino a moment to flush before exit
    setTimeout(() => process.exit(0), 100);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "uncaughtException");
    void shutdown("uncaughtException");
  });
  process.on("unhandledRejection", (reason) => {
    logger.fatal({ reason }, "unhandledRejection");
    void shutdown("unhandledRejection");
  });
}

main().catch((err) => {
  // We can't use console here. Fall back to writing to a fallback log path
  // synchronously, then exit non-zero. Pino may not be initialized yet.
  try {
    writeFileSync(
      "./orchestrator-startup-error.log",
      `[${new Date().toISOString()}] startup failure: ${String(err?.stack ?? err)}\n`,
      { flag: "a" },
    );
  } catch {
    // Last resort — process exits with non-zero status so wrapper detects failure.
  }
  process.exit(1);
});

function buildAtlassianOAuthCallback(root: Awaited<ReturnType<typeof buildCompositionRoot>>) {
  if (readOptionalString("ATLASSIAN_AUTH_MODE") !== "oauth3lo") return undefined;
  const expectedState = readOptionalString("ATLASSIAN_OAUTH_STATE");
  const pkceVerifier = readOptionalString("ATLASSIAN_OAUTH_PKCE_VERIFIER");
  const clientId = readOptionalString("ATLASSIAN_OAUTH_CLIENT_ID");
  const clientSecret = readOptionalString("ATLASSIAN_OAUTH_CLIENT_SECRET");
  if (!expectedState || !pkceVerifier || !clientId || !clientSecret) {
    root.logger.warn(
      "ATLASSIAN_AUTH_MODE=oauth3lo but callback state, PKCE verifier, client id, or client secret is missing",
    );
    return undefined;
  }
  return {
    tokenStore: root.tokenStore,
    expectedState,
    pkceVerifier,
    clientId,
    clientSecret,
    redirectUri:
      readOptionalString("ATLASSIAN_OAUTH_REDIRECT_URI") ??
      `http://${root.config.mgmt.host}:${root.config.mgmt.port}/oauth/atlassian/callback`,
    tokenEndpoint: readOptionalString("ATLASSIAN_OAUTH_TOKEN_ENDPOINT") ?? "https://auth.atlassian.com/oauth/token",
  };
}
