---
title: Audit Chain Recovery
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [operator, engineer, auditor]
sdlc_category: 10-dr-bcp
related: [docs/sdlc/06-security/audit-chain-threat-model.md, docs/adr/0005-audit-signing-pipeline.md]
---

# Audit Chain Recovery

> **TL;DR:** Audit chain integrity is non-negotiable. Recovery is per-scenario: PITR restore preserves chain integrity if the restore point is before any compromise. Lost entries from a window are treated as a security incident — not just data loss. Public key registry git ref + DB audit entries + signing key together enable rebuild.

This is the procedure when the audit chain is compromised, lost, or partially restored. Cross-references: [`../06-security/audit-chain-threat-model.md`](../06-security/audit-chain-threat-model.md) for the threat model, [ADR-0005](../../adr/0005-audit-signing-pipeline.md) for the original design decisions.

---

## Recovery scenarios

### Scenario A: PITR-restored DB, restore time is BEFORE compromise

**Situation:** the chain pre-restore-time is intact and signed; the chain after the restore time is missing.

**Action:**

1. Verify the restored chain end-to-end:

```bash
node scripts/audit-verify.mjs --against-restored
# Should pass — every entry signs against the registered key for its key_id at the entry's timestamp
```

2. Document the gap: a security-incident postmortem records the entries that were lost (which operations, which actors, what time window).

3. Restart the orchestrator pointing at the restored DB. New audit entries chain on from the restored chain's last entry. The chain continues normally.

**Result:** integrity preserved. Operations between the restore point and the corruption time are LOST from the audit log; whatever happened in that window is irretrievable for forensics.

**Severity:** SEV-2. The loss is observable but bounded.

### Scenario B: PITR-restored DB, restore time is AFTER compromise

**Situation:** the restored chain has corrupted entries.

**Action:**

1. Don't promote this restore. Pick an earlier restore time.

2. If no clean restore time exists: **the chain is irretrievable in its current form.** Options:
   - Reconstruct from logs + audit-trace JSONL files (if archive exists) + Postgres WAL — manual, partial, evidence-grade.
   - Treat as "chain rebuilt" — start a new chain post-incident, document the incident in detail, lose forensic continuity for the affected window.

3. Either way: SEV-1 incident. Forensic review of the compromise window.

**Severity:** SEV-1. Chain integrity lost or partial.

### Scenario C: Audit signing private key is lost (file gone)

**Situation:** the file at `AUDIT_KEYPAIR_PATH` is missing.

**Action:**

1. Don't sign new entries with a freshly-generated keypair without registering the new public-half. The verifier won't accept entries signed with an unregistered key.

2. Rotate per [`../06-security/audit-chain-threat-model.md`](../06-security/audit-chain-threat-model.md) "Key rotation procedure":
   - Generate new keypair.
   - Push new public-half to the registry git ref.
   - Mount new private-half at `AUDIT_KEYPAIR_PATH`.
   - Restart.

3. The first entry written with the new key is the rotation event itself. Historical chain (signed with the old key) still verifies because the old public-half stays in the registry forever.

**Severity:** SEV-2 if rotated cleanly. SEV-1 if there's a window where new entries weren't signed (the chain stops).

### Scenario D: Key registry git ref is unreachable

**Situation:** can't push to or read from the registry.

**Action:**

1. The verifier needs the registry to validate `key_id`s. If the registry is unreachable, verification stalls.

2. If only push is unreachable (read still works): no new key rotations possible until restored. New entries continue to sign with the existing active key.

3. If read is also unreachable: investigate the secondary git host (per [`backup-strategy.md`](backup-strategy.md), the registry is replicated). Point the verifier at the secondary.

4. If neither is reachable: the chain can't be verified externally. New writes still happen (signing with the in-memory active key); verification waits.

**Severity:** SEV-2 if write-only blocked. SEV-1 if read+verification blocked.

### Scenario E: Forged entries in the chain (compromise)

**Situation:** verifier passes but operator suspects the chain has forged entries (insider attack with both DB-write and signing-key access).

**Action:**

1. **Don't roll back.** Forensic evidence preservation is paramount. Treat as a security incident.

2. Capture state: dump `auditEntries`, the registry git log, the application logs, and the orchestrator's `policyDecisions` table (which is structurally redundant with the audit chain).

3. Cross-reference: each audit entry has a corresponding `policyDecisions` row (and vice versa). A forged audit entry without a matching policy decision is a tell.

4. Forensic review: per-entry, ask "is this entry's `actor` consistent with the operations that the orchestrator observed?" Look for:
   - Audit entries claiming operations that don't appear in application logs.
   - `policyDecisions` rows with no corresponding audit entry, or vice versa.
   - Timestamps that don't match the orchestrator's clock at the recorded time.

5. Once forged entries are identified: file a SEV-1 incident. Rotate keys. Determine whether to retain the forged entries (with annotation) or excise them (and lose forensic continuity).

**Severity:** SEV-1.

### Scenario F: Genesis-block-level corruption

**Situation:** entry 1 is corrupted or `prev_hash != NULL` for the first entry.

**Action:**

1. The verifier flags this immediately ("genesis block invalid").

2. Restoration paths:
   - PITR to before genesis tampering (only useful if genesis tampering happened recently).
   - Re-write the chain entirely (loses everything; only acceptable as a true last resort).

**Severity:** SEV-1. Genesis is structural; tampering with it implies the chain isn't trustable.

---

## Verification after recovery

After any recovery, re-run end-to-end verification:

```bash
# Walk the chain from genesis to current
node scripts/audit-verify.mjs --full --against-current

# Confirm chain length matches expectations
psql "$DATABASE_URL" -c "SELECT count(*) FROM auditEntries"

# Confirm last entry is recent
psql "$DATABASE_URL" -c "SELECT MAX(ts) FROM auditEntries"

# Confirm /admin/health/audit returns OK
curl /admin/health/audit
```

If any of these fail, the recovery is incomplete.

## What recovery does NOT do

- **Does not retroactively un-do operations.** Whatever was provisioned during the compromised window is provisioned in Atlassian / Bitbucket. Cleaning up those side effects is a separate operation.
- **Does not restore lost forensic context.** Entries that aren't in the chain are gone for forensics.
- **Does not blanket-trust the chain post-recovery.** A recovered chain is still less trusted than an original chain — operators should treat the recovery itself as an event to monitor.

## Linked artifacts

- **Spec:** v6 §30.1 (audit chain durability)
- **ADR:** [ADR-0005](../../adr/0005-audit-signing-pipeline.md)
- **Threat model:** [`../06-security/audit-chain-threat-model.md`](../06-security/audit-chain-threat-model.md)
- **Sibling DR docs:** [`backup-strategy.md`](backup-strategy.md), [`recovery-objectives.md`](recovery-objectives.md), [`failover.md`](failover.md), [`dr-test-schedule.md`](dr-test-schedule.md)
- **Code:** `src/storage/schema/auditEntries.ts`, `src/storage/repositories/policyDecisionRepository.ts`
- **Verifier:** `scripts/audit-verify.mjs` (planned, M11)
- **Operations:** [`../08-operations/runbook.md`](../08-operations/runbook.md) "Audit chain signature mismatch"

---

*Last reviewed: 2026-04-25 by Chris.*
