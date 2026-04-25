// admin.sessions.list — active MCP sessions on the agent transport.
// Reads the in-memory SessionRegistry attached to the agent /mcp transport
// (port 3000). The admin /mcp transport's own sessions are not surfaced;
// they're operator-internal.

import { z } from "zod";
import type { AdminToolDeps } from "../registry.js";
import type { ToolRegistry } from "../../toolRegistry.js";

const SESSION = z.object({
  sessionId: z.string(),
  protocolVersion: z.string(),
  clientName: z.string().optional(),
  clientVersion: z.string().optional(),
  negotiatedAt: z.string(),
  featuresEnabled: z.array(z.string()),
  featuresDisabled: z.array(z.object({ feature: z.string(), reason: z.string() })),
});

const OUTPUT = z.object({
  sessions: z.array(SESSION),
  totalActive: z.number().int().nonnegative(),
  cap: z.number().int().nonnegative(),
});

export function registerSessionsAdminTool(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.sessions.list",
      description: "List active agent-facing MCP sessions with negotiated capabilities.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { title: "Admin: sessions", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler() {
      const sessions = deps.agentSessionRegistry.list().map((p) => ({
        sessionId: p.sessionId,
        protocolVersion: p.negotiatedProtocolVersion,
        ...(p.clientInfo?.name ? { clientName: p.clientInfo.name } : {}),
        ...(p.clientInfo?.version ? { clientVersion: p.clientInfo.version } : {}),
        negotiatedAt: p.negotiatedAt,
        featuresEnabled: [...p.featuresEnabled],
        featuresDisabled: p.featuresDisabled.map((f) => ({ feature: f.feature, reason: f.reason })),
      }));
      const output = OUTPUT.parse({
        sessions,
        totalActive: sessions.length,
        cap: deps.config.http.maxConcurrentSessions,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  });
}
