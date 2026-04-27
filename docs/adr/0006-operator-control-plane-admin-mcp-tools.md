---
status: accepted
date: 2026-04-26
deciders: [orchestrator-team]
consulted: [open-edison-pattern]
informed: [build-agents, future-operators]
---

# 0006. Operator control plane: `admin.*` MCP tools on a loopback MCP transport, not REST

## Context

The Claude Design prototype at `docs/control-plane/` (Surface 7) is a static React + Babel-standalone UI for the operator: 15 screens covering health, projects, jobs, audit, policy, providers, sessions, alerts, migrations, secrets, SLOs, capacity, DR, settings, plus an index. The brief at `gui/README.md` originally assumed an admin REST API (`/api/v1/*`); v6 §40 finding **F-151** marks REST admin codegen explicitly **deferred beyond v1**. So the prototype was built against `window.MOCK` mock data only — no production wiring.

The operator now wants every fake value stripped and the UI wired to ground truth. That requires picking a transport for ~35 admin operations (project list, job cancel, audit verify, policy approve, etc.). Three live alternatives existed:
1. **Admin REST** under `/api/v1/*` on the existing 127.0.0.1:3001 mgmt API.
2. **`admin.*` MCP tools** on a second MCP transport bound to loopback.
3. **Direct repository access** via a local Node CLI the UI shells to.

## Decision Drivers

- F-151 deferral stands: shipping admin REST in v1 is a documented non-goal; reversing it requires explicit ADR weight.
- Single security-review surface: the orchestrator's audit + policy + session story is built around MCP tool semantics (request/response, structured arguments, structured result). REST would force a parallel auth/idempotency/error model.
- Loopback-only: the operator UI is single-tenant and on-host; nothing about it should be reachable from the public agent transport on `0.0.0.0:3000`.
- Audit posture: every operator write must produce a signed audit chain entry (per ADR 0005). Tools already integrate with the audit signer; REST handlers would re-implement that path.
- Minimal new surface area: the codebase has zero static-asset host today and zero `/api/v1/*` precedent; both would arrive together.
- Static UI host: the prototype is no-build React-via-Babel and matches `docs/visualizations/` shape. The UI must be co-hosted on the same loopback origin to avoid CORS for JSON-RPC framing.

## Considered Options

1. **`admin.*` MCP tools + second transport** (this ADR). Reuses MCP framing, audit/session/tool plumbing already in production. UI is an MCP client over JSON-RPC. Loopback transport on 3001 next to existing mgmt API; static UI assets served at `/ui/` on the same origin.
2. **REST admin API on 3001 (`/api/v1/*`)**. Reverses F-151. Forces a parallel handler stack: auth, validation, error envelope, audit-emission. UI uses plain `fetch`. More familiar to most developers; doesn't reuse MCP plumbing.
3. **Direct repository access via local CLI**. UI shells to a Node CLI per action. Abandons the React control plane entirely; not really "wired in."

## Decision Outcome

**Adopt option 1.** Admin operations are exposed as `admin.*` MCP tools registered on a **second `StreamableHTTPServerTransport` bound to `127.0.0.1:3001`**, alongside the existing mgmt API. The orchestrator also serves `docs/control-plane/` as static assets at `/ui/*` on the same origin. The UI is a thin MCP client (`mcp-client.js`) that initializes a session and calls tools by name. F-151's REST-deferral stays in force; this ADR explicitly chooses MCP-over-loopback as the operator surface, not REST.

Two MCP transports, one orchestrator process:

| Transport | Bind | Tool surface | Consumer |
|---|---|---|---|
| Existing `/mcp` | `0.0.0.0:3000` | agent-facing (`project_intake_create`, ...) | build agents |
| New `/mcp` (this ADR) | `127.0.0.1:3001` | `admin.*` (~35 tools) | operator control plane UI |

Authorization in v1 is **bind-based**: only loopback callers reach the admin transport. No auth tokens, no operator login. A startup guard logs a warning if the mgmt host config drifts off `127.0.0.1` / `localhost`.

Tools that perform writes (e.g., `admin.policy.approve`, `admin.jobs.cancel`, `admin.projects.transition`) emit a signed audit chain entry through the existing `auditRepository.append` path with `actor=operator:<badge>`, `tool=admin.<name>`, and a hashed payload. Read tools do not emit audit entries.

Tools that depend on backend pieces not yet implemented (alerts firing layer, SLO computation, capacity model, DR drill scheduler, lethal-trifecta detector, secrets rotation drills, provider rate-limit headroom) return real but minimal data and include a `dataLimited: { reason }` field that the UI surfaces as a "data limited" badge. **No fake values anywhere.** Empty arrays, `null` fields, and explicit reasons replace the previous `window.MOCK` fixture.

## Consequences

### Good

- Reuses MCP plumbing: tool registry, structured I/O, session lifecycle, transport reconnect, audit emission.
- Operator surface is **strictly loopback** — never reachable from the public agent transport.
- Adheres to F-151's REST deferral; this ADR is the explicit dissent for the operator UI specifically.
- Static UI co-hosted on the same loopback origin: no CORS, no cookies, no separate auth story.
- Same audit chain covers agent and operator activity uniformly.

### Bad

- UI must speak JSON-RPC instead of REST. A small `mcp-client.js` wrapper hides this; operators don't see it.
- Tooling that expects REST-style URLs (curl, Postman) loses some ergonomics. The mgmt API still has REST `/healthz` / `/readyz` / `/metrics` for that case.
- Two MCP transports in one process is novel. Mitigated: identical setup pattern, just different bind + tool registry.

### Neutral

- Migrating to REST later (post-v1, when M11+ lands `hey-api/openapi-ts` per F-151) is a thin shim: each `admin.tool` already has zod input/output, which compiles 1:1 to OpenAPI.
- Auth posture is loopback-only in v1. Adding token auth later is a transport-level middleware, not a tool-by-tool change.

## More Information

- `gui/README.md` — original brief assuming REST.
- `agent-context-orchestrator-mcp-plan-v6.md` §40 F-151 — REST deferral.
- `docs/adr/0005-audit-signing-pipeline.md` — audit emission pattern reused by write tools.
- `src/transport/http.ts` — `StreamableHTTPServerTransport` setup pattern copied for the loopback admin transport.
- `src/server/mgmtApi.ts` — host for the new `/mcp` and `/ui/*` mounts.
- `src/mcp/admin/registry.ts` — admin tool registration entry point.
- `docs/control-plane/STYLE-NOTES.md` — UI-side endpoint mapping (admin tool list).
