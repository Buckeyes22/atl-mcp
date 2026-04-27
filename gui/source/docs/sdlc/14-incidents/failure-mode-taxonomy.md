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

<figure>

<svg viewBox="0 0 1200 660" xmlns="http://www.w3.org/2000/svg" font-family="IBM Plex Sans, system-ui">
  <defs>
    <marker id="ar8" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#1a1a1c"/>
    </marker>
  </defs>

  <text x="40" y="28" font-family="IBM Plex Mono" font-size="10.5" letter-spacing="1.4" fill="#9a9690">EFFECT: agent-ready workspace produced is INCORRECT or DUPLICATED</text>

  <!-- spine -->
  <line x1="60" y1="340" x2="1080" y2="340" stroke="#1a1a1c" stroke-width="2" marker-end="url(#ar8)"/>

  <!-- effect box -->
  <g transform="translate(1080,304)">
    <rect width="100" height="72" rx="3" fill="#1a1a1c"/>
    <text x="50" y="32" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" letter-spacing="1" fill="#c8c3b6">EFFECT</text>
    <text x="50" y="50" text-anchor="middle" font-family="IBM Plex Sans" font-size="11" font-weight="600" fill="#fff">workspace</text>
    <text x="50" y="62" text-anchor="middle" font-family="IBM Plex Sans" font-size="11" font-weight="600" fill="#fff">incorrect</text>
  </g>

  <!-- Each rib: angled line + bones -->
  <!-- Ribs go to spine endpoints at x=200, 400, 600, 800, 1000 -->

  <!-- ============ TOP: Inputs ============ -->
  <!-- Rib: PROFILE -->
  <g>
    <line x1="220" y1="60" x2="280" y2="340" stroke="#1a1a1c" stroke-width="1.5"/>
    <text x="220" y="48" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" letter-spacing="1.2" fill="#7a4408">INPUTS · PROFILE</text>
    <g font-family="IBM Plex Sans" font-size="11" fill="#43434a">
      <line x1="180" y1="100" x2="240" y2="100" stroke="#b96b16"/><text x="120" y="104">missing classification</text>
      <line x1="170" y1="140" x2="245" y2="140" stroke="#b96b16"/><text x="100" y="144">ambiguous acceptance criteria</text>
      <line x1="170" y1="180" x2="252" y2="180" stroke="#b96b16"/><text x="80" y="184">untrusted markdown not flagged</text>
      <line x1="180" y1="220" x2="260" y2="220" stroke="#b96b16"/><text x="100" y="224">stale provenance / actor</text>
      <line x1="195" y1="260" x2="266" y2="260" stroke="#b96b16"/><text x="120" y="264">file-upload size unbounded</text>
    </g>
  </g>

  <!-- Rib: CAPABILITIES (preflight) -->
  <g>
    <line x1="430" y1="60" x2="490" y2="340" stroke="#1a1a1c" stroke-width="1.5"/>
    <text x="430" y="48" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" letter-spacing="1.2" fill="#3e0d4d">PREFLIGHT · CAPABILITIES</text>
    <g font-family="IBM Plex Sans" font-size="11" fill="#43434a">
      <line x1="380" y1="100" x2="450" y2="100" stroke="#6e1a82"/><text x="320" y="104">issue-type discovery cached too long</text>
      <line x1="370" y1="140" x2="455" y2="140" stroke="#6e1a82"/><text x="310" y="144">workflow / status set drift since cache</text>
      <line x1="378" y1="180" x2="462" y2="180" stroke="#6e1a82"/><text x="318" y="184">storage-format probe partial result</text>
      <line x1="386" y1="220" x2="468" y2="220" stroke="#6e1a82"/><text x="320" y="224">macro support unconfirmed</text>
      <line x1="395" y1="260" x2="475" y2="260" stroke="#6e1a82"/><text x="335" y="264">auth probe succeeded but scope wrong</text>
    </g>
  </g>

  <!-- Rib: PLANNER / BLUEPRINT -->
  <g>
    <line x1="640" y1="60" x2="700" y2="340" stroke="#1a1a1c" stroke-width="1.5"/>
    <text x="640" y="48" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" letter-spacing="1.2" fill="#0e3d2f">PLANNER · BLUEPRINT</text>
    <g font-family="IBM Plex Sans" font-size="11" fill="#43434a">
      <line x1="588" y1="100" x2="660" y2="100" stroke="#1f6e54"/><text x="528" y="104">sampling unavailable → degraded plan</text>
      <line x1="582" y1="140" x2="666" y2="140" stroke="#1f6e54"/><text x="522" y="144">adversarial triplet rejected</text>
      <line x1="592" y1="180" x2="672" y2="180" stroke="#1f6e54"/><text x="532" y="184">non-determinism in template render</text>
      <line x1="600" y1="220" x2="680" y2="220" stroke="#1f6e54"/><text x="540" y="224">epic decomposition heuristic loose</text>
      <line x1="608" y1="260" x2="686" y2="260" stroke="#1f6e54"/><text x="552" y="264">"creative" blueprint output not gated</text>
    </g>
  </g>

  <!-- ============ BOTTOM: Execution / Ops ============ -->
  <!-- Rib: EXECUTOR -->
  <g>
    <line x1="280" y1="620" x2="340" y2="340" stroke="#1a1a1c" stroke-width="1.5"/>
    <text x="280" y="640" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" letter-spacing="1.2" fill="#7a1d14">EXECUTOR · IDEMPOTENCY</text>
    <g font-family="IBM Plex Sans" font-size="11" fill="#43434a">
      <line x1="225" y1="450" x2="297" y2="450" stroke="#b8281d"/><text x="165" y="454">idempotency key collision</text>
      <line x1="220" y1="490" x2="304" y2="490" stroke="#b8281d"/><text x="160" y="494">unique constraint missing on side-table</text>
      <line x1="232" y1="530" x2="312" y2="530" stroke="#b8281d"/><text x="172" y="534">retry on 5xx without idempotency check</text>
      <line x1="240" y1="570" x2="320" y2="570" stroke="#b8281d"/><text x="180" y="574">mid-execute crash → re-pickup logic gap</text>
    </g>
  </g>

  <!-- Rib: PROVIDER (Atlassian / VCS) -->
  <g>
    <line x1="500" y1="620" x2="560" y2="340" stroke="#1a1a1c" stroke-width="1.5"/>
    <text x="500" y="640" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" letter-spacing="1.2" fill="#1f5f8a">PROVIDERS · ATLASSIAN / VCS</text>
    <g font-family="IBM Plex Sans" font-size="11" fill="#43434a">
      <line x1="450" y1="450" x2="520" y2="450" stroke="#1f5f8a"/><text x="390" y="454">429 storm → partial provision</text>
      <line x1="448" y1="490" x2="528" y2="490" stroke="#1f5f8a"/><text x="388" y="494">storage vs ADF format mismatch</text>
      <line x1="455" y1="530" x2="536" y2="530" stroke="#1f5f8a"/><text x="395" y="534">field schema delta since cache</text>
      <line x1="465" y1="570" x2="546" y2="570" stroke="#1f5f8a"/><text x="405" y="574">webhook delivery missed → drift</text>
    </g>
  </g>

  <!-- Rib: STATE / DB -->
  <g>
    <line x1="720" y1="620" x2="780" y2="340" stroke="#1a1a1c" stroke-width="1.5"/>
    <text x="720" y="640" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" letter-spacing="1.2" fill="#b96b16">STATE · DB / MIGRATIONS</text>
    <g font-family="IBM Plex Sans" font-size="11" fill="#43434a">
      <line x1="670" y1="450" x2="740" y2="450" stroke="#b96b16"/><text x="615" y="454">migration applied without rehearsal</text>
      <line x1="668" y1="490" x2="748" y2="490" stroke="#b96b16"/><text x="610" y="494">tenant scope assertion missing</text>
      <line x1="675" y1="530" x2="756" y2="530" stroke="#b96b16"/><text x="615" y="534">state-machine bypass on rerun</text>
      <line x1="685" y1="570" x2="766" y2="570" stroke="#b96b16"/><text x="625" y="574">connection pool exhaustion → partial</text>
    </g>
  </g>

  <!-- Rib: HUMAN / OPS -->
  <g>
    <line x1="940" y1="620" x2="1000" y2="340" stroke="#1a1a1c" stroke-width="1.5"/>
    <text x="940" y="640" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" letter-spacing="1.2" fill="#43434a">PROCESS · OPERATOR</text>
    <g font-family="IBM Plex Sans" font-size="11" fill="#43434a">
      <line x1="890" y1="450" x2="960" y2="450" stroke="#6f6e6a"/><text x="830" y="454">re-run on stale profile, not refreshed</text>
      <line x1="888" y1="490" x2="968" y2="490" stroke="#6f6e6a"/><text x="828" y="494">approval clicked without dry-run review</text>
      <line x1="895" y1="530" x2="976" y2="530" stroke="#6f6e6a"/><text x="835" y="534">auth credentials shared between projects</text>
      <line x1="905" y1="570" x2="986" y2="570" stroke="#6f6e6a"/><text x="845" y="574">runbook step skipped under time pressure</text>
    </g>
  </g>

  <!-- legend strip -->
  <g transform="translate(40,610)" font-family="IBM Plex Mono" font-size="10" fill="#6f6e6a">
    <text>each bone = candidate cause · ribs grouped by trust-boundary or system stage · highest-leverage controls in V9</text>
  </g>
</svg>

<figcaption><strong>V8 — Failure-mode fishbone — "incorrect / duplicate workspace".</strong> Ishikawa diagram for the highest-stakes effect atl-mcp guards against: producing a workspace that is incorrect (semantically wrong) or duplicated (idempotency violation). Ribs follow the system pipeline — inputs (profile), preflight (capabilities), planner (blueprint), executor (idempotency), providers, state, and human/operator process. Each bone is a candidate cause; mapping causes to controls lives in <a href="v09-failure-fix-matrix.html">V9 (failure → fix matrix)</a>. (See <a href="../../visualizations/v08-failure-ishikawa.html">full visualization page</a>.)</figcaption>
</figure>


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
