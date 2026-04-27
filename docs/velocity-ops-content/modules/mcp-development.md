---
description: "MCP server development: protocol compliance, tool definitions, resources, testing"
globs: ["src/mcp/**/*.ts", "mcp.config.*", "src/tools/**/*.ts", "src/resources/**/*.ts"]
alwaysApply: false
---

# MCP Server Development — Stack Module

**Targets:** MCP SDK (@modelcontextprotocol/sdk) latest, Node.js 20+, TypeScript 5.x
**Appended to base CLAUDE.md when developing MCP servers.**

---

## 0. Setup

### Prerequisites

- Node.js 20+
- pnpm 9+
- TypeScript project initialized (`tsconfig.json` present)

### Install

```bash
pnpm add @modelcontextprotocol/sdk
pnpm add -D typescript @types/node
```

### `package.json` configuration

```json
{
  "type": "module",
  "bin": {
    "my-mcp-server": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "inspect": "npx @modelcontextprotocol/inspector node dist/index.js"
  }
}
```

### Entry point boilerplate — `src/index.ts`

```typescript
#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  { name: 'my-mcp-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'hello',
      description: 'Returns a greeting. Use this to verify the server is working.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name to greet' },
        },
        required: ['name'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'hello') {
    return {
      content: [{ type: 'text', text: `Hello, ${args?.name ?? 'world'}!` }],
    };
  }

  return {
    content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    isError: true,
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Build and verify

```bash
pnpm build
npx @modelcontextprotocol/inspector node dist/index.js
```

Expected: Inspector UI opens in browser. Tool list shows your declared tools. Can call tools interactively.

---

## File Structure Conventions

1. Organize MCP server code under `src/` with this structure:
   - `src/index.ts` — entry point, server instantiation and transport binding
   - `src/tools/` — one file per tool group (e.g., `src/tools/database.ts`, `src/tools/files.ts`)
   - `src/resources/` — one file per resource group
   - `src/prompts/` — prompt definitions
   - `src/types.ts` — shared types and Zod schemas
   - `src/context.ts` — server context / dependency injection

2. Export a `createServer()` factory function from `src/index.ts` rather than instantiating the server at module scope. This makes the server testable without side effects at import time.

## Transport and Protocol Compliance

3. Use `StdioServerTransport` for servers consumed by Claude Code and other AI agents that launch the server as a subprocess. Use `SSEServerTransport` only for servers accessed over HTTP. Stdin/stdout is the standard for agent-launched servers:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server(
  { name: 'my-mcp-server', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {}, prompts: {} } }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

4. Declare capabilities accurately in the server constructor. Only include `tools: {}`, `resources: {}`, or `prompts: {}` for capabilities the server actually implements. Declaring unused capabilities confuses clients.
5. Never write to `process.stdout` directly in a stdio transport server — it corrupts the MCP protocol stream. Use `process.stderr` for all logging and diagnostics.

## Tool Definitions

6. Define every tool with a precise Zod input schema and a description that tells the agent when and how to use it. Vague descriptions cause agents to misuse or avoid tools:

```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'query_database',
      description: 'Execute a read-only SQL query against the project database. Use for retrieving records, counts, or aggregations. Do NOT use for INSERT, UPDATE, or DELETE — use mutate_database instead.',
      inputSchema: {
        type: 'object',
        properties: {
          sql: { type: 'string', description: 'The SELECT query to execute' },
          params: {
            type: 'array',
            items: { type: 'string' },
            description: 'Positional parameters for the query ($1, $2, ...)',
          },
        },
        required: ['sql'],
      },
    },
  ],
}));
```

7. Validate all tool call inputs with Zod inside the `CallToolRequestSchema` handler before executing any logic. Return a structured error response — do not throw unhandled exceptions:

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'query_database') {
    const parsed = QueryInputSchema.safeParse(args);
    if (!parsed.success) {
      return {
        content: [{ type: 'text', text: `Invalid input: ${parsed.error.message}` }],
        isError: true,
      };
    }
    // proceed with parsed.data
  }
});
```

8. Return content in the MCP content format. For text responses use `{ type: 'text', text: string }`. For structured data, serialize to JSON and return as text — do not return raw objects:

```typescript
return {
  content: [
    {
      type: 'text',
      text: JSON.stringify(result, null, 2),
    },
  ],
};
```

## Resource Definitions

9. Assign stable, human-readable URIs to resources. Use a consistent URI scheme: `{server-name}://{category}/{identifier}`. Resources must be idempotent — the same URI always returns the same (or current) content:

```typescript
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'memory://sessions/current',
      name: 'Current Session Context',
      description: 'Active session memory including recent interactions and task context',
      mimeType: 'application/json',
    },
  ],
}));
```

10. For resource templates (parameterized URIs), use `uriTemplate` in the resource definition and extract parameters in the `ReadResourceRequestSchema` handler.

## Error Handling

11. Distinguish between MCP protocol errors and tool execution errors. Protocol errors (unknown tool, malformed request) return `{ isError: true }` in the tool response. Critical protocol-level errors throw `McpError` with the appropriate `ErrorCode`:

```typescript
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// Tool-level error — returned as content, agent can recover
return { content: [{ type: 'text', text: 'Query failed: table not found' }], isError: true };

// Protocol-level error — thrown, server remains running
throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
```

12. Wrap all async tool implementations in try-catch. Log errors to `process.stderr`. Never let an unhandled exception crash the MCP server process — the server must remain alive to serve subsequent requests.

## Database Patterns (pgvector / Multi-tenant)

13. For servers with PostgreSQL + pgvector, use parameterized queries for all user-provided input. Never interpolate user data into SQL strings. Use the `$1, $2` placeholder syntax:

```typescript
const result = await pool.query(
  'SELECT id, content, embedding <=> $1::vector AS distance FROM documents WHERE tenant_id = $2 ORDER BY distance LIMIT $3',
  [JSON.stringify(queryEmbedding), tenantId, limit]
);
```

14. For multi-tenant servers, enforce Row-Level Security (RLS) at the database level. Set the tenant context using a `SET LOCAL` statement within each transaction:

```typescript
await pool.query('BEGIN');
await pool.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
const result = await pool.query('SELECT * FROM documents'); // RLS policy filters by app.current_tenant_id
await pool.query('COMMIT');
```

15. For token-gated MCP servers, validate the token on every tool call — not just at connection time. Tokens may be revoked between requests. Cache validation results with a short TTL (60 seconds) to avoid rate-limiting external validation APIs.

## Environment and Configuration

16. Read all configuration from environment variables. Never hardcode connection strings, API keys, or tenant IDs in server source files. Validate required environment variables at startup and fail fast with a descriptive error if any are missing:

```typescript
const requiredEnvVars = ['DATABASE_URL', 'OPENAI_API_KEY'] as const;
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}
```

## Testing MCP Servers

17. Test MCP servers by instantiating the server with an `InMemoryTransport` pair. This exercises the full protocol stack without spawning a subprocess:

```typescript
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
await server.connect(serverTransport);

const client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
await client.connect(clientTransport);

const tools = await client.listTools();
const result = await client.callTool({ name: 'query_database', arguments: { sql: 'SELECT 1' } });
```

18. Run MCP protocol compliance checks in CI. Verify that all declared tools respond to `callTool`, all declared resources respond to `readResource`, and error cases return `isError: true` rather than throwing.

## Integration

### Register in Claude Code

Add the server to `~/.claude/settings.json` under `mcpServers`:

```json
{
  "mcpServers": {
    "my-mcp-server": {
      "command": "node",
      "args": ["/absolute/path/to/my-mcp-server/dist/index.js"]
    }
  }
}
```

Use absolute paths in the `command` and `args` fields. Relative paths resolve from an unpredictable working directory and will fail. To confirm your Node.js path, run `which node`.

### Register in agentgateway

For gateway-based deployments, see `platforms/agentgateway.md` for registration configuration, routing rules, and health check setup.

### Register in MCPJungle

For registry-based discovery, see `platforms/mcpjungle.md` for the registry API, metadata schema, and publishing workflow.

### stdio vs HTTP transport

| Transport | Use when | Protocol |
|-----------|----------|----------|
| **stdio** (default) | Claude Code, local agents, subprocess-based clients | Server reads JSON-RPC from stdin, writes to stdout |
| **HTTP (SSE)** | Network-accessed servers, shared/remote deployments, multi-client scenarios | Server exposes an HTTP endpoint with Server-Sent Events for server-to-client messages |

stdio is the default for Claude Code and most agent frameworks. Use HTTP (SSE) only when the server must be accessed over a network — for example, a shared team server or a server running on a remote host. HTTP transport requires `SSEServerTransport` from `@modelcontextprotocol/sdk/server/sse.js`.

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| Server not responding | `console.log` corrupting stdout | Use `console.error` or `process.stderr.write` for all logging. See rule 5. |
| "Tool not found" | Tool not declared in capabilities | Add `tools: {}` to server capabilities and implement `ListToolsRequestSchema` handler. See rule 4. |
| Inspector hangs on connect | Transport mismatch or build error | Run `node dist/index.js` directly first to check for startup errors. |
| "Method not found" | Handler not registered for request type | Verify `server.setRequestHandler(XxxRequestSchema, ...)` for each capability. |
| Claude Code can't find server | Wrong path in settings.json | Use absolute path in `command` field. Test with `which node` to verify Node.js path. |
