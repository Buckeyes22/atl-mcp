---
description: "Astro 5 patterns: content collections, partial hydration, static-first architecture"
globs: ["src/pages/**/*.astro", "src/layouts/**/*.astro", "src/components/**/*.astro", "astro.config.*"]
alwaysApply: false
---

# Astro 5 — Stack Module

**Targets:** Astro 5.x, TypeScript 5.x
**Appended to base CLAUDE.md when Astro 5 is in use.**

---

## 0. Setup

### Prerequisites

- Node.js 20+
- pnpm 9+

### Create Project

```bash
pnpm create astro@latest my-site
```

Recommend: strict TypeScript, empty template.

### Add Integrations

```bash
pnpm astro add react    # For React component islands
pnpm astro add tailwind # For Tailwind CSS
```

### Baseline `astro.config.mjs`

```javascript
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [react(), tailwind()],
});
```

### Verify

```bash
pnpm dev
```

Expected: `http://localhost:4321` serves the page.

---

## File Structure Conventions

1. Place all pages under `src/pages/`. File-based routing: `src/pages/blog/[slug].astro` produces `/blog/:slug`. API routes use the `.ts` extension: `src/pages/api/endpoint.ts`.
2. Place reusable UI components in `src/components/`. Astro components (`.astro`) are server-only by default. Framework components (React, Svelte, Vue) must live alongside their `.astro` wrappers.
3. Content Collections live in `src/content/`. Each collection requires a schema file at `src/content/config.ts`. Do not place content files outside `src/content/` and expect `getCollection` to find them.
4. Place shared layouts in `src/layouts/`. Always slot page content via `<slot />` — do not hardcode child content in layouts.
5. Static assets served as-is go in `public/`. Assets processed by Vite (optimized, hashed) go in `src/assets/`.

## Content Collections

6. Define every collection schema using `defineCollection` and `z` (Astro's re-exported Zod) in `src/content/config.ts`:

```typescript
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content', // 'content' for Markdown/MDX, 'data' for JSON/YAML
  schema: z.object({
    title: z.string(),
    publishDate: z.coerce.date(),
    draft: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { blog };
```

7. Use `getCollection('blog')` to retrieve all entries. Use `getEntry('blog', slug)` for a single entry. Both are type-safe against the collection schema — no manual type assertions needed.
8. Filter draft entries explicitly before rendering. Never expose draft content in production:

```typescript
const posts = await getCollection('blog', ({ data }) =>
  import.meta.env.PROD ? !data.draft : true
);
```

## Islands Architecture and Hydration Directives

9. Astro components render zero JavaScript by default. Only add hydration directives to framework components that require interactivity client-side. Prefer the least eager directive:

| Directive | When to use |
|---|---|
| `client:load` | Immediately visible, critical interactive UI |
| `client:visible` | Below the fold, hydrate when scrolled into view |
| `client:idle` | Non-critical, hydrate when browser is idle |
| `client:media="(max-width: 768px)"` | Conditionally interactive based on media query |
| `client:only="react"` | Client-only component, skip SSR entirely |

10. Do not use `client:load` for components that are below the fold — use `client:visible`. Excessive `client:load` directives defeat the purpose of partial hydration.

## Static Site Generation

11. For dynamic routes in SSG mode, export `getStaticPaths` from the page:

```typescript
export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map((post) => ({
    params: { slug: post.slug },
    props: { post },
  }));
}

const { post } = Astro.props;
```

12. In SSG mode (default), every page is pre-rendered at build time. To enable server-side rendering for a route, set `export const prerender = false` at the top of that page file. To enable SSR project-wide, set `output: 'server'` in `astro.config.mjs`.

## Astro Component Patterns

13. The `.astro` component frontmatter (between `---` fences) runs on the server only. Variables defined there are not accessible in client-side `<script>` tags — pass data via `data-*` attributes or `define:vars` directive if needed in client scripts.

14. Use `Astro.props` for typed component props. Define the props interface with TypeScript:

```astro
---
interface Props {
  title: string;
  description?: string;
}
const { title, description = 'Default description' } = Astro.props;
---
```

15. Use `<Fragment>` or `<>` to group multiple root elements — `.astro` files support multiple root elements natively (no wrapper required), but framework components still need a single root.

## API Routes

16. Astro API routes (`src/pages/api/*.ts`) export named functions matching HTTP verbs: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`. Always return a `Response` object:

```typescript
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request }) => {
  return new Response(JSON.stringify({ status: 'ok' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
```

## Common Pitfalls

17. Do not import Node.js-only modules (e.g., `fs`, `path`) in components that may render in edge environments. Use `Astro.glob()` for file discovery during build; avoid `fs` in page components.
18. `Astro.request` is only available in SSR mode (`output: 'server'` or `prerender = false`). Accessing it in a fully static page throws at build time.
19. When using React/Preact/Svelte components alongside Astro, install the corresponding integration (`@astrojs/react`, etc.) and add it to `astro.config.mjs` — components silently fail to hydrate without the integration registered.
20. Do not nest `client:*` components arbitrarily deep inside an Astro component tree without understanding hydration island boundaries. Each `client:*` component is an independent island — state does not flow between islands automatically.

## Integration Patterns

### React Component Islands

Use hydration directives to control when React components become interactive on the client. For components below the fold, prefer `client:visible` to defer hydration until the user scrolls them into view. For critical interactive UI that must be usable immediately, use `client:load`. See the hydration directive table in rule 9 for the full set of options.

```astro
---
import HeroSearch from '../components/HeroSearch.tsx';
import NewsletterForm from '../components/NewsletterForm.tsx';
---

<!-- Critical UI — hydrate immediately -->
<HeroSearch client:load />

<!-- Below the fold — hydrate when scrolled into view -->
<NewsletterForm client:visible />
```

### Tailwind in Astro

Tailwind classes work directly in `.astro` files using the standard `class` attribute. Do not use `className` — that is a React/JSX convention. In `.astro` templates, HTML attributes follow native HTML naming.

```astro
<!-- Correct: use class in .astro files -->
<div class="flex items-center gap-4 p-6 bg-white rounded-lg shadow-md">
  <h2 class="text-xl font-bold text-gray-900">Title</h2>
</div>
```

### Content Collections to Pages Pipeline

The full pipeline from content definition to rendered pages follows three steps:

**1. Define the schema** in `src/content/config.ts`:

```typescript
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    publishDate: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
```

**2. Query the collection** and **3. Render in a page** with `getStaticPaths()`:

```astro
---
// src/pages/blog/[slug].astro
import { getCollection } from 'astro:content';
import BlogLayout from '../../layouts/BlogLayout.astro';

export async function getStaticPaths() {
  const posts = await getCollection('blog', ({ data }) =>
    import.meta.env.PROD ? !data.draft : true
  );
  return posts.map((post) => ({
    params: { slug: post.slug },
    props: { post },
  }));
}

const { post } = Astro.props;
const { Content } = await post.render();
---

<BlogLayout title={post.data.title}>
  <Content />
</BlogLayout>
```

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| "Component failed to hydrate" | Integration not registered in `astro.config.mjs` | Run `pnpm astro add react` and verify `integrations` array |
| "Astro.request is not available" | Accessing request in SSG mode | Set `export const prerender = false` or `output: 'server'` |
| Content collection type error | Schema mismatch | Check `src/content/config.ts` schema matches frontmatter fields |
| React component renders but no interactivity | Missing `client:*` directive | Add `client:load` or `client:visible` to the component in `.astro` file |


## Engine Vertical Integration

When this module is used in a client engagement, check the relevant industry vertical config in `engine/verticals/` for:
- **Compliance signals** that affect technology choices (e.g., HIPAA → encryption at rest, GLBA → audit logging)
- **Pain points** that the technology stack should address
- **Recommended services** that pair with this stack

Cross-reference `engine/verticals/{industry}.md` before making data storage, authentication, and API design decisions for client work.
