# Partner Integration: PAE

## 1. Why this partner

**Category: B (pattern-lift).** PAE contributes production-grade patterns across HTTP resilience, provider abstraction, template rendering, and confidence scoring that v6 adopts as code/design templates. Findings (`repo-extraction-findings.md` lines 174–189) surface six distinct lift-eligible patterns: HTTP retry with Retry-After parsing and 425/408 handling (F-014 → §21), pluggable provider interface shape (F-015 → §19), bundled rule-pack JSON corpus pattern (F-016 → §26.2), Handlebars template selection with conditionals (F-017 → §29 + M4), and dual confidence representation (F-018 → §10, §17.3). The orchestrator adopts these as in-tree implementations without vendoring PAE runtime; alternatives (building retry from scratch, monolithic provider coupling, hand-crafted rules, static templating) are all rejected because PAE already demonstrates these patterns at production quality. §40 F-007 adds multi-repo confidence-gate JSON semantics.

## 2. Prerequisites

N/A — pattern-lift; no runtime dependency. The orchestrator's adoption of PAE patterns requires a Handlebars/Mustache-style templating library (`handlebars`, `nunjucks`, or `eta` for §29 prompts), an HTTP client with retry support (`axios`, `undici`, or `node-fetch` with a retry wrapper for §21 retries), and standard TypeScript/Node tooling. No PAE-specific packages are vendored or required at runtime.

## 3. Source provenance

PAE is a reference implementation for search provider polymorphism and template-driven confidence gating. No install required; patterns are referenced in v6 §19 (provider interface), §21 (HTTP retry), §26.2 (signature corpus), and §29 (prompt templates). Pin the source commit SHA in v6 §40 finding rows F-014 through F-018 for audit traceability.

## 4. Configuration

### 4.1 Environment variables

N/A — pattern-lift. Configuration of retry tuning (max attempts, backoff exponent, Retry-After parsing strategy) and template directory layout is handled by the orchestrator's own `config.yaml`.

### 4.2 Config file overlays

Optional in `config.yaml`:

```yaml
http:
  retry:
    maxAttempts: 5
    baseDelayMs: 200
    respectRetryAfter: true
    statusCodesToRetry: [408, 425, 429, 500, 502, 503, 504]

prompts:
  templatingEngine: handlebars
  conditionalsEnabled: true
  templateDir: src/prompts/templates/
```

## 5. Adoption points in v6

- **F-007** → **§10** (`PolicyDecision.confidence` shape + numeric `confidenceScore` field) + **§17.3** (project-level readiness checks with confidence enum)
- **F-014** → **§21** (HTTP retry with Retry-After header parsing + 425/408 status-code handling for rate-limit and early-data scenarios)
- **F-015** → **§19** (Pluggable provider interface modeled on PAE's SerpAPI/Serper abstraction; shape applies to `JiraProvider` / `ConfluenceProvider` / `VcsProvider` boundary)
- **F-016** → **§26.2** (Bundled rule-pack JSON corpus pattern for webhook signature verification and capability discovery rule packs)
- **F-017** → **§29** + **M4** (Handlebars renderer + conditional template selector for `jira-story-writer`, `confluence-page-writer`, `readiness-reviewer` prompts; signal detection gates regulatory/compliance prompts)
- **F-018** → **§10** + **§17.3** (Confidence enum `"high" | "medium" | "low"` standardized across `ProfileWarning`, `AclEntry`, preflight outputs; numeric `confidenceScore: 0..1` pairs with categorical verdict)

## 6. Pattern excerpts

HTTP retry function (from PAE `src/shared/http.ts`):

```ts
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  baseDelayMs: number
): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts - 1) throw err;
      const retryAfterMs = parseRetryAfter(err.response?.headers["retry-after"]);
      const delayMs = retryAfterMs ?? baseDelayMs * Math.pow(2, attempt);
      await sleep(delayMs);
    }
  }
}
```

Provider interface (from PAE `src/market/search/types.ts`):

```ts
export interface SearchProvider {
  search(query: string): Promise<SearchResult[]>;
  fetchById(id: string): Promise<SearchResult | null>;
  supportsId(): boolean;
}
```

Handlebars template selector (from PAE `src/prompts/selector.ts`):

```ts
export function selectTemplate(signals: Signal[]): string {
  if (signals.includes("regulatory")) return loadTemplate("regulatory-prompt");
  if (signals.includes("compliance")) return loadTemplate("compliance-prompt");
  return loadTemplate("default-prompt");
}
```

Confidence enum (from PAE codebase):

```ts
type Confidence = "high" | "medium" | "low";
interface ConfidenceScore { confidence: Confidence; numeric: number; }
```

## 7. Gotchas

1. **425 (Too Early) handling requires immediate retry without backoff.** Early-data scenarios (HTTP/2 race condition) are transient; sleeping escalates latency. Parse status 425 and retry immediately once, then apply normal backoff. (findings.md L176)
2. **Retry-After can be a decimal-second string (RFC 7231) or an HTTP-date.** The parser must handle both: `Retry-After: 120` (integer seconds), `Retry-After: Fri, 31 Dec 1999 23:59:59 GMT` (date). Parsing a date requires `new Date()` not `parseInt()`. (findings.md L176)
3. **Provider interface discipline: never leak provider-specific types to callers.** SerpAPI returns `organic_results[].link`; Serper returns `results[].link`. Both adapt to a common `SearchResult` shape. Breaking this boundary makes downstream code fragile to provider swaps. (findings.md L177)
4. **Handlebars template injection risk if user data is interpolated raw.** PAE uses `{{{ content }}}` (triple-braces for HTML) and plain `{{ field }}` (auto-escaped) separately. Always use auto-escaped syntax unless explicitly rendering pre-sanitized HTML. (findings.md L181)
5. **Confidence score floating-point comparison is fragile.** Do not compare `score === 0.8`; use tolerances: `score > 0.79 && score < 0.81`. Serialization (JSON → float) and model outputs introduce rounding noise. (findings.md L180)
6. **Rule-pack JSON corpus must use consistent schema per category.** PAE's `data/signatures/` files (frontend / backend / ecommerce / etc.) each have the same `{ id, title, rules }` shape. Divergence breaks loader robustness. (findings.md L188)

## 8. Validation

Smoke tests after integrating patterns:

```bash
# 1. Verify retry status-code set
grep -E "408|425|429|500|502|503|504" src/http/retry.ts
# Expect: all six codes present

# 2. Provider interface shape matches
grep -A5 "interface.*Provider" src/providers/search-provider.ts
# Expect: methods `search()`, `fetchById()`, `supportsId()`

# 3. Rule-pack JSON schema consistency
jq -r '.[] | keys' data/rules/*.json | sort | uniq -c
# Expect: all files have identical key sets

# 4. Handlebars conditionals compile
npm test -- src/prompts/selector.test.ts
# Expect: signal-based template selection tests pass

# 5. Confidence enum in type signatures
grep -r "Confidence = " src/ | head -5
# Expect: enum values "high" | "medium" | "low"
```

## 9. Operational concerns

- **Upstream archival risk**: low — patterns are absorbed into v6 source code (HTTP retry in `src/http/retry.ts`, provider interfaces in `src/providers/`, rule packs in `data/rules/*.json`, prompts in `src/prompts/`, confidence types in `src/types/`). The orchestrator maintains independent implementations; no live dependency on PAE.
- **Conformance review**: on each v6 minor version release, verify that retry status-code lists, provider interface signatures, and rule-pack JSON schemas remain consistent with current PAE patterns (if PAE publishes updates).
- **Promotion to Category A**: would require vendoring PAE as a live search provider (§35.2 Rovo fallback alternative). Not anticipated in v1; defer unless a specific use case emerges (e.g., integrating PAE's search capability directly into the orchestrator as an optional supplementary provider).
