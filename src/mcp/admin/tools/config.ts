// admin.config.env.get / admin.config.flags.list — operator settings screen.
// Reads orchestrator config + milestone feature flags. Secrets are never
// returned (any *_TOKEN, *_PASSWORD, *_KEY env var is filtered out).

import { z } from "zod";
import type { AdminToolDeps } from "../registry.js";
import type { ToolRegistry } from "../../toolRegistry.js";

const ENV_OUTPUT = z.object({
  serverInfo: z.object({ name: z.string(), version: z.string() }),
  transport: z.string(),
  http: z.object({ host: z.string(), port: z.number().int(), maxConcurrentSessions: z.number().int(), sessionTtlSeconds: z.number().int() }),
  mgmt: z.object({ host: z.string(), port: z.number().int() }),
  deployment: z.object({ nodeEnv: z.string(), tier: z.string() }),
  logging: z.object({ level: z.string(), filePath: z.string() }),
});

const FLAG = z.object({
  name: z.string(),
  enabled: z.boolean(),
  envVar: z.string(),
  description: z.string(),
});

const FLAGS_OUTPUT = z.object({
  flags: z.array(FLAG),
});

const FLAG_DEFS: ReadonlyArray<{ key: keyof import("../../../config.js").MilestoneFlags; envVar: string; description: string }> = [
  { key: "milestone4Enabled",  envVar: "MILESTONE_4_ENABLED",  description: "M4 — intake + blueprint + sampling" },
  { key: "milestone5Enabled",  envVar: "MILESTONE_5_ENABLED",  description: "M5 — provisioning planner + preview" },
  { key: "milestone6aEnabled", envVar: "MILESTONE_6A_ENABLED", description: "M6a — Jira provisioning executor + audit signing" },
  { key: "milestone6bEnabled", envVar: "MILESTONE_6B_ENABLED", description: "M6b — Confluence provisioning executor" },
  { key: "milestone6cEnabled", envVar: "MILESTONE_6C_ENABLED", description: "M6c — VCS provisioning executor" },
  { key: "milestone7Enabled",  envVar: "MILESTONE_7_ENABLED",  description: "M7 — context resources + packs" },
  { key: "milestone8Enabled",  envVar: "MILESTONE_8_ENABLED",  description: "M8 — readiness validation" },
  { key: "milestone9Enabled",  envVar: "MILESTONE_9_ENABLED",  description: "M9 — agent handoff" },
  { key: "milestone10Enabled", envVar: "MILESTONE_10_ENABLED", description: "M10 — webhook ingestion" },
  { key: "milestone11Enabled", envVar: "MILESTONE_11_ENABLED", description: "M11 — notifications + evals + metrics" },
  { key: "persistentAgentMemoryEnabled", envVar: "PERSISTENT_AGENT_MEMORY_ENABLED", description: "Project-scoped agent memory across MCP sessions" },
  { key: "agentMemoryVectorEnabled", envVar: "AGENT_MEMORY_VECTOR_ENABLED", description: "Additive vector recall for project-scoped agent memory" },
];

export function registerConfigAdminTools(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.config.env.get",
      description: "Non-sensitive environment + transport + deployment config for the operator settings screen.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { title: "Admin: env config", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler() {
      const c = deps.config;
      const output = ENV_OUTPUT.parse({
        serverInfo: { name: c.serverInfo.name, version: c.serverInfo.version },
        transport: c.transport,
        http: { host: c.http.host, port: c.http.port, maxConcurrentSessions: c.http.maxConcurrentSessions, sessionTtlSeconds: c.http.sessionTtlSeconds },
        mgmt: { host: c.mgmt.host, port: c.mgmt.port },
        deployment: { nodeEnv: c.deployment.nodeEnv, tier: c.deployment.tier },
        logging: { level: c.logging.level, filePath: c.logging.filePath },
      });
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  });

  registry.register({
    definition: {
      name: "admin.config.flags.list",
      description: "Feature flags for milestones and promoted deferred capabilities.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { title: "Admin: feature flags", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler() {
      const flags = FLAG_DEFS.map((f) => ({
        name: f.key,
        enabled: deps.config.flags[f.key],
        envVar: f.envVar,
        description: f.description,
      }));
      const output = FLAGS_OUTPUT.parse({ flags });
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  });
}
