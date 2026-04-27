---
description: "SvelteKit patterns: file conventions, load/actions boundaries, server-only modules, adapter-safe deployment"
globs: ["src/routes/**/*.svelte", "src/routes/**/*.ts", "src/routes/**/*.js", "src/lib/**/*.ts", "svelte.config.*", "vite.config.*"]
alwaysApply: false
---

# SvelteKit — Stack Module

**Targets:** SvelteKit 2.x, Svelte 5, TypeScript 5.x
**Appended to base CLAUDE.md when SvelteKit is in use.**

---

## 0. Setup

- Use SvelteKit with TypeScript enabled from day one.
- Keep application code under `src/`.
- Prefer the official adapter for the deployment target. For Cloudflare, use `@sveltejs/adapter-cloudflare`.

```bash
pnpm create svelte@latest my-app
pnpm add -D @sveltejs/adapter-cloudflare
```

### Minimum `svelte.config.js`

```javascript
import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
  },
};
```

---

## File Conventions

1. Routes live in `src/routes/` using SvelteKit file conventions:
   - `+page.svelte`
   - `+page.ts`
   - `+page.server.ts`
   - `+layout.svelte`
   - `+layout.ts`
   - `+layout.server.ts`
   - `+server.ts`
2. Shared browser-safe utilities live in `src/lib/`. Server-only utilities live in `src/lib/server/`.
3. Never import `src/lib/server/` from browser-executed modules. Treat that boundary the same way Next.js treats server-only modules.

## Load and Action Boundaries

4. Use `+page.server.ts` or `+layout.server.ts` when the load function needs secrets, direct database access, or privileged backend calls.
5. Use `+page.ts` or `+layout.ts` only for browser-safe or universal data access. Never leak privileged environment variables or direct database code into universal load functions.
6. Prefer form actions over ad-hoc fetch mutations for route-local form workflows. Keep actions typed, validated, and colocated in `+page.server.ts`.

```typescript
import { fail } from '@sveltejs/kit';
import { z } from 'zod';

const CreateProject = z.object({
  name: z.string().min(1).max(200),
});

export const actions = {
  default: async ({ request }) => {
    const form = await request.formData();
    const parsed = CreateProject.safeParse({
      name: form.get('name'),
    });

    if (!parsed.success) {
      return fail(400, { errors: parsed.error.flatten() });
    }

    return { success: true };
  },
};
```

## Data Flow Rules

7. Validate all external input before it reaches domain logic. Use Zod or the project schema layer.
8. Return only the minimum data needed by the page. Do not stuff entire ORM rows or third-party payloads into `load` return values.
9. Use `depends()` intentionally in load functions when route invalidation must be explicit.

## Environment and Secrets

10. Use SvelteKit environment modules intentionally:
    - `$env/static/public` for compile-time public values
    - `$env/static/private` for compile-time private values
    - `$env/dynamic/public` for runtime public values
    - `$env/dynamic/private` for runtime private values
11. Never import private env modules from browser-executed code.

## Error and UX Conventions

12. Use `error()` and `redirect()` from `@sveltejs/kit` instead of returning hand-rolled sentinel states for routing failures.
13. Keep page-state logic explicit: loading, empty, error, and success states should be visible in the component structure, not implied by missing properties.

## Testing and Anti-Patterns

14. Unit-test server helpers separately from route files. Route files should remain thin orchestration layers.
15. Do not put database access directly in `.svelte` files. Keep data access in load functions, actions, or dedicated server modules.
16. Do not duplicate logic across `+page.ts` and `+page.server.ts`. Choose the correct boundary and keep domain logic in shared typed modules.
