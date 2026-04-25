# Partner Integration: agent-maestro

## 1. Why this partner

**Category: B (pattern-lift).** agent-maestro is a TypeScript/Tauri multi-agent orchestrator (Express server + Node CLI + Tauri 2/React 18 desktop) contributing 5 patterns to v6:

- **F-060**: 4-mode agent classification (worker / coordinator / coordinated-worker / coordinated-coordinator) → §10, §14.1
- **F-061**: 4 workflow strategies (simple / queue / tree / intelligent-batching / DAG topological waves) → §6.2, §24.1
- **F-063**: Manifest-driven agent spawning (server emits `manifest.json` → CLI injects system prompt) → §14.3
- **F-064**: Per-session git worktrees on `orchestrator/{sessionId}` branch namespace → §13, §19, §24.5, M3, M6c
- **F-065**: WebSocket batching (50ms) + per-entity throttling + 1MB backpressure + immediate-event bypass → §22.1

**Gap closed**: v6 §6 (workflow strategies), §14 (actor hierarchy), and §24 (job queue) require a vocabulary and implementation patterns for agent modes and workflow strategies richer than basic queued→running→done state machines. agent-maestro's 4-mode model maps cleanly into the §14 hierarchy. Its DAG with topological-wave execution refines the basic queue. Per-session worktree pattern directly enables M6c VCS sandboxing.

Findings reference: `repo-extraction-findings.md` lines 586–597, §40 F-060, F-061, F-063, F-064, F-065.

## 2. Prerequisites

N/A — pattern-lift; no runtime dependency. The orchestrator re-implements patterns in its own modules (`src/agents/`, `src/workflows/`, `src/transport/`, `src/vcs/`).

## 3. Source provenance

`agent-maestro` repository (TypeScript). Pin commit SHA in v6 §40 F-060..F-065 rows. **No install required**: extract patterns and re-implement.

## 4. Configuration

### 4.1 Environment variables

N/A — pattern-lift. Worktree branch prefix and batching constants are documented in v6 config.

### 4.2 Config file overlays

```yaml
vcs:
  worktrees:
    sessionBranchPrefix: orchestrator/{sessionId}
    cleanup:
      onSessionAbort: true
      onSuccess: true
      onTimeout: true

transport:
  websocket:
    batchIntervalMs: 50
    perEntityThrottleMs: 100
    backpressureLimitBytes: 1048576    # 1MB
    immediateEventBypass:
      - agent.error
      - session.abort

agents:
  modes:
    - worker
    - coordinator
    - coordinated-worker
    - coordinated-coordinator
```

## 5. Adoption points in v6

- **F-060** → **§10** (AgentMode type in domain model) + **§14.1** (4-mode actor hierarchy with capability gates)
- **F-061** → **§6.2** (workflow strategy selection) + **§24.1** (per-phase strategy: simple, queue, tree, intelligent-batching, DAG topological-wave)
- **F-063** → **§14.3** (manifest-driven `handoff_generate` output: agent roles + system prompts + provider config + capability flags as `~/.maestro/sessions/{sessionId}/manifest.json`)
- **F-064** → **§13** (VCS artifacts) + **§19** (VcsProvider) + **§24.5** (per-session VCS worktree) + **M3** + **M6c** (worktree branch namespace `orchestrator/{sessionId}` with cleanup hooks)
- **F-065** → **§22.1** (WebSocket batching: 50ms window + per-entity throttling + 1MB backpressure + immediate-event bypass for critical signals)

## 6. Pattern excerpts

**4-mode classification** (`src/agents/modes.ts`):
```ts
export type AgentMode = "worker" | "coordinator" | "coordinated-worker" | "coordinated-coordinator";

export interface CapabilityFlags {
  canExecuteTask: boolean;
  canDispatchTask: boolean;
  canCoordinateTeam: boolean;
}
```

**Workflow strategy enum** (`src/workflows/strategies.ts`):
```ts
export type WorkflowStrategy =
  | "simple"
  | "queue"
  | "tree"
  | "intelligent-batching"
  | "dag-topological-wave";
```

**Manifest schema** (`~/.maestro/sessions/{sessionId}/manifest.json`):
```ts
export interface SessionManifest {
  sessionId: string;
  version: "1.0";
  agents: Array<{
    agentId: string;
    mode: AgentMode;
    systemPrompt: string;
    provider: "claude" | "codex" | "gemini";
    capabilityFlags: CapabilityFlags;
  }>;
  workflowStrategy: WorkflowStrategy;
  created: string;   // ISO8601
}
```

**Worktree branch naming** (`src/vcs/worktree.ts`):
```ts
export function sessionWorktreeBranchName(sessionId: string): string {
  return `orchestrator/${sessionId}`;
}
```

**WebSocket batcher** (`src/transport/wsBatcher.ts`):
```ts
export interface WebSocketBatchConfig {
  batchIntervalMs: 50;
  perEntityThrottleMs: 100;
  backpressureLimitBytes: 1048576;
  immediateEventBypass: string[];   // ["agent.error", "session.abort"]
}
```

## 7. Gotchas

1. **Worktree cleanup on abort must be idempotent.** If the session crashes before cleanup runs, the worktree branch and directory persist. Operator must `git worktree remove orchestrator/{sessionId}` manually, or implement automatic GC keyed on session-id prefix. (findings.md L593; F-064)
2. **Branch namespace collisions across sessions.** If two concurrent sessions generate the same sessionId (clock collision, weak UUID), both try to create `orchestrator/{sessionId}`. Enforce strict UUID v4 + per-session lock, or atomic-CAS branch creation. (findings.md L593; F-064)
3. **Manifest schema versioning.** The manifest is the contract between server and CLI. If manifest version changes (e.g., new capability flag), old CLI versions fail on spawn. Bump session API version and reject old CLIs, or include a backward-compat shim. (findings.md L592; F-063)
4. **50ms batching interval vs interactive latency.** 50ms window is throughput-optimized; interactive (user-facing) responses feel laggy. Use `immediateEventBypass` for critical signals (agent.error, session.abort) and consider adaptive batching by workflow-strategy (simple → 0ms; DAG → 50ms). (findings.md L590; F-065)
5. **Mode boundary enforcement.** A coordinator that calls task-execute or a worker that calls team-dispatch silently fails or races. Implement capability-gate middleware that throws `ModeCapabilityViolation` at command entry, not after task queuing. (findings.md L588; F-060)
6. **DAG topological-wave assumes acyclic input.** Validate task graph for cycles before queue init; otherwise scheduler hangs. (findings.md L589; F-061)

## 8. Validation

```bash
# 1. Four-mode enum present
grep -r "type AgentMode" src/agents/

# 2. Branch namespace confirmed
grep -r "orchestrator/{sessionId}\|sessionWorktreeBranchName" src/vcs/

# 3. Batching interval matches
grep -r "batchIntervalMs.*50" src/transport/

# 4. Manifest version pinned
grep -r 'version.*"1\.0"' src/workflows/manifest.ts

# 5. Workflow strategies enumerated
grep -A6 "type WorkflowStrategy" src/workflows/strategies.ts
```

## 9. Operational concerns

- **Upstream archival risk: low.** Patterns are absorbed in `src/agents/modes.ts`, `src/workflows/strategies.ts`, `src/transport/wsBatcher.ts`, `src/vcs/worktree.ts`. agent-maestro becomes documentation, not a blocking dependency.
- **Pattern stability**: 4-mode and 4-strategy taxonomies are stable; new strategies (e.g., adaptive scheduling) added via ADR not silent code change.
- **Ownership**: orchestrator team owns re-implementation; agent-maestro team owns upstream reference.
- **Promotion**: not applicable.
- **Disaster recovery**: patterns are sufficiently specified in findings.md L586-597 + this guide that loss of upstream does not block v1.
