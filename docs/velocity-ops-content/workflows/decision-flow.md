# Decision Flow — Structured Reasoning for High-Stakes Choices

**Workflow type:** Decision analysis
**Complexity target:** Architecture decisions, scope choices, risk assessments, build-vs-buy, deployment strategy
**Prerequisite:** The thinking-partner skill installed (`npx skills add mattnowdev/thinking-partner`)

---

## Trigger Conditions

Use this workflow when:

- An ADR (Architecture Decision Record) needs to be written
- The confidence gate scores 70-89% (alternatives need analysis)
- A scope decision affects multiple features or long-term maintenance
- A security or data migration risk needs assessment
- The brainstorming skill produced 2-3 approaches and the tradeoffs aren't clear
- Anyone says "help me think through this" about a technical decision

Do NOT use for:
- Trivial implementation choices (use existing patterns)
- Bug fixes with clear root cause
- Style decisions already covered by linting

---

## Step 1 — Frame the Decision

State explicitly:
- **What is being decided?** (one sentence)
- **What's at stake?** (time, money, technical debt, user impact, reversibility)
- **What constraints exist?** (timeline, team size, existing commitments, dependencies)
- **What's the time horizon?** (this sprint, this quarter, 3 years)

Write this framing to `.ai/decisions.md` before proceeding.

---

## Step 2 — Detect Orientation

Before analyzing options, check: is the decision-maker (human or AI) already captured?

| Signal | State | Response |
|--------|-------|----------|
| "I've already decided, just need validation" | GT1 (conclusion-preserving) | "What would have to be true for the other option to be better?" |
| Rushing to decide without analysis | GT3 (threat-reducing) | "No pressure to decide now. Let's hold both options open." |
| Quick confident answer without proportionate analysis | GT4 (completion-seeking) | "Before we settle, let me push on this from one angle." |
| Elaborate analysis that always confirms the same thing | GT5 (monitor co-option) | "What prediction does this view make that we could verify?" |

If captured, address the orientation before analyzing the decision.

---

## Step 3 — Select and Apply Models

Choose 2-3 models based on the decision type. Apply each one:

1. **Name the model** (one sentence)
2. **Ask the key question** — the diagnostic question the model raises
3. **Listen** — let the answer land before pushing
4. **Push where it matters** — challenge weak reasoning, surface hidden assumptions
5. **Synthesize** — what did this model reveal?

See `modules/thinking-partner.md` for model selection by decision type.

---

## Step 4 — Stress-Test

After initial analysis, actively challenge the emerging conclusion:

- **Inversion**: "What if the opposite were true?"
- **Pre-mortem**: "It's a year later and this failed. What went wrong?"
- **Blind spot**: "What perspective are we not considering?"
- **Confidence calibration**: "1-10, how confident? What would move the number?"
- **Skin in the game**: "Would you bet your own money on this?"

---

## Step 5 — Record the Decision

Write to `.ai/decisions.md`:

```markdown
## Decision: [title]
**Date:** [date]
**Context:** [what prompted this decision]
**Options considered:**
1. [option A] — [tradeoffs]
2. [option B] — [tradeoffs]
**Decision:** [chosen option]
**Rationale:** [why, including which mental models were applied]
**Models applied:** [list]
**Assumptions to monitor:** [what beliefs this depends on — revisit if these change]
**Reversibility:** [one-way door / two-way door]
```

---

## Step 6 — Connect to Implementation

- If this decision results in code work → invoke `/plan` with the decision as context
- If this decision affects existing specs → update the relevant spec files
- If this decision introduces risk → document in the spec's ASVS checklist
- The decision record in `.ai/decisions.md` serves as the ADR

---

## Quality Gates

| Gate | Condition | Action if failed |
|------|-----------|-----------------|
| Framing complete | Decision, stakes, constraints, horizon documented | Do not analyze without framing |
| Orientation checked | GT1-GT5 detection attempted | Address capture before analysis |
| ≥2 models applied | At least 2 mental models used | Select and apply more models |
| Stress-tested | At least 1 challenge probe applied | Run inversion or pre-mortem |
| Decision recorded | Written to `.ai/decisions.md` | Do not implement without record |
