import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  LATEST_PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
  type ClientCapabilities,
  type Implementation,
  type ServerCapabilities,
} from "@modelcontextprotocol/sdk/types.js";
import { buildSessionProfile, type SessionRegistry } from "./sessionCapabilities.js";

export interface InitializeParamsSnapshot {
  readonly protocolVersion: string;
  readonly clientInfo: Implementation | undefined;
  readonly capabilities: ClientCapabilities;
}

export function extractInitializeParams(message: unknown): InitializeParamsSnapshot | undefined {
  const messages = Array.isArray(message) ? message : [message];
  for (const item of messages) {
    const maybe = item as { method?: unknown; params?: unknown };
    if (maybe.method !== "initialize") continue;
    const params = maybe.params as Partial<InitializeParamsSnapshot> | undefined;
    if (!params || typeof params.protocolVersion !== "string") continue;
    return {
      protocolVersion: params.protocolVersion,
      clientInfo: params.clientInfo,
      capabilities: params.capabilities ?? {},
    };
  }
  return undefined;
}

export function recordNegotiatedSession(args: {
  readonly sessionRegistry: SessionRegistry;
  readonly sessionId: string;
  readonly server: Server;
  readonly serverCapabilities: ServerCapabilities;
  readonly initializeParams: InitializeParamsSnapshot;
}): void {
  const capabilities = args.server.getClientCapabilities() ?? args.initializeParams.capabilities;
  const clientInfo = args.server.getClientVersion() ?? args.initializeParams.clientInfo;
  args.sessionRegistry.register(
    buildSessionProfile({
      sessionId: args.sessionId,
      negotiatedProtocolVersion: negotiateProtocolVersion(args.initializeParams.protocolVersion),
      clientInfo,
      clientCapabilities: capabilities,
      serverCapabilities: args.serverCapabilities,
    }),
  );
}

export function negotiateProtocolVersion(requestedVersion: string): string {
  return (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requestedVersion)
    ? requestedVersion
    : LATEST_PROTOCOL_VERSION;
}
