---
title: Operator Guide
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [operator]
sdlc_category: 11-onboarding
related: [docs/sdlc/08-operations/runbook.md, docs/sdlc/09-deployment/release-process.md]
---

# Operator Guide

> **TL;DR:** You're running atl-mcp in production. Here's what you need to know to do that confidently. This guide complements the [`runbook.md`](../08-operations/runbook.md) (symptom-organized incident response) — this doc covers the steady-state operations that don't fit "an alert just fired."

---

## Who you are

You're the human responsible for atl-mcp's operation in production. That means:

- You receive the alerts.
- You execute deploys.
- You rotate the credentials.
- You provision new projects via the orchestrator.
- You answer the SLO question when someone asks "is it healthy?"

For v1 single-maintainer, you and the developer-maintainer are the same person. The discipline is the same regardless.

## What you need to read first

In this order:

1. [`../01-charter/README.md`](../01-charter/README.md) — what this thing is and isn't.
2. [`../02-architecture/README.md`](../02-architecture/README.md) — the architectural shape.
3. [`../08-operations/runbook.md`](../08-operations/runbook.md) — the on-call manual.
4. [`../09-deployment/release-process.md`](../09-deployment/release-process.md) — how releases work.
5. [`../09-deployment/secrets-provisioning.md`](../09-deployment/secrets-provisioning.md) — what env vars and secrets exist.

After those: skim the rest of the SDLC tree as needed.

---

## Day-to-day operations

### Provisioning a new project

The end-to-end happy path, once M6a ships and integrates with M4 + M5:

1. **Get the requirements.** Markdown file, UIO document, or operator-typed content.
2. **Create the intake** via mgmt REST or MCP tool `project_intake_create`.
3. **Generate the blueprint** via `project_blueprint_generate`. Review the output.
4. **Run preflight** via `project_preflight_check`. Confirms Atlassian / Bitbucket are reachable + capable.
5. **Preview the provisioning** via `project_provision_preview`. Check the diff.
6. **Approve and execute** via `project_provision_execute`.
7. **Verify** the workspace was created in Atlassian / Bitbucket. Check audit log for the operations.
8. **Generate the agent handoff** via `generateHandoff` (M9). Build agent picks up from there.

For the v0.1 release (M6a): only step 1, 2, 3, 4, 5, 6, 7 are exercised end-to-end. Step 8 is M9.

### Routine health checks

Once per day (operator habit, before automation):

- `curl /healthz` — process up.
- `curl /readyz` — DB + migrations.
- `curl /admin/health/audit` (M11) — chain integrity.
- Glance at metrics: any unusual spikes?
- Tail logs: any unexpected errors?

The alerting layer ([`../08-operations/alerting.md`](../08-operations/alerting.md)) catches the urgent stuff. Daily glances catch slow drift.

### Deploys

Per [`../09-deployment/release-process.md`](../09-deployment/release-process.md). Cadence is event-driven (when there's a release ready), not scheduled.

### Rotations

| Secret | Cadence | Procedure |
|---|---|---|
| Atlassian API tokens | At-will (no schedule) | [`../06-security/token-storage.md`](../06-security/token-storage.md) "Rotation per-token" |
| Bitbucket app password | At-will | Same |
| Webhook shared secrets | When source rotates | Same |
| Master encryption key | At-will (recommend annual; documented re-encrypt drill) | [`../06-security/token-storage.md`](../06-security/token-storage.md) "Master-key rotation" |
| Audit signing keypair | At-will (recommend quarterly) | [`../06-security/audit-chain-threat-model.md`](../06-security/audit-chain-threat-model.md) "Key rotation procedure" |

Rotation is uneventful when you've practiced it. Rotation under fire (compromise) is uneventful only because you practiced it before. Practice in staging; document discrepancies; refine.

### Backup verification

Monthly: confirm backups are running and at least one restore test passes. See [`../10-dr-bcp/dr-test-schedule.md`](../10-dr-bcp/dr-test-schedule.md).

A backup that's never restored is a hope, not a plan.

---

## When you get paged

Per [`../08-operations/on-call-playbook.md`](../08-operations/on-call-playbook.md):

1. Acknowledge ≤ 5 min for P0, ≤ 30 min for P1.
2. Open the runbook entry the alert points to.
3. Run diagnostics; form a hypothesis.
4. Apply the documented action.
5. Communicate (status updates every 30 min during active incidents).
6. Resolve; verify; postmortem.

If the situation is novel: reason from first principles. If you're stuck: capture state aggressively (logs, metrics, queries) and escalate.

---

## What you should know about the system

The 5-minute summary, in case someone asks:

> atl-mcp is an MCP server. It takes raw project requirements and produces agent-ready Jira + Confluence + Bitbucket workspaces. It runs as a single Node.js process binding two ports (3000 for MCP, 3001 for mgmt). It uses Postgres for persistent state and emits a hash-chained, ed25519-signed audit log for every state change. Single-tenant in v1. The MCP transport is the public surface; mgmt is loopback-only.

The 30-second summary:

> An MCP server that turns project requirements into Jira+Confluence+Bitbucket workspaces.

The 5-second summary:

> Project workspace generator.

Use whichever level fits the audience. Operators benefit from understanding more depth — pick at least the 5-minute version when something goes wrong.

## What can go wrong (operator's mental model)

The high-impact failure modes you should pre-load:

| Failure | Severity | Where to look |
|---|---|---|
| Stdout corruption (MCP clients drop) | P0 | runbook.md |
| Audit chain integrity failure | P0 | runbook.md, security incident |
| Migration runner stuck | P1 | runbook.md, migration rehearsal |
| Provider 401 spike (auth lost) | P1 | runbook.md, token rotation |
| Provider 429 spike (rate limit) | P1 | runbook.md, planner pause |
| Webhook signature failures (probe vs config drift) | P1-P2 | runbook.md, secret rotation |
| Queue lag elevated | P2 | runbook.md, capacity |
| Memory pressure | P2 | profile, restart if approaching OOM |

The runbook organizes by symptom. This table is the index when "something is wrong, what category is it?" is the question.

## What's NOT your concern (in v1)

- **Multi-tenant isolation.** Single-tenant deployment.
- **Cross-region replication.** Single-region.
- **Customer-facing UI.** Doesn't exist.
- **24/7 SaaS support.** v1 is operator-driven, not always-on customer support.

These are post-v1 expansions; the operator guide will grow when they land.

## How to get unstuck

When the runbook doesn't cover what you're seeing:

1. **Capture state first.** Logs, metrics, queries, screenshots.
2. **Form hypotheses.** Write them down. Check each.
3. **Read the architecture.** A novel symptom often connects to a known component.
4. **Reason from invariants.** What's always supposed to be true? Which invariant might be violated?
5. **Add a runbook entry once resolved.** If it happened once, it'll happen again.

Most problems aren't novel. The runbook plus the architecture plus the threat model usually contain the answer.

## Linked artifacts

- **Daily reference:** [`../08-operations/runbook.md`](../08-operations/runbook.md)
- **Incident process:** [`../08-operations/on-call-playbook.md`](../08-operations/on-call-playbook.md)
- **Deploy process:** [`../09-deployment/release-process.md`](../09-deployment/release-process.md)
- **DR procedures:** [`../10-dr-bcp/`](../10-dr-bcp/)
- **Security operations:** [`../06-security/token-storage.md`](../06-security/token-storage.md), [`../06-security/audit-chain-threat-model.md`](../06-security/audit-chain-threat-model.md)
- **Sibling onboarding docs:** [`developer-setup.md`](developer-setup.md), [`integrator-guide.md`](integrator-guide.md), [`partner-onboarding.md`](partner-onboarding.md)

---

*Last reviewed: 2026-04-25 by Chris.*
