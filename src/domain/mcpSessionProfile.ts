// PERSISTED McpSessionProfile per v6 §10.
//
// NOTE: there is a separate ephemeral runtime tracker in src/mcp/sessionCapabilities.ts
// — that one tracks live in-memory negotiation state. THIS one is the durable
// audit record persisted across restarts. The two shapes overlap but do not
// match exactly; use toPersistedProfile() to convert.

export type AgentMode =
  | "worker"
  | "coordinator"
  | "coordinated-worker"
  | "coordinated-coordinator";

export interface PersistedClientCapabilities {
  readonly roots: boolean;
  readonly sampling: boolean;
  readonly elicitation: boolean;
  readonly tasks: boolean;
  readonly resourcePinning?: boolean;
}

export interface PersistedMcpSessionProfile {
  readonly id: string;
  readonly tenantId: string;
  readonly protocolVersion: string;
  readonly clientInfo: {
    readonly name: string;
    readonly title?: string;
    readonly version?: string;
  };
  readonly clientCapabilities: PersistedClientCapabilities;
  readonly enabledServerFeatures: readonly string[];
  readonly disabledFeatureReasons: Readonly<Record<string, string>>;
  /** 4-mode agent classification per agent-maestro F-060. */
  readonly agentMode?: AgentMode;
  readonly createdAt: string;
  readonly lastSeenAt: string;
}
