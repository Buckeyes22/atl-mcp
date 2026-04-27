---
title: Code Style
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer]
sdlc_category: 13-quality
related: [AGENTS.md, CLAUDE.md, docs/sdlc/13-quality/iron-laws.md]
---

# Code Style

> **TL;DR:** TypeScript strict + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`. Default to no comments; comment WHY, not WHAT. Names readable + terse where context exists. Prefer composition over inheritance. ESLint configured + checked in. Style is enforced; idiom is reviewed.

This is the *what idiomatic atl-mcp code looks like* doc. CI catches violations; reviewers catch idiom.

---

## TypeScript

### Strict mode

`tsconfig.json` enables:

- `strict: true`
- `exactOptionalPropertyTypes: true`
- `noUncheckedIndexedAccess: true`
- `noFallthroughCasesInSwitch: true`
- `noImplicitReturns: true`

These together make the type system actually catch bugs.

### `any` is forbidden

`any` requires a comment explaining why. Most uses can be `unknown` + a type guard.

```typescript
// BAD
function parse(input: any) { ... }

// OK
function parse(input: unknown) {
  if (!isObject(input)) throw new TypeError("expected object")
  // ...
}
```

### Discriminated unions

Prefer over base classes for state machines:

```typescript
type ProjectState =
  | { kind: "DRAFT_INTAKE" }
  | { kind: "INTAKE_RECEIVED"; intakeId: string }
  | { kind: "BLUEPRINT_VALIDATED"; blueprintId: string }
  // ...
```

The compiler enforces exhaustive handling.

### Null vs. undefined

`undefined` for "not yet known"; `null` only when an external API uses it. Don't mix.

`exactOptionalPropertyTypes: true` makes this enforceable.

## Comments

### Default to none

Per AGENTS.md and CLAUDE.md: **default to no comments. Add a comment only when the WHY is non-obvious.**

Anti-examples:

```typescript
// BAD: comment restates the code
// Increment counter
counter++

// BAD: comment is a TODO without ticket
// TODO: handle edge case

// BAD: comment is stale (rotted vs. code)
// This function returns the user's ID
function getUsername(): string { ... }
```

Pro-examples:

```typescript
// OK: explains WHY a non-obvious choice
// Use SHA-256 (not SHA-512) to match v6 §30.1 spec.
const hash = sha256(payload)

// OK: explains a workaround
// Confluence v2 returned 400 with "Representation cannot be null"
// despite the body including representation. Falling back to v1 until
// v2 stabilizes. See audit findings F-13.
const result = await fallbackToV1(...)

// OK: warns of an invariant the compiler can't enforce
// IMPORTANT: do not pass user input here — query is concatenated.
db.query(`SELECT ${trustedColumn} FROM users`)
```

### Module headers

The top of each module gets a 3-9 line block comment explaining:

- What it is (one sentence).
- What v6 section / partner guide / ADR drives it.
- What's NOT in scope (one or two lines).
- The milestone where it became production-quality.

```typescript
/**
 * Migration runner with rehearsal mode.
 *
 * Idempotent — re-runs are safe. Rehearsal applies migrations against
 * a temp DB seeded from a prod-shaped snapshot, verifies post-conditions,
 * tears down. See PCO-13 for the rehearsal pattern; runbook Incident B
 * for why it exists.
 *
 * Production-quality from M1.
 */
```

## Names

### Readable + terse where context exists

```typescript
// In a small scope: single-letter is fine
items.map(i => i.name)

// In wider scope: full name
function persistAuditEntry(entry: AuditEntry): Promise<void> { ... }

// Bad: cryptic abbreviation that needs a glossary
function pesAdEntr(e: AdEntr) { ... }
```

### Functions

Verb-first: `persistAuditEntry`, `verifyChain`, `getProfile`. Not `auditEntryPersister`.

### Types

Noun-first: `AuditEntry`, `ProjectBlueprint`. Not `IAuditEntry` (no Hungarian).

### Constants

ALL_CAPS for true constants:

```typescript
const MAX_CONCURRENT_SESSIONS = 1000
```

camelCase for derived values:

```typescript
const defaultBudget = TokenBudget.parse({...})
```

## Errors

### Throw at boundaries

Throw `Error` subclasses at module boundaries; let `Error` propagate within a module.

```typescript
class IllegalStateTransitionError extends Error { ... }
class TenantScopeViolationError extends Error { ... }
class ProviderClientError extends Error { ... }
```

### No silent catches

```typescript
// BAD
try { ... } catch (_) {}

// OK
try { ... } catch (err) {
  logger.warn({ err }, "operation failed; continuing with default")
}
```

### Don't validate at internal boundaries

If module A trusts module B (because both are in-process TypeScript): don't double-validate. Validate at external boundaries only.

## Async

### Default to async/await

Promise chains are unidiomatic in this codebase.

### Don't fire-and-forget

Every promise is awaited or has explicit `.catch(...)` for fire-and-forget.

```typescript
// BAD
sendNotification(...)  // unhandled rejection

// OK
sendNotification(...).catch(err => logger.warn({ err }, "notify failed"))
```

## Composition over inheritance

Almost no class hierarchies in this codebase. Composition + interfaces is preferred.

```typescript
// Prefer
interface VcsProvider { ... }
class BitbucketProvider implements VcsProvider { ... }

// Avoid
abstract class VcsProvider { ... }
class BitbucketProvider extends VcsProvider { ... }
```

## ESLint

Config in `eslint.config.js` (or equivalent). Run: `npm run lint`. Catches:

- Missing return types.
- Unused vars.
- Forbidden imports.
- Unsafe `any` patterns.

Plus `lint:no-stdout` for the protocol invariant.

## Anti-patterns flagged by review

- Long functions (> 80 lines).
- Deep nesting (> 3 levels).
- Side effects in pure-looking functions.
- `console.log` in src/ (caught by lint).
- Inline secrets (caught by review).
- Catching errors and continuing without logging.

## Linked artifacts

- **AGENTS.md:** [`../../../AGENTS.md`](../../../AGENTS.md) — "Coding conventions"
- **CLAUDE.md:** [`../../../CLAUDE.md`](../../../CLAUDE.md) — "Operating rules"
- **Iron laws:** [`iron-laws.md`](iron-laws.md)
- **Anti-slop:** [`anti-slop.md`](anti-slop.md)
- **Quality gates:** [`quality-gates.md`](quality-gates.md)
- **Code review:** [`../12-governance/code-review.md`](../12-governance/code-review.md)

---

*Last reviewed: 2026-04-25 by Chris.*
