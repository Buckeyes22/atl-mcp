import { readBoolean, readEnum, readNumber, readOptionalString, readString } from "./config/env.js";

export type TransportMode = "stdio" | "http" | "both";
export type DeploymentTier = "dev" | "test" | "staging" | "production";

export interface MilestoneFlags {
  readonly milestone4Enabled: boolean;   // intake + blueprint + sampling
  readonly milestone5Enabled: boolean;   // provisioning planner + preview
  readonly milestone6aEnabled: boolean;  // Jira provisioning executor
  readonly milestone6bEnabled: boolean;  // Confluence provisioning executor
  readonly milestone6cEnabled: boolean;  // VCS provisioning executor
  readonly milestone7Enabled: boolean;   // context resources + packs
  readonly milestone8Enabled: boolean;   // readiness validation
  readonly milestone9Enabled: boolean;   // agent handoff
  readonly milestone10Enabled: boolean;  // webhook ingestion
  readonly milestone11Enabled: boolean;  // notifications + evals
  readonly persistentAgentMemoryEnabled: boolean; // project-scoped memory across MCP sessions
  readonly agentMemoryVectorEnabled: boolean;     // additive vector recall for agent memory
}

export interface OrchestratorConfig {
  readonly transport: TransportMode;
  readonly http: {
    readonly port: number;
    readonly host: string;
    readonly sessionTtlSeconds: number;
    readonly sseKeepAliveMs: number;
    readonly maxConcurrentSessions: number;
  };
  readonly mgmt: {
    readonly port: number;
    readonly host: string;
  };
  readonly webhooks: {
    readonly port: number;
    readonly host: string;
  };
  readonly logging: {
    readonly level: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
    readonly filePath: string;
  };
  readonly deployment: {
    readonly nodeEnv: string;
    readonly tier: DeploymentTier;
  };
  readonly serverInfo: {
    readonly name: string;
    readonly version: string;
  };
  readonly flags: MilestoneFlags;
}

const TRANSPORT_MODES = ["stdio", "http", "both"] as const;
const LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"] as const;
const DEPLOYMENT_TIERS = ["dev", "test", "staging", "production"] as const;

export function loadConfig(): OrchestratorConfig {
  return {
    transport: readEnum("MCP_TRANSPORT", TRANSPORT_MODES, "both"),
    http: {
      port: readNumber("MCP_HTTP_PORT", 3000),
      host: readString("MCP_HTTP_HOST", "0.0.0.0"),
      sessionTtlSeconds: readNumber("MCP_HTTP_SESSION_TTL_SECONDS", 3600),
      sseKeepAliveMs: readNumber("MCP_HTTP_SSE_KEEP_ALIVE_MS", 25_000),
      maxConcurrentSessions: readNumber("MCP_HTTP_MAX_CONCURRENT_SESSIONS", 1000),
    },
    mgmt: {
      port: readNumber("MGMT_API_PORT", 3001),
      host: readString("MGMT_API_HOST", "127.0.0.1"),
    },
    webhooks: {
      port: readNumber("WEBHOOK_HTTP_PORT", 3002),
      host: readString("WEBHOOK_HTTP_HOST", "0.0.0.0"),
    },
    logging: {
      level: readEnum("LOG_LEVEL", LOG_LEVELS, "info"),
      filePath: readString("LOG_FILE_PATH", "./orchestrator.log"),
    },
    deployment: {
      nodeEnv: readString("NODE_ENV", "development"),
      tier: readEnum("DEPLOYMENT_TIER", DEPLOYMENT_TIERS, "dev"),
    },
    serverInfo: {
      name: readString("ORCHESTRATOR_NAME", "atl-mcp-orchestrator"),
      version: readOptionalString("ORCHESTRATOR_VERSION") ?? "0.1.0",
    },
    flags: {
      milestone4Enabled: readBoolean("MILESTONE_4_ENABLED", true),
      milestone5Enabled: readBoolean("MILESTONE_5_ENABLED", true),
      milestone6aEnabled: readBoolean("MILESTONE_6A_ENABLED", true),
      milestone6bEnabled: readBoolean("MILESTONE_6B_ENABLED", true),
      milestone6cEnabled: readBoolean("MILESTONE_6C_ENABLED", true),
      milestone7Enabled: readBoolean("MILESTONE_7_ENABLED", true),
      milestone8Enabled: readBoolean("MILESTONE_8_ENABLED", true),
      milestone9Enabled: readBoolean("MILESTONE_9_ENABLED", true),
      milestone10Enabled: readBoolean("MILESTONE_10_ENABLED", true),
      milestone11Enabled: readBoolean("MILESTONE_11_ENABLED", true),
      persistentAgentMemoryEnabled: readBoolean("PERSISTENT_AGENT_MEMORY_ENABLED", true),
      agentMemoryVectorEnabled: readBoolean("AGENT_MEMORY_VECTOR_ENABLED", false),
    },
  };
}
