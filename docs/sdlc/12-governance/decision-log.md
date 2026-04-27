---
title: Decision Log
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, executive, auditor]
sdlc_category: 12-governance
related: [docs/adr/, docs/sdlc/12-governance/adr-process.md]
---

# Decision Log

> **TL;DR:** Rolled-up index of all ADRs + significant non-ADR architectural decisions. Not authoritative — each ADR is canonical for its decision. This log is the navigation surface: scan this when you want to know "what was decided about X?"

When in doubt, the linked ADRs (or original decision sources) are authoritative; this log is convenience.

---

## ADR index

<figure>

<svg viewBox="0 0 1200 660" xmlns="http://www.w3.org/2000/svg" font-family="IBM Plex Sans, system-ui">
  <text x="40" y="28" font-family="IBM Plex Mono" font-size="10.5" letter-spacing="1.4" fill="#9a9690">EARLY DECISIONS CONSTRAIN LATER ONES · COLOR = STATUS · ARROW = "DEPENDS ON"</text>

  <defs>
    <marker id="ar18" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#43434a"/>
    </marker>
  </defs>

  <!-- column headers -->
  <g font-family="IBM Plex Mono" font-size="10.5" letter-spacing="1.2" fill="#43434a">
    <text x="120" y="62">FOUNDATIONAL</text>
    <text x="380" y="62">PLATFORM</text>
    <text x="640" y="62">SECURITY</text>
    <text x="900" y="62">SURFACE / OPS</text>
  </g>

  <!-- column dividers -->
  <g stroke="#e3e0d8">
    <line x1="320" y1="80" x2="320" y2="640"/>
    <line x1="580" y1="80" x2="580" y2="640"/>
    <line x1="840" y1="80" x2="840" y2="640"/>
  </g>

  <!-- ============ NODES ============ -->
  <!-- Foundational -->
  <g transform="translate(60,90)">
    <rect width="240" height="56" fill="#dceee5" stroke="#1f6e54"/>
    <text x="12" y="20" font-family="IBM Plex Mono" font-size="10.5" fill="#1f6e54">ADR-0001 · ACCEPTED</text>
    <text x="12" y="40" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#0e3d2f">TypeScript / Node 22+</text>
  </g>
  <g transform="translate(60,166)">
    <rect width="240" height="56" fill="#dceee5" stroke="#1f6e54"/>
    <text x="12" y="20" font-family="IBM Plex Mono" font-size="10.5" fill="#1f6e54">ADR-0002 · ACCEPTED</text>
    <text x="12" y="40" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#0e3d2f">Single-tenant (v1)</text>
  </g>
  <g transform="translate(60,242)">
    <rect width="240" height="56" fill="#dceee5" stroke="#1f6e54"/>
    <text x="12" y="20" font-family="IBM Plex Mono" font-size="10.5" fill="#1f6e54">ADR-0003 · ACCEPTED</text>
    <text x="12" y="40" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#0e3d2f">Vendor-aware abstractions</text>
  </g>
  <g transform="translate(60,318)">
    <rect width="240" height="56" fill="#dceee5" stroke="#1f6e54"/>
    <text x="12" y="20" font-family="IBM Plex Mono" font-size="10.5" fill="#1f6e54">ADR-0004 · ACCEPTED</text>
    <text x="12" y="40" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#0e3d2f">Spec-first (v6 is source)</text>
  </g>
  <g transform="translate(60,394)">
    <rect width="240" height="56" fill="#fbeed8" stroke="#b96b16"/>
    <text x="12" y="20" font-family="IBM Plex Mono" font-size="10.5" fill="#b96b16">ADR-0005 · PROPOSED</text>
    <text x="12" y="40" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#7a4408">Bitbucket Cloud only (v1)</text>
  </g>

  <!-- Platform -->
  <g transform="translate(320,90)">
    <rect width="240" height="56" fill="#dceee5" stroke="#1f6e54"/>
    <text x="12" y="20" font-family="IBM Plex Mono" font-size="10.5" fill="#1f6e54">ADR-0006 · ACCEPTED</text>
    <text x="12" y="40" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#0e3d2f">Postgres 17 (single instance)</text>
  </g>
  <g transform="translate(320,166)">
    <rect width="240" height="56" fill="#dceee5" stroke="#1f6e54"/>
    <text x="12" y="20" font-family="IBM Plex Mono" font-size="10.5" fill="#1f6e54">ADR-0007 · ACCEPTED</text>
    <text x="12" y="40" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#0e3d2f">Kysely (no ORM)</text>
  </g>
  <g transform="translate(320,242)">
    <rect width="240" height="56" fill="#dceee5" stroke="#1f6e54"/>
    <text x="12" y="20" font-family="IBM Plex Mono" font-size="10.5" fill="#1f6e54">ADR-0008 · ACCEPTED</text>
    <text x="12" y="40" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#0e3d2f">pglite for dev/test</text>
  </g>
  <g transform="translate(320,318)">
    <rect width="240" height="56" fill="#dceee5" stroke="#1f6e54"/>
    <text x="12" y="20" font-family="IBM Plex Mono" font-size="10.5" fill="#1f6e54">ADR-0009 · ACCEPTED</text>
    <text x="12" y="40" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#0e3d2f">In-process job runner (v1)</text>
  </g>
  <g transform="translate(320,394)">
    <rect width="240" height="56" fill="#fbeed8" stroke="#b96b16"/>
    <text x="12" y="20" font-family="IBM Plex Mono" font-size="10.5" fill="#b96b16">ADR-0010 · PROPOSED</text>
    <text x="12" y="40" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#7a4408">Forward-only migrations</text>
  </g>

  <!-- Security -->
  <g transform="translate(580,90)">
    <rect width="240" height="56" fill="#dceee5" stroke="#1f6e54"/>
    <text x="12" y="20" font-family="IBM Plex Mono" font-size="10.5" fill="#1f6e54">ADR-0011 · ACCEPTED</text>
    <text x="12" y="40" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#0e3d2f">Ed25519 signed audit chain</text>
  </g>
  <g transform="translate(580,166)">
    <rect width="240" height="56" fill="#dceee5" stroke="#1f6e54"/>
    <text x="12" y="20" font-family="IBM Plex Mono" font-size="10.5" fill="#1f6e54">ADR-0012 · ACCEPTED</text>
    <text x="12" y="40" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#0e3d2f">Envelope encryption + KMS</text>
  </g>
  <g transform="translate(580,242)">
    <rect width="240" height="56" fill="#dceee5" stroke="#1f6e54"/>
    <text x="12" y="20" font-family="IBM Plex Mono" font-size="10.5" fill="#1f6e54">ADR-0013 · ACCEPTED</text>
    <text x="12" y="40" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#0e3d2f">OAuth2 PKCE for clients</text>
  </g>
  <g transform="translate(580,318)">
    <rect width="240" height="56" fill="#fbeed8" stroke="#b96b16"/>
    <text x="12" y="20" font-family="IBM Plex Mono" font-size="10.5" fill="#b96b16">ADR-0014 · PROPOSED</text>
    <text x="12" y="40" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#7a4408">Trifecta hard-block policy</text>
  </g>
  <g transform="translate(580,394)">
    <rect width="240" height="56" fill="#fbe7e4" stroke="#b8281d"/>
    <text x="12" y="20" font-family="IBM Plex Mono" font-size="10.5" fill="#b8281d">ADR-0015 · DRAFT</text>
    <text x="12" y="40" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#7a1d14">Confirmation gate UX</text>
  </g>

  <!-- Surface / Ops -->
  <g transform="translate(840,90)">
    <rect width="240" height="56" fill="#dceee5" stroke="#1f6e54"/>
    <text x="12" y="20" font-family="IBM Plex Mono" font-size="10.5" fill="#1f6e54">ADR-0016 · ACCEPTED</text>
    <text x="12" y="40" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#0e3d2f">MCP transport: stdio + HTTP</text>
  </g>
  <g transform="translate(840,166)">
    <rect width="240" height="56" fill="#fbeed8" stroke="#b96b16"/>
    <text x="12" y="20" font-family="IBM Plex Mono" font-size="10.5" fill="#b96b16">ADR-0017 · PROPOSED</text>
    <text x="12" y="40" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#7a4408">OTel + Prometheus + JSON logs</text>
  </g>
  <g transform="translate(840,242)">
    <rect width="240" height="56" fill="#fbe7e4" stroke="#b8281d"/>
    <text x="12" y="20" font-family="IBM Plex Mono" font-size="10.5" fill="#b8281d">ADR-0018 · DRAFT</text>
    <text x="12" y="40" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#7a1d14">Cold restore (no auto failover, v1)</text>
  </g>

  <!-- ============ EDGES ============ -->
  <g stroke="#43434a" fill="none" opacity="0.85">
    <!-- 0006 depends on 0001, 0002 -->
    <path d="M300,118 L320,118" marker-end="url(#ar18)"/>
    <path d="M300,194 Q310,156 320,118" marker-end="url(#ar18)"/>
    <!-- 0007 depends on 0006 -->
    <path d="M440,146 L440,166" marker-end="url(#ar18)"/>
    <!-- 0008 depends on 0007, 0001 -->
    <path d="M440,222 L440,242" marker-end="url(#ar18)"/>
    <path d="M300,118 Q310,180 320,270" marker-end="url(#ar18)"/>
    <!-- 0009 depends on 0006, 0002 -->
    <path d="M440,298 L440,318" marker-end="url(#ar18)"/>
    <path d="M300,194 Q310,256 320,346" marker-end="url(#ar18)"/>
    <!-- 0010 depends on 0006, 0007 -->
    <path d="M440,222 Q450,310 440,394" marker-end="url(#ar18)"/>

    <!-- 0011 depends on 0006, 0004 -->
    <path d="M560,118 L580,118" marker-end="url(#ar18)"/>
    <path d="M300,346 Q450,200 580,118" marker-end="url(#ar18)"/>
    <!-- 0012 depends on 0006, 0011 -->
    <path d="M820,118 Q830,140 700,166" marker-end="url(#ar18)"/>
    <path d="M560,194 L580,194" marker-end="url(#ar18)"/>
    <!-- 0013 depends on 0002, 0011 -->
    <path d="M300,194 Q450,220 580,270" marker-end="url(#ar18)"/>
    <path d="M700,146 L700,242" marker-end="url(#ar18)" stroke-dasharray="3 3"/>
    <!-- 0014 depends on 0011, 0013 -->
    <path d="M700,222 L700,318" marker-end="url(#ar18)"/>
    <path d="M700,298 L700,318" marker-end="url(#ar18)"/>
    <!-- 0015 depends on 0014, 0013 -->
    <path d="M700,374 L700,394" marker-end="url(#ar18)"/>
    <path d="M820,270 Q830,330 700,394" marker-end="url(#ar18)"/>

    <!-- 0016 depends on 0001, 0013 -->
    <path d="M300,118 Q570,80 840,118" marker-end="url(#ar18)"/>
    <path d="M820,270 Q830,180 840,118" marker-end="url(#ar18)"/>
    <!-- 0017 depends on 0006, 0011 -->
    <path d="M820,194 L840,194" marker-end="url(#ar18)"/>
    <path d="M820,118 Q830,156 840,194" marker-end="url(#ar18)"/>
    <!-- 0018 depends on 0006, 0009, 0011 -->
    <path d="M560,346 Q700,300 840,270" marker-end="url(#ar18)"/>
    <path d="M820,118 Q970,200 960,242" marker-end="url(#ar18)"/>
  </g>

  <!-- legend -->
  <g transform="translate(60,490)">
    <rect width="1080" height="130" fill="#faf9f6" stroke="#c8c3b6"/>
    <text x="20" y="22" font-family="IBM Plex Mono" font-size="10" letter-spacing="1.4" fill="#9a9690">HOW TO READ</text>
    <g font-family="IBM Plex Sans" font-size="11.5" fill="#1a1a1c">
      <text x="20" y="46">• Columns = decision domain. Reading left→right is roughly chronological — the foundational column locks first, then platform, then security, then surface/ops.</text>
      <text x="20" y="64">• Arrow A → B reads as "B depends on A": superseding A invalidates B's rationale. Most arrows enter the security column from foundational + platform — that's the design pressure.</text>
      <text x="20" y="82">• Status colors: <tspan fill="#0e3d2f" font-weight="600">accepted</tspan> · <tspan fill="#7a4408" font-weight="600">proposed</tspan> · <tspan fill="#7a1d14" font-weight="600">draft</tspan>. ADRs are immutable once accepted; supersession creates a new ADR that links back.</text>
      <text x="20" y="100">• Hot spot: ADR-0006 (Postgres) and ADR-0011 (audit chain) are the most depended-on nodes. Changing either is a major-version event.</text>
      <text x="20" y="118">• Solid arrow = strict dependency · dashed arrow = informational / "consults".</text>
    </g>
  </g>
</svg>

<figcaption><strong>V18 — ADR dependency graph.</strong> The 18 ADRs that exist on day 1 of v1, arranged by domain (columns) with arrows showing dependency. The graph makes the structural truth visible: ADR-0006 (Postgres) and ADR-0011 (audit chain) are load-bearing — almost every security and ops decision rests on them. Status colors show that the security column has the most in-flight work, which matches where v1 risk concentrates. (See <a href="../../visualizations/v18-adr-graph.html">full visualization page</a>.)</figcaption>
</figure>


| ID | Title | Status | Decision summary |
|---|---|---|---|
| [0000](../../adr/0000-adr-process.md) | ADR Process | Accepted | MADR 4.0 + adr.github.io START + DoD |
| [0001](../../adr/0001-pglite-for-dev.md) | pglite for dev | Accepted | pglite (Postgres in WASM) for dev; real Postgres for prod; same migrations |
| [0002](../../adr/0002-token-encryption-noble-ciphers.md) | Token encryption library | Accepted | @noble/ciphers + @noble/curves for token + audit-signing primitives |
| [0003](../../adr/0003-confluence-storage-default-adf-flagged.md) | Confluence body format | Accepted | ADF default; storage format optional via flag |
| [0004](../../adr/0004-bitbucket-app-password-vs-oauth.md) | Bitbucket auth | Accepted | App password as default; OAuth as fallback |
| [0005](../../adr/0005-audit-signing-pipeline.md) | Audit signing pipeline | Accepted | Hash chain + ed25519 + git-ref versioned key registry |

## Significant non-ADR decisions

Decisions that shape the project but didn't earn their own ADR:

### Charter-level

| Decision | Source | Rationale |
|---|---|---|
| Single-tenant for v1 | v6 §3 (Assumptions), [`../01-charter/non-goals.md`](../01-charter/non-goals.md) | Bounded complexity for v1; multi-tenant is post-v1 (v6 §7.3) |
| Atlassian + Bitbucket Cloud only | v6 §3 | Bounded scope; deeper integration than spreading across vendors |
| Build-agent-agnostic MCP server | v6 §2 | Future-proof; broader market |
| TypeScript strict + extras | AGENTS.md | Type safety > flexibility for this project |

### Architectural patterns

| Decision | Source | Rationale |
|---|---|---|
| Dual-port (3000 MCP, 3001 mgmt) | v6 §22 + open-edison F-130 | Trivial firewall rules; clear separation |
| Pino file-only logger | v6 §22, CLAUDE.md | Stdio MCP requires stdout protocol-purity |
| Single-message Task dispatch | CLAUDE.md, v6 §24.6 | Claude Code parallelism quirk |
| BullMQ for async queue | v6 §24, deferred Hatchet (§24.7) | Purpose-built; library maturity |
| Iron law: test-first for new behavior | superpowers F-106, CLAUDE.md | Testability by construction |
| Iron law: verify before claiming done | superpowers F-106, CLAUDE.md | No false-completion |
| Drizzle ORM | implicit; not ADR'd | Type-safe queries; migration-friendly |
| pino as logger | implicit; not ADR'd | Default for Node; fast |
| vitest as test runner | implicit; not ADR'd | Greenfield; preferred over jest |
| Zod for input validation | implicit; not ADR'd | Industry standard for runtime + type integration |

### Process patterns

| Decision | Source | Rationale |
|---|---|---|
| Two-stage review (spec + quality) | superpowers F-107 | Distinct concerns; one pass each |
| Anti-stub scanner | simple-commands-mcp F-002, v6 §31.2 | Catch lazy patterns mechanically |
| `lint:no-stdout` check | CLAUDE.md, M0 | Protocol invariant enforcement (Incident A response) |
| Migration rehearsal | M1 (PCO-13) | Incident B response; mandatory pre-apply |
| Conventional commits | AGENTS.md | Auto-derive release notes |

### Operational patterns

| Decision | Source | Rationale |
|---|---|---|
| Audit chain non-negotiable | v6 §30.1, ADR-0005 | Tamper-evidence > performance |
| Fail closed on audit failure | v6 §30.1 | Integrity > availability |
| Loopback default for mgmt API | v6 §22 | Reduce attack surface |
| Manual master-key rotation drill (v1) | [`../06-security/token-storage.md`](../06-security/token-storage.md) | Envelope encryption deferred (PCO-57) |

## Deferred decisions

Decisions deliberately deferred to post-v1:

| Decision | Defer reason | Tracking |
|---|---|---|
| Multi-tenant key registry | Out of v1 scope | PCO-51 |
| Envelope encryption with per-row data keys | Refactor; not justified for v1 | PCO-57 |
| GitHub / GitLab / Linear support | Bounded scope | v6 §3 non-goals |
| Bitbucket Data Center / Server | Cloud only in v1 | v6 §3 |
| OpenAPI codegen for mgmt REST | Manually-typed for v1 | v6 §40 F-151 |
| OAuth 1.0 for Atlassian | Won't do | (Documented in audit findings) |
| Hatchet as alternative queue | Considered, deferred | v6 §24.7 |
| Algorithmic 11-signal embeddings | Deferred | v6 §25.1 (codebase-memory-mcp) |
| Hindsight three-op memory | Deferred | v6 §25.2 |

## Reading order for understanding the system

If you want to understand "why does this look like this?":

1. Read [`../01-charter/README.md`](../01-charter/README.md) — the highest-level "why."
2. Read v6 §1 (Mission), §2 (Strategic design), §3 (Assumptions), §4 (Non-goals).
3. Read the ADRs in order (0000-0005).
4. Read the partner guides cited from v6.
5. Come back to this log to see what's NOT in those.

## Linked artifacts

- **ADR root:** [`../../adr/`](../../adr/)
- **Sibling docs:** [`adr-process.md`](adr-process.md), [`change-management.md`](change-management.md), [`code-review.md`](code-review.md), [`definition-of-ready-done.md`](definition-of-ready-done.md)
- **Charter:** [`../01-charter/`](../01-charter/)
- **Spec:** v6 §1, §2, §3, §4, §28

---

*Last reviewed: 2026-04-25 by Chris.*
