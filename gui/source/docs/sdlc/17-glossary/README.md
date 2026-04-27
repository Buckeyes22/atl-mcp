---
title: Glossary
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, operator, integrator, auditor, executive]
sdlc_category: 17-glossary
related: [docs/demo/glossary.md, agent-context-orchestrator-mcp-plan-v6.md §10]
---

# Glossary

> **TL;DR:** Project-specific vocabulary. Centralized so every other doc can reference; updated when terms shift. The portfolio version at [`docs/demo/glossary.md`](../../demo/glossary.md) is a subset for reference readers.

Skip terms that are obvious in context (REST, Postgres, JSON). Keep terms whose definitions are project-specific or where ambiguity bites.

---

## Protocols and standards

**MCP (Model Context Protocol).** Anthropic-stewarded protocol that agentic AI build agents speak to consume tools, resources, and prompts. atl-mcp is an MCP server; build agents are MCP clients. See `src/mcp/`, v6 §14.

**JSON-RPC 2.0.** The wire protocol underlying MCP message exchange. Reason stdio MCP must keep stdout protocol-pure: stdout carries JSON-RPC frames.

**Streamable HTTP.** MCP transport over HTTP with SSE keep-alive, sliding TTL, max-concurrent caps. v6 §22.1.

**ADF (Atlassian Document Format).** JSON tree representation of rich content used by Confluence (and Jira issue descriptions). Round-trips cleanly; preferred for new content. ADR-0003.

**Confluence storage format.** Confluence's legacy XHTML-ish body format. Required for some macros; supported as a fallback per ADR-0003.

**ed25519.** Edwards-curve digital signature algorithm. Public-key signature with small keys (32-byte public, 64-byte signature), fast verification, deterministic from key + message (no PRNG needed for signing). Used in the audit chain (v6 §30.1, ADR-0005).

**XChaCha20-Poly1305.** Authenticated symmetric encryption used for token storage at rest. ADR-0002.

**RFC 8785 (JCS).** JSON Canonicalization Scheme. The audit chain canonicalizes payload JSON via JCS before hashing, so logically-identical payloads produce identical hashes regardless of key ordering or whitespace.

**HMAC-SHA256.** Symmetric authentication used for webhook signature verification. Per-source shared secrets.

**STRIDE.** Threat-modeling framework: Spoofing / Tampering / Repudiation / Information disclosure / Denial of service / Elevation of privilege. Used in [`../06-security/threat-model.md`](../06-security/threat-model.md).

**MADR.** Markdown ADR template (4.0). Used by all ADRs in `docs/adr/`. F-122 (`docs/partners/madr.md`).

**C4 model.** Architecture documentation methodology with four levels: System context (L1), Containers (L2), Components (L3), Code (L4). atl-mcp uses L1-L3; L4 is overkill for a single-tenant v1.

## Agents and modes

**Agentic AI build agent.** A code-writing AI like Claude Code, Cursor, Codex, ChatGPT desktop. atl-mcp is build-agent-agnostic — no Claude-Code-only features.

**Build-agent-agnostic.** Architectural commitment: the orchestrator works with any MCP-capable client without per-client special-casing.

**The four agent modes.** Orchestrator, Builder, Reviewer, Operator. Per v6 §14.1, the orchestrator emits skills tailored to the agent's mode.

**Orchestrator.** atl-mcp itself. Plans and emits the agent context.

**Builder.** A build agent in active implementation mode (writing code).

**Reviewer.** A build agent in review mode (evaluating a builder's diff).

**Operator (agent mode).** A build agent in execution mode (running ops tasks). Distinct from "operator (human role)" — see "Operator" below.

**Operator (human role).** A human running atl-mcp at project kickoff, in production.

## Domain types and state

**Project profile.** JSON document describing what to build. Validated against the schema in `src/domain/projectProfile.ts`. Input to the blueprint workflow.

**Project blueprint.** The output of M4 — a structured plan derived from the profile. Includes epics, stories, architecture summary, risks, testing strategy, release plan. v6 §10.

**ProjectState.** A 13-state state machine: DRAFT_INTAKE → INTAKE_RECEIVED → BLUEPRINT_DRAFTED → BLUEPRINT_VALIDATED → PROVISIONING_PLANNED → PROVISIONING_PREVIEWED → PROVISIONING_EXECUTED → CONTEXT_PACKED → READINESS_CHECKED → READY_FOR_BUILD → BUILD_IN_PROGRESS → DRIFT_DETECTED → ARCHIVED, with VALIDATION_FAILED as a side state. v6 §6.

**PHASE-STATE.json.** The on-disk concurrent-safe state file for the project state machine, per v6 §6.1.

**Preflight profile.** JSON document emitted by capability discovery (`src/preflight/`) describing what the target Atlassian + VCS sites support. Consumed by the planner. v6 §19.

**ContextPack.** A bounded, redacted collection of context (requirements, code, history) sized for a target model's token budget. Generated for a project or issue. v6 §16.

**Adversarial verification triplet.** Three-pass validation pattern (v6 §18.1): emit, critique-by-different-prompt, accept-or-reject. Used on blueprint outputs.

**Hunk-level review gate.** Mid-execution approval gate (v6 §18.3) that pauses risky writes until a human approves a specific change diff.

**Tool-collapse pattern.** MCP design pattern where one tool with an `action` enum replaces many narrow tools. v6 §14.

## Security primitives

**Audit chain.** Append-only, hash-linked, ed25519-signed log of every state change. v6 §30.1, ADR-0005.

**Genesis block.** The first entry in the audit chain. `prev_hash = NULL`. Verifier handles it as a special case.

**Key registry.** Git-ref-versioned mapping of `key_id` to public-half. Stored as a git ref so writes are atomic, rotations produce verifiable history, and ops can verify against their fork.

**Policy decision layer.** Single function gate (`src/security/policyDecisionLayer.ts`) that every state-changing op passes through. Returns an effect (allow/deny/require_approval), obligations, confidence, and reasons.

**Lethal trifecta.** v6 §38.1 risk pattern: private data × untrusted content × external communications, in one operation. atl-mcp blocks when all three are present.

**ACL ranking.** PUBLIC / PRIVATE / SECRET classification per artifact field. v6 §38.2.

**Envelope encryption.** Pattern where data is encrypted with a per-record data key, which is itself encrypted with a master key. Reduces blast radius of master-key rotation. v6 references; current token store is single-key (PCO-57 tracks the upgrade).

## Process and discipline

**Iron laws.** Two non-negotiables in [`CLAUDE.md`](../../../CLAUDE.md): (1) never claim a task done without verification evidence, (2) never write production code without a failing test first when adding behavior. F-106.

**Two-stage review.** Spec-conformance review followed by code-quality review. Distinct passes per F-107.

**Definition of Ready (DoR).** Criteria a ticket must meet to enter the "Ready" column. [`../12-governance/definition-of-ready-done.md`](../12-governance/definition-of-ready-done.md).

**Definition of Done (DoD).** Criteria a ticket must meet to enter "Done". Same doc.

**Anti-slop.** Discipline of catching low-quality patterns (unused vars, console.* in src/, stub patterns) automatically rather than by review. [`../13-quality/anti-slop.md`](../13-quality/anti-slop.md).

**Dogfooding frame.** The portfolio strategy: use atl-mcp to seed atl-mcp's own Jira+Confluence project. The structure of the seeded project IS the demonstration. [`docs/demo/`](../../demo/).

**Iron-rolled commit.** Commit that meets all CI gates AND has a verified test that fails-without / passes-with the change. Required for production milestones.

**Postmortem framework.** CATCH → DIAGNOSE → ROOT CAUSE → FIX → SAVE → ENFORCE. v6 §30.3, F-099 (vibe-tuning).

## Operational

**SLO (Service Level Objective).** A target level for an SLI. Aspirational in v1. [`../08-operations/slo-sli.md`](../08-operations/slo-sli.md).

**SLI (Service Level Indicator).** A measured property of the system (latency, error rate). Same doc.

**Error budget.** The acceptable difference between SLI and SLO over a window. Defines how much we can ship vs. need to stabilize.

**RTO (Recovery Time Objective).** Maximum acceptable time to restore service after an incident. [`../10-dr-bcp/recovery-objectives.md`](../10-dr-bcp/recovery-objectives.md).

**RPO (Recovery Point Objective).** Maximum acceptable data loss measured in time. Same doc.

**MTTR / MTTD.** Mean Time To Recovery / Detection. Operational metrics.

**Cumulative gates.** CI checks that accumulate by milestone — M0 has the no-stdout lint, M1 adds typecheck and vitest, M2 adds eval-view, etc. AGENTS.md §CI gates, [`../09-deployment/ci-cd.md`](../09-deployment/ci-cd.md).

**Rehearsal mode (storage migrations).** Migration runner mode that applies a pending migration to a temp DB seeded from prod-shaped data, verifies invariants, then discards. PCO-13. `src/storage/migrationRunner.ts`.

## Roles in the organization

**Maintainer (v1).** Single role: Chris. All decision authority for v1.

**Sponsor.** Whoever is funding/authorizing the project's continuation.

**Build agent.** See above (agent mode).

**Operator (human).** Person running atl-mcp in production at project kickoff.

**Reviewer (human).** Person reviewing changes via Atlassian/Bitbucket UIs as usual.

**Auditor.** Internal or external party reviewing compliance posture, audit chain integrity, etc.

**Integrator.** Builder of an MCP host that consumes atl-mcp.

**Partner team.** Team adopting atl-mcp for their own project's seed.

## Milestones

**M0 — Scaffold.** Runtime, transport, lint. v6 §28 M0. PCO-1 epic.

**M1 — Domain + storage.** Domain types, schema, migrations, token encryption. PCO-2.

**M2 — Atlassian providers.** Jira + Confluence REST clients, OAuth 3LO, capability discovery. PCO-3.

**M3 — VCS provider.** Bitbucket REST + worktree manager. PCO-4.

**M4 — Blueprint workflow.** Profile → blueprint via MCP sampling. PCO-5.

**M5 — Provisioning planner.** Diff-against-live, idempotent action list. PCO-6.

**M6a — Jira executor.** First shippable slice. PCO-6.

**M6b — Confluence executor.** Storage + ADF dual support. PCO-6.

**M6c — VCS executor.** Branches + agent-context manifest. PCO-6.

**M7 — Context resources + packs.** Bounded, redacted context for build agents.

**M8 — Readiness validation.** 6-category + 4-tier rubric. v6 §17.

**M9 — Agent handoff.** Manifest spawn for build agents.

**M10 — Webhook ingestion.** Signed delivery + dedup.

**M11 — Notifications, evals, hardening.** Production-readiness slice. PCO-7 (audit + policy partial).

**The first shippable slice.** M6a. Earliest milestone where v0.1 release tag becomes valid.

## Linked artifacts

- **Spec:** v6 §10 (Domain), §28 (Milestones)
- **Demo subset:** [`docs/demo/glossary.md`](../../demo/glossary.md)
- **Domain vocabulary detail:** [`domain-vocabulary.md`](domain-vocabulary.md) (state machine, types, design patterns)
- **Templates** that reference these terms: [`../templates/`](../templates/)

---

*Last reviewed: 2026-04-25 by Chris.*
