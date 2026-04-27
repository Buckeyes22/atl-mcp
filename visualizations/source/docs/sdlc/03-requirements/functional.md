---
title: Functional Requirements
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, executive, integrator]
sdlc_category: 03-requirements
related: [agent-context-orchestrator-mcp-plan-v6.md §5, §28, docs/build-orchestration.md]
---

# Functional Requirements

> **TL;DR:** Capabilities by milestone. Each requirement is a verifiable user-visible behavior, scoped to a milestone, with acceptance criteria. The full set lives in v6 §5 (core user flow) and §28 (milestones); this doc consolidates and deduplicates for navigability.

Atomic requirements are written in the form: **"As a [role], I can [action] so that [outcome]."** Each is gated by an acceptance test.

---

## Core user flow (v6 §5)

The orchestrator's reason for being. The flow is:

```
Operator submits a project profile
  → Preflight discovers Atlassian + VCS capabilities
  → Blueprint workflow drafts an epic+story plan
  → Provisioning planner produces an idempotent action list
  → Operator reviews + approves
  → Executor writes to Atlassian + Bitbucket
  → Context packs become available for build agents
  → Readiness rubric validates handoff readiness
  → Build agent consumes context, implements stories
  → Webhook ingestion keeps state current
```

Each transition has functional requirements; they map to milestones.

---

## Milestone 0 — Scaffold

- **FR-0.1**: As an operator, I can start the orchestrator process and reach `/healthz` returning 200.
- **FR-0.2**: As an MCP client, I can connect via stdio and complete capability negotiation.
- **FR-0.3**: As an MCP client, I can connect via Streamable HTTP and complete capability negotiation.
- **FR-0.4**: As an operator, I can build a Docker image from the repo.
- **FR-0.5**: As a developer, the build fails if any `console.*` reference exists in `src/`.

Acceptance: `tests/integration/mgmtApi.test.ts`, `tests/lint/no-stdout.test.ts`, MCP capability handshake exercised in `tests/unit/sessionCapabilities.test.ts`.

## Milestone 1 — Domain + storage

- **FR-1.1**: As the orchestrator, I can persist a `ProjectBlueprint` and read it back identically.
- **FR-1.2**: As the orchestrator, I can apply schema migrations idempotently.
- **FR-1.3**: As the orchestrator, I can rehearse a migration against a prod-shaped snapshot before applying to production.
- **FR-1.4**: As the orchestrator, I can seal a token in `encryptedTokens` and decrypt it for outbound calls.
- **FR-1.5**: As the orchestrator, every state change appends a hash-chained, signed entry to `auditEntries`.
- **FR-1.6**: As an auditor, I can verify the chain offline.

Acceptance: `tests/integration/storage/*.test.ts`, `tests/unit/security/tokenEncryption.test.ts`, audit verifier (M11).

## Milestone 2 — Atlassian providers + capability discovery

- **FR-2.1**: As the orchestrator, I can authenticate to Atlassian via API token OR OAuth 3LO.
- **FR-2.2**: As an operator, the `project_preflight_check` MCP tool discovers Jira capabilities (issue types, fields, workflows) and persists a `ProjectProfile`.
- **FR-2.3**: As an operator, the same tool discovers Confluence capabilities (storage format support, macro inventory).
- **FR-2.4**: As the orchestrator, I retry on Atlassian 429 with exponential backoff up to 3 attempts.
- **FR-2.5**: As an operator, the `project_profile_get` MCP tool returns the most recent profile or a specific one by id.

Acceptance: `tests/integration/preflight.test.ts`, `tests/integration/providers/confluenceRestProvider.test.ts` (live, gated).

## Milestone 3 — VCS provider (Bitbucket)

- **FR-3.1**: As the orchestrator, I can authenticate to Bitbucket via app password.
- **FR-3.2**: As the orchestrator, I can list repos, branches, commits, PRs in a Bitbucket workspace.
- **FR-3.3**: As the orchestrator, I can manage per-session worktrees safely under concurrency.
- **FR-3.4**: As the orchestrator, I verify webhook signatures (HMAC-SHA256) before parsing the body.

Acceptance: `tests/integration/providers/vcs/*.test.ts`, `tests/unit/security/webhookSignatures.test.ts`.

## Milestone 4 — Blueprint workflow with sampling

- **FR-4.1**: As an operator, the `project_intake_create` MCP tool captures raw markdown OR UIO-stored content as a `ProjectIntake`.
- **FR-4.2**: As an operator, the `project_blueprint_generate` MCP tool turns intake into a `ProjectBlueprint` via MCP sampling.
- **FR-4.3**: As the orchestrator, blueprint outputs pass an adversarial verification triplet (v6 §18.1) before persisting.
- **FR-4.4**: As an operator, blueprint failures surface with specific reasons (which validation rule failed).

Acceptance: `tests/unit/validators/blueprintValidator.test.ts`, `tests/unit/workflows/blueprintWorkflow.test.ts`.

## Milestone 5 — Provisioning planner

- **FR-5.1**: As an operator, the `project_provision_preview` MCP tool produces an idempotent action list against a `ProjectBlueprint`.
- **FR-5.2**: As an operator, the preview includes the dry-run delta (what changes, what's already there) without writing.
- **FR-5.3**: As the orchestrator, I serialize concurrent planning operations on the same project (PHASE-STATE.json per v6 §6.1).

Acceptance: integration tests against a mocked Atlassian + Bitbucket; planner-vs-live comparison.

## Milestone 6a — Jira executor (first shippable slice)

- **FR-6a.1**: As an operator, the `project_provision_execute` MCP tool writes the approved Jira plan to a real Jira project.
- **FR-6a.2**: As the orchestrator, executor writes are idempotent — running the same plan twice produces no extra issues.
- **FR-6a.3**: As an auditor, every Jira write generates an audit entry with the actor, operation, and outcome.
- **FR-6a.4**: As an operator, partial failures (e.g., issue 5 of 10 fails) leave the system in a state where a re-run completes the remaining 5 without re-creating the first 4.

Acceptance: `tests/integration/...` end-to-end against a sandbox Jira (when wired).

## Milestone 6b — Confluence executor

- **FR-6b.1**: As an operator, the executor writes Confluence pages from the blueprint.
- **FR-6b.2**: As the orchestrator, pages are written in ADF by default, storage format on flag (per ADR-0003).
- **FR-6b.3**: As the orchestrator, each page write generates an audit entry.

Acceptance: integration tests; live tests gated.

## Milestone 6c — VCS executor

- **FR-6c.1**: As an operator, the executor creates branches and the agent-context manifest in Bitbucket.
- **FR-6c.2**: As the orchestrator, an initial PR is opened with the agent-context manifest.
- **FR-6c.3**: As the orchestrator, worktree per session prevents concurrent provisioning conflicts.

Acceptance: integration tests; live tests gated.

## Milestone 7 — Context resources + packs

- **FR-7.1**: As a build agent, I can request a context pack via `context_pack_generate` and receive a token-budgeted, redacted document.
- **FR-7.2**: As a build agent, I can re-fetch a generated pack via `context_get` using the regeneration key (idempotent).
- **FR-7.3**: As the orchestrator, context packs respect the data classification policy (PRIVATE / SECRET fields are redacted).

Acceptance: planned tests; M7 work.

## Milestone 8 — Readiness validation

- **FR-8.1**: As an operator, the `readiness_validate` MCP tool returns a deterministic 6-category score per v6 §17.1.
- **FR-8.2**: As an operator, the same tool returns an LLM-judged 4-tier verdict per v6 §17.2.
- **FR-8.3**: As an operator, the readiness report identifies blocked-vs-ready issues with specific reasons.

Acceptance: planned tests; M8 work.

## Milestone 9 — Agent handoff

- **FR-9.1**: As the orchestrator, `generateHandoff` emits a manifest spawn for a build agent with all required context.
- **FR-9.2**: As a build agent, I can consume the manifest and begin work without further orchestrator interaction (until resource subscriptions update).

Acceptance: planned tests; M9 work.

## Milestone 10 — Webhook ingestion

- **FR-10.1**: As the orchestrator, incoming Atlassian / Bitbucket webhooks are signature-verified before processing.
- **FR-10.2**: As the orchestrator, duplicate deliveries (same `(source, deliveryId)`) are idempotent.
- **FR-10.3**: As the orchestrator, webhook events translate into normalized graph change events.
- **FR-10.4**: As an MCP client, I can subscribe to resource changes and receive events asynchronously.

Acceptance: planned tests; M10 work.

## Milestone 11 — Notifications, evals, hardening

- **FR-11.1**: As an operator, eval-view verdicts gate releases (per v6 §31.1).
- **FR-11.2**: As an operator, the audit-chain verifier runs on a schedule and surfaces failures.
- **FR-11.3**: As the orchestrator, full observability (logs + metrics + traces + audit-trace) is wired and consistent.

Acceptance: planned tests; M11 work.

---

## Cross-cutting requirements

These apply across all milestones:

- **CR-1: No write to stdout from `src/`.** Enforced by lint.
- **CR-2: No production code without a failing test first.** Enforced by review.
- **CR-3: Every state change is audited.** Enforced by review + tests on each executor.
- **CR-4: Operations fail closed when audit chain unavailable.** Enforced in code path + tested.
- **CR-5: Single-tenant scope checks at every storage write.** Enforced by `assertTenantMatches` pattern.

These are non-negotiable; violation is a defect.

## Linked artifacts

- **Spec:** v6 §5 (core user flow), §28 (milestones)
- **Build sequence:** [`../../build-orchestration.md`](../../build-orchestration.md)
- **Module designs:** [`../04-design/`](../04-design/)
- **Sibling NFR docs:** [`nfr-availability.md`](nfr-availability.md), [`nfr-performance.md`](nfr-performance.md), [`nfr-security.md`](nfr-security.md), [`nfr-scalability.md`](nfr-scalability.md)
- **Compliance:** [`compliance-scope.md`](compliance-scope.md)
- **Tests:** `tests/`

---

*Last reviewed: 2026-04-25 by Chris.*
