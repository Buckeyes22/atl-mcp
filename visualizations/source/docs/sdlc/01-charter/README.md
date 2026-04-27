---
title: Project Charter
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [executive, engineer, integrator, operator]
sdlc_category: 01-charter
related: [agent-context-orchestrator-mcp-plan-v6.md, README.md, docs/demo/README.md]
---

# Project Charter — Agent Context Orchestrator (atl-mcp)

> **TL;DR:** atl-mcp is an MCP server that turns raw project requirements into agent-ready Atlassian + VCS workspaces. It exists because the work of producing those workspaces by hand is mechanical, error-prone, and rate-limiting on agentic AI build agents. Single-tenant for v1; multi-tenant SaaS post-v1.

This is the single source of truth for the project's mission, scope, decision authority, and success criteria. Every other SDLC doc is downstream of this one.

---

## Mission

> Turn raw project requirements into agent-ready Jira + Confluence + Bitbucket workspaces, deterministically and idempotently, with auditable writes.

This is the v6 §1 mission, restated. The exact phrasing matters — each clause is load-bearing:

- **"Raw project requirements"** — markdown, UIO-stored documents, file uploads. Not normalized, not pre-decomposed.
- **"Agent-ready"** — consumable by both humans (in Jira/Confluence/PRs) AND agentic AI build agents (Claude Code, Cursor, Codex, etc.) via MCP.
- **"Jira + Confluence + Bitbucket"** — Atlassian Cloud + Bitbucket Cloud only in v1. GitHub, GitLab, Linear, BB Server are explicitly post-v1.
- **"Deterministically"** — the same profile produces the same workspace. No "creative" output.
- **"Idempotently"** — re-running against an existing workspace produces a no-op or a precise diff, never a duplicate.
- **"Auditable writes"** — every state-changing operation is recorded in a tamper-evident audit log (v6 §30.1, ADR-0005).

## Why this exists

The forcing function: when a new initiative starts, someone has to translate "here's what we want to build" into the artifacts an engineering team — and increasingly, agentic AI build agents — need to begin work. Epics, stories with acceptance criteria, Confluence pages with architecture and runbooks, repo scaffolding with branching conventions and an agent-context manifest.

This work is mechanical but high-stakes. Bad scaffolding propagates for months. The cost of getting it wrong scales with team size. The cost of getting it right by hand scales with project count.

atl-mcp ingests a structured profile and emits a complete workspace. The output is consumable by humans and agents through the same surfaces (Jira, Confluence, Bitbucket). Re-running is idempotent. The audit log is verifiable.

A successful atl-mcp turns "starting a new project" from a 1-2 week lead-up into a hours-long lead-up. That's the bet.

## Users

| Role | Relationship | What they need |
|---|---|---|
| **Operator** | Runs the orchestrator at project kickoff | Reliable provisioning; clear failure modes; rollback procedure |
| **Build agent** | Agentic AI consumer (Claude Code, Cursor, etc.) | Stable MCP surface; bounded context packs; readiness signal |
| **Reviewer** | Human reviewing changes via Atlassian/Bitbucket | Same UX as human-authored work; clear actor attribution |
| **Auditor** | Reviews state changes, security, compliance | Tamper-evident audit log; threat model; compliance posture |
| **Integrator** | Builds an MCP host that consumes atl-mcp | API stability; documented capability negotiation |
| **Sponsor** | Funds / authorizes the project | Predictable scope; visible progress; defensible non-goals |

## Scope (v1)

### In scope

- **Atlassian Cloud** — Jira REST v3, Confluence REST v2 (storage + ADF body formats per ADR-0003).
- **Bitbucket Cloud** — REST v2.0 with app-password auth (ADR-0004).
- **MCP transport** — both stdio and Streamable HTTP (v6 §22).
- **Single-tenant deployment** — one instance per organization.
- **Auditable writes** — hash-chain + ed25519 signatures + git-ref versioned key registry (ADR-0005).
- **Capability discovery** — preflight against live Atlassian + VCS targets (v6 §19, M2).
- **Blueprint workflow with sampling** — MCP sampling per v6 §23 to turn profiles into epic+story plans (M4).
- **Provisioning planner + idempotent executors** — one for each of Jira (M6a), Confluence (M6b), VCS (M6c).
- **Context packs** — bounded, redacted, model-targeted (v6 §16, M7).
- **Readiness rubric** — 6-category deterministic + 4-tier LLM-judged (v6 §17, M8).
- **Webhook ingestion** — signed, deduplicated, normalized (v6 §26, M10).
- **Observability stack** — pino file logging, Prometheus counters, Langfuse traces (v6 §27).

### Out of scope (v1)

These are deliberate non-goals. See [`non-goals.md`](non-goals.md) for the full list with rationale.

- Multi-tenant SaaS hosting (post-v1; v6 §7.3 documents the runway).
- Persistent agent memory across sessions (v6 §4; see `docs/partners/hindsight.md`).
- GitHub, GitLab, Linear (v6 §3).
- Bitbucket Data Center / Server (v6 §3).
- OpenAPI codegen for the admin REST surface (v6 §40, F-151).
- Customer-facing UI (none planned for v1).
- Compliance certification (SOC2, HIPAA, etc.). Applicability statement only — see [`../03-requirements/compliance-scope.md`](../03-requirements/compliance-scope.md).

### Success criteria

The project is successful when **all** of the following are true:

1. An operator can provision a new project end-to-end (intake → blueprint → provision → handoff) in under 10 minutes against a real Atlassian + Bitbucket site.
2. The orchestrator can re-run against an existing workspace without producing duplicates (idempotency).
3. Every state-changing operation is recorded in an audit log that an offline verifier can validate.
4. A build agent (Claude Code or Cursor) can consume the orchestrator's MCP surface and successfully implement a story end-to-end against the provisioned scaffolding.
5. The capability-discovery preflight catches at least 80% of misconfigurations (auth, missing fields, rate limits) before any write happens.
6. The system passes its own readiness rubric (v6 §17) at "Ready" tier or above.

These criteria gate v1.0.0. v0.x releases meet a subset.

## Decision authority

For v1, the project is single-maintainer (Chris). Decision authority is straightforward; the decision log in [`../12-governance/decision-log.md`](../12-governance/decision-log.md) records every architectural choice for future readers.

For changes that need an ADR, see [`../12-governance/adr-process.md`](../12-governance/adr-process.md). For changes that don't (style tweaks, doc updates, dependency bumps), normal review suffices.

## Stakeholders (v1)

| Stakeholder | Interest | Engagement |
|---|---|---|
| Project owner (Chris) | Build something defensible at staff-engineer scope | Decision authority + execution |
| Reviewers (demo audience) | Verify scope and depth | Read [`docs/demo/`](../../demo/) |
| Future team members | Maintain and extend | Read [`docs/sdlc/`](..) |
| Future customers (post-v1) | Run atl-mcp in their environment | TBD |

## Constraints

- **Deployment model:** single-tenant on-prem; multi-tenant runway documented but not implemented.
- **Provider scope:** Atlassian Cloud + Bitbucket Cloud only.
- **Auth:** API token + OAuth 3LO for Atlassian; app password + OAuth 2.0 for Bitbucket.
- **Storage:** Postgres in production; pglite in dev (ADR-0001).
- **Crypto:** @noble/ciphers + @noble/curves only (ADR-0002).
- **Build language:** TypeScript with strict mode (`exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`).
- **Build agent:** atl-mcp is build-agent-agnostic. No Claude-Code-only features.
- **CI gates:** typecheck, vitest, lint:no-stdout, anti-stub scanner, semgrep, MCP conformance.

## Operating principles

These come from CLAUDE.md and v6:

1. **Iron laws** (CLAUDE.md, [`../13-quality/iron-laws.md`](../13-quality/iron-laws.md)):
   - Never claim a task done without verification evidence.
   - Never write production code without a failing test first when adding behavior.
2. **Never write to stdout from `src/`** — the stdio MCP transport carries JSON-RPC frames; one rogue write breaks every connected client (CLAUDE.md, [`../13-quality/anti-slop.md`](../13-quality/anti-slop.md)).
3. **Single-message Task dispatch** for parallel sub-agents — Claude Code only parallelizes within a single message.
4. **No skills/hooks/plugins outside the v6 spec.** New surface area requires an ADR.
5. **Audit by default.** Every state-changing operation generates an audit entry; refusal to act is also an audit event.

## Linked artifacts

- **Spec:** v6 §1 (Mission), §3 (Assumptions), §4 (Non-Goals), §28 (Milestones)
- **Strategic decision:** v6 §2 (orchestration MCP, not API wrapper)
- **Multi-tenant runway:** v6 §7.3
- **Repo:** [`README.md`](../../../README.md), [`AGENTS.md`](../../../AGENTS.md), [`CLAUDE.md`](../../../CLAUDE.md)
- **Demo:** [`docs/demo/README.md`](../../demo/README.md), [`docs/demo/interviewer-walkthrough.md`](../../demo/interviewer-walkthrough.md)
- **Sub-charter docs:** [`product-strategy.md`](product-strategy.md), [`non-goals.md`](non-goals.md)

---

*Last reviewed: 2026-04-25 by Chris.*
