---
title: Security Test Template
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, auditor]
sdlc_category: templates
related: [docs/sdlc/07-testing/security-test-plan.md, docs/sdlc/06-security/threat-model.md, docs/sdlc/06-security/controls-matrix.md]
---

# Security Test: [test name]

> **TL;DR:** Which threat this test exercises, what attack technique, what control should defeat it, and the pass/fail criterion.

Security tests are threat-driven: each one starts with a threat ID from the threat model, expresses an attack, and verifies the control holds.

---

## Threat under test

- **Threat ID:** `T-NNNN` from [`docs/sdlc/06-security/threat-model.md`](../06-security/threat-model.md).
- **Threat statement:** in attacker's voice. Example: "I tamper with a stored audit entry to forge a policy decision."
- **STRIDE category:** Spoofing / Tampering / Repudiation / Information disclosure / DoS / Elevation.
- **Asset at risk:** what's being protected. Confidentiality / Integrity / Availability of <thing>.

## Control under test

- **Control:** the specific code path / configuration / process that should defeat the attack. Cite path: `src/...`, line range if narrow.
- **Control class:** preventive / detective / corrective.
- **Reference:** ADR / spec section / partner finding ID.

A test that doesn't bind to a specific control is incomplete — without a control, there's nothing to verify.

## Setup

What state the system must be in before the attack runs:

- Database fixtures (rows, classifications).
- Configuration (env vars, feature flags).
- Credentials (real or fixture; never test against real creds without explicit authorization).
- Time / clock state if the test depends on it (e.g., key rotation tests).

Setup is part of the test; reproducibility matters.

## Attack

The exact steps an attacker would take. Be specific:

```
1. <Action>. Code or command:
   <code block>
2. <Action>. …
3. <Action>. …
```

If the attack is multi-step or requires a tool (Burp, ZAP, custom script), document tool version + invocation.

## Expected outcome

- **What the control should do:** reject the attack, alert, fail closed, log + audit, etc.
- **What the test asserts:** specific assertion. Examples:
  - HTTP response is 401 with body matching `{ "error": "invalid signature" }`.
  - Audit chain length unchanged.
  - Log line at level `warn` matches pattern `signature mismatch from <source>`.
  - No row inserted into `<table>`.

If the assertion is "the test doesn't crash", the test is too weak. Specific assertions or it's not a security test.

## Pass / fail

- **Pass criterion:** all expected-outcome assertions hold.
- **Fail criterion:** any assertion fails OR the attack succeeds in producing the prohibited outcome.

Failure of a security test is **always** a SEV-2 or higher; it doesn't get "watched for a sprint" the way perf-test trends might.

## Adversarial variants

Variants of the same attack that exercise edge cases:

- **Replay:** can the attack be replayed?
- **Concurrent:** does the control hold under concurrent attempts?
- **Boundary:** edge cases at validation boundaries (length, encoding, charset).
- **Timing:** can the attacker probe via timing differences?

A test that only covers the textbook case is incomplete; control coverage demands variants.

## Negative test

The dual: a benign request that looks superficially like the attack. The control must NOT block legitimate traffic.

- Example: the webhook signature test must verify both a tampered payload is rejected AND a valid payload is accepted. A control that rejects everything is not a control; it's an outage.

## Procedure

```bash
# 1. Set up
node scripts/security/setup-fixture.mjs --threat T-NNNN

# 2. Run attack
node scripts/security/run-attack.mjs --threat T-NNNN --variant replay

# 3. Assert
node scripts/security/assert-outcome.mjs --threat T-NNNN

# 4. Run negative
node scripts/security/run-negative.mjs --threat T-NNNN

# 5. Tear down
node scripts/security/teardown.mjs --threat T-NNNN
```

If the test is a vitest, point at the test file path.

## Linked artifacts

- Threat model: [`docs/sdlc/06-security/threat-model.md`](../06-security/threat-model.md) §<component>
- Controls matrix: [`docs/sdlc/06-security/controls-matrix.md`](../06-security/controls-matrix.md) row T-NNNN
- Code under test: `src/...`
- Test file: `tests/...`
- ADR (if control is decision-driven): `docs/adr/NNNN-...md`
- Spec: v6 §X.Y

---

## Style rules

- **Threat-bound.** Every security test references a threat ID.
- **Control-bound.** Every security test references a specific control path.
- **Specific assertions.** "Doesn't crash" is not an assertion.
- **Includes negative case.** The dual of the attack must pass.
- **Treated as P0.** Security test failures get SEV-2+ treatment.
