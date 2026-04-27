---
title: Incident Library
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, operator, auditor]
sdlc_category: 14-incidents
related: [docs/sdlc/14-incidents/postmortem-template.md, docs/sdlc/08-operations/runbook.md]
---

# Incident Library

> **TL;DR:** Indexed catalog of past incidents and DR drills. Each entry: incident ID, date, severity, failure-mode + fix-type tags, one-line root cause, link to full postmortem. Three documented production incidents to date (A/B/C) — these shape the runbook + threat model + iron laws. Future incidents are filed here in the same shape.

The library is operational memory. When a new alert fires, the responder asks "have we seen this before?" — this is where they look.

---

## Index

| ID | Date | Severity | Failure mode | Fix type | One-line root cause | Postmortem |
|---|---|---|---|---|---|---|
| INC-2026-01 | (M0 era) | SEV-2 | Protocol invariant | Tooling-encoded invariant | `console.log` shipped in `src/mcp/sessionCapabilities.ts` corrupted MCP stdio | [Incident A](#incident-a--m0-stdout-leak) |
| INC-2026-02 | (M1 era) | SEV-2 | Schema drift | Tooling-encoded invariant + automated check | Migration assumed an indexed column existed; pglite vacuum hid the assumption | [Incident B](#incident-b--migration-applied-to-wrong-shaped-db) |
| INC-2026-03 | (M1 era) | SEV-2 | Auth lifecycle | Runbook entry + design-change-to-be (PCO-57) | Master encryption key rotated; existing token rows undecryptable | [Incident C](#incident-c--encryption-key-rotation-broke-token-reads) |

(Future entries below as they happen.)

---

## Incident A — M0 stdout leak

### Metadata

- **ID:** INC-2026-01
- **Severity:** SEV-2 (broke MCP clients silently; not customer-visible because no production customers)
- **Date:** M0 era
- **Owner:** Chris
- **Customer-impacting:** No (pre-customer)
- **Data loss:** No

### CATCH

- **Trigger:** First MCP client connection failed silently. The connection closed within ~100 ms of session start.
- **Detection latency:** Several days. The `lint:no-stdout` check landed in M1; the failure had been present since M0.
- **Initial responder:** Chris (working on M1).

### DIAGNOSE

| Time | Action | Outcome |
|---|---|---|
| T0 | Noticed MCP client wouldn't initialize | Hypothesis: capability negotiation broken |
| T0+5m | Tested capability negotiation in isolation | Worked fine standalone |
| T0+10m | Read MCP transport stdout in real time | Saw a `console.log` from `src/mcp/sessionCapabilities.ts` interleaved with JSON-RPC frames |
| T0+15m | Identified offending line | `console.log("registering capabilities", caps)` left in for debugging |
| T0+20m | Removed line | Client initialized correctly |

### ROOT CAUSE

- **Proximate:** A `console.log` in production code path corrupted the JSON-RPC stream the client was reading.
- **Distal:** M0 had no automated check for the protocol invariant ("never write to stdout from `src/`"). The rule was a convention, not tooling. The PR review didn't catch it because the diff was small + the consequence wasn't obvious until runtime.

### FIX

- Removed the offending `console.log`.
- Mitigation time: < 30 min from identification.
- Verification: client initialized cleanly; subsequent tool calls succeeded.

### SAVE

- The offending diff: preserved in git history.
- Test added: `tests/lint/no-stdout.test.ts` runs the lint as a vitest test.
- Lint script added: `scripts/lint-no-stdout.mjs`.
- CLAUDE.md operating rule documented.

### ENFORCE

- [x] Lint added to CI gates from M1 forward.
- [x] CLAUDE.md operating rule explicit: "Never write to stdout from `src/`."
- [x] AGENTS.md cross-references the rule.
- [ ] (Open, PCO-12): regex-based lint misses alias forms (`const w = process.stdout`). Replacement is an AST-walk lint. Tracked.

### Lesson

> **Invariants are tooling, not vibes.**

Protocol-level invariants must be encoded as automated checks before any production code that depends on them. The discipline can't survive on convention alone.

The lesson generalized: every iron-law-class invariant in the project gets a tooling check (or is on the list to get one). Anti-slop scanner is the broader version.

### Linked artifacts

- Code: `scripts/lint-no-stdout.mjs`, `tests/lint/no-stdout.test.ts`
- Operating rule: [`../../../CLAUDE.md`](../../../CLAUDE.md)
- Runbook entry: [`../08-operations/runbook.md`](../08-operations/runbook.md) "MCP clients drop within ~100 ms"
- Quality doc: [`../13-quality/anti-slop.md`](../13-quality/anti-slop.md)
- Tracking: PCO-12 (alias-form gap)

---

## Incident B — Migration applied to wrong-shaped DB

### Metadata

- **ID:** INC-2026-02
- **Severity:** SEV-2 (caught in dev → blocked promotion to staging; production never reached)
- **Date:** M1 era
- **Owner:** Chris
- **Customer-impacting:** No
- **Data loss:** No (dev only)

### CATCH

- **Trigger:** A migration intended to add a column passed locally; staging promotion failed.
- **Detection latency:** Hours (between local apply and staging attempt).
- **Initial responder:** Chris.

### DIAGNOSE

| Time | Action | Outcome |
|---|---|---|
| T0 | Migration `0002_*.sql` applied locally; tests green | Dev believed it worked |
| T0+1h | Promoted to staging | Migration failed: missing index expected by post-condition |
| T0+1h+5m | Compared dev pglite state vs. staging Postgres | Pglite vacuum had removed the index; Postgres still had it |
| T0+1h+15m | Migration was relying on the index existing in a way that was true in Postgres but vacuum-cleaned in pglite | Hypothesis confirmed |

### ROOT CAUSE

- **Proximate:** The migration's behavior depended on an index that pglite had vacuumed out but Postgres still had. The dev pass was a false positive.
- **Distal:** The migration was hand-applied. There was no rehearsal mechanism — no way to apply a pending migration to a prod-shaped snapshot before promotion. "Test in dev, push to staging" was the protocol; dev and prod could diverge silently.

### FIX

- Reverted the staging migration attempt.
- Wrote a corrected migration that didn't depend on the vacuum-sensitive condition.
- **Built a migration runner with rehearsal mode** (PCO-13): applies a pending migration to a temp DB seeded from a prod-shaped snapshot, runs post-condition assertions, tears down. Rehearsal is mandatory before production apply.

### SAVE

- The original (broken) migration: preserved in branch history.
- Rehearsal harness: `tests/integration/storage/migrationRehearsal.test.ts`.
- Migration runner: `src/storage/migrationRunner.ts`.

### ENFORCE

- [x] Migration runner with rehearsal mode shipped (PCO-13).
- [x] CI gate from M1 forward: `tests/integration/storage/migrationRehearsal.test.ts` must pass.
- [x] Migration authoring rules updated in [`../05-data/migrations.md`](../05-data/migrations.md).
- [ ] (Open, PCO-56): pglite vacuum behavior still differs from Postgres for some edge cases. Documented; mitigation is to rehearse against a Postgres snapshot when migrations touch indexed columns specifically.

### Lesson

> **"Works in dev" is unsafe when dev and prod can diverge silently. Test against a prod-shaped surface.**

Every backend with mocking/aliasing for dev (pglite, in-memory caches, mocked HTTP) creates a divergence risk. The rehearsal pattern is one mitigation; explicit dev-prod parity discipline is the broader frame.

### Linked artifacts

- Code: `src/storage/migrationRunner.ts`
- Test: `tests/integration/storage/migrationRehearsal.test.ts`
- Migrations doc: [`../05-data/migrations.md`](../05-data/migrations.md)
- Runbook entry: [`../08-operations/runbook.md`](../08-operations/runbook.md) "Migration runner stuck"
- Tracking: PCO-13 (rehearsal — closed); PCO-56 (vacuum gap — open)

---

## Incident C — Encryption key rotation broke token reads

### Metadata

- **ID:** INC-2026-03
- **Severity:** SEV-2 (operator could not authenticate to Atlassian after key rotation)
- **Date:** M1 era
- **Owner:** Chris
- **Customer-impacting:** No (single-operator dev)
- **Data loss:** No (recovered with old key)

### CATCH

- **Trigger:** After rotating `TOKEN_MASTER_KEY`, all subsequent Atlassian REST calls returned 401.
- **Detection latency:** Within minutes (next REST call failed).
- **Initial responder:** Chris.

### DIAGNOSE

| Time | Action | Outcome |
|---|---|---|
| T0 | Rotated `TOKEN_MASTER_KEY`; restarted server | Server started fine |
| T0+5m | Made an Atlassian REST call | 401 Unauthorized |
| T0+10m | Checked token decryption | Decrypt failed for existing rows (auth-tag mismatch with new key) |
| T0+15m | Realized: rotation didn't re-encrypt existing rows | Hypothesis: the token store was single-key by design |
| T0+20m | Restored old `TOKEN_MASTER_KEY` from secret manager backup | Decrypts succeeded; service recovered |

### ROOT CAUSE

- **Proximate:** Rotating the master key invalidated all existing sealed tokens because the token store has no automated re-encrypt path.
- **Distal:** The token store was designed assuming a single, never-rotated master key. The threat model treats master-key rotation as a separate ceremony — but no operational procedure existed to bridge between "old key" and "new key" without service interruption.

### FIX

- Reverted to the previous master key.
- Documented the issue as a **known limitation** in [`../06-security/token-storage.md`](../06-security/token-storage.md).
- Added a re-encrypt drill procedure to the runbook.

### SAVE

- The two key versions retained in secret manager (with retention period).
- Runbook entry: "Master-key rotation drill" in [`../08-operations/runbook.md`](../08-operations/runbook.md).
- Audit findings entry F-03 documents the gap.

### ENFORCE

- [x] Runbook drill procedure documented.
- [x] Audit findings F-03 tracks the limitation.
- [x] PCO-57 tracks the long-term fix (envelope encryption with per-row data keys; decoupling master rotation from per-token rotation).
- [ ] (Open, PCO-57): the actual envelope-encryption refactor lands post-v1 / when multi-tenant is on the runway.

### Lesson

> **Crypto rotation is a system, not a key change. Plan the rotation procedure before issuing the key.**

Single master key is a design choice that simplifies v1 but creates this exact failure mode under rotation. Envelope encryption is the standard fix; deferring it for v1 was deliberate but costs the manual drill discipline.

For any future "single X" design (single signing key, single config source, single secret) — assume rotation will be needed eventually and design for it OR document the procedure that bridges the gap.

### Linked artifacts

- Token store doc: [`../06-security/token-storage.md`](../06-security/token-storage.md)
- Runbook: [`../08-operations/runbook.md`](../08-operations/runbook.md) Incident C section
- DR: [`../10-dr-bcp/audit-chain-recovery.md`](../10-dr-bcp/audit-chain-recovery.md) (analogous procedure)
- Tracking: PCO-57 (envelope encryption — open)

---

## DR drills (when populated)

DR drills follow the same template as real incidents. They live here, tagged `incidentType: "DR-drill"`, distinguished from real incidents but with the same shape.

The first scheduled drill is in Q1 of post-launch operations — see [`../10-dr-bcp/dr-test-schedule.md`](../10-dr-bcp/dr-test-schedule.md).

---

## How to add a new entry

1. Identify next sequential ID (`INC-YYYY-NN`).
2. Write the postmortem using [`../templates/postmortem-template.md`](../templates/postmortem-template.md).
3. Add a row to the index table (top of this file).
4. Add a section below following the same shape as A/B/C.
5. Cross-reference from the runbook + threat model + relevant ADR if applicable.

The discipline: every SEV-2+ gets a row. Anything less consistent and the library decays.

## Linked artifacts

- **Template:** [`../templates/postmortem-template.md`](../templates/postmortem-template.md)
- **Sibling docs:** [`postmortem-template.md`](postmortem-template.md), [`failure-mode-taxonomy.md`](failure-mode-taxonomy.md), [`fix-type-taxonomy.md`](fix-type-taxonomy.md), [`blameless-review.md`](blameless-review.md)
- **Operations:** [`../08-operations/runbook.md`](../08-operations/runbook.md), [`../08-operations/on-call-playbook.md`](../08-operations/on-call-playbook.md)
- **Audit findings:** [`../../audit-findings-2026-04-25.md`](../../audit-findings-2026-04-25.md), [`../../demo/audit-remediation-summary.md`](../../demo/audit-remediation-summary.md)
- **Spec:** v6 §30.3 (postmortem framework), §30.4 (failure-mode taxonomy), §30.5 (fix-type taxonomy)

---

*Last reviewed: 2026-04-25 by Chris.*
