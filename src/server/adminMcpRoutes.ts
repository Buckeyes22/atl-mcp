// Admin MCP transport — mounts a `/mcp` route on the mgmt API Hono app and
// serves the `admin.*` tool surface authorized by ADR 0006.
//
// The session-management pattern mirrors src/transport/http.ts: each new
// `mcp-session-id` allocates a WebStandardStreamableHTTPServerTransport + admin Server,
// expired sessions are reaped on a 60s tick. Bound to mgmt host (default
// 127.0.0.1), so reachable only from loopback callers.

import type { Hono } from "hono";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Server as McpServer } from "@modelcontextprotocol/sdk/server/index.js";
import { randomUUID } from "node:crypto";
import type { Logger } from "pino";
import { buildAdminServer } from "../mcp/admin/buildAdminServer.js";
import type { AdminToolDeps } from "../mcp/admin/registry.js";

const SESSION_ID_HEADER = "mcp-session-id";
const REAPER_TICK_MS = 60_000;

interface AdminSession {
  readonly id: string;
  readonly transport: WebStandardStreamableHTTPServerTransport;
  readonly server: McpServer;
  lastActivityMs: number;
}

export interface AdminMcpRouter {
  stop(): Promise<void>;
}

export function mountAdminMcp(args: {
  app: Hono;
  deps: AdminToolDeps;
  logger: Logger;
  /** Idle session TTL; defaults to mgmt session TTL but isolated for admin. */
  sessionTtlSeconds?: number;
}): AdminMcpRouter {
  const { app, deps, logger } = args;
  const ttlMs = (args.sessionTtlSeconds ?? 3600) * 1000;
  const sessions = new Map<string, AdminSession>();

  const reaper = setInterval(() => {
    const now = Date.now();
    for (const [id, s] of sessions) {
      if (now - s.lastActivityMs > ttlMs) {
        logger.info({ adminSessionId: id, ageMs: now - s.lastActivityMs }, "reaping expired admin session");
        void s.transport.close().catch(() => {});
        sessions.delete(id);
      }
    }
  }, REAPER_TICK_MS);
  reaper.unref?.();

  app.all("/mcp", async (c) => {
    const incomingId = c.req.header(SESSION_ID_HEADER);
    const origin = c.req.header("Origin");
    const method = c.req.method;
    let session = incomingId ? sessions.get(incomingId) : undefined;

    if (incomingId && !session) {
      return withLoopbackCors(c.json({ error: "session_not_found" }, 404), origin);
    }

    if (!incomingId && !session && (method === "POST" || method === "GET")) {
      session = createAdminSession({ deps, logger });
      sessions.set(session.id, session);
    }

    if (!session) {
      return withLoopbackCors(c.json({ error: "session_not_found" }, 404), origin);
    }

    session.lastActivityMs = Date.now();

    try {
      const response = await session.transport.handleRequest(c.req.raw);
      return withLoopbackCors(response, origin);
    } catch (err) {
      logger.error({ err, adminSessionId: session.id }, "admin transport.handleRequest threw");
      return withLoopbackCors(c.json({ error: "internal_error" }, 500), origin);
    }
  });

  return {
    async stop() {
      clearInterval(reaper);
      for (const [, s] of sessions) {
        await s.transport.close().catch(() => {});
      }
      sessions.clear();
    },
  };
}

function createAdminSession(args: { deps: AdminToolDeps; logger: Logger }): AdminSession {
  const id = randomUUID();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => id,
    onsessioninitialized: (sessionId) => {
      args.logger.info({ adminSessionId: sessionId }, "admin session initialized");
    },
  });
  const server = buildAdminServer(args.deps);
  void server.connect(transport);
  return { id, transport, server, lastActivityMs: Date.now() };
}

function withLoopbackCors(response: Response, origin: string | undefined): Response {
  if (!origin || !isLoopbackBrowserOrigin(origin)) return response;
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "content-type,accept,mcp-session-id,mcp-protocol-version");
  headers.set("Access-Control-Expose-Headers", "mcp-session-id");
  headers.append("Vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
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
