---
title: Integrator Guide
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [integrator]
sdlc_category: 11-onboarding
related: [docs/sdlc/04-design/api-mcp-tools.md, docs/host-addenda/, AGENTS.md]
---

# Integrator Guide

> **TL;DR:** You're building or configuring an MCP host (Claude Code / Cursor / Codex / ChatGPT desktop / custom) to consume atl-mcp. This guide covers connection, capability negotiation, the tool catalog, and host-specific addenda. Server endpoint defaults: stdio for local; `http://<host>:3000/mcp` for HTTP.

For developers who work on atl-mcp internals: see [`developer-setup.md`](developer-setup.md). For operators running it: see [`operator-guide.md`](operator-guide.md).

---

## Connection

### Stdio transport

For locally-embedded use:

```jsonc
// MCP host config (Claude Code, Cursor, Codex, ChatGPT desktop)
{
  "mcpServers": {
    "atl-mcp": {
      "command": "node",
      "args": ["/path/to/atl-mcp/dist/start.mjs"],
      "env": {
        "MCP_TRANSPORT": "stdio",
        "DATABASE_URL": "...",
        "ATLASSIAN_*": "...",
        "BITBUCKET_*": "...",
        "TOKEN_MASTER_KEY": "...",
        "AUDIT_KEYPAIR_PATH": "..."
      }
    }
  }
}
```

The host spawns the process, talks JSON-RPC over stdin/stdout. Stdout is **JSON-RPC only** — any rogue write corrupts the protocol stream. (See Incident A in the runbook for what happens when this is violated.)

### Streamable HTTP transport

For deployed / shared use:

```
URL: http://<host>:3000/mcp
Method: POST + GET + DELETE per MCP spec
Auth: per server's auth scheme (capability negotiation at session start)
```

HTTP transport configuration in [`../09-deployment/deployment-targets.md`](../09-deployment/deployment-targets.md).

## Capability negotiation

Per v6 §2.2 and the MCP spec. At session start:

1. Client sends `initialize` with declared capabilities.
2. Server returns negotiated capabilities (intersection of supported).
3. Client uses only what the server advertises.

The server may advertise:

- `tools` (always — see [`../04-design/api-mcp-tools.md`](../04-design/api-mcp-tools.md)).
- `resources` (M7+).
- `prompts` (M9+).
- `sampling` (relevant for blueprint generation; M4+).

If the server-advertised set is smaller than expected, check the server's `MILESTONE_*_ENABLED` flags — a tool you expect may not be enabled in the running build.

## Host-specific addenda

For host-specific quirks + setup details, see [`docs/host-addenda/`](../../host-addenda/):

- [`claude.md`](../../host-addenda/claude.md) — Claude Code (CLI + Desktop).
- [`codex.md`](../../host-addenda/codex.md) — OpenAI Codex.
- [`copilot.md`](../../host-addenda/copilot.md) — GitHub Copilot.
- [`cursor.md`](../../host-addenda/cursor.md) — Cursor.

These are short addenda; the main integrator path is the same across hosts.

## Tool catalog

12 tools, milestone-gated. Full catalog with input/output: [`../04-design/api-mcp-tools.md`](../04-design/api-mcp-tools.md).

Quick reference for the most-used:

- `health_check` — always available; diagnostic.
- `project_preflight_check` — discover Atlassian + VCS capabilities.
- `project_intake_create` — capture requirements.
- `project_blueprint_generate` — turn intake into a blueprint.
- `project_provision_preview` — dry-run plan.
- `project_provision_execute` — write to Atlassian + Bitbucket.
- `context_pack_generate` / `context_get` — context for build.
- `readiness_validate` — gate handoff.
- `generateHandoff` — manifest spawn.

## Sampling

Some tools (e.g., `project_blueprint_generate`) require MCP `sampling`. The host must support it; per v6 §23 the server can fall back to API-key-based sampling if the host doesn't.

If your host doesn't support sampling: the affected tools degrade gracefully (e.g., return a stub blueprint requiring manual completion).

## Resources (M7+)

Once M7 lands, the server exposes resources:

- `orchestrator://session/current/capabilities` — runtime capability snapshot.
- `orchestrator://session/current/preflight` — current preflight profile.
- `orchestrator://project/<id>/blueprint` — current blueprint.
- `orchestrator://project/<id>/context-pack/<key>` — generated pack by regen-key.

Subscriptions on these become live when M10 (webhook-driven graph updates) ships.

## Prompts (M9+)

Once M9 lands, the server exposes prompts (e.g., the manifest-spawn prompt for `generateHandoff`).

## Errors

JSON-RPC errors with `code` + `message` + `data`. atl-mcp uses the standard MCP error codes plus extensions:

- `-32602` invalid params (Zod validation failed).
- `-32603` internal error.
- App-specific codes for `tool_not_found_or_disabled`, `policy_denied`, etc.

`data` may include `reasons[]` (for policy denials) or `validation` (for schema failures).

## Auth

For v1 single-tenant on-prem: typically the host runs on the same network as the server. No app-level auth at session-start beyond capability negotiation.

For multi-tenant deployments (post-v1): host will need to provide identity claims at session-init. Out of scope for v1.

## Rate limits + concurrency

- HTTP transport: max 1000 concurrent sessions per `MCP_HTTP_MAX_CONCURRENT_SESSIONS`.
- Per-session: tool calls are sequential within a session unless the host pipelines.
- Cross-session: the orchestrator handles concurrency; per-project state machine serializes.

## Testing your integration

A simple smoke test:

1. Connect to the server.
2. Call `health_check` — should return `status: "healthy"`.
3. Call `tools/list` — should return the milestone-enabled tools.

If both pass: integration is working.

## Linked artifacts

- **API:** [`../04-design/api-mcp-tools.md`](../04-design/api-mcp-tools.md), [`../04-design/api-mgmt-rest.md`](../04-design/api-mgmt-rest.md)
- **Module:** [`../04-design/module-mcp-runtime.md`](../04-design/module-mcp-runtime.md)
- **Host addenda:** [`docs/host-addenda/`](../../host-addenda/)
- **Spec:** v6 §14 (MCP surface), §22 (transport), §2.2 (capability negotiation), §23 (sampling)
- **Sibling onboarding:** [`developer-setup.md`](developer-setup.md), [`operator-guide.md`](operator-guide.md), [`partner-onboarding.md`](partner-onboarding.md)

---

*Last reviewed: 2026-04-25 by Chris.*
