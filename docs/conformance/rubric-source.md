# Conformance Rubric

Score every run on a 0-5 scale in each category.

## Categories

- `instruction_compliance` — followed CLAUDE/AGENTS/command/workflow rules
- `functional_correctness` — implemented the requested behavior accurately
- `quality_evidence` — produced build/test/lint evidence instead of unsupported claims
- `scope_control` — stayed within scope and documented shared-file pressure correctly
- `continuity` — maintained `.ai/` state and handoff quality
- `portability` — used the framework surfaces in a way another tool can reproduce

## Rating Guide

- `5` — complete and convincing with no material weakness
- `4` — strong with one minor weakness
- `3` — acceptable but clearly incomplete or inconsistent in one area
- `2` — weak or partially compliant
- `1` — mostly failed the category
- `0` — absent or directly violated the category

Record the score and evidence in the run bundle scorecard.
