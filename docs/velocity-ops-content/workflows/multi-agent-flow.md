# Multi-Agent Flow — Parallel Agent Coordination via Worktrees

**Workflow type:** Parallel agent decomposition and coordination
**Complexity target:** Features or tasks large enough to parallelize across independent workstreams
**Source:** Synthesis 5 (worktree coordination model) + reference doc multi-agent coordination + parallel-code Arena mode + BMAD agent role definitions + workmux/worktrunk tooling

---

## Core Principle

Parallel agents produce collisions unless every agent has unambiguous file ownership, a separate git worktree, and a wave-based execution model that enforces integration at defined synchronization points.

This workflow formalizes those constraints. A task launched under this workflow is decomposed into waves. Within a wave, agents work in parallel. Between waves, the orchestrator verifies that all wave outputs are integrated and consistent before releasing the next wave.
If shared foundations are involved, the orchestrator serializes them first and rebases every dependent worktree before parallel work resumes.

---

## When to Use

Use this workflow when the task meets at least two of the following criteria:

- The task contains three or more independently-implementable workstreams
- Estimated completion time for a single agent exceeds two hours
- Different workstreams require different domain expertise (backend + frontend + tests)
- A parallel implementation comparison (Arena mode) would produce a better outcome for a critical decision

Do NOT use this workflow for:

- Tasks with tight sequential dependencies throughout (each step requires the prior step's output)
- Tasks where all changes touch the same file or the same shared interface
- Simple features that a single agent can complete in under 30 minutes

---

## Roles

This workflow requires a designated **Orchestrator** (human or a supervising agent) and one or more **Worker agents**.

| Role | Responsibilities |
|---|---|
| Orchestrator | Task decomposition, wave gating, conflict resolution, merge order, Arena adjudication |
| Worker (Developer) | Implementation, tests, file changes within assigned scope |
| Worker (QA) | Test strategy, integration test authoring |
| Worker (Architect) | Cross-cutting design decisions, shared interface definitions |

BMAD agent personas may be assigned to these roles if used:
- PM ("John"): Requirements and acceptance criteria clarity
- Architect ("Winston"): Technical decisions, shared interface design
- Developer ("Amelia"): Implementation and unit tests
- QA ("Quinn"): Integration and E2E test authoring
- Scrum Master ("Bob"): Coordination artifact management

---

## Prerequisites

- [ ] Git worktree support is available (Claude Code `--worktree` flag or `worktrunk`/`workmux`)
- [ ] The task has been decomposed into at least two independent workstreams
- [ ] The main branch is clean and building (`pnpm typecheck && pnpm test` exits 0 on main)
- [ ] Shared resource ownership is decided before any agent starts
- [ ] If shared foundations are involved, the foundation task is named before any dependent worker starts

---

## Step 1 — Task Decomposition

The Orchestrator decomposes the task into waves. Wave-based decomposition rules:

- **Wave 1:** Tasks with no dependencies on other Wave 1 tasks. These are purely independent — each can start from the current main branch and produce a self-contained, mergeable output.
- **Wave 2:** Tasks that depend on one or more Wave 1 outputs. These cannot start until all required Wave 1 tasks are merged to the integration branch.
- **Wave 3+:** Integration, verification, and cleanup. These are sequential. They run after all wave N-1 outputs are merged.

Write the decomposition to `.ai/multi-agent-plan.md`:

```markdown
# Multi-Agent Plan

**Task:** [overall task description]
**Orchestrator:** [human or agent ID]
**Created:** [date]
**Status:** IN PROGRESS

## Wave Structure

## Foundation Coordination

- Shared foundations touched: [none | dependency graph | schema/migrations | env schema | shared contract]
- Foundation task IDs: [task IDs or "none"]
- Dependent tasks requiring rebase after foundation lands: [task IDs or "none"]

### Wave 1 — Independent Tasks (parallel)

| Task ID | Description | Agent | Branch | Foundation | Status |
|---|---|---|---|---|---|
| W1-A | [description] | [agent ID] | ai/[agent-id]/[task-slug] | yes/no | PENDING |
| W1-B | [description] | [agent ID] | ai/[agent-id]/[task-slug] | yes/no | PENDING |
| W1-C | [description] | [agent ID] | ai/[agent-id]/[task-slug] | yes/no | PENDING |

### Wave 2 — Dependent Tasks (parallel within wave)

| Task ID | Description | Agent | Branch | Depends on | Foundation | Status |
|---|---|---|---|---|---|---|
| W2-A | [description] | [agent ID] | ai/[agent-id]/[task-slug] | W1-A, W1-B | yes/no | BLOCKED |

### Wave 3 — Integration (sequential)

| Task ID | Description | Agent | Branch | Depends on | Status |
|---|---|---|---|---|---|
| W3-A | Integration verification | [agent ID] | ai/[agent-id]/integration | All W2 | BLOCKED |

## Shared Resources

[List all files that multiple agents may need to read, and the access rule for each.]

### Owned (one agent only)
- `[file path]` — owned by [agent/task ID]

### Read-Only for All
- `[file path]` — reason: [why]

### Forbidden (no agent may modify without Orchestrator approval)
- `package.json` — shared dependency file
- `tsconfig.json` — shared TypeScript configuration
- `[shared types file]` — shared interface definitions
- `[db schema file]` — database schema
- `.env*` — environment configuration

## Shared Resource Change Protocol

If any agent discovers they need to modify a Forbidden file, they must:
1. Document the need in `.ai/shared-changes.md` (see format below)
2. Stop that workstream and notify the Orchestrator
3. Wait for Orchestrator decision before proceeding

### Foundation-First Rule

If a change affects shared foundations:
1. Assign one task as the `foundation` task.
2. Land that task before dependent feature work continues.
3. Rebase every dependent worktree on the landed foundation change.
4. Update `.ai/multi-agent-plan.md` so the dependency is explicit and auditable.

## Arena Mode (if applicable)

[If a critical decision requires parallel evaluation, document it here. See Step 5.]
```

---

## Step 2 — File Ownership Assignment

Before any agent starts, the Orchestrator assigns file ownership explicitly. No agent may modify a file not in their Owned list.

**Ownership assignment format** (included in each agent's task spec):

```markdown
## File Ownership for [Agent ID] / [Task ID]

### Owned (may create or modify)
- `src/features/[feature]/[file].ts`
- `src/features/[feature]/[file].test.ts`
- `src/features/[feature]/` (any new files within this directory)

### Read-Only (may read, must not modify)
- `src/shared/types/[file].ts` — shared type definitions
- `src/lib/[file].ts` — utility used by your implementation

### Forbidden (must not open for writing)
- `package.json`
- `tsconfig.json`
- `src/shared/types/` (except your owned file above)
- `database/schema/`
- `.env*`

### Shared Resource Need Protocol
If you discover you need to modify a Forbidden file, immediately:
1. Stop the workstream
2. Add an entry to `.ai/shared-changes.md`
3. Notify the Orchestrator before proceeding
```

**Collision prevention rule:** If two agents are assigned overlapping Owned files, the Orchestrator must resolve the collision before releasing either agent. Do not start work with ambiguous ownership.

---

## Step 3 — Worktree Setup and Branch Naming

Each agent works in an isolated git worktree on a dedicated branch.

**Branch naming convention:**

```
ai/[agent-id]/[task-slug]
```

Examples:
```
ai/agent-1/user-auth-service
ai/agent-2/auth-ui-components
ai/agent-3/auth-integration-tests
```

**Worktree setup:**

Using Claude Code native:
```bash
claude --worktree
```

Using the framework-local helpers:
```bash
bash "$FRAMEWORK_DIR/scripts/multi-agent-plan-init.sh" --dir . --task "[overall task]" --orchestrator human
bash "$FRAMEWORK_DIR/scripts/worktree-init.sh" --dir . --task-id W1-A --agent implementer --slug [task-slug] --wave wave-1 --base HEAD --foundation --allow-dirty
bash "$FRAMEWORK_DIR/scripts/worktree-init.sh" --dir . --task-id W2-A --agent tester --slug [task-slug] --wave wave-2 --base HEAD --depends-on W1-A --depends-on-foundation --allow-dirty
```

Using worktrunk:
```bash
wt create ai/[agent-id]/[task-slug] -x claude
```

Using workmux:
```bash
workmux start [task-slug]
```

Each worktree starts from the current main branch (or the designated integration base branch). Agents do not branch from each other's branches.
Dependent worktrees must be rebased after a foundation task is merged before they continue making changes.
`multi-agent-plan-init.sh` writes fresh `.ai/` planning state immediately, so an immediate `worktree-init.sh` call from the same repository needs `--allow-dirty` unless you commit or stash those plan artifacts first.
Framework helpers treat an incomplete task spec as a blocked state. Populate the objective, acceptance criteria, requirements, ownership, verification evidence, and success criteria sections before a worker begins or before marking the task finished.

---

## Step 4 — Agent Task Specs

Each agent receives a complete, self-contained task spec. The spec must include:

```markdown
# Task Spec: [Task ID] — [Description]

**Agent:** [agent ID]
**Branch:** ai/[agent-id]/[task-slug]
**Wave:** [1 / 2 / 3]
**Depends on:** [task IDs that must be merged first, or "none"]
**Foundation task:** [yes/no]
**Depends on foundation:** [yes/no]

## Objective

[Single sentence describing what this agent must produce]

## Acceptance Criteria

- [ ] [criterion 1 — verifiable behavioral statement]
- [ ] [criterion 2]
- [ ] [criterion 3]

## Requirements

[Numbered list of specific requirements]

## Owned Files

- [list owned files]

## Read-Only Context

- [list read-only context]

## Forbidden Files

- package.json
- pnpm-lock.yaml
- tsconfig.json
- tsconfig.*.json
- .env*
- database schema and migration files
- authentication configuration

## Constraints

- Do not modify files outside your Owned list
- Run `pnpm test` before committing any change
- All commits must be on branch ai/[agent-id]/[task-slug]
- Use the shared resource need protocol if you need to touch a Forbidden file
- Status updates: update `.ai/multi-agent-plan.md` task status column when starting, completing, or blocked
- If this task depends on a foundation task, stop after that task lands and rebase before continuing

## Verification Evidence

- [required: record the verification commands and their observed results]

## Success Criteria

This task is complete when:
1. All acceptance criteria are checked
2. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` exit 0 on this branch
3. The branch is pushed and marked READY in `.ai/multi-agent-plan.md`
```

The framework-local helpers enforce this contract operationally:

- `scripts/multi-agent-status.sh --refresh-worktrees` reports `BLOCKED (task spec incomplete)` while the generated task spec still has required placeholder fields.
- `scripts/worktree-finish.sh` refuses to mark a task finished until the task spec includes the required sections, the objective/acceptance criteria/requirements/ownership/verification evidence/success criteria fields are populated, and the worktree shows concrete git evidence for reviewable work.

---

## Step 5 — Arena Mode (Critical Decisions)

**Source:** parallel-code Arena mode

When a Wave 1 task involves a critical architectural or algorithmic decision with no clear best choice, use Arena mode: run two to four competing implementations in parallel, then compare and merge the winner.

**Arena mode trigger conditions:**

- Algorithmic choice with significant performance implications
- API design where multiple valid patterns exist
- Authentication or security implementation where getting it wrong is costly
- A design decision that will constrain future work for weeks or months

**Arena mode protocol:**

1. Define the decision to be made with explicit evaluation criteria (performance, readability, extensibility, test coverage).
2. Assign two or more agents to the same problem with different approach constraints:
   - Agent A: implement using approach X
   - Agent B: implement using approach Y
3. Both agents work in separate worktrees on separate branches.
4. Both agents produce complete implementations with tests.
5. The Orchestrator reviews both outputs against the evaluation criteria.
6. A winner is selected. The winning branch becomes the input for the next wave.
7. The losing branch is archived (not deleted — it may contain useful patterns).

**Arena decision record format** (add to `.ai/multi-agent-plan.md`):

```markdown
## Arena Decision: [decision title]

**Criteria:** [evaluation criteria]
**Agent A approach:** [brief description] — Branch: ai/[agent-a]/[slug]-approach-a
**Agent B approach:** [brief description] — Branch: ai/[agent-b]/[slug]-approach-b
**Winner:** [Agent A / Agent B]
**Rationale:** [why the winner was selected against the criteria]
**Loser archived at:** [branch name]
**Key insights from losing approach:** [anything worth preserving]
```

---

## Step 6 — Status Tracking

All agents update `.ai/multi-agent-plan.md` as they work. Status values:

| Status | Meaning |
|---|---|
| PENDING | Not yet started |
| IN PROGRESS | Agent is actively working |
| BLOCKED | Waiting on another task or Orchestrator decision |
| REVIEW | Task complete, awaiting Orchestrator review |
| MERGED | Branch merged to integration branch |
| ABANDONED | Task cancelled or superseded |

**Agent status update points:**

1. When starting a task: change `PENDING` to `IN PROGRESS`
2. When blocked by a shared resource need: change to `BLOCKED`, add entry to `.ai/shared-changes.md`
3. When blocked by foundation-first sequencing: change to `BLOCKED`, note `foundation pending` in the plan, and wait for rebase
4. When task complete and pushed: change to `REVIEW`

**`.ai/shared-changes.md` format:**

```markdown
# Shared Resource Change Requests

## [date] — [Agent ID] — [Task ID]

**Resource needed:** [file path]
**Reason:** [why the agent needs to modify this file]
**Proposed change:** [description of the change]
**Impact on other agents:** [which other agents this might affect]
**Orchestrator decision:** [PENDING / APPROVED / DENIED / ALTERNATIVE:]
```

---

## Step 7 — Wave Gate: Wave 1 Completion

Before releasing Wave 2, the Orchestrator verifies all Wave 1 tasks:

### 7a. Per-task review

For each Wave 1 task marked REVIEW:

1. Check out the branch.
2. Run the full quality gate: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
3. Verify all acceptance criteria in the task spec are met.
4. Verify the agent did not modify any Forbidden files: `git diff main -- [forbidden file paths]`
5. If all checks pass: mark as MERGED-READY.

### 7b. Merge Wave 1 to integration branch

Create an integration branch from main:

```bash
git checkout -b integration/[feature-name] main
```

Merge Wave 1 branches in this order (lowest dependency risk first — typically smallest scope first):

If any Wave 1 branch is marked as a foundation task, merge it first regardless of size.

```bash
git merge ai/[agent-id]/[task-slug] --no-ff -m "wave-1: [task description]"
```

After each merge:
- Run `pnpm test`
- If any test fails: this is a merge conflict or integration issue. Stop. Resolve before proceeding.

### 7c. Integration baseline

After all Wave 1 merges are complete on the integration branch:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

All must exit 0. This is the Wave 2 baseline.

Mark all Wave 1 tasks as MERGED in `.ai/multi-agent-plan.md`.

---

## Step 8 — Wave Gate: Wave 2+ Completion

Release Wave 2 agents. They start from the integration branch (not from main):

```bash
git checkout -b ai/[agent-id]/[task-slug] integration/[feature-name]
```

Each Wave 2 agent runs the same process as Wave 1 agents (Steps 3–6).

The Wave 2 gate (Step 7) is repeated: verify → merge to integration → run full quality gate.

Repeat for Wave 3+.

---

## Step 9 — Integration Verification (Final Wave)

The final wave is always an integration verification task, run by a dedicated agent or the Orchestrator.

Integration verification checklist:

- [ ] All acceptance criteria from the original task decomposition are met
- [ ] No Forbidden files were modified without Orchestrator approval
- [ ] All shared resource change requests in `.ai/shared-changes.md` were resolved
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` passes on the integration branch
- [ ] No agent introduced a test that passes trivially (verify by reviewing new test files in the diff)
- [ ] The integration branch can be fast-forwarded to main (no divergence)

**Cross-agent collision check:**

```bash
git diff main..integration/[feature-name] --name-only
```

Review every changed file. Confirm each file appears in exactly one agent's Owned list. Any file changed by two agents indicates a collision that was not caught during decomposition. Resolve manually.

---

## Step 10 — Adversarial Review (Integration-Level)

Before merging to main, perform an adversarial review of the integration branch as a whole — not of individual agents' work, but of the combined output.

Review questions:

1. Does the combined feature work end-to-end? Is there a test that exercises the full path from entry point to output?
2. Are there any interfaces defined by one agent and consumed by another that could have drifted (agent A changed the interface after agent B read it)?
3. Are there duplicate implementations in the combined output (two agents solving the same problem independently and both landing in the codebase)?
4. Are there any gaps where agent A assumed agent B would implement something and agent B assumed agent A would?
5. Do the combined tests form a coherent suite, or are they fragmented and redundant?

Document findings and fix before merging to main.

---

## Step 11 — Merge to Main

The integration branch passes the full quality gate and adversarial review. Merge to main:

```bash
git checkout main
git merge integration/[feature-name] --no-ff -m "feat: [feature description] (multi-agent)"
```

Run the full quality gate on main one final time.

---

## Step 12 — Session Close

Update `.ai/multi-agent-plan.md`: mark overall status as COMPLETE.

Archive worktrees:
```bash
wt remove ai/[agent-id]/[task-slug]  # or equivalent per tool
```

Update `.ai/session-log.md`:

```markdown
## Multi-Agent Session [date]

**Task:** [feature name]
**Status:** COMPLETE
**Agents:** [list of agent IDs and their tasks]
**Waves:** [N waves, N tasks total]
**Arena decisions:** [list or "none"]
**Shared resource changes:** [list or "none"]
**Merge conflicts encountered:** [list or "none"]
**Total tests added:** [count]
**Notable integration issues:** [list or "none"]
```

---

## Failure Handling Summary

| Failure | Action |
|---|---|
| Ownership collision detected (two agents assigned same file) | Orchestrator resolves before either agent starts |
| Agent needs to modify a Forbidden file | Agent stops, files shared-changes.md request, waits for Orchestrator decision |
| Agent's branch fails quality gate at Wave gate | Send back to agent for fixes before merging |
| Merge conflict during Wave integration | Orchestrator resolves manually; document resolution |
| Two agents solved the same problem independently | Remove duplicate, keep the implementation with better test coverage |
| Gap found in integration (agent A/B assumption failure) | Identify which wave should own the gap; implement in a new task |
| Integration branch diverges from main during long Wave 2 work | Rebase Wave 2 branches on updated integration branch; re-run tests |

---

## Quick Reference — Branch and Status Structure

```
main
  └─ integration/[feature-name]           (created at Wave 1 start)
      ├─ ai/[agent-1]/[task-a]            (Wave 1)
      ├─ ai/[agent-2]/[task-b]            (Wave 1)
      ├─ ai/[agent-3]/[task-c]            (Wave 1, Arena approach A)
      ├─ ai/[agent-4]/[task-c]-approach-b (Wave 1, Arena approach B — archived)
      ├─ ai/[agent-5]/[task-d]            (Wave 2, depends on task-a + task-b)
      └─ ai/[agent-6]/integration         (Wave 3, final verification)
```

```
.ai/
  multi-agent-plan.md      (decomposition, wave structure, status table)
  shared-changes.md        (forbidden file change requests)
  active-context.md        (orchestrator working notes)
  session-log.md           (append-only session record)
```
