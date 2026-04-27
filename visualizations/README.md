# Claude Design Brief — atl-mcp Documentation Visualizations

> **What this is.** Comprehensive instructions for Claude Design to produce 18 visualizations that fill the visual-explanation gaps in atl-mcp's documentation. The accompanying `source/` directory contains the complete documentation tree (112 markdown files) those visualizations support.
>
> **What atl-mcp is.** An MCP (Model Context Protocol) server that turns raw project requirements into agent-ready Jira + Confluence + Bitbucket workspaces. Single-tenant on-prem in v1; build-agent-agnostic; auditable. Full project orientation in `source/README.md` + `source/CLAUDE.md`.
>
> **What you (Claude Design) should produce.** For each of the 18 visualization briefs below: a render-ready visualization (mermaid diagram, SVG, or styled HTML/markdown — pick the medium that best serves the concept) PLUS the 2-3 sentence caption that should accompany it in its destination doc.

---

## Table of contents

1. [How the source material is organized](#how-the-source-material-is-organized)
2. [Style guide + conventions](#style-guide--conventions)
3. [Existing diagram inventory (style anchors)](#existing-diagram-inventory-style-anchors)
4. [The 18 visualization briefs](#the-18-visualization-briefs)
5. [Output format expectations](#output-format-expectations)
6. [What NOT to visualize](#what-not-to-visualize)
7. [Quick reference: visualization → source files](#quick-reference-visualization--source-files)

---

## How the source material is organized

Everything in `source/` mirrors the original repo structure:

```
source/
├── README.md                       repo-root README; project pitch + quick-start + reading order
├── CLAUDE.md                       Claude-Code-specific operating rules + reading hierarchy
├── AGENTS.md                       LF AGENTS.md spec; coding conventions, CI gates, testing
├── v6-spec-excerpts.md             ~17.6k words of v6 spec sections most relevant to visualizations
├── docs/
│   ├── adr/                        6 ADRs (architectural decision records)
│   │   ├── 0000-adr-process.md
│   │   ├── 0001-pglite-for-dev.md
│   │   ├── 0002-token-encryption-noble-ciphers.md
│   │   ├── 0003-confluence-storage-default-adf-flagged.md
│   │   ├── 0004-bitbucket-app-password-vs-oauth.md
│   │   └── 0005-audit-signing-pipeline.md
│   └── sdlc/                       17-category enterprise SDLC tree (~99k words)
│       ├── README.md               TOC + persona-routing
│       ├── 01-charter/             vision, strategy, non-goals
│       ├── 02-architecture/        C4-L1 + L2, dataflow, trust boundaries, tradeoffs
│       ├── 03-requirements/        functional + 4 NFRs + compliance scope
│       ├── 04-design/              10 module HLDs + 2 API specs + 8 sequence diagrams
│       ├── 05-data/                schema, domain model, retention, classification, migrations, audit trail
│       ├── 06-security/            threat model + 8 component models + disclosure
│       ├── 07-testing/             strategy + 6 plans
│       ├── 08-operations/          runbook, SLO/SLI, monitoring, alerting, observability stack
│       ├── 09-deployment/          CI/CD, release, environments, feature flags, deployment targets
│       ├── 10-dr-bcp/              backup, RTO/RPO, failover, audit chain recovery, drill schedule
│       ├── 11-onboarding/          developer / integrator / operator / partner / glossary-quick
│       ├── 12-governance/          ADR process, change mgmt, decision log, code review, DoR/DoD
│       ├── 13-quality/             code style, iron laws, anti-slop, quality gates
│       ├── 14-incidents/           postmortem template, failure-mode + fix-type taxonomies, library
│       ├── 15-capacity/            current limits, planning, benchmarks, load-test runbook
│       ├── 16-cost/                cost model, FinOps, pricing runway
│       ├── 17-glossary/            cross-cutting + domain vocabulary
│       └── templates/              ADR, runbook, postmortem, threat model, sequence-diagram skeletons
```

When a visualization brief says "read for context," paths are relative to `source/`.

---

## Style guide + conventions

### Format priority

1. **Mermaid first.** Renders inline in GitHub markdown; version-controlled as text; the project's existing 46 diagrams are all mermaid. Use this when the concept fits a standard mermaid type (sequence, graph, class, state, ER, gantt, timeline, mindmap, pie, quadrantChart, journey).
2. **SVG when mermaid runs out.** For Venn diagrams, custom layouts, hand-drawn-style architecture, color-zoned trust-boundary visuals, and similar where mermaid is constraining. Provide as inline SVG embedded in markdown OR as a standalone `.svg` file.
3. **Styled HTML/markdown** for table-as-visual cases (heatmaps, matrices) where neither mermaid nor SVG adds enough value over a well-designed markdown table.

### Existing project conventions to respect

- **No emojis** in committed files unless explicitly requested. Existing docs are emoji-free.
- **Lowercase, kebab-case** filenames if creating new files.
- **Mermaid syntax style:**
  - `subgraph` blocks with descriptive labels for grouping (e.g., `subgraph External["External callers (untrusted)"]`).
  - Edge labels in pipe-quoted form: `A -->|MCP/JSON-RPC| B`.
  - Dashed arrows (`-.->`) for "audit / observability" or "out-of-band" relationships.
  - Solid arrows for synchronous calls and primary data flow.
- **Voice in captions:** direct, no hedging. "The audit chain links each entry to the previous via SHA-256." Not "the audit chain might link..." or "this diagram shows..."

### Color (when SVG/HTML)

The project doesn't have an established color palette. Suggested:

- **Trust-untrusted gradient:** untrusted (red/coral) → trusted (green/teal) for trust-boundary visuals.
- **Severity:** P0 red, P1 amber, P2 yellow, info blue.
- **Status:** done = solid green, in-progress = striped/amber, todo = grey.
- **Classification:** PUBLIC = blue, INTERNAL = grey, PRIVATE = orange, SECRET = red.

Any palette is fine if applied consistently within the visualization.

### Typography (when SVG/HTML)

- Sans-serif (Inter, system-ui, or default).
- Line lengths reasonable; no shrinking text below 11pt for legibility.
- Avoid all-caps for body labels.

---

## Existing diagram inventory (style anchors)

The project already has **46 mermaid diagrams**. The most polished ones to use as style anchors:

| Anchor | Where | What to imitate |
|---|---|---|
| C4-L1 system context | `source/docs/sdlc/02-architecture/README.md` | Subgraph zoning, edge labels, arrow conventions |
| 8 sequence diagrams | `source/docs/sdlc/04-design/sequence-diagrams.md` | Activations, alt blocks, named participants by role |
| ER diagram | `source/docs/sdlc/05-data/schema.md` | Cardinality notation, column-level detail |
| Audit chain mermaid (basic) | `source/docs/sdlc/02-architecture/README.md` (audit chain section) | Linkage between numbered entries |
| Domain class diagram | `source/docs/sdlc/05-data/domain-model.md` | Composition relationships |
| State machine | `source/docs/sdlc/05-data/domain-model.md` | 13-state ProjectState transitions |

Read those before designing. New visualizations should feel like siblings, not strangers.

---

## The 18 visualization briefs

Each brief follows this shape:

- **Title + tier** (Tier 1 = highest impact, Tier 3 = nice to have).
- **Lands in:** which source/ doc this visualization will be inserted into, and approximately where in the doc.
- **Purpose:** what the visualization conveys that prose alone doesn't.
- **Read for context:** specific files in source/ to ground the design.
- **Visualize:** the concrete content + key labels/data points.
- **Format:** suggested medium (mermaid type / SVG / styled markdown).
- **Style notes:** anything beyond the global style guide.
- **Acceptance criteria:** how to know the visualization is done well.
- **Caption:** the 2-3 sentence prose that should accompany it in the doc.

---

### Tier 1 — high impact, low effort

#### V1. Audit chain entry construction

- **Tier:** 1
- **Lands in:** `source/docs/sdlc/06-security/audit-chain-threat-model.md`, near the "Entry shape (recap)" section. Replace or supplement the existing block-letter description.
- **Purpose:** The per-entry hash + signature construction is the architecturally interesting part of v6 §30.1. The prose says `chain_hash = SHA-256(prev_hash || payload_hash)` and similar; a visual makes the chain-linkage discipline click instantly.
- **Read for context:**
  - `source/docs/sdlc/06-security/audit-chain-threat-model.md` (full)
  - `source/docs/adr/0005-audit-signing-pipeline.md`
  - `source/docs/sdlc/05-data/audit-trail.md`
  - `source/v6-spec-excerpts.md` § 30
- **Visualize:** A single audit entry's construction PLUS the linkage to the prior entry. Show:
  1. Entry N-1's full canonical serialization → SHA-256 → `prev_hash`.
  2. Entry N's payload → SHA-256 → `payload_hash`.
  3. `prev_hash || payload_hash` → SHA-256 → `chain_hash`.
  4. `chain_hash` → ed25519 sign with active key (referenced by `key_id` from registry git ref) → `signature`.
  5. Final stored row: `(id, prev_hash, payload_hash, chain_hash, signature, key_id, ts, payload)`.
- **Format:** Mermaid `graph LR` or `flowchart LR`. Bonus if you also show 2-3 entries in sequence to demonstrate chaining.
- **Style notes:** Use distinct visual treatment for "stored fields" (rectangles), "computed values" (rounded), and "external inputs" (cylinders / parallelograms). The signing key reference should look like a sidebar / annotation pulling from a separate source (the registry).
- **Acceptance criteria:**
  - A reader who knows what SHA-256 is can trace what gets hashed at each step.
  - The `prev_hash` linkage between entries is visible.
  - The genesis case (`prev_hash = NULL`) is acknowledged either in the diagram or its caption.
  - The diagram doesn't conflate "what's stored" with "what's computed."
- **Caption:** "Each audit entry chains to the previous via `prev_hash` (SHA-256 of the prior entry's canonical serialization including its signature). The current entry's `payload_hash` and `prev_hash` combine to produce `chain_hash`, which is signed with the active ed25519 key (referenced by `key_id` resolved through the git-ref registry). Tampering with any prior entry breaks `prev_hash` for the next one; tampering with the current payload breaks `payload_hash`; either way the verifier surfaces the failing entry."

#### V2. Lethal trifecta Venn

- **Tier:** 1
- **Lands in:** `source/docs/sdlc/06-security/lethal-trifecta.md`, near the top after the TL;DR.
- **Purpose:** The lethal trifecta is the canonical LLM-app risk class. A three-circle Venn is the conventional visual; the doc currently has prose only.
- **Read for context:**
  - `source/docs/sdlc/06-security/lethal-trifecta.md` (full)
  - `source/v6-spec-excerpts.md` § 38 ("Cross-cutting Safety Concepts")
  - `source/docs/sdlc/06-security/policy-decision-layer.md` (for how detection plugs in)
- **Visualize:** Three overlapping circles labeled:
  1. **Reads PRIVATE / SECRET data**
  2. **Processes UNTRUSTED content**
  3. **Emits EXTERNALLY**

  The triple-overlap region (center) is the **dangerous intersection** — operations with all three properties are blocked or require approval. The three pairwise overlaps are warning zones (potentially dangerous depending on context). Single-property regions are ordinary.
- **Format:** SVG (mermaid doesn't natively render Venn well). Color the center red; pairwise overlaps amber; single-property regions blue/grey.
- **Style notes:** Center label should be readable: "**LETHAL TRIFECTA — block or require approval**". Optionally a small icon or symbol in each region indicating typical examples (a key for SECRET, a globe for EXTERNAL, an inbox for UNTRUSTED).
- **Acceptance criteria:**
  - The center stands out as the danger zone visually.
  - All three labels are readable.
  - The visualization is interpretable without reading any caption.
- **Caption:** "The lethal trifecta describes the dominant LLM-app risk class: an operation that reads PRIVATE data, processes UNTRUSTED content, and emits EXTERNALLY in one execution. Each property alone is ordinary; the triple intersection enables exfiltration. atl-mcp's policy decision layer detects the combination and either blocks the operation or routes it to require_approval (per v6 §38.1)."

#### V3. Test pyramid

- **Tier:** 1
- **Lands in:** `source/docs/sdlc/07-testing/strategy.md`, after the "Test categories" section.
- **Purpose:** The test pyramid is conventional; instantly communicates "lots of unit, fewer integration, very few E2E." The strategy doc currently has only tables.
- **Read for context:**
  - `source/docs/sdlc/07-testing/strategy.md` (full)
  - `source/docs/sdlc/07-testing/unit-coverage.md`
  - `source/docs/sdlc/07-testing/integration-plan.md`
  - `source/docs/sdlc/07-testing/e2e-plan.md`
- **Visualize:** Classic pyramid, layers from bottom to top:
  - **Unit (29+ tests, < 50 ms each)** — broad base; covers domain serialization, security primitives, validators, etc.
  - **Integration (17+ tests, seconds)** — middle; covers storage repos, providers, mgmt API.
  - **Contract (1+, planned more)** — narrow band; provider abstract contract.
  - **Lint (2)** — alongside; static checks promoted as tests.
  - **Live (3, gated)** — narrow top; real-Atlassian / real-Bitbucket / real-UIO.
  - **E2E (planned, M11)** — narrow tip.

  Annotate each layer with: count, typical runtime, what it catches, when in CI it runs.
- **Format:** SVG (clean) OR mermaid `graph TB` styled to look like a pyramid (works but less polished).
- **Style notes:** Keep the "lint" and "live" layers visually distinct from the strict-pyramid layers (perhaps as side annotations) since they don't fit the pyramid narrative neatly.
- **Acceptance criteria:**
  - Layer ratios reflect the ~29 / ~17 / ~3 distribution.
  - Each layer's runtime + count is annotated.
  - The "lint" and "live" categories are positioned without breaking the pyramid metaphor.
- **Caption:** "atl-mcp's test pyramid: 29+ unit tests at the broad base (millisecond-scale; cover domain serialization, security primitives, validators), 17+ integration tests in the middle band (seconds-scale; cover storage repositories, provider HTTP, mgmt API), and a narrow tip of contract + live + (planned) E2E tests. The lint category sits alongside as static-checks-as-tests; live tests gate behind `RUN_LIVE_TESTS=1` to keep default CI fast."

#### V4. Milestone Gantt (M0 → M11)

- **Tier:** 1
- **Lands in:** `source/docs/sdlc/01-charter/product-strategy.md`, "The validating moment" section. Also linkable from `source/docs/sdlc/09-deployment/release-process.md`.
- **Purpose:** The 12 milestones (M0 through M11) are described in tables + tracking-ticket lists. A Gantt makes critical-path-through-M6a visible, and shows dependencies that prose obscures.
- **Read for context:**
  - `source/docs/sdlc/01-charter/product-strategy.md`
  - `source/docs/sdlc/09-deployment/release-process.md`
  - `source/docs/sdlc/09-deployment/ci-cd.md`
  - `source/v6-spec-excerpts.md` § 28 (Implementation Milestones — most authoritative)
  - `source/docs/sdlc/03-requirements/functional.md` (functional deliverables per milestone)
- **Visualize:** Gantt chart with:
  - **M0 — Scaffold** (status: Done)
  - **M1 — Domain + storage** (Done)
  - **M2 — Atlassian providers + capability discovery** (In Progress) — depends on M1
  - **M3 — VCS provider (Bitbucket)** (In Progress) — depends on M1
  - **M4 — Blueprint workflow with sampling** (Todo) — depends on M2 + M3
  - **M5 — Provisioning planner** (Todo) — depends on M4
  - **M6a — Jira executor (FIRST SHIPPABLE SLICE)** (Todo) — depends on M5; **highlight specially**
  - **M6b — Confluence executor** (Todo) — depends on M6a
  - **M6c — VCS executor** (Todo) — depends on M6a + M3
  - **M7 — Context resources + packs** (Todo) — depends on M2 + M6
  - **M8 — Readiness validation** (Todo) — depends on M4 + M7
  - **M9 — Agent handoff** (Todo) — depends on M8
  - **M10 — Webhook ingestion** (Todo) — depends on M2 + M3
  - **M11 — Notifications, evals, hardening** (In Progress, partial) — depends on most others

  Show v0.1 release tag at M6a completion, v0.2 at M7.
- **Format:** Mermaid `gantt`. Bonus if you also produce a parallel critical-path-only diagram (`graph LR` with M0 → M1 → M2 → M3 → M4 → M5 → M6a as the spine).
- **Style notes:** Use `crit` styling on the M0→M6a critical path. Mark `done`, `active`, and future tasks distinctly. Annotate v0.1 and v0.2 release-tag points.
- **Acceptance criteria:**
  - Critical path through M6a is visually distinct.
  - Dependencies between milestones are accurate (M6a ← M5 ← M4 ← M2+M3 ← M1 ← M0).
  - Status (done/in-progress/todo) is visually consistent with the table in `roadmap.md`.
- **Caption:** "atl-mcp's M0 → M11 milestone sequence with the critical path to v0.1 (the first shippable slice at M6a) highlighted. M2 + M3 fan in at M4 (blueprint workflow); M4 → M5 (planner) → M6a (Jira executor) is the bottleneck. M11 (observability + hardening) cross-cuts and runs partially in parallel with the M6 family."

#### V5. Token envelope encryption (layered)

- **Tier:** 1
- **Lands in:** `source/docs/sdlc/06-security/token-storage.md`, near the "Cryptographic primitives" section.
- **Purpose:** The seal/open lifecycle is described in prose + a sequence diagram. A layered/stacked diagram showing the envelope structure (master key encrypts the data; nonce + ciphertext + auth tag are the stored bundle) is more memorable.
- **Read for context:**
  - `source/docs/sdlc/06-security/token-storage.md` (full)
  - `source/docs/adr/0002-token-encryption-noble-ciphers.md`
  - `source/docs/sdlc/06-security/secrets-mgmt.md`
- **Visualize:** Two stacked / nested diagrams:
  1. **Sealing flow:** plaintext token + 24-byte random nonce + master key → XChaCha20-Poly1305 AEAD → ciphertext + auth tag → stored row `(id, kind, subject, nonce, ciphertext, key_version)`.
  2. **Opening flow (inverse):** stored row + master key → AEAD open → either plaintext (auth-tag verified) OR auth-failure error (tamper detected).

  Show the envelope structure visually: `nonce | ciphertext+tag` as a single bundle, with the master key as an external trust input that comes from `TOKEN_MASTER_KEY` env (never persisted by atl-mcp).
- **Format:** Mermaid `graph LR` with two side-by-side flows OR an SVG with stacked layers. SVG would communicate "envelope" most clearly; the layered visual could use cylinder for stored row + nesting for the AEAD bundle.
- **Style notes:** Annotate the master key with "**32 bytes hex; from env; never in DB**" — that's the most important security property. Annotate the nonce with "**24 random bytes per seal; reuse breaks the cipher**".
- **Acceptance criteria:**
  - The asymmetry between "always-in-env master key" and "always-in-row data" is visually obvious.
  - Both seal and open paths are shown OR clearly invertible.
  - The auth-failure branch (tamper detection) is acknowledged.
- **Caption:** "Token envelope encryption per ADR-0002. Each seal generates a fresh 24-byte nonce; the AEAD construction (XChaCha20-Poly1305) produces an authenticated ciphertext+tag bundle. The 32-byte master key lives in `TOKEN_MASTER_KEY` env var only — never persisted in DB. Open returns either plaintext (auth-tag verified) or a tamper-detection error; partial-decrypt-on-bad-tag is impossible by AEAD construction. Master-key rotation requires a re-encrypt drill (Incident C in runbook); PCO-57 tracks the long-term envelope-with-per-row-data-keys refactor."

#### V6. Three-pillar observability

- **Tier:** 1
- **Lands in:** `source/docs/sdlc/08-operations/observability-stack.md`, near "The four streams" section.
- **Purpose:** The three pillars (logs / metrics / traces) plus the audit-trace JSONL stream are described in prose with one stream per section. A unified diagram showing how a single MCP tool call produces output to all four streams crystallizes the discipline.
- **Read for context:**
  - `source/docs/sdlc/08-operations/observability-stack.md` (full)
  - `source/docs/sdlc/04-design/module-observability.md`
  - `source/docs/sdlc/08-operations/monitoring.md`
  - `source/v6-spec-excerpts.md` § 27 (Observability and Telemetry)
- **Visualize:** A single MCP tool call (e.g., `project_preflight_check`) at the center, with 4 outputs fanning out:
  - **Logs** → pino → file (`./orchestrator.log`)
  - **Metrics** → Prometheus counters → mgmt `/metrics`
  - **Traces** → OpenTelemetry → Langfuse (when configured; no-op exporter otherwise)
  - **Audit (state-changing calls only)** → ed25519-signed entry → `auditEntries` table + audit-trace JSONL

  Annotate each pillar with: what it's good for, who consumes it, retention, sample query/dashboard.
- **Format:** Mermaid `graph LR` with the tool call as the central node and 4 fan-outs to consumer columns. OR SVG with explicit columns.
- **Style notes:** Use the `dashed` arrow for the "audit (conditional)" path to indicate "only for state changes." Use distinct colors for each pillar's consumer column.
- **Acceptance criteria:**
  - A single tool call's contribution to all 4 streams is visible.
  - Each pillar's destination + consumer is named.
  - The "audit only on state change" conditional is captured.
- **Caption:** "Each MCP tool call produces output to four observability streams in parallel: pino-formatted logs to file (NEVER stdout — that's reserved for JSON-RPC over the stdio transport), Prometheus counters at the mgmt-port `/metrics` endpoint, OpenTelemetry traces to Langfuse when configured, and a signed audit chain entry plus a denormalized audit-trace JSONL row for state-changing calls. The four streams have different ergonomics (logs: human grep, metrics: aggregate trends, traces: per-request latency, audit: tamper-evident forensics) and are intentionally redundant where it matters."

---

### Tier 2 — high impact, medium effort

#### V7. STRIDE matrix per trust boundary

- **Tier:** 2
- **Lands in:** `source/docs/sdlc/06-security/threat-model.md`, after the boundary-by-boundary STRIDE tables.
- **Purpose:** The threat model walks each boundary's STRIDE threats in tabular form. A 6 × 3 (STRIDE category × trust boundary) matrix gives a faster scan of "which threats apply where" — useful for security reviewers tracing coverage.
- **Read for context:**
  - `source/docs/sdlc/06-security/threat-model.md` (full)
  - `source/docs/sdlc/02-architecture/trust-boundaries.md`
  - `source/docs/sdlc/06-security/controls-matrix.md`
- **Visualize:** A heatmap-style matrix with:
  - **Rows:** S, T, R, I, D, E (STRIDE categories).
  - **Columns:** Boundary 1 (External callers → server), Boundary 2 (Server → external systems), Boundary 3 (Audit boundary, cross-cutting).
  - **Cells:** count of threats in that category at that boundary, OR a list of threat IDs (T-1101, etc.), OR a heatmap intensity.

  Reference threat IDs from the threat-model doc: T-1101 through T-3306.
- **Format:** Styled markdown table (heatmap via cell color/shading) OR SVG. Mermaid `quadrantChart` doesn't quite fit (quadrant chart is 2D continuous; this is categorical).
- **Style notes:** Cells with no applicable threats should be visually de-emphasized (lighter grey). Cells with multiple high-severity threats should be visually emphasized (darker red).
- **Acceptance criteria:**
  - All 18 threat IDs (T-1101 through T-3306) appear in the matrix.
  - Cross-cutting threats (T-3xxx) appear primarily in Boundary 3 column.
  - The matrix is readable at a glance.
- **Caption:** "STRIDE threats by trust boundary. Boundary 1 (external → server) draws Spoofing + Tampering + DoS pressure; Boundary 2 (server → external) draws Information disclosure (token exfil) + DoS (rate-limit) pressure; Boundary 3 (audit) absorbs Repudiation + cross-cutting integrity concerns. Cells reference threat IDs in the threat-model doc; controls + tests for each are in the controls matrix."

#### V8. Failure-mode Ishikawa (fishbone)

- **Tier:** 2
- **Lands in:** `source/docs/sdlc/14-incidents/failure-mode-taxonomy.md`, after the "Categories" section.
- **Purpose:** The 10 failure-mode categories (protocol invariant, schema drift, auth lifecycle, race/concurrency, classification leakage, audit chain integrity, capacity exhaustion, dependency drift, deploy hygiene, partial recovery) are a natural fishbone. Visualization clusters categories around the central "production incident" outcome.
- **Read for context:**
  - `source/docs/sdlc/14-incidents/failure-mode-taxonomy.md` (full)
  - `source/docs/sdlc/14-incidents/incident-library.md` (real incidents A/B/C give examples)
  - `source/docs/sdlc/14-incidents/fix-type-taxonomy.md`
- **Visualize:** Classic Ishikawa diagram with:
  - **Spine (right end → left):** "Production Incident."
  - **Major bones (one per category):** the 10 failure modes.
  - **Sub-bones per category:** 2-3 example sub-causes from the doc (e.g., "schema drift" gets sub-bones "vacuumed-out indexes," "type mismatch," "migration assumption violated").
- **Format:** SVG (Ishikawa is conventionally hand-drawn; mermaid `mindmap` is the closest mermaid type but renders less cleanly than SVG). If using mermaid, use `mindmap` with the central node as the root.
- **Style notes:** Group the 10 categories visually — perhaps "engineering-side" (protocol, schema, race, deploy) above the spine, "operational-side" (auth lifecycle, capacity, partial recovery) below.
- **Acceptance criteria:**
  - All 10 categories appear as major bones.
  - Each category has 2-3 sub-bones with concrete examples.
  - The visual is readable; not crowded.
- **Caption:** "The 10 failure-mode categories framed as a fishbone of contributing causes to a production incident. Each category clusters real incidents (Incident A → protocol invariant; Incident B → schema drift; Incident C → auth lifecycle) plus the typical fix-type pairing. The taxonomy is what makes postmortems compounding: each new incident either matches a known category or expands it."

#### V9. Failure-mode → fix-type matrix

- **Tier:** 2
- **Lands in:** `source/docs/sdlc/14-incidents/fix-type-taxonomy.md`, "How fix-type interacts with failure-mode" section.
- **Purpose:** The doc has a list of common pairings. A 10 × 10 (failure-modes × fix-types) matrix shows the reflexes: "when this class of failure happens, this class of fix usually applies." Useful for postmortem authors choosing categories.
- **Read for context:**
  - `source/docs/sdlc/14-incidents/fix-type-taxonomy.md` (full)
  - `source/docs/sdlc/14-incidents/failure-mode-taxonomy.md`
  - `source/docs/sdlc/14-incidents/incident-library.md`
- **Visualize:** Matrix with:
  - **Rows:** 10 failure-mode categories.
  - **Columns:** 10 fix-type categories (tooling-encoded invariant, automated check addition, runbook entry, schema-level constraint, code path correction, configuration change, documentation correction, dependency upgrade, capacity expansion, design change).
  - **Cells:** filled = "common pairing"; striped = "occasional"; empty = "rare/never."
- **Format:** Styled markdown table (easiest to maintain) OR SVG.
- **Style notes:** Annotate the diagonal-ish hot zone (where invariant-class failures get tooling-encoded fixes, etc.). Highlight Incident A/B/C cells with their incident IDs.
- **Acceptance criteria:**
  - All 10 × 10 cells are addressed (filled, striped, or empty).
  - Real incidents A, B, C are findable in their respective cells.
  - The "diagonal" pattern (most direct pairing) is visible.
- **Caption:** "Typical failure-mode → fix-type pairings. The hot diagonal is where invariant-class failures get tooling-encoded fixes (Incident A); schema drift gets schema-level constraints + automated checks (Incident B); auth-lifecycle issues get runbook entries + monitoring (Incident C). The empty cells are interesting too — failure-modes that almost never get a particular fix-type indicate where the team's reflexes have predictable shape."

#### V10. Audit chain key rotation timeline

- **Tier:** 2
- **Lands in:** `source/docs/sdlc/06-security/audit-chain-threat-model.md`, "Key rotation procedure" section.
- **Purpose:** The rotation procedure references a key registry git ref + active key + rotation event. A timeline showing key generations + which audit entries belong to each key gives the temporal picture — essential for understanding "rotation doesn't break historical verification."
- **Read for context:**
  - `source/docs/sdlc/06-security/audit-chain-threat-model.md` (full)
  - `source/docs/adr/0005-audit-signing-pipeline.md`
  - `source/docs/sdlc/10-dr-bcp/audit-chain-recovery.md`
- **Visualize:** Horizontal timeline with:
  - **Time axis** (left = past, right = future).
  - **Key generations** (Key A registered T0, Key B registered T1, Key C registered T2 — staggered).
  - **Audit entries** numbered along the timeline, each colored / labeled with the key that signed it.
  - **Rotation events** marked at T1 and T2 — each is itself an audit entry, signed with the NEW key, referencing the OLD key in its payload.
  - **Verifier walk** annotation showing how it resolves `key_id → public key` at each entry's timestamp via the registry git ref's commit history.
- **Format:** Mermaid `timeline` OR SVG. SVG gives more precise control over the entry-key mapping.
- **Style notes:** Use 3 distinct colors for the 3 key eras. Make rotation events visually prominent (large markers).
- **Acceptance criteria:**
  - 3+ key generations are shown.
  - Audit entries are visibly attributed to a specific key.
  - The rotation event itself is shown as an audit entry signed with the new key.
  - The "key registry git ref" is referenced as the source of truth.
- **Caption:** "Audit chain key rotation over time. Each key (A → B → C) signs its own era of entries; rotation events are themselves audit entries (signed with the new key, referencing the old in payload). The git-ref-versioned registry retains all public keys forever — historical entries remain verifiable across rotations because the verifier walks the registry's commit history to find the active key at each entry's timestamp. Key compromise triggers a rotation; key loss without rotation leaves the chain unverifiable for future entries (file the rotation as the recovery)."

#### V11. Token budget breakdown (6-category stacked bar)

- **Tier:** 2
- **Lands in:** `source/docs/sdlc/04-design/module-context.md`, "Token budgeting (v6 §16.1)" section.
- **Purpose:** The 6-category percentage breakdown (5/20/30/20/15/10) is in a table; a stacked bar makes the proportions obvious and supports comparison across model targets (different models = different total budget but same percentage allocation).
- **Read for context:**
  - `source/docs/sdlc/04-design/module-context.md` (full)
  - `source/v6-spec-excerpts.md` § 16 (Context Pack Design — token budgeting)
- **Visualize:** A horizontal stacked bar with the 6 categories at their percentages:
  - System / instructions: 5%
  - Project blueprint summary: 20%
  - Issue-specific context: 30%
  - Related artifacts: 20%
  - History / prior context: 15%
  - Reserve for response: 10%

  Bonus: a second stacked bar showing absolute token counts at three model targets (e.g., Sonnet 4.x at 200k, Opus 4.7 1M at 1M, conservative fallback at 8k) — same percentages, different total widths.
- **Format:** SVG (mermaid's `pie` chart could work but stacked bar communicates "filling a budget" more naturally).
- **Style notes:** Use distinct colors per category; label inline with both percentage and category name. The "reserve for response" category should be visually distinct (perhaps striped) to indicate "headroom, not consumption."
- **Acceptance criteria:**
  - All 6 categories visible at correct proportions.
  - Total is clearly 100% (with the reserve included).
  - At least one absolute-tokens variant shown (or annotated).
- **Caption:** "Context pack token budget allocation per v6 §16.1. The 6-category split applies regardless of target model; only the absolute total scales (8k for unknown / fallback, ~200k for Sonnet, ~1M for Opus 4.7 1M context). When the candidate set exceeds budget, progressive truncation drops categories in order: oldest history → least-relevant related artifacts → oldest blueprint sections → comments-on-comments → fail closed if still over budget."

#### V12. Provider abstraction class diagram

- **Tier:** 2
- **Lands in:** Either `source/docs/sdlc/04-design/module-providers-atlassian.md` or `module-providers-vcs.md`. Recommendation: a new section "Provider abstraction" near the top of one OR a shared subsection visible from both.
- **Purpose:** The `VcsProvider` and `AtlassianProvider` interfaces with their concrete impls are described in prose. A class diagram showing the abstraction + current concrete impls + planned future impls (GitHub, GitLab) would clarify the extensibility design.
- **Read for context:**
  - `source/docs/sdlc/04-design/module-providers-atlassian.md`
  - `source/docs/sdlc/04-design/module-providers-vcs.md`
  - `source/docs/sdlc/05-data/domain-model.md` (for Provider type relationship)
  - `source/v6-spec-excerpts.md` § 19 (Provider Interfaces)
  - `source/docs/adr/0003-confluence-storage-default-adf-flagged.md`
  - `source/docs/adr/0004-bitbucket-app-password-vs-oauth.md`
- **Visualize:** UML-style class diagram with:
  - `Provider` base interface (top).
  - `JiraProvider` interface, `ConfluenceProvider` interface, `VcsProvider` interface — extending or composed with `Provider`.
  - **Concrete impls (current):** `jiraRestProvider`, `confluenceRestProvider` (with both ADF + storage renderers as composition), `bitbucketRestProvider` (with auth/appPassword + auth/oauth2 as composition).
  - **Planned/ghost impls (post-v1, dashed):** `githubProvider`, `gitlabProvider`, `bitbucketDcProvider`.
  - Show `tokenStore` as a dependency consumed by each concrete impl.
  - Show the HTTP clients (`restClient`, `retry`, `pagination`) as utilities used by each impl.
- **Format:** Mermaid `classDiagram`.
- **Style notes:** Use dashed lines / different colors for "post-v1 planned" classes. The post-v1 set is the architectural promise (the abstraction supports them); they shouldn't look "real."
- **Acceptance criteria:**
  - Current concrete impls visible (Jira REST, Confluence REST, Bitbucket REST).
  - Future impls visibly distinct (post-v1 marker / dashed).
  - Common dependencies (tokenStore, HTTP utils) shown as composed-in.
- **Caption:** "Provider abstraction layer. Each external system (Jira, Confluence, Bitbucket) has an abstract interface; concrete REST implementations satisfy them in v1. Auth flows compose in (API token / OAuth 3LO for Atlassian; app password / OAuth 2.0 for Bitbucket per ADR-0004). Post-v1 GitHub / GitLab / Bitbucket Data Center implementations slot into the same abstraction; they're shown dashed because the interface design is the promise, not the v1 deliverable."

---

### Tier 3 — medium impact, polish

#### V13. Persona-routed onboarding decision tree

- **Tier:** 3
- **Lands in:** A new file `source/docs/sdlc/11-onboarding/README.md` (currently no README in `11-onboarding/`). Cross-link from `source/docs/sdlc/README.md`.
- **Purpose:** The SDLC `README.md` has a "if you're a [role]" routing table. A flowchart starting from "what's your role?" is more navigable for a new arrival.
- **Read for context:**
  - `source/docs/sdlc/README.md` (the persona-routing table at the top)
  - `source/docs/sdlc/11-onboarding/developer-setup.md`
  - `source/docs/sdlc/11-onboarding/integrator-guide.md`
  - `source/docs/sdlc/11-onboarding/operator-guide.md`
  - `source/docs/sdlc/11-onboarding/partner-onboarding.md`
- **Visualize:** Decision tree starting from "What's your role?":
  - **New engineer joining the project** → Developer Setup
  - **Building an MCP host that consumes atl-mcp** → Integrator Guide → MCP Tool Catalog
  - **Running atl-mcp in production** → Operator Guide → Runbook
  - **Adopting atl-mcp for our project** → Partner Onboarding → Charter
  - **Reviewing for security / compliance** → Threat Model → Compliance Scope
  - **Reviewer / evaluator** → demo materials at `docs/demo/`

  Each leaf points to the relevant doc(s).
- **Format:** Mermaid `graph TD`.
- **Style notes:** Decision diamonds for the role question; rectangles for landing docs; arrows labeled with role.
- **Acceptance criteria:**
  - All 6 personas from the SDLC README routing table appear.
  - Each persona's recommended starting doc is linked.
  - The tree is acyclic and well-rooted.
- **Caption:** "Onboarding routing by persona. Newcomers start at the role question; the tree leads to the relevant SDLC doc set without requiring full-tree exploration. Personas: developer, integrator (MCP host builder), operator (production), partner (adopting team), security reviewer, evaluator. The full SDLC README also has a question-routing section ('I'm looking for X → click Y') that complements role-routing."

#### V14. DR scenario decision tree

- **Tier:** 3
- **Lands in:** `source/docs/sdlc/10-dr-bcp/failover.md`, near the top.
- **Purpose:** The DR procedures are split across multiple docs (failover.md, audit-chain-recovery.md, recovery-objectives.md) by failure type. A decision tree gives an on-call operator a fast route from "what just happened?" to "which procedure?"
- **Read for context:**
  - `source/docs/sdlc/10-dr-bcp/failover.md` (the 6 scenarios)
  - `source/docs/sdlc/10-dr-bcp/audit-chain-recovery.md` (the 6 sub-scenarios)
  - `source/docs/sdlc/10-dr-bcp/backup-strategy.md`
  - `source/docs/sdlc/10-dr-bcp/recovery-objectives.md`
- **Visualize:** Decision tree starting from "What's the failure?":
  - **Process crash, restart loop OK** → wait for restart (Scenario 1, RTO < 5min)
  - **Process won't start** → triage runbook (Scenario 2, RTO < 30min)
  - **Host is gone** → provision new host, deploy same tag (Scenario 3, RTO < 4hr)
  - **DB corruption or loss** → PITR restore (Scenario 4, RTO < 4hr)
  - **Secret store loss** → rotate from source (Scenario 5, depends)
  - **Audit signing key loss** → rotate per audit-chain-threat-model (Scenario 6)
  - **Audit chain integrity event** → audit-chain-recovery sub-tree (A through F)

  Each leaf points to the specific procedure.
- **Format:** Mermaid `graph TD` with decision diamonds.
- **Style notes:** Color severity: P0 paths red, P1 amber, P2 yellow. Annotate RTO targets at each leaf.
- **Acceptance criteria:**
  - All 6 main scenarios from failover.md represented.
  - Audit chain sub-scenarios (A-F) reachable from the audit-integrity branch.
  - RTO targets annotated.
  - The "do NOT roll back the audit chain" warning visible on the audit-integrity path.
- **Caption:** "DR scenario decision tree. On-call observes the failure shape; the tree routes to the procedure + RTO target. Audit-integrity events branch into the audit-chain-recovery sub-tree because they require security-incident treatment (don't roll back; capture state; coordinate)."

#### V15. C4-L3 component detail (storage + security)

- **Tier:** 3
- **Lands in:** Two diagrams, one each in `source/docs/sdlc/04-design/module-storage.md` and `module-security.md`.
- **Purpose:** Module docs have small architecture graphs but not full C4-L3 component-internal detail. Centerpiece modules deserve depth.
- **Read for context:**
  - For storage: `source/docs/sdlc/04-design/module-storage.md`, `source/docs/sdlc/05-data/schema.md`, `source/docs/sdlc/05-data/migrations.md`, `source/docs/adr/0001-pglite-for-dev.md`
  - For security: `source/docs/sdlc/04-design/module-security.md`, `source/docs/sdlc/06-security/policy-decision-layer.md`, `source/docs/sdlc/06-security/audit-chain-threat-model.md`, `source/docs/sdlc/06-security/token-storage.md`, `source/docs/sdlc/06-security/webhook-verification.md`
- **Visualize:**
  - **Storage C4-L3:** show internal components (Schema, Migrations, MigrationRunner with rehearsal mode, Repository factories, AssertTenantMatches guard, DB pool) and their interactions with each other AND with external dependencies (Postgres / pglite, observability for query metrics, audit chain repo).
  - **Security C4-L3:** show internal components (PolicyDecisionLayer, CodePolicyAdapter, TokenStore, TokenEncryption, WebhookSignatures, AuditChainWriter) and their interactions plus external dependencies (audit registry git ref, secret manager, storage repos for `policyDecisions` and `auditEntries`).
- **Format:** Mermaid `graph TB` with subgraph for the module + clear external dependency markers. Mermaid's `c4Component` syntax is also a good fit if you prefer.
- **Style notes:** Distinguish "in-module" from "out-of-module" visually. Show data flow direction with arrows.
- **Acceptance criteria:**
  - Each diagram shows ALL internal components named in its module doc.
  - External dependencies are clearly external.
  - The diagram is at L3 detail, not L2 (containers) or L4 (code).
- **Caption (storage):** "Storage module internals. The schema definitions, migrations, and repositories sit on top of the Drizzle DB pool. Tenant-scope assertions guard every read/write at the repository boundary. The MigrationRunner with rehearsal mode (PCO-13 fix for Incident B) applies pending migrations against a temp DB before target apply. Audit chain entries flow through `auditEntries` repo with the same patterns."
- **Caption (security):** "Security module internals. The PolicyDecisionLayer routes every state-changing op through the configured adapter (CodePolicyAdapter in v1) and emits an audit chain entry with the decision. TokenStore composes TokenEncryption (XChaCha20-Poly1305 envelope per ADR-0002) and persists to `encryptedTokens`. WebhookSignatures verifies HMAC-SHA256 with constant-time compare. Audit chain writes resolve key_id through the registry git ref before signing."

#### V16. Operator / integrator / partner / build-agent role map

- **Tier:** 3
- **Lands in:** `source/docs/sdlc/01-charter/README.md`, "Users" section (replacing or supplementing the table).
- **Purpose:** The charter has a Users table listing 6 roles. A relationship diagram showing how the roles interact with atl-mcp + with each other clarifies the operational picture.
- **Read for context:**
  - `source/docs/sdlc/01-charter/README.md` (the Users table)
  - `source/docs/sdlc/11-onboarding/operator-guide.md`
  - `source/docs/sdlc/11-onboarding/integrator-guide.md`
  - `source/docs/sdlc/11-onboarding/partner-onboarding.md`
  - `source/docs/sdlc/11-onboarding/developer-setup.md`
- **Visualize:** atl-mcp at the center; surrounding it the roles:
  - **Operator (human)** running atl-mcp at project kickoff (mgmt REST surface).
  - **Build agent** (Claude Code, Cursor, etc.) consuming MCP context.
  - **Reviewer** reviewing changes via Atlassian/Bitbucket UIs (no direct atl-mcp interaction).
  - **Auditor** reviewing audit chain + threat model + compliance.
  - **Integrator** building MCP hosts that consume atl-mcp.
  - **Sponsor** funding/authorizing the project.
  - **Partner team** adopting atl-mcp for their own initiative.

  Show the touchpoint each role has with atl-mcp (mgmt REST, MCP transport, audit chain, etc.) and the interactions between roles (e.g., Partner team works with Operator at kickoff; Integrator's host is consumed by Build Agent).
- **Format:** Mermaid `graph LR` or `graph TB`. Could also be `journey` if you want to show a typical workflow's role sequence.
- **Style notes:** Group roles by trust boundary: external (build agent, reviewer, auditor, integrator, partner) vs. internal (operator, sponsor).
- **Acceptance criteria:**
  - All 6+ roles from the charter Users section appear.
  - Each role's primary touchpoint with atl-mcp is named.
  - Inter-role interactions are shown where they exist.
- **Caption:** "atl-mcp's stakeholder map. Each role has a different touchpoint: operators interact via the mgmt REST API; build agents via the MCP transport; reviewers via Atlassian/Bitbucket UIs (atl-mcp's writes flow through the same UIs as human work); auditors via the signed audit chain. Integrators build MCP hosts that build agents use; partners are the teams adopting atl-mcp for their own engineering initiatives."

#### V17. Cost stacked bar (3 workload sizes)

- **Tier:** 3
- **Lands in:** `source/docs/sdlc/16-cost/cost-model.md`, "Total monthly cost at v1 scale" section (currently a table).
- **Purpose:** The table shows 5 categories × 3 workload sizes. A stacked bar comparison makes the cost composition + total visually instant.
- **Read for context:**
  - `source/docs/sdlc/16-cost/cost-model.md` (the costs table)
  - `source/docs/sdlc/16-cost/finops.md`
  - `source/docs/sdlc/16-cost/pricing-runway.md`
- **Visualize:** Three stacked bars (Light / Typical / Heavy), each composed of the 5 cost categories:
  - Compute (varies $50/$80/$150)
  - DB ($100/$150/$300)
  - LLM ($50/$150/$500)
  - Backup ($5/$10/$20)
  - Misc ($50/$50/$50)

  Bars sized to reflect totals (~$255/$440/$1020).
- **Format:** SVG (mermaid `pie` doesn't compare across multiple totals well).
- **Style notes:** Each category gets a consistent color across the three bars. Annotate totals at the top of each bar.
- **Acceptance criteria:**
  - 5 categories × 3 workload sizes = 15 segments visible.
  - Totals annotated.
  - LLM category is visually emphasized as the variable / dominant cost driver at higher workloads.
- **Caption:** "v1 monthly cost composition at three workload sizes. LLM provider calls (sampling for blueprint generation, multi-provider eval-view judges, readiness verdicts) dominate the variable cost; everything else scales sub-linearly with workload. At light workload (1-2 active projects): ~$255/mo. At typical (10 projects): ~$440. At heavy (50+): ~$1,020. Per-project amortized: ~$5-20 once full lifecycle (provisioning + context refresh + handoff) is counted."

#### V18. ADR dependency graph

- **Tier:** 3
- **Lands in:** `source/docs/sdlc/12-governance/decision-log.md`, "ADR index" section.
- **Purpose:** The 6 ADRs have implicit relationships (ADR-0005 builds on ADR-0002 for crypto primitives; ADR-0001 informs the migration story). A graph shows these relationships.
- **Read for context:**
  - All 6 ADRs in `source/docs/adr/`
  - `source/docs/sdlc/12-governance/decision-log.md` (full)
  - `source/docs/sdlc/12-governance/adr-process.md`
- **Visualize:** Directed graph of:
  - ADR-0000 (process) — meta; reference for all
  - ADR-0001 (pglite for dev) — feeds into storage + migrations stories
  - ADR-0002 (token encryption library) — referenced by ADR-0005 (uses ed25519 from same library family)
  - ADR-0003 (Confluence body format) — informs Confluence provider design
  - ADR-0004 (Bitbucket auth) — informs VCS provider design
  - ADR-0005 (audit signing pipeline) — references ADR-0002

  Edges represent "uses primitives from" / "builds on" / "is governed by" relationships.

  Bonus: also show the 5 most-significant non-ADR decisions from `decision-log.md` ("Significant non-ADR decisions" section) as ghost/dashed nodes — single-tenant for v1, Atlassian + Bitbucket Cloud only, build-agent-agnostic, etc. — with their rationale links.
- **Format:** Mermaid `graph TD`.
- **Style notes:** ADRs as solid nodes with their numbers; non-ADR decisions as dashed nodes; relationship edges labeled with the nature of the dependency.
- **Acceptance criteria:**
  - All 6 ADRs are nodes.
  - At least 3 inter-ADR dependencies are shown.
  - The graph is acyclic (which it should be — ADRs build on prior ones, not vice versa).
- **Caption:** "ADR + significant decision graph. ADR-0000 is meta-process; ADR-0001 (pglite) shapes storage; ADR-0002 (noble-ciphers) provides primitives consumed by ADR-0005 (audit signing); ADR-0003 and ADR-0004 govern provider design. The dashed nodes are charter-level decisions captured in the decision log without earning their own ADR (single-tenant, Atlassian-only, build-agent-agnostic, etc.) — context for any future maintainer asking 'why does this look like this?'"

---

## Output format expectations

For each visualization, please deliver:

1. **The visualization itself** in the medium specified (mermaid code block, SVG file, or styled markdown). Render-ready: copy-pasteable into the destination doc with no further editing.

2. **The caption text** as plain markdown — should sit immediately after the diagram in the destination doc.

3. **Insertion instruction** as a single line indicating where in the destination doc the visualization + caption should land. Format: `Insert after the line "..." in <path>` OR `Replace the table at the "..." section in <path>`.

If a visualization needs multiple files (e.g., SVG + accompanying CSS or a multi-pane figure), bundle them with clear naming (e.g., `v1-audit-chain-construction.svg`, `v1-audit-chain-construction-caption.md`).

If you decide a different format than I suggested would serve better, do that and explain why in 1-2 sentences. The format suggestions are starting points, not constraints.

If you want to produce additional visualizations not in this list (because they emerge from the source material as obviously useful), produce them too with full briefs of your own.

---

## What NOT to visualize

To avoid bloat:

- **Long Q&A docs** like `qa-vault.md` — text scans faster than any visual would.
- **Code listings** in module docs — better as code blocks.
- **Configuration env-var tables** — already visual enough.
- **Per-doc TL;DRs** — those are anchors, not diagrams.
- **Glossaries** — alphabetical lists work better than mind-map glossaries at this scale.
- **The full v6 spec table of contents** — the spec is a single document; navigability is by anchor, not by visualization.

---

## Quick reference: visualization → source files

| # | Visualization | Lands in | Primary source files |
|---|---|---|---|
| V1 | Audit chain entry construction | `06-security/audit-chain-threat-model.md` | audit-chain-threat-model + ADR-0005 + audit-trail + v6 §30 |
| V2 | Lethal trifecta Venn | `06-security/lethal-trifecta.md` | lethal-trifecta + v6 §38 + policy-decision-layer |
| V3 | Test pyramid | `07-testing/strategy.md` | strategy + unit-coverage + integration-plan + e2e-plan |
| V4 | Milestone Gantt | `01-charter/product-strategy.md` | product-strategy + release-process + ci-cd + v6 §28 + functional |
| V5 | Token envelope encryption | `06-security/token-storage.md` | token-storage + ADR-0002 + secrets-mgmt |
| V6 | Three-pillar observability | `08-operations/observability-stack.md` | observability-stack + module-observability + monitoring + v6 §27 |
| V7 | STRIDE matrix per boundary | `06-security/threat-model.md` | threat-model + trust-boundaries + controls-matrix |
| V8 | Failure-mode Ishikawa | `14-incidents/failure-mode-taxonomy.md` | failure-mode-taxonomy + incident-library + fix-type-taxonomy |
| V9 | Failure → fix matrix | `14-incidents/fix-type-taxonomy.md` | fix-type-taxonomy + failure-mode-taxonomy + incident-library |
| V10 | Audit key rotation timeline | `06-security/audit-chain-threat-model.md` | audit-chain-threat-model + ADR-0005 + audit-chain-recovery |
| V11 | Token budget stacked bar | `04-design/module-context.md` | module-context + v6 §16 |
| V12 | Provider class diagram | `04-design/module-providers-atlassian.md` (or vcs) | module-providers-atlassian + module-providers-vcs + domain-model + v6 §19 + ADR-0003 + ADR-0004 |
| V13 | Onboarding decision tree | NEW `11-onboarding/README.md` | sdlc/README + 4 onboarding guides |
| V14 | DR scenario decision tree | `10-dr-bcp/failover.md` | failover + audit-chain-recovery + backup-strategy + recovery-objectives |
| V15a | C4-L3 storage | `04-design/module-storage.md` | module-storage + schema + migrations + ADR-0001 |
| V15b | C4-L3 security | `04-design/module-security.md` | module-security + 4 security component docs |
| V16 | Role map | `01-charter/README.md` | charter README + 4 onboarding guides |
| V17 | Cost stacked bar | `16-cost/cost-model.md` | cost-model + finops + pricing-runway |
| V18 | ADR dependency graph | `12-governance/decision-log.md` | all 6 ADRs + decision-log + adr-process |

---

## A note on style consistency

The 18 visualizations span several types (mermaid graphs, sequence diagrams, class diagrams, gantt, timeline; plus SVG for Venn / Ishikawa / stacked bars). It's fine — possibly preferable — for them not to share a unified visual style. They serve different docs in different contexts.

Where they SHOULD be consistent:

- **Mermaid syntax conventions** (subgraph naming, edge label style) match existing diagrams in the project.
- **Color semantics** (severity, classification, trust) are consistent across visualizations that touch those concepts.
- **Captions** all in the same direct, no-hedging voice.
- **Cross-references** all point to canonical paths under `source/docs/sdlc/...` or `source/docs/adr/...` so they survive the destination doc moving.

---

## Final note

Take your time with V1, V2, V4, V8, V9, V10 — these have the highest impact-to-effort ratio AND have specific structural complexity (chain construction, Venn overlaps, milestone dependencies, fishbone, matrix, timeline) where a polished render makes a meaningful difference.

For V3, V13, V16 — straightforward enough that a solid first pass is the deliverable.

For V11, V17 — these are stacked bars; the data is in the source docs; mostly a layout exercise.

If anything in the briefs is ambiguous, default to the existing diagram style (the C4-L1 in `source/docs/sdlc/02-architecture/README.md` is the cleanest example) and produce something that lands in the same visual neighborhood.

Good luck.
