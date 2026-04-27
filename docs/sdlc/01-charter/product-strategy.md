---
title: Product Strategy
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [executive, engineer]
sdlc_category: 01-charter
related: [docs/sdlc/01-charter/README.md, agent-context-orchestrator-mcp-plan-v6.md §1, §2]
---

# Product Strategy

> **TL;DR:** atl-mcp solves the bottleneck between "we know what to build" and "build agents can start." That bottleneck is mechanical (epics, stories, scaffolding) but high-stakes (bad scaffolding propagates for months). v1's bet: a single-tenant tool that does this deterministically, with a defensible audit trail, will be valued enough to justify continued investment. Strategy is to ship M6a (first shippable slice) as the validating moment.

The strategy doc complements the charter ([`README.md`](README.md)). The charter answers "what is this?"; this doc answers "why is this worth doing, and how do we know it's working?"

---

## The problem we're solving

Every engineering initiative has a startup cost. Translating "here's what we want to build" into the artifacts a team (or a build agent) can begin work on is mechanical:

- Epics with clear scope.
- Stories with acceptance criteria.
- Architecture summary.
- Test strategy.
- Release plan.
- Repo scaffolding with branching conventions.
- Agent-context manifest for build agents.

This work is not creative. It's pattern-matching against precedent. Done well, it takes 1-2 weeks and the team starts well. Done badly, the consequences propagate for months — bad acceptance criteria produce bad PRs; bad scaffolding produces bad agent context; bad context produces bad implementation.

The problem with doing it well is that "well" requires:

- Knowledge of the target Atlassian / Bitbucket workspace conventions.
- Discipline about scope (don't over-spec, don't under-spec).
- Idempotency (can re-run as requirements evolve).
- Auditability (decisions traceable; provisions reversible).

Manually getting all four right consistently is hard. Hiring a "scaffolding expert" doesn't scale. The pattern is automate-able.

## The bet

v1 is a bet that:

1. **The orchestrator can produce scaffolding good enough that the operator's edit pass is small** (not "good enough to skip review entirely" — that's not the bet).
2. **Idempotent re-runs are valuable** — when requirements evolve, the orchestrator catches up without manual diff-resolution.
3. **The audit trail matters** — for compliance, for forensics, for trust between the operator and the build agents downstream.
4. **The MCP integration is the lever** — exposing this as MCP makes it consumable by every agentic AI build agent without per-host special-casing.

If this bet pays off, atl-mcp becomes the layer between "human intent" and "agentic build" — a critical piece of the AI-engineering toolchain.

If the bet doesn't pay off, the work still produced:

- A reference implementation of the patterns (audit chain, policy decision layer, MCP server design).
- Substantial domain knowledge captured in the v6 spec + 42 partner guides.
- A portfolio-grade demonstration of senior engineering (the dogfooding frame).

The downside is bounded; the upside is significant.

## The validating moment

<figure>

<svg viewBox="0 0 1200 700" xmlns="http://www.w3.org/2000/svg" font-family="IBM Plex Sans, system-ui">
    <defs>
      <pattern id="todoStripe" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
        <rect width="6" height="6" fill="#ecebe6"/>
        <line x1="0" y1="0" x2="0" y2="6" stroke="#d8d4c9" stroke-width="2"/>
      </pattern>
      <pattern id="activeStripe" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
        <rect width="6" height="6" fill="#fbeed8"/>
        <line x1="0" y1="0" x2="0" y2="6" stroke="#f0c87f" stroke-width="2"/>
      </pattern>
    </defs>

    <text x="40" y="28" font-family="IBM Plex Mono" font-size="10.5" letter-spacing="1.4" fill="#9a9690">12 MILESTONES · CRITICAL PATH M0 → M6a</text>

    <!-- timeline header -->
    <g transform="translate(290,52)" font-family="IBM Plex Mono" font-size="10.5" fill="#9a9690">
      <line x1="0" y1="0" x2="860" y2="0" stroke="#e3e0d8"/>
      <text x="0" y="-6">T0</text>
      <text x="200" y="-6">→</text>
      <text x="430" y="-6">v0.1 ship</text>
      <text x="640" y="-6">v0.2</text>
      <text x="860" y="-6" text-anchor="end">v1.0</text>
    </g>

    <!-- y axis labels & rows -->
    <g font-family="IBM Plex Sans" font-size="12" fill="#1a1a1c">

      <!-- M0 done -->
      <g transform="translate(40,80)">
        <text x="0" y="14" font-weight="500">M0</text>
        <text x="36" y="14">scaffold</text>
        <text x="220" y="14" font-family="IBM Plex Mono" font-size="10" fill="#1f6e54">done</text>
        <rect x="250" y="2" width="60" height="20" rx="2" fill="#1f6e54"/>
        <text x="280" y="16" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" fill="#fff">M0</text>
      </g>

      <!-- M1 done · crit -->
      <g transform="translate(40,108)">
        <text x="0" y="14" font-weight="500">M1</text>
        <text x="36" y="14">domain + storage</text>
        <text x="220" y="14" font-family="IBM Plex Mono" font-size="10" fill="#1f6e54">done</text>
        <rect x="310" y="2" width="100" height="20" rx="2" fill="#1f6e54"/>
        <rect x="310" y="2" width="100" height="20" rx="2" fill="none" stroke="#6e1a82" stroke-width="2" stroke-dasharray="2 2"/>
      </g>

      <!-- M2 active · crit -->
      <g transform="translate(40,136)">
        <text x="0" y="14" font-weight="500">M2</text>
        <text x="36" y="14">Atlassian providers + capabilities</text>
        <text x="220" y="14" font-family="IBM Plex Mono" font-size="10" fill="#b96b16">in-progress</text>
        <rect x="410" y="2" width="120" height="20" rx="2" fill="url(#activeStripe)" stroke="#b96b16"/>
        <rect x="410" y="2" width="120" height="20" rx="2" fill="none" stroke="#6e1a82" stroke-width="2" stroke-dasharray="2 2"/>
      </g>

      <!-- M3 active · crit -->
      <g transform="translate(40,164)">
        <text x="0" y="14" font-weight="500">M3</text>
        <text x="36" y="14">VCS provider (Bitbucket)</text>
        <text x="220" y="14" font-family="IBM Plex Mono" font-size="10" fill="#b96b16">in-progress</text>
        <rect x="430" y="2" width="100" height="20" rx="2" fill="url(#activeStripe)" stroke="#b96b16"/>
        <rect x="430" y="2" width="100" height="20" rx="2" fill="none" stroke="#6e1a82" stroke-width="2" stroke-dasharray="2 2"/>
      </g>

      <!-- M4 todo · crit -->
      <g transform="translate(40,192)">
        <text x="0" y="14" font-weight="500">M4</text>
        <text x="36" y="14">blueprint workflow + sampling</text>
        <text x="220" y="14" font-family="IBM Plex Mono" font-size="10" fill="#9a9690">todo</text>
        <rect x="540" y="2" width="100" height="20" rx="2" fill="url(#todoStripe)" stroke="#c8c3b6"/>
        <rect x="540" y="2" width="100" height="20" rx="2" fill="none" stroke="#6e1a82" stroke-width="2" stroke-dasharray="2 2"/>
      </g>

      <!-- M5 todo · crit -->
      <g transform="translate(40,220)">
        <text x="0" y="14" font-weight="500">M5</text>
        <text x="36" y="14">provisioning planner</text>
        <text x="220" y="14" font-family="IBM Plex Mono" font-size="10" fill="#9a9690">todo</text>
        <rect x="640" y="2" width="80" height="20" rx="2" fill="url(#todoStripe)" stroke="#c8c3b6"/>
        <rect x="640" y="2" width="80" height="20" rx="2" fill="none" stroke="#6e1a82" stroke-width="2" stroke-dasharray="2 2"/>
      </g>

      <!-- M6a — first ship · highlight -->
      <g transform="translate(40,256)">
        <text x="0" y="14" font-weight="600" fill="#6e1a82">M6a</text>
        <text x="36" y="14" font-weight="600">Jira executor — FIRST SHIPPABLE SLICE</text>
        <text x="220" y="14" font-family="IBM Plex Mono" font-size="10" fill="#9a9690">todo</text>
        <rect x="720" y="-2" width="90" height="28" rx="2" fill="#ece1f3" stroke="#6e1a82" stroke-width="2"/>
        <text x="765" y="16" text-anchor="middle" font-family="IBM Plex Mono" font-size="10.5" font-weight="600" fill="#3e0d4d">v0.1</text>
        <!-- ship marker -->
        <line x1="810" y1="-8" x2="810" y2="32" stroke="#6e1a82" stroke-width="1.5" stroke-dasharray="3 3"/>
        <text x="816" y="-2" font-family="IBM Plex Mono" font-size="10" fill="#6e1a82">▶ ship</text>
      </g>

      <!-- M6b -->
      <g transform="translate(40,294)">
        <text x="0" y="14" font-weight="500">M6b</text>
        <text x="36" y="14">Confluence executor</text>
        <text x="220" y="14" font-family="IBM Plex Mono" font-size="10" fill="#9a9690">todo</text>
        <rect x="810" y="2" width="80" height="20" rx="2" fill="url(#todoStripe)" stroke="#c8c3b6"/>
      </g>

      <!-- M6c -->
      <g transform="translate(40,322)">
        <text x="0" y="14" font-weight="500">M6c</text>
        <text x="36" y="14">VCS executor</text>
        <text x="220" y="14" font-family="IBM Plex Mono" font-size="10" fill="#9a9690">todo</text>
        <rect x="810" y="2" width="80" height="20" rx="2" fill="url(#todoStripe)" stroke="#c8c3b6"/>
      </g>

      <!-- M7 -->
      <g transform="translate(40,358)">
        <text x="0" y="14" font-weight="500">M7</text>
        <text x="36" y="14">context resources + packs</text>
        <text x="220" y="14" font-family="IBM Plex Mono" font-size="10" fill="#9a9690">todo</text>
        <rect x="890" y="2" width="60" height="20" rx="2" fill="url(#todoStripe)" stroke="#c8c3b6"/>
        <line x1="950" y1="-8" x2="950" y2="32" stroke="#1f5f8a" stroke-width="1" stroke-dasharray="3 3"/>
        <text x="956" y="-2" font-family="IBM Plex Mono" font-size="10" fill="#1f5f8a">v0.2</text>
      </g>

      <!-- M8 -->
      <g transform="translate(40,386)">
        <text x="0" y="14" font-weight="500">M8</text>
        <text x="36" y="14">readiness validation</text>
        <text x="220" y="14" font-family="IBM Plex Mono" font-size="10" fill="#9a9690">todo</text>
        <rect x="950" y="2" width="60" height="20" rx="2" fill="url(#todoStripe)" stroke="#c8c3b6"/>
      </g>

      <!-- M9 -->
      <g transform="translate(40,414)">
        <text x="0" y="14" font-weight="500">M9</text>
        <text x="36" y="14">agent handoff</text>
        <text x="220" y="14" font-family="IBM Plex Mono" font-size="10" fill="#9a9690">todo</text>
        <rect x="1010" y="2" width="50" height="20" rx="2" fill="url(#todoStripe)" stroke="#c8c3b6"/>
      </g>

      <!-- M10 -->
      <g transform="translate(40,442)">
        <text x="0" y="14" font-weight="500">M10</text>
        <text x="36" y="14">webhook ingestion</text>
        <text x="220" y="14" font-family="IBM Plex Mono" font-size="10" fill="#9a9690">todo</text>
        <rect x="900" y="2" width="120" height="20" rx="2" fill="url(#todoStripe)" stroke="#c8c3b6"/>
      </g>

      <!-- M11 -->
      <g transform="translate(40,470)">
        <text x="0" y="14" font-weight="500">M11</text>
        <text x="36" y="14">notifications · evals · hardening</text>
        <text x="220" y="14" font-family="IBM Plex Mono" font-size="10" fill="#b96b16">partial</text>
        <rect x="350" y="2" width="800" height="20" rx="2" fill="url(#activeStripe)" stroke="#b96b16" stroke-dasharray="3 3"/>
        <text x="750" y="16" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" fill="#7a4408">cross-cutting · runs in parallel with M6 family</text>
      </g>

    </g>

    <!-- column dividers (months) -->
    <g stroke="#f0ede5" stroke-width="1">
      <line x1="290" y1="74" x2="290" y2="490"/>
      <line x1="430" y1="74" x2="430" y2="490"/>
      <line x1="570" y1="74" x2="570" y2="490"/>
      <line x1="720" y1="74" x2="720" y2="490"/>
      <line x1="860" y1="74" x2="860" y2="490"/>
      <line x1="1000" y1="74" x2="1000" y2="490"/>
      <line x1="1150" y1="74" x2="1150" y2="490"/>
    </g>

    <!-- Critical path spine (graph LR projection) -->
    <g transform="translate(40,540)">
      <text font-family="IBM Plex Mono" font-size="10.5" letter-spacing="1.4" fill="#9a9690">CRITICAL PATH TO v0.1</text>
      <g transform="translate(0,18)">
        <!-- spine nodes -->
        <g font-family="IBM Plex Mono" font-size="11">
          <rect x="0" y="0" width="64" height="34" rx="2" fill="#1f6e54"/><text x="32" y="22" text-anchor="middle" fill="#fff">M0</text>
          <rect x="84" y="0" width="64" height="34" rx="2" fill="#1f6e54"/><text x="116" y="22" text-anchor="middle" fill="#fff">M1</text>
          <rect x="168" y="0" width="80" height="34" rx="2" fill="url(#activeStripe)" stroke="#b96b16"/><text x="208" y="22" text-anchor="middle" fill="#7a4408">M2</text>
          <rect x="268" y="0" width="80" height="34" rx="2" fill="url(#activeStripe)" stroke="#b96b16"/><text x="308" y="22" text-anchor="middle" fill="#7a4408">M3</text>
          <rect x="368" y="0" width="80" height="34" rx="2" fill="url(#todoStripe)" stroke="#c8c3b6"/><text x="408" y="22" text-anchor="middle" fill="#43434a">M4</text>
          <rect x="468" y="0" width="80" height="34" rx="2" fill="url(#todoStripe)" stroke="#c8c3b6"/><text x="508" y="22" text-anchor="middle" fill="#43434a">M5</text>
          <rect x="568" y="0" width="100" height="34" rx="2" fill="#ece1f3" stroke="#6e1a82" stroke-width="2"/><text x="618" y="22" text-anchor="middle" fill="#3e0d4d" font-weight="600">M6a · v0.1</text>
        </g>
        <!-- arrows -->
        <g stroke="#43434a" fill="none" stroke-width="1">
          <line x1="64" y1="17" x2="84" y2="17"/>
          <line x1="148" y1="17" x2="168" y2="17"/>
          <line x1="248" y1="17" x2="268" y2="17"/>
          <line x1="348" y1="17" x2="368" y2="17"/>
          <line x1="448" y1="17" x2="468" y2="17"/>
          <line x1="548" y1="17" x2="568" y2="17"/>
        </g>
        <!-- M2+M3 fan-in -->
        <text x="218" y="58" font-family="IBM Plex Mono" font-size="10" fill="#6f6e6a" text-anchor="middle">M2 + M3 fan-in at M4</text>
      </g>
    </g>

    <!-- legend -->
    <g transform="translate(720,540)" font-family="IBM Plex Mono" font-size="10.5" fill="#43434a">
      <text font-family="IBM Plex Mono" font-size="10.5" letter-spacing="1.4" fill="#9a9690">LEGEND</text>
      <rect x="0" y="14" width="14" height="14" fill="#1f6e54"/><text x="22" y="25">done</text>
      <rect x="80" y="14" width="14" height="14" fill="url(#activeStripe)" stroke="#b96b16"/><text x="102" y="25">in-progress</text>
      <rect x="190" y="14" width="14" height="14" fill="url(#todoStripe)" stroke="#c8c3b6"/><text x="212" y="25">todo</text>
      <rect x="0" y="38" width="14" height="14" fill="none" stroke="#6e1a82" stroke-width="2" stroke-dasharray="2 2"/><text x="22" y="49">critical path</text>
      <rect x="120" y="38" width="14" height="14" fill="#ece1f3" stroke="#6e1a82" stroke-width="2"/><text x="142" y="49">first shippable slice</text>
    </g>
  </svg>

<figcaption><strong>V4 — Milestone Gantt — M0 → M11.</strong> atl-mcp's M0 → M11 milestone sequence with the critical path to v0.1 (the first shippable slice at M6a) highlighted. M2 + M3 fan in at M4 (blueprint workflow); M4 → M5 (planner) → M6a (Jira executor) is the bottleneck. M11 (observability + hardening) cross-cuts and runs partially in parallel with the M6 family. (See <a href="../../visualizations/v04-milestone-gantt.html">full visualization page</a>.)</figcaption>
</figure>


**v1 ships when M6a is operational.**

M6a (Jira provisioning executor) is the first shippable slice because:

- It produces real, customer-visible output (Jira issues exist).
- It exercises the full pipeline (intake → blueprint → plan → execute).
- It validates the audit chain in production-shaped scenarios.
- It validates the policy decision layer.
- Subsequent milestones (M6b/c, M7+) extend; M6a is the spine.

If atl-mcp ships M6a and produces useful Jira projects: the bet is paying off. Continue investment.

If M6a ships but the output requires heavy operator editing: the bet needs revisiting. Adjust scope or strategy.

## Success criteria (v1)

The 6 success criteria from the charter ([`README.md`](README.md)):

1. End-to-end provisioning in < 10 minutes.
2. Idempotent re-runs.
3. Verifiable audit log.
4. Build agent successfully implements a story end-to-end against the provisioned scaffolding.
5. Preflight catches 80%+ of misconfigurations pre-write.
6. System passes its own readiness rubric at "Ready" tier.

These gate v1.0.0. Each is testable; each has a corresponding measurement plan.

## What we're NOT betting on

Equally important to name:

- **NOT betting that this becomes SaaS.** v1 is single-tenant on-prem. SaaS is post-v1, with separate strategic decision.
- **NOT betting that LLMs replace human judgment.** atl-mcp's outputs go through human review. The orchestrator generates scaffolding; humans approve.
- **NOT betting that build agents replace humans.** The orchestrator's output is consumed by build agents AND by humans. Both can use the same workspace.
- **NOT betting on a specific build-agent vendor.** Build-agent-agnostic is a deliberate design choice; market dynamics aren't in our control.

## Strategic decision history

### v5 → v6

The v5 plan was earlier; v6 reflects the synthesis of 42 partner integration guides. v6 §0 documents what changed:

- Strategic shift: orchestration MCP, not API wrapper.
- Adoption of audit chain pattern (ADR-0005) from agentdiff.
- Adoption of MADR + adr.github.io for ADR governance.
- Adoption of test-first iron law from superpowers.
- Adoption of postmortem framework from vibe-tuning.

The v6 spec is the canonical strategy artifact. This doc summarizes; the spec is authoritative.

### Single-tenant for v1

Considered: multi-tenant from day one. Rejected because:

- Multi-tenant complexity exceeds v1's capacity to ship.
- Single-tenant validates the core value proposition first.
- Multi-tenant runway is documented (v6 §7.3); future migration is feasible.

### Atlassian + Bitbucket only

Considered: GitHub from v1. Rejected because:

- Bounded scope ships sooner.
- Atlassian + Bitbucket integration is deeper (more features per provider).
- Adding GitHub is a distinct workstream; doing it later is fine.

This was a real tradeoff — many engineering teams use GitHub. v1 deferred them deliberately; the partner-integration approach is "build deep first, breadth second."

## Strategic risks

### Build-agent ecosystem shifts

If MCP loses traction or a competing protocol displaces it: atl-mcp's value proposition narrows. Mitigation: the underlying orchestration logic can be exposed via REST too if needed; MCP is the surface, not the substance.

### LLM cost trajectory

LLM costs per call are decreasing rapidly. Eval-view (multi-provider judges) is cost-significant; if costs spike again, the eval-view pattern becomes harder to justify. Mitigation: eval-view is configurable (skip-able for low-stakes operations).

### Atlassian platform changes

Atlassian's API or pricing could change in ways that impact atl-mcp. Mitigation: the provider abstraction (`src/providers/atlassian/`) is replaceable; if Atlassian becomes hostile, the provider can adapt or be replaced.

### Build-agent failure modes

If build agents (Claude Code, Cursor, etc.) produce systematically bad output, atl-mcp's downstream consumers fail. Mitigation: atl-mcp doesn't control build-agent quality; it ensures its OWN output is good. The audit chain captures everything for forensic review.

## Linked artifacts

- **Charter parent:** [`README.md`](README.md)
- **Non-goals:** [`non-goals.md`](non-goals.md)
- **Spec:** v6 §1 (Mission), §2 (Strategic design), §0 (v6 review summary)
- **Multi-tenant runway:** v6 §7.3
- **Build sequence:** [`../../build-orchestration.md`](../../build-orchestration.md)
- **ADRs:** [`../../adr/`](../../adr/)
- **Decision log:** [`../12-governance/decision-log.md`](../12-governance/decision-log.md)

---

*Last reviewed: 2026-04-25 by Chris.*
