---
description: "REFERENCE ONLY — v1 guardrails architecture documentation. Superseded by v2 root-cause enforcement system at quality/enforcement-v2/. Retained for historical context on the 5-gate design."
globs: [".guardrails.yml"]
alwaysApply: false
---

# Guardrails v1 — SUPERSEDED

**This module documents the v1 enforcement architecture. It has been superseded by the v2 root-cause system at `quality/enforcement-v2/`.**

The v1 system had 50+ symptom-level checks across 5 gates firing 14 times per edit cycle. It caught code-level problems but missed judgment-level failures and degraded overall output quality through overhead. See `docs/enforcement-root-cause-analysis.md` for the full analysis.

The v1 scanner (`quality/guardrails/scanner.sh`) remains available as an on-demand CLI tool for projects that want per-file code quality scanning.

---

## How It Works

Five gates intercept at the earliest viable point — the moment each gap is introduced:

| Gate | Trigger | What It Catches |
|------|---------|----------------|
| **Gate 1** SessionStart | Every session | Divergent branches, orphaned worktrees, detached HEAD, project audit |
| **Gate 2** PreToolUse | Before Edit/Write/Bash | Test-before-source, plan diff protection, branch/push safety, dependency approval, duplication |
| **Gate 3** PostToolUse | After Edit/Write | Stubs, type violations, phantom imports, vacuous tests, error swallowing, scope contamination |
| **Gate 4** Stop | Session end | Coverage drift, checklist reconciliation, branch state, findings report |
| **Gate 5** Pre-commit | `git commit` | Merge regressions, manual edit bypasses, cherry-pick damage |

### Tiered Enforcement

- **BLOCK** — hard block, must be fixed before proceeding (stubs, `as any`, vacuous tests, divergent branches)
- **WARN** — flagged with documentation, included in commit for traceability (TODOs, coverage gaps, scope contamination)

---

## Configuration

Place `.guardrails.yml` in your project root for spec-aware enforcement. See `templates/guardrails.yml` for the full template.

Key fields:
- `project.spec_dir` — where spec files live
- `project.domain_src` — where domain source lives
- `project.test_pattern` — test file naming convention
- `spec_layers` — which companion files each spec should have
- `test_layers` — which test layers the testplan should cover (including `business_intent`)
- `enforcement.promote_to_block` — promote warnings to hard blocks
- `enforcement.exempt_paths` — paths exempt from enforcement

Without `.guardrails.yml`, the system auto-detects test framework, source directories, and test conventions.

---

## Business Intent Tests (BI-*)

A test layer derived from the spec's **Summary**, **User Journeys**, and **Acceptance Criteria**. These test the *why* behind a feature, not just the mechanics.

### Derivation

1. Read spec Summary → extract core value proposition
2. Read User Journeys → identify testable behavioral outcomes
3. Read Acceptance Criteria → identify cross-cutting edge case combinations
4. Read Dependencies → identify cross-domain integration points

### Naming

`{SPEC-ID}-BI-{N}: {behavioral statement}`

Example: `AIF-001-BI-1: matching quality measurably improves as evaluation data accumulates`

---

## Context Erosion Protection

### Problem

AI context compresses during long sessions. Early decisions lose influence. Plan items get silently dropped.

### Solution

Every decision, plan item, and checklist must be written to disk immediately.

- **Gate 1** generates `.guardrails-checklist.md` from the spec at feature start
- **Gate 2** blocks edits to plan/spec files that drop items
- **Gate 3** verifies each edit advances a tracked checklist item
- **Gate 4** re-reads the checklist from disk (not conversation memory) and reports drift
- Items cannot be removed from the checklist — only completed, deferred (with reason), or blocked

---

## AI Coding Tool Traps Covered

9 categories, 40+ specific traps:

1. **Phantom & hallucinated code** — imports for packages not installed, APIs that don't exist
2. **Silent destruction** — rewrites that drop edge cases, error swallowing, scope creep
3. **Architectural erosion** — over-abstraction, duplication, circular deps, dead code
4. **Dependency & config risk** — unauthorized deps, config drift, schema drift
5. **Context loss across sessions** — re-implementation divergence, contradicting decisions
6. **Test quality illusions** — mock-heavy tests, vacuous assertions, snapshot addiction
7. **Git state confusion** — phantom branches, push to wrong branch, divergent work
8. **Context erosion** — plan erosion, progressive simplification, transition loss
9. **Scope contamination** — context bleeding from exploration, example-as-target, consumer coupling

---

## Semantic Validation (v1.5.0)

Beyond syntactic pattern matching, the guardrails can detect logically wrong implementations:

- **Mutation testing** (`gate-mutation.sh`) — runs Stryker on changed files at session end. Surviving mutants indicate tests that pass but don't verify correct behavior.
- **Property-based test generation** (`property-generator.sh`) — extracts invariants from specs (numeric bounds, determinism, monotonicity, idempotency) and generates fast-check property test templates.

## Agent Role Enforcement (v1.5.0)

Agent role boundaries from `agents/*.md` are now enforced (softly) by Gate 2:
- Detects current agent role from environment, `.ai/active-context.md`, or branch name
- Warns on tool or file boundary violations
- Does not hard-block — the human may authorize cross-role work

## Cost/Efficiency Tracking (v1.5.0)

Session-level metrics captured automatically:
- Duration, files changed, violations caught, estimated rework prevented
- Trend reporting via `quality/guardrails/session-metrics.sh report`
- ROI calculation: "Guardrails prevented ~X minutes of rework across Y sessions"

## Enforcement Metrics (v1.5.0)

Aggregate violation data across sessions via `quality/guardrails/metrics.sh`:
- Top patterns by frequency, category breakdown, trend data
- `/guardrails metrics` command for on-demand reporting
- Feeds evidence into the assumption register (H4, H5)

## Post-Incident Feedback (v1.5.0)

Production bugs automatically strengthen the framework:
- `/post-incident` traces bugs backward: function → spec → testplan → BI tests → guardrails
- Auto-generates missing testplan items and BI tests
- Proposes new scanner patterns for review

## Cross-Project Intelligence (v1.5.0)

Patterns flow upward from projects to the framework:
- `/contribute` extracts novel violation patterns not in the framework scanner
- Proposals staged in `contributions/pending/` for human review
- Accepted patterns benefit all projects on next sync

---

## Installation

```bash
bash scripts/install-guardrails.sh --dir /path/to/project
```

This installs:
- Git pre-commit hook (extends existing Husky hooks if present)
- `.guardrails.yml` template (with auto-detected values)
- Claude Code hook entries in `.claude/settings.json`

---

## Scripts

| Script | Purpose |
|--------|---------|
| `quality/guardrails/scanner.sh` | Core pattern scanner (all patterns, content + diff modes) |
| `quality/guardrails/config.sh` | `.guardrails.yml` parser + auto-detection |
| `quality/guardrails/checklist.sh` | Checklist CRUD (create/status/check/defer/diff/verify) |
| `quality/guardrails/gate-session-start.sh` | Gate 1: session awareness |
| `quality/guardrails/gate-pre-edit.sh` | Gate 2: pre-edit prevention |
| `quality/guardrails/gate-post-edit.sh` | Gate 3: immediate post-edit feedback |
| `quality/guardrails/gate-stop.sh` | Gate 4: session-end audit |
| `quality/guardrails/gate-pre-commit.sh` | Gate 5: commit backstop |

---

## Design Reference

Full design spec with enforcement gap audit, trap catalog, and gate specifications:
`docs/plans/2026-03-21-guardrails-enforcement-layer-design.md`
