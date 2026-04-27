---
description: "tRPC v11 patterns: procedure hierarchy, Zod-only input, createCallerFactory"
globs: ["src/server/trpc/**/*.ts", "src/server/routers/**/*.ts", "src/trpc/**/*.ts"]
alwaysApply: false
---

# tRPC v11 — Stack Module

**Targets:** tRPC v11.x, React Query v5, Zod 3.x, TypeScript 5.x
**Appended to base CLAUDE.md when tRPC v11 is in use.**

---

## 0. Setup

### Prerequisites

- Node.js 20+
- pnpm 9+
- Existing Next.js or Astro project
- Zod installed (`pnpm add zod` if not already present)

### Install

```bash
pnpm add @trpc/server @trpc/client @trpc/react-query @tanstack/react-query zod
```

> **Note:** Remove the `@next` tag once tRPC v11 reaches stable release. Check the current version at [npmjs.com/package/@trpc/server](https://www.npmjs.com/package/@trpc/server).

### Initial Boilerplate

**`server/trpc/init.ts`** — tRPC instance and base procedure exports:

```typescript
import { initTRPC } from '@trpc/server';
import superjson from 'superjson';

const t = initTRPC.create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
```

### Root Router

**`server/trpc/router.ts`** — minimal root router with a test procedure:

```typescript
import { createTRPCRouter, publicProcedure } from './init';
import { z } from 'zod';

export const appRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => `Hello, ${input.name}!`),
});

export type AppRouter = typeof appRouter;
```

### React Query Provider Setup

Create a provider component that wraps your application with both the tRPC client and React Query's `QueryClientProvider`.

**`lib/trpc/provider.tsx`:**

```typescript
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { useState } from 'react';
import superjson from 'superjson';
import type { AppRouter } from '@/server/trpc/router';

export const trpc = createTRPCReact<AppRouter>();

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

**`app/layout.tsx`** — wrap the app with the provider:

```typescript
import { TRPCProvider } from '@/lib/trpc/provider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
```

### Verify

Call the `hello` procedure from a client component and confirm the response renders:

```typescript
'use client';

import { trpc } from '@/lib/trpc/provider';

export function HelloTest() {
  const { data, isLoading } = trpc.hello.useQuery({ name: 'World' });

  if (isLoading) return <p>Loading...</p>;
  return <p>{data}</p>; // Should render: "Hello, World!"
}
```

If "Hello, World!" renders in the browser, the tRPC stack is wired correctly.

---

## File Structure Conventions

1. Define all tRPC routers under `server/trpc/` (or `src/server/trpc/`). Keep the root router in `router.ts` and sub-routers in `routers/` subdirectories (e.g., `routers/user.ts`, `routers/post.ts`).
2. Define reusable procedure builders in `server/trpc/trpc.ts` (or `trpc/init.ts`). Export `publicProcedure`, `protectedProcedure`, and any additional procedure variants from this single file.
3. Place the tRPC HTTP adapter in `app/api/trpc/[trpc]/route.ts` (Next.js App Router) or `pages/api/trpc/[trpc].ts` (Pages Router). Never spread tRPC logic across multiple API route files.
4. Place the client-side tRPC provider and typed client in `lib/trpc/` or `utils/trpc.ts`. Export a single `trpc` object used by all consuming components.

## Router and Procedure Definitions

5. Always create the root app router with `createTRPCRouter` and export its type as `AppRouter`. This type is the single source of truth for the client:

```typescript
// server/trpc/router.ts
import { createTRPCRouter } from './trpc';
import { userRouter } from './routers/user';
import { postRouter } from './routers/post';

export const appRouter = createTRPCRouter({
  user: userRouter,
  post: postRouter,
});

export type AppRouter = typeof appRouter;
```

6. Use the procedure hierarchy deliberately. Never use `publicProcedure` for routes that require authentication — define a `protectedProcedure` that throws `TRPCError({ code: 'UNAUTHORIZED' })` if the session is absent:

```typescript
// server/trpc/trpc.ts
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { ...ctx, user: ctx.session.user } });
});
```

## Input Validation

7. All procedure inputs must be validated with Zod. Never accept unvalidated or untyped input. Zod is the only accepted validation library for tRPC v11 inputs:

```typescript
export const userRouter = createTRPCRouter({
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return ctx.db.user.findUnique({ where: { id: input.id } });
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(2).max(100),
      email: z.string().email(),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.user.create({ data: input });
    }),
});
```

8. Never use `.input(z.any())` or omit `.input()` for procedures that accept user-provided data. Procedures that intentionally take no input may omit `.input()`.

## React Query Integration

9. On the client, use `@trpc/react-query` to get type-safe React Query hooks. Access all tRPC procedures through the `trpc` client object — do not call `fetch` or `axios` for tRPC endpoints:

```typescript
// Correct usage
const { data, isLoading } = trpc.user.getById.useQuery({ id: userId });
const createUser = trpc.user.create.useMutation();

// Wrong — bypasses type safety
const data = await fetch('/api/trpc/user.getById');
```

10. Use `trpc.useUtils()` to access the query client for cache invalidation after mutations:

```typescript
const utils = trpc.useUtils();
const createUser = trpc.user.create.useMutation({
  onSuccess: () => {
    utils.user.getAll.invalidate();
  },
});
```

## Error Handling

11. Throw `TRPCError` with appropriate HTTP-mapped codes inside procedures. Map domain errors to tRPC codes consistently:

| Domain condition | TRPCError code |
|---|---|
| Not authenticated | `UNAUTHORIZED` |
| Authenticated but not permitted | `FORBIDDEN` |
| Resource not found | `NOT_FOUND` |
| Invalid input (beyond Zod) | `BAD_REQUEST` |
| Unexpected server error | `INTERNAL_SERVER_ERROR` |

12. Use the `onError` option in the tRPC HTTP adapter to log errors server-side. Do not let unhandled promise rejections silently swallow errors.

## Middleware

13. Use tRPC middleware (`.use()`) for cross-cutting concerns: authentication, logging, rate limiting. Chain middleware from specific to general. Each middleware receives the context and must call `next()` or throw:

```typescript
const timingMiddleware = t.middleware(async ({ path, next }) => {
  const start = Date.now();
  const result = await next();
  console.log(`${path} took ${Date.now() - start}ms`);
  return result;
});

export const timedProcedure = t.procedure.use(timingMiddleware);
```

## Subscriptions

14. For real-time features, use tRPC subscriptions with `observable` from `@trpc/server/observable`. Subscriptions require the WebSocket transport (`@trpc/server/adapters/ws`). Do not attempt subscriptions over the default HTTP adapter.

## Common Pitfalls

15. Do not import server-side tRPC router code directly into Client Components — this leaks server secrets. The client interacts only through the typed client object, never through direct imports of server router files.
16. Keep `AppRouter` type import isolated to the client setup file. Other client files import from the typed `trpc` client, not from the server router file.
17. When using Next.js App Router, ensure the tRPC route handler is set up with `fetchRequestHandler` (not `createNextApiHandler` which is Pages Router only):

```typescript
// app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };
```

18. Do not put business logic inside the tRPC route handler file. Route handlers only wire the adapter. Business logic belongs in the procedure handler functions inside router files.

---

## Integration Patterns

### Next.js App Router Adapter

Complete route handler setup using `fetchRequestHandler`. Place this file at `app/api/trpc/[trpc]/route.ts`:

```typescript
// app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/trpc/router';
import { createContext } from '@/server/trpc/context';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,
    onError({ error, path }) {
      console.error(`tRPC error on '${path}':`, error);
    },
  });

export { handler as GET, handler as POST };
```

### Drizzle in tRPC Context

Create a context factory that provides the Drizzle `db` instance to every procedure. This keeps database access centralized and testable. See `modules/drizzle-orm.md` for Drizzle setup details.

```typescript
// server/trpc/context.ts
import { db } from '@/server/db';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';

export async function createContext(opts: FetchCreateContextFnOptions) {
  return {
    db,
    headers: opts.req.headers,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
```

Update `server/trpc/init.ts` to use the context type:

```typescript
import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import type { Context } from './context';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
```

Procedures now have typed access to `ctx.db`:

```typescript
getById: publicProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ input, ctx }) => {
    return ctx.db.select().from(users).where(eq(users.id, input.id));
  }),
```

### Auth Session in Context

Extract the user session from headers or cookies inside the context factory, then create a `protectedProcedure` that guarantees an authenticated user in the context:

```typescript
// server/trpc/context.ts
import { db } from '@/server/db';
import { auth } from '@/server/auth';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';

export async function createContext(opts: FetchCreateContextFnOptions) {
  const session = await auth.getSession(opts.req.headers);
  return {
    db,
    session,
    headers: opts.req.headers,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
```

```typescript
// server/trpc/init.ts
import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { Context } from './context';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.session.user,
    },
  });
});
```

---

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| "Cannot find module '@trpc/server'" | ESM resolution issue | Ensure `"type": "module"` in `package.json` or use `.mjs` extensions |
| Type inference not updating | TypeScript server cache | Restart TS server: VS Code → Cmd+Shift+P → "TypeScript: Restart TS Server" |
| "UNAUTHORIZED" on protected procedure | Session is null in context | Verify auth middleware runs before tRPC handler, check cookie/header forwarding |
| Subscriptions not working | Using HTTP adapter instead of WebSocket | Subscriptions require `@trpc/server/adapters/ws` — HTTP adapter only supports queries and mutations |
| `superjson` serialization error | Date or undefined values in response | Ensure transformer is set to `superjson` in both server and client init |
