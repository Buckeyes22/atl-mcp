# Partner Integration: atomic-agents

## 1. Why this partner

**Category: B (pattern-lift).** atomic-agents is the multi-transport MCP **client** reference for v6 §19 (Rovo provider design) and §22 (client-side transport):

- **F-034**: Multi-transport MCP client reference (STDIO + SSE + HTTP Stream) with persistent session reuse → §19, §22

**Gap closed**: v6 §19 names the Rovo provider as the abstraction for orchestrator-to-upstream-MCP-server calls (status polling, context fetch). v6 §22 specifies dual-port transport. atomic-agents demonstrates the **client-side counterpart**: how to choose among transport types at runtime, maintain persistent session pools, handle transport-specific error semantics, and reuse connections across request cycles without recreating handshakes (`AsyncExitStack` pattern).

**Alternatives considered**: implement transport selection from scratch (rejected — multi-transport orchestration is non-trivial); use only HTTP client libraries (rejected — STDIO + SSE upstream support required for some MCP servers).

Findings reference: `repo-extraction-findings.md` lines 646–658, §40 F-034.

## 2. Prerequisites

N/A — pattern-lift; no runtime dependency on atomic-agents. The orchestrator ports the patterns to TypeScript using `@modelcontextprotocol/sdk` for the Rovo provider client.

## 3. Source provenance

`atomic-agents` repository (Python). Pin commit SHA in v6 §40 F-034 row. **No install required**; pattern reference only. Port logic to TypeScript in `src/providers/rovo/transports/`.

## 4. Configuration

### 4.1 Environment variables

N/A — pattern-lift. Transport selection wired via orchestrator config.

### 4.2 Config file overlays

```yaml
providers:
  rovo:
    transportType: http_stream      # stdio | sse | http_stream
    baseUrl: http://upstream-mcp:3000
    sessionTtlSeconds: 3600
    persistentSession: true
    fallbackTransport: stdio
```

## 5. Adoption points in v6

- **F-034** → **§19 (Rovo provider design)** + **§22 (client-side transport)**: 3-transport client class hierarchy (StdioMcpClient / SseMcpClient / HttpStreamMcpClient), persistent session reuse via `AsyncExitStack`-like pattern, transport-selection rule based on upstream capabilities, transport-mismatch fallback to STDIO.

## 6. Pattern excerpts

**3 transport client classes** (`src/providers/rovo/transports/`, ported from atomic-agents Python reference):

```ts
export class StdioMcpClient {
  constructor(readonly serverPath: string) {}
  async initialize(): Promise<void> { /* spawn subprocess */ }
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> { /* JSON-RPC over stdin/stdout */ }
}

export class SseMcpClient {
  constructor(readonly baseUrl: string) {}
  async initialize(): Promise<void> { /* EventSource open */ }
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> { /* POST tool, SSE subscribe response */ }
}

export class HttpStreamMcpClient {
  private sessionId: string;
  constructor(readonly baseUrl: string, readonly sessionTtl: number) {}
  async initialize(): Promise<void> { this.sessionId = await this.openSession(); }
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> { /* POST /session/{id}/call */ }
}
```

**Persistent session pattern**:
```ts
export async function createPersistentSession(config: RovoConfig): Promise<McpClient> {
  const client = selectClientClass(config);
  await client.initialize();
  return client;   // Caller holds in resource scope; reuse across multiple calls
}

function selectClientClass(config: RovoConfig): McpClient {
  if (config.transportType === "http_stream" && config.baseUrl) return new HttpStreamMcpClient(config.baseUrl, config.sessionTtl);
  if (config.transportType === "sse")                            return new SseMcpClient(config.baseUrl);
  return new StdioMcpClient(config.serverPath);
}
```

## 7. Gotchas

1. **Transport type mismatch detection must happen early.** atomic-agents detects at client init; orchestrator's Rovo provider must validate transport-upstream compatibility before enqueueing long-running jobs. Probe upstream URL (HEAD + 200 → HTTP available; else fallback to STDIO). (findings.md L647; F-034)
2. **SSE vs HTTP Stream client semantics differ significantly.** SSE is unidirectional (server pushes); HTTP Stream is bidirectional. SSE waits for response via long-poll (inefficient for high-throughput); HTTP Stream uses POST + await. Confirm upstream capabilities before selecting. (findings.md L648; F-034)
3. **Persistent session reuse requires affinity.** All calls must route to same upstream instance (no LB round-robin between calls). Load-balanced upstreams need sticky sessions or per-call session init (lose reuse benefit). (findings.md L649; F-034)
4. **Session lifecycle: heartbeat, reconnect, TTL.** HTTP Stream sessions expire after `sessionTtlSeconds` (default 3600). Calls near TTL expiry may complete after session reaped. Strategies: refresh TTL per call (cost), heartbeat every 300s (overhead), accept failures in last 60s. Document chosen strategy. (findings.md L650; F-034)
5. **Connection pool exhaustion on STDIO.** STDIO spawns subprocess per client; N concurrent STDIO clients spawn N subprocesses. For M upstreams × N concurrent, limit STDIO spawning or switch to HTTP Stream. atomic-agents caps STDIO pools; enforce same. (findings.md L647; F-034)

## 8. Validation

```bash
# 1. Verify v6 §19 + §22 reference 3 transport types
grep -nE "stdio|sse|http_stream|HttpStreamMcpClient|SseMcpClient|StdioMcpClient" agent-context-orchestrator-mcp-plan-v6.md | head -10

# 2. Verify orchestrator implements 3 transport classes
ls src/providers/rovo/transports/
# Expect: StdioMcpClient.ts, SseMcpClient.ts, HttpStreamMcpClient.ts

# 3. Session reuse smoke
orchestrator cli rovo test-session --reuse
# Expect: same sessionId across 2 successive calls
```

## 9. Operational concerns

- **Upstream archival risk: low.** atomic-agents is reference only; the patterns (enum-based transport selection, AsyncExitStack-style session lifecycle) are standard MCP client idioms. Even if archived, patterns remain valid. TS port in `src/providers/rovo/transports/` is independent.
- **In-tree absorption**: 3 client classes + transport selector + session lifecycle in `src/providers/rovo/transports/`.
- **Promotion**: not applicable — orchestrator owns implementation.
- **Disaster recovery**: Rovo sessions are ephemeral; loss triggers transparent reconnect. No data loss.
- **Post-v1 extension**: when scaling to ≥10 upstream MCP servers, implement connection pooling + worker-affinity routing to minimize session churn (cross-link with agent-maestro F-064).
