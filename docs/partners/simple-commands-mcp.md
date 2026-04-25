# Partner Integration: simple-commands-mcp

## 1. Why this partner

Category: B (pattern-lift). simple-commands-mcp provides the canonical MCP stdio scaffolding pattern that v6 adopts wholesale. It demonstrates `@modelcontextprotocol/sdk@1.17.3` with clean `StdioServerTransport`, error handling via `McpError`, and critically, the **Winston file logger with explicit "stdout breaks MCP" operational discipline**. This is the reference implementation for the stdio transport and logging pattern used in v6 §9 (MCP server scaffold), §22 (transport choice), and M0 (initial scaffolding milestone). The orchestrator does not vendor simple-commands-mcp; it adopts the SDK scaffold and the operational rule ("do not write to stdout in stdio transports — all logging must go to file"). Alternatives (direct SDK usage without pattern reference) would replicate these lessons; simple-commands-mcp is the canonical lift source.

Findings reference: `repo-extraction-findings.md` lines 419–427, §40 F-031.

## 2. Prerequisites

N/A — pattern-lift; no runtime dependency on simple-commands-mcp itself. Implementing the pattern requires:
- `@modelcontextprotocol/sdk@1.17.3` (or current pinned version from the MCP SDK release channel).
- `winston` for file-only logging (stdout transport must be disabled).
- Node.js 18+ for native ESM + TypeScript ES2022 support.

## 3. Source provenance

**Repository**: simple-commands-mcp reference implementation. Pin to a specific v1.x release tag; record SHA in v6 §40 F-031 row. **No install required**: patterns are referenced in v6 §9, §22, M0. Clone for reference only; do not add as a dependency.

## 4. Configuration

### 4.1 Environment variables

N/A — pattern-lift. Orchestrator uses (documented in v6 §20):
- `LOG_FILE_PATH`: file path for structured logs (Winston File transport, no stdout).
- `MCP_TRANSPORT=stdio`: transport selector (v6 §22 default).
- `LOG_LEVEL`: verbosity for file logger only.

### 4.2 Config file overlays

N/A — pattern-lift. Winston File transport is configured in code (§6), not in YAML overlays.

## 5. Adoption points in v6

- **F-031** → **§9** (canonical MCP stdio scaffold pattern); **§22** (transport choice: stdio); **§20.gotchas** (Winston file-only logger; "stdout breaks MCP" — anything written to stdout corrupts the JSON-RPC frame); **M0** (initial scaffolding milestone uses this pattern).

## 6. Pattern excerpts

**SDK scaffold setup** (`src/server.ts`):
```ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema, McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

const transport = new StdioServerTransport();
const server = new Server({ name: "orchestrator-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [...toolDefinitions] }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const result = await executeTool(request.params.name, request.params.arguments);
    return { content: [{ type: "text", text: result }] };
  } catch (error) {
    throw new McpError(ErrorCode.InternalError, String(error));
  }
});

await server.connect(transport);
```

**Winston file transport only** (`src/logger.ts`):
```ts
import winston from "winston";

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({
      filename: process.env.LOG_FILE_PATH || "./orchestrator.log",
    }),
  ],
});
// CRITICAL: never use console.log, console.error, or process.stdout.write in stdio servers.
export default logger;
```

## 7. Gotchas

1. **Any console.log or process.stdout.write breaks the MCP JSON-RPC frame.** This is the prime gotcha. Once a non-frame byte lands in stdout, the client sees malformed JSON-RPC and the connection breaks. Use file logging exclusively. (findings.md L423; F-031)
2. **Child processes inherit the parent's stdout.** If a tool spawns a subprocess that writes to stdout, that output corrupts the frame. Redirect or pipe child stdout to a file or the logger. (findings.md L424; F-031)
3. **Logging library defaults often write to stdout.** Many Node logging libraries (pino, bunyan, winston without explicit config) default to console transport. Audit all logger setups; ensure each is configured with File transport only. (findings.md L423; F-031)
4. **`@modelcontextprotocol/sdk@1.17.3` is the pinned version for v1.** SDK updates may change error codes, capability shapes, or schema. Upgrade requires re-running transport tests and checking for breaking changes in `McpError` enum. (findings.md L420; F-031)
5. **Error handling must use `McpError` + `ErrorCode` enum.** Tool handlers that throw unexpected exceptions must be caught and re-thrown as `McpError(ErrorCode.InternalError, message)`. Otherwise, the client sees an unstructured error and may retry. (findings.md L421; F-031)

## 8. Validation

```bash
# 1. No console.log in source
grep -r "console\.log\|console\.error\|process\.stdout\.write" src/ --include="*.ts"
# Expect: empty output (or only in .test.ts fixtures)

# 2. Winston File transport only
grep -A5 "new winston.transports" src/logger.ts | grep -c Console
# Expect: 0

# 3. Verify stdio transport in scaffold
grep -n "StdioServerTransport" src/server.ts
# Expect: import and instantiation present

# 4. Smoke list_tools
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  | orchestrator --transport stdio 2>&1 | jq '.result.tools | length'
# Expect: integer (tool count)
```

## 9. Operational concerns

- **Upstream archival risk**: low — the pattern (SDK scaffold + Winston file logger + stdio transport) is the canonical MCP usage. No vendor lock-in on simple-commands-mcp itself; the pattern is standard across all MCP servers.
- **In-tree adoption**: `src/server.ts` uses `StdioServerTransport`, `src/logger.ts` uses Winston File-transport-only. M0 completion is the gate for this pattern.
- **Promotion**: Not applicable — universal MCP convention.
- **Version pinning policy**: Pin the MCP SDK version in `package.json`. Upgrades require validation that `McpError` enum, schema shapes, and transport interface have not changed.
- **Compliance**: Before merging any PR that modifies `src/server.ts` or `src/logger.ts`, verify no new `console.*` calls are introduced. Consider a pre-commit hook that greps for the pattern.
