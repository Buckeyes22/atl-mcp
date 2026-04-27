# Phase 2: Discovery

**Purpose:** Understand the business problem, not just the requested task. Discovery should usually be paid for substantial work.

## Engagement Shapes Using This Phase
All shapes except fixed-price automated reviews (which skip directly to Phase 7). Paid discovery is a standalone product for complex engagements (Brennan Dunn model: $200-$5,000).

## Required Inputs
- Qualified lead from Phase 1
- Signed discovery agreement (for paid discovery) or verbal go-ahead (for lightweight screening)

## Required Outputs
- Completed discovery brief
- Current-state summary with risks, constraints, opportunities
- Business-intent statements (vague goals → testable statements)
- Requirements baseline
- Recommendation: proceed and in what shape, or decline
- AI use-case screen (when AI is part of the request)
- Domain research notes (stored for knowledge reuse — see 4H-6)

## Guardrails
- **No solution before problem** — blocks technical architecture until business-intent statements exist
- **Domain research protocol** — industry terminology, regulations, competitors, common failure modes
- **Business-intent extraction** — every vague goal becomes a testable statement
- **Thinking-partner integration** — structured analysis for complex discoveries
- **Conversation guardrails** — question substitution detection, false comprehensiveness check

## Templates
- `templates/discovery-brief.md` — structured discovery output
- `templates/client-system-inventory.md` — system/access inventory
- `templates/ai-use-case-screen.md` — AI opportunity screening
- `templates/ai-workflow-redesign-review.md` — workflow change assessment

## Phase Boundary Checkpoint
**Discovery → Scoping:** Does the discovery brief accurately capture the client's real problem? Does Chris understand enough to scope and price the work? If yes, proceed to Phase 3.

## Framework Tooling
- **Agents:** `agents/researcher.md` (domain research), `agents/thinking-partner.md` (structured reasoning)
- **Workflow:** `workflows/decision-flow.md` (for complex discovery decisions)
- **Knowledge base:** `engine/knowledge-base/by-vertical/` (reuse prior industry research)
- **Modules:** `modules/conversation-guardrails.md`, `modules/assumption-check.md`
- **Scoring:** `templates/requirements-clarity-scorecard.md` (100-point gate for Phase 2→3)

## Automation Classification
- **AUTOMATE:** Industry research aggregation, competitor scanning, system inventory form collection
- **HUMAN:** Business-intent extraction, client interviews, problem diagnosis, proceed/decline decision
- **CAUTION:** AI-drafted discovery questions (review before asking), AI-generated domain research (verify before relying on it — ref: BCG 23% decline on complex tasks)
