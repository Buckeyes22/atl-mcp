// McpSessionProfile capture per v6 §2 (session capability negotiation).
// Server records what was negotiated during initialize; subsequent feature
// gating consults this profile rather than assuming.
//
// Exposed via:
//   orchestrator://session/current/capabilities  (always available; debug)
//   orchestrator://session/current/preflight     (auto-pinned per mengram F-053)

import type { Implementation, ServerCapabilities, ClientCapabilities } from "@modelcontextprotocol/sdk/types.js";

export interface McpSessionProfile {
  readonly sessionId: string;
  readonly negotiatedProtocolVersion: string;
  readonly clientInfo: Implementation | undefined;
  readonly clientCapabilities: ClientCapabilities;
  readonly serverCapabilities: ServerCapabilities;
  readonly negotiatedAt: string; // ISO8601
  readonly featuresEnabled: readonly string[];
  readonly featuresDisabled: ReadonlyArray<{ feature: string; reason: string }>;
}

/**
 * In-memory registry of active MCP session profiles, keyed by session id.
 * Single-tenant, single-process for v1; will move to Redis when multi-process
 * deployments land (post-v1, see v6 §7.3).
 */
export class SessionRegistry {
  private readonly sessions = new Map<string, McpSessionProfile>();

  register(profile: McpSessionProfile): void {
    this.sessions.set(profile.sessionId, profile);
  }

  get(sessionId: string): McpSessionProfile | undefined {
    return this.sessions.get(sessionId);
  }

  remove(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  list(): readonly McpSessionProfile[] {
    return [...this.sessions.values()];
  }

  size(): number {
    return this.sessions.size;
  }
}

/**
 * Build an McpSessionProfile from an MCP initialize handshake.
 * Caller passes the negotiated values; we just compose + timestamp them.
 */
export function buildSessionProfile(input: {
  sessionId: string;
  negotiatedProtocolVersion: string;
  clientInfo: Implementation | undefined;
  clientCapabilities: ClientCapabilities;
  serverCapabilities: ServerCapabilities;
}): McpSessionProfile {
  const featuresEnabled: string[] = [];
  const featuresDisabled: Array<{ feature: string; reason: string }> = [];

  // Sampling: only enabled if client advertised it (v6 §2 rule 1).
  if (input.clientCapabilities.sampling) {
    featuresEnabled.push("sampling");
  } else {
    featuresDisabled.push({ feature: "sampling", reason: "client did not advertise sampling capability" });
  }

  // Elicitation: only enabled if client advertised it (v6 §2 rule 2).
  if (input.clientCapabilities.elicitation) {
    featuresEnabled.push("elicitation");
  } else {
    featuresDisabled.push({ feature: "elicitation", reason: "client did not advertise elicitation capability" });
  }

  // Resource subscriptions: only emitted if both sides support (v6 §2 rule 5).
  const clientSupportsRoots = Boolean(input.clientCapabilities.roots);
  const serverSupportsSubscribe = Boolean(input.serverCapabilities.resources?.subscribe);
  if (serverSupportsSubscribe && clientSupportsRoots) {
    featuresEnabled.push("resources.subscribe");
  } else if (!serverSupportsSubscribe) {
    featuresDisabled.push({ feature: "resources.subscribe", reason: "server did not declare resources.subscribe" });
  }

  return {
    sessionId: input.sessionId,
    negotiatedProtocolVersion: input.negotiatedProtocolVersion,
    clientInfo: input.clientInfo,
    clientCapabilities: input.clientCapabilities,
    serverCapabilities: input.serverCapabilities,
    negotiatedAt: new Date().toISOString(),
    featuresEnabled,
    featuresDisabled,
  };
}
