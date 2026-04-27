---
title: End-to-End Test Plan
owner: Chris
status: draft (planned for M11)
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer]
sdlc_category: 07-testing
related: [docs/sdlc/07-testing/strategy.md, docs/sdlc/07-testing/integration-plan.md]
---

# End-to-End Test Plan

> **TL;DR:** Multi-workflow happy paths exercising the full pipeline (intake → blueprint → plan → execute → handoff). Plus adversarial paths (lethal trifecta, policy denial). v1 has minimal E2E coverage; M11 lands the harness. Until then, integration tests + live provider tests are the proxies.

E2E tests are slow, expensive, and high-signal. v1 has very few; M11+ adds the harness.

---

## What E2E means here

An E2E test:

- Spans more than one workflow.
- Uses real-shaped (if not real) external systems.
- Verifies user-visible outcome, not internal state.

Example: "operator submits requirements → orchestrator generates blueprint → operator approves → orchestrator provisions Jira issues → operator queries readiness → handoff manifest is generated."

That's six steps; integration tests cover individual steps; E2E covers the chain.

---

## Planned E2E scenarios

### Happy paths

#### E2E-1: Full provisioning lifecycle

**Setup:** clean Atlassian sandbox; clean Bitbucket sandbox; no preexisting project.

**Steps:**
1. `project_intake_create` with sample requirements.
2. `project_preflight_check` against sandbox targets.
3. `project_blueprint_generate` (with real or mocked sampling).
4. `project_provision_preview` — verify plan reasonable.
5. `project_provision_execute` — wait for job complete.
6. Verify Jira issues exist with expected fields.
7. Verify Confluence pages exist with expected content.
8. Verify Bitbucket branches + agent-context manifest exist.
9. `readiness_validate` — expect "Ready" tier.
10. `generateHandoff` for one issue — verify manifest structure.

**Acceptance:** all steps succeed; final state matches blueprint.

#### E2E-2: Re-run is idempotent

**Setup:** state from E2E-1 still present.

**Steps:**
1. Re-run `project_provision_execute` with same plan + approval.
2. Verify no duplicate Jira issues / Confluence pages / Bitbucket branches.
3. Verify audit log shows new entries (re-runs are themselves audited).

**Acceptance:** no duplicates; audit log accurate.

#### E2E-3: Webhook ingestion updates state

**Setup:** project provisioned; build agent makes a Jira issue change externally.

**Steps:**
1. External Jira issue update fires webhook.
2. Orchestrator's webhook ingress verifies signature, dedup, processes event.
3. Project graph updates.
4. If divergent from blueprint: `DRIFT_DETECTED` state.
5. Re-running `readiness_validate` reflects the new state.

**Acceptance:** state machine correctly reflects external changes.

### Adversarial paths

#### E2E-A1: Lethal trifecta detection blocks

**Setup:** intake contains a prompt-injection payload.

**Steps:**
1. `project_intake_create` with payload.
2. `project_blueprint_generate` produces a blueprint that *would* exfiltrate.
3. Adversarial verifier rejects (the blueprint includes external write of PRIVATE content).
4. State `VALIDATION_FAILED`.

**Acceptance:** verifier catches; no provisioning occurs.

#### E2E-A2: Policy deny blocks cross-project write

**Setup:** intake targets a project the actor doesn't own.

**Steps:**
1. Intake + blueprint succeed.
2. `project_provision_execute` invoked.
3. Policy decision layer denies on cross-project intent.
4. Audit chain records the deny.
5. No external writes.

**Acceptance:** no Jira / Confluence / VCS writes; audit chain shows deny.

#### E2E-A3: Audit chain integrity holds under simulated tampering

**Setup:** simulate a DB-write tamper (controlled, in test environment).

**Steps:**
1. Provision a project (E2E-1 lite).
2. Tamper with one audit entry's payload (raw SQL UPDATE).
3. Run offline verifier.
4. Verifier reports failure at the tampered entry.

**Acceptance:** tamper detected; verifier output identifies the entry.

---

## Test harness (M11)

The E2E harness lives at `tests/e2e/` (when implemented). Each scenario is a separate file; runs in CI behind `RUN_E2E_TESTS=1`.

Components:
- Sandbox provisioner (fresh state per run).
- Test orchestrator (drives the steps).
- Assertion library (verify external system state).
- Cleanup (tear down sandbox).

## What's NOT in E2E (v1)

- **Production-shaped load.** Capacity / perf testing is separate ([`perf-plan.md`](perf-plan.md)).
- **Multi-tenant.** v1 single-tenant.
- **Failure injection** (chaos engineering). Out of scope for v1.

## Linked artifacts

- **Strategy:** [`strategy.md`](strategy.md)
- **Sibling:** [`integration-plan.md`](integration-plan.md), [`perf-plan.md`](perf-plan.md), [`security-test-plan.md`](security-test-plan.md)
- **Spec:** v6 §31

---

*Last reviewed: 2026-04-25 by Chris.*
