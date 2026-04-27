---
title: API — Management REST
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [operator, engineer]
sdlc_category: 04-design
related: [docs/sdlc/04-design/module-mcp-runtime.md, docs/sdlc/08-operations/monitoring.md, docs/sdlc/06-security/threat-model.md]
---

# API — Management REST

> **TL;DR:** Management REST runs on port 3001 (loopback by default): `/healthz` and `/health/live` for liveness, `/readyz` and `/health/ready` for readiness, `/metrics` for Prometheus, and `/oauth/atlassian/callback` for Atlassian OAuth 3LO. Admin operations use loopback MCP tools at `/mcp`, not REST.

This is the small, stable surface monitoring + operators rely on. Intentionally minimal in v1 — every additional endpoint is additional attack surface, additional test surface, additional doc surface.

---

## Design principles

The mgmt REST is governed by four rules:

1. **Loopback by default.** `MGMT_API_HOST=127.0.0.1`. Anything else is an explicit operator decision and gets a warning at startup.
2. **Read-only in v1.** No `POST` or `PUT` endpoints; M11 will add some, with auth.
3. **Stable contracts.** Once an endpoint ships, its response shape doesn't break without `/v1/` versioning.
4. **No application auth in v1.** Network is the access control. Operators reach the host via SSH / bastion; loopback is naturally accessible to local tools.

These rules align with v6 §22 (transport) and the trust-boundary model in [`../02-architecture/trust-boundaries.md`](../02-architecture/trust-boundaries.md). Boundary 1 (operator → mgmt REST) is preserved by the loopback default.

---

## Endpoints (v1)

### `GET /healthz`

**Alias:** `GET /health/live`

**Purpose:** liveness — the process is up and the event loop is responsive enough to handle a request.

**Auth:** none (loopback).

**Response:** 200 always.

```json
{
  "status": "healthy",
  "service": "atl-mcp-orchestrator",
  "version": "0.1.0",
  "uptime": 12345,
  "activeSessions": 3,
  "deploymentTier": "production"
}
```

| Field | Type | Source |
|---|---|---|
| `status` | enum: `healthy` \| `degraded` \| `unhealthy` | application self-assessment |
| `service` | string | `ORCHESTRATOR_NAME` env (default: `"atl-mcp-orchestrator"`) |
| `version` | string | `ORCHESTRATOR_VERSION` (default: from `package.json`) |
| `uptime` | number (seconds) | `process.uptime()` |
| `activeSessions` | number | `SessionRegistry.size()` |
| `deploymentTier` | enum: `dev` \| `test` \| `staging` \| `production` | `DEPLOYMENT_TIER` |

A degraded process can still serve `/healthz` with status 200 — it's a liveness signal, not a readiness one. The status field is the nuance.

**Use case:** Docker `HEALTHCHECK`; k8s liveness probe.

### `GET /readyz`

**Alias:** `GET /health/ready`

**Purpose:** readiness — the process is ready to accept new traffic. Stricter than liveness: includes DB connectivity + migration parity.

**Auth:** none (loopback).

**Response:**

```json
{ "status": "ready" }
```

Future richer response:

```json
{
  "status": "ready",
  "migrationVersion": "0003_webhook_deliveries",
  "dbConnectivity": true,
  "auditChainHealthy": true
}
```

Returns 200 if ready; 503 if not.

| Field | Type | Source |
|---|---|---|
| `status` | enum: `ready` \| `not_ready` | application self-assessment |
| `migrationVersion` | string | latest applied migration id from `_migrations` |
| `dbConnectivity` | boolean | a recent `SELECT 1` succeeded |
| `auditChainHealthy` | boolean | last audit-chain verification passed |

503 when:
- Migrations are behind the expected version.
- DB connection pool returns errors.
- Audit-chain health check fails.

**Use case:** k8s readiness probe (controls whether traffic gets routed to this pod).

### `GET /metrics`

**Purpose:** Prometheus counter + histogram exposure.

**Auth:** none (loopback).

**Response:** Prometheus text format (`text/plain; version=0.0.4`).

```
# HELP mcp_session_init_total Number of MCP session init attempts
# TYPE mcp_session_init_total counter
mcp_session_init_total{outcome="success"} 1234
mcp_session_init_total{outcome="failure"} 5

# HELP mcp_tool_call_duration_seconds Tool call latency
# TYPE mcp_tool_call_duration_seconds histogram
mcp_tool_call_duration_seconds_bucket{tool="health_check",le="0.005"} 100
mcp_tool_call_duration_seconds_bucket{tool="health_check",le="0.01"} 105
...
```

Full counter inventory: [`../08-operations/monitoring.md`](../08-operations/monitoring.md). Six counter classes per v6 §27.5.

**Use case:** Prometheus scraper; Grafana dashboards; ad-hoc operator queries.

### `GET /oauth/atlassian/callback`

**Purpose:** Atlassian OAuth 3LO redirect target.

**Auth:** state + PKCE validation tied to the authorization request.

**Required query:** `code`, `state`.

**Required environment when enabled:** `ATLASSIAN_AUTH_MODE=oauth3lo`, `ATLASSIAN_OAUTH_CLIENT_ID`, `ATLASSIAN_OAUTH_CLIENT_SECRET`, `ATLASSIAN_OAUTH_STATE`, `ATLASSIAN_OAUTH_PKCE_VERIFIER`, and optionally `ATLASSIAN_OAUTH_REDIRECT_URI` / `ATLASSIAN_OAUTH_TOKEN_ENDPOINT`.

**Behavior:** validates `state`, exchanges `code` with the PKCE verifier, persists refresh/access token material through the encrypted token store, and returns only metadata.

```json
{
  "ok": true,
  "tokenType": "Bearer",
  "expiresAt": "2026-04-26T19:00:00.000Z",
  "scope": "read:jira-work write:jira-work"
}
```

Token values are never returned in the HTTP response.

## Webhook ingress

Webhook ingress is a separate HTTP server on `WEBHOOK_HTTP_PORT=3002`:

- `POST /webhooks/jira`
- `POST /webhooks/confluence`
- `POST /webhooks/bitbucket`
- `POST /webhooks/github`

Each route reads the raw request body, verifies the hub-style HMAC signature before JSON parsing, records a persistent dedup key through `webhookDeliveries`, and normalizes the payload into a `GraphChangeEvent`. Secrets are configured with `JIRA_WEBHOOK_SECRET`, `CONFLUENCE_WEBHOOK_SECRET`, `BITBUCKET_WEBHOOK_SECRET`, and `GITHUB_WEBHOOK_SECRET`.

---

## Endpoints (M11+, planned)

### `GET /admin/health/audit`

Chain length + last verifier timestamp + integrity.

```json
{
  "chainLength": 124567,
  "lastVerifiedAt": "2026-04-25T12:34:56Z",
  "lastVerifiedEntryId": "...",
  "integrityStatus": "verified" 
}
```

`integrityStatus` is `verified` when the last full walk passed; `unverified` when stale; `failed` if a tamper was detected.

### `GET /admin/health/upstream`

Headroom against Atlassian + Bitbucket rate limits, plus reachability.

```json
{
  "atlassian": { "reachable": true, "rateLimitHeadroom": "98%" },
  "bitbucket": { "reachable": true, "rateLimitHeadroom": "100%" },
  "uio": { "reachable": false, "lastError": "..." }
}
```

### `POST /admin/secrets/rotate`

Operator-initiated rotation of a specific token. Requires auth (M11).

Request:
```json
{ "kind": "atlassian_api_token", "subject": "https://...atlassian.net" }
```

Response:
```json
{ "rotationId": "...", "newRowId": "..." }
```

### `POST /admin/migrations/run`

Apply pending migrations (after rehearsal in CI/staging). Requires auth (M11).

### `POST /admin/jobs/<id>/cancel`

Cancel an in-progress provisioning job. Requires auth (M11).

---

## Auth (M11+ for operator endpoints)

When operator-control endpoints land, they need auth even on loopback because they're write operations. Approach:

- **Option A (preferred for v2):** signed operator session via `/admin/auth/login` → bearer token.
- **Option B (interim):** operator-shared-secret in `Authorization: Bearer <secret>` header.

Decision deferred to M11. ADR will follow.

---

## Why loopback (the rationale)

`MGMT_API_HOST=127.0.0.1` by default. Three reasons:

1. **Reduces attack surface.** Network is the access control. Anything that reaches loopback is on-host; the host security model handles it.
2. **Avoids accidental exposure.** A misconfigured firewall doesn't suddenly expose `/metrics` to the internet. Defense in depth: even if firewall slips, the bind address holds.
3. **Operator workflow.** Operators reach the host via SSH / bastion. Loopback is naturally accessible to local tools (curl, scripts).

If bound to non-loopback (`MGMT_API_HOST=0.0.0.0` or similar):
- Startup logs a warning in `dev` tier.
- Startup logs a hard error in `staging` / `production` tier (and refuses to start unless explicitly enabled).
- Operator must add network-level access control (firewall rule, network policy).

The application doesn't itself enforce auth on `/metrics` even when bound non-loopback — that's the operator's responsibility at the network edge.

---

## CORS / OPTIONS / cross-origin

Not configured. Mgmt REST is server-to-server only. Browser CORS doesn't apply because:

- No browser-based UI consumes the mgmt API.
- Programmatic clients (curl, Prometheus scraper, custom tools) don't need CORS.

If a browser-based admin UI is added (post-v1), CORS becomes relevant.

---

## Versioning

The mgmt REST is v0 in v1. No `/v1/` prefix; the path layout is stable enough that we don't anticipate a breaking change before v1.0.0.

If a breaking change becomes necessary:

- Introduce `/v1/` (or `/v2/`) prefix for the new shape.
- Keep the v0 path live for one release as a transition.
- Document the deprecation in the changelog.
- Once the deprecation window closes, retire v0.

In practice: the contracts above are stable. Field additions (more keys in JSON responses) are backward-compatible and don't trigger versioning.

---

## Threat model coverage

Per [`../06-security/threat-model.md`](../06-security/threat-model.md), the mgmt REST surface is implicated in:

- **T-1106: DoS mgmt REST.** Mitigated by loopback default.
- **T-1108: Operator privilege escalation.** Mitigated by no-write endpoints in v1.

When M11 adds write endpoints:

- New threats: forge an operator action, replay an admin command.
- New mitigations: auth on operator endpoints, audit entry per operator action.

These get added to the threat model as the endpoints land.

---

## Tests

| Test | Path | What it proves |
|---|---|---|
| Mgmt API integration | `tests/integration/mgmtApi.test.ts` | Endpoints return expected shapes; status codes correct; JSON parses |
| Loopback default | (within above) | Bind defaults to 127.0.0.1 unless overridden |
| No write endpoints in v1 | (within above) | Asserts the v1 surface is read-only |

When M11 endpoints land, their tests follow the same pattern.

---

## Operational notes

### Health checks under load

- `/healthz` should remain < 50 ms p99 even under load. If event-loop lag spikes, `/healthz` reflects it; the alerting layer has a corresponding alert.
- `/readyz` involves a DB query; expect < 200 ms p99 under load. DB issues surface here first.
- `/metrics` exposure is the heaviest endpoint (text-format serialization of all counters); expect 50-200 ms.

### Scrape interval

For Prometheus: 15s scrape interval is typical. At 100 counter families, response is ~10-50 KB.

### Logs from the mgmt API

Mgmt API requests log at `info` level by default. Health check requests log at `debug` (high volume; not interesting unless investigating).

---

## Linked artifacts

- **Code:** `src/server/mgmtApi/` (or equivalent path within `src/`)
- **Tests:** `tests/integration/mgmtApi.test.ts`
- **Spec:** v6 §22 (transport), §27 (observability)
- **Sibling docs:** [`api-mcp-tools.md`](api-mcp-tools.md), [`../08-operations/monitoring.md`](../08-operations/monitoring.md), [`../08-operations/alerting.md`](../08-operations/alerting.md), [`../08-operations/observability-stack.md`](../08-operations/observability-stack.md)
- **Threat model:** [`../06-security/threat-model.md`](../06-security/threat-model.md) (T-1106, T-1108)
- **Trust boundaries:** [`../02-architecture/trust-boundaries.md`](../02-architecture/trust-boundaries.md)
- **Deployment:** [`../09-deployment/deployment-targets.md`](../09-deployment/deployment-targets.md), [`../09-deployment/secrets-provisioning.md`](../09-deployment/secrets-provisioning.md)

---

*Last reviewed: 2026-04-25 by Chris.*
