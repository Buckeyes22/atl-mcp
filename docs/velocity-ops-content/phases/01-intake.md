# Phase 1: Intake & Lead Qualification

**Purpose:** Quickly decide whether a lead is worth spending time on. Output is always "I'll put together a proposal" or "this isn't a fit."

## Engagement Shapes Using This Phase
All 12 engagement shapes begin here. No exceptions.

## Required Inputs
- Inbound inquiry or warm introduction
- Initial context about the prospect's problem

## Required Outputs
- Qualified/disqualified decision
- If qualified: buyer identified, problem understood, budget plausible, timing real
- Intake record with verbatim client statements vs your interpretation

## Guardrails
- **No commitment in first meeting** — output is always "I'll put together a proposal"
- **Red flag checklist** — can't articulate success, impossible timeline, undefined budget, scope mismatch
- **No free consulting** — use free assessments only to qualify fit, not produce custom findings
- **Conversation guardrails active** — assumption verification, goal alignment, context bleeding detection

## Templates
- `templates/buyer-readiness-review.md` — qualification worksheet
- `templates/engagement-now.md` — lightweight engagement state

## Phase Boundary Checkpoint
**Intake → Discovery:** Does this lead have a real problem, a real buyer, and a plausible budget? If yes, proceed to Phase 2 (paid discovery) or directly to Phase 3 (scoping) if the problem is already well-defined.

## Framework Tooling
- **Modules:** `modules/conversation-guardrails.md` (assumption verification during intake calls)
- **Modules:** `modules/assumption-check.md` (verify claims before recording them)
- **Vertical configs:** `engine/verticals/` (load industry context for the prospect's sector)
- **Credential check:** `engine/credentials.md` (verify Chris can serve this prospect's needs)

## Automation Classification
- **AUTOMATE:** Form submission processing, CRM entry creation, initial notification
- **HUMAN:** Qualification judgment, red flag assessment, "fit" decision, first conversation
- **CAUTION:** AI-drafted qualification questions (review before sending), auto-generated prospect research summaries
