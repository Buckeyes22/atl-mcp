---
title: Security Test Plan
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, auditor]
sdlc_category: 07-testing
related: [docs/sdlc/06-security/threat-model.md, docs/sdlc/06-security/controls-matrix.md, docs/sdlc/templates/security-test-template.md]
---

# Security Test Plan

> **TL;DR:** Threat-driven adversarial test set. Each threat in [`../06-security/threat-model.md`](../06-security/threat-model.md) maps to a test. Per-test docs follow [`../templates/security-test-template.md`](../templates/security-test-template.md). Failing security test = SEV-2+ incident.

Security tests are different from regular tests: they prove a control holds against a specific attack, with both positive (control rejects attack) and negative (control allows benign) cases.

---

## Test catalog

Numbered by threat ID from the threat model. For each, the test exercises the named control.

| Threat ID | Test name | Control | Status |
|---|---|---|---|
| T-1101 | Spoof MCP session | session-bound creds | Existing in `tests/unit/sessionCapabilities.test.ts` |
| T-1102 | Replay MCP request | idempotency keys + TLS | Existing in `tests/integration/storage/repositories.test.ts` |
| T-1103 | Forge webhook | HMAC-SHA256 verify | Existing in `tests/unit/security/webhookSignatures.test.ts` |
| T-1104 | Replay webhook | dedup table | Planned (M10) |
| T-1105 | DoS MCP transport | concurrent cap | Planned (capacity test) |
| T-1106 | DoS mgmt REST | loopback | Existing in `tests/integration/mgmtApi.test.ts` |
| T-1107 | Inject payload | Zod + tenant scope | Existing in `tests/unit/domain/*.test.ts` |
| T-1108 | Mgmt privilege escalation | no write endpoints | Existing in `tests/integration/mgmtApi.test.ts` |
| T-2201 | Exfiltrate tokens | envelope encryption | Existing in `tests/unit/security/tokenEncryption.test.ts` |
| T-2202 | Token leak in logs | Pino redact + lint | Existing in `tests/lint/no-stdout.test.ts` (partial); redact tests planned |
| T-2203 | SSRF | typed config URLs | Planned |
| T-2204 | Forge upstream response | TLS | Default Node TLS; not unit-testable |
| T-2205 | Trigger rate limit | retry + cache | Existing in `tests/unit/providers/http/retry.test.ts` |
| T-2206 | Wrong-project write | policy decision | Existing in `tests/unit/security/codePolicyAdapter.test.ts` |
| T-3301 | Lethal trifecta | trifecta detection | Planned (M11) |
| T-3302 | Forge audit entry | hash chain + signature | Existing in `tests/integration/storage/auditRepository.test.ts` |
| T-3303 | Compromise signing key | file perms | Manual deploy audit |
| T-3304 | Compromise registry | git protection | Manual audit |
| T-3305 | Audit silently fails | fail closed | Existing partial; full integration test pending |
| T-3306 | Clock manipulation | dual timestamps | Planned |

## Test patterns

Per [`../templates/security-test-template.md`](../templates/security-test-template.md):

- **Threat-bound** — each test references a threat ID.
- **Control-bound** — each test exercises a specific code path.
- **Specific assertions** — "control returned 401 with body X."
- **Includes negative case** — control accepts the legitimate request.

### Sample (existing): T-1103 forge webhook

```typescript
// Positive (attack)
test("rejects forged signature", () => {
  const body = '{"event":"injected"}'
  const wrongSig = "abc123"
  expect(() => verifyWebhookSignature(body, wrongSig, secret))
    .toThrow(/signature mismatch/)
})

// Negative (benign)
test("accepts valid signature", () => {
  const body = '{"event":"real"}'
  const validSig = computeHmac(secret, body)
  expect(verifyWebhookSignature(body, validSig, secret)).toBeTruthy()
})
```

Both cases must pass.

## Threat-driven discipline

When a new threat is added to the model:

1. Open the threat model.
2. Identify the control.
3. Write the security test (test-first per iron law).
4. Implement / verify the control.
5. Run; confirm both attack-rejection AND negative-case pass.
6. Reference test path in the controls matrix.

## What "passing" means

A passing security test means:

- The named attack is rejected with the expected outcome.
- The negative-case (benign) request is accepted.
- No regressions in adjacent threats.

A failing security test is a **SEV-2+ incident** — the control is broken; affected operations should be paused until fixed.

## Adversarial test pen-test

Beyond the unit-test set, periodic broader penetration testing:

- **Self-driven:** quarterly review where the security team (== the maintainer in v1) walks the threat model and tries to break each control by hand.
- **External:** post-v1, when commercializing, contract a third-party pentest.

Not in v1 scope: bug bounty (see [`../06-security/vulnerability-disclosure.md`](../06-security/vulnerability-disclosure.md)).

## Coverage gaps

Per the table above:

- T-3301 (lethal trifecta) — detection is heuristic; tests should cover the heuristic + edge cases.
- T-3303, T-3304 — operational hygiene; tested by deploy audits, not unit tests.
- T-3306 — clock manipulation; needs a deterministic test harness.

These are tracked; see the audit findings document.

## Linked artifacts

- **Threat model:** [`../06-security/threat-model.md`](../06-security/threat-model.md)
- **Controls matrix:** [`../06-security/controls-matrix.md`](../06-security/controls-matrix.md)
- **Template:** [`../templates/security-test-template.md`](../templates/security-test-template.md)
- **Code:** `tests/unit/security/`, `tests/integration/storage/auditRepository.test.ts`, `tests/lint/no-stdout.test.ts`
- **Sibling:** [`strategy.md`](strategy.md), [`integration-plan.md`](integration-plan.md)

---

*Last reviewed: 2026-04-25 by Chris.*
