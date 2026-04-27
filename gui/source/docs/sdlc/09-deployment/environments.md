---
title: Environments
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, operator]
sdlc_category: 09-deployment
related: [docs/sdlc/09-deployment/secrets-provisioning.md, docs/sdlc/09-deployment/release-process.md]
---

# Environments

> **TL;DR:** Four tiers — `dev`, `test`, `staging`, `production`. Selected via `DEPLOYMENT_TIER` env var. Tier gates strict-mode behavior in the policy decision layer, log levels, observability sampling, mgmt-API loopback warnings. Each tier has its own credential store, DB, audit signing keys.

The tier is not just decoration — it changes runtime behavior in a few specific places, documented below.

---

## Tier ladder

| Tier | Purpose | DB | Atlassian / Bitbucket | Tokens | Audit keys |
|---|---|---|---|---|---|
| `dev` | Developer local | pglite (in-process) | Sandbox or fixture | `.env.local` | Auto-generated, ephemeral |
| `test` | CI / automated tests | pglite + fixtures | Mocked HTTP | Test fixtures | Test fixtures |
| `staging` | Pre-production validation | Postgres (staging instance) | Staging Atlassian site / Bitbucket workspace | Staging credentials in secret manager | Staging registry ref |
| `production` | The real deal | Postgres (production instance) | Production Atlassian + Bitbucket | Production credentials in secret manager | Production registry ref |

Higher tiers have higher consequences; lower tiers have higher iteration speed.

---

## Tier-specific behavior

### `dev`

- `LOG_LEVEL` defaults to `debug`.
- `MGMT_API_HOST` defaults to `127.0.0.1`; warning suppressed.
- `POLICY_STRICT_MODE` defaults to `false` — unknown intents allow with low confidence (developer-friendly).
- Migrations run at startup automatically.
- Audit keypair auto-generated if absent (path: `./.orchestrator-audit-keypair.json`, NOT checked in).
- All MILESTONE_* feature flags can be flipped freely.

### `test`

- `LOG_LEVEL` defaults to `info`.
- pglite used for storage (no real Postgres required).
- HTTP clients use a mock transport when `NODE_ENV=test`.
- Real Atlassian / Bitbucket calls only when `RUN_LIVE_TESTS=1`.
- Migrations run on each test fixture setup.

### `staging`

- `LOG_LEVEL` defaults to `info`.
- Real Postgres; migrations run via the migration runner with rehearsal mode against staging snapshots.
- Real Atlassian + Bitbucket against a *staging* site (a separate Atlassian instance, not production).
- Loopback enforcement on mgmt API is a hard requirement (warning becomes error if bound non-loopback in non-dev tier).
- `POLICY_STRICT_MODE` defaults to `true`.

### `production`

- All of staging, plus:
- `LOG_LEVEL` defaults to `info`; `debug` only enabled temporarily for triage and reverted within hours.
- Audit chain verifier runs on a schedule (M11; planned).
- Health checks expected to be polled by the deploy platform's liveness/readiness probes.
- `POLICY_STRICT_MODE` is `true` and cannot be overridden by env var alone (requires a code change).
- Master encryption key is provided by the secret manager; never written to disk.
- Backups (Postgres) configured per [`../10-dr-bcp/backup-strategy.md`](../10-dr-bcp/backup-strategy.md).

---

## Deployment topology per tier

### dev

- Single process running on the developer's machine.
- pglite as in-process DB.
- Stdio transport plus HTTP if needed.
- One audit keypair file in workspace (gitignored).

### test

- Single process per test run; ephemeral.
- pglite per test fixture; no shared state between tests.
- HTTP transport optional (most tests use stdio).

### staging

- Single process (single-tenant deploys are intentional for v1).
- Hosted Postgres (Cloud SQL / RDS / equivalent).
- Real Atlassian + Bitbucket (staging accounts).
- Reverse proxy / load balancer in front (TLS termination, optional rate limiting).
- Mgmt API bound to loopback; reachable from operators via SSH / bastion.

### production

- Same shape as staging, but real customer traffic.
- Backups enabled (point-in-time recovery + daily snapshots).
- Audit chain registry git ref hosted separately from the application host.
- Stronger network controls (VPC / firewall rules).

---

## Tier promotion

Code moves through the ladder via deploys; data does NOT auto-promote.

```
dev → test (CI) → staging (manual deploy) → production (manual deploy)
```

Each promotion is a fresh deploy of the *image* at a specific tag — same image runs in staging and production. The behavior differences come from `DEPLOYMENT_TIER` + tier-specific env config.

### Pre-production checklist (staging → production)

Before promoting to production:

- [ ] All CI gates green on the tag.
- [ ] Image scanned (post-v1 CI step) — no high/critical vulns.
- [ ] Migration rehearsal passed against staging.
- [ ] Smoke test against staging — at least one read-only MCP tool works.
- [ ] Audit chain verifier passes on staging.
- [ ] Release notes drafted.
- [ ] Stakeholder notification sent (sponsor, operators).
- [ ] Rollback procedure understood by operator (per [`release-process.md`](release-process.md) "Rollback").

---

## Tier configuration

Per-tier env values typically live in:

- `dev`: `.env.local` (gitignored).
- `test`: `.env.test` (some values; tests inject overrides per-fixture).
- `staging`: secret manager + tier-specific config map (managed by deploy platform).
- `production`: secret manager + tier-specific config map.

Canonical env-var inventory is in [`secrets-provisioning.md`](secrets-provisioning.md).

---

## What's NOT a tier-changeable behavior

- Audit chain construction (always signed).
- Token encryption (always sealed).
- MCP transport invariants (no stdout; always TLS for HTTP).
- Test-first iron law (CI gates apply to all tiers' code paths).

These are invariants by design. Tier toggles relax developer ergonomics; they never relax security.

---

## Linked artifacts

- **Code:** `src/config/env.ts` (loads `DEPLOYMENT_TIER` + per-tier defaults)
- **Sibling docs:** [`release-process.md`](release-process.md), [`secrets-provisioning.md`](secrets-provisioning.md), [`feature-flags.md`](feature-flags.md), [`deployment-targets.md`](deployment-targets.md), [`ci-cd.md`](ci-cd.md)
- **DR:** [`../10-dr-bcp/backup-strategy.md`](../10-dr-bcp/backup-strategy.md)
- **ADR:** [ADR-0001](../../adr/0001-pglite-for-dev.md) (pglite for dev)

---

*Last reviewed: 2026-04-25 by Chris.*
