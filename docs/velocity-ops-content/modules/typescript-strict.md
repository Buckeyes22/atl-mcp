---
description: "TypeScript strict mode baseline: 10 required compiler options, type safety rules"
globs: ["tsconfig*.json", "**/*.ts", "**/*.tsx"]
alwaysApply: false
---

# TypeScript Strict — Stack Module

**Targets:** TypeScript 5.x
**Appended to base CLAUDE.md for all TypeScript projects with strict configuration.**

---

## 0. Setup

### Prerequisites

- Node.js 20+
- pnpm 9+

### Install

```bash
pnpm add -D typescript @types/node
```

> **Note:** Next.js and Astro projects include TypeScript by default during `create-*` — verify before installing separately.

### Initialize config

```bash
npx tsc --init
```

Then replace the generated `tsconfig.json` with the strict baseline from rule 1.

### Path aliases — add to `tsconfig.json`

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Verify

```bash
pnpm tsc --noEmit --pretty
```

Expected: Zero errors. If errors appear, they are real type issues to fix.

```bash
pnpm tsc --showConfig
```

Verify all strict flags from rule 1 are `true`.

---

## Compiler Configuration Baseline

1. All TypeScript projects must use the following strict compiler options in `tsconfig.json`. These are non-negotiable for production code:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true
  }
}
```

2. `strict: true` enables eight sub-flags (`strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitAny`, `noImplicitThis`, `alwaysStrict`, `useUnknownInCatchVariables`). Never disable individual sub-flags to work around type errors — fix the types.

## No `any` Types

3. Never use `any`. Use `unknown` for values of unknown type — it requires explicit narrowing before use, which forces correct handling. Use `never` for values that should never exist:

```typescript
// Wrong
function parseData(input: any): any { ... }

// Correct — caller must narrow before using result
function parseData(input: unknown): ParsedData {
  if (!isValidInput(input)) throw new Error('Invalid input');
  return input as ParsedData; // safe cast after guard
}
```

4. Never use `@ts-ignore`. Use `@ts-expect-error` only when suppressing a known compiler limitation (not a type error you do not want to fix), and always include an explanatory comment on the same line.
5. Never use type assertions (`as SomeType`) unless you have verified the value's shape through a runtime check or the source is provably typed. Document why the assertion is safe with an inline comment.

## Discriminated Unions and Exhaustiveness

6. Model mutually exclusive states with discriminated unions, not optional properties with boolean flags:

```typescript
// Wrong — allows impossible states (isLoading && data both truthy)
type State = {
  isLoading: boolean;
  data?: User;
  error?: Error;
};

// Correct — each state is unambiguous
type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: User }
  | { status: 'error'; error: Error };
```

7. Always use an exhaustiveness check in switch statements and if-else chains over discriminated unions. Assign the final `default`/`else` case to a `never`-typed variable so the compiler catches unhandled variants when the union grows:

```typescript
function renderState(state: State): string {
  switch (state.status) {
    case 'idle': return 'Idle';
    case 'loading': return 'Loading...';
    case 'success': return state.data.name;
    case 'error': return state.error.message;
    default: {
      const _exhaustive: never = state;
      throw new Error(`Unhandled state: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
```

## Branded Types for IDs

8. Use branded (nominal) types for ID fields to prevent accidental mixing of same-primitive IDs:

```typescript
type UserId = string & { readonly __brand: 'UserId' };
type PostId = string & { readonly __brand: 'PostId' };

function createUserId(id: string): UserId {
  return id as UserId;
}

// Compiler now prevents passing PostId where UserId is expected
function getUser(id: UserId): Promise<User> { ... }
```

## Type-Safe Array Access

9. `noUncheckedIndexedAccess` makes array access return `T | undefined`. Always handle the undefined case:

```typescript
const items = ['a', 'b', 'c'];

// Wrong — TypeScript would allow without noUncheckedIndexedAccess,
// but crashes at runtime if index is out of bounds
const first = items[0].toUpperCase();

// Correct
const first = items[0];
if (first !== undefined) {
  console.log(first.toUpperCase());
}

// Or use Array.at() with a fallback
const last = items.at(-1) ?? '';
```

## Optional Properties

10. With `exactOptionalPropertyTypes: true`, there is a distinction between a property being absent and a property being set to `undefined`. Match this distinction in object literals:

```typescript
type Config = {
  timeout?: number; // may be absent — do not set to undefined
};

// Wrong — sets timeout to undefined (distinct from absent with exactOptionalPropertyTypes)
const config: Config = { timeout: undefined };

// Correct — omit the property
const config: Config = {};

// Correct — set a value
const config: Config = { timeout: 5000 };
```

## Runtime Validation with Zod

11. Use Zod to validate external data at runtime (API responses, form inputs, environment variables). Never assert types on external data without runtime validation:

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  createdAt: z.coerce.date(),
});

type User = z.infer<typeof UserSchema>; // derive TypeScript type from schema — single source of truth

// External data goes through parse, not type assertion
const user = UserSchema.parse(apiResponse); // throws ZodError on invalid data
const userOrNull = UserSchema.safeParse(apiResponse); // returns { success, data } | { success: false, error }
```

12. Use `ts-to-zod` to generate Zod schemas from existing TypeScript type definitions when adding validation to existing codebases. Run `pnpm ts-to-zod src/types.ts src/types.zod.ts` and verify parity with `pnpm ts-to-zod --all && git diff --exit-code`.

## Function Signatures

13. Always annotate function return types explicitly for exported functions and public API surfaces. Inferred return types are acceptable for internal utility functions:

```typescript
// Exported function — explicit return type required
export async function getUserById(id: UserId): Promise<User | null> { ... }

// Internal utility — inference acceptable
function formatDate(date: Date) {
  return date.toISOString().split('T')[0];
}
```

14. Use `readonly` for function parameters and properties that should not be mutated. Prefer `ReadonlyArray<T>` (or `readonly T[]`) over `T[]` for arrays passed as arguments:

```typescript
function processItems(items: ReadonlyArray<Item>): Result[] {
  return items.map(transform); // items cannot be modified
}
```

## Module Imports

15. Use explicit named imports over namespace imports (`import * as`). Namespace imports defeat tree-shaking and obscure the actual API surface being used.
16. Use `import type` for type-only imports. This is enforced by `isolatedModules: true` and ensures type imports are stripped without needing the full module at runtime:

```typescript
import type { User, Post } from './types'; // type-only
import { createUser } from './users';       // value import
```

---

## Integration

### With Next.js

Next.js uses `next.config.ts` (TypeScript natively). The `tsconfig.json` is auto-extended by the `next` plugin. Path aliases in `tsconfig.json` are auto-resolved by the Next.js bundler.

### With ESLint type-checked rules

Set `parserOptions.project: true` and `tsconfigRootDir: import.meta.dirname` in `eslint.config.mjs`. Reference `quality/eslint-rules.md`.

### With Vitest

Add `/// <reference types="vitest/globals" />` to `tsconfig.json` or use `vitest.config.ts` with the `typecheck` option.

---

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| "Type 'X' is not assignable to type 'Y \| undefined'" | `noUncheckedIndexedAccess` — array access returns `T \| undefined` | Check for `undefined` before using. See rule 9. |
| "Type 'undefined' is not assignable..." on spread | `exactOptionalPropertyTypes` distinguishes absent vs `undefined` | Omit the property instead of setting it to `undefined`. See rule 10. |
| "A 'filtered' import is not re-exported" | `verbatimModuleSyntax` requires `import type` for type-only imports | Change `import { Foo }` to `import type { Foo }` for types. See rule 16. |
| "Cannot find module '@/...'" | Path aliases not configured in bundler | Next.js auto-resolves. Vite needs `vite-tsconfig-paths` plugin. |
| "isolatedModules" errors | File has no imports/exports | Add `export {}` at the bottom or convert to a module. |
