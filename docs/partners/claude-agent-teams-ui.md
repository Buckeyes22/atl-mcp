# Partner Integration: claude_agent_teams_ui

## 1. Why this partner

**Category: B (pattern-lift).** `claude_agent_teams_ui` is an Electron + React multi-agent UI (TypeScript, FastMCP MCP server) contributing 6 patterns to v6:

- **F-093** (multi with Caliber): 6-category token tracking (claudeMd / mentionedFile / toolOutput / thinkingText / teamCoordination / userMessage) **AND** seat-based vs API-key provider distinction → §10 (TokenBudgetReport), §16.1, §23.1
- **F-094**: Post-compact context recovery (re-inject orchestrator-managed metadata on compaction) → §6.3 (DRIFT_DETECTED triggers)
- **F-095**: Action-mode capability injection (read-only / approve-each-tool) → §7.2 (PolicyObligation), §38.3
- **F-096**: WebSocket batching (50ms) + 1MB backpressure → §22.1
- **F-097**: SSE 30s keep-alive + no-polling pattern → §14, §22.1, M10
- **F-098**: Hunk-level review with `node-diff3` merge3 + deterministic message IDs (`sha256(from + timestamp + text)`) → §18.3, §26.1, M6c

**Gap closed**: v6 specifies abstract patterns for token tracking, post-compact recovery, action-mode injection, transport batching, SSE keep-alive, and hunk-level review. claude_agent_teams_ui demonstrates production implementations of all six in a deployed multi-agent system.

Findings reference: `repo-extraction-findings.md` lines 773–788, §40 F-093, F-094, F-095, F-096, F-097, F-098.

## 2. Prerequisites

N/A — pattern-lift. The orchestrator implements each pattern in its own modules. Library required for hunk-merge pattern: `node-diff3` v3.2+.

## 3. Source provenance

`claude_agent_teams_ui` repository (Electron + React + FastMCP). Pin commit SHA in v6 §40 F-093..F-098 rows. **No install required**: extract patterns into orchestrator codebase.

## 4. Configuration

### 4.1 Environment variables

N/A — pattern-lift. All knobs in orchestrator config.

### 4.2 Config file overlays

```yaml
tokenTracking:
  categories: [claudeMd, mentionedFile, toolOutput, thinkingText, teamCoordination, userMessage]
  phaseTracking: true

actionMode:
  enum: [read-only, approve-each-tool]
  capabilityInjection: true

transport:
  websocket:
    batchIntervalMs: 50
    backpressureLimitBytes: 1048576
  sse:
    keepAliveIntervalSec: 25      # margin under 30s proxy timeout
    noPollingMode: true

review:
  hunkMergeLib: node-diff3
  deterministicIds: "sha256(from + timestamp + text)"
```

## 5. Adoption points in v6

- **F-093** → **§10** (TokenBudgetReport with 6-category breakdown) + **§16.1** (context budgeting per category) + **§23.1** (seat-based vs API-key provider distinction)
- **F-094** → **§6.3** (post-compact context recovery: re-inject team instructions / coordination state / action-mode constraints when compaction signal detected)
- **F-095** → **§7.2** (PolicyObligation type) + **§38.3** (action-mode capability injection: read-only / approve-each-tool obligations applied per tool call)
- **F-096** → **§22.1** (WebSocket batcher: 50ms coalesce window + 1MB backpressure)
- **F-097** → **§14** + **§22.1** + **M10** (SSE 25–30s keep-alive + no-polling: SSE is the only update channel)
- **F-098** → **§18.3** (hunk-level review with node-diff3 merge3) + **§26.1** (deterministic message IDs via sha256 of from + timestamp + text) + **M6c**

## 6. Pattern excerpts

**6-category token tracking**:
```ts
export enum TokenCategory {
  CLAUDE_MD = "claudeMd", MENTIONED_FILE = "mentionedFile", TOOL_OUTPUT = "toolOutput",
  THINKING_TEXT = "thinkingText", TEAM_COORDINATION = "teamCoordination", USER_MESSAGE = "userMessage",
}
```

**Post-compact recovery hook** (`src/state/postCompact.ts`):
```ts
async function recoverAfterCompaction(compacted: CompactedMessage): Promise<void> {
  const orchestratorMetadata = {
    teamInstructions: globalTeamState.instructions,
    coordinationState: globalTeamState.phase,
    actionMode:        currentPolicy.actionMode,
  };
  await contextStore.update({ ...compacted, ...orchestratorMetadata });
}
```

**Action-mode obligation** (`src/auth/actionModes.ts`):
```ts
export interface PolicyObligation {
  type: "read-only" | "approve-each-tool" | "require-human-review";
  appliesTo: string[];
  onViolation: "warn" | "block" | "escalate";
}
```

**WebSocket batcher** (`src/transport/wsBatcher.ts`):
```ts
class WebSocketBatcher {
  private queue: Message[] = [];
  private batchIntervalMs = 50;
  private backpressureLimit = 1048576;
  // coalesce up to interval or backpressure threshold; drop oldest on overflow
}
```

**SSE keep-alive handler**:
```ts
app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const ka = setInterval(() => res.write(`: keep-alive ${Date.now()}\n\n`), 25000);
  req.on("close", () => clearInterval(ka));
});
```

**Hunk review with merge3 + deterministic IDs** (`src/review/hunkMerge.ts`):
```ts
import { merge3 } from "node-diff3";
import { createHash } from "node:crypto";

function deterministicMessageId(from: string, ts: number, text: string): string {
  return createHash("sha256").update(`${from}:${ts}:${text}`).digest("hex");
}

async function reviewHunkWithMerge3(base: string, mine: string, theirs: string) {
  const result = merge3({ base, mine, theirs });
  if (result.conflict) return { status: "conflict", markers: result.markers, requiresHumanReview: true };
  return { status: "resolved", result: result.result };
}
```

## 7. Gotchas

1. **Post-compact recovery race vs new context.** Re-injection of team-coordination metadata must occur *before* first message assembly post-compaction. If a new tool result arrives during recovery, metadata may be stale. Acquire write lock on `ContextStore` during recovery; checkpoint metadata version in PHASE-STATE.json. (findings.md L779; F-094)
2. **Action-mode bypass via tool composition.** An `approve-each-tool` obligation blocks individual invocations, but a compound tool that internally calls child tools may bypass. Expand tool-collapse pattern (v6 §14) to require capability checks at every composition boundary. (findings.md L780; F-095)
3. **50ms batching impacting interactive UX.** Real-time dashboard updates are delayed by 50ms. For latency-critical features, reduce batch interval or send unbatched messages above a size threshold. Per-entity batching configuration; interactive updates bypass. (findings.md L776; F-096)
4. **SSE 30s timeout vs 25s keep-alive margin.** Some proxies/firewalls close idle connections at 30s. A 30s keep-alive with 25s client timeout inverts ordering. Use 25s keep-alive with 35s client timeout; add TCP-level keep-alive. (findings.md L783; F-097)
5. **node-diff3 merge3 conflicts on identical-timestamp hunks**: if two merges produce identical text at same Unix timestamp, deterministic ID collides. Extend ID to include `hash(base + mine + theirs)` to disambiguate. (findings.md L777; F-098)
6. **Deterministic ID collision on concurrent edits**: when multiple writers edit same hunk simultaneously with same timestamp, IDs may collide. Assign at write time with microsecond precision or random jitter. (findings.md L784; F-098)
7. **No-polling means SSE is the only update channel**: if SSE drops, no backup path. Exponential backoff reconnect; queue updates for 5 minutes; client re-establishes within window. (findings.md L783; F-097)

## 8. Validation

```bash
# 1. Token tracking
orchestrator cli context pack --project-id test --verbose
# Expect: TokenBudgetReport with all 6 categories

# 2. Post-compact recovery
orchestrator cli compact --project-id test --force
# Expect: team-coordination state restored; metadata version in PHASE-STATE.json

# 3. Action-mode
orchestrator cli set-policy --project-id test --action-mode read-only
orchestrator cli tool-invoke --tool-id test-tool
# Expect: rejected with PolicyWarning

# 4. WebSocket batching (network observation)
# Expect: outbound frames coalesce 2-10 messages; max 1MB

# 5. SSE keep-alive
curl -N http://localhost:3001/api/events | head -50
# Expect: pings every 25s ± 2s

# 6. Hunk review
orchestrator cli pr-review --pr-id test-pr --hunk-mode
# Expect: per-hunk reviewed; conflicts flagged; deterministic IDs stable
```

## 9. Operational concerns

- **Upstream archival risk: low.** Each of the 6 patterns is isolated enough to maintain independently. Token-tracking taxonomy lives in `src/observability/tokenTracking.ts`; recovery in `src/state/postCompact.ts`; action-modes in `src/auth/actionModes.ts`; transport in `src/transport/`; review in `src/review/hunkMerge.ts`.
- **Cost implications**: token tracking adds ~5% telemetry payload; post-compact recovery adds one DB write per compaction; action-mode checking adds one policy lookup per tool invocation. All negligible vs LLM inference.
- **Optional adoption**: hunk-level review (defer to M6c if PR workflow not in v1); SSE (defer if client is HTTP-polling capable).
- **Promotion**: not applicable — orchestrator owns implementation of all 6 patterns.
- **Pattern stability**: 6 patterns are independently versioned; changes to one don't cascade.
