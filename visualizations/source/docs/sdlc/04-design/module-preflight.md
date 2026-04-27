---
title: Module — Preflight (Capability Discovery)
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, integrator]
sdlc_category: 04-design
related: [agent-context-orchestrator-mcp-plan-v6.md §19, §17, §22, docs/sdlc/04-design/module-providers-atlassian.md]
---

# Module — Preflight (Capability Discovery)

> **TL;DR:** Discovers what the target Atlassian + VCS instances can do — issue types, fields, workflows, storage formats, macros, branches, default permissions. Output: a structured `ProjectProfile` consumed by the planner. Cached with TTL. M2's central deliverable per v6 §19. Failures surface as warnings (non-fatal) rather than blocking unless authentication itself fails.

The preflight module is the bridge between "we have credentials" and "we know what we can do." Without it, the planner would have to assume and the executor would discover surprises mid-write. With it, surprises happen pre-write where they're cheap to handle.

---

## Purpose

Owns:
- The capability-discovery workflow (`runPreflight`).
- The `ProjectProfile` schema and emitter.
- Per-target probe sequences (Jira project, Confluence space, Bitbucket workspace + repo).
- Warning collection (non-fatal issues to surface to operators).
- TTL semantics for cached profiles (`projectProfiles` table).

Does NOT own:
- Provider HTTP itself (delegates to `src/providers/`).
- The readiness rubric (M8 separate workflow — different concern).
- Credential resolution (delegates to `tokenStore`).
- The MCP tool entry (`project_preflight_check` tool wraps this module).

---

## Public surface

| Symbol | Kind | Signature | Purpose |
|---|---|---|---|
| `runPreflight` | function | `(input: PreflightInput) => Promise<PreflightResult>` | Orchestrator entry; accepts targets, returns profile + warnings |
| `PreflightInput` | type | `{ projectId, jiraProjectKeyOrId, confluenceSpaceKeyOrId, vcsWorkspace?, vcsRepoSlug?, ttlSeconds? }` | Input shape |
| `PreflightResult` | type | `{ profileId, projectId, warnings: PreflightWarning[] }` | Return shape |
| `PreflightWarning` | type | `{ severity: "info"\|"warn"\|"error", path: string, message: string }` | Non-fatal issue |
| `ProjectProfile` | type | (re-exported from `src/domain/projectProfile.ts`) | The structured discovery output |
| `getActiveProfile` | function | `(projectId) => Promise<ProjectProfile \| null>` | Read most-recent un-expired profile |

---

## Architecture

```mermaid
graph TB
    Tool[MCP tool: project_preflight_check]
    PF[runPreflight]

    subgraph Probes["Capability probes"]
        JiraP[Jira: types, fields, workflows]
        ConfP[Confluence: storage formats, macros, templates]
        VcsP[Bitbucket: repo + branches + PRs]
    end

    Auth[Token store + auth]
    HttpClients[Provider HTTP clients]
    Profile[ProjectProfile]
    Storage[(projectProfiles)]
    Warnings[Warnings []]

    Tool --> PF
    PF --> Auth
    PF --> JiraP
    PF --> ConfP
    PF --> VcsP
    JiraP --> HttpClients
    ConfP --> HttpClients
    VcsP --> HttpClients
    JiraP --> Profile
    ConfP --> Profile
    VcsP --> Profile
    JiraP --> Warnings
    ConfP --> Warnings
    VcsP --> Warnings
    Profile --> Storage
```

The probes run in parallel — each provider has its own HTTP client with retry, and the workflow gathers their outputs into a single profile.

---

## Key flows

### Run preflight

End-to-end:

1. **Validate inputs.** Targets must be non-empty; conditional fields (Bitbucket) only required if VCS path enabled.
2. **Resolve credentials** for each target via `tokenStore`. Fail fast if creds missing for a target the operator asked about.
3. **Run probes in parallel:**
   - Jira: project info, issue types, custom fields, workflow scheme, permissions for actor.
   - Confluence: space info, content templates, supported body formats (ADF + storage), available macros.
   - VCS: workspace, repo, default branch, PR settings, branch-protection rules.
4. **Compose `ProjectProfile`** from probe outputs.
5. **Persist** with `expires_at = now + ttlSeconds` (default 24h).
6. **Return** profile + warnings.

Per [`sequence-diagrams.md`](sequence-diagrams.md) — "Preflight against Jira" diagram.

### TTL and refresh

- Default TTL: 86,400 seconds (24h). Configurable per call.
- Re-running preflight against the same target produces a NEW profile row (not an update). Idempotency at the read side: `getActiveProfile` returns the most recent un-expired.
- Permission webhooks (M10+) invalidate ACL caches AND can mark profiles stale (forcing refresh on next planner run).

### Warning collection

Probes can succeed AND surface warnings. Examples:

- "Jira project uses a custom workflow with non-standard transition `_REOPENED`; planner will need to handle this."
- "Confluence space has macros not in the supported set; provisioning may fail for pages requiring those macros."
- "Bitbucket repo's default branch is `master` not `main`; planner will use `master`."
- "Operator account lacks `BROWSE_PROJECTS` on a sub-project; that sub-project is omitted."

Warnings are returned to the operator + recorded in the audit chain. They don't block; they inform.

---

## Data model

### `ProjectProfile` (domain type)

Composed from:

- `tenantScope`: `TenantScope` (single-tenant default in v1).
- `jira`: `JiraCapabilities` — project type, issue types[], custom fields[], workflows[], etc.
- `confluence`: `ConfluenceCapabilities` — space info, supported body formats, macro inventory.
- `vcs?`: `VcsCapabilities` — workspace + repo + branches + PR settings (optional).
- `discoveredAt`: timestamp.
- `expiresAt`: timestamp (TTL boundary).

Full shape in [`../05-data/domain-model.md`](../05-data/domain-model.md) and the source at `src/domain/projectProfile.ts`.

### Storage

Persisted in `projectProfiles` (per [`../05-data/schema.md`](../05-data/schema.md)). Multiple rows per project are normal (one per discovery run); `getActiveProfile` resolves the most-recent un-expired.

---

## Configuration

Inherits from the application's general config. Specific to preflight:

| Setting | Where | Default | Purpose |
|---|---|---|---|
| Default TTL | code constant | 86400 (24h) | Profile retention |
| Per-call TTL override | tool input | — | Operator-specified |
| Probe parallelism | code constant | 3 (Jira, Confluence, VCS in parallel) | Workflow speed |
| Per-probe timeout | from HTTP retry config | 30s per attempt | Bound discovery time |

These are mostly internals; operators don't tune them unless capacity-planning for unusual sizes.

---

## Failure modes

### Auth failure (any target)

**Symptom:** the probe returns 401 or auth-related error.

**Action:** preflight returns an error result; no profile written. Operator rotates credentials per [`../06-security/token-storage.md`](../06-security/token-storage.md) "Rotation per-token."

**Audit:** the auth failure is audited; the operator's call is recorded.

### Partial discovery

**Symptom:** one or more probes succeed, others fail (e.g., Jira works, Confluence rate-limited).

**Action:** preflight returns a profile with the successful sections + warnings for the failed ones. Planner decides whether the partial profile is usable.

**Audit:** each warning is audited.

### Rate limit during discovery

**Symptom:** 429 from a provider; retry layer backs off.

**Action:** retry layer handles up to 3 attempts. If exhausted, that probe returns partial-with-warning.

**Audit:** the rate-limit event is audited.

### Stale profile referenced

**Symptom:** planner uses a profile whose `expires_at` is past.

**Action:** planner detects + triggers re-run of preflight. Operator-visible.

**Audit:** the staleness detection is audited.

### Permission boundary mismatch

**Symptom:** the operator's credentials work but lack permissions for some sub-resource (e.g., a custom field that requires admin to read).

**Action:** that sub-resource is omitted from the profile + a warning emitted.

**Audit:** the permission gap is audited.

---

## Test surface

| Test | Path | What it proves |
|---|---|---|
| Preflight integration | `tests/integration/preflight.test.ts` | End-to-end against mocked Atlassian; profile shape correct |
| Confluence REST live | `tests/integration/providers/confluenceRestProvider.test.ts` | Real Atlassian read path (gated by `RUN_LIVE_TESTS=1`) |
| Bitbucket REST live | `tests/integration/providers/vcs/bitbucketRestProvider.test.ts` | Real Bitbucket read path (gated) |
| Provider HTTP retry | `tests/unit/providers/http/retry.test.ts` | Backoff under 429 |
| Pagination | `tests/unit/providers/http/restClient.test.ts` | Cursor-based pagination over large result sets |

Coverage gaps:
- **OAuth 3LO refresh race during discovery** (PCO-59): not yet integration-tested.
- **Permission edge cases** (operator with limited scope): partial coverage.
- **Confluence v2 API representation bug** (F-13 in audit findings): caught in seed-confluence script; needs a regression test.

---

## Concurrency

- Per-request: probes run in parallel within a single preflight call.
- Cross-request: multiple operators can run preflight on different projects concurrently. Same project: PHASE-STATE.json (v6 §6.1) doesn't directly apply because preflight is read-only; the planner serializes for write paths.
- Cache: the `projectProfiles` table is naturally concurrency-safe (each call gets a new row).

---

## Performance characteristics

| Operation | Typical | p99 target |
|---|---|---|
| Full preflight (Jira + Confluence + VCS) | 2–4 s | < 5 s |
| Cached profile read (`getActiveProfile`) | < 5 ms | < 50 ms |
| Per-probe latency | 500–1500 ms | < 3 s |

Performance is dominated by the slowest provider call. Atlassian / Bitbucket sandbox latency varies; production deployments see consistent patterns and the SLO targets reflect that.

---

## Tradeoffs

### Run probes in parallel vs. sequentially

**Chose:** parallel.

**Pro:** faster end-to-end discovery (3 s vs. 6+ s sequential).

**Con:** harder to reason about partial failures; one probe failing while others succeed produces a hybrid result.

**Mitigation:** explicit warning model handles partial failures cleanly.

### Persist profile vs. always-fresh

**Chose:** persist with TTL.

**Pro:** planner sees stable input across multiple invocations within the TTL window.

**Con:** TTL management; profiles can be stale.

**Mitigation:** permission webhooks invalidate; planner can force refresh.

### Probe depth vs. surface

**Chose:** probe shallow + comprehensively across all surfaces.

**Pro:** profile covers what the planner needs without exhaustive feature exploration.

**Con:** some edge-case features (rare custom fields, rare macros) might not be discovered.

**Mitigation:** discovered as planner attempts to use them; surfaces as a future preflight enhancement.

---

## Roadmap

- **M2:** module is largely complete; remaining work is end-to-end with the planner consuming profiles.
- **M11 hardening:** rate-limit awareness baked into the orchestrator's discovery cadence; profile freshness signals into the readiness rubric.
- **PCO-58, PCO-59:** open bugs (ADF round-trip + OAuth refresh race).

---

## Linked artifacts

- **Spec:** v6 §19 (provider interfaces), §17.5 (issue-level readiness uses profile), §22 (transport)
- **Code:** `src/preflight/preflightWorkflow.ts`, `src/domain/projectProfile.ts`
- **Schema:** [`../05-data/schema.md`](../05-data/schema.md) `projectProfiles` table
- **Sibling modules:** [`module-providers-atlassian.md`](module-providers-atlassian.md), [`module-providers-vcs.md`](module-providers-vcs.md), [`module-storage.md`](module-storage.md)
- **API tool:** [`api-mcp-tools.md`](api-mcp-tools.md) (`project_preflight_check`)
- **Tests:** `tests/integration/preflight.test.ts`, `tests/integration/providers/...`
- **Tracking:** PCO-58 (ADF round-trip), PCO-59 (OAuth refresh race)

---

*Last reviewed: 2026-04-25 by Chris.*
