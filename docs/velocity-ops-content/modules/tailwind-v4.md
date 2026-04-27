---
description: "Tailwind CSS v4 patterns: framework-agnostic utility usage, tokens, and responsive design rules"
globs: ["src/**/*.tsx", "src/**/*.ts", "src/**/*.svelte", "src/**/*.css", "tailwind.config.*", "postcss.config.*"]
alwaysApply: false
---

# Tailwind CSS v4 — Stack Module

**Targets:** Tailwind CSS 4.x
**Appended to base CLAUDE.md when Tailwind v4 is in use.**

---

## 0. Setup

- Tailwind v4 should be treated as a reusable styling primitive, not a React-only add-on.
- Keep setup aligned with the build tool in use:
  - Next.js: PostCSS path
  - Vite/SvelteKit/Astro: Vite plugin path

## Styling Rules

1. Prefer design tokens and semantic utility layers over hardcoded arbitrary values.
2. Keep class lists readable. Extract repeated compositions into components, utility functions, or variant helpers before they become unreviewable.
3. Use mobile-first responsive styling.
4. Keep dark-mode behavior explicit. A component with light-mode styling but no reviewed dark behavior is incomplete if the project supports dark mode.

## Framework-Agnostic Guidance

5. Do not bake React-specific assumptions into Tailwind usage. Tailwind rules should work the same way in SvelteKit, Next.js, Astro, or other web stacks.
6. Keep utility composition helpers framework-native:
   - React/Next.js may use `cn()` style helpers
   - SvelteKit may use class directives or small utility wrappers
7. Tailwind should not be responsible for business logic branching. Keep conditionals small and push complexity into typed view-model decisions.

## Tokens and Theming

8. Centralize colors, spacing, radii, and typography decisions. Avoid scattered one-off values that bypass the design system.
9. CSS variables and theme tokens should be declared in one canonical styling surface, not duplicated across feature directories.

## Accessibility and UX

10. Do not remove focus states unless a reviewed replacement exists.
11. Preserve semantic HTML and accessible names; Tailwind should not encourage `div`-as-button anti-patterns.
12. Keep interaction feedback visible for loading, error, empty, and disabled states.
