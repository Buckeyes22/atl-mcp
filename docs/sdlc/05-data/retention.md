---
title: Data Retention
owner: Chris
status: accepted
last_reviewed: 2026-04-27
version: 1.1.0
audience: [engineer, auditor, operator]
sdlc_category: 05-data
related: [docs/sdlc/05-data/classification.md, docs/sdlc/03-requirements/compliance-scope.md]
---

# Data Retention

> **TL;DR:** Per-table retention policy. Audit chain is indefinite (forensic + integrity). Application logs 90 days hot + 1 year cold (when archive lands in M11). Webhook deliveries 30 days. Project profiles + blueprints retained for the project's lifecycle. Tokens retained until rotated. Pruning is automated where applicable; manual procedures documented for the rest.

The discipline: every persistent table has a retention policy, even if "indefinite" is the answer. "Indefinite" is a choice, not a default.

---

## Per-table retention

| Table | Retention | Pruning method | Reasoning |
|---|---|---|---|
| `auditEntries` | Indefinite | None | Forensic integrity; chain is append-only |
| `policyDecisions` | 1 year | Cron job (M11) | Redundant with audit chain; pruning bounds size |
| `projects` (profiles + blueprints) | Customer-managed | Customer-initiated | The customer owns the data lifecycle |
| `projectProfiles` | 90 days | Cron job; respects TTL field | Discovery results are reproducible from upstream |
| `traceLinks` | Per-project | Customer-initiated | Tied to project lifecycle |
| `contextPacks` | 30 days | Cron job (M7+) | Regeneratable from inputs |
| `agentMemoryEntries` | Per-project | `memory_forget` or customer-initiated purge | Project knowledge; soft-delete keeps auditability |
| `workAssignments` | Per-project | Customer-initiated purge with project lifecycle | Assignment intent is tied to project execution and review history |
| `contentQualityReports` | Per-project, recommend 1 year after project archive | Customer-initiated purge or future cron | Quality evidence supports audit/review but can contain project-private findings |
| `aclEntries` | Per-TTL | Cron job; refreshes on permission webhook | Cache; refreshable |
| `mcpSessionProfiles` | TTL = HTTP session lifetime | In-memory + DB; eviction on session close | Ephemeral |
| `readinessReports` | Indefinite (per-project) | Customer-initiated | Audit / handoff record |
| `encryptedTokens` | Until rotated; old rows kept 7 days post-rotation | Manual | Rollback safety |
| `provisionJobs` | 90 days | Cron job (M11) | Observability + debugging |
| `webhookDeliveries` | 30 days | Cron job (M11) | Dedup window |

## Pruning mechanisms

### Cron jobs (planned, M11)

For tables with bounded retention:

```
DELETE FROM <table>
WHERE created_at < now() - interval '<retention period>'
  AND <classification-specific exclusions>
```

Pruning is itself an audit-loggable event when it touches policyDecisions or webhookDeliveries (we don't want silent data loss; we want documented purges).

### Manual pruning

For customer-managed retention (projects, traceLinks):

- Customer issues a delete request via mgmt REST.
- Repository's tenant-scope check confirms permission.
- Audit chain entry written: "project deleted by <actor>".

### What doesn't get pruned

- `auditEntries`. Ever.
- The audit signing key registry. Old keys retained indefinitely (historical entries reference them).

## Audit chain retention specifics

The audit chain is **append-only** and **never truncated** without an extreme reason (full DR scenario; per [`../10-dr-bcp/audit-chain-recovery.md`](../10-dr-bcp/audit-chain-recovery.md)).

This conflicts with GDPR right-to-erasure when an audit entry contains personal data. Mitigation: classification-aware payload hygiene (don't put PII in audit payloads). Documented as a v1 limitation in [`../03-requirements/compliance-scope.md`](../03-requirements/compliance-scope.md).

For an erasure request that involves a historical audit entry: the **payload** can be redacted (replaced with hashes / `[REDACTED]` markers) while the **signed envelope** survives. Chain integrity is preserved; forensic detail is reduced.

## Logs

Application logs (`./orchestrator.log` and successors after rotation):

- **Hot retention:** 90 days on the application host.
- **Cold archive (M11):** rotated logs shipped to object storage; retained 1 year.
- **Pruning:** automatic via log rotation policy (size-based for hot; age-based for cold).

Cold archive is M11 work; v1 has no cold archive — once a log file is rotated and removed locally, it's gone unless the deploy platform's log-shipping captures it.

## Backup retention

Per [`../10-dr-bcp/backup-strategy.md`](../10-dr-bcp/backup-strategy.md):

- PITR continuous: 7 days.
- Daily snapshots: 30 days.
- Quarterly long-term: 4 quarters minimum.

## Customer data export / portability

When a customer wants their data:

- mgmt REST exports project blueprints as JSON.
- DB dump captures everything (operator-mediated).
- Audit entries for that customer can be exported (with payloads).

GDPR portability satisfied via these mechanisms in v1 single-tenant on-prem (the customer has direct DB access).

## Customer data deletion

When a customer wants their data deleted:

- Application-level delete on `projects` cascades to dependent tables.
- The audit-chain payload redaction procedure (above) for entries that referenced the deleted project.
- Backups remove the customer's data on the natural backup-retention timeline (no immediate purge from PITR).

The PITR retention is the longest tail; customers are advised that deletion is "complete" only after backup retention expires.

## Logging the retention machinery

The pruning cron jobs themselves are auditable:

- Each pruning batch logs: `(table, criteria, rows_deleted, ts)`.
- Pruning of policyDecisions and webhookDeliveries is summarized into the audit chain (one entry per batch, not per row).

This is overkill for some tables and proportionate for others. The discipline: prefer over-auditing pruning to under-auditing.

## Linked artifacts

- **Spec:** v6 §30.1 (audit chain durability — implicitly indefinite)
- **Sibling data docs:** [`schema.md`](schema.md), [`classification.md`](classification.md), [`audit-trail.md`](audit-trail.md), [`migrations.md`](migrations.md)
- **Compliance:** [`../03-requirements/compliance-scope.md`](../03-requirements/compliance-scope.md)
- **DR:** [`../10-dr-bcp/backup-strategy.md`](../10-dr-bcp/backup-strategy.md), [`../10-dr-bcp/audit-chain-recovery.md`](../10-dr-bcp/audit-chain-recovery.md)
- **Code:** schema files in `src/storage/schema/`; pruning scripts in `scripts/maintenance/` (planned M11)

---

*Last reviewed: 2026-04-27 by Chris.*
