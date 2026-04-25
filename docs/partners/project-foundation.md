# Partner Integration: project-foundation

## 1. Why this partner

**Category: B (pattern-lift).** project-foundation is the heaviest pattern donor in v6 across 10 findings (F-021 through F-030). The orchestrator lifts design patterns from its mature, battle-tested implementations without vendoring runtime code. **Gap closed**: v6 §3 (storage abstraction), §7.2 (PolicyDecisionLayer interface), §8 (repository pattern), §9 (storage policy + migrations), §18 (idempotent upsert), §19 (Transport interface), §20 (env validation + HMAC), §21 (rate limiter), §24 (notification adapters), and §26 (webhook HMAC verification) all draw from project-foundation's proven solutions. **Alternatives considered**: build all from scratch — rejected due to maturity, test coverage, and production track record of project-foundation patterns. Findings reference: `repo-extraction-findings.md` lines 106–131, §40 F-021 through F-030.

## 2. Prerequisites

Pattern-lift only; no runtime dependency on project-foundation. Libraries the orchestrator will install to implement the patterns:

- `drizzle-orm` (dual-mode Drizzle ORM client, migrations, introspection)
- `@electric-sql/pglite` (in-memory/file-backed SQLite for dev mode)
- `postgres-js` (Postgres wire client for prod mode)
- `node:crypto` (HMAC-SHA256, timingSafeEqual, session tokens)
- `node:test` + `node:assert/strict` (test framework, matches project-foundation)

No project-foundation-specific npm/pip dependencies required.

## 3. Source provenance

**Source**: project-foundation monorepo (`apps/api/`, `packages/shared/`). **Patterns referenced in v6**: §3, §7.2, §8, §9, §18, §19, §20, §21, §24, §26, M1, M3, M5, M6a, M11. **No install required**; semantically reference file paths in implementation as shown in §6. Pin commit SHA in v6 §40 F-021..F-030 rows when chosen.

## 4. Configuration

### 4.1 Environment variables

Pattern-lift; configuration is documented in v6 §20. Key env variables lifted from project-foundation patterns:

- `DATABASE_DEV_MODE` (F-021): boolean flag to switch Drizzle client between PGlite and Postgres. Documented in v6 §20.
- `HMAC_SECRET` (F-024): base64-encoded 32-byte key for HMAC-SHA256 session tokens. Documented in v6 §20.
- Rate-limiter config (F-023): per-window max requests; documented in v6 §21 config table.

### 4.2 Config file overlays

Optional; pointer only. v6 §9 includes storage policy YAML showing PGlite for dev, Postgres for prod. Refer to v6 §9 for the complete structure.

## 5. Adoption points in v6

- **F-021** → §3 + §9 + §20 + M1 (Drizzle dual-mode client: PGlite + Postgres)
- **F-022** → §9 + M1 (Drizzle pgTable schemas + migration runner + rehearsal test)
- **F-023** → §21 (sliding-window rate limiter with bucket pruning)
- **F-024** → §20 (HMAC-SHA256 session token with timingSafeEqual)
- **F-025** → §7.2 (RBAC action-vector → PolicyDecisionLayer interface shape)
- **F-026** → §26 + M3 (Stripe-style HMAC verification + mocked-fetch tests)
- **F-027** → §18 + M5 + M6a (idempotent upsert pattern: ensure-*-tracking.ts)
- **F-028** → §19 + §24 + M11 (Pluggable Transport<T> interface for notification adapters)
- **F-029** → §20 (Defensive env-parsing helpers)
- **F-030** → §8 (Repository + service + route handler split — v6 repo structure)

## 6. Pattern excerpts

**Dual-mode Drizzle client** (`src/storage/db.ts`):
```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePGlite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";

function createDbClient() {
  if (process.env.DATABASE_DEV_MODE) {
    const pglite = new PGlite(process.env.DATABASE_URL || ":memory:");
    return drizzlePGlite(pglite);
  }
  const client = postgres(process.env.DATABASE_URL);
  return drizzle(client);
}
```

**Sliding-window rate limiter** (`src/security/rateLimiter.ts`):
```ts
interface RateLimitBucket { count: number; expiresAt: number; }

export function createRateLimiter(windowMs: number, maxRequests: number) {
  const buckets = new Map<string, RateLimitBucket>();
  return {
    allow(key: string) {
      const now = Date.now();
      for (const [k, b] of buckets) if (b.expiresAt <= now) buckets.delete(k);
      const bucket = buckets.get(key) || { count: 0, expiresAt: now + windowMs };
      if (bucket.count < maxRequests) {
        bucket.count++; buckets.set(key, bucket);
        return { allowed: true, remaining: maxRequests - bucket.count };
      }
      return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil((bucket.expiresAt - now) / 1000) };
    },
  };
}
```

**RBAC action-vector** (`src/auth/roles.ts`) — models v6 §7.2 PolicyDecisionLayer:
```ts
interface RbacDecision {
  allowed: boolean;
  code: string;       // e.g., "INSUFFICIENT_ROLE", "MFA_REQUIRED"
  message: string;
  obligations?: string[];
}
```

**Idempotent upsert** (`src/storage/repositories/ensure-<entity>-tracking.ts`):
```ts
export async function ensureJiraIssueTracking(db, projectId, issueKey) {
  const existing = await db.query.jiraIssueLinks.findFirst({
    where: (t, { and, eq }) => and(eq(t.projectId, projectId), eq(t.issueKey, issueKey)),
  });
  if (existing) return existing.id;
  const [result] = await db.insert(jiraIssueLinks).values({ projectId, issueKey, createdAt: new Date() }).returning({ id: jiraIssueLinks.id });
  return result.id;
}
```

**Transport<T> interface** (`src/transports/Transport.ts`):
```ts
export interface Transport<T> {
  send(payload: T): Promise<{ success: boolean; error?: string }>;
}
```

**Defensive env parsing** (`src/config/env.ts`):
```ts
export function trimToUndefined(v: string | undefined) { return v?.trim() || undefined; }
export function readString(key: string, defaultValue?: string): string {
  const v = trimToUndefined(process.env[key]);
  if (!v && defaultValue === undefined) throw new Error(`${key} is required`);
  return v ?? defaultValue!;
}
export function readNumber(key: string, defaultValue?: number): number { /* parseInt + isNaN guard */ return 0; }
```

## 7. Gotchas

1. **PGlite vs Postgres feature parity**: PGlite does not support all PostgreSQL extensions (e.g., PostGIS, pgvector, full-text search). Verify v6 §9 schema uses only core SQL features compatible with both backends. (findings.md L106–122; F-021)
2. **Drizzle migration ordering**: migrations must be sequential and idempotent. Do not rely on auto-generation; maintain migration files manually. Test migrations in rehearsal mode before deploying. (findings.md L106–122; F-022)
3. **Sliding-window rate-limiter memory leak**: if bucket pruning logic is skipped, the `buckets` Map grows unbounded. Always prune expired entries on every `allow()` call. (findings.md L106–122; F-023)
4. **HMAC-SHA256 timingSafeEqual requirement**: `node:crypto.timingSafeEqual()` requires both arguments to be the same byte length. Reject tokens of mismatched length before calling, or pad to a fixed length. (findings.md L106–122; F-024)
5. **RBAC action-vector contract**: the `{ allowed, code, message, obligations? }` shape must be consistent across all policy-decision code paths. Do not invent new obligation codes without updating v6 §7.2. (findings.md L106–122; F-025)
6. **Webhook HMAC verification timing**: Stripe's signature uses a timestamp embedded in the signed payload. Reject payloads older than (current time – 5 minutes) to prevent replay attacks. (findings.md L106–122; F-026)
7. **Idempotency-key derivation determinism**: ensure-*-tracking functions must derive idempotency keys from the same set of immutable fields every time (e.g., `projectId + issueKey`, never `createdAt`). Non-deterministic keys defeat idempotency. (findings.md L106–122; F-027)
8. **Transport<T> interface contract**: implementations must not throw; return `{ success: false, error: "message" }` on transport failure. Throwing breaks adapter chaining. (findings.md L106–122; F-028)
9. **Defensive env parsing strict mode**: `readString()` without a defaultValue must never return `undefined`. Call `readString(key)` to enforce presence; use `readString(key, "fallback")` to allow default. (findings.md L106–122; F-029)
10. **Repository/service/handler split**: do not call repository methods from route handlers directly; always go through a service to maintain transaction boundaries and policy enforcement. (findings.md L123–131; F-030)

## 8. Validation

Verification checks for v6 pattern adoption:

```bash
# 1. Storage policy enumerates dual-mode
grep -nE "DATABASE_DEV_MODE|PGlite|Postgres" agent-context-orchestrator-mcp-plan-v6.md
# Expect: hits in §3, §9, §20

# 2. PolicyDecisionLayer interface shape
grep -A 5 "interface PolicyDecisionLayer" src/auth/policy.ts | grep -E "allowed|code|message"
# Expect: all three fields present

# 3. Rate limiter present in §21
grep -n "createRateLimiter\|SlidingWindowBucket" agent-context-orchestrator-mcp-plan-v6.md
# Expect: hit in §21 subsection

# 4. Webhook HMAC in §26
grep -n "HMAC\|webhook.*signature\|verifyWebhookSignature" agent-context-orchestrator-mcp-plan-v6.md
# Expect: hit in §26

# 5. Env-parsing helpers in §20
ls -la src/config/env.ts
# Expect: file exists with trimToUndefined, readString, readNumber exports
```

## 9. Operational concerns

**Upstream-archival risk: low.** Dual-mode database, sliding-window rate limiting, HMAC verification, RBAC action-vectors, and transport abstraction are foundational patterns — not unique to project-foundation. They appear in many codebases (Stripe, Tailscale, etc.). project-foundation is one excellent exemplar among many. If the upstream is archived, the orchestrator's implementations stand independently.

**Conformance review**: re-check v6 §9 storage policy and §7.2 PolicyDecisionLayer interface on each minor v6 version bump, especially when drizzle-orm releases patch versions that affect migration semantics.

**Promotion**: not applicable — orchestrator owns full implementation; patterns are inspiration, not references.

**Where patterns live in-tree**:
- `src/storage/db.ts` — dual-mode client (F-021, F-022)
- `src/storage/migrations/` — Drizzle migration files (F-022)
- `src/security/rateLimiter.ts` — sliding-window limiter (F-023)
- `src/security/sessionToken.ts` — HMAC-SHA256 tokens (F-024)
- `src/auth/roles.ts` — RBAC action-vector (F-025)
- `src/security/webhookVerifier.ts` — HMAC verification (F-026)
- `src/storage/repositories/ensure-*.ts` — idempotent upserts (F-027)
- `src/transports/Transport.ts` — pluggable transport interface (F-028)
- `src/config/env.ts` — env-parsing helpers (F-029)
- `src/api/` or `src/workflows/` — repo/service/handler split (F-030)
