---
title: Glossary Quick Reference
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, operator, integrator]
sdlc_category: 11-onboarding
related: [docs/sdlc/17-glossary/README.md]
---

# Glossary — Quick Reference

> **TL;DR:** The top-30 project-specific terms. For the full glossary, see [`../17-glossary/README.md`](../17-glossary/README.md).

This is the flashcard version. If you're new and just want to be able to read the rest of the docs without bouncing into the full glossary every paragraph: this list.

---

| Term | One-line definition |
|---|---|
| **MCP** | Model Context Protocol — what build agents speak to consume tools / resources / prompts. atl-mcp is an MCP server. |
| **ADF** | Atlassian Document Format — JSON tree for rich Confluence + Jira content. ADR-0003. |
| **ed25519** | Edwards-curve digital signature — used in audit chain signing. |
| **STRIDE** | Threat model framework: Spoofing, Tampering, Repudiation, Information disclosure, DoS, Elevation. |
| **Iron laws** | Two non-negotiables: verify before claim done; test-first for new behavior. CLAUDE.md. |
| **Dogfooding frame** | Strategy: use atl-mcp to seed atl-mcp's own project. Demo / portfolio strategy. |
| **Audit chain** | Append-only, hash-linked, ed25519-signed log of state changes. v6 §30.1, ADR-0005. |
| **Genesis block** | First entry in the chain; `prev_hash = NULL`. Special case. |
| **Key registry** | Git ref versioning the audit signing public keys. |
| **Policy decision layer** | Single function gate: every state change passes through `evaluate()`. |
| **Lethal trifecta** | The dominant LLM-app risk: PRIVATE input × UNTRUSTED content × EXTERNAL emit. v6 §38.1. |
| **ProjectState** | 13-state state machine for a project's lifecycle. v6 §6. |
| **ProjectBlueprint** | Root aggregate: requirements, epics, architecture, security, testing, release. v6 §10. |
| **ProjectProfile** | Preflight discovery output — what the target Atlassian + VCS supports. |
| **ArtifactPlan** | Idempotent action list: what gets written to Jira / Confluence / VCS. |
| **ContextPack** | Bounded, redacted, model-targeted context for build agents. v6 §16. |
| **Adversarial triplet** | Three-pass validation: emit, critique, accept. v6 §18.1. |
| **Hunk-level review** | Mid-execution approval gate for risky writes. v6 §18.3. |
| **Tool collapse** | Pattern: one tool with action enum > many narrow tools. v6 §14. |
| **Iron-rolled commit** | Commit that meets all CI gates AND has a verified failing-without test. |
| **First shippable slice** | M6a — earliest milestone where v0.1 release tag is valid. |
| **Cumulative gates** | CI checks that grow by milestone; existing gates never go away. |
| **Rehearsal** | Migration runner mode: apply pending against snapshot, verify post-conditions, discard. PCO-13. |
| **Iron law of stdout** | Never write to stdout from src/ — corrupts MCP JSON-RPC. CLAUDE.md, lint enforced. |
| **SLO / SLI** | Service Level Objective (target) / Indicator (measurement). |
| **RTO / RPO** | Recovery Time Objective (downtime) / Recovery Point Objective (data loss). |
| **The four agent modes** | Orchestrator, Builder, Reviewer, Operator. v6 §14.1. |
| **Iron law of audits** | Every state change auditable; refusal IS an audit event. |
| **Operator (human)** | The human running atl-mcp in production. (Distinct from "operator agent mode.") |
| **Build agent** | Agentic AI client (Claude Code, Cursor, etc.). |

## When to read more

If a term needs a paragraph rather than a line: [`../17-glossary/README.md`](../17-glossary/README.md).
If a term is implementation-specific: [`../17-glossary/domain-vocabulary.md`](../17-glossary/domain-vocabulary.md).

## Linked artifacts

- **Full glossary:** [`../17-glossary/README.md`](../17-glossary/README.md)
- **Domain vocabulary:** [`../17-glossary/domain-vocabulary.md`](../17-glossary/domain-vocabulary.md)
- **Demo glossary (reviewer audience):** [`../../demo/glossary.md`](../../demo/glossary.md)

---

*Last reviewed: 2026-04-25 by Chris.*
