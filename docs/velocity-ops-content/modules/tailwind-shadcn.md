---
description: "Tailwind CSS + shadcn/ui patterns: CVA variants, design tokens, accessibility"
globs: ["src/components/**/*.tsx", "src/components/ui/**/*.tsx", "tailwind.config.*"]
alwaysApply: false
---

# Tailwind CSS + shadcn/ui — Stack Module

**Targets:** Tailwind CSS 4.x, shadcn/ui (latest), class-variance-authority (CVA), Radix UI primitives
**Appended to base CLAUDE.md when Tailwind CSS and/or shadcn/ui is in use.**

---

## 0. Setup

### Prerequisites

- Node.js 20+
- pnpm 9+
- Existing Next.js or Astro project

### Install Tailwind CSS v4

```bash
# For Vite-based projects (Astro, standalone Vite)
pnpm add -D tailwindcss @tailwindcss/vite

# For Next.js (PostCSS-based)
pnpm add -D tailwindcss @tailwindcss/postcss postcss
```

### PostCSS config for Next.js — `postcss.config.mjs`

```javascript
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
export default config;
```

### CSS entry point — `app/globals.css`

```css
@import 'tailwindcss';
```

### Install shadcn/ui

```bash
npx shadcn@latest init
```

Recommended answers: TypeScript, Default style, CSS variables, `@/` import alias.

### Add components

```bash
npx shadcn@latest add button dialog form input
```

### `lib/utils.ts`

Auto-created by `shadcn init` with the `cn()` helper (Tailwind class merge utility).

### Verify

Add `className="bg-primary text-primary-foreground p-4 rounded-lg"` to any element. Confirm styling renders in browser.

---

## File Structure Conventions

1. shadcn/ui components live in `components/ui/`. Never modify generated files in `components/ui/` unless customizing a component for the project — re-running the shadcn CLI overwrites them. Document customizations with a comment at the top of the file.
2. Project-specific composite components (built from `components/ui/` primitives) live in `components/` (not in `components/ui/`).
3. Keep `tailwind.config.ts` at the project root. Do not duplicate configuration across multiple config files.
4. CSS custom properties for the design system (colors, border-radius, etc.) live in `globals.css` or `app/globals.css`. Never define design tokens inline in component files.

## Tailwind Class Conventions

5. Use design system tokens from `tailwind.config.ts` instead of arbitrary values. Prefer `bg-primary` over `bg-[#5C6AC4]`. Introduce new tokens in the config rather than using one-off arbitrary values:

```html
<!-- Correct — uses design token -->
<div class="bg-primary text-primary-foreground rounded-lg p-4">

<!-- Wrong — hardcoded color bypasses design system -->
<div class="bg-[#5C6AC4] text-white rounded-lg p-4">
```

6. Keep class strings under 150 characters per element. When a class list grows beyond this, extract to a CVA variant or a dedicated component.
7. Use the `cn()` utility (from `lib/utils.ts`) to merge conditional classes. Never use template literals or ternary chains to build class strings:

```typescript
import { cn } from '@/lib/utils';

// Correct
<div className={cn('base-classes', isActive && 'active-classes', className)} />

// Wrong — fragile and bypasses Tailwind merge deduplication
<div className={`base-classes ${isActive ? 'active-classes' : ''} ${className}`} />
```

8. Write mobile-first responsive styles. Apply base styles for mobile, then use `sm:`, `md:`, `lg:`, `xl:` prefixes to override for larger viewports. Never write desktop styles first and use `max-*` prefixes to override for smaller screens.

## Dark Mode

9. Use the `dark:` variant consistently. All color assignments should have an explicit `dark:` counterpart if the default color is not defined as a CSS variable with both light and dark values. Test both modes before marking work complete.

## CVA Variant System (shadcn/ui)

10. Use `class-variance-authority` (CVA) to define component variants. Never use long ternary chains or conditional class strings to handle multi-variant components:

```typescript
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  // base classes (always applied)
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);
```

## Component Patterns (shadcn/ui)

11. All shadcn/ui components must use `React.forwardRef` to forward refs to the underlying DOM element. Omitting `forwardRef` breaks third-party integrations (form libraries, animation libraries):

```typescript
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
```

12. Always set `displayName` on components defined with `forwardRef` or `memo`. This ensures readable component names in React DevTools and error messages.
13. Accept and merge a `className` prop on every presentational component. Always apply it last via `cn()` so consumers can override styles:

```typescript
interface Props extends React.HTMLAttributes<HTMLDivElement> {
  // additional props
}
// className is inherited from HTMLAttributes — always spread it
```

14. Use the `asChild` prop pattern (via Radix `Slot`) to allow consumers to change the rendered element without losing styles and behavior. Prefer `asChild` over custom `as` props:

```typescript
import { Slot } from '@radix-ui/react-slot';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp ref={ref} {...props} />;
  }
);
```

## Accessibility

15. Every interactive element must have an accessible name. Icon-only buttons must include `aria-label` or a visually hidden `<span>`:

```html
<!-- Correct -->
<button aria-label="Close dialog"><XIcon /></button>

<!-- Wrong — screen reader announces nothing meaningful -->
<button><XIcon /></button>
```

16. Never use `outline-none` or `focus:outline-none` without providing an alternative focus indicator. Use `focus-visible:ring-2 focus-visible:ring-ring` (the shadcn/ui standard) instead.
17. Use semantic HTML elements. Do not use `<div onClick>` for interactive elements — use `<button>` for actions and `<a>` for navigation. Radix UI primitives provide accessible implementations; use them instead of rolling custom dialogs, dropdowns, or tooltips.

## CSS Variables and Theming

18. The shadcn/ui color system uses HSL CSS variables (`--primary`, `--background`, `--foreground`, etc.) defined in `globals.css` for both `:root` (light) and `.dark` (dark) selectors. Always reference these via Tailwind tokens (`bg-primary`, `text-foreground`) rather than directly accessing CSS variables in `style={}` props.

## Common Pitfalls

19. Do not install Tailwind plugins that conflict with shadcn/ui's CSS variable system (e.g., `@tailwindcss/forms` resets form styles that shadcn/ui components rely on). Verify plugin compatibility before adding to `tailwind.config.ts`.
20. Avoid mixing Tailwind v3 and v4 configuration patterns. Tailwind v4 uses a CSS-first configuration (`@theme` in CSS) rather than `tailwind.config.ts`. If migrating to v4, convert the config file and remove the JavaScript config — do not maintain both.

---

## Integration Patterns

### Next.js

PostCSS config is already wired via `postcss.config.mjs`. Import `globals.css` in `app/layout.tsx`. CSS variables defined in `globals.css` provide light/dark design tokens under `:root` and `.dark` selectors respectively.

### Astro

Use the `@astrojs/tailwind` integration. Tailwind classes work directly in `.astro` files using the `class` attribute (not `className`, which is React-specific). Install and configure:

```bash
npx astro add tailwind
```

### shadcn Forms with Zod

Use the `<Form>` component from shadcn/ui, which wraps React Hook Form with a Zod resolver for schema-driven validation. See `modules/zod.md` for schema conventions.

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const formSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

type FormValues = z.infer<typeof formSchema>;

function ContactForm() {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', name: '' },
  });

  function onSubmit(values: FormValues) {
    // Handle validated form data
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Your name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
```

---

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|---------|
| Styles not applying | CSS import missing or content paths wrong | Verify `@import 'tailwindcss'` in your CSS entry point |
| Dark mode not working | Missing `.dark` class on html/body | Use `next-themes` or manually toggle `.dark` class on `<html>` |
| shadcn overrides lost on add | `npx shadcn@latest add` overwrites `components/ui/` files | Document customizations with comments. Re-apply after add. |
| Tailwind v3 → v4 confusion | Mixing config patterns | v4 uses CSS-first config (`@theme`). Remove `tailwind.config.ts` when migrating. |
| "Unknown at rule @tailwind" | Editor/linter doesn't recognize Tailwind v4 CSS syntax | Install Tailwind CSS IntelliSense VS Code extension |
