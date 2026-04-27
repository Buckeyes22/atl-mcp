# Session Handoff Workflow

**Purpose:** Preserve context between AI agent sessions during engagement delivery. Solves the long-running agent context exhaustion problem — enables fresh agents to continue work with zero ambiguity.

**Source:** Adapted from softaworks/agent-toolkit session-handoff skill. Rewritten for Velocity Ops Engine context.

---

## When to Create a Handoff

- Context window approaching capacity during delivery
- Major milestone completed within a phase
- Work session ending mid-phase
- Switching between engagement phases
- Before pausing work on a client engagement

## When to Resume from a Handoff

- Starting a new session on an existing engagement
- Picking up paused work
- Onboarding a subcontractor to an in-progress engagement

---

## Handoff Document Structure

Store handoffs in: `engine/phases/<phase>/handoffs/`

Naming convention: `YYYY-MM-DD-HHMMSS-<slug>.md`

### Template

```markdown
# Session Handoff: [Engagement Name] — [Phase] — [Task Description]

**Created:** [timestamp]
**Engagement:** [client/project name]
**Phase:** [current engine phase, e.g., Phase 7: Delivery]
**Branch:** [git branch]
**Previous Handoff:** [link or "none"]

---

## Current State Summary

[2-3 sentences: What is happening right now? What was the last action taken?]

## Important Context

[Critical information the next agent MUST know. Include:
- Client-specific constraints or preferences
- Domain knowledge discovered during this session
- Architecture decisions made and their rationale
- Anything that would take 10+ minutes to rediscover]

## Decisions Made (with Rationale)

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| [choice] | [why] | [what else was considered] |

## Files Modified This Session

| File | Change Type | Status |
|------|-------------|--------|
| [path] | [created/modified/deleted] | [complete/in-progress/needs-review] |

## Immediate Next Steps

1. [First thing the next agent should do — specific and actionable]
2. [Second step]
3. [Third step]

## Pending Work

- [ ] [Incomplete task 1]
- [ ] [Incomplete task 2]
- [ ] [Incomplete task 3]

## Potential Gotchas

- [Known issue or trap the next agent should avoid]
- [Environment-specific concern]
- [Client sensitivity or constraint]

## Key Patterns Discovered

- [Convention or pattern found in the codebase]
- [Domain-specific knowledge worth preserving]

## Blockers

| Blocker | Owner | Status |
|---------|-------|--------|
| [what's blocking] | [who can resolve] | [waiting/resolved] |

## Phase Completion Status

| Phase Step | Status | Notes |
|-----------|--------|-------|
| [step from phase README] | [done/in-progress/not-started] | [details] |
```

---

## Handoff Chaining

For long-running engagements, chain handoffs to maintain context lineage:

```
handoff-1.md (Phase 5: Setup)
    ↓
handoff-2.md (Phase 6: Architecture) --continues-from handoff-1.md
    ↓
handoff-3.md (Phase 7: Delivery, Sprint 1) --continues-from handoff-2.md
    ↓
handoff-4.md (Phase 7: Delivery, Sprint 2) --continues-from handoff-3.md
```

Each handoff in the chain:
- Links to its predecessor via "Previous Handoff" field
- Can mark older handoffs as superseded
- Provides breadcrumbs for context reconstruction

When resuming from a chain, read the most recent handoff first, then reference predecessors only as needed.

---

## Staleness Assessment

Before resuming from a handoff, assess staleness:

| Level | Criteria | Action |
|-------|----------|--------|
| **FRESH** | < 24 hours old, < 5 commits since | Resume directly |
| **SLIGHTLY STALE** | 1-3 days old, 5-20 commits since | Review git log, then resume |
| **STALE** | 3-7 days old, 20+ commits since | Verify all assumptions before resuming |
| **VERY STALE** | > 7 days old OR branch diverged significantly | Create a fresh handoff from current state |

**Check staleness with:**
```bash
# Commits since handoff was created
git log --oneline --since="YYYY-MM-DD" | wc -l

# Files changed since handoff
git diff --name-only HEAD~<N> HEAD

# Branch divergence
git log --oneline main..HEAD | wc -l
```

---

## Resume Checklist

Before acting on a handoff:

- [ ] Project directory and git branch match the handoff
- [ ] Read the full handoff document
- [ ] If part of a chain, skim previous handoff for background
- [ ] Check staleness level
- [ ] Verify blockers — have any been resolved?
- [ ] Validate assumptions — do referenced files still exist?
- [ ] Check modified files for conflicts
- [ ] Start with "Immediate Next Steps" item #1

---

## Integration with Engine Phases

| Phase | Handoff Trigger | Handoff Contains |
|-------|----------------|------------------|
| Phase 2: Discovery | Discovery session ending | Client system inventory, domain research, vertical knowledge |
| Phase 3: Scoping | SOW draft complete | Scope decisions, pricing rationale, exclusions |
| Phase 5: Setup | Environment ready | Repo structure, credentials notes, CI/CD state |
| Phase 6: Architecture | Architecture decisions made | ADRs, component design, integration points |
| Phase 7: Delivery | Sprint boundary or context exhaustion | Code state, test status, remaining work |
| Phase 8: Verification | QA round complete | Test results, open bugs, client feedback |
| Phase 9: Handoff | Client handoff prep | Documentation state, training materials, credentials |

---

## Proactive Suggestion Triggers

After substantial work (5+ file edits, complex debugging, major decisions), suggest:

> "Significant progress made. Consider creating a handoff document to preserve this context for future sessions."

This prevents the most common failure mode: losing hours of context to a session timeout or context window exhaustion.
