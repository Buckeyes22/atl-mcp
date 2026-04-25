# Partner Integration: mcp_daemon

## 1. Why this partner

**Category: B (pattern-lift).** mcp_daemon is a Rust MCP daemon contributing the multi-transport `Transport` trait abstraction:

- **F-040**: Multi-transport `Transport` trait abstraction (stdio + WebSocket + HTTP/2 + SSE + InMemory) → §22 (architecture reference)

**Gap closed**: v6 §22 requires a multi-transport architecture exposing same tool/resource/prompt registrations across stdio, HTTP, and optional SSE. mcp_daemon's trait-based abstraction is the canonical reference for boundary design and transport-agnostic buffering. The orchestrator's TS port adopts the trait shape (overlaps with project-foundation F-028).

**Alternatives considered**: implement transports as separate code paths per handler (rejected — tight coupling, duplicated validation); use a generic multiplexer in hono/fastify (rejected — doesn't scale to HTTP/2 + ACME + InMemory test modes).

Findings reference: `repo-extraction-findings.md` lines 428–438, §40 F-040.

## 2. Prerequisites

N/A — pattern-lift; orchestrator does not run Rust binary. Rust toolchain not required for orchestrator deployment.

## 3. Source provenance

`mcp_daemon` Rust source. Pin commit SHA in v6 §40 F-040 row. **No install required**; clone for architectural study only. The orchestrator's TS `Transport<T>` interface (project-foundation F-028) absorbs the trait shape.

## 4. Configuration

### 4.1 Environment variables

N/A — pattern-lift.

### 4.2 Config file overlays

```yaml
transport:
  variants:
    - stdio
    - websocket
    - http2
    - sse
    - inMemory   # test-only
  default: stdio
  http2:
    bindAddress: 0.0.0.0:3000
    tls:
      certPath: /etc/orchestrator/cert.pem
      keyPath:  /etc/orchestrator/key.pem
      acmeEnabled: false
```

## 5. Adoption points in v6

- **F-040** → **§22 (architecture reference)**: mcp_daemon's Transport trait shape adopted as TS `interface Transport<T>` (cross-link project-foundation F-028); five transport variants implemented (stdio + WebSocket + HTTP/2 + SSE + InMemory); test-only InMemory variant excluded from production.

## 6. Pattern excerpts

**Rust trait shape** (mcp_daemon `src/transport/mod.rs:46-78`):
```rust
pub trait Transport: Send + Sync {
  async fn send(&self, msg: JsonRpcMessage) -> Result<()>;
  async fn recv(&mut self) -> Result<JsonRpcMessage>;
  async fn close(&self) -> Result<()>;
}
```

**TS port** (`src/transport/Transport.ts`, also adopted from project-foundation F-028):
```ts
export interface Transport<T> {
  send(message: T): Promise<void>;
  receive(): Promise<T>;
  close(): Promise<void>;
  isConnected(): boolean;
}

export class StdioTransport       implements Transport<JsonRpcMessage> { /* ... */ }
export class HttpTransport        implements Transport<JsonRpcMessage> { /* HTTP/2 via hono/fastify */ }
export class WebSocketTransport   implements Transport<JsonRpcMessage> { /* native TLS */ }
export class SseTransport         implements Transport<JsonRpcMessage> { /* feature-gated */ }
export class InMemoryTransport    implements Transport<JsonRpcMessage> { /* test only */ }
```

**5 variants**:
- `stdio` — subprocess JSON-RPC 2.0 piping (198 LoC reference)
- `WebSocket` — native TLS, RFC 6455 (629 LoC)
- `HTTP/2` — Rustls + ACME cert provisioning, backpressure buffering (1350 LoC)
- `SSE` — Server-Sent Events, feature-gated (385 LoC)
- `InMemory` — test doubles, no I/O (~269 LoC)

## 7. Gotchas

1. **Trait abstraction overhead vs raw clients**: vtable indirection per message. For high-throughput (>1000 msg/sec), measure dispatch cost. The orchestrator's 50ms batching window (§22.1) amortizes; unbatched transports see ~5% latency tax. (findings.md L430; F-040)
2. **InMemory transport for tests vs production**: test-only; holds messages in unbounded vector. Never instantiate in production (will OOM on long sessions). Tests using InMemory must teardown after assertions. (findings.md L431; F-040)
3. **HTTP/2 server requires ACME or pre-provisioned certs.** mcp_daemon's HTTP/2 includes Rustls + optional ACME. TS port (hono/fastify) needs externally provisioned certs or ACME wrapper. HTTP/1.1 simpler but loses multiplexing; confirm protocol requirements. (findings.md L432; F-040)
4. **WebSocket reconnect logic is not transparent.** mcp_daemon's WebSocket transport does not auto-reconnect on partition. Callers must implement retry-with-backoff outside the trait. The orchestrator's WebSocket layer adds reconnect wrapper; do not assume trait handles it. (findings.md L433; F-040)

## 8. Validation

```bash
# 1. Verify v6 §22 references 5-transport architecture
grep -nE "stdio|WebSocket|HTTP/2|SSE|InMemory|Transport.*trait" agent-context-orchestrator-mcp-plan-v6.md | head -10

# 2. Verify orchestrator implements 5 variants
grep -lE "class StdioTransport|class HttpTransport|class WebSocketTransport|class SseTransport|class InMemoryTransport" src/transport/

# 3. InMemory absent from production config
grep -E "transport.*default|transport.*production" config/production.yaml | grep -v inMemory
# Expect: no inMemory in production
```

## 9. Operational concerns

- **Upstream archival risk: low.** mcp_daemon is a Rust reference; the trait abstraction is generic. TS port has no runtime dependency on mcp_daemon repo. Adoption risk is low.
- **In-tree absorption**: `src/transport/Transport.ts` (interface), `src/transport/{Stdio,Http,WebSocket,Sse,InMemory}Transport.ts` (variants). Cross-link with project-foundation F-028 — same interface shape.
- **Ownership**: orchestrator team owns TS interface + 5 variant implementations. mcp_daemon team owns Rust reference; no runtime coupling.
- **Promotion**: not applicable — pattern-lift only.
- **Disaster recovery**: transport variants are stateless (handlers are stateful layer). Session data lives in Redis (§22.1); transport-layer failures do not corrupt session state.
