// Factory that returns a fully-wired MCP Server instance.
// Used by both transports (stdio + Streamable HTTP) so behavior stays identical
// across transports.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type ServerCapabilities,
} from "@modelcontextprotocol/sdk/types.js";
import type { Server as McpServer } from "@modelcontextprotocol/sdk/server/index.js";
import type { Logger } from "pino";
import type { OrchestratorConfig } from "../config.js";
import type { ProvisionJobRepository } from "../storage/repositories/provisionJobRepository.js";
import { registerResources } from "./registerResources.js";
import { registerPrompts } from "./registerPrompts.js";
import { registerHealthCheckTool } from "./registerTools.js";
import { SessionRegistry } from "./sessionCapabilities.js";
import { createToolRegistry, type ToolRegistry } from "./toolRegistry.js";
import type { ProjectRepository } from "../storage/repositories/projectRepository.js";
import type { ContextPackRepository } from "../storage/repositories/contextPackRepository.js";
import type { ReadinessRepository } from "../storage/repositories/readinessRepository.js";
import type { TraceLinkRepository } from "../storage/repositories/traceLinkRepository.js";

export const ORCHESTRATOR_SERVER_CAPABILITIES: ServerCapabilities = {
  tools: { listChanged: true },
  prompts: { listChanged: true },
  resources: { subscribe: true, listChanged: true },
  logging: {},
};

export interface BuildServerArgs {
  config: OrchestratorConfig;
  logger: Logger;
  sessionRegistry: SessionRegistry;
  resolveCurrentSessionId: () => string | undefined;
  startedAt: Date;
  /** Optional persistent provision-job state for `orchestrator://job/...` resources. */
  provisionJobs?: ProvisionJobRepository;
  projectRepository?: ProjectRepository;
  contextPacks?: ContextPackRepository;
  readiness?: ReadinessRepository;
  traceLinks?: TraceLinkRepository;
  /**
   * Optional callback invoked with the registry so callers can register
   * additional tools (project_preflight_check, project_profile_get, M5+
   * provisioning tools, etc.) before the dispatcher locks in.
   */
  registerExtraTools?: (registry: ToolRegistry, server: McpServer) => void;
}

export function buildServer(args: BuildServerArgs): Server {
  const {
    config,
    logger,
    sessionRegistry,
    resolveCurrentSessionId,
    startedAt,
    registerExtraTools,
    provisionJobs,
    projectRepository,
    contextPacks,
    readiness,
    traceLinks,
  } = args;

  const server = new Server(
    {
      name: config.serverInfo.name,
      version: config.serverInfo.version,
    },
    {
      capabilities: ORCHESTRATOR_SERVER_CAPABILITIES,
    },
  );

  // Build a tool registry, populate it, then install ONE dispatcher.
  const toolRegistry = createToolRegistry();
  registerHealthCheckTool({ registry: toolRegistry, config, sessionRegistry, startedAt, logger });
  if (registerExtraTools) registerExtraTools(toolRegistry, server);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [...toolRegistry.list()],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const handler = toolRegistry.get(request.params.name);
    if (!handler) {
      throw new Error(`unknown tool: ${request.params.name}`);
    }
    return handler(request.params.arguments);
  });

  registerPrompts(server);

  registerResources({
    server,
    sessionRegistry,
    resolveCurrentSessionId,
    logger,
    ...(provisionJobs ? { provisionJobs } : {}),
    ...(projectRepository ? { projectRepository } : {}),
    ...(contextPacks ? { contextPacks } : {}),
    ...(readiness ? { readiness } : {}),
    ...(traceLinks ? { traceLinks } : {}),
  });

  return server;
}
