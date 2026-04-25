# Partner Integration: mcpd

## 1. Why this partner

**Category: B (pattern-lift).** mcpd is the reference architecture for v6 §2 (Rovo mediation) and §19 (Rovo provider). It is a Rust MCP aggregator/proxy that multiplexes multiple upstream MCP servers behind a unified MCP interface, targeting MCP spec **2025-11-25**. The orchestrator adopts mcpd's **mediation/aggregator design pattern** — not the binary itself — to proxy upstream MCP providers (Rovo + future) and expose them through a single `list_tools` + `use_tool` namespace. mcpd demonstrates JSON-RPC multiplexing with concurrent-safe state management, hot-reload registry patterns, and pass-through of resources/prompts.

**Gap closed**: v6 §2 and §19 require orchestrating multiple upstream MCP servers as a single logical provider. mcpd's aggregator pattern is the proven design; porting its architecture to `src/providers/rovo/RovoMediationProvider.ts` avoids re-implementing JSON-RPC multiplexing and request routing logic.

**Alternatives considered**: build mediation in-house (2–3 weeks of async state machinery); use mcp_daemon (multi-transport trait model — more complex). mcpd is the tightest fit for v1.

Findings reference: `repo-extraction-findings.md` lines 447–453, §40 F-033.

## 2. Prerequisites

N/A — pattern-lift; no runtime dependency. Pattern reference uses MCP spec **2025-11-25** (mcpd's hand-rolled `mcp.rs`, ~480 LoC). The orchestrator's TS port uses `@modelcontextprotocol/sdk` + `zod` for type validation. No Rust toolchain required for pattern adoption.

## 3. Source provenance

mcpd reference: pin commit SHA in v6 §40 F-033 row when chosen. **Do not vendor** the binary or crate. Clone for reference, extract architectural patterns from `src/mcp.rs` (types) and `src/main.rs` (registry + multiplexing loop), then port async JSON-RPC routing logic to TS.

## 4. Configuration

### 4.1 Environment variables

N/A — pattern-lift. Mediation provider is configured under `providers.rovo` in orchestrator's `config.yaml`.

### 4.2 Config file overlays

```yaml
providers:
  rovo:
    enabled: true
    upstreamServers:
      - id: rovo_search
        transport: stdio
        command: rovo-server
      - id: rovo_jira
        transport: http
        url: https://jira-mcp.example.com
    namespaceSeparator: "__"   # tool names exposed as "<server_id>__<tool_name>"
```

## 5. Adoption points in v6

- **F-033** → **§2 (Rovo mediation)**: mediation provider maintains an upstream registry, routes `use_tool("server__toolname", args)` to the correct server, and unifies `list_tools` across upstreams.
- **F-033** → **§19 (Rovo provider)**: Rovo provider implements the `Provider` interface using mcpd's aggregator pattern; pass-through of `resources/list`, `resources/read`, `prompts/list`, `prompts/get` per spec.

## 6. Pattern excerpts

Aggregator request-response pattern (mcpd-style; ported to TS):

```ts
// src/providers/rovo/RovoMediationProvider.ts
export class RovoMediationProvider implements Provider {
  private registry = new Map<string, UpstreamClient>();

  async listTools(): Promise<Tool[]> {
    const all = await Promise.all(
      [...this.registry.entries()].map(async ([sid, client]) => {
        const tools = await client.listTools();
        return tools.map(t => ({ ...t, name: `${sid}__${t.name}` }));
      })
    );
    return all.flat();
  }

  async useTool(qualifiedName: string, args: unknown): Promise<unknown> {
    const [serverId, toolName] = qualifiedName.split("__", 2);
    const client = this.registry.get(serverId);
    if (!client) throw new McpError(ErrorCode.InvalidParams, `unknown server: ${serverId}`);
    return client.callTool(toolName, args);  // oneshot channel keyed by request_id
  }
}
```

mcpd's dual-lock pattern (`init_lock` separate from state) prevents TOCTOU race on `initialized` flag; concurrent safety verified by regression tests (10× parallel calls + 10× concurrent `ensure_ready`). Port this to TS as `Promise.race`-guarded init or `p-limit`-style mutex.

## 7. Gotchas

1. **Spec version drift**: mcpd targets MCP spec **2025-11-25**. TS port must match; Zod schemas must validate against the same version. Drift in request/response shapes silently breaks multiplexing. (findings.md L447; F-033)
2. **Capability negotiation when proxying**: upstream servers may declare different capability sets. Mediation layer must union capabilities and gate tool availability by upstream. If one upstream dies, its tools fail (not degrade gracefully). (findings.md L448; F-033)
3. **Error propagation**: upstream error → JSON-RPC error code → orchestrator. Multiplex errors from N servers transparently. No synthetic aggregation; fail the specific tool call, not the entire mediation. (findings.md L449; F-033)
4. **Transport mismatch (stdio ↔ HTTP)**: mcpd proxies stdio servers; Rovo may be HTTP. Mediation must abstract transport. Ensure request/response wrapping handles both, or risk silent serialization failures. (findings.md L450; F-033)

## 8. Validation

```bash
# 1. Verify RovoMediationProvider class exists with registry + multiplexing
grep -n "RovoMediationProvider\|namespaceSeparator" src/providers/rovo/

# 2. Verify v6 §2 cites mediation pattern
grep -n "mediation\|aggregator" agent-context-orchestrator-mcp-plan-v6.md | head -10

# 3. Verify v6 §19 references upstream registry
grep -n "upstreamServers\|RovoProvider" agent-context-orchestrator-mcp-plan-v6.md | head -10

# 4. Spec version pinned
grep -n "2025-11-25" agent-context-orchestrator-mcp-plan-v6.md
```

## 9. Operational concerns

- **Upstream archival risk: low.** mcpd is a reference only; the pattern is algorithmic. If mcpd is archived, the TS port in `src/providers/rovo/RovoMediationProvider.ts` continues to function. Pattern absorption is complete once v1 ships.
- **Spec stability**: Rovo provider design depends on MCP spec stability, not mcpd releases. Lock spec version in §40 F-033; archive mcpd commit SHA for audit.
- **Ownership**: orchestrator team owns `RovoMediationProvider` and mediation tests; upstream MCP server teams own their servers. Joint ownership of JSON-RPC multiplexing contract.
- **Promotion**: not applicable — mcpd is informational; orchestrator owns implementation.
