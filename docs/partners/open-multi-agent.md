# Partner Integration: open-multi-agent

## 1. Why this partner

**Category: B (pattern-lift).** open-multi-agent is a TypeScript multi-agent orchestration library contributing two patterns to v6: (1) approval-gate callback signature with skip-cascade semantics → §7.2 (PolicyDecisionLayer), §24.3; (2) 4 scheduler strategies (round-robin / least-busy / capability-match / dependency-first) → §24.2.

**Gap closed**: v6 §24 specifies four scheduler strategies and a task-queue implementation. open-multi-agent's TaskQueue, Scheduler, and approval-gate callback (`onApproval(completedTasks, nextTasks) → Promise<boolean>`) are production-tested patterns directly adoptable. The skip-cascade behavior (when callback rejects, downstream blocked tasks are marked skipped, not failed) maps directly to §7.2 PolicyDecisionLayer mid-execution checks.

**Alternatives considered**: build queue/scheduler from scratch (rejected — re-implements topological sort + starvation-prevention heuristics); use Hatchet (rejected — different runtime model, see §24.7 deferred ADR).

Findings reference: `repo-extraction-findings.md` lines 598–613, §40 F-072, F-073.

## 2. Prerequisites

N/A — pattern-lift; no runtime dependency on open-multi-agent. The orchestrator implements TaskQueue + Scheduler + approval-gate logic in `src/workers/` using the patterns. (Note: if v1 chooses to vendor the npm package directly, this becomes Category A; current v6 §24 treats this as pattern-lift.)

## 3. Source provenance

open-multi-agent npm package + repository. Pin commit SHA / version in v6 §40 F-072/F-073 row. **No install required for pattern-lift**: read source for reference (TaskQueue ~469 LoC, Scheduler 4-strategy module). If vendored, install via `pnpm add open-multi-agent@<pinned>`.

## 4. Configuration

### 4.1 Environment variables

N/A — pattern-lift. Scheduler strategy and approval-gate behavior configured in orchestrator config.

### 4.2 Config file overlays

```yaml
orchestrator:
  scheduler:
    strategy: round-robin    # round-robin | least-busy | capability-match | dependency-first
    concurrency:
      poolSize: 5
      perAgentMutex: true
  approvalGate:
    enabled: true
    onApprovalSkipCascade: true   # rejected approval → cascade skip to blocked dependents
    callbackTimeoutMs: 30000
```

## 5. Adoption points in v6

- **F-072** → **§7.2 (PolicyDecisionLayer)** + **§24.3 (Approval-gate callback)**: callback signature `onApproval(completedTasks, nextTasks) → Promise<boolean>`; rejection triggers skip-cascade (mark `nextTasks` and transitive dependents as `skipped`, not `failed`).
- **F-073** → **§24.2 (4 scheduler strategies)**: round-robin (rotation), least-busy (fewest in-flight), capability-match (bidirectional keyword scoring of task requirements vs agent skills), dependency-first (sort by count of blocked dependents, descending).

## 6. Pattern excerpts

**Approval-gate callback** (`src/workers/approvalGate.ts`):
```ts
export interface ApprovalGateCallback {
  onApproval(completedTasks: Task[], nextTasks: Task[]): Promise<boolean>;
}

// Skip-cascade behavior on rejection (v6 §24.3)
queue.on("task:ready", async (tasks) => {
  const approved = await policyLayer.onApproval([], tasks);
  if (!approved) {
    queue.skipRemaining(tasks);   // mark tasks AND all dependents as skipped
  }
});
```

**Scheduler strategy selector** (`src/workers/scheduler.ts`):
```ts
export type SchedulerStrategy =
  | "round-robin"      // rotate; no starvation if loads balanced
  | "least-busy"       // assign to agent with fewest in-flight tasks
  | "capability-match" // bidirectional skill/requirement keyword scoring
  | "dependency-first";// sort by # of blocked dependents (critical-path first)

export function pickNextTask(tasks: Task[], agents: Agent[], strategy: SchedulerStrategy): Assignment {
  switch (strategy) {
    case "round-robin": return roundRobin(tasks, agents);
    case "least-busy": return leastBusy(tasks, agents);
    case "capability-match": return capabilityMatch(tasks, agents);
    case "dependency-first": return dependencyFirst(tasks, agents);
  }
}
```

## 7. Gotchas

1. **Skip-cascade vs hard-block semantics differ.** v6 §24.3 mandates skip-cascade (mark blocked tasks as `skipped`, not `failed`). Do not substitute hard-block (fail) logic without consulting PolicyDecisionLayer owners. (findings.md L600; F-072)
2. **Least-busy can starve long-running tasks.** If task A is slow and B is fast, assigning B to a second agent leaves A's dependents blocked. Use least-busy only when task duration is roughly uniform; switch to dependency-first for heterogeneous workflows. (findings.md L601; F-073)
3. **Capability-match requires bidirectional keyword registry.** Agent manifests must declare skills; task payloads must declare requirements. If registry is out-of-sync (agent promoted but manifest not updated), scoring mismatches occur and wrong agents are assigned. Validate via preflight. (findings.md L602; F-073)
4. **Dependency-first deadlocks on cycles.** The topological sort assumes a DAG. If task dependencies form a cycle, scheduler hangs. Validate task-graph acyclicity before queue init. (findings.md L603; F-073)
5. **`onApproval` callback is Promise-based.** Do not block synchronously; if PolicyDecisionLayer runs a slow check (LLM-based gate), queue processing stalls. Set `callbackTimeoutMs` (default 30s); on timeout, treat as rejection. (findings.md L604; F-072)
6. **Trace events from the queue must not throw.** If a trace callback fails, task processing halts. Wrap in try-catch and emit observability counter even on failure. (findings.md L608; F-073)

## 8. Validation

```bash
# 1. Verify §24.2 enumerates 4 scheduler strategies
grep -nE "round-robin|least-busy|capability-match|dependency-first" agent-context-orchestrator-mcp-plan-v6.md

# 2. Verify approval-gate skip-cascade semantics in §24.3
grep -nE "skip-cascade|skipRemaining" agent-context-orchestrator-mcp-plan-v6.md

# 3. Confirm orchestrator implements all 4 strategies
grep -A4 "type SchedulerStrategy" src/workers/scheduler.ts

# 4. Acyclicity check exists
grep -n "Cyclic\|isAcyclic\|topologicalSort" src/workers/taskQueue.ts

# 5. Approval callback timeout enforced
grep -n "callbackTimeoutMs" src/workers/approvalGate.ts
```

## 9. Operational concerns

- **Upstream archival risk: low.** TaskQueue, Scheduler, and approval-gate are absorbed into `src/workers/`. If open-multi-agent is archived, the patterns can be re-implemented from this guide and findings.md L598–613.
- **Promotion to Category A**: would mean adding `open-multi-agent` as a runtime dependency (npm install). This is a small, focused library and is a reasonable v2 enhancement.
- **Ownership**: orchestrator team owns integration layer (`src/workers/`), §24 queue logic, and PolicyDecisionLayer binding. open-multi-agent maintainers own upstream reference (if vendored).
- **Disaster recovery**: task queue state is ephemeral (in-memory for v1). Completed tasks recorded in audit log (v6 §30); replay from audit on restart. No persistent queue state to restore.
