// Management API — port 3001 by default, bound to 127.0.0.1.
// Per open-edison F-130 dual-port architecture (see docs/partners/open-edison.md).
// MCP traffic is on port 3000; mgmt is internal-only and exposes:
//   GET /healthz  — liveness/readiness for orchestrator process
//   GET /metrics  — Prometheus exposition format (M0 stub; full counters in M11)
//   ALL /mcp      — admin MCP transport (admin.* tools) per ADR 0006
//   GET /ui/*     — operator control plane UI assets per ADR 0006
//
// Bind address MUST default to 127.0.0.1; do not expose to internet.

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import type { Server as HttpServer } from "node:http";
import type { Logger } from "pino";
import type { OrchestratorConfig } from "../config.js";
import type { SessionRegistry } from "../mcp/sessionCapabilities.js";
import { mountAdminMcp, type AdminMcpRouter } from "./adminMcpRoutes.js";
import { mountControlPlaneUI } from "./uiAssets.js";
import type { AdminToolDeps } from "../mcp/admin/registry.js";
import type { TenantScope } from "../domain/tenantScope.js";
import { defaultTenantScope } from "../domain/tenantScope.js";
import type { TokenStore } from "../security/tokenStore.js";
import { handleAtlassianOAuthCallback } from "../providers/atlassian/auth/oauthCallback.js";

export interface MgmtApiRunner {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly app: Hono;
}

export function createMgmtApiRunner(args: {
  config: OrchestratorConfig;
  logger: Logger;
  sessionRegistry: SessionRegistry;
  startedAt: Date;
  /**
   * Dependencies for the admin tool surface served on /mcp (ADR 0006). Optional
   * so older callers (and pure /healthz tests) continue to work; production
   * always provides this from the composition root.
   */
  adminDeps?: AdminToolDeps;
  oauthCallback?: {
    readonly tokenStore: TokenStore;
    readonly expectedState: string;
    readonly pkceVerifier: string;
    readonly clientId: string;
    readonly clientSecret: string;
    readonly redirectUri: string;
    readonly tokenEndpoint: string;
    readonly resolveScope?: () => TenantScope;
    readonly fetchImpl?: typeof fetch;
  };
}): MgmtApiRunner {
  const { config, logger, sessionRegistry, startedAt, adminDeps } = args;
  const app = new Hono();
  let httpServer: HttpServer | undefined;
  let adminRouter: AdminMcpRouter | undefined;

  app.use("*", async (c, next) => {
    const origin = c.req.header("Origin");
    const allowLoopbackOrigin = origin ? isLoopbackBrowserOrigin(origin) : false;
    if (allowLoopbackOrigin) {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      c.header("Access-Control-Allow-Headers", "content-type,accept,mcp-session-id,mcp-protocol-version");
      c.header("Access-Control-Expose-Headers", "mcp-session-id");
      c.header("Vary", "Origin");
    }
    if (c.req.method === "OPTIONS" && c.req.path === "/mcp") {
      if (!allowLoopbackOrigin) return c.text("origin not allowed", 403);
      return c.body(null, 204);
    }
    await next();
  });

  const livePayload = () => ({
    status: "ok",
    service: config.serverInfo.name,
    version: config.serverInfo.version,
    uptimeSeconds: Math.round((Date.now() - startedAt.getTime()) / 1000),
    activeSessions: sessionRegistry.size(),
    deploymentTier: config.deployment.tier,
  });

  app.get("/", (c) => {
    return c.redirect("/ui/", 302);
  });

  app.get("/healthz", (c) => {
    return c.json(livePayload());
  });

  app.get("/health/live", (c) => {
    return c.json(livePayload());
  });

  app.get("/readyz", (c) => {
    // M0: ready iff process is alive. M2+ will add provider-reachability checks.
    return c.json({
      status: "ready",
      service: config.serverInfo.name,
      version: config.serverInfo.version,
      deploymentTier: config.deployment.tier,
    });
  });

  app.get("/health/ready", (c) => {
    return c.json({
      status: "ready",
      service: config.serverInfo.name,
      version: config.serverInfo.version,
      deploymentTier: config.deployment.tier,
    });
  });

  app.get("/metrics", (c) => {
    // M0 stub: minimal Prometheus exposition. Full counters per
    // open-edison F-128 + open-edison.md §4.2 land in M11.
    const uptimeSec = Math.round((Date.now() - startedAt.getTime()) / 1000);
    const lines = [
      "# HELP orchestrator_up Whether the orchestrator process is up (1 = up)",
      "# TYPE orchestrator_up gauge",
      "orchestrator_up 1",
      "# HELP orchestrator_uptime_seconds Process uptime in seconds",
      "# TYPE orchestrator_uptime_seconds counter",
      `orchestrator_uptime_seconds ${uptimeSec}`,
      "# HELP orchestrator_sessions_active Active MCP sessions",
      "# TYPE orchestrator_sessions_active gauge",
      `orchestrator_sessions_active ${sessionRegistry.size()}`,
    ];
    return c.text(lines.join("\n") + "\n", 200, {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    });
  });

  app.get("/oauth/atlassian/callback", async (c) => {
    if (!args.oauthCallback) {
      return c.json({ error: "Atlassian OAuth callback is not configured" }, 503);
    }
    const code = c.req.query("code");
    const state = c.req.query("state");
    if (!code || !state) {
      return c.json({ error: "missing OAuth code or state" }, 400);
    }
    try {
      const oauth = args.oauthCallback;
      const result = await handleAtlassianOAuthCallback({
        scope: oauth.resolveScope ? oauth.resolveScope() : defaultTenantScope(),
        code,
        state,
        expectedState: oauth.expectedState,
        pkceVerifier: oauth.pkceVerifier,
        clientId: oauth.clientId,
        clientSecret: oauth.clientSecret,
        redirectUri: oauth.redirectUri,
        tokenEndpoint: oauth.tokenEndpoint,
        tokenStore: oauth.tokenStore,
        ...(oauth.fetchImpl ? { fetchImpl: oauth.fetchImpl } : {}),
      });
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = /state/i.test(message) ? 400 : 502;
      logger.warn({ err: message }, "Atlassian OAuth callback failed");
      return c.json({ error: message }, status);
    }
  });

  // ADR 0006: admin MCP tools + operator UI co-hosted on the loopback mgmt origin.
  if (adminDeps) {
    adminRouter = mountAdminMcp({ app, deps: adminDeps, logger });
    mountControlPlaneUI(app, logger);
  } else {
    logger.warn(
      "mgmt API started without adminDeps — operator control plane (/ui/, /mcp) is not mounted. This is expected for unit tests; production must supply adminDeps.",
    );
  }

  return {
    app,
    async start() {
      // Defensive guard: warn loudly if mgmt is bound to non-loopback in non-dev.
      if (config.mgmt.host !== "127.0.0.1" && config.mgmt.host !== "localhost") {
        logger.warn(
          { host: config.mgmt.host, tier: config.deployment.tier },
          "mgmt API bound to non-loopback host — ensure firewall restricts external access (open-edison F-130 gotcha 5)",
        );
      }
      // SDK-types: @hono/node-server's `serve()` declares its return as `unknown`
      // even though the implementation returns a Node http.Server. Cast so we
      // can call .close() during shutdown. Tracked: see F-008 in audit findings.
      httpServer = serve({
        fetch: app.fetch,
        port: config.mgmt.port,
        hostname: config.mgmt.host,
      }) as unknown as HttpServer;
      logger.info(
        { port: config.mgmt.port, host: config.mgmt.host },
        "mgmt API listening",
      );
    },
    async stop() {
      if (adminRouter) await adminRouter.stop();
      await new Promise<void>((resolve) => {
        if (!httpServer) return resolve();
        httpServer.close(() => resolve());
      });
      logger.info("mgmt API closed");
    },
  };
}

function isLoopbackBrowserOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  } catch {
    return false;
  }
}
