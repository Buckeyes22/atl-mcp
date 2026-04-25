# Partner Integration: claude-sessions

## 1. Why this partner

**Category: B (pattern-lift).** claude-sessions is a Bun Claude Code plugin providing session resumption with cost-optimized incremental summarization:

- **F-150**: Incremental Haiku-based summarization + HTML-comment-delimited markdown checkpoints + stale-session auto-finalization → §6.1 (checkpoint pattern reference)

**Gap closed**: v6 §6.1 (PHASE-STATE.json with lockable checkpoints) needs a checkpoint format that supports incremental updates without rewrites. claude-sessions' HTML-comment-delimited markdown supports idempotent append-only writes. Haiku-tier summarization keeps cost minimal across long sessions. Stale-session auto-finalization prevents indefinite "in-progress" state on abandoned sessions.

Findings reference: `repo-extraction-findings.md` lines 806–815, §40 F-150.

## 2. Prerequisites

N/A — pattern-lift. Note: Haiku-tier model required for cheap incremental summarization (e.g., `claude-haiku-4-5`); orchestrator already has Haiku in its model roster (§23.1). Bun runtime is plugin-side only, not required for orchestrator.

## 3. Source provenance

`claude-sessions` reference repository (Bun Claude Code plugin). Pin commit SHA in v6 §40 F-150 row. **No install required for orchestrator**; checkpoint format + stale-session timer absorbed into `src/state/checkpoint.ts` + `src/state/sessionLifecycle.ts`.

## 4. Configuration

### 4.1 Environment variables

N/A — pattern-lift.

### 4.2 Config file overlays

```yaml
checkpoint:
  delimiter: "<!-- CHECKPOINT: "
  delimiterEnd: " -->"
  delimiterClose: "<!-- END CHECKPOINT -->"
  maxSummaryLines: 80
  updateIntervalMessages: 5         # Haiku summarization runs every N messages
  fullResummaryEvery: 10            # Sonnet refresh every N checkpoints

sessionLifecycle:
  staleThresholdMs: 345600000        # 4 days (~ 96h) wall-clock
  staleCheckIntervalMs: 3600000      # check hourly
```

## 5. Adoption points in v6

- **F-150** → **§6.1** (checkpoint pattern reference: HTML-comment-delimited markdown checkpoints in `SESSION-CHECKPOINT.md` are idempotent append-only updates; incremental Haiku summarization runs every 5 messages with periodic Sonnet refresh; stale-session auto-finalization triggers after 4-day inactivity)

## 6. Pattern excerpts

**HTML-comment-delimited checkpoint format** (idempotent append-only):
```markdown
<!-- CHECKPOINT: 2026-04-25T10:14:00Z session-id=pcco-123 status=in-progress -->
Agent progressed through architecture review.
Prior context: 3200 tokens analyzed.
<!-- END CHECKPOINT -->
```

**Incremental summarization signature** (`src/state/checkpoint.ts`):
```ts
async function summarizeIncremental(
  sessionId: string,
  messagesSinceCheckpoint: ChatMessage[],
  priorCheckpoint?: SessionCheckpoint
): Promise<SessionCheckpoint> {
  // Use Haiku-tier model; 80-token max delta summary
  // Returns checkpoint with delta summary + metadata
}
```

**Stale-session auto-finalization** (`src/state/sessionLifecycle.ts`):
```ts
const staleThreshold = config.sessionLifecycle.staleThresholdMs;  // 4 days
if (Date.now() - session.lastActivityAt > staleThreshold) {
  session.status = "completed";
  await saveSessionCheckpoint(session);
  emitEvent("session.auto_finalized", { sessionId: session.id });
}
```

## 7. Gotchas

1. **Haiku summarization quality drift over many turns**: each delta summary is 80 tokens max; repeated summarization-of-summaries loses detail. Mitigation: every 10 checkpoints, run a fresh full-context summary with Sonnet (`fullResummaryEvery: 10`). (findings.md L806; F-150)
2. **HTML-comment delimiter conflicts with markdown comment-style content**: if agent output contains `<!-- ... -->` for documentation, checkpoints may be misaligned. Mitigation: validate delimiter uniqueness (append a UUID to the delimiter) and scan for conflicts during checkpoint writes. (findings.md L810; F-150)
3. **Stale-session timer is wall-clock, not activity-based.** Session idle for 4 days auto-finalizes even if user intends to resume soon. Consider activity-based TTL (last-message timestamp + rolling 4-day window) or user-override flag. (findings.md L812; F-150)
4. **Incremental summarization cost accumulation**: Haiku is cheap, but 5-message intervals × many sessions = non-zero spend. Track cumulative cost per session; warn if summarization cost exceeds primary LLM cost. (findings.md L808; F-150)

## 8. Validation

```bash
# 1. Verify §6.1 references checkpoint pattern
grep -nE "checkpoint pattern|PHASE-STATE.json|HTML.comment.*checkpoint" agent-context-orchestrator-mcp-plan-v6.md | head -5

# 2. Verify checkpoint format constants
grep -nE "<!-- CHECKPOINT|<!-- END CHECKPOINT" src/state/checkpoint.ts

# 3. Smoke: write checkpoint and confirm idempotent append
orchestrator cli checkpoint write --session-id smoke --status in-progress
orchestrator cli checkpoint write --session-id smoke --status in-progress
# Expect: 2 checkpoint blocks appended; prior content not rewritten

# 4. Stale-session test
SESSION_LAST_ACTIVITY=$(date -d "5 days ago" +%s) orchestrator cli session check-stale
# Expect: status=completed, event "session.auto_finalized" emitted
```

## 9. Operational concerns

- **Upstream archival risk: low.** Patterns (incremental summarization, HTML-comment checkpoint, stale-finalize) are absorbed in `src/state/checkpoint.ts` + `src/state/sessionLifecycle.ts`. If claude-sessions plugin archived, orchestrator continues; pattern is portable.
- **In-tree absorption**: checkpoint format in `src/state/checkpoint.ts`; lifecycle in `src/state/sessionLifecycle.ts`; SESSION-CHECKPOINT.md template in `prompts/checkpoint-template.md`.
- **Cost management**: Haiku summarization adds ~$0.001 per checkpoint; budget per session via `MAX_SESSION_SUMMARY_COST_USD` env override.
- **Promotion**: not applicable — orchestrator owns implementation.
- **Disaster recovery**: SESSION-CHECKPOINT.md is git-tracked or stored in PHASE-STATE; back up with repo or workflow state.
