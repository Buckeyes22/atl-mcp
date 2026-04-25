// Admin MCP Server factory — analogous to src/mcp/buildServer.ts but holds the
// `admin.*` tool registry (per ADR 0006) and is mounted on the loopback
// transport at 127.0.0.1:3001/mcp. Resources are not exposed on the admin
// transport in v1; the operator UI consumes tools only.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type ServerCapabilities,
} from "@modelcontextprotocol/sdk/types.js";
import { createToolRegistry } from "../toolRegistry.js";
import { registerAdminTools, type AdminToolDeps } from "./registry.js";

export const ADMIN_SERVER_CAPABILITIES: ServerCapabilities = {
  tools: {},
  logging: {},
};

export function buildAdminServer(deps: AdminToolDeps): Server {
  const server = new Server(
    {
      name: `${deps.config.serverInfo.name}-admin`,
      version: deps.config.serverInfo.version,
    },
    {
      capabilities: ADMIN_SERVER_CAPABILITIES,
    },
  );

  const registry = createToolRegistry();
  registerAdminTools(deps, registry);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [...registry.list()],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const handler = registry.get(request.params.name);
    if (!handler) {
      throw new Error(`unknown admin tool: ${request.params.name}`);
    }
    return handler(request.params.arguments);
  });

  return server;
}
