---
title: Data Classification
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, auditor]
sdlc_category: 05-data
related: [agent-context-orchestrator-mcp-plan-v6.md §38.2, docs/sdlc/06-security/threat-model.md, docs/sdlc/06-security/lethal-trifecta.md]
---

# Data Classification

> **TL;DR:** Four classes — PUBLIC, INTERNAL, PRIVATE, SECRET. Per-field, not per-table. Drives redaction in context packs, audit-payload sanitization, and lethal-trifecta detection. v6 §38.2 establishes the rank ordering. Default classification is INTERNAL when not explicitly set.

Classification is plumbing. Without it, you can't have lethal-trifecta detection, you can't honor GDPR right-to-redaction, and you can't reason about cross-boundary leakage.

---

## The four classes

| Class | Definition | Examples in atl-mcp |
|---|---|---|
| **PUBLIC** | Safe to display to anyone. No confidentiality concern. | Health endpoint output, version strings, project keys (e.g., "PCO"), public API surface |
| **INTERNAL** | Useful internally; not customer-facing without permission. Default class. | Audit chain entry actors, project blueprints' structural data, log lines (post-redaction), MCP tool descriptions |
| **PRIVATE** | Customer-confidential; never crosses the trust boundary outward without explicit authorization. | Customer source code, project profile prose content, requirements descriptions, issue body text |
| **SECRET** | Authentication / authorization material; never in plaintext outside the moment of use. | API tokens, master encryption key, audit signing private key, webhook shared secrets |

The progression PUBLIC → INTERNAL → PRIVATE → SECRET is the rank ordering from v6 §38.2.

## Where classification is applied

### Per-field, not per-table

Different columns of the same table can have different classifications. Example, `auditEntries`:

| Column | Classification | Why |
|---|---|---|
| `id` | PUBLIC | Just an identifier |
| `actor` | INTERNAL | Useful internally; redacted from any external output |
| `operation` | PUBLIC | Verb + object; describes shape, not content |
| `payload` | varies (often PRIVATE) | Can contain customer data |
| `payload_hash` | INTERNAL | Hash of payload; safe to share |
| `chain_hash` | INTERNAL | Same |
| `signature` | INTERNAL | Useful for verification; doesn't leak content |
| `key_id` | INTERNAL | References a public key in the registry |
| `ts` | PUBLIC | Just a timestamp |

A field's classification dictates how it can be exposed, logged, written to context packs, or sent to external systems.

### Per-input

Inputs to the orchestrator (project profiles, intake markdown, MCP request payloads) get a default classification of INTERNAL unless explicitly elevated by the operator or the source.

Operator can mark a field as PRIVATE in the profile by:

- Including it within a `<private>` tag (or equivalent schema marker).
- Setting `--classification private` on the intake CLI.
- Using a UIO document marked private at the source.

### Per-output

Outputs from the orchestrator inherit the highest classification of their inputs. A blueprint generated from a PRIVATE-classified profile is itself PRIVATE.

This is monotonic — classification can rise but never fall. Specifically: a blueprint's classification can be downgraded only via explicit redaction (replacing PRIVATE content with `[REDACTED]` or a hash).

## How classification is enforced

### In storage

Tables that may contain classified data have an explicit `classification` column. Repositories enforce that reads honor classification when materializing into context packs.

```sql
-- Example: projects table
CREATE TABLE projects (
  id text PRIMARY KEY,
  -- ...other columns...
  blueprint_classification text NOT NULL DEFAULT 'INTERNAL',
  -- the blueprint itself is JSONB; per-field classification is metadata
);
```

### In context-pack generation

Context packs (M7+) include a redaction step that:

- Drops PRIVATE fields entirely if the target context allows it.
- Replaces SECRET fields with `[SECRET]` regardless of context.
- Includes INTERNAL fields with audit logging.
- Includes PUBLIC fields freely.

Code: `src/context/...` (M7).

### In policy decision layer

The lethal-trifecta detector ([`../06-security/lethal-trifecta.md`](../06-security/lethal-trifecta.md)) reads classification labels:

- **Reads PRIVATE/SECRET data** — true if any input field is PRIVATE or SECRET.
- **Processes UNTRUSTED content** — separate provenance check (not classification).
- **Emits externally** — true if the output sink is external.

When all three are true: deny or require approval.

### In logs

Pino redact config covers known SECRET-class field names. PRIVATE-class fields require explicit handling — pino-redact alone isn't enough because PRIVATE content varies in shape. Discipline: never `info`-log a field that's PRIVATE without explicit redaction.

## Default classifications in atl-mcp

| Asset / surface | Default classification |
|---|---|
| MCP tool descriptions | PUBLIC |
| Health / readiness output | PUBLIC |
| Version strings | PUBLIC |
| Project profile prose content | PRIVATE |
| Requirements descriptions | PRIVATE |
| Issue summaries / descriptions | PRIVATE |
| Confluence page bodies | PRIVATE |
| Bitbucket file contents | PRIVATE |
| Audit-entry actor field | INTERNAL |
| Policy-decision reasons | INTERNAL |
| Tokens (any kind) | SECRET |
| Master encryption key | SECRET |
| Audit signing private key | SECRET |

## Classification migration

When a field's classification changes (typically: a field that used to be INTERNAL is found to contain PRIVATE data), the migration:

1. Mark the field with the new (higher) classification.
2. Backfill: scan existing rows; identify any already-emitted-externally records that contained the field; document as a finding.
3. Update redaction rules.
4. Test that existing redaction now covers the field.

Classification migrations are ADR-worthy if they affect more than one field or change cross-boundary semantics.

## Linked artifacts

- **Spec:** v6 §38.2 (ACL ranking)
- **Threat model:** [`../06-security/threat-model.md`](../06-security/threat-model.md)
- **Lethal trifecta:** [`../06-security/lethal-trifecta.md`](../06-security/lethal-trifecta.md)
- **Sibling data docs:** [`schema.md`](schema.md), [`retention.md`](retention.md), [`audit-trail.md`](audit-trail.md)
- **Code:** `src/context/` (redaction, M7+), `src/observability/logger.ts` (pino redact), `src/security/policyAdapters/codePolicyAdapter.ts` (trifecta detection)
- **Compliance:** [`../03-requirements/compliance-scope.md`](../03-requirements/compliance-scope.md)

---

*Last reviewed: 2026-04-25 by Chris.*
