---
title: Policy Decision Layer
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, auditor]
sdlc_category: 06-security
related: [agent-context-orchestrator-mcp-plan-v6.md §7.2, docs/sdlc/06-security/threat-model.md]
---

# Policy Decision Layer

> **TL;DR:** Every state-changing operation passes through `policyDecisionLayer.evaluate()`. Returns an effect (allow/deny/require_approval), obligations (constraints to apply downstream), confidence (numeric + categorical), and reasons. Default in v1 is the `codePolicyAdapter` — code-as-policy with conservative defaults. Richer adapters (OPA, Cedar) plug in behind the same interface in M7+.

Component-level threat model + design. Parent: [`threat-model.md`](threat-model.md). Spec: v6 §7.2.

---

## What it is

A single function gate that every executor (Jira, Confluence, VCS) calls before issuing a state-changing operation:

```typescript
const decision = await policyDecisionLayer.evaluate({
  projectId,
  intent: "jira.issue.create",
  context: { ... }
})

if (decision.effect === "deny") throw new PolicyDeniedError(decision.reasons)
if (decision.effect === "require_approval") await requestApproval(decision)
// proceed; honor obligations
```

**Code:** `src/security/policyDecisionLayer.ts`. Adapter pattern — the layer holds the contract, adapters implement specific rule logic.

## Decision shape

```typescript
interface PolicyDecision {
  effect: "allow" | "deny" | "require_approval"
  obligations: Obligation[]      // constraints to apply downstream
  confidence: {
    numeric: number              // 0.0 to 1.0
    categorical: "low" | "medium" | "high"
  }
  reasons: string[]              // human-readable, for audit + debugging
}

type Obligation =
  | { kind: "redact_field"; path: string }
  | { kind: "rate_limit"; perMinute: number }
  | { kind: "require_review"; reviewer: string }
  | { kind: "audit_extra"; tags: string[] }
```

The decision is logged via the audit chain; reasons survive into the audit entry's payload.

## Why this design

**Single entry point.** Every executor calls `evaluate()` — no executor decides for itself whether an operation is allowed. This means:

- Adding a new policy is one place to change.
- Auditing "what is allowed?" is one place to read.
- Security review is bounded to `policyDecisionLayer.ts` + adapter implementations.

**Adapter pattern.** v1 has the `codePolicyAdapter` (rules expressed in TS). Future adapters could plug in:

- OPA (Open Policy Agent) — Rego rules.
- Cedar (Amazon's authorization language).
- Custom DSL.

Adapters all return the same `PolicyDecision` shape. No executor knows which adapter is configured.

**Obligations, not just allow/deny.** A binary decision is too crude — many cases want "allow, but redact field X" or "allow, but log extra tags." Obligations express this without forcing the policy layer to do the actual work; downstream code honors the obligations.

**Confidence is a first-class field.** When a decision involves uncertainty (e.g., the lethal-trifecta detector returns "this *might* be private data"), the confidence captures it. Auditors can filter for low-confidence allows for review.

## v1 adapter: `codePolicyAdapter`

Code in `src/security/policyAdapters/codePolicyAdapter.ts`. Conservative defaults:

| Intent | Default effect | Rationale |
|---|---|---|
| Read-only operations (preflight, capability discovery) | `allow` with confidence `high` | No side effects |
| Write operations on a project the actor owns | `allow` with `audit_extra` obligation | Actor is authoritative |
| Write operations cross-project | `require_approval` | Insider abuse risk (T-2206) |
| Operations triggering lethal-trifecta detection | `deny` (or `require_approval` if confidence is medium) | v6 §38.1 |
| Operations during deploy freeze (config flag) | `require_approval` | Operational safety |

The adapter is pure code; rule changes are PRs with ADR review for non-trivial changes.

## Threats and mitigations (component-level)

### T-PDL-1: Bypass the policy layer

**Statement:** "I write code in a new executor that doesn't call `policyDecisionLayer.evaluate()` before its writes."

**Mitigation:** code review discipline + a lint check (planned, M11) that requires every `*Provider.write*` method to be preceded by a `policyDecisionLayer.evaluate()` call in the same function.

**Residual risk:** discipline-based. The lint, when implemented, makes it mechanical.

### T-PDL-2: Policy adapter returns wrong decision

**Statement:** "The adapter has a logic bug — allows what should deny, or vice versa."

**Mitigation:** unit tests per intent (`tests/unit/security/codePolicyAdapter.test.ts`), including negative cases. Each new policy rule has both a passing and a failing test.

**Residual risk:** novel inputs not covered by tests. Audit log surfaces low-confidence allows for human review.

### T-PDL-3: Bypass via obligations

**Statement:** "Adapter returns 'allow' with `redact_field` obligation, but the executor doesn't honor it."

**Mitigation:** integration tests assert obligations are honored end-to-end. `tests/integration/...` (per-executor, M6+).

**Residual risk:** if a new obligation type is introduced, ensure all consumers handle it.

### T-PDL-4: Tamper with the adapter at runtime

**Statement:** "Reload an attacker-controlled adapter."

**Mitigation:** adapters are statically imported; no runtime loading from filesystem. Image build is the trust boundary.

**Residual risk:** supply-chain attack on the build (out of application scope; npm audit, lockfile, Renovate are the controls).

## Audit obligation

Every `evaluate()` call writes a `PolicyDecision` row to `policyDecisions` (in addition to the audit-chain entry). The full reasoning is persisted: which adapter, which rule fired, what confidence, what obligations.

This is **redundant** with the audit chain on purpose: the policy decision table is structured for SQL queries ("show me all denies in the last hour") while the audit chain is structured for tamper-evidence.

## Configuration

| Var | Default | Purpose |
|---|---|---|
| `POLICY_ADAPTER` | `code` | Adapter selection. v1 only supports `code`. |
| `POLICY_STRICT_MODE` | `true` for `production`, `false` for `dev` | Strict mode treats unrecognized intents as `deny`; permissive treats them as `allow` with low confidence |

## Tests

| Test | Path | What it proves |
|---|---|---|
| Decision shape | `tests/unit/security/codePolicyAdapter.test.ts` | All intents return the canonical decision shape |
| Read-only allows | Same file | Non-state-changing intents always allow |
| Write allows with obligations | Same file | Project-owner writes allow with audit obligation |
| Cross-project requires approval | Same file | Insider risk path |
| Lethal-trifecta deny | Same file (links to `lethal-trifecta.md`) | Combined private + untrusted + external → deny |
| Strict mode default-deny | Same file | Unknown intent in strict mode denies |

## Linked artifacts

- **Spec:** v6 §7.2 (Policy decision layer), §38 (Lethal trifecta + ACL)
- **Code:** `src/security/policyDecisionLayer.ts`, `src/security/policyAdapters/codePolicyAdapter.ts`
- **Schema:** `src/storage/schema/policyDecisions.ts`
- **Tests:** `tests/unit/security/codePolicyAdapter.test.ts`
- **Threat model:** [`threat-model.md`](threat-model.md)
- **Lethal trifecta:** [`lethal-trifecta.md`](lethal-trifecta.md)
- **Module design:** [`../04-design/module-security.md`](../04-design/module-security.md)
- **Audit trail:** [`../05-data/audit-trail.md`](../05-data/audit-trail.md)

---

*Last reviewed: 2026-04-25 by Chris.*
