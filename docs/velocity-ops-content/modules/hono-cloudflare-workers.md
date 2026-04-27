---
description: "Hono + Cloudflare Workers patterns: edge-safe routing, bindings, middleware, and runtime constraints"
globs: ["src/**/*.ts", "worker/**/*.ts", "functions/**/*.ts", "wrangler.toml", "wrangler.json", "src/routes/api/**/*.ts"]
alwaysApply: false
---

# Hono + Cloudflare Workers — Stack Module

**Targets:** Hono 4.x, Cloudflare Workers, TypeScript 5.x
**Appended to base CLAUDE.md when Hono on Workers is in use.**

---

## 0. Setup

- Use Hono as the HTTP surface for Worker APIs.
- Use Wrangler for local development and deployment.
- Treat the runtime as edge-first: no Node-only APIs, no filesystem assumptions, no long-lived in-process state.

```bash
pnpm add hono
pnpm add -D wrangler
```

## Runtime Rules

1. Cloudflare bindings are the contract boundary. Access D1, KV, R2, Durable Objects, Queues, and secrets through typed `Bindings`, not ad-hoc globals.
2. Define a typed Hono app context so route handlers know exactly which bindings and variables exist.

```typescript
import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
  STRIPE_WEBHOOK_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();
```

3. Never rely on Node-specific libraries that need `fs`, native TCP sockets, or long-lived background processes unless Cloudflare explicitly supports them.

## Route Organization

4. Organize routes by domain. Keep each route module thin and push business logic into reusable server modules.
5. Group middleware intentionally: auth, logging, rate limiting, and request validation should be centralized instead of duplicated in handlers.

## Validation and Errors

6. Validate request params, headers, query strings, and bodies before calling domain logic.
7. Return explicit JSON error shapes with stable codes. Do not leak raw provider errors to clients.

## Workers-Specific Constraints

8. Keep cold-start and CPU limits in mind. Prefer short request lifecycles and offload longer work to Queues or durable workflows when needed.
9. Avoid hidden global mutation. Workers may reuse isolates, but application correctness must not depend on in-memory state surviving across requests.
10. Use Web Crypto APIs and standards-based fetch primitives rather than Node-specific crypto or request wrappers.

## Webhooks and Signatures

11. Verify webhook signatures against the raw request body before parsing business payloads.
12. Treat idempotency as mandatory for payment, sync, and event-consumer endpoints.

## Boundary with SvelteKit or Frontends

13. When a repo contains both SvelteKit and Hono/Workers, define a clear boundary:
    - SvelteKit owns UI routes and page data loading
    - Hono owns API/webhook routes and edge-specific middleware
14. Shared schema or domain code must remain runtime-safe for both sides. Keep Node-only code out of shared packages.
