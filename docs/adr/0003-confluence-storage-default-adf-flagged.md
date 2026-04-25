---
status: accepted
date: 2026-04-25
deciders: [orchestrator-team]
consulted: []
informed: [build-agents]
---

# 0003. Confluence body representation: storage default, atlas_doc_format behind a feature flag

## Context

v6 §11 + §28 M2 require the orchestrator to render generated Confluence pages in the v2 REST API's body representation. Confluence supports two formats: `storage` (XHTML-with-Confluence-macros) and `atlas_doc_format` (an ADF-shaped JSON body, distinct from Jira's ADF). Both are first-class for some Cloud sites but not all — ADF support is rolled out per-instance and historically has lagged storage on certain macros.

If we default to ADF and a target site doesn't fully support it (or supports it but renders differently), generated pages either fail to write or render incorrectly. If we default to storage, every Cloud site with API access works.

## Decision Drivers

- v6 §28 M2 acceptance explicitly says "use storage by default; atlas_doc_format behind a feature flag only when tests prove compatibility."
- Operator surprise must be avoided: the first generated page must render correctly without per-site tuning.
- The orchestrator's storage renderer (`src/providers/atlassian/confluenceStorageRenderer.ts`) is small, deterministic, easy to test (no JSON schema gymnastics).
- ADF round-tripping requires a separate renderer + per-macro fallback handling that is not necessary for v1 prose-heavy pages (project briefs, requirement docs, ADR copies).

## Considered Options

1. **storage default, atlas_doc_format behind feature flag** — what M2 acceptance asks for. Minimal risk; small code surface. Downside: ADF benefits (better collaborative editing, embedded macros) deferred.
2. **atlas_doc_format default** — better future-proofing but introduces per-site uncertainty in v1 and demands a second renderer immediately.
3. **Auto-detect per space** — query `bodyRepresentations` from the space metadata and pick. Possible later, but capability discovery in M2 doesn't include a "rendering equivalence" test, only a "supported" flag. Surprises on edge-case macros.

## Decision Outcome

**Adopt option 1.** `confluenceRestProvider`:

- Defaults to `storage` for `getPage` body fetches.
- Accepts `storage` for `createPage` / `updatePage` unconditionally.
- Accepts `atlas_doc_format` only when constructed with `atlasDocFormatEnabled: true`. When the flag is off, the provider throws a clear error pointing back to this ADR.
- `discoverSpaceCapabilities` reports `bodyRepresentations: ["storage"]` by default, or `["storage", "atlas_doc_format"]` when the flag is on, so downstream planners can branch on the flag without a separate config lookup.

The storage renderer lives in `src/providers/atlassian/confluenceStorageRenderer.ts` and supports the markdown subset the orchestrator emits today: headings, paragraphs, lists (ordered + unordered), inline emphasis (strong + em + code + link), fenced code blocks (rendered as Confluence code macros), and CDATA-safe escaping. Tables and richer macros land when M5 first needs them.

## Consequences

### Good

- v1 ships with predictable rendering across all Confluence Cloud sites.
- Single tested renderer to maintain in M2.
- Per-site feature-flag override keeps the door open for ADF when an operator wants it.
- `bodyRepresentations` discovery output becomes the contract M5 planners read; flipping the flag is the only ergonomic change needed when ADF is adopted.

### Bad

- Loses access to richer page elements that ADF surfaces (e.g., live `inline-card` macros). Acceptable for v1's prose-heavy generation surface.
- Atlassian may eventually deprecate storage in favor of ADF. The deprecation horizon is not announced; we re-evaluate on minor v6 versions.

### Neutral

- atlas_doc_format renderer (Jira ADF != Confluence ADF, despite the name reuse) is **not** built in M2. When promoted, it lives at `src/providers/atlassian/confluenceAdfRenderer.ts` (placeholder per v6 §8 layout). Tests would mirror the storage renderer's coverage, plus per-macro round-trip equivalence.
- Operators who need ADF today flip `atlasDocFormatEnabled: true` in `confluenceRestProvider` config and pass `representation: "atlas_doc_format"` bodies. They are responsible for producing correct ADF JSON until the renderer ships.

## More Information

- v6 plan §11 (Generated Confluence Structure).
- v6 plan §28 M2 acceptance bar.
- `src/providers/atlassian/confluenceProvider.ts` — interface declaring both representations.
- `src/providers/atlassian/confluenceRestProvider.ts` — implementation enforcing the feature flag.
- `src/providers/atlassian/confluenceStorageRenderer.ts` — storage renderer.
- `tests/unit/providers/atlassian/confluenceStorageRenderer.test.ts` — covers headings, lists, code blocks, CDATA escaping, link rendering, Windows-CRLF normalization.
- `tests/integration/providers/confluenceRestProvider.test.ts` — verifies the flag rejects ADF when off and accepts when on.

## Status notes

- 2026-04-25: `src/providers/atlassian/confluenceAdfRenderer.ts` placeholder remains TBD. M2 ships storage-only; promotion of the ADF renderer awaits operator demand for ADF-specific macros. F-014 in audit findings.
