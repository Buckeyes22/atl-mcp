# Partner Integration: three-man-team

## 1. Why this partner

**Category: B (pattern-lift).** three-man-team is a prompt-based 3-agent orchestration framework (no runtime code; pure template patterns) for Claude Code workflows. It contributes 4 patterns:

- **F-113**: Persona vocabulary routing → §29 (prompt convention)
- **F-114**: File-based handoff (BRIEF / REQUEST / FEEDBACK) → §18.2
- **F-115**: Deploy-gate accountability (summarize → tell PO → PO approves → commit → log → checkpoint) → §18.4
- **F-205**: Foreground-only Agent-tool subagents in Claude Code → §20.gotchas, `docs/claude-code.md`

The three-agent structure (Architect / Builder / Reviewer) is the deployment unit that activates richer training patterns than solo agents. Persona vocabularies with biographical detail (e.g., "Richard, 75-year-old craftsperson") activate stronger latent patterns than generic role labels.

**Gap closed**: v6 needs (a) a structured handoff between phases (eliminate token waste, survive restarts, reviewable diffs); (b) deploy-gate accountability sequence; (c) explicit Claude Code constraint documentation that subagents must run foreground.

Findings reference: `repo-extraction-findings.md` lines 668–678, L1286, §40 F-113, F-114, F-115, F-205.

## 2. Prerequisites

N/A — pattern-lift. three-man-team is a prompt framework; no installation, no servers.

## 3. Source provenance

three-man-team reference repository (frozen at v1.1.0, production-shipped). Pin commit SHA in v6 §40 F-113 row. **No install required**: patterns absorbed into v6 §29 (persona vocabulary), §18.2 (file-based handoff), §18.4 (deploy-gate), §20.gotchas (foreground-only).

## 4. Configuration

### 4.1 Environment variables

N/A — pattern-lift.

### 4.2 Config file overlays

```yaml
handoff:
  basePath: .orchestrator/handoff/
  files:
    brief: BRIEF.md       # orchestrator → phase
    request: REQUEST.md   # phase → orchestrator (deliverables + gaps)
    feedback: FEEDBACK.md # orchestrator → next phase (approval status)

deployGate:
  stages:
    - summarize
    - notifyPO
    - awaitApproval
    - commit
    - logAuditEntry
    - writeCheckpoint
```

## 5. Adoption points in v6

- **F-113** → **§29** (persona vocabulary routing: build-agent prompts use named personas with biographical detail rather than role labels; activates richer training patterns)
- **F-114** → **§18.2** (file-based handoff serialization: BRIEF / REQUEST / FEEDBACK files at `.orchestrator/handoff/<phase>/`; eliminates token waste; survives restarts; diff-able)
- **F-115** → **§18.4** (deploy-gate accountability: summarize → tell PO → PO approves → commit + audit log + SESSION-CHECKPOINT.md)
- **F-205** → **§20.gotchas** + **`docs/claude-code.md`** (foreground-only subagents: Claude Code background-mode subagents stall on PermissionRequest hooks like Edit-tool approval; subagents must use `runInBackground: false`)

## 6. Pattern excerpts

**Persona vocabulary** (`prompts/personas/`):
```
Architect "Arch"  — systems design persona; biographical detail emphasizing rigor.
Builder   "Bob"   — syntax/testing persona; biographical detail emphasizing iteration.
Reviewer  "Richard" — production-safety persona; 75yo war-era craftsperson with off-by-one detection reputation.
```

**Handoff file shape** (`.orchestrator/handoff/phase_<id>/`):
- `BRIEF.md` — phase instructions, decisions, constraints (orchestrator → phase)
- `REQUEST.md` — phase deliverables, open questions, gaps (phase → orchestrator)
- `FEEDBACK.md` — review status: APPROVED / APPROVED-WITH-CONDITIONS / REJECTED (orchestrator → next phase)

Format: markdown with JSON front-matter for machine parsing.

**Deploy-gate sequence** (§18.4):
1. Reviewer signals PASS via §18.1 adversarial triplet
2. Orchestrator summarizes change set
3. NotificationProvider sends summary to PO
4. PO returns MCP tool response with `approved: true` (human boundary)
5. Workflow commits + appends ed25519-signed audit entry (per agentdiff §30) + writes SESSION-CHECKPOINT.md

**Foreground-only subagent rule** (`docs/claude-code.md`):
```
Claude Code Agent-tool subagents that call Edit (or other PermissionRequest tools)
MUST use runInBackground: false. Background mode has no approver in scope and stalls
indefinitely waiting for permission grants.
```

## 7. Gotchas

1. **Persona vocabulary collision**: two agents with similar persona vocabularies converge on overlapping mental models, reducing diversity. Assign personas along orthogonal expertise axes (Architect ← systems; Builder ← syntax; Reviewer ← safety). (findings.md L671; F-113)
2. **Handoff file race conditions**: when phases run in parallel, writes to BRIEF/REQUEST/FEEDBACK must be atomic. Use git-based storage with per-phase branch locks or claim-based coordination (Citadel pattern §17.6). (findings.md L670; F-114)
3. **PO-approval blocking**: deploy-gate step 4 blocks until human response. Long-running phases time out. Set explicit approval deadline + escalation policy. (findings.md L672; F-115)
4. **Foreground-only means no parallel subagent dispatch in Claude Code**: foreground subagents run sequentially. Parallelize only within a single subagent (tool batching), not across subagents. (findings.md L676, L1286; F-205)

## 8. Validation

```bash
# 1. Verify §29 references persona vocabulary
grep -n "persona\|persona vocabulary" agent-context-orchestrator-mcp-plan-v6.md | head -5

# 2. Verify §18.2 references BRIEF/REQUEST/FEEDBACK
grep -nE "BRIEF|REQUEST|FEEDBACK" agent-context-orchestrator-mcp-plan-v6.md | head -5

# 3. Verify §18.4 documents deploy-gate sequence
grep -nE "summarize.*PO.*approve.*commit" agent-context-orchestrator-mcp-plan-v6.md | head -5

# 4. Verify foreground-only documented
grep -n "runInBackground\|foreground" docs/claude-code.md
```

## 9. Operational concerns

- **Upstream archival risk: very low.** Upstream is frozen at v1.1.0. Patterns absorbed into v6; no ongoing sync needed.
- **In-tree absorption**: handoff in `src/handoff/`, deploy-gate in `src/deploy/deployGate.ts`, personas in `prompts/personas/`, Claude Code constraint in `docs/claude-code.md`.
- **Promotion**: not applicable — patterns, not runtime code.
- **Disaster recovery**: handoff files are git-tracked; no external state.
