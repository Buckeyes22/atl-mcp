---
title: Onboarding
owner: Chris
status: accepted
last_reviewed: 2026-04-26
version: 1.0.0
audience: [engineer, operator, integrator, executive]
sdlc_category: 11-onboarding
related: [docs/sdlc/README.md, docs/sdlc/01-charter/README.md]
---

# Onboarding

> **TL;DR:** Pick the path for your role. Each path lands you in the right corner of the SDLC tree without requiring full-tree exploration. The decision tree below is the canonical routing layer; the per-role guides under this directory contain the detail.

The four primary onboarding paths:

- **[Developer setup](developer-setup.md)** — joining as an engineer; clone, install, test, ship.
- **[Integrator guide](integrator-guide.md)** — building an MCP host that consumes atl-mcp.
- **[Operator guide](operator-guide.md)** — running atl-mcp in production.
- **[Partner onboarding](partner-onboarding.md)** — adopting atl-mcp for a project's seed.

A fifth audience (auditors / security reviewers) routes through `docs/sdlc/06-security/` rather than this directory; the decision tree calls that out explicitly.

<figure>

<svg viewBox="0 0 1200 580" xmlns="http://www.w3.org/2000/svg" font-family="IBM Plex Sans, system-ui">
  <defs>
    <marker id="ar13" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#43434a"/>
    </marker>
  </defs>

  <text x="40" y="28" font-family="IBM Plex Mono" font-size="10.5" letter-spacing="1.4" fill="#9a9690">FOUR ROLES · ONE DOC EACH · CROSS-REFERENCED FROM EVERY OTHER ENTRY POINT</text>

  <!-- root question -->
  <g transform="translate(500,60)">
    <rect width="200" height="60" rx="3" fill="#1a1a1c"/>
    <text x="100" y="26" text-anchor="middle" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#fff">what are you doing</text>
    <text x="100" y="44" text-anchor="middle" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#fff">with atl-mcp?</text>
  </g>

  <!-- branch lines -->
  <g stroke="#43434a" fill="none">
    <path d="M600,120 L160,200" marker-end="url(#ar13)"/>
    <path d="M600,120 L450,200" marker-end="url(#ar13)"/>
    <path d="M600,120 L750,200" marker-end="url(#ar13)"/>
    <path d="M600,120 L1040,200" marker-end="url(#ar13)"/>
  </g>

  <!-- branch labels -->
  <g font-family="IBM Plex Mono" font-size="10.5" fill="#43434a">
    <text x="320" y="156">"writing code in"</text>
    <text x="475" y="172">"deploying / running"</text>
    <text x="780" y="172">"calling MCP from"</text>
    <text x="900" y="156">"reviewing security /"</text>
    <text x="900" y="172">"compliance"</text>
  </g>

  <!-- ============ ROLE: ENGINEER ============ -->
  <g transform="translate(60,200)">
    <rect width="200" height="220" fill="#dceee5" stroke="#1f6e54" stroke-width="1.5"/>
    <text x="14" y="24" font-family="IBM Plex Mono" font-size="10" letter-spacing="1.2" fill="#0e3d2f">ROLE</text>
    <text x="14" y="44" font-family="IBM Plex Sans" font-size="14" font-weight="600" fill="#0e3d2f">Engineer</text>
    <line x1="14" y1="54" x2="186" y2="54" stroke="#a3c8b8"/>
    <text x="14" y="76" font-family="IBM Plex Mono" font-size="10.5" fill="#0e3d2f">→ developer-setup.md</text>
    <text x="14" y="98" font-family="IBM Plex Mono" font-size="10" fill="#1f6e54">first 30 min</text>
    <g font-family="IBM Plex Sans" font-size="11" fill="#0e3d2f">
      <text x="14" y="118">• Node 22+, npm install</text>
      <text x="14" y="134">• npm test (all green)</text>
      <text x="14" y="150">• npm run dev — running</text>
    </g>
    <text x="14" y="178" font-family="IBM Plex Mono" font-size="10" fill="#1f6e54">key facts</text>
    <g font-family="IBM Plex Sans" font-size="11" fill="#0e3d2f">
      <text x="14" y="198">• pglite — no Postgres</text>
      <text x="14" y="214">• live tests opt-in</text>
    </g>
  </g>

  <!-- ============ ROLE: OPERATOR ============ -->
  <g transform="translate(350,200)">
    <rect width="200" height="220" fill="#fbeed8" stroke="#b96b16" stroke-width="1.5"/>
    <text x="14" y="24" font-family="IBM Plex Mono" font-size="10" letter-spacing="1.2" fill="#7a4408">ROLE</text>
    <text x="14" y="44" font-family="IBM Plex Sans" font-size="14" font-weight="600" fill="#7a4408">Operator</text>
    <line x1="14" y1="54" x2="186" y2="54" stroke="#e3c486"/>
    <text x="14" y="76" font-family="IBM Plex Mono" font-size="10.5" fill="#7a4408">→ operator-guide.md</text>
    <text x="14" y="98" font-family="IBM Plex Mono" font-size="10" fill="#b96b16">first 30 min</text>
    <g font-family="IBM Plex Sans" font-size="11" fill="#7a4408">
      <text x="14" y="118">• provision a host</text>
      <text x="14" y="134">• mount audit keypair</text>
      <text x="14" y="150">• /healthz + /readyz green</text>
    </g>
    <text x="14" y="178" font-family="IBM Plex Mono" font-size="10" fill="#b96b16">also see</text>
    <g font-family="IBM Plex Mono" font-size="10.5" fill="#7a4408">
      <text x="14" y="198">runbook.md · alerting.md</text>
      <text x="14" y="214">on-call-playbook.md</text>
    </g>
  </g>

  <!-- ============ ROLE: INTEGRATOR ============ -->
  <g transform="translate(640,200)">
    <rect width="200" height="220" fill="#dde9f2" stroke="#1f5f8a" stroke-width="1.5"/>
    <text x="14" y="24" font-family="IBM Plex Mono" font-size="10" letter-spacing="1.2" fill="#11364f">ROLE</text>
    <text x="14" y="44" font-family="IBM Plex Sans" font-size="14" font-weight="600" fill="#11364f">Integrator</text>
    <line x1="14" y1="54" x2="186" y2="54" stroke="#a3c4d8"/>
    <text x="14" y="76" font-family="IBM Plex Mono" font-size="10.5" fill="#11364f">→ integrator-guide.md</text>
    <text x="14" y="98" font-family="IBM Plex Mono" font-size="10" fill="#1f5f8a">first 30 min</text>
    <g font-family="IBM Plex Sans" font-size="11" fill="#11364f">
      <text x="14" y="118">• capability negotiation</text>
      <text x="14" y="134">• MCP tool surface</text>
      <text x="14" y="150">• stdio + Streamable HTTP</text>
    </g>
    <text x="14" y="178" font-family="IBM Plex Mono" font-size="10" fill="#1f5f8a">also see</text>
    <g font-family="IBM Plex Mono" font-size="10.5" fill="#11364f">
      <text x="14" y="198">api-mcp-tools.md</text>
      <text x="14" y="214">api-mgmt-rest.md</text>
    </g>
  </g>

  <!-- ============ ROLE: AUDITOR ============ -->
  <g transform="translate(940,200)">
    <rect width="200" height="220" fill="#fbe7e4" stroke="#b8281d" stroke-width="1.5"/>
    <text x="14" y="24" font-family="IBM Plex Mono" font-size="10" letter-spacing="1.2" fill="#7a1d14">ROLE</text>
    <text x="14" y="44" font-family="IBM Plex Sans" font-size="14" font-weight="600" fill="#7a1d14">Auditor</text>
    <line x1="14" y1="54" x2="186" y2="54" stroke="#e3a39a"/>
    <text x="14" y="76" font-family="IBM Plex Mono" font-size="10.5" fill="#7a1d14">→ threat-model.md</text>
    <text x="14" y="98" font-family="IBM Plex Mono" font-size="10" fill="#b8281d">first 30 min</text>
    <g font-family="IBM Plex Sans" font-size="11" fill="#7a1d14">
      <text x="14" y="118">• STRIDE matrix (V7)</text>
      <text x="14" y="134">• audit chain construction</text>
      <text x="14" y="150">• controls-matrix.md</text>
    </g>
    <text x="14" y="178" font-family="IBM Plex Mono" font-size="10" fill="#b8281d">also see</text>
    <g font-family="IBM Plex Mono" font-size="10.5" fill="#7a1d14">
      <text x="14" y="198">classification.md</text>
      <text x="14" y="214">compliance-scope.md</text>
    </g>
  </g>

  <!-- shared "also" rail -->
  <g transform="translate(60,460)">
    <rect width="1080" height="80" fill="#faf9f6" stroke="#c8c3b6"/>
    <text x="20" y="24" font-family="IBM Plex Mono" font-size="10" letter-spacing="1.4" fill="#9a9690">EVERY ROLE READS</text>
    <g font-family="IBM Plex Sans" font-size="12" fill="#1a1a1c">
      <text x="20" y="48">01-charter/README.md <tspan font-family="IBM Plex Mono" font-size="10.5" fill="#6f6e6a">— mission, scope, success criteria</tspan></text>
      <text x="20" y="68">12-governance/decision-log.md <tspan font-family="IBM Plex Mono" font-size="10.5" fill="#6f6e6a">— ADR index + non-ADR architectural decisions</tspan></text>
      <text x="540" y="48">17-glossary/README.md <tspan font-family="IBM Plex Mono" font-size="10.5" fill="#6f6e6a">— shared vocabulary</tspan></text>
      <text x="540" y="68">v6 §1, §2, §3, §4 <tspan font-family="IBM Plex Mono" font-size="10.5" fill="#6f6e6a">— spec foundations (single source for "why")</tspan></text>
    </g>
  </g>
</svg>

<figcaption><strong>V13 — "Which onboarding guide?" decision tree.</strong> Pick the role you actually have in atl-mcp's lifecycle, then read its first-30-minutes path. Engineers get hands-on the codebase; operators get the host; integrators get the MCP surface; auditors get the threat model. Everyone reads the charter, the decision log, the glossary, and the v6 §1–4 spec foundations — that band sits beneath the role split because it's about *why* the system exists, which doesn't depend on your role. (See <a href="../../visualizations/v13-onboarding-tree.html">full visualization page</a>.)</figcaption>
</figure>


## Linked artifacts

- **Top-level SDLC TOC:** [`docs/sdlc/README.md`](../README.md)
- **Charter (project mission, scope, non-goals):** [`docs/sdlc/01-charter/README.md`](../01-charter/README.md)
- **Glossary quick reference:** [`glossary-quick.md`](glossary-quick.md)

---

*Last reviewed: 2026-04-26 by Chris.*
