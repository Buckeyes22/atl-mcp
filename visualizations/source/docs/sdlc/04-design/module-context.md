---
title: Module — Context Pack Engine
owner: Chris
status: accepted (M7-gated; partial implementation)
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, integrator]
sdlc_category: 04-design
related: [agent-context-orchestrator-mcp-plan-v6.md §16, docs/sdlc/05-data/classification.md, docs/sdlc/06-security/lethal-trifecta.md]
---

# Module — Context Pack Engine

> **TL;DR:** Generates token-budgeted, classification-aware context packs for build agents. Reads project state (blueprint, profile, traces, ACL); applies redaction per data classification; targets a specific model's context window per the 22-model context-size table in v6 §16.1; idempotent — same `regenerationKey` produces the same pack. Includes prompt-injection scanning per v6 §16.5. Lands in M7.

The context pack is the bridge between the orchestrator's project state and a build agent's request. Get it wrong and the agent flies blind or fails for the wrong reason; get it right and the agent has exactly the context it needs.

---

## Purpose

Owns:
- Context-pack generation per v6 §16.
- Token budgeting against the target model (v6 §16.1: 22-model context-size table).
- 5-step progressive truncation (v6 §16.2).
- Hybrid relevance ranking (v6 §16.3): semantic + recency + structural signals.
- Source version pinning (v6 §16.4): every fact in the pack ties back to a specific version of the underlying source.
- Redaction + prompt-injection scanning (v6 §16.5).
- Memory Bank reference (v6 §16.6) — preserved for future use; out of v1 scope.
- Patterns from the awesome-agentic-patterns catalog (v6 §16.7).

Does NOT own:
- Storage of packs (delegates to `contextPackRepository`).
- The MCP tool entry (`context_pack_generate` / `context_get` live in `src/mcp/tools/`).
- Classification rules themselves (data layer owns; the engine consumes).
- The audit chain — pack generations are audited via the policy decision layer.

---

## Public surface

| Symbol | Kind | Signature | Purpose |
|---|---|---|---|
| `generateContextPack` | function | `(input: PackInput) => Promise<ContextPack>` | Main entry: profile + targets + model → ContextPack |
| `getContextPack` | function | `(regenerationKey) => Promise<ContextPack \| null>` | Idempotent re-fetch |
| `ContextPack` | type | (re-exported from `src/domain/contextPack.ts`) | Pack shape |
| `redactor` | function | `(content, classification) => RedactedContent` | Apply classification-aware redaction |
| `tokenBudget` | function | `(targetModel) => Budget` | Compute safe size per model |
| `progressiveTruncate` | function | `(candidates, budget) => TruncatedSet` | Drop content per v6 §16.2 |
| `hybridRank` | function | `(candidates, query) => RankedSet` | Score relevance |
| `injectionScan` | function | `(text) => InjectionFlag[]` | Detect prompt-injection patterns |

---

## Architecture

```mermaid
graph TB
    subgraph Ctx["src/context/"]
        Engine[Pack engine<br/>generateContextPack]
        Budget[tokenBudget<br/>22-model table]
        Rank[hybridRank<br/>semantic + recency + structural]
        Redact[redactor]
        Trunc[progressiveTruncate<br/>5-step]
        Pin[sourceVersionPin]
        InjScan[injectionScan]
    end

    Repos[(repositories)]
    ClassConf[classification config<br/>05-data/classification.md]
    PackRepo[(contextPacks table)]
    Audit[(audit chain)]

    Engine --> Budget
    Engine --> Rank
    Engine --> Redact
    Engine --> Trunc
    Engine --> Pin
    Engine --> InjScan
    Engine --> Repos
    Engine --> PackRepo
    Engine --> Audit
    Redact --> ClassConf
```

The engine orchestrates; each helper is a focused leaf.

---

## Key flows

### Generate context pack

1. **Resolve target.** Project + optional issue. The pack scope determines which content to gather.
2. **Compute token budget** for the requested model (e.g., 200k for Sonnet 4.x, 1M for Opus 4.7 1M context). v6 §16.1's 22-model table is the source of truth; defaults conservatively for unknown models.
3. **Gather candidates.** Blueprint sections, related issues, code snippets (when M7+ pulls them), prior context (when applicable), traces from `traceLinks`.
4. **Hybrid rank** the candidates by relevance (v6 §16.3): semantic similarity to the issue's description + recency of the artifact + structural relevance (e.g., same epic).
5. **Apply redaction** per classification ([`../05-data/classification.md`](../05-data/classification.md)). PRIVATE / SECRET fields don't leave the boundary.
6. **Apply progressive truncation** if over budget (v6 §16.2): drop oldest history first, then related artifacts, then less-relevant sections.
7. **Pin source versions** (v6 §16.4): every included artifact has a version pin so the agent can detect when its context becomes stale.
8. **Scan for prompt injection** (v6 §16.5): pattern-match for known injection shapes; flag suspicious content.
9. **Persist** with `regenerationKey` (deterministic hash of inputs).
10. **Audit + return** the pack.

### Idempotent re-fetch

`getContextPack(regenerationKey)`:
1. Look up by key in `contextPacks`.
2. If found and within TTL: return as-is.
3. If found but stale (TTL expired or upstream changed): regenerate (same inputs → same key still).
4. If not found: error (caller should generate fresh).

The deterministic regen-key means the same request produces the same pack; reproducibility for debugging.

---

## Token budgeting (v6 §16.1)

The 6-category breakdown of how the token budget is allocated:

| Category | Allocation | Purpose |
|---|---|---|
| System / instructions | 5% | Build-agent prompt setup; doesn't change per-call |
| Project blueprint summary | 20% | Why are we building? What's the scope? |
| Issue-specific context | 30% | What story is the agent working? |
| Related artifacts | 20% | Related issues, code samples, prior decisions |
| History / prior context | 15% | What's been tried before? |
| Reserve for response | 10% | Headroom for the agent's output |

When the requested target model has less context than the sum of allocations: progressive truncation kicks in (v6 §16.2):

**5 steps:** drop oldest history → drop least-relevant related artifacts → drop oldest blueprint sections → drop comments-on-comments → fail if still over budget (with a clear error).

The model-context table is in v6 §16.1. Unknown models (or models the engine doesn't recognize) get a conservative 8k-token default.

---

## Hybrid ranking (v6 §16.3)

When budget is bound, choosing what fits matters. Hybrid ranking signals:

1. **Semantic similarity** — embedding-based; how relevant is this candidate to the issue's text?
2. **Recency** — recently-touched artifacts are more relevant.
3. **Structural relevance** — same epic, same component, same author signals proximity.

The combined score is a weighted sum (weights tunable). Hybrid is more interpretable than pure-semantic; cost is more computation.

---

## Redaction (v6 §16.5)

Per the classification policy:

- **PUBLIC** — included as-is.
- **INTERNAL** — included with audit logging.
- **PRIVATE** — included only if the target context is itself trusted to receive PRIVATE; otherwise replaced with `[REDACTED]` markers.
- **SECRET** — never included; replaced with `[SECRET]` markers regardless of context.

The redaction step is **not optional**. It runs on every pack, even if the target seems "safe." Defense in depth.

Failed redaction (a field has no classification metadata) defaults to INTERNAL with a logged warning.

---

## Prompt-injection scanning (v6 §16.5)

Patterns flagged:

- "Ignore previous instructions" / "disregard the above" / etc.
- Embedded role markers ("System:", "Assistant:", etc.) within user-provided content.
- Suspicious tool-call shapes embedded in prose.
- Known injection corpus (curated; updated as new attacks surface).

Detection is heuristic; flagged content gets a warning (or, in strict mode, refused). Not a substitute for the lethal-trifecta detection at the policy decision layer — those work together.

---

## Source version pinning (v6 §16.4)

Every artifact in the pack carries a version pin:

- Blueprint section: `(blueprintId, version, timestamp)`.
- Issue: `(jiraKey, lastUpdated)`.
- Code snippet: `(repo, branch, commitSha, file, lineRange)`.
- Trace link: `(linkId, version)`.

The pack reader (the build agent) can detect stale context: if the pack says "blueprint version 5" and the live blueprint is version 8, the agent knows it's working from outdated info. Surfaces a re-fetch as needed.

---

## Failure modes

### Target model not in budget table

**Symptom:** unknown model name in `targetModel`.

**Action:** falls back to a conservative 8k-token default. Logged as a warning.

### Classification missing on a field

**Symptom:** content arrives without classification metadata.

**Action:** treated as INTERNAL by default; logged warning. Operator should classify the field.

### All redaction rules drop a critical field

**Symptom:** a field essential to the pack is fully redacted.

**Action:** error returned to caller; pack not produced. The caller (operator) must adjust classification or the rules.

### Injection detected in critical content

**Symptom:** the issue's own description contains injection patterns.

**Action:** in strict mode, fail. In permissive mode, warn + continue with sanitization.

### Budget exhausted even after truncation

**Symptom:** the issue + minimal context is still larger than the model's window.

**Action:** error to the caller. The issue is too big; needs to be decomposed.

### Stale pack re-served

**Symptom:** `getContextPack` returns a TTL'd pack while upstream content has changed.

**Action:** TTL semantics. The build agent can detect via version pins and request regeneration.

---

## Tests

Planned (M7):

| Test | What it proves |
|---|---|
| Token budgeting per model | Different model targets produce different budget allocations |
| Redaction correctness | PRIVATE / SECRET classified content is redacted; PUBLIC / INTERNAL preserved |
| Idempotency | Same inputs → same `regenerationKey` → same content |
| Truncation behavior | Over-budget candidates are dropped per the 5-step priority |
| Hybrid ranking ordering | Higher-scoring candidates appear first |
| Prompt-injection detection | Known patterns flagged; benign content not |
| Source version pinning | Each included artifact has a version pin in the pack |

Coverage gaps:
- **Adversarial injection corpus** — needs to be assembled.
- **Cross-model behavior** — testing against actual builds with different model targets.

---

## Configuration

| Var / setting | Default | Purpose |
|---|---|---|
| `targetModel` (per-call) | required | Which model's context window to size for |
| Pack TTL | 30 days (per [`../05-data/retention.md`](../05-data/retention.md)) | When to consider regeneration |
| Hybrid ranking weights | hard-coded for v1 | Tunable post-v1 if signals show drift |
| Injection-scan strictness | `strict` in production tier; `permissive` in dev | Whether flagged content fails or warns |

---

## Concurrency

- Per-request; no shared state.
- Multiple `generateContextPack` calls can run in parallel (different projects or different issues).

---

## Performance

| Operation | Typical | p99 |
|---|---|---|
| Generate context pack | < 2 s | < 10 s |
| Get context pack (cached) | < 100 ms | < 500 ms |

Generation cost is dominated by hybrid ranking (semantic embedding lookups) when M7+ wires it.

---

## Tradeoffs

### Hybrid ranking vs. pure semantic

**Chose:** hybrid (semantic + recency + structural).

**Pro:** more interpretable; less brittle to embedding model changes.

**Con:** more computation per pack; weights need tuning.

### Persistent context packs vs. regenerate-every-time

**Chose:** persisted (with TTL).

**Pro:** repeated requests are cheap; reproducibility for debugging.

**Con:** staleness vs. fresh-data tension.

**Mitigation:** version pinning + TTL; agent can detect staleness.

### Strict redaction vs. permissive

**Chose:** strict-by-default.

**Pro:** defense in depth; classified content doesn't leak.

**Con:** sometimes blocks legitimate context.

**Mitigation:** explicit operator override available; logged + audited.

---

## Roadmap

- **M7:** full implementation lands; integrated with the workflow + tools.
- **M11:** prompt-injection scanning hardening (per v6 §16.5).
- **Post-v1:** Memory Bank reference (v6 §16.6) — currently preserved for reference.
- **Post-v1:** semantic retrieval / vector store (v6 §25).

---

## Linked artifacts

- **Spec:** v6 §16 (full design), §16.1 (token budgeting), §16.2 (truncation), §16.3 (hybrid ranking), §16.4 (source pinning), §16.5 (redaction + injection)
- **Code:** `src/context/` (M7+), `src/domain/contextPack.ts`
- **Sibling modules:** [`module-storage.md`](module-storage.md), [`module-security.md`](module-security.md), [`module-workflows.md`](module-workflows.md)
- **Classification:** [`../05-data/classification.md`](../05-data/classification.md)
- **Lethal trifecta:** [`../06-security/lethal-trifecta.md`](../06-security/lethal-trifecta.md) (related defense)
- **Schema:** [`../05-data/schema.md`](../05-data/schema.md) `contextPacks` table

---

*Last reviewed: 2026-04-25 by Chris.*
