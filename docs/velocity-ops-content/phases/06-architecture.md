# Phase 6: Architecture & Design

**Purpose:** Make and document technical choices before implementation begins. For BUILD engagements, this is where architecture decisions are recorded. For other delivery types, this may be a design/methodology selection phase.

## Required Inputs
- Project setup from Phase 5
- Business-intent statements from Phase 2

## Required Outputs
- Architecture Decision Records (ADRs) for significant choices
- Client-facing architecture summary (non-technical)
- Technology selection rationale
- Integration points identified
- Security considerations documented

## Guardrails
- **Thinking-partner for architecture decisions** — structured reasoning for significant choices
- **ADR required** for every significant technical choice
- **Client-facing summary** — non-technical explanation of what's being built and why

## Framework Tooling
- **Agents:** `agents/architect.md` (architecture decisions), `agents/thinking-partner.md` (structured reasoning)
- **Workflow:** `workflows/decision-flow.md` (ADR workflow for significant choices)
- **Templates:** `templates/adr-template.md` (Architecture Decision Record template)
- **Agent delivery patterns:** `engine/knowledge-base/ai-agent-delivery-patterns.md` (7 patterns for choosing delivery architecture)
- **Modules:** Stack-specific governance from `modules/` (e.g., `modules/nextjs-15.md`, `modules/astro-5.md`)

## Phase Boundary Checkpoint
**Architecture → Delivery:** Do the technical choices serve the business intent? Client-facing summary accurate? If yes, proceed to Phase 7.
