---
title: Secrets Provisioning
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, operator]
sdlc_category: 09-deployment
related: [docs/sdlc/06-security/secrets-mgmt.md, docs/sdlc/06-security/token-storage.md]
---

# Secrets Provisioning

> **TL;DR:** How secrets reach each environment. Dev: `.env.local` (gitignored). Test: in-test fixtures. Staging / production: secret manager (cloud platform's) injected as env vars at container start. The application never reads from disk except for the audit keypair file. No secret is ever in source control.

This is the operational view. The inventory + lifecycle is in [`../06-security/secrets-mgmt.md`](../06-security/secrets-mgmt.md). This doc covers *how secrets get from where they live to where the application reads them*.

---

## Per-tier flow

### dev

```
Developer's .env.local (gitignored)
        ↓ shell sources before `npm run start`
Process env vars
        ↓ src/config/env.ts reads
Application
```

`.env.local` is excluded by `.gitignore`. There's a `.env.example` checked in showing the variable names with placeholder values.

The audit keypair: auto-generated on first run by the dev startup path; written to `./.orchestrator-audit-keypair.json` (also gitignored).

### test

Tests inject env values per-fixture using vitest's mocking. No on-disk secrets needed for unit/integration tests — pglite avoids the need for a real DB password; HTTP mocks avoid the need for real Atlassian/Bitbucket creds.

Live tests (`RUN_LIVE_TESTS=1`) read from a separate `.env.test.live` (gitignored) that points at a sandbox Atlassian site.

### staging / production

```
Cloud secret manager (AWS Secrets Manager / GCP Secret Manager / Vault)
        ↓ deploy platform fetches at container start
Process env vars (on the running container)
        ↓ src/config/env.ts reads
Application
```

The secret manager is the single source of truth. The deploy platform is the bridge from secret manager to env var.

The audit keypair: provisioned externally; mounted as a Kubernetes secret OR written to a Docker volume from a managed secret manager. Path resolved by `AUDIT_KEYPAIR_PATH` env var.

---

## Env var inventory (full)

The complete env-var set, grouped by purpose. Defaults shown where applicable.

### Transport / mgmt

| Var | Type | Required | Default | Source |
|---|---|---|---|---|
| `MCP_TRANSPORT` | enum | No | `both` | Config |
| `MCP_HTTP_PORT` | number | No | `3000` | Config |
| `MCP_HTTP_HOST` | string | No | `0.0.0.0` | Config |
| `MCP_HTTP_SESSION_TTL_SECONDS` | number | No | `3600` | Config |
| `MCP_HTTP_SSE_KEEP_ALIVE_MS` | number | No | `25000` | Config |
| `MCP_HTTP_MAX_CONCURRENT_SESSIONS` | number | No | `1000` | Config |
| `MGMT_API_PORT` | number | No | `3001` | Config |
| `MGMT_API_HOST` | string | No | `127.0.0.1` | Config |

### Logging

| Var | Type | Required | Default | Source |
|---|---|---|---|---|
| `LOG_LEVEL` | enum | No | `info` (`debug` in dev) | Config |
| `LOG_FILE_PATH` | string | No | `./orchestrator.log` | Config |

### Process / metadata

| Var | Type | Required | Default | Source |
|---|---|---|---|---|
| `NODE_ENV` | string | No | `development` | Config |
| `DEPLOYMENT_TIER` | enum | No | `dev` | Config |
| `ORCHESTRATOR_NAME` | string | No | `atl-mcp-orchestrator` | Config |
| `ORCHESTRATOR_VERSION` | string | No | from package.json | Config |

### Feature flags

| Var | Type | Required | Default | Source |
|---|---|---|---|---|
| `MILESTONE_4_ENABLED` | boolean | No | `false` | Config |
| `MILESTONE_5_ENABLED` | boolean | No | `false` | Config |
| `MILESTONE_6A_ENABLED` | boolean | No | `false` | Config |
| `MILESTONE_6B_ENABLED` | boolean | No | `false` | Config |
| `MILESTONE_6C_ENABLED` | boolean | No | `false` | Config |
| `MILESTONE_7_ENABLED` | boolean | No | `false` | Config |
| `MILESTONE_8_ENABLED` | boolean | No | `false` | Config |
| `MILESTONE_9_ENABLED` | boolean | No | `false` | Config |
| `MILESTONE_10_ENABLED` | boolean | No | `false` | Config |
| `MILESTONE_11_ENABLED` | boolean | No | `false` | Config |

### Storage

| Var | Type | Required | Default | Source |
|---|---|---|---|---|
| `DATABASE_URL` | string (secret) | Yes (in non-dev) | (pglite path in dev) | Secret manager |

### Atlassian credentials

| Var | Type | Required | Default | Source |
|---|---|---|---|---|
| `ATLASSIAN_SITE_URL` | string | Conditional (yes if Atlassian features enabled) | — | Config |
| `ATLASSIAN_AUTH_MODE` | enum (`api_token` \| `oauth3lo` \| `service_account`) | Conditional | — | Config |
| `ATLASSIAN_EMAIL` | string | Conditional | — | Config |
| `ATLASSIAN_API_TOKEN` | string (secret) | Conditional | — | Secret manager |
| `ATLASSIAN_OAUTH_CLIENT_ID` | string | Conditional (oauth3lo) | — | Secret manager |
| `ATLASSIAN_OAUTH_CLIENT_SECRET` | string (secret) | Conditional (oauth3lo) | — | Secret manager |
| `ATLASSIAN_OAUTH_REDIRECT_URI` | string | Conditional (oauth3lo) | — | Config |

### Bitbucket credentials

| Var | Type | Required | Default | Source |
|---|---|---|---|---|
| `VCS_PROVIDER` | enum (`bitbucket`) | Conditional | `bitbucket` | Config |
| `BITBUCKET_WORKSPACE` | string | Conditional | — | Config |
| `BITBUCKET_APP_PASSWORD` | string (secret) | Conditional | — | Secret manager |

### Cryptography

| Var | Type | Required | Default | Source |
|---|---|---|---|---|
| `TOKEN_MASTER_KEY` | string (secret, 64 hex chars = 32 bytes) | Yes (in non-dev) | — | Secret manager |
| `AUDIT_KEYPAIR_PATH` | string (path) | No | `./.orchestrator-audit-keypair.json` | Config + filesystem mount |
| `AUDIT_KEY_REGISTRY_REF` | string (git ref) | Yes (in non-dev) | — | Config |

### Partner integrations

| Var | Type | Required | Default | Source |
|---|---|---|---|---|
| `UIO_MCP_SOCKET` | string (path) | Conditional (UIO partner enabled) | — | Config |
| `LANGFUSE_PUBLIC_KEY` | string | Optional | — | Config |
| `LANGFUSE_SECRET_KEY` | string (secret) | Optional | — | Secret manager |
| `LANGFUSE_HOST` | string | Optional | — | Config |

### Webhook

| Var | Type | Required | Default | Source |
|---|---|---|---|---|
| `WEBHOOK_SHARED_SECRETS` | string (JSON map) | Conditional | — | Secret manager |

### Queue (M6+)

| Var | Type | Required | Default | Source |
|---|---|---|---|---|
| `PROVISION_QUEUE_REDIS_URL` | string (secret) | Conditional | — | Secret manager |
| `PROVISION_JOB_TIMEOUT_MS` | number | No | `300000` | Config |

---

## Provisioning matrix per tier

| Var | dev | test | staging | production |
|---|---|---|---|---|
| Transport / mgmt / logging vars | `.env.local` | per-fixture | env (deploy platform) | env (deploy platform) |
| `DATABASE_URL` | pglite path | pglite path | secret manager | secret manager |
| Atlassian / Bitbucket creds | `.env.local` | mock or `.env.test.live` | secret manager (sandbox) | secret manager (production) |
| `TOKEN_MASTER_KEY` | `.env.local` | per-fixture | secret manager | secret manager |
| Audit keypair file | auto-gen on first run | per-fixture | volume mount (k8s secret) | volume mount (k8s secret) |
| `WEBHOOK_SHARED_SECRETS` | `.env.local` | per-fixture | secret manager | secret manager |

---

## Bootstrapping a new environment

To bring up a fresh staging or production:

1. Provision Postgres; capture DSN as `DATABASE_URL`.
2. Generate `TOKEN_MASTER_KEY` (`openssl rand -hex 32`); store in secret manager.
3. Generate audit keypair (`scripts/audit-keys-init.ts`); push public to registry git ref; store private as a sealed secret.
4. Provision Atlassian / Bitbucket service-account credentials in their respective consoles; seal each in `encryptedTokens` via the mgmt REST or seed script.
5. Configure deploy platform env vars + secret references per the matrix.
6. Deploy the image at the chosen tag.
7. Verify `/healthz`, `/readyz`, `/admin/health/audit`.
8. Smoke test: invoke `health_check` MCP tool.

---

## Anti-patterns

- **Don't put secrets in `.env.example`.** It's checked in; `<placeholder>` text only.
- **Don't read secrets from disk in application code.** Only `AUDIT_KEYPAIR_PATH` reads from disk; everything else is env var.
- **Don't echo secrets back via API.** Mgmt REST never returns a sealed secret's plaintext.
- **Don't log secrets.** Pino redact + the lint catches casual cases.
- **Don't share secrets across tiers.** Each tier has its own credential set.

## Linked artifacts

- **Code:** `src/config/env.ts` (canonical loader)
- **Secrets inventory:** [`../06-security/secrets-mgmt.md`](../06-security/secrets-mgmt.md)
- **Token storage:** [`../06-security/token-storage.md`](../06-security/token-storage.md)
- **Sibling docs:** [`environments.md`](environments.md), [`release-process.md`](release-process.md), [`deployment-targets.md`](deployment-targets.md)
- **Threat model:** [`../06-security/threat-model.md`](../06-security/threat-model.md) (T-2201, T-2202)

---

*Last reviewed: 2026-04-25 by Chris.*
