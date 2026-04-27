---
title: Cross-Cutting Tradeoffs
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, executive]
sdlc_category: 02-architecture
related: [docs/adr/, docs/sdlc/02-architecture/README.md]
---

# Cross-Cutting Tradeoffs

> **TL;DR:** A register of design choices that shape the system but don't fit a single ADR. Each row: the choice, the alternative, the rationale, and the cost. Use this when reviewing the system from "why does it look this way?" rather than "how do I work on this?"

ADRs cover individual decisions. This doc covers patterns and stances that pervade — they're not single decisions, they're cross-cutting orientations.

---

## Architectural orientations

| Choice | Alternative | Rationale | Cost |
|---|---|---|---|
| **Build-agent-agnostic MCP server** | Claude-Code-only orchestrator | Future-proof; broader market; no per-host special-casing | Bigger MCP surface; capability negotiation must handle multiple client capabilities |
| **Single-tenant v1** | Multi-tenant from day one | Simpler ops; tighter security model; faster shipping | Multi-tenant is a real refactor (PCO-51, audit chain, token store) |
| **Atlassian + Bitbucket Cloud only** | GitHub / GitLab from v1 | Bounded scope; deeper integration; partner inventory backed | Customer demand for GitHub will be deferred |
| **Synchronous-first MCP, async via job queue** | Async-everything | Most tools complete in seconds; sync UX is simpler | Long operations (provisioning, sampling) need async; complexity in the queue layer |
| **No customer-facing UI** | Bundled web UI | Operators use Atlassian / Bitbucket UIs as the primary surface | Operator experience depends on Atlassian/BB UX |

## Implementation orientations

| Choice | Alternative | Rationale | Cost |
|---|---|---|---|
| **TypeScript strict mode + extras** | Looser typing | Catches more bugs at compile time; refactoring confidence | Some libraries fight strict mode |
| **Pino file logger only (no stdout)** | console / pino-to-stdout | MCP stdio transport requires stdout to be JSON-RPC pure | One log destination (file); ops platform must capture or ship |
| **Test-first iron law** | Test-after | Fewer regressions; test coverage by construction | Slower than vibes-driven |
| **No skills/hooks/plugins outside v6 spec** | Permissive | Predictability; no surprise surfaces | Slower to add new behaviors |
| **Single-message Task dispatch for sub-agents** | Free dispatch | Claude Code parallelism quirk | Documentation overhead in CLAUDE.md |
| **Drizzle ORM** | Raw SQL / a different ORM | Type-safe queries; migration generation | Drizzle's migration runner replaced with custom (PCO-13) |
| **@noble/ciphers + @noble/curves** | Node crypto / libsodium-wrappers | Audited primitives, pure JS, no native deps | Slightly slower than native |

## Operational orientations

| Choice | Alternative | Rationale | Cost |
|---|---|---|---|
| **Audit by default** | Selective auditing | Forensic completeness; no "did I forget to audit?" | Audit chain growth; storage cost |
| **Fail closed on audit failure** | Continue on audit failure | Integrity over availability | Outage if audit infra is down |
| **Loopback mgmt API** | Public mgmt API | Reduce attack surface | Operators need shell access (or proxy) |
| **Migrations require rehearsal** | Apply directly | Caught Incident B class | Slower migration cycle |
| **Idempotency at the planner level** | Idempotency at provider level | Single point of correctness | Planner is more complex |

## Security orientations

| Choice | Alternative | Rationale | Cost |
|---|---|---|---|
| **Hash-chain + ed25519 audit** | Append-only with snapshots | Tamper-evident with cheap verification | Single-tenant baked in |
| **Git ref for audit key registry** | DB-backed registry | Atomic; verifiable history; cross-host replication | Operational ceremony for rotations |
| **HMAC-SHA256 webhook verification** | TLS only | TLS doesn't authenticate body; HMAC does | Per-source secret management |
| **Default-deny policy adapter** | Default-allow with deny rules | Insider abuse mitigation | Per-intent rules required |
| **No PII in audit payloads** | Free-form audit content | GDPR compliance; right-to-erasure | Discipline at audit-write sites |

## Cross-cutting "no"s

These are deliberate non-decisions worth surfacing:

- **No internal RPC.** Modules are in-process TypeScript. No microservices, no internal HTTP / gRPC.
- **No long-lived caches at module boundaries.** Caches are scoped (request, session, TTL); no module-global state that survives indefinitely.
- **No automatic feature-flag mutation.** Flags are read once at startup. No runtime flag flipping (footgun avoidance).
- **No vendor-locked secrets.** Secret manager is platform-pluggable; the application reads env vars / disk only.
- **No automatic self-healing of corrupted state.** If something looks corrupt, surface it loudly. Silent self-heal masks incidents.

## When a tradeoff promotes to an ADR

A tradeoff in this register promotes to an ADR when:

- The decision becomes contentious (multiple credible alternatives, repeated discussion).
- The decision affects external API shape.
- Implementing the decision changes the threat model.
- A future maintainer would want the rationale on hand without reading this file.

Today's ADRs (0001-0005) all started as cross-cutting tradeoffs that earned a record. Several rows above may earn their own ADR over time.

## Linked artifacts

- **All ADRs:** [`../../adr/`](../../adr/)
- **Sibling architecture:** [`README.md`](README.md), [`containers.md`](containers.md), [`data-flow.md`](data-flow.md), [`trust-boundaries.md`](trust-boundaries.md)
- **Charter (the highest-level "why"):** [`../01-charter/README.md`](../01-charter/README.md)
- **Spec:** v6 §2 (Strategic design)

---

*Last reviewed: 2026-04-25 by Chris.*
