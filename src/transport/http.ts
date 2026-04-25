import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { randomUUID } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import type { Logger } from "pino";
import type { OrchestratorConfig } from "../config.js";
import { buildServer, ORCHESTRATOR_SERVER_CAPABILITIES } from "../mcp/buildServer.js";
import type { ToolRegistry } from "../mcp/toolRegistry.js";
import type { ProvisionJobRepository } from "../storage/repositories/provisionJobRepository.js";
import type { ProjectRepository } from "../storage/repositories/projectRepository.js";
import type { ContextPackRepository } from "../storage/repositories/contextPackRepository.js";
import type { ReadinessRepository } from "../storage/repositories/readinessRepository.js";
import type { TraceLinkRepository } from "../storage/repositories/traceLinkRepository.js";
import {
  SessionRegistry,
  buildSessionProfile,
} from "../mcp/sessionCapabilities.js";
import { extractInitializeParams, recordNegotiatedSession, type InitializeParamsSnapshot } from "../mcp/sessionNegotiation.js";
import type { Server as McpServer } from "@modelcontextprotocol/sdk/server/index.js";

const SESSION_ID_HEADER = "mcp-session-id";

interface HttpSession {
  readonly id: string;
  readonly transport: WebStandardStreamableHTTPServerTransport;
  readonly server: McpServer;
  lastActivityMs: number;
}

export interface HttpRunner {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly app: Hono;
}

export function createHttpRunner(args: {
  config: OrchestratorConfig;
  logger: Logger;
  sessionRegistry: SessionRegistry;
  startedAt: Date;
  provisionJobs?: ProvisionJobRepository;
  projectRepository?: ProjectRepository;
  contextPacks?: ContextPackRepository;
  readiness?: ReadinessRepository;
  traceLinks?: TraceLinkRepository;
  registerExtraTools?: (registry: ToolRegistry, server: McpServer, resolveCurrentSessionId: () => string | undefined) => void;
}): HttpRunner {
  const { config, logger, sessionRegistry, startedAt, registerExtraTools, provisionJobs, projectRepository, contextPacks, readiness, traceLinks } = args;
  const sessions = new Map<string, HttpSession>();
  let currentSessionIdForBuild: string | undefined;
  let httpServer: HttpServer | undefined;
  let reaperTimer: NodeJS.Timeout | undefined;

  const app = new Hono();

  app.get("/healthz", (c) => c.json({ status: "ok", transport: "http" }));
  app.get("/health/live", (c) => c.json({ status: "ok", transport: "http" }));
  app.get("/readyz", (c) => c.json({ status: "ready", transport: "http" }));
  app.get("/health/ready", (c) => c.json({ status: "ready", transport: "http" }));

  app.all("/mcp", async (c) => {
    const incomingId = c.req.header(SESSION_ID_HEADER);
    const method = c.req.method;

    let session = incomingId ? sessions.get(incomingId) : undefined;

    if (incomingId && !session) {
      return c.json({ error: "session_not_found" }, 404);
    }

    if (!incomingId && !session && (method === "POST" || method === "GET")) {
      if (sessions.size >= config.http.maxConcurrentSessions) {
        logger.warn(
          { activeSessions: sessions.size, max: config.http.maxConcurrentSessions },
          "max concurrent sessions reached; rejecting new session",
        );
        return c.json(
          { error: "max_sessions_reached", retryAfterSeconds: 30 },
          503,
          { "Retry-After": "30" },
        );
      }
      session = createSession({
        config,
        logger,
        sessionRegistry,
        startedAt,
        sessions,
        getCurrentSessionId: () => currentSessionIdForBuild,
        ...(provisionJobs ? { provisionJobs } : {}),
        ...(projectRepository ? { projectRepository } : {}),
        ...(contextPacks ? { contextPacks } : {}),
        ...(readiness ? { readiness } : {}),
        ...(traceLinks ? { traceLinks } : {}),
        ...(registerExtraTools !== undefined ? { registerExtraTools } : {}),
      });
      sessions.set(session.id, session);
    }

    if (!session) {
      return c.json({ error: "session_not_found" }, 404);
    }

    session.lastActivityMs = Date.now();
    currentSessionIdForBuild = session.id;

    let initializeParams: InitializeParamsSnapshot | undefined;
    try {
      const parsedBody = method === "POST" ? await c.req.raw.clone().json().catch(() => undefined) : undefined;
      initializeParams = extractInitializeParams(parsedBody);
      const response = await session.transport.handleRequest(
        c.req.raw,
        parsedBody === undefined ? undefined : { parsedBody },
      );
      if (initializeParams) {
        recordNegotiatedSession({
          sessionRegistry,
          sessionId: session.id,
          server: session.server,
          serverCapabilities: ORCHESTRATOR_SERVER_CAPABILITIES,
          initializeParams,
        });
      }
      return response;
    } catch (err) {
      logger.error({ err, sessionId: session.id }, "transport.handleRequest threw");
      return c.json({ error: "internal_error" }, 500);
    } finally {
      currentSessionIdForBuild = undefined;
    }
  });

  function startReaper(): void {
    const ttlMs = config.http.sessionTtlSeconds * 1000;
    reaperTimer = setInterval(() => {
      const now = Date.now();
      for (const [id, s] of sessions) {
        if (now - s.lastActivityMs > ttlMs) {
          logger.info({ sessionId: id, ageMs: now - s.lastActivityMs }, "reaping expired session");
          void s.transport.close().catch(() => {});
          sessionRegistry.remove(id);
          sessions.delete(id);
        }
      }
    }, 60_000);
    reaperTimer.unref?.();
  }

  return {
    app,
    async start() {
      // SDK-types: @hono/node-server's `serve()` returns `unknown`-typed handle;
      // implementation is a Node http.Server. F-008 in audit findings.
      httpServer = serve({
        fetch: app.fetch,
        port: config.http.port,
        hostname: config.http.host,
      }) as unknown as HttpServer;
      startReaper();
      logger.info(
        { port: config.http.port, host: config.http.host, ttlSec: config.http.sessionTtlSeconds, maxSessions: config.http.maxConcurrentSessions },
        "streamable HTTP transport listening",
      );
    },
    async stop() {
      if (reaperTimer) clearInterval(reaperTimer);
      for (const [id, s] of sessions) {
        await s.transport.close().catch(() => {});
        sessionRegistry.remove(id);
      }
      sessions.clear();
      await new Promise<void>((resolve) => {
        if (!httpServer) return resolve();
        httpServer.close(() => resolve());
      });
      logger.info({ transport: "http" }, "streamable HTTP transport closed");
    },
  };
}

function createSession(args: {
  config: OrchestratorConfig;
  logger: Logger;
  sessionRegistry: SessionRegistry;
  startedAt: Date;
  sessions: Map<string, HttpSession>;
  getCurrentSessionId: () => string | undefined;
  provisionJobs?: ProvisionJobRepository;
  projectRepository?: ProjectRepository;
  contextPacks?: ContextPackRepository;
  readiness?: ReadinessRepository;
  traceLinks?: TraceLinkRepository;
  registerExtraTools?: (registry: ToolRegistry, server: McpServer, resolveCurrentSessionId: () => string | undefined) => void;
}): HttpSession {
  const id = randomUUID();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => id,
    onsessioninitialized: (sessionId) => {
      args.sessionRegistry.register(
        buildSessionProfile({
          sessionId,
          negotiatedProtocolVersion: "pending-initialize",
          clientInfo: undefined,
          clientCapabilities: {},
          serverCapabilities: {
            ...ORCHESTRATOR_SERVER_CAPABILITIES,
          },
        }),
      );
      args.logger.info({ transport: "http", sessionId }, "http session initialized");
    },
  });

  const server = buildServer({
    config: args.config,
    logger: args.logger,
    sessionRegistry: args.sessionRegistry,
    resolveCurrentSessionId: args.getCurrentSessionId,
    startedAt: args.startedAt,
    ...(args.provisionJobs ? { provisionJobs: args.provisionJobs } : {}),
    ...(args.projectRepository ? { projectRepository: args.projectRepository } : {}),
    ...(args.contextPacks ? { contextPacks: args.contextPacks } : {}),
    ...(args.readiness ? { readiness: args.readiness } : {}),
    ...(args.traceLinks ? { traceLinks: args.traceLinks } : {}),
    ...(args.registerExtraTools !== undefined
      ? { registerExtraTools: (registry, server) => args.registerExtraTools?.(registry, server, args.getCurrentSessionId) }
      : {}),
  });

  void server.connect(transport);

  const session: HttpSession = {
    id,
    transport,
    server,
    lastActivityMs: Date.now(),
  };
  return session;
}
