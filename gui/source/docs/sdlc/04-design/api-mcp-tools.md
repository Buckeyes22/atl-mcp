---
title: API — MCP Tool Catalog
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, integrator]
sdlc_category: 04-design
related: [agent-context-orchestrator-mcp-plan-v6.md §14, §15, docs/sdlc/04-design/module-mcp-runtime.md]
---

# API — MCP Tool Catalog

> **TL;DR:** 12 tools, milestone-gated. Each has a Zod-validated input schema, a typed output, and a feature flag that controls availability. Tool-collapse pattern (v6 §14) keeps the surface small. Capability negotiation per v6 §2.2 advertises which tools are live.

This is the canonical tool reference. For per-tool source, see `src/mcp/tools/`.

---

## Tool catalog (full)

| Tool | Milestone | Input | Output | Effect |
|---|---|---|---|---|
| `health_check` | M0 (always) | `{}` | `HealthCheckOutput` | Read-only |
| `project_preflight_check` | M2 (always) | `{ projectId, jiraProjectKeyOrId, confluenceSpaceKeyOrId, vcsWorkspace?, vcsRepoSlug?, ttlSeconds? }` | `{ profileId, projectId, warnings[] }` | Read external; persists profile |
| `project_profile_get` | M2 (always) | `{ projectId, profileId? }` | `ProjectProfile` | Read-only |
| `project_intake_create` | M4 (gated) | `{ projectId?, name, key, source }` | `{ projectId, state, sourcePins[] }` | Persists intake |
| `project_blueprint_generate` | M4 (gated) | `{ projectId, useSampling?, temperature?, maxTokens? }` | `ProjectBlueprint` | Persists blueprint |
| `project_provision_preview` | M5 (gated) | `{ projectId, jiraProjectKey, actorPrincipalId }` | `{ plan: ArtifactPlan, triplet }` | Read-only (dry run) |
| `project_provision_execute` | M6a (gated) | `{ plan, approved, approvalEvidence }` | `{ jobId, jobResourceUri }` | Async; writes external |
| `context_pack_generate` | M7 (gated) | `{ projectId, issueKey? }` | `ContextPack` | Persists pack |
| `context_get` | M7 (gated) | `{ regenerationKey }` | `{ found, pack? }` | Read-only |
| `readiness_validate` | M8 (gated) | `{ projectId }` | `ReadinessReport` | Persists report |
| `generateHandoff` | M9 (gated) | `{ projectId, issueKey, objective, acceptanceCriteria[] }` | `ManifestSpawn` | Read-only emission |
| `ingestWebhook` | M10 (gated) | `{ source, timestamp, signatureHeader, rawBody }` | `{ accepted, event? }` | Persists delivery |

## Per-tool detail

### `health_check`

Always-on diagnostic.

```json
{ "name": "health_check", "arguments": {} }
```

Returns:

```json
{
  "status": "healthy",
  "version": "0.1.0",
  "uptime": 12345,
  "activeSessions": 3,
  "transportModes": ["stdio", "http"]
}
```

### `project_preflight_check`

Discovers Atlassian + VCS capabilities; produces a `ProjectProfile`.

```json
{
  "name": "project_preflight_check",
  "arguments": {
    "projectId": "abc-123",
    "jiraProjectKeyOrId": "PCO",
    "confluenceSpaceKeyOrId": "ACO",
    "vcsWorkspace": "lateapexllc",
    "vcsRepoSlug": "atl-mcp",
    "ttlSeconds": 86400
  }
}
```

Returns the full `ProjectProfile` (per [`../05-data/domain-model.md`](../05-data/domain-model.md)) plus warnings array.

### `project_intake_create`

Captures raw markdown / UIO file as a `ProjectIntake`.

```json
{
  "name": "project_intake_create",
  "arguments": {
    "name": "Billing System",
    "key": "BILL",
    "source": { "kind": "raw_markdown", "content": "# Billing\n..." }
  }
}
```

Source kinds: `raw_markdown` | `uio_document` | `uio_file_upload`.

### `project_blueprint_generate`

Turns intake into a normalized `ProjectBlueprint` via MCP sampling.

```json
{
  "name": "project_blueprint_generate",
  "arguments": {
    "projectId": "abc-123",
    "useSampling": true,
    "temperature": 0.2
  }
}
```

Sampling provider chain: seat-based first (operator's host), API-key fallback (per v6 §23.1).

### `project_provision_preview`

Dry-run plan against live state. No writes.

```json
{
  "name": "project_provision_preview",
  "arguments": {
    "projectId": "abc-123",
    "jiraProjectKey": "BILL",
    "actorPrincipalId": "..."
  }
}
```

Returns the `ArtifactPlan` and the adversarial-triplet results.

### `project_provision_execute`

Executes an approved plan. Async — returns a job ID.

```json
{
  "name": "project_provision_execute",
  "arguments": {
    "plan": { /* ArtifactPlan */ },
    "approved": true,
    "approvalEvidence": { "approver": "...", "ts": "..." }
  }
}
```

### `context_pack_generate` / `context_get`

Generate and re-fetch context packs idempotently.

### `readiness_validate`

Returns a `ReadinessReport` with the 6-category score + 4-tier verdict.

### `generateHandoff`

Emits a manifest spawn for a build agent.

### `ingestWebhook`

Internal-facing tool; called by the webhook ingress endpoint.

---

## Tool-collapse pattern

Per v6 §14, where a family of operations exists, prefer one tool with an action enum:

- (Hypothetical) `atlassian.create({ type: "issue" | "page", ... })` would replace `jira.issue.create` + `confluence.page.create`.

Pros: smaller tool surface for the agent to reason about. Cons: fatter input schema with discriminated unions.

The catalog above already follows this pattern — `project_intake_create` accepts multiple `source.kind` values rather than having a separate tool per source.

## Capability negotiation

Per v6 §2.2, the server advertises its tool catalog at session start. The advertised set is filtered by:

- Feature flags (only enabled-milestone tools advertised).
- Session-declared capabilities (some tools require `sampling: true`).

Clients see only tools they can use.

## Schema sources

Each tool's input/output schemas live in:

- Input: `src/mcp/tools/<tool>.ts` (Zod schema).
- Output: typed return; often a domain type from `src/domain/`.

For full Zod schema text, read the source.

## Linked artifacts

- **Spec:** v6 §14 (MCP surface), §15 (tool schema example), §2.2 (capability negotiation), §23 (sampling)
- **Code:** `src/mcp/tools/`, `src/mcp/registerTools.ts`
- **Module:** [`module-mcp-runtime.md`](module-mcp-runtime.md)
- **Sibling:** [`api-mgmt-rest.md`](api-mgmt-rest.md), [`sequence-diagrams.md`](sequence-diagrams.md)

---

*Last reviewed: 2026-04-25 by Chris.*
