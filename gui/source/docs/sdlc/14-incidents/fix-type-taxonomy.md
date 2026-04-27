---
title: Fix-Type Taxonomy
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, operator]
sdlc_category: 14-incidents
related: [agent-context-orchestrator-mcp-plan-v6.md §30.5, docs/sdlc/14-incidents/failure-mode-taxonomy.md]
---

# Fix-Type Taxonomy

> **TL;DR:** Categorical dictionary of how problems get fixed. Pairs with the failure-mode taxonomy. Each postmortem records both — what failed, and how it got fixed. Categories: tooling-encoded invariant, automated check addition, runbook entry, schema-level constraint, code path correction, configuration change, documentation correction, dependency upgrade, capacity expansion, design change. v6 §30.5.

A failure-mode taxonomy without a fix-type taxonomy is half-done. Knowing "this was a schema-drift class" is useful; knowing "we fixed it with tooling-encoded invariants" is what teaches the team's reflexes.

---

## Categories

### Tooling-encoded invariant

A rule that was previously a convention becomes machine-checked.

**Examples:**
- `lint:no-stdout` after Incident A. The rule "no stdout from `src/`" went from "we know not to" to "the build fails if you do."
- The migration runner's rehearsal mode after Incident B. "Test against prod-shape first" became mandatory.
- Pino redact config additions when a new secret-bearing field appears.

**Why this is the strongest fix type:** discipline that depends on humans degrades over time. Tooling-encoded invariants don't.

**Cost:** writing the tool. Often non-trivial (the lint:no-stdout regex is simple; the AST-walk replacement in PCO-12 is more work).

**When it's the right call:** when the convention is universal AND the violation has high blast radius.

### Automated check addition

A specific case is added to an existing check.

**Examples:**
- A new entry to the Pino redact list when a new secret-bearing field is introduced.
- A new test in `tests/integration/storage/migrationRehearsal.test.ts` when a new schema invariant is identified.
- A new ESLint rule for a specific anti-pattern.

**Cost:** lower than building new tooling — you're extending what exists.

**When it's the right call:** when the failure mode is in scope of an existing check that just didn't cover this case.

### Runbook entry

A new entry under the symptom-organized runbook so the next responder doesn't re-derive the diagnosis.

**Examples:**
- "MCP clients drop within ~100 ms" entry after Incident A.
- "Audit chain signature mismatch" entry pre-Incident-D (added prophylactically based on threat model).
- "Provider 401 spike" entry derived from PCO-59 + general operational pattern.

**Cost:** time to write + the discipline of always updating after an incident.

**When it's the right call:** when the incident is recoverable but the diagnosis was non-trivial. Future occurrences should be cheaper.

### Schema-level constraint

A constraint at the data layer prevents a class of bug.

**Examples:**
- UNIQUE constraint on `(source, deliveryId)` in `webhookDeliveries` enforces dedup.
- UNIQUE constraint on `(tenant_id, prev_hash)` in `auditEntries` (excluding NULL genesis) prevents chain forking.
- NOT NULL constraints on classification metadata.

**Cost:** schema migration; potentially data-cleanup if existing rows violate.

**When it's the right call:** when the violation is structurally preventable. Code-level checks can be bypassed; schema-level can't (without explicit drop).

### Code path correction

Fix the code that has the bug.

**Examples:**
- Replace a regex with an AST walk (PCO-12 fix when it lands).
- Add backoff jitter to retry logic.
- Fix a state-machine transition that allowed an illegal path.

**Cost:** the fix itself + tests that cover the missing case.

**When it's the right call:** when the failure is genuinely a code bug, not a process / tooling gap.

### Configuration change

The code is right; the config was wrong.

**Examples:**
- `MGMT_API_HOST` was bound to non-loopback in non-dev (warning ignored).
- `LOG_LEVEL=trace` left on in production (volume + leakage risk).
- A feature flag flipped without intent.

**Cost:** revert + ensure the wrong config can't recur (validation at startup).

**When it's the right call:** the most-common fix during early operational maturity.

### Documentation correction

The doc said one thing; reality was another.

**Examples:**
- Runbook said "rotate every 90 days"; reality was "rotate at-will, no schedule."
- Architecture doc said "single Postgres"; reality had become "Postgres + Redis."
- ADR-0003 said "ADF only" but the storage-format fallback was added in code without ADR update.

**Cost:** time to update + cross-link integrity check.

**When it's the right call:** when reality has drifted ahead of docs. Often discovered during postmortems.

### Dependency upgrade

The bug was in a third-party library; upgrade fixed it.

**Examples:**
- A pino bug fixed in pino@9.x (hypothetical).
- An ADF library round-trip bug fixed upstream.
- A vitest concurrency bug fixed in a patch release.

**Cost:** dependency upgrade + verification + risk of new behavior in the upgrade.

**When it's the right call:** when the upstream has a fix; we just need to take it.

### Capacity expansion

Scale up to fit the workload.

**Examples:**
- Increase Postgres connection pool size.
- Add more BullMQ workers.
- Provision more disk for log retention.

**Cost:** infrastructure cost + operational complexity.

**When it's the right call:** when the workload itself is legitimate and the resource ceiling was the constraint. NOT when the workload is a bug producing extra work.

### Design change

The design itself was wrong; refactor.

**Examples:**
- Single master encryption key → envelope encryption (PCO-57; the long-term Incident C fix).
- Single-tenant audit chain → multi-tenant per-customer chains (post-v1; PCO-51).
- Synchronous tool dispatch → async queue for long operations.

**Cost:** big. Often spans milestones. Always requires an ADR.

**When it's the right call:** when the failure mode recurs across many incidents AND the cost of repeated band-aids exceeds the cost of the redesign.

---

## How fix-type interacts with failure-mode

<figure>

<style>
.fmatrix { width:100%; border-collapse:collapse; font-family:'IBM Plex Sans', sans-serif; font-size:12px; }
.fmatrix th, .fmatrix td { border-bottom:1px solid var(--rule); padding:14px 12px; vertical-align:top; text-align:left; }
.fmatrix th { font-family:'IBM Plex Mono', monospace; font-size:10px; letter-spacing:1.4px; color:var(--ink-3); font-weight:500; background:#faf9f6; padding-top:10px; padding-bottom:10px; border-bottom:1px solid var(--rule-strong); }
.fmatrix td.fail { font-weight:600; color:var(--ink); width:18%; }
.fmatrix td.det  { font-family:'IBM Plex Mono', monospace; font-size:11px; color:var(--ink-2); width:18%; }
.fmatrix td.ctrl { width:24%; color:var(--ink-2); }
.fmatrix td.test { font-family:'IBM Plex Mono', monospace; font-size:10.5px; color:var(--ink-2); width:22%; word-break:break-all; }
.fmatrix td.spec { font-family:'IBM Plex Mono', monospace; font-size:10.5px; color:var(--ink-3); width:18%; }
.tag { display:inline-block; font-family:'IBM Plex Mono'; font-size:9.5px; padding:2px 6px; border-radius:2px; margin-right:6px; letter-spacing:0.4px; vertical-align:1px; }
.t-crit { background:#fbe7e4; color:#7a1d14; }
.t-high { background:#fbeed8; color:#7a4408; }
.t-med  { background:#dde9f2; color:#11364f; }
.t-low  { background:#dceee5; color:#0e3d2f; }
.fmatrix tr.group td { background:#f0ede5; font-family:'IBM Plex Mono'; font-size:10.5px; letter-spacing:1.4px; color:var(--ink-3); padding:8px 12px; }
.fclosed { display:inline-block; font-family:'IBM Plex Mono'; font-size:9.5px; padding:1px 5px; background:#fbe7e4; color:#7a1d14; border-radius:2px; margin-left:6px; }
</style>

<table class="fmatrix">
  <thead>
    <tr>
      <th>failure mode</th>
      <th>detection signal</th>
      <th>control · how it's prevented or contained</th>
      <th>validating test</th>
      <th>spec ref</th>
    </tr>
  </thead>
  <tbody>

    <tr class="group"><td colspan="5">SECURITY · INTEGRITY</td></tr>

    <tr>
      <td class="fail"><span class="tag t-crit">crit</span>audit chain forged / broken</td>
      <td class="det">verifier rejects chain · prev_hash mismatch</td>
      <td class="ctrl">hash chain + ed25519 sig + git-ref versioned key registry · fail-closed on write fail<span class="fclosed">fail-closed</span></td>
      <td class="test">tests/integration/audit/<br>chainConstruction.test.ts<br>tamperDetection.test.ts</td>
      <td class="spec">ADR-0005 · v6 §30.1</td>
    </tr>
    <tr>
      <td class="fail"><span class="tag t-crit">crit</span>token exfiltrated</td>
      <td class="det">unexpected outbound to non-whitelisted host · token in log</td>
      <td class="ctrl">XChaCha20-Poly1305 envelope · master key in env only · pino redact on secret paths · loopback default for mgmt API</td>
      <td class="test">tests/unit/security/<br>tokenEncryption.test.ts</td>
      <td class="spec">ADR-0002 · v6 §29</td>
    </tr>
    <tr>
      <td class="fail"><span class="tag t-crit">crit</span>lethal trifecta op</td>
      <td class="det">policy decision flags PRIVATE × UNTRUSTED × EXTERNAL</td>
      <td class="ctrl">policy decision layer · classification at ingestion · provenance tracking · deny ≥ 0.95 conf, else require_approval</td>
      <td class="test">tests/integration/policy/<br>trifectaDetection.test.ts</td>
      <td class="spec">v6 §38.1</td>
    </tr>
    <tr>
      <td class="fail"><span class="tag t-high">high</span>forged webhook delivery</td>
      <td class="det">HMAC mismatch on /webhooks · 401 returned</td>
      <td class="ctrl">HMAC-SHA256 + constant-time compare · per-source shared secret · delivery dedup by (source, deliveryId)</td>
      <td class="test">tests/unit/security/<br>webhookSignatures.test.ts</td>
      <td class="spec">v6 §26.1</td>
    </tr>

    <tr class="group"><td colspan="5">CORRECTNESS · IDEMPOTENCY</td></tr>

    <tr>
      <td class="fail"><span class="tag t-high">high</span>duplicate provisioning</td>
      <td class="det">re-run produces second epic / page / branch</td>
      <td class="ctrl">idempotency keys on every provision op · unique constraints in storage · planner emits diff, not full replay</td>
      <td class="test">tests/integration/storage/<br>repositories.test.ts (concurrent insert)</td>
      <td class="spec">v6 §1 mission · M5 planner</td>
    </tr>
    <tr>
      <td class="fail"><span class="tag t-high">high</span>mid-execute crash</td>
      <td class="det">job stuck in_progress past timeout</td>
      <td class="ctrl">state stays PROVISIONING_EXECUTED · partial successes recorded · re-pickup is idempotent · BullMQ retry semantics</td>
      <td class="test">tests/integration/queue/<br>recovery.test.ts</td>
      <td class="spec">module-queue.md · v6 §24</td>
    </tr>
    <tr>
      <td class="fail"><span class="tag t-high">high</span>migration drift</td>
      <td class="det">post-condition assertion fails · /readyz red</td>
      <td class="ctrl">migration rehearsal (PCO-13) before apply · stops runner on rehearsal failure</td>
      <td class="test">tests/integration/storage/<br>migrationRehearsal.test.ts</td>
      <td class="spec">module-storage.md (Incident B response)</td>
    </tr>
    <tr>
      <td class="fail"><span class="tag t-med">med</span>stdout corruption</td>
      <td class="det">MCP client disconnects · session_init failure</td>
      <td class="ctrl">pino file-only · lint:no-stdout enforces protocol invariant on every PR<span class="fclosed">CI gate</span></td>
      <td class="test">tests/lint/no-stdout.test.ts</td>
      <td class="spec">CLAUDE.md · Incident A</td>
    </tr>

    <tr class="group"><td colspan="5">DEGRADED OPERATION</td></tr>

    <tr>
      <td class="fail"><span class="tag t-med">med</span>sampling unavailable</td>
      <td class="det">provider 5xx · timeout</td>
      <td class="ctrl">degraded plan path · operator warning surfaced · adversarial triplet skipped with explicit flag (not silent)</td>
      <td class="test">tests/integration/workflows/<br>blueprint.degraded.test.ts</td>
      <td class="spec">module-workflows.md</td>
    </tr>
    <tr>
      <td class="fail"><span class="tag t-med">med</span>vendor 429 storm</td>
      <td class="det">atlassian_429_total counter rises</td>
      <td class="ctrl">exponential backoff · retry budget · per-tenant rate-limit state · queue back-pressure</td>
      <td class="test">tests/unit/providers/<br>retryLogic.test.ts</td>
      <td class="spec">module-providers-atlassian.md</td>
    </tr>
    <tr>
      <td class="fail"><span class="tag t-med">med</span>capability cache stale</td>
      <td class="det">field-schema validator rejects on apply</td>
      <td class="ctrl">TTL on profile cache · re-discover on validator failure · explicit warning model for partial probes</td>
      <td class="test">tests/integration/preflight/<br>cacheTTL.test.ts</td>
      <td class="spec">module-preflight.md</td>
    </tr>
    <tr>
      <td class="fail"><span class="tag t-low">low</span>connection pool exhaustion</td>
      <td class="det">db_query_failure_rate alert</td>
      <td class="ctrl">bounded pool · slow-query log · runbook §DB triage</td>
      <td class="test">load test (manual; capacity drill)</td>
      <td class="spec">module-storage.md</td>
    </tr>

    <tr class="group"><td colspan="5">CROSS-CUTTING</td></tr>

    <tr>
      <td class="fail"><span class="tag t-high">high</span>auth probe wrong scope</td>
      <td class="det">401/403 on first write · explicit warning</td>
      <td class="ctrl">capability discovery preflight (M2) · 80%+ misconfig catch target · auth failure audited</td>
      <td class="test">tests/integration/preflight/<br>auth.test.ts</td>
      <td class="spec">v6 §19 · charter success criterion #5</td>
    </tr>
    <tr>
      <td class="fail"><span class="tag t-low">low</span>operator skips dry-run</td>
      <td class="det">post-deploy diff differs from preview</td>
      <td class="ctrl">runbook step is required (gate) · dry-run output linked in audit chain · two-stage review (spec + quality)</td>
      <td class="test">runbook drill (quarterly)</td>
      <td class="spec">runbook.md · superpowers F-107</td>
    </tr>

  </tbody>
</table>

<figcaption><strong>V9 — Failure → control → test matrix.</strong> Every named failure mode in atl-mcp has a detection signal, a control that prevents or contains it, and a test that validates the control. The matrix groups them by category — security/integrity, correctness/idempotency, degraded operation, cross-cutting — and tags severity with a colored chip. `fail-closed` badges call out controls that abort the calling operation rather than degrade silently. Detail per row lives in the linked module docs and the threat model. (See <a href="../../visualizations/v09-failure-fix-matrix.html">full visualization page</a>.)</figcaption>
</figure>


A given failure-mode usually has a typical fix-type pairing:

| Failure mode | Common fix type(s) |
|---|---|
| Protocol invariant violation | Tooling-encoded invariant |
| Schema drift | Schema-level constraint OR migration rehearsal addition |
| Auth lifecycle | Runbook entry + automated check (alert on 401 spike) |
| Race / concurrency | Code path correction + schema-level constraint |
| Classification leakage | Automated check addition (Pino redact) + design change long-term |
| Audit chain integrity | Code path correction + design change (per-tenant chain post-v1) |
| Capacity exhaustion | Capacity expansion + monitoring addition |
| Dependency drift | Dependency upgrade + integration test addition |
| Deploy hygiene | Tooling-encoded invariant (more rehearsal-style checks) |
| Partial recovery | Runbook entry + automated post-recovery verification |

Postmortems should record the pairing. Over time, the patterns become predictive — when an auth-lifecycle incident hits, the team's reflex is "what runbook entry + alert is missing?"

---

## Anti-patterns

- **All fixes are "code path correction."** Means the team never invests in tooling. Recurrent issues stay recurrent.
- **All fixes are "design change."** Means the team rebuilds rather than patches. Wastes effort.
- **All fixes are "documentation correction."** Means the team isn't acting on the actual bug; just documenting the failure.
- **Fix isn't categorized.** A postmortem without a fix-type is incomplete.
- **Fix-type doesn't match the failure-mode pattern.** Investigate why — sometimes a novel pairing reveals a deeper issue.

## Promoting a new category

If a fix doesn't fit any category above:

1. Capture the fix shape (what was the action?).
2. Identify what the existing categories don't cover.
3. Propose a new category in this doc with:
   - Name.
   - Description.
   - 2+ examples.
   - Common pairing with failure-modes.

Categories should grow conservatively — too many categories make the taxonomy useless. Aim for 10-15 max.

---

## How this taxonomy compounds

Every postmortem links to one failure-mode + one fix-type. Over time:

- Patterns become visible: "every classification-leakage incident gets a Pino redact addition; we should have a generator that scans new domain types and adds them automatically."
- Anti-patterns become visible: "we keep capacity-expanding instead of fixing the workload bug."
- Investment decisions become visible: "we've had 5 schema-drift incidents; the migration runner upgrade is justified."

The taxonomies are the team's institutional memory. Post-v1, they'd be the input to a "what should we invest in next?" review.

## Linked artifacts

- **Spec:** v6 §30.5 (fix-type taxonomy)
- **Sibling:** [`failure-mode-taxonomy.md`](failure-mode-taxonomy.md), [`incident-library.md`](incident-library.md), [`postmortem-template.md`](postmortem-template.md)
- **Runbook (real fixes):** [`../08-operations/runbook.md`](../08-operations/runbook.md)
- **Tracking tickets that exemplify each type:** PCO-12 (tooling), PCO-13 (rehearsal — automated check), PCO-46 (race), PCO-51 (design change), PCO-57 (design change), PCO-58 (code path), PCO-59 (auth lifecycle)

---

*Last reviewed: 2026-04-25 by Chris.*
