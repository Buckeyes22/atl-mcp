// Registers health_check into the tool registry. Other modules register their
// own tools into the same registry; buildServer.ts installs a single
// dispatcher.

import { z } from "zod";
import type { Logger } from "pino";
import type { OrchestratorConfig } from "../config.js";
import type { SessionRegistry } from "./sessionCapabilities.js";
import type { ToolRegistry } from "./toolRegistry.js";

const HEALTH_CHECK_OUTPUT = z.object({
  status: z.literal("ok"),
  service: z.string(),
  version: z.string(),
  deploymentTier: z.string(),
  uptimeSeconds: z.number(),
  activeSessions: z.number().int().nonnegative(),
  transports: z.array(z.string()),
  serverTimeIso: z.string(),
});

export type HealthCheckOutput = z.infer<typeof HEALTH_CHECK_OUTPUT>;

interface RegisterArgs {
  registry: ToolRegistry;
  config: OrchestratorConfig;
  sessionRegistry: SessionRegistry;
  startedAt: Date;
  logger: Logger;
}

export function registerHealthCheckTool(args: RegisterArgs): void {
  const { registry, config, sessionRegistry, startedAt, logger } = args;

  registry.register({
    definition: {
      name: "health_check",
      description: "Returns server health: service name, version, uptime, active session count, configured transports.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: {
        title: "Health check",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async handler() {
      const transports: string[] = [];
      if (config.transport === "stdio" || config.transport === "both") transports.push("stdio");
      if (config.transport === "http" || config.transport === "both") transports.push("http");

      const output: HealthCheckOutput = HEALTH_CHECK_OUTPUT.parse({
        status: "ok",
        service: config.serverInfo.name,
        version: config.serverInfo.version,
        deploymentTier: config.deployment.tier,
        uptimeSeconds: Math.round((Date.now() - startedAt.getTime()) / 1000),
        activeSessions: sessionRegistry.size(),
        transports,
        serverTimeIso: new Date().toISOString(),
      });
      logger.debug({ tool: "health_check", output }, "tool invocation");

      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  });
}

export const _internals = { HEALTH_CHECK_OUTPUT };
