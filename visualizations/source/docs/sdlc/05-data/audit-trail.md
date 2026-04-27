---
title: Audit Trail
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, auditor]
sdlc_category: 05-data
related: [docs/adr/0005-audit-signing-pipeline.md, docs/sdlc/06-security/audit-chain-threat-model.md]
---

# Audit Trail

> **TL;DR:** Two parallel streams. (1) The audit chain — `auditEntries` table, hash-chained, ed25519-signed, append-only, tamper-evident. (2) The audit-trace JSONL — flat structured event stream useful for queryability and observability. Both record every state change; the chain is the security artifact, the JSONL is the operational artifact.

This is the canonical pointer for "what happens when something is audited." For the security threat model: [`../06-security/audit-chain-threat-model.md`](../06-security/audit-chain-threat-model.md).

---

## Two streams, one source of truth

| Stream | Where | Purpose | Consumer |
|---|---|---|---|
| Audit chain | `auditEntries` (Postgres table) | Tamper-evident integrity | Verifier; auditors |
| Audit trace JSONL | File / object storage (M11) | Fast queryability + observability | Ops dashboards; investigation |

The chain is the source of truth. The trace is a denormalized projection.

## Audit chain construction

Each entry in `auditEntries`:

| Column | Purpose |
|---|---|
| `id` | UUIDv7 primary key |
| `tenant_id` | Tenant scope |
| `actor` | Session / operator that initiated |
| `operation` | Verb + object (e.g. `jira.issue.create`) |
| `payload` | Canonical JSON of inputs + outputs |
| `prev_hash` | SHA-256 of prior entry's full canonical serialization (NULL for genesis) |
| `payload_hash` | SHA-256(payload after RFC 8785 JCS canonicalization) |
| `chain_hash` | SHA-256(prev_hash ‖ payload_hash) |
| `signature` | ed25519 signature over chain_hash |
| `key_id` | References public key in registry git ref |
| `ts` | Server-generated timestamp |

Per-entry construction is deterministic: same inputs → same hashes → same signature (when same key).

## What gets audited

**Always audited:**
- Every state-changing operation against external systems (Jira, Confluence, Bitbucket).
- Every policy decision (allow / deny / require_approval).
- Every audit-chain key rotation event.
- Every storage migration applied.
- Every secret rotation (the rotation event, not the secret itself).
- Every webhook delivery (valid signature, invalid signature, duplicate, processed).
- Session open / close.
- Operator actions on the mgmt REST.

**Not audited (by design):**
- Read-only operations (GETs).
- MCP capability negotiation handshakes (session open is enough).
- Health checks.
- Counter increments / log lines.

## Payload classification

Audit-entry payloads can contain content of any classification. Per [`classification.md`](classification.md), discipline:

- Avoid PRIVATE / SECRET data in payloads.
- Reference identifiers, not bodies. ("issue PCO-9 created" not "issue PCO-9 with body containing customer-confidential text").
- When unavoidable: redact at write time using the redaction rules.

This conflicts somewhat with GDPR right-to-erasure (see [`../03-requirements/compliance-scope.md`](../03-requirements/compliance-scope.md)). Mitigation: payload redaction post-hoc (replace PII with hashes) preserves chain integrity.

## Audit chain reads

### Verifier

Offline tool that walks the chain end-to-end:

```bash
node scripts/audit-verify.mjs --tenant <id> [--from <ts>] [--to <ts>]
```

Walks in order, recomputes each `chain_hash`, validates each signature against the registered key. Reports:

- `ok` with chain length.
- `failed at entry K` with specific failure (chain break, signature invalid, key unknown).

### SQL queries

For ad-hoc audit / forensic queries:

```sql
-- Recent activity by actor
SELECT operation, ts FROM auditEntries
WHERE actor = $1 AND ts > now() - interval '7 days'
ORDER BY ts DESC LIMIT 100;

-- Chain length per tenant
SELECT tenant_id, count(*) FROM auditEntries GROUP BY tenant_id;

-- Last verified timestamp
SELECT max(ts) FROM auditEntries;
```

These are operationally useful but **don't verify integrity** — only the verifier does.

## Audit trace JSONL (v6 §27.4)

Parallel stream:

- One JSONL file (or rotating set).
- Each line: `(ts, traceId, spanId, actor, operation, outcome, payload_summary, ...)`.
- Reconstructible from `auditEntries` if lost.

When `auditEntries` is the integrity-grade record, the JSONL is the analytics-grade record. Different ergonomics; same source events.

## Genesis block

The first entry has `prev_hash = NULL`. Verifier handles as a special case. See [`../06-security/audit-chain-threat-model.md`](../06-security/audit-chain-threat-model.md) for the rationale.

## Retention

Audit chain: **indefinite.** Never pruned. See [`retention.md`](retention.md).

The implication: chain length grows monotonically. Capacity planning ([`../15-capacity/`](../15-capacity/)) accounts for it.

## Linked artifacts

- **Spec:** v6 §30.1 (audit log full design), §27.4 (Agent Trace JSONL)
- **ADR:** [ADR-0005](../../adr/0005-audit-signing-pipeline.md)
- **Threat model:** [`../06-security/audit-chain-threat-model.md`](../06-security/audit-chain-threat-model.md)
- **Code:** `src/storage/schema/auditEntries.ts`, `src/storage/repositories/...`
- **Recovery:** [`../10-dr-bcp/audit-chain-recovery.md`](../10-dr-bcp/audit-chain-recovery.md)
- **Sibling docs:** [`schema.md`](schema.md), [`classification.md`](classification.md), [`retention.md`](retention.md)

---

*Last reviewed: 2026-04-25 by Chris.*
