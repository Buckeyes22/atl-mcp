# TDD Flow — Test-Driven Development Cycle

**Workflow type:** Test-first implementation loop
**Complexity target:** Any single requirement or behavior unit that can be expressed as a test
**Source:** Tweag "tests-as-prompts" + AlphaCodium iterative refinement (2.3x accuracy improvement)

---

## Core Principle

A test name is a better prompt than a natural language description.

```
it('should return only emails where the domain is in the allowlist')
```

That test name is a scoped, unambiguous specification. It eliminates the "did the AI do what I meant?" ambiguity because the test is the definition of "what I meant." The TDD loop is a deterministic feedback loop: either the test passes or it does not.

This is the highest-value workflow in this framework. The 2.3x accuracy improvement documented in AlphaCodium is attributable to iterative execution feedback against real test cases — which is exactly what this workflow formalizes.

---

## Trigger Conditions

Use this workflow when:

- Implementing a requirement that can be expressed as an observable behavior
- Working through a `tdd-plan.md` produced by `feature-flow.md`
- Starting a new module, utility, or component from scratch
- A behavior is ambiguous and you want to force specification-by-example

Do NOT use this workflow for:

- Pure infrastructure changes with no logic to test (migrations, config changes)
- Visual/UI work with no deterministic behavioral assertions
- Exploratory research phases where you are not yet writing production code

---

## Prerequisites

- [ ] Test runner is installed and working (`pnpm test` exits cleanly with no errors beyond failing tests)
- [ ] The requirement to implement is stated clearly enough to write a test for it
- [ ] The test file location is known or decided
- [ ] A `tdd-plan.md` exists at `.ai/tdd-plan.md` (create one if running this workflow standalone — see Step 0)

---

## Step 0 — Create tdd-plan.md (if not already present)

If this workflow is being run standalone (not from `feature-flow.md`), create `.ai/tdd-plan.md` now.

List every requirement as a TEST entry followed by an IMPL entry. Write all the test entries before writing any implementation. This forces you to think through the full specification before touching production code.

```markdown
# TDD Plan

**Task:** [description]
**Created:** [date]
**Test file:** [path/to/test-file.test.ts]

## Test Sequence

- [ ] TEST 1: `it('should [exact behavioral statement]')` — [test file path]
- [ ] IMPL 1: [implementation file path] — [what to implement]
- [ ] VERIFY 1: pnpm test — pass + no regressions

- [ ] TEST 2: `it('should [exact behavioral statement]')` — [test file path]
- [ ] IMPL 2: [implementation file path] — [what to implement]
- [ ] VERIFY 2: pnpm test — pass + no regressions

[...continue for all requirements...]

- [ ] FINAL: pnpm build && pnpm typecheck && pnpm test — zero regressions
```

Rules for writing test entries:

1. Each test must be independently runnable. It must not depend on the output of a prior test unless you are explicitly writing integration tests with described setup.
2. The test name must be a complete behavioral statement. Subject + verb + expected outcome. "should return 400 when email is missing @" is complete. "should validate email" is not.
3. Harder cases first. Write tests for edge cases, error paths, and boundary conditions before the happy path. Edge cases discovered after the happy path tend to break the happy path implementation.
4. Tests that must always pass (regression anchors) go first in the sequence.

---

## Step 1 — Baseline Verification

Before writing any tests, verify the current test suite is clean:

```bash
pnpm test
```

Record the result. If tests are failing before you start, stop and document the pre-existing failures. Do not continue until either:

(a) The pre-existing failures are fixed (preferred), or
(b) The human confirms the pre-existing failures are known, accepted, and unrelated to the task

The baseline test result is your anchor. Every step in this workflow must maintain or improve this result — never worsen it.

---

## Step 2 — Write the Next Failing Test

Take the next unchecked TEST entry from `tdd-plan.md`.

Write the test. Requirements:

1. The test file must already exist or be created now. Import the module under test at the top. If the module does not exist yet, import it anyway — the import will fail, which is expected.

2. The test must compile (no TypeScript syntax errors). If the module does not exist yet, allow the first red state to be `module not found` or `missing export`. Do not create a stub file that throws `not implemented` just to satisfy the import.

3. Run the test to confirm it fails for the right reason:

```bash
pnpm test [test-file-path] -- --reporter=verbose
```

**Expected failure modes — acceptable:**
- Module not found or missing export, when the test path is correct and the implementation does not exist yet
- `Expected X, received undefined` — module exists but function returns undefined
- `Cannot read property of undefined` — module exists, returns wrong structure
- `Expected X, received Y` — implementation exists but logic is wrong

**Unacceptable failure modes — fix before proceeding:**
- Syntax error in test (fix the test)
- Test runner crash (investigate and fix)
- Test passes on first run (the test is not testing the behavior you think it is — rewrite it)

Once the test fails for an acceptable reason, check the TEST entry in `tdd-plan.md` and proceed to Step 3.

---

## Step 3 — Implement the Minimum Code to Pass

Write the minimum implementation required to make the current failing test pass.

**Constraints:**

1. Do not implement anything the current test does not require. If the test only checks the return value for input X, do not implement handling for input Y yet — that will be covered by a future test.

2. Do not refactor while making a test pass. First make it pass, then refactor (Step 4). Mixing implementation and refactoring in one step obscures whether the test passed because of the feature or despite the refactoring.

3. Modular code mandate: Target functions ≤ 10 lines (hard max ≤50 per CLAUDE.md Section 3). If the implementation naturally exceeds 10 lines, decompose it into named sub-functions. This constraint is not stylistic — it directly increases the success rate of iterative fixes because smaller units are easier to reason about and replace.

4. Do not write fake or stub implementations designed to pass this specific test without implementing real behavior. The adversarial self-review in the final step will catch this. Write real code.

---

## Step 4 — Run Tests and Check the Anchor

Run the full test suite:

```bash
pnpm test
```

Evaluate the result:

### Case A — Test passes, no regressions

This is the success path. Proceed to Step 5 (refactor if needed) and then Step 6 (next test).

### Case B — Test fails

Enter the iterative refinement loop (Step 4a below).

### Case C — Test passes but a prior test regressed

This is a regression. It must be resolved before proceeding.

**Regression protocol:**
1. Do not attempt to fix both the new behavior and the regression at the same time.
2. Run only the regressed test to confirm which test is failing and why.
3. Revert the implementation changes from Step 3 using `git diff` to understand what changed, then `git checkout -- [file]` to revert.
4. Re-examine the IMPL entry for Step 3. Understand what the reverted change broke and why.
5. Design an alternative implementation that satisfies the current test without breaking the regressed test.
6. Re-attempt Step 3 with the revised approach.

The regression rule is absolute: **the set of passing tests is a one-way ratchet**. It can only grow.

---

### Step 4a — Iterative Refinement (when test fails)

**Maximum 3 attempts.** If the test still fails after 3 attempts, go to Step 4b.

**Two-stage fix structure (from AlphaCodium):**

Each attempt consists of two separate stages. The stages must not be merged into one step. The analysis stage must be completed before the code stage.

**Stage 1 — Analysis:**

Write a structured diagnosis. Answer each question explicitly:

- What output did the test produce? (paste the actual failure message)
- What output did the test expect?
- What is the specific line or function in the implementation that produced the wrong result?
- What is the simplest possible change to that line or function that would produce the correct result?

Do not write any code during Stage 1. Just answer the four questions.

**Stage 2 — Fix:**

Based only on the Stage 1 analysis, write the corrected code. The fix should be the minimal change described in Stage 1, question 4. Do not refactor. Do not address other issues. Fix the one thing that the analysis identified.

Run `pnpm test` and return to Step 4 to evaluate the result.

---

### Step 4b — Escalation (after 3 failed attempts)

If the test has failed on 3 successive attempts:

1. Record all three analysis stages and their corresponding test outputs in `.ai/active-context.md`.
2. Stop the TDD loop.
3. Ask the human for input. Present the three analyses and explain what you have tried.
4. Do not make a fourth attempt until the human has reviewed the situation and either: identified the flaw in the analysis, suggested a different approach, or reduced the scope of the test.

---

## Step 5 — Refactor (if needed)

Once the test passes and no regressions exist, examine the implementation for cleanup. This step is optional but should be done when:

- The implementation duplicates code that already exists elsewhere
- The implementation has a variable or function name that is unclear
- The 10-line function limit was technically met but the function is hard to read

**Refactor rules:**
1. Run `pnpm test` after every single edit during refactoring. Do not batch multiple refactor changes before testing.
2. No behavior change. If a refactor changes behavior, it is not a refactor — it is an implementation change and requires a test first.
3. If refactoring causes a test to fail, revert the refactor step and reconsider.

---

## Step 6 — Advance the tdd-plan.md Checklist

Check off all three entries for the current cycle in `tdd-plan.md`:

```markdown
- [x] TEST N: `it('...')` — [file]
- [x] IMPL N: [file] — [what was implemented]
- [x] VERIFY N: pnpm test — PASS (N tests passing)
```

Note the current passing test count on the VERIFY line. This makes regressions immediately visible when reviewing the checklist.

If there are more unchecked TEST entries, return to Step 2 and begin the next cycle.

If all TEST entries are checked, proceed to Step 7.

---

## Step 7 — Final Verification

All tests in the sequence are passing. Run the complete quality gate:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

All four must exit 0.

If any gate fails:
- Typecheck failure: Fix the type error. It was introduced during implementation.
- Lint failure: Fix the lint issue. Do not disable lint rules to pass this gate.
- Test failure: A test regressed during refactoring (Step 5) or an earlier VERIFY was incorrectly marked. Find and fix it.
- Build failure: Fix the build error.

---

## Step 8 — Adversarial Self-Check

Before declaring the TDD cycle complete, run this self-check:

**Check 1 — Stub scan:**
Search the implementation files written during this session for: `TODO`, `FIXME`, `not implemented`, empty function bodies, functions that always return the same constant, or functions that return the exact value the test expects hardcoded rather than computed.

**Check 2 — Test quality scan:**
For each test written in this session:
- Does the test assertion actually verify behavior, or does it just verify that the mock was called?
- Would this test pass if the implementation were replaced with a function that returns the first test case's expected value hardcoded?
- Does the test cover the boundary condition stated in the test name?

**Check 3 — Coverage gap scan:**
Are there behaviors described in the requirements that are not covered by any test in `tdd-plan.md`? Common gaps: error paths, null inputs, empty collections, concurrent operations.

If any check reveals a problem, write the missing test(s) and add them to `tdd-plan.md` before marking the workflow complete.

---

## Step 9 — Close tdd-plan.md

Check the FINAL entry in `tdd-plan.md`:

```markdown
- [x] FINAL: pnpm build && pnpm typecheck && pnpm test — N tests passing, 0 failing
```

Update `.ai/session-log.md` with the session outcome.

---

## Quick Reference — Cycle Summary

```
Step 2: Write failing test → confirm it fails for the right reason
Step 3: Write minimum implementation
Step 4: pnpm test
  → Pass, no regression → Step 5 (refactor if needed) → Step 6 (advance checklist)
  → Fail → Step 4a (analysis + fix, max 3 attempts) → Step 4b (escalate if 3 fail)
  → Pass + regression → revert Step 3, redesign, re-attempt
Step 5: Refactor (test after every change)
Step 6: Check off tdd-plan.md entries, advance to next test or proceed to Step 7
```

---

## Failure Handling Summary

| Failure | Action |
|---|---|
| Test fails for wrong reason (crash, import error) | Fix test infrastructure before proceeding |
| Test passes on first run (no implementation yet) | Rewrite the test — it is not testing what you think |
| Implementation fails after 3 attempts | Escalate to human (Step 4b) |
| Regression occurs | Revert IMPL step, redesign, re-attempt |
| Refactor breaks a test | Revert refactor step |
| Stub detected in self-check | Replace stub with real implementation, add test that would catch the stub |
| Final gate fails | Fix and re-run — do not skip |

---

## Phase 8 Transition (Engine Engagements)

If this work is part of a client engagement (Phase 7 delivery), transition to Phase 8 verification after the final commit:

1. Run `scripts/pre-review-report.sh` for a diff-scoped quality check
2. Run `quality/guardrails/scanner.sh` on all modified files
3. Run `bash scripts/phase-transition-check.sh --from 7 --to 8` to verify checkpoint criteria
4. Update `.ai/active-context.md` with delivery completion status
5. Invoke `/verify [project]` to begin Phase 8

If this is internal/personal work, this step is optional but recommended for quality discipline.
