# Feature Flow — Full Feature Lifecycle

> **Guardrails-enhanced variant:** For automatic enforcement of all gates in this workflow,
> use `workflows/guardrails-enforced-flow.md` instead. The guardrails variant runs the same
> steps but prevents violations automatically via Claude Code hooks. If guardrails hooks are
> installed, this workflow is upgraded to the enforced variant automatically.

**Workflow type:** Full SDLC
**Complexity target:** Non-trivial features (new behavior, API surface changes, multi-file changes)
**Quick flow entry point:** If the change is a single-file fix with no new behavior, use `bugfix-flow.md` or `refactor-flow.md` instead. If still uncertain, complete Step 0 and let the confidence check decide.

---

## Trigger Conditions

Use this workflow when any of the following are true:

- The task introduces new user-visible behavior or a new API endpoint
- The task modifies more than two files
- The task requires changes to shared types, database schemas, or environment configuration
- The task has been stated as a "feature" or "epic" in the work tracker
- The task has unclear acceptance criteria and requires a spec step

Do NOT use this workflow for:

- Fixing a specific known bug (use `bugfix-flow.md`)
- Renaming or restructuring code with no behavior change (use `refactor-flow.md`)
- A trivial single-line correction (do it directly)

---

## Prerequisites

Before starting, verify the following are available:

- [ ] A task description or ticket with at least one stated goal
- [ ] Build passing on current branch (`pnpm build` exits 0, or equivalent)
- [ ] Test suite passing on current branch
- [ ] `.ai/` directory exists, or you have permission to create it

---

## Step 0 — Pre-Execution Confidence Gate

**Source:** SuperClaude confidence-check pattern (100-200 token cost, prevents 5,000-50,000 token waste)

Before any planning or implementation, score your confidence across five dimensions:

| Dimension | Weight | Scoring Criteria |
|---|---|---|
| No duplicates | 25% | Have you verified this functionality does not already exist in the codebase? |
| Architecture compliance | 25% | Does the approach fit the existing architecture without requiring structural changes? |
| Docs verified | 20% | Have you confirmed the external APIs or frameworks behave as you expect? |
| OSS reference exists | 15% | Is there a reference implementation or prior art to guide this? |
| Root cause identified | 15% | Do you understand exactly what needs to change and why? |

**Decision thresholds:**

- Score **≥ 0.90**: Proceed directly to Step 1.
- Score **0.70–0.89**: Present two or three alternative approaches with tradeoffs. Ask which to proceed with. Do not begin planning until the human selects an approach.
- Score **< 0.70**: Stop. Ask the clarifying questions needed to reach ≥ 0.70. List each unknown explicitly. Do not proceed until the unknowns are resolved.

Record the score and decision in `.ai/active-context.md` before continuing.

If the project has access to the framework scripts, validate the artifact mechanically:

```bash
bash "$FRAMEWORK_DIR/scripts/confidence-check.sh" --artifact .ai/confidence-check.json --minimum-score 0.70
```

---

## Step 1 — Spec Generation

**Source:** Tweag spec-first + BMAD step-file architecture

Run the `/plan` command with the task description. This produces `.ai/implementation-plan.md` with:

- Requirements as independently-verifiable statements
- Research inputs classified as background, decision-pending, or actionable
- Affected files with modify/create/read-only/forbidden classification
- Implementation steps with TDD gates marked
- Explicit test strategy (`test-first`, `test-alongside`, or `deferred-exploratory`)
- Shared resource flags (package.json, tsconfig, shared types, DB schemas)

The `/plan` command ends with an approval gate. **Do not proceed to Step 2 until the human approves the plan.**

If the plan touches shared files, CI/CD, authentication, schemas, or more than five files, initialize the approval artifact immediately after plan creation:

```bash
bash "$FRAMEWORK_DIR/scripts/approval-gate.sh" --artifact .ai/approval-state.json --plan .ai/implementation-plan.md --init-request
```

If the feature is large enough to require multiple sessions or multiple agents, also produce `.ai/tdd-plan.md` using the checkbox format described in Step 3.

**Completion criteria for Step 1:**
- [ ] `.ai/implementation-plan.md` written
- [ ] Research inputs either routed into the plan or explicitly marked "None"
- [ ] Shared resource flags documented or marked "None"
- [ ] Test strategy chosen and justified
- [ ] Human approval received (explicit message or `/implement` command invoked)

**Failure handling:** If requirements are ambiguous and clarification is not forthcoming within one exchange, document the ambiguity as an assumption in the plan and mark that assumption with a `[ASSUMPTION — verify before merge]` tag.

---

## Step 2 — Environment Check

Before writing any code, run the build and test suite to establish a clean baseline:

```
pnpm typecheck && pnpm test
```

If either command fails, stop and report the failure. Do not proceed with implementation on a broken baseline. Either fix the pre-existing failure first (create a separate task for it) or confirm with the human that the failure is known and accepted.

Record the baseline result in `.ai/active-context.md`:

```
Baseline check [date]: typecheck PASS / test N passing, N failing
Pre-existing failures: [list or "none"]
```

---

## Step 3 — TDD Plan Construction

**Source:** Tweag tdd-plan.md pattern + AlphaCodium test-first implementation

From the approved implementation plan, generate `.ai/tdd-plan.md` when the chosen test strategy is `test-first` or `test-alongside`. Every implementation step that produces a behavior change must have a test entry before the implementation entry unless the plan explicitly chose `deferred-exploratory`.

Format:

```markdown
# TDD Plan

**Feature:** [feature name]
**Plan source:** .ai/implementation-plan.md
**Created:** [date]

## Test Sequence

- [ ] TEST: [test file path] — `it('[exact test description]')` — verifies [requirement N]
- [ ] IMPL: [implementation step] — files: [list]
- [ ] VERIFY: run `pnpm test [test file]` — must pass, all prior tests must still pass

- [ ] TEST: [test file path] — `it('[exact test description]')` — verifies [requirement N]
- [ ] IMPL: [implementation step] — files: [list]
- [ ] VERIFY: run `pnpm test [test file]` — must pass, all prior tests must still pass

[...continue for all requirements...]

- [ ] FINAL: run `pnpm build && pnpm typecheck && pnpm test` — zero regressions
```

If the plan uses `deferred-exploratory`, replace the full TDD sequence with:
- a named smoke verification step that proves the exploratory change is at least executable
- a hardening follow-up entry that must land before merge readiness
- a clear note in `.ai/active-context.md` that merge is blocked on test hardening

The test name IS the implementation prompt. Write test descriptions as precise, unambiguous behavioral statements:

```
// GOOD — test name is a specification
it('should reject emails missing the @ symbol with a 400 status code')

// BAD — test name is vague
it('should validate email')
```

**Test anchor rule (from AlphaCodium):** The set of passing tests must grow monotonically. No implementation step may be accepted if it causes a previously-passing test to fail. Any regression = revert the implementation step and re-attempt.

---

## Step 4 — Implementation Loop

Execute each entry in `tdd-plan.md` in sequence. For each TEST → IMPL → VERIFY triple:

### 4a. Write the failing test

Write the test file entry. Run it to confirm it fails for the right reason (it fails because the implementation does not exist yet, not because the test itself has a syntax error or imports a missing module).

```
pnpm test [test-file] -- --reporter=verbose
```

The test must fail with a meaningful error message, not a crash. If it crashes, fix the test before proceeding.

### 4b. Implement the minimum code to pass

Write the minimum implementation required to make this test pass. Do not implement functionality not covered by the current test. Do not implement the next test's requirement early.

**Modular code mandate (from AlphaCodium):** Target functions ≤ 10 lines (hard max ≤50 per CLAUDE.md Section 3). Use meaningful names. Sub-functions are preferred over long inline logic. This constraint directly increases the success rate of iterative fixes.

### 4c. Verify — test anchor check

Run the full test file plus all previously-written tests:

```
pnpm test
```

**If this test now passes AND no prior tests regressed:** Check the VERIFY entry in tdd-plan.md and proceed to the next TEST entry.

**If this test fails:** Enter the iterative refinement loop (Step 4d).

**If any prior test now fails (regression):** Revert the implementation step entirely. Do not attempt to fix both the new test and the regression simultaneously. Revert, analyze why the regression occurred, adjust the implementation approach, and re-attempt 4b.

### 4d. Iterative Refinement Loop (AlphaCodium two-stage fix)

**Maximum 3 attempts per failing test.** If the test still fails after 3 attempts, halt and ask the human for guidance before continuing.

**Attempt structure:**

1. **Analysis stage (separate from fix):** Write a structured diagnosis before generating any code. Answer:
   - What output did the test produce?
   - What output did the test expect?
   - What is the specific line or logic path that produced the wrong output?
   - What is the minimal change that would produce the correct output?

2. **Fix stage:** Generate the corrected implementation based only on the analysis above. Do not combine analysis and code generation.

3. **Verify:** Run `pnpm test`. Check test anchor.

If all 3 attempts fail, document the blocking issue in `.ai/active-context.md` and ask for human input. Do not guess or try increasingly speculative fixes.

---

## Step 5 — Post-Implementation Verification

**Source:** SuperClaude Four Questions + BMAD adversarial review (≥5 issues)

### 5a. Four Questions (evidence-gated)

Answer each question with actual evidence, not assertions:

**Q1: Are tests passing?**
Paste the actual test output — the line count, the pass/fail summary, specific test names. The claim "tests pass" without output is insufficient.

**Q2: Are requirements met?**
For each requirement in `.ai/implementation-plan.md`, state which test or observable behavior proves it is met. Unverified requirements are blockers.

**Q3: Are assumptions verified?**
List each assumption tagged `[ASSUMPTION — verify before merge]` in the plan. For each: state whether the assumption proved true, and how you confirmed it.

**Q4: Is evidence provided?**
This is the meta-question. If the answer to Q1, Q2, or Q3 was stated without evidence, flag it now. Evidence means: actual output, file diffs, test names, or observable system behavior.

### 5b. Adversarial Self-Review

Adopt an adversarial internal posture. You are a cynical reviewer who has seen every class of AI code failure. Find at least 5 issues. Categories to check:

1. **Stub detection:** Are there any functions that return early with placeholder values, `TODO` comments, or `throw new Error('not implemented')`?
2. **Type safety:** Are there any `any` types, unchecked type assertions (`as Foo`), or missing null checks that could fail at runtime?
3. **Test theater:** Do any tests pass trivially (empty assertion bodies, always-true conditions, mocked results that mirror the expectation)?
4. **Missing error paths:** Does the implementation handle all documented error cases from the requirements?
5. **Shared resource violations:** Did any implementation step touch a forbidden file listed in the plan?
6. **Scope creep:** Were any changes made that are outside the plan's scope? If so, are they justified and documented?
7. **Regression risk:** Are there any code paths changed by this implementation that are not covered by any test?

**If you find fewer than 5 issues:** Halt. This is suspicious. Re-examine each category above. Either raise your finding count or explicitly note why each category has zero findings with evidence.

Document all findings. For each finding, state: severity (blocker vs. advisory), the specific location, and the fix applied or deferred.

---

## Step 6 — Final Build Gate

Run the complete quality gate in this exact sequence:

```bash
pnpm typecheck          # must exit 0
pnpm lint               # must exit 0 (--max-warnings=0 if configured)
pnpm test               # must exit 0 with zero regressions
pnpm build              # must exit 0
```

If any command fails, fix it before proceeding. Do not commit with a failing gate.

---

## Step 7 — Session Close

Update `.ai/` state:

1. **`.ai/implementation-plan.md`:** Change status from `IN PROGRESS` to `COMPLETE`. Check off all completed implementation steps.
2. **`.ai/tdd-plan.md`:** All checkboxes must be checked.
3. **`.ai/session-log.md`:** Append an entry:

```markdown
## Session [date]

**Agent:** [agent or user identifier]
**Task:** [feature name]
**Status:** COMPLETE

**Accomplished:**
- [what was implemented]
- [test coverage added]

**Decisions made:**
- [any architectural or design decisions made during implementation]

**Not accomplished:**
- [any deferred items]

**Next session needs:**
- [any follow-on work identified]
```

4. **`.ai/active-context.md`:** Clear the working notes for this feature. Replace with a summary of the current system state.

---

## Failure Handling and Rollback

**If confidence check fails (Step 0):** Stop. Do not proceed. Document the unknowns. Ask for input.

**If approval is not received after plan generation (Step 1):** Stop. The plan remains in `.ai/implementation-plan.md` with status `AWAITING APPROVAL`. Do not write code.

**If baseline check fails (Step 2):** Stop. Create a separate task for the pre-existing failure or confirm with the human.

**If a test regression occurs during implementation (Step 4c):** Revert the failing implementation step using `git checkout -- [files]`. Revert does not require reverting previously-completed tests — only the implementation step that caused the regression.

**If the iterative refinement loop exceeds 3 attempts (Step 4d):** Stop. Paste the last three analysis stages and test outputs into `.ai/active-context.md`. Ask for human input.

**If adversarial review finds a blocker (Step 5b):** Fix all blocker-severity findings before proceeding. Advisory findings may be filed as follow-on tasks.

**If the final build gate fails (Step 6):** Fix and re-run. Do not skip any gate step.

---

## Quality Gates Summary

| Gate | Step | Condition | Action if failed |
|---|---|---|---|
| Confidence ≥ 0.70 | 0 | Score below threshold | Stop, ask questions |
| Plan approved | 1 | No human approval | Stop, wait |
| Baseline clean | 2 | Build or tests fail | Stop, fix or document |
| Test writes before implementation | 3 | Test-first order | Reorder before continuing |
| Test anchor (no regression) | 4c | Any prior test fails | Revert, re-attempt |
| Max 3 fix attempts | 4d | 4th attempt needed | Stop, ask human |
| Four Questions answered with evidence | 5a | Missing evidence | Do not proceed to 5b |
| Adversarial review ≥ 5 findings | 5b | Fewer than 5 | Re-examine, halt if < 5 |
| Full build gate passes | 6 | Any command fails | Fix before commit |

---

## Phase 8 Transition (Engine Engagements)

If this work is part of a client engagement (Phase 7 delivery), transition to Phase 8 verification after the final commit:

1. Run `scripts/pre-review-report.sh` for a diff-scoped quality check
2. Run `quality/guardrails/scanner.sh` on all modified files
3. Run `bash scripts/phase-transition-check.sh --from 7 --to 8` to verify checkpoint criteria
4. Update `.ai/active-context.md` with delivery completion status
5. Invoke `/verify [project]` to begin Phase 8

If this is internal/personal work, this step is optional but recommended for quality discipline.
