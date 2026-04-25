# Partner Integration: mengram

## 1. Why this partner

**Category: B (pattern-lift).** mengram is a Python AI memory system contributing the proactive resource-pinning pattern:

- **F-053**: Proactive resource pinning (`memory://profile` auto-load) → §2 (`orchestrator://session/current/preflight`), §14

**Gap closed**: v6 §2 specifies that the orchestrator adopts proactive resource pinning for session metadata. mengram demonstrates a working implementation (auto-pinned `memory://profile` cognitive resource) and validates the cost trade-off — lower latency on first tool call vs bandwidth cost at session start.

**Alternatives considered**: lazy fetch on first tool call (adds round-trip latency); explicit client request (requires client knowledge of available resources). Proactive pinning beats both when clients support subscriptions.

Findings reference: `repo-extraction-findings.md` lines 514–522, §40 F-053.

## 2. Prerequisites

N/A — pattern-lift; no runtime dependency on mengram.

## 3. Source provenance

`mengram` reference repository (Python). Pin commit SHA in v6 §40 F-053 row. **No install required**; pattern absorbed into v6 §2 + §14 + `src/resources/proactivePinning.ts`.

## 4. Configuration

### 4.1 Environment variables

N/A — pattern-lift.

### 4.2 Config file overlays

```yaml
resources:
  proactivePinning:
    enabled: true
    pinnedOnInit:
      - "orchestrator://session/current/preflight"
    refreshOn:
      - "project_preflight_check.completed"
      - "webhook.profile_change"
```

## 5. Adoption points in v6

- **F-053** → **§2** (`orchestrator://session/current/preflight` is auto-pinned at session initialize when client negotiates `proactiveResourcePinning: true` capability) + **§14** (resource URI scheme + subscription model: server pushes `notifications/resources/updated` on state change instead of clients polling)

## 6. Pattern excerpts

**Resource URI scheme** (mengram → orchestrator mapping):
| mengram | orchestrator equivalent |
|---|---|
| `memory://profile` (auto-pinned) | `orchestrator://session/current/preflight` (auto-pinned) |
| `memory://recent` | `orchestrator://session/current/capabilities` (on subscription) |
| `memory://entity/{name}` | `orchestrator://project/{projectId}/profile` (on demand) |

**Proactive pin flow**:
```
Client connects → negotiates capabilities { proactiveResourcePinning: true }
              → server pins orchestrator://session/current/preflight immediately
              → preflight refreshes on state change (preflight.completed | webhook event)
              → client receives notifications/resources/updated without polling
```

**Lazy fallback** (when client lacks subscription support):
```
Client connects → calls project_profile_get on first tool invocation
              → round-trip latency added
```

## 7. Gotchas

1. **Auto-load timing race: first tool call may fire before preflight pin completes.** If client invokes a tool requiring preflight state before the proactive-pin response lands, tool must either block (with short 100ms timeout) or fall back to on-demand fetch. mengram masks this via episodic backfill. (findings.md L516; F-053)
2. **Resource URI namespace collision risk.** If a future partner introduces `orchestrator://session/current/*` resources, namespace coordination is required. Document reserved prefixes in v6 §40 F-053 row or an ADR. (findings.md L516; F-053)
3. **Proactive pinning does not mean stale-cached.** Resource must have refresh cadence and respect webhook state changes. mengram's `memory://profile` is pinned but re-computed on procedure evolution. v6's preflight is re-pinned on `project_sync` or webhook ingestion. Clients must not assume the pin is immutable. (findings.md L517; F-053)
4. **Bandwidth cost on session start.** Sending full `ProjectProfile` summary on every new session is expensive for large projects (thousands of issues). Configure via `sessionPreflight: true` (v6 §20 optional override). For bandwidth-constrained clients, disable proactive pinning and fetch on demand. (findings.md L514; F-053)

## 8. Validation

```bash
# 1. Verify v6 §2 documents the resource URI
grep -nE "orchestrator://session/current/preflight|proactive resource pinning" agent-context-orchestrator-mcp-plan-v6.md | head -5

# 2. Verify §14 references proactive pinning
grep -n "proactive\|resource subscription" agent-context-orchestrator-mcp-plan-v6.md | head -5

# 3. Smoke: connect client with proactiveResourcePinning capability
orchestrator cli session test --capability proactiveResourcePinning
# Expect: server pushes resources/updated for orchestrator://session/current/preflight on init
```

## 9. Operational concerns

- **Upstream archival risk: low.** mengram is reference-only; pattern absorbed into v6 §2 + §14 + `src/resources/proactivePinning.ts`. If mengram archived, no impact.
- **In-tree absorption**: pin/refresh logic in `src/resources/proactivePinning.ts`; resource URI registry in `src/resources/registry.ts`.
- **Promotion**: not applicable — orchestrator owns implementation.
- **Conformance review per orchestrator minor version**: confirm proactive-pinning capability still negotiable + reserved URI namespace not collided with future partners.
