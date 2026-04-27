---
title: API — MCP Tool Catalog
owner: Chris
status: accepted
last_reviewed: 2026-04-27
version: 1.1.0
audience: [engineer, integrator]
sdlc_category: 04-design
related: [agent-context-orchestrator-mcp-plan-v6.md §14, §15, docs/sdlc/04-design/module-mcp-runtime.md]
---

# API — MCP Tool Catalog

> **TL;DR:** The v1 agent-facing MCP surface is default-visible: tools, resource templates, and canonical prompts. Loopback `admin.*` tools support the control plane and are documented separately in this file where they affect UI workflows. Milestone flags remain rollback controls, so operators can hide a completed surface by setting its flag to `false`. Tool-collapse pattern (v6 §14) keeps the public surface small. Capability negotiation per v6 §2.2 advertises which tools are live.

This is the canonical tool reference. For per-tool source, see `src/mcp/tools/`.

Agent-facing tools and loopback admin tools have different audiences. The public tool catalog below is what MCP clients use for project orchestration. The admin workflow catalog later in this document is for the browser control plane served from `/ui/` over the loopback management API.

---

## Tool catalog (full)

| Tool | Milestone | Input | Output | Effect |
|---|---|---|---|---|
| `health_check` | M0 (always) | `{}` | `HealthCheckOutput` | Read-only |
| `project_preflight_check` | M2 (always) | `{ projectId, jiraProjectKeyOrId, confluenceSpaceKeyOrId, vcsWorkspace?, vcsRepoSlug?, ttlSeconds? }` | `{ profileId, projectId, warnings[] }` | Read external; persists profile |
| `project_profile_get` | M2 (always) | `{ projectId, profileId? }` | `ProjectProfile` | Read-only |
| `project_intake_create` | M4 (default on) | `{ projectId?, name, key, source }` | `{ projectId, state, sourcePins[] }` | Persists intake |
| `project_blueprint_generate` | M4 (default on) | `{ projectId, useSampling?, temperature?, maxTokens? }` | `ProjectBlueprint` | Persists blueprint |
| `project_provision_preview` | M5 (default on) | `{ projectId, jiraProjectKey, confluenceSpaceId?, vcsWorkspace?, vcsRepoSlug?, vcsBaseBranch?, actorPrincipalId }` | `{ plan: ArtifactPlan, triplet }` | Read-only (dry run) |
| `project_provision_execute` | M6a (default on) | `{ plan, approved, approvalEvidence }` | `{ jobId, jobResourceUri }` | Async; writes external when queue/providers configured |
| `context_pack_generate` | M7 (default on) | `{ projectId, issueKey? }` | `ContextPack` | Persists pack |
| `context_get` | M7 (default on) | `{ regenerationKey }` | `{ found, pack? }` | Read-only |
| `memory_retain` | Memory feature (default on) | `{ projectId, kind, text, tags?, issueKey?, sourceRefs?, agentKey? }` | `{ entry, deduped, vectorIndexed, auditEntryId }` | Persists memory + audit |
| `memory_recall` | Memory feature (default on) | `{ projectId, query?, tags?, kind?, kinds?, issueKey?, limit?, agentKey?, includeVector? }` | `AgentMemoryRecallResult` | Read-only |
| `memory_reflect` | Memory feature (default on) | `{ projectId, summary, sourceMemoryIds[], tags?, issueKey?, agentKey? }` | `{ entry, deduped, vectorIndexed, auditEntryId }` | Persists reflection + audit |
| `memory_forget` | Memory feature (default on) | `{ projectId, memoryId, reason, agentKey? }` | `{ forgotten, memoryId, auditEntryId }` | Soft-delete + audit |
| `readiness_validate` | M8 (default on) | `{ projectId }` | `ReadinessReport` | Persists report |
| `handoff_generate` | M9 (default on) | `{ projectId, issueKey, objective, acceptanceCriteria[] }` | `ManifestSpawn` | Read-only emission |
| `webhook_ingest` | M10 (default on) | `{ source, timestamp, signatureHeader, rawBody }` | `{ accepted, event? }` | Persists delivery |

## Canonical prompts

`prompts/list` returns eight v1 prompts with `_meta["orchestrator/version"]="v1"`: `project-intake-interview`, `requirements-decomposer`, `architecture-review`, `provisioning-reviewer`, `jira-story-writer`, `confluence-page-writer`, `readiness-reviewer`, and `build-agent-handoff`.

`prompts/get` renders each prompt as a single user message with supplied string arguments.

## Resource templates

`resources/templates/list` returns the public resource contract:

- `orchestrator://project/{projectId}/context`
- `orchestrator://project/{projectId}/readiness`
- `orchestrator://project/{projectId}/linked-artifacts`
- `orchestrator://issue/{issueKey}/context`
- `orchestrator://issue/{issueKey}/handoff`
- `orchestrator://issue/{issueKey}/acceptance-criteria`
- `orchestrator://issue/{issueKey}/linked-artifacts`
- `orchestrator://job/{jobId}`

Compatibility resources remain available: `orchestrator://session/current/capabilities`, `orchestrator://session/current/preflight`, and `orchestrator://jobs/recent`.

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

Generate and re-fetch context packs idempotently. When project-scoped agent memory is enabled and available for the current agent, generated packs include a bounded `agentMemory` section and a memory fingerprint in the regeneration key.

### Agent memory tools

`memory_retain`, `memory_recall`, `memory_reflect`, and `memory_forget` default on and can be rolled back with `PERSISTENT_AGENT_MEMORY_ENABLED=false`. Memory is scoped by tenant, project, and agent key. Mutating memory tools append audit entries; recall is deterministic by default and uses additive vector recall only when enabled.

### `readiness_validate`

Returns a `ReadinessReport` with the 6-category score + 4-tier verdict.

### `handoff_generate`

Emits a manifest spawn for a build agent.

### `webhook_ingest`

Internal-facing tool; called by the webhook ingress endpoint.

---

## Loopback admin role workflow tools

These tools are registered under the admin MCP registry and are intended for the control-plane UI. They are not part of the default agent-facing tool catalog.

| Tool | Input | Output | Effect |
|---|---|---|---|
| `admin.requirements.assist.preview` | `{ name, key, description, briefs? }` | Normalized markdown, suggested requirements, source counts | Read-only |
| `admin.requirements.assist.create_intake` | `{ name, key, description, briefs?, operatorBadge? }` | Project id/key/state, source pins, audit entry id | Persists project intake + audit |
| `admin.requirements.assist.generate_blueprint` | `{ projectId, useSampling?, temperature?, maxTokens?, operatorBadge? }` | Blueprint version, requirements, epics, validation, sampling, audit entry id | Persists blueprint + audit |
| `admin.requirements.assist.provision_preview` | `{ projectId?, projectKey?, jiraProjectKey? }` | Planned Jira nodes, total nodes, deterministic quality score | Read-only |
| `admin.agent.work.classify` | `{ projectId?, projectKey?, workRef }` | Work item and deterministic classification | Read-only |
| `admin.agent.work.recommend` | `{ projectId?, projectKey?, workRef }` | Classification plus ranked live/persisted agent recommendations | Read-only |
| `admin.agent.work.assign` | `{ projectId?, projectKey?, workRef, assignedAgentId, assignedBy, reason, operatorBadge? }` | Assignment record and audit entry id | Persists assignment + audit |
| `admin.agent.work.list` | `{ projectId?, projectKey? }` | Project assignments | Read-only |
| `admin.quality.score.project` | `{ projectId?, projectKey?, operatorBadge? }` | Persisted content quality report and audit entry id | Persists quality report + audit |
| `admin.quality.score.artifact` | `{ projectId?, projectKey?, artifactRef, operatorBadge? }` | Persisted content quality report and audit entry id | Persists quality report + audit |
| `admin.quality.reports.list` | `{ projectId?, projectKey? }` | Project quality reports | Read-only |

Admin role workflow tools are consumed by `#/requirements-assist`, `#/agent-assignment`, Projects panels, and Project Detail Assist/Assignments/Quality tabs. They use the same loopback admin MCP transport as the rest of the control plane and return structuredContent for UI rendering.

Security boundary: these tools are admin tools. The frontend `roleLens` does not decide whether a tool may be called.

## Tool-collapse pattern

Per v6 §14, where a family of operations exists, prefer one tool with an action enum:

- (Hypothetical) `atlassian.create({ type: "issue" | "page", ... })` would replace `jira.issue.create` + `confluence.page.create`.

Pros: smaller tool surface for the agent to reason about. Cons: fatter input schema with discriminated unions.

The catalog above already follows this pattern — `project_intake_create` accepts multiple `source.kind` values rather than having a separate tool per source.

## Capability negotiation

Per v6 §2.2, the server advertises its tool catalog at session start. The advertised set is filtered by:

- Feature flags (completed v1 tools default on; set flags false for rollback).
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
- **Admin role workflow code:** `src/mcp/admin/tools/requirementsAssist.ts`, `src/mcp/admin/tools/agentWork.ts`, `src/mcp/admin/tools/quality.ts`
- **Module:** [`module-mcp-runtime.md`](module-mcp-runtime.md)
- **Control plane role workflows:** [`control-plane-ui/role-workflows.md`](control-plane-ui/role-workflows.md)
- **Sibling:** [`api-mgmt-rest.md`](api-mgmt-rest.md), [`sequence-diagrams.md`](sequence-diagrams.md)

---

*Last reviewed: 2026-04-27 by Chris.*
