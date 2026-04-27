---
description: "Next.js 15 App Router patterns: async params, RSC, server actions, middleware"
globs: ["src/app/**/*.ts", "src/app/**/*.tsx", "next.config.*", "middleware.ts"]
alwaysApply: false
---

# Next.js 15 App Router — Stack Module

**Targets:** Next.js 15.x, React 19, TypeScript 5.x
**Appended to base CLAUDE.md when Next.js 15 App Router is in use.**

---

## 0. Setup

### Prerequisites

- **Node.js 20+** — required by Next.js 15 for native `fetch`, async hooks, and stable ESM support.
- **pnpm 9+** — project standard package manager (never npm or yarn).

### Create Project

```bash
pnpm create next-app@latest my-app --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

| Flag | Purpose |
|------|---------|
| `--typescript` | Enable TypeScript with `strict: true` |
| `--tailwind` | Pre-configure Tailwind CSS |
| `--eslint` | Include Next.js ESLint config |
| `--app` | Use App Router (not Pages Router) |
| `--src-dir` | Place application code under `src/` |
| `--import-alias "@/*"` | Configure `@/` path alias for clean imports |

### Minimum `next.config.ts`

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

### Environment Variables

Create `.env.local` at the project root (git-ignored by default):

```bash
# Public — exposed to the browser (prefixed with NEXT_PUBLIC_)
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_POSTHOG_KEY=

# Server-only — never sent to the browser (no prefix)
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
AUTH_SECRET=
STRIPE_SECRET_KEY=
```

**Convention:** Variables prefixed with `NEXT_PUBLIC_` are inlined into the client bundle at build time. All other variables are server-only and accessible only in Server Components, Route Handlers, Server Actions, and `middleware.ts`.

**Validation:** Validate all environment variables at application startup using Zod. See `modules/typescript-strict.md` rule 11 for the runtime validation pattern. Example:

```typescript
// src/lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

export const env = envSchema.parse(process.env);
```

### Verify Installation

```bash
pnpm dev
```

**Expected output:** Terminal shows `▲ Next.js 15.x` and `- Local: http://localhost:3000`. Browser shows the default Next.js welcome page. If either fails, check Node.js version (`node -v` must be 20+) and ensure no other process is bound to port 3000.

---

## File Structure Conventions

1. Place all routes under `app/` using the App Router file conventions: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `route.ts`.
2. Colocate server-only utilities in `lib/server/` and import them only from Server Components or Route Handlers. Never import `lib/server/` from Client Components.
3. Place all Server Actions in dedicated files (`actions/` directory or `app/**/actions.ts`) — never define them inline inside Client Component files.
4. Use `components/` for shared components. Prefix client-only components with a `'use client'` directive on the first line. Absence of the directive means the component is a Server Component.
5. Keep `middleware.ts` at the project root (next to `app/`). Do not create nested middleware files.

## React 19 Async Params

6. `params` and `searchParams` props are Promises in Next.js 15 / React 19. Always `await` them before destructuring:

```typescript
// CORRECT
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { slug } = await params;
  const { q } = await searchParams;
}

// WRONG — synchronous destructure will throw
export default function Page({ params }: { params: { slug: string } }) {
  const { slug } = params; // runtime error in Next.js 15
}
```

7. In `generateMetadata`, `generateStaticParams`, and `generateViewport`, also `await` the `params` argument — they are Promises in the same way.

## Fetch Caching

8. `fetch()` in Next.js 15 defaults to `cache: 'no-store'` (not `force-cache`). Explicitly set `cache: 'force-cache'` or `next: { revalidate: N }` for data that should be cached:

```typescript
// Cached for 60 seconds
const data = await fetch(url, { next: { revalidate: 60 } });

// Permanently cached until revalidated
const data = await fetch(url, { cache: 'force-cache' });

// Explicitly opt out (the new default — explicit is clearer)
const data = await fetch(url, { cache: 'no-store' });
```

9. Use `unstable_cache` from `next/cache` for caching non-fetch async operations (database queries, external SDK calls). Pair with `revalidateTag` / `revalidatePath` for on-demand revalidation.

## Server Actions

10. Declare Server Actions with `'use server'` at the top of the file (file-level directive), not inside individual functions. Return serializable values only — no class instances, no functions.
11. Validate all Server Action inputs with Zod before processing. Never trust client-sent data.
12. Use `useActionState` (React 19, from `react`) to manage Server Action state in forms — `useFormState` is removed in React 19:

```typescript
// CORRECT — React 19
import { useActionState } from 'react';
const [state, action, isPending] = useActionState(myServerAction, initialState);

// WRONG — removed in React 19
import { useFormState } from 'react-dom'; // no longer exists
```

## Component Patterns

13. Default to Server Components. Add `'use client'` only when the component uses browser APIs, event handlers, `useState`, `useEffect`, or other client-only hooks.
14. When wrapping a Client Component that needs server data, pass the data as props from a parent Server Component — do not fetch server-side data inside a Client Component.
15. Use `Suspense` boundaries to wrap async Server Components and stream UI progressively. Place `loading.tsx` files at route segment boundaries, not around individual components.

## Environment Variables

16. Never access `process.env.SECRET_*` or any non-`NEXT_PUBLIC_` variable inside a Client Component or a file imported by one. The pre-commit hook enforces this. Server Components, Route Handlers, and Server Actions may use private env vars freely.

## Route Handlers

17. In `app/api/**/route.ts`, always return a `NextResponse` (or `Response`) with an explicit status code. Use `NextRequest` for typed request access. Do not use the Pages Router `res.json()` pattern.

## Common Pitfalls

18. Do not mix `app/` and `pages/` routers for the same routes. Migration from `pages/` to `app/` must be complete per-route before the old file is deleted.
19. Do not use `getServerSideProps`, `getStaticProps`, or `getStaticPaths` inside `app/` — these are Pages Router APIs. Use `fetch` with cache options and `generateStaticParams` respectively.
20. Image optimization: always use `next/image` `<Image>` instead of `<img>`. Provide explicit `width` and `height` or use `fill` with a positioned container. Missing dimensions are a build warning.

---

## Integration Patterns

### With tRPC v11

Set up the tRPC HTTP adapter in the App Router catch-all route handler. This bridges tRPC's router to Next.js API routes:

```typescript
// app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/trpc/router';
import { createTRPCContext } from '@/server/trpc/trpc';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ req }),
  });

export { handler as GET, handler as POST };
```

See `modules/trpc-v11.md` for router definition patterns, procedure builders, and client-side provider setup.

### With Drizzle ORM

Call repository functions from Server Actions to keep database logic out of route handlers and UI code:

```typescript
// app/posts/actions.ts
'use server';

import { z } from 'zod';
import { createPost, getPostsByAuthor } from '@/server/repositories/posts';

const CreatePostInput = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
});

export async function createPostAction(formData: FormData) {
  const input = CreatePostInput.parse({
    title: formData.get('title'),
    content: formData.get('content'),
  });

  const post = await createPost(input);
  return { success: true, postId: post.id };
}
```

See `modules/drizzle-orm.md` for schema definitions, repository layer conventions, and migration workflows.

### With Tailwind + shadcn/ui

The design system is powered by CSS custom properties defined in `globals.css` (or `app/globals.css`). shadcn/ui components consume these variables via Tailwind utility classes like `bg-primary`, `text-muted-foreground`, and `border-border`. When customizing the theme:

1. Edit the CSS variables in `globals.css` (not individual component files).
2. Use design tokens from `tailwind.config.ts` instead of arbitrary values.
3. Composite components built from shadcn/ui primitives go in `components/`, not `components/ui/`.

See `modules/tailwind-shadcn.md` for CVA variant patterns, accessibility requirements, and dark mode conventions.

---

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| `params` is not a Promise | Using Next.js 14 pattern with sync params destructure | `await params` before destructuring (React 19 change) — see rule 6 |
| Hydration mismatch | Server and client render different content | Move browser-only code into `useEffect` or add `suppressHydrationWarning` |
| `redirect()` caught by try/catch | `redirect()` throws a `NEXT_REDIRECT` error internally | Never wrap `redirect()` in try/catch — call it outside |
| `cookies()` / `headers()` error | These are now async in Next.js 15 | `const cookieStore = await cookies()` |
| `useFormState` not found | Deprecated in React 19 (will be removed in a future version) | Use `useActionState` from `'react'` instead — see rule 12 |


## Engine Vertical Integration

When this module is used in a client engagement, check the relevant industry vertical config in `engine/verticals/` for:
- **Compliance signals** that affect technology choices (e.g., HIPAA → encryption at rest, GLBA → audit logging)
- **Pain points** that the technology stack should address
- **Recommended services** that pair with this stack

Cross-reference `engine/verticals/{industry}.md` before making data storage, authentication, and API design decisions for client work.
