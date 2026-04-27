---
title: Failure-Mode Taxonomy
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, operator]
sdlc_category: 14-incidents
related: [agent-context-orchestrator-mcp-plan-v6.md §30.4]
---

# Failure-Mode Taxonomy

> **TL;DR:** Categorical dictionary of known failure classes. Each postmortem cross-references one (or proposes adding a new). Promoted from v6 §30.4 to a standalone living document. Categories: protocol invariant, schema drift, auth lifecycle, race / concurrency, classification leakage, audit integrity, capacity exhaustion, dependency drift, deploy hygiene, partial recovery.

The taxonomy is what makes postmortems compounding. Each new incident either matches a known mode (so we know what tooling to add) or expands the taxonomy.

---

## Categories

### Protocol invariant violation

The system has a runtime contract; some change broke it.

**Examples:**
- M0 stdout leak (Incident A).
- A new module exports something that violates the public-surface contract.

**Prevention:** invariants encoded as automated checks, not conventions.

### Schema drift

Code expects a schema state that doesn't match reality.

**Examples:**
- Migration applied to wrong-shaped DB (Incident B).
- Data type mismatch between TS type + DB column.

**Prevention:** migration rehearsal; schema-vs-code parity checks.

### Auth lifecycle

Credentials rotate, expire, or are misconfigured.

**Examples:**
- Atlassian token expired without rotation drill.
- Master encryption key rotated without re-encrypt drill (Incident C).
- OAuth 3LO refresh race (PCO-59).

**Prevention:** documented rotation drills; runbook entries; alert on 401 spikes.

### Race / concurrency

Operations interleave in unexpected ways.

**Examples:**
- Concurrent provisioning of overlapping namespaces (PCO-46).
- Two migration runners attempt the same migration simultaneously.
- Audit chain forking under concurrent writes.

**Prevention:** advisory locks, idempotency, serialization at the right boundary.

### Classification leakage

PRIVATE / SECRET data crosses a boundary it shouldn't.

**Examples:**
- A log line contains a token (token leak).
- A context pack includes redacted-only fields without redaction.
- An audit-entry payload contains PII.

**Prevention:** Pino redact, classification policy, lethal-trifecta detection, defense-in-depth at write sites.

### Audit chain integrity

The chain is broken (tampered, mis-signed, mis-rotated).

**Examples:**
- Mid-flight signing key access loss.
- Registry git ref unreachable during write.
- Chain forks because of bad locking.

**Prevention:** fail-closed, key registry with replication, single-writer locks.

### Capacity exhaustion

A bounded resource hits its limit.

**Examples:**
- 1000 concurrent MCP sessions cap reached.
- Postgres connection pool exhausted.
- BullMQ queue depth above threshold.
- File descriptor leak.

**Prevention:** monitoring + alerting on capacity gauges; capacity planning.

### Dependency drift

Third-party behavior changed; we depended on the old behavior.

**Examples:**
- Confluence v2 API representation bug (F-13).
- Atlassian rate-limit policy changed.
- A library upgrade introduced subtle behavior change.

**Prevention:** integration tests against vendor; pinned versions; changelog review on upgrades.

### Deploy hygiene

Deploy itself caused the issue (not the code being deployed).

**Examples:**
- Migration applied without rehearsal.
- Image tag pointed at wrong build.
- Config change rolled out without testing.

**Prevention:** release-process discipline; staging gate; rollback procedure.

### Partial recovery

Recovery succeeded technically but missed something.

**Examples:**
- DB restored from PITR but audit chain lost the gap window.
- Token rotated but the prior token wasn't revoked at source.
- Worktree cleaned up but cached state survived.

**Prevention:** end-to-end recovery verification; runbook procedures cover side effects.

---

## How to use

### When a postmortem references a category

Each postmortem in [`incident-library.md`](incident-library.md) links to one (or more) categories above. The link is a tag — operators use it to find similar prior incidents.

### When a category needs adding

If an incident doesn't fit any category: that's interesting. Propose a new category with:

- Name.
- 1-paragraph description.
- 2+ examples.
- Common prevention pattern.

Categories don't proliferate fast — adding one is a process call.

### When a category needs splitting

If a category has 5+ incidents but with materially different characteristics: split. Each sub-category becomes its own.

## Linked artifacts

- **Spec:** v6 §30.4 (failure-mode taxonomy)
- **Sibling:** [`fix-type-taxonomy.md`](fix-type-taxonomy.md), [`incident-library.md`](incident-library.md), [`postmortem-template.md`](postmortem-template.md)
- **Runbook:** [`../08-operations/runbook.md`](../08-operations/runbook.md) (Incidents A, B, C are real instances)

---

*Last reviewed: 2026-04-25 by Chris.*
