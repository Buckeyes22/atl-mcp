---
title: SDLC Documentation Index
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, operator, integrator, auditor, executive]
sdlc_category: index
related: [agent-context-orchestrator-mcp-plan-v6.md, docs/demo/README.md, docs/adr/, docs/partners/]
---

# Documentation Index — Agent Context Orchestrator (atl-mcp)

> **TL;DR:** This is the entry point for atl-mcp's enterprise SDLC documentation. The 17 numbered subdirectories cover every phase of the software lifecycle: charter through cost. If you're an auditor, on-call engineer, integrator, or new team member, start here. If you're looking for the *spec* (what to build), see [`agent-context-orchestrator-mcp-plan-v6.md`](../../agent-context-orchestrator-mcp-plan-v6.md). If you're looking for the *demo portfolio*, see [`docs/demo/`](../demo/).

---

## Quick routing

### "I have N minutes"

| Time | Read |
|---|---|
| 60 seconds | [`02-architecture/README.md`](02-architecture/README.md) — what this thing is |
| 5 minutes | The above + [`01-charter/README.md`](01-charter/README.md) (scope) + [`08-operations/runbook.md`](08-operations/runbook.md) (top of) |
| 15 minutes | The above + [`06-security/threat-model.md`](06-security/threat-model.md) + [`08-operations/slo-sli.md`](08-operations/slo-sli.md) + [`09-deployment/release-process.md`](09-deployment/release-process.md) |
| 1 hour | All category READMEs + the centerpiece docs (threat-model, runbook, release-process, recovery-objectives, sequence-diagrams, schema) |
| 1 day | The whole tree (~95 docs) |

### "I'm a [role]"

| Role | Start at |
|---|---|
| **New engineer** | [`11-onboarding/developer-setup.md`](11-onboarding/developer-setup.md) → [`02-architecture/README.md`](02-architecture/README.md) → relevant `04-design/module-*.md` |
| **On-call** | [`08-operations/runbook.md`](08-operations/runbook.md) → [`08-operations/alerting.md`](08-operations/alerting.md) → [`08-operations/on-call-playbook.md`](08-operations/on-call-playbook.md) |
| **Integrator (MCP host)** | [`11-onboarding/integrator-guide.md`](11-onboarding/integrator-guide.md) → [`04-design/api-mcp-tools.md`](04-design/api-mcp-tools.md) |
| **Operator (production)** | [`11-onboarding/operator-guide.md`](11-onboarding/operator-guide.md) → [`08-operations/runbook.md`](08-operations/runbook.md) → [`09-deployment/release-process.md`](09-deployment/release-process.md) |
| **Auditor / customer security review** | [`06-security/threat-model.md`](06-security/threat-model.md) → [`06-security/controls-matrix.md`](06-security/controls-matrix.md) → [`03-requirements/compliance-scope.md`](03-requirements/compliance-scope.md) |
| **Executive / sponsor** | [`01-charter/README.md`](01-charter/README.md) → [`01-charter/product-strategy.md`](01-charter/product-strategy.md) → [`16-cost/cost-model.md`](16-cost/cost-model.md) |
| **Reviewer / evaluator** | [`docs/demo/README.md`](../demo/README.md) (separate demo mirror) |

### "I'm looking for…"

| Question | Answer at |
|---|---|
| Where is the threat model? | [`06-security/threat-model.md`](06-security/threat-model.md) |
| Where are the SLOs? | [`08-operations/slo-sli.md`](08-operations/slo-sli.md) |
| What's the rollback procedure? | [`09-deployment/release-process.md`](09-deployment/release-process.md) § Rollback |
| What does PolicyDecision do? | [`06-security/policy-decision-layer.md`](06-security/policy-decision-layer.md) |
| How is the audit chain rotated? | [`06-security/audit-chain-threat-model.md`](06-security/audit-chain-threat-model.md) § Rotation |
| What's our RTO? | [`10-dr-bcp/recovery-objectives.md`](10-dr-bcp/recovery-objectives.md) |
| How do I onboard as an integrator? | [`11-onboarding/integrator-guide.md`](11-onboarding/integrator-guide.md) |
| What's our compliance scope? | [`03-requirements/compliance-scope.md`](03-requirements/compliance-scope.md) |
| What's the schema? | [`05-data/schema.md`](05-data/schema.md) |
| What's the data classification? | [`05-data/classification.md`](05-data/classification.md) |
| How does intake become a blueprint? | [`04-design/sequence-diagrams.md`](04-design/sequence-diagrams.md) § Intake to blueprint |

---

## The 17 categories

### `01-charter/` — Why does this exist?

Vision, scope, stakeholders, success criteria, non-goals. Single source of truth for "is X in scope?"

- [`README.md`](01-charter/README.md) — Vision + scope summary
- [`product-strategy.md`](01-charter/product-strategy.md) — Problem, bet, success criteria
- [`non-goals.md`](01-charter/non-goals.md) — What this is explicitly not

### `02-architecture/` — What is it?

C4-style architecture documentation. Levels 1 and 2; level 3 lives in `04-design/module-*.md`.

- [`README.md`](02-architecture/README.md) — C4-L1 system context (mermaid)
- [`containers.md`](02-architecture/containers.md) — C4-L2 (ports, processes, stores)
- [`data-flow.md`](02-architecture/data-flow.md) — End-to-end dataflow
- [`trust-boundaries.md`](02-architecture/trust-boundaries.md) — Three boundaries with auth/audit obligations
- [`tradeoffs.md`](02-architecture/tradeoffs.md) — Cross-cutting design tradeoff register

### `03-requirements/` — What does it have to do?

Functional and non-functional requirements. Compliance applicability statement.

- [`functional.md`](03-requirements/functional.md) — Capabilities by milestone
- [`nfr-availability.md`](03-requirements/nfr-availability.md) — Uptime / MTTR
- [`nfr-performance.md`](03-requirements/nfr-performance.md) — Latency / throughput / capacity
- [`nfr-security.md`](03-requirements/nfr-security.md) — Confidentiality / integrity / authenticity
- [`nfr-scalability.md`](03-requirements/nfr-scalability.md) — Single-tenant limits + multi-tenant runway
- [`compliance-scope.md`](03-requirements/compliance-scope.md) — GDPR / SOC2 / HIPAA applicability

### `04-design/` — How is it built?

Per-module HLD/LLD. API specs. Sequence diagrams.

- [`module-mcp-runtime.md`](04-design/module-mcp-runtime.md) — `src/mcp/`
- [`module-storage.md`](04-design/module-storage.md) — `src/storage/`
- [`module-providers-atlassian.md`](04-design/module-providers-atlassian.md) — Jira + Confluence
- [`module-providers-vcs.md`](04-design/module-providers-vcs.md) — Bitbucket + worktree
- [`module-security.md`](04-design/module-security.md) — Token store + audit + policy
- [`module-workflows.md`](04-design/module-workflows.md) — Intake / blueprint / provisioning / readiness / handoff
- [`module-queue.md`](04-design/module-queue.md) — BullMQ provisioning queue
- [`module-context.md`](04-design/module-context.md) — Context pack + redaction
- [`module-preflight.md`](04-design/module-preflight.md) — Capability discovery
- [`module-observability.md`](04-design/module-observability.md) — Pino + Prometheus + Langfuse
- [`api-mcp-tools.md`](04-design/api-mcp-tools.md) — Full MCP tool catalog
- [`api-mgmt-rest.md`](04-design/api-mgmt-rest.md) — `/healthz`, `/readyz`, `/metrics`
- [`sequence-diagrams.md`](04-design/sequence-diagrams.md) — 8 mermaid sequence diagrams

### `05-data/` — What does it persist?

Schema, domain model, retention, classification, migrations.

- [`schema.md`](05-data/schema.md) — 12 tables × ER diagram
- [`domain-model.md`](05-data/domain-model.md) — 18 domain types
- [`retention.md`](05-data/retention.md) — Per-table retention + purge
- [`classification.md`](05-data/classification.md) — PUBLIC / INTERNAL / PRIVATE / SECRET
- [`migrations.md`](05-data/migrations.md) — Migration policy: rehearsal-required, idempotent
- [`audit-trail.md`](05-data/audit-trail.md) — Audit chain reference

### `06-security/` — How is it protected?

Threat model, controls, key/secret/token management, vulnerability disclosure.

- [`threat-model.md`](06-security/threat-model.md) — STRIDE per trust boundary + attack trees
- [`controls-matrix.md`](06-security/controls-matrix.md) — Threats × controls × test coverage
- [`token-storage.md`](06-security/token-storage.md) — Master-key, envelope encryption, rotation drill
- [`audit-chain-threat-model.md`](06-security/audit-chain-threat-model.md) — Defends ADR-0005
- [`webhook-verification.md`](06-security/webhook-verification.md) — HMAC-SHA256 per source
- [`policy-decision-layer.md`](06-security/policy-decision-layer.md) — Effects, obligations, confidence
- [`secrets-mgmt.md`](06-security/secrets-mgmt.md) — Secret inventory + lifecycle
- [`lethal-trifecta.md`](06-security/lethal-trifecta.md) — v6 §38.1 promoted to a control
- [`vulnerability-disclosure.md`](06-security/vulnerability-disclosure.md) — Disclosure + scope

### `07-testing/` — How is it verified?

Test strategy, plans per category, eval-view integration.

- [`strategy.md`](07-testing/strategy.md) — Pyramid: unit / integration / contract / E2E / live
- [`unit-coverage.md`](07-testing/unit-coverage.md) — Subject areas + numeric targets
- [`integration-plan.md`](07-testing/integration-plan.md) — Storage, providers, MCP, mgmt
- [`e2e-plan.md`](07-testing/e2e-plan.md) — Multi-workflow happy + adversarial paths
- [`perf-plan.md`](07-testing/perf-plan.md) — Latency baselines, load tests
- [`security-test-plan.md`](07-testing/security-test-plan.md) — Threat-driven adversarial tests
- [`eval-view-integration.md`](07-testing/eval-view-integration.md) — LLM-as-judge gates

### `08-operations/` — How is it run?

Runbook, SLOs, monitoring, alerting, on-call, observability.

- [`runbook.md`](08-operations/runbook.md) — Symptom-organized runbook
- [`slo-sli.md`](08-operations/slo-sli.md) — Latency / availability / freshness / error budget
- [`monitoring.md`](08-operations/monitoring.md) — Prometheus + Langfuse
- [`alerting.md`](08-operations/alerting.md) — Alert → diagnosis → runbook map
- [`on-call-playbook.md`](08-operations/on-call-playbook.md) — Rotation, escalation, comms
- [`observability-stack.md`](08-operations/observability-stack.md) — Logs / metrics / traces / events

### `09-deployment/` — How is it shipped?

CI/CD, release process, environments, feature flags, secrets provisioning.

- [`ci-cd.md`](09-deployment/ci-cd.md) — Cumulative gates per milestone
- [`release-process.md`](09-deployment/release-process.md) — SemVer, changelog, rollback
- [`environments.md`](09-deployment/environments.md) — dev / test / staging / production tiers
- [`feature-flags.md`](09-deployment/feature-flags.md) — `MILESTONE_*_ENABLED` conventions
- [`deployment-targets.md`](09-deployment/deployment-targets.md) — Docker / k8s / single-process
- [`secrets-provisioning.md`](09-deployment/secrets-provisioning.md) — How secrets reach each environment

### `10-dr-bcp/` — How does it recover?

Backup, recovery objectives, failover, audit-chain recovery, drill schedule.

- [`backup-strategy.md`](10-dr-bcp/backup-strategy.md) — Postgres + audit-chain replication
- [`recovery-objectives.md`](10-dr-bcp/recovery-objectives.md) — RTO / RPO targets
- [`failover.md`](10-dr-bcp/failover.md) — Single-tenant cold restore + multi-tenant runway
- [`audit-chain-recovery.md`](10-dr-bcp/audit-chain-recovery.md) — Reconstruction post-incident
- [`dr-test-schedule.md`](10-dr-bcp/dr-test-schedule.md) — Quarterly drills

### `11-onboarding/` — How do I get started?

Developer / integrator / operator / partner guides + glossary quick reference.

- [`developer-setup.md`](11-onboarding/developer-setup.md) — Build, test, run locally
- [`integrator-guide.md`](11-onboarding/integrator-guide.md) — For MCP-host builders
- [`operator-guide.md`](11-onboarding/operator-guide.md) — For production operators
- [`partner-onboarding.md`](11-onboarding/partner-onboarding.md) — For teams adopting atl-mcp
- [`glossary-quick.md`](11-onboarding/glossary-quick.md) — Top-30-term flashcard

### `12-governance/` — How are decisions made?

ADR process, change management, decision log, code review, DoR/DoD.

- [`adr-process.md`](12-governance/adr-process.md) — MADR + START/DoD
- [`change-management.md`](12-governance/change-management.md) — Spec changes → ADR → impl → audit
- [`decision-log.md`](12-governance/decision-log.md) — Rolled-up index of all decisions
- [`code-review.md`](12-governance/code-review.md) — Two-stage review per F-107
- [`definition-of-ready-done.md`](12-governance/definition-of-ready-done.md) — DoR + DoD canonical

### `13-quality/` — What's the bar?

Code style, iron laws, anti-slop, quality gates.

- [`code-style.md`](13-quality/code-style.md) — Strict TS, comment policy, conventions
- [`iron-laws.md`](13-quality/iron-laws.md) — Verification before claim, test-first
- [`anti-slop.md`](13-quality/anti-slop.md) — Anti-stub scanner, lint:no-stdout
- [`quality-gates.md`](13-quality/quality-gates.md) — Per-milestone CI gates

### `14-incidents/` — How do we learn?

Postmortem template, taxonomies, library, blameless review process.

- [`postmortem-template.md`](14-incidents/postmortem-template.md) — CATCH→ENFORCE
- [`failure-mode-taxonomy.md`](14-incidents/failure-mode-taxonomy.md) — From v6 §30.4
- [`fix-type-taxonomy.md`](14-incidents/fix-type-taxonomy.md) — From v6 §30.5
- [`incident-library.md`](14-incidents/incident-library.md) — Past incidents (Incidents A/B/C from runbook)
- [`blameless-review.md`](14-incidents/blameless-review.md) — Process + outcomes

### `15-capacity/` — How does it scale?

Current limits, capacity planning, benchmarks, load-test runbook.

- [`current-limits.md`](15-capacity/current-limits.md) — 1000 sessions, 1h TTL, queue depth, etc.
- [`capacity-planning.md`](15-capacity/capacity-planning.md) — Projects per instance, scaling thresholds
- [`benchmarks.md`](15-capacity/benchmarks.md) — Baseline numbers per tool
- [`load-test-runbook.md`](15-capacity/load-test-runbook.md) — How to run a load test

### `16-cost/` — What does it cost?

Cost model, FinOps, pricing runway.

- [`cost-model.md`](16-cost/cost-model.md) — Postgres + queue + LLM costs
- [`finops.md`](16-cost/finops.md) — Tag/track/report/alarm
- [`pricing-runway.md`](16-cost/pricing-runway.md) — If/when this becomes a SaaS

### `17-glossary/` — What does X mean?

Centralized vocabulary.

- [`README.md`](17-glossary/README.md) — Glossary
- [`domain-vocabulary.md`](17-glossary/domain-vocabulary.md) — State-machine states, types, patterns

### `templates/` — How do I write a new doc?

Reusable skeletons for ADR, runbook, postmortem, threat model, sequence diagram, module design, perf test, security test.

- [`adr-template.md`](templates/adr-template.md)
- [`runbook-template.md`](templates/runbook-template.md)
- [`postmortem-template.md`](templates/postmortem-template.md)
- [`threat-model-template.md`](templates/threat-model-template.md)
- [`sequence-diagram-template.md`](templates/sequence-diagram-template.md)
- [`module-design-template.md`](templates/module-design-template.md)
- [`perf-test-template.md`](templates/perf-test-template.md)
- [`security-test-template.md`](templates/security-test-template.md)

---

## Documentation conventions

### Frontmatter

Every doc opens with YAML frontmatter:

```yaml
---
title: <doc title>
owner: Chris (single-maintainer for v1)
status: draft | accepted | superseded
last_reviewed: YYYY-MM-DD
version: <semver>
audience: [engineer, operator, integrator, auditor, executive]
sdlc_category: NN-name
related: [list of paths or v6 §-references]
---
```

### Linking discipline

Every doc has a `## Linked artifacts` footer with at least one of: a v6 §-reference, an ADR ID, a code path, a Jira ticket, a test path, or a partner-guide finding ID. SDLC docs reference; they don't redocument what already exists in the canon.

### Diagrams

Mermaid wherever possible. PNG/draw.io only when mermaid runs out of expressiveness. Diagram source always checked in next to the rendered output.

### Re-review cadence

Every doc has a `last_reviewed` field. Quarterly: re-review the docs whose date is older than 90 days. Find one inaccuracy per re-review or the cadence is too long; find more than three and the cadence is too short.

---

## Relationship to other documentation in this repo

The SDLC tree complements, **does not replace**:

- [`agent-context-orchestrator-mcp-plan-v6.md`](../../agent-context-orchestrator-mcp-plan-v6.md) — **the spec.** Authoritative for *what to build*. SDLC docs cite §-references; they don't restate the spec.
- [`docs/build-orchestration.md`](../build-orchestration.md) — the milestone sequence. SDLC `09-deployment/release-process.md` cites; doesn't replace.
- [`docs/partners/`](../partners/) — 42 partner integration guides. SDLC docs cite finding IDs (F-XXX); they don't redocument partner rationale.
- [`docs/adr/`](../adr/) — ADRs. The decision log in `12-governance/decision-log.md` rolls up; ADRs remain canonical for individual decisions.
- [`docs/demo/`](../demo/) — demo portfolio mirror. Some demo files (`runbook.md`, `glossary.md`, `security-posture.md`) point up to canonical SDLC versions.
- [`docs/audit-*.md`](../) — audit cycle artifacts (protocol, findings, remediation, backlog, verification). The SDLC quality and incident-library docs cite this set.
- [`docs/host-addenda/`](../host-addenda/) — host-specific MCP addenda. The integrator-guide cross-references.
- [`docs/milestone-checklists/`](../milestone-checklists/) — per-milestone acceptance. The release-process doc cites the pattern.
- [`AGENTS.md`](../../AGENTS.md) and [`CLAUDE.md`](../../CLAUDE.md) — agent-host contracts. Stay canonical for agent contracts and CI gates.

If you find duplication between an SDLC doc and the canon, flag it — the SDLC doc is supposed to *index* and *summarize*, not *re-author*.

---

## Status

This tree was authored as a comprehensive SDLC documentation pass on 2026-04-25. ~95 new files across 17 categories. All Phase A (foundation) docs are accepted. Phases B–D land per the plan in [`C:\Users\Chris\.claude\plans\generate-a-comprehensive-plan-wobbly-scroll.md`](../../../.claude/plans/generate-a-comprehensive-plan-wobbly-scroll.md).

For execution status of individual phases, see the section at the top of each category README.

---

*Last reviewed: 2026-04-25 by Chris.*
