// Stdio transport per simple-commands-mcp F-031.
// The single stdio session has a fixed sessionId so resources resolve correctly.
// CRITICAL: never write to stdout from anywhere else — the JSON-RPC frame lives there.

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Logger } from "pino";
import type { OrchestratorConfig } from "../config.js";
import { buildServer, ORCHESTRATOR_SERVER_CAPABILITIES } from "../mcp/buildServer.js";
import { SessionRegistry, buildSessionProfile } from "../mcp/sessionCapabilities.js";
import { extractInitializeParams, recordNegotiatedSession, type InitializeParamsSnapshot } from "../mcp/sessionNegotiation.js";
import type { ToolRegistry } from "../mcp/toolRegistry.js";
import type { ProvisionJobRepository } from "../storage/repositories/provisionJobRepository.js";
import type { ProjectRepository } from "../storage/repositories/projectRepository.js";
import type { ContextPackRepository } from "../storage/repositories/contextPackRepository.js";
import type { ReadinessRepository } from "../storage/repositories/readinessRepository.js";
import type { TraceLinkRepository } from "../storage/repositories/traceLinkRepository.js";
import type { Server as McpServer } from "@modelcontextprotocol/sdk/server/index.js";

const STDIO_SESSION_ID = "stdio-singleton";

export interface StdioRunner {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createStdioRunner(args: {
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
}): StdioRunner {
  const { config, logger, sessionRegistry, startedAt, registerExtraTools, provisionJobs, projectRepository, contextPacks, readiness, traceLinks } = args;

  const server = buildServer({
    config,
    logger,
    sessionRegistry,
    resolveCurrentSessionId: () => STDIO_SESSION_ID,
    startedAt,
    ...(provisionJobs ? { provisionJobs } : {}),
    ...(projectRepository ? { projectRepository } : {}),
    ...(contextPacks ? { contextPacks } : {}),
    ...(readiness ? { readiness } : {}),
    ...(traceLinks ? { traceLinks } : {}),
    ...(registerExtraTools !== undefined
      ? { registerExtraTools: (registry, server) => registerExtraTools(registry, server, () => STDIO_SESSION_ID) }
      : {}),
  });

  const transport = new StdioServerTransport();
  let started = false;
  let initializeParams: InitializeParamsSnapshot | undefined;
  installInitializeObserver(transport, (params) => {
    initializeParams = params;
  });
  server.oninitialized = () => {
    if (!initializeParams) return;
    recordNegotiatedSession({
      sessionRegistry,
      sessionId: STDIO_SESSION_ID,
      server,
      serverCapabilities: ORCHESTRATOR_SERVER_CAPABILITIES,
      initializeParams,
    });
  };

  return {
    async start() {
      if (started) throw new Error("stdio runner already started");
      started = true;

      // Capture session profile after the SDK negotiates initialize.
      // The SDK exposes negotiated values on the server's _serverInfo / _capabilities;
      // for M0 we register a placeholder profile that gets replaced on first request.
      // (Full McpSessionProfile capture wired into the SDK initialize hook lands when
      // the SDK exposes a stable initialize callback; tracked as a v0.1.x follow-up.)
      sessionRegistry.register(
        buildSessionProfile({
          sessionId: STDIO_SESSION_ID,
          negotiatedProtocolVersion: "pending-initialize",
          clientInfo: undefined,
          clientCapabilities: {},
          serverCapabilities: {
            ...ORCHESTRATOR_SERVER_CAPABILITIES,
          },
        }),
      );

      await server.connect(transport);
      logger.info({ transport: "stdio", sessionId: STDIO_SESSION_ID }, "stdio transport connected");
    },
    async stop() {
      if (!started) return;
      sessionRegistry.remove(STDIO_SESSION_ID);
      await server.close();
      logger.info({ transport: "stdio" }, "stdio transport closed");
      started = false;
    },
  };
}

function installInitializeObserver(
  transport: StdioServerTransport,
  onInitialize: (params: InitializeParamsSnapshot) => void,
): void {
  let current: StdioServerTransport["onmessage"];
  Object.defineProperty(transport, "onmessage", {
    configurable: true,
    get() {
      return current;
    },
    set(handler: StdioServerTransport["onmessage"]) {
      current = handler
        ? (message) => {
            const params = extractInitializeParams(message);
            if (params) onInitialize(params);
            return handler(message);
          }
        : undefined;
    },
  });
}
