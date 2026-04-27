---
description: "Lessons-learned feedback loop (Boris Cherny pattern): captures agent mistakes as scoped correction rules in .ai/lessons.md, loads them at session start, prunes weekly, and graduates stable rules to CLAUDE.md after 4+ weeks."
globs: ["**/.ai/lessons.md", "**/lessons.md"]
alwaysApply: false
---

# Lessons Learned — Stack Module

**Pattern origin:** Boris Cherny "lessons.md feedback loop"
**Purpose:** Give the agent a self-improving ruleset that compounds across sessions without polluting `CLAUDE.md` with immature rules.

Every mistake caught in a session becomes a scoped directive stored in `.ai/lessons.md`. Rules that survive 4+ weeks of correction-free sessions graduate to `CLAUDE.md`. Rules that are never triggered again get pruned. The file is a working queue, not a permanent ledger.

---

## L1 — Install

Create `.ai/lessons.md` in the project root with the following template:

```markdown
# Lessons Learned

> Auto-loaded at session start by enforcement-v2/session-start.sh.
> Target: ≤ 20 active rules. Prune weekly. Graduate stable rules to CLAUDE.md after 4+ weeks.
> Format: each entry = date | mistake | correction | rule directive | scope | first_seen | last_triggered

## Active Rules

<!-- entries go here — newest first -->

## Graduated (reference only)

<!-- rules moved to CLAUDE.md — kept here for audit trail -->
```

No additional configuration is required. The enforcement-v2 session-start hook discovers this file automatically if it exists at `.ai/lessons.md`.

---

## L2 — Configure

### Session-Start Hook Loading

`quality/enforcement-v2/session-start.sh` reads `.ai/lessons.md` on every session open and injects active rules into the session context as high-priority directives. Rules are prepended to context before any task description so they influence the entire session.

Hook behavior:
- Reads the `## Active Rules` block only (graduated rules are skipped)
- Extracts the `rule` field from each entry and prints it as a numbered directive list
- If the file has >20 active rules, emits a WARN and prints the oldest 5 for pruning review

### Pruning Schedule

**Weekly review (manual, ~5 minutes):**

1. Open `.ai/lessons.md`
2. For each rule, check the `last_triggered` date
3. Remove rules the agent has not violated in the past 4 weeks — they are either internalized or no longer relevant
4. Keep the active rule count below 20. If you are above 20, the file has become a ledger, not a queue.

**Graduation path — rule → CLAUDE.md:**

A rule is ready to graduate when:
- `first_seen` is 4+ weeks ago
- `last_triggered` is 2+ weeks ago (the correction is holding)
- The rule is scoped broadly enough to apply to most sessions (not a one-time edge case)

To graduate:
1. Move the rule text into the appropriate section of `CLAUDE.md`
2. Move the entry from `## Active Rules` to `## Graduated` in `lessons.md` with a note: `graduated: YYYY-MM-DD → CLAUDE.md §[section]`
3. Do not delete the graduated entry — it serves as an audit trail

---

## L4 — Conventions

### Entry Format

Each entry is a single YAML-style block:

```markdown
---
date: YYYY-MM-DD
mistake: [one sentence — what the agent did wrong]
correction: [one sentence — what the correct behavior is]
rule: "[imperative directive — written as a direct instruction to the agent]"
scope: [file-glob or domain label — e.g. "**/*.ts", "auth/**", "all sessions"]
first_seen: YYYY-MM-DD
last_triggered: YYYY-MM-DD
---
```

**Example entry:**

```markdown
---
date: 2026-03-15
mistake: Agent deleted the error-handling branch when simplifying a try/catch block.
correction: Simplification must preserve all error paths, even when the happy path is being refactored.
rule: "When refactoring error-handling code, verify every catch branch and error return path is present after the edit."
scope: "**/*.ts"
first_seen: 2026-03-15
last_triggered: 2026-03-22
---
```

### One Rule Per Entry

Do not combine two mistakes into one entry. Compound rules are harder to graduate and harder to prune independently. If a session produces three mistakes, write three entries.

### Scope Is Required

Every entry must have a scope. Without scope, the rule is applied everywhere and creates noise. Common scope values:

| Scope | When to use |
|---|---|
| `all sessions` | Rule applies regardless of file type or context |
| `**/*.ts` | TypeScript files only |
| `**/auth/**` | Auth domain only |
| `**/migrations/**` | Database migrations only |
| `spec files` | Applies when reading or writing spec/ADR files |
| `agent: implementer` | Applies only when acting as the implementer agent |

### Pruning Is Mandatory

Target: **≤ 20 active rules at all times.**

When the file exceeds 20 entries, the signal-to-noise ratio degrades and the session-start hook becomes counter-productive. The discipline of keeping the list short forces honest evaluation of which corrections are actually helping.

Rules that can be pruned:
- Not triggered in the last 4 weeks → probably internalized; remove
- Superseded by a CLAUDE.md rule that was graduated → remove (note the graduation)
- Too narrow to recur (one-time environment quirk) → remove with a comment

---

## L5 — Integration

### With enforcement-v2 session-start

`quality/enforcement-v2/session-start.sh` checks for `.ai/lessons.md` during the session orientation block. If the file exists, it prints:

```
[session-start] Loading lessons.md — N active rules
[session-start] Rule 1: [rule text]
...
[session-start] Rule N: [rule text]
```

If the active rule count exceeds 20, it appends:

```
[session-start] WARN: lessons.md has N active rules (target ≤ 20). Prune before next session.
Oldest rules pending review:
  - [date] [rule text]  ← last_triggered: YYYY-MM-DD
```

### With CLAUDE.md (graduation)

Graduated rules flow into `CLAUDE.md` under the most relevant existing section. If no section fits, add the rule to a `## Learned Corrections` section at the end of `CLAUDE.md`.

Do not graduate rules that are too specific to be useful across sessions (e.g., rules about a specific third-party API quirk that has since been patched).

### With agents/reviewer.md

The reviewer agent cross-references `lessons.md` during Check 8 (Specification Compliance):
- If an active lesson rule was violated in the reviewed code, flag it as a MEDIUM finding
- Cite the rule and its `first_seen` date in the finding body
- This creates a feedback loop: violations in review update the `last_triggered` date in the rule entry

---

## L6 — Troubleshooting

| Problem | Diagnosis | Resolution |
|---|---|---|
| File grows past 20 active rules | Pruning discipline has lapsed | Schedule a 5-minute pruning pass. Remove rules not triggered in 4+ weeks. Graduate rules that have held for 4+ weeks. |
| Agent ignores lessons at session start | Hook not loading the file | Verify `quality/enforcement-v2/session-start.sh` is configured in `.claude/settings.json` under `hooks.SessionStart`. Check that `.ai/lessons.md` exists at the project root. |
| Same mistake recurs despite an active rule | Rule phrasing is too vague or scoped too narrowly | Rewrite the rule as a more specific imperative. Broaden the scope if the mistake occurs across file types. Consider whether the rule belongs in `CLAUDE.md` permanently. |
| Rules conflict with each other | Two rules address the same situation with contradictory guidance | Merge the two entries into one. Write a rule that handles both cases explicitly. Prune the superseded entry. |
| Rule was graduated but mistake recurs | The CLAUDE.md rule was lost or overwritten | Re-add the rule to CLAUDE.md. Add a new lessons.md entry with the current date and a note: `re-opened: graduated rule was not holding`. |
| Lesson file not found by hook | File is not at `.ai/lessons.md` | Move the file to `.ai/lessons.md` or symlink from the alternate path. The hook only checks `.ai/lessons.md`. |

---

## Cross-References

- `CLAUDE.md` — destination for graduated rules
- `quality/enforcement-v2/session-start.sh` — hook that loads this file at session open
- `agents/reviewer.md` — Check 8 cross-references active lessons during code review
- `docs/enforcement-root-cause-analysis.md` — design rationale for the v2 enforcement system this integrates with
