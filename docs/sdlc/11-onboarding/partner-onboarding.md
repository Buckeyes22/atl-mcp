---
title: Partner Onboarding
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [integrator]
sdlc_category: 11-onboarding
related: [docs/partners/, docs/build-orchestration.md]
---

# Partner Onboarding

> **TL;DR:** "Partner" = a team adopting atl-mcp to seed their own engineering project. This guide walks the partner team through: profile authoring, preflight, blueprint review, provisioning approval, handoff to build agents. v1 is operator-driven (no self-serve); the partner team works with an atl-mcp operator at kickoff.

For developers: see [`developer-setup.md`](developer-setup.md). For MCP-host integrators: see [`integrator-guide.md`](integrator-guide.md). For operators running atl-mcp: see [`operator-guide.md`](operator-guide.md).

---

## What "partner" means here

A team using atl-mcp to bootstrap a new engineering initiative. They:

- Provide the requirements (markdown / UIO doc / prose).
- Approve the blueprint.
- Approve the provisioning plan.
- Inherit the resulting Jira project + Confluence space + Bitbucket scaffolding.
- Their build agents (Claude Code / Cursor / etc.) consume the orchestrator's MCP context to implement stories.

Distinct from:

- **Atlassian / Bitbucket vendors** — they provide the underlying systems.
- **Partner-integration-guide partners** — the 42 docs in [`docs/partners/`](../../partners/) that document patterns we adopt. Different "partner."

## Onboarding flow

### 1. Pre-kickoff

| What | Who | Time |
|---|---|---|
| Decide scope (Jira + Confluence + Bitbucket targets) | Partner team + operator | Async |
| Provision Atlassian + Bitbucket workspaces | Partner team's admin | Hours |
| Provision API tokens / app passwords for atl-mcp | Partner team's admin | Minutes |
| Operator seals tokens in atl-mcp's token store | Operator | Minutes |

### 2. Intake

Partner team provides requirements:

```jsonc
// Example call (via mgmt REST or MCP tool)
{
  "name": "Billing System Refactor",
  "key": "BILL",
  "source": {
    "kind": "raw_markdown",
    "content": "# Billing System Refactor\n\n## Goals\n..."
  }
}
```

Or via UIO if the requirements are stored in a UIO partner:

```jsonc
{
  "name": "Billing System Refactor",
  "key": "BILL",
  "source": {
    "kind": "uio_document",
    "documentId": "uio:doc:abc-123"
  }
}
```

### 3. Preflight

Operator runs `project_preflight_check`. The output (`ProjectProfile`) describes what the target Atlassian project + Confluence space + Bitbucket repo support.

If preflight surfaces warnings, the partner team's admin reviews:

- Missing custom fields → add to Jira.
- Confluence space using unsupported macros → adjust template or add to allow list.
- Bitbucket workspace permissions insufficient → grant.

### 4. Blueprint

Operator runs `project_blueprint_generate`. The blueprint includes:

- Epic plan with rationale.
- Stories with acceptance criteria.
- Architecture summary.
- Security / privacy notes (which fields are PRIVATE).
- Testing strategy.
- Release plan.

Partner team reviews:

- Are the epics + stories the right scope?
- Are acceptance criteria specific enough?
- Are there missing concerns (compliance, performance, etc.)?

If revisions: amend the intake; re-generate blueprint. (Adversarial verification triplet runs each time.)

### 5. Provisioning preview

Operator runs `project_provision_preview`. Output: an `ArtifactPlan` with:

- Jira issues to create / update (with idempotency keys).
- Confluence pages to write.
- Bitbucket branches + PR scaffolding.

Partner team reviews — this is the last stop before real writes.

### 6. Approval + execution

Partner team or operator approves. Operator runs `project_provision_execute` with the approval evidence. Returns a `jobId`.

The job runs async. Partner team can poll status. On completion: artifacts exist in Jira / Confluence / Bitbucket.

### 7. Readiness validation

Operator runs `readiness_validate`. Output: `ReadinessReport` with grade A–F and 4-tier verdict.

Anything below "Ready" needs remediation before handoff.

### 8. Handoff

Operator runs `generateHandoff` for each story being assigned to a build agent. Each handoff is a manifest the build agent consumes.

Partner team's build agents now run against the workspace.

### 9. Steady state

The orchestrator listens for webhooks; updates project graph; surfaces drift. Partner team interacts with the workspace via Jira / Confluence / Bitbucket as usual. atl-mcp doesn't get in the way.

## Common questions

### Can we modify the blueprint manually?

Yes. The blueprint is just data; you can edit it before provisioning. The orchestrator preserves your edits on re-runs (idempotent execution).

### What if we want to add a story later?

Two options:

1. **Operator-mediated:** add to the intake, re-generate blueprint, re-plan, execute. Idempotent — only the new story gets created.
2. **Direct:** create the issue in Jira normally. The orchestrator's webhook ingestion picks it up; on next blueprint re-generation, it's reflected.

### What if the build agent makes a mistake?

The audit chain records every operation. The build agent's writes flow through the same audit + policy layers. Bad writes are reverted via Jira / Bitbucket UIs as usual.

### What if we want to retire / archive the project?

Operator transitions state to `ARCHIVED`. The orchestrator stops syncing webhooks for that project. Data is retained per [`../05-data/retention.md`](../05-data/retention.md).

### What are the limits?

See [`../03-requirements/nfr-scalability.md`](../03-requirements/nfr-scalability.md) and [`../15-capacity/current-limits.md`](../15-capacity/current-limits.md). v1 supports ~100 active projects per instance.

## What partners need to provide

| Item | Detail |
|---|---|
| Atlassian project key | Existing or freshly created |
| Confluence space key | Existing or freshly created |
| Bitbucket workspace + repo (optional) | If using VCS provisioning |
| API token / OAuth client | Auth for atl-mcp to act |
| Requirements content | Markdown or UIO-stored |
| Build-agent host config | If consuming context via MCP |

## What partners do NOT need to do

- Operate atl-mcp themselves (operator does).
- Understand the audit chain mechanics (it just works).
- Configure the policy layer (operator does).
- Deal with secret rotation (operator does).

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Preflight fails with 401 | Token expired / wrong | Re-issue + re-seal |
| Preflight reports missing capabilities | Atlassian admin hasn't enabled them | Configure Atlassian first |
| Blueprint rejected by adversarial triplet | Intake too vague / contradictory | Edit intake |
| Provisioning execute fails partway | Transient upstream issue | Re-run; idempotent |
| Build agent gets weird context | Classification mis-tagged | Operator adjusts redaction |

## Linked artifacts

- **API:** [`../04-design/api-mcp-tools.md`](../04-design/api-mcp-tools.md)
- **Sibling onboarding:** [`developer-setup.md`](developer-setup.md), [`operator-guide.md`](operator-guide.md), [`integrator-guide.md`](integrator-guide.md), [`glossary-quick.md`](glossary-quick.md)
- **Spec:** v6 §5 (core flow), §17 (readiness)
- **Build sequence:** [`../../build-orchestration.md`](../../build-orchestration.md)

---

*Last reviewed: 2026-04-25 by Chris.*
