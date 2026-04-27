---
title: Developer Setup
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer]
sdlc_category: 11-onboarding
related: [AGENTS.md, README.md]
---

# Developer Setup

> **TL;DR:** Node 22+, `npm install`, `npm test`, `npm run dev`. pglite is the dev DB (no separate Postgres needed). Audit keypair auto-generated on first run. Atlassian / Bitbucket credentials only needed for live integration tests (gated by `RUN_LIVE_TESTS=1`). The dev experience is intentionally low-ceremony.

This is the developer-facing onboarding. For the operator-facing version, see [`operator-guide.md`](operator-guide.md). For the integrator-facing version, see [`integrator-guide.md`](integrator-guide.md).

---

## Prerequisites

- **Node.js 22+** (anything earlier may work but isn't tested).
- **npm 10+** (bundled with Node 22+).
- **Git.**
- **Docker** (only if you want to build the image locally).
- **An editor with TypeScript support** (VS Code, Cursor, IntelliJ). Strict TS makes a fast feedback loop important.

Not required:

- A separate Postgres install (pglite handles dev).
- Atlassian / Bitbucket credentials (mocks for unit + integration; live tests are opt-in).
- Redis (only when you're working on M6+ async queue).

## First run

```bash
# 1. Clone
git clone <repo-url> atl-mcp
cd atl-mcp

# 2. Install
npm install

# 3. Run typecheck + tests
npm run typecheck
npm test

# 4. Start the server (with all transports)
npm run build && npm start

# Or for hot-reload dev:
npm run dev
```

That's it. If the test suite is green, the environment is set up.

## Common tasks

### Run the full CI gate locally

```bash
npm run typecheck
npm test
npm run lint:no-stdout
npm run lint              # ESLint
```

All four must pass before opening a PR.

### Run only one test file

```bash
npm test -- tests/unit/security/tokenEncryption.test.ts
```

### Run live integration tests

These hit real Atlassian / Bitbucket. Gated:

```bash
RUN_LIVE_TESTS=1 npm test -- tests/integration/providers/
```

Requires `.env.test.live` with sandbox credentials.

### Apply a new migration

```bash
# Write the migration in src/storage/migrations/000N_your_change.sql
# Run rehearsal first
npm run migrate:rehearse

# If green, apply normally (in dev)
npm run migrate:apply
```

### Build the Docker image

```bash
docker build -t atl-mcp:dev .
```

## Project structure

```
src/
  config/         # Env loader + tier defaults
  domain/         # 18 typed entities
  mcp/            # MCP transport + tools + session
  observability/  # Pino logger
  preflight/      # Capability discovery
  providers/
    atlassian/    # Jira + Confluence
    vcs/          # Bitbucket
    http/         # Retry, pagination, REST client
  security/       # Policy, tokens, audit, webhooks
  storage/        # Schema, migrations, repositories
  workflows/      # State-machine coordinators
tests/
  unit/           # Fast, no I/O
  integration/    # DB, providers, MCP server
  lint/           # CI rules (no-stdout)
docs/
  sdlc/           # This SDLC documentation tree
  partners/       # 42 partner integration guides
  adr/            # Architectural decision records
  demo/           # Demo portfolio mirror
scripts/
  lint-no-stdout.mjs
```

For depth on each area, see [`../04-design/module-*.md`](../04-design/).

## Iron laws

Read [`../13-quality/iron-laws.md`](../13-quality/iron-laws.md). The summary:

1. **Never claim a task done without verification evidence.** Tests pass, build green, etc.
2. **Never write production code without a failing test first** when adding behavior.

These are non-negotiable. PRs without test-first evidence are returned.

## CLAUDE.md / AGENTS.md

Read [`CLAUDE.md`](../../../CLAUDE.md) (Claude-specific guidance) and [`AGENTS.md`](../../../AGENTS.md) (LF spec; canonical for all agent hosts). Both shape how AI-assisted work happens in this repo.

## Configuration tips

### `.env.local` (gitignored)

Create this file with your dev values:

```
DEPLOYMENT_TIER=dev
LOG_LEVEL=debug
TOKEN_MASTER_KEY=<openssl rand -hex 32>
DATABASE_URL=  # leave empty; pglite path will be used
```

### Audit keypair

Auto-generated on first run by the dev startup path. Located at `./.orchestrator-audit-keypair.json` (gitignored). Don't commit it; don't share it.

### Atlassian / Bitbucket credentials

For unit + integration: not needed.
For live tests: create `.env.test.live` with sandbox credentials.
For real provisioning against your own Atlassian / Bitbucket: set vars per [`../09-deployment/secrets-provisioning.md`](../09-deployment/secrets-provisioning.md).

## Where to ask questions

- **Spec questions:** read v6 first.
- **Build sequence:** read [`../../build-orchestration.md`](../../build-orchestration.md).
- **Per-milestone checklist:** read [`../../milestone-checklists/`](../../milestone-checklists/).
- **Architecture:** read [`../02-architecture/`](../02-architecture/).
- **Security:** read [`../06-security/`](../06-security/).

If a question isn't answerable from those: file an issue (or ask the maintainer if you're collaborating).

## Linked artifacts

- **AGENTS.md:** [`../../../AGENTS.md`](../../../AGENTS.md)
- **CLAUDE.md:** [`../../../CLAUDE.md`](../../../CLAUDE.md)
- **README:** [`../../../README.md`](../../../README.md)
- **Build sequence:** [`../../build-orchestration.md`](../../build-orchestration.md)
- **Sibling docs:** [`integrator-guide.md`](integrator-guide.md), [`operator-guide.md`](operator-guide.md), [`partner-onboarding.md`](partner-onboarding.md), [`glossary-quick.md`](glossary-quick.md)

---

*Last reviewed: 2026-04-25 by Chris.*
