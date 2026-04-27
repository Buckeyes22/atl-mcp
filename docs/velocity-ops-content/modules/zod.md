---
description: "Zod validation: schema patterns, type inference, composition, error formatting"
globs: ["src/types/**/*.ts", "src/schemas/**/*.ts", "**/*.zod.ts"]
alwaysApply: false
---

# Zod — Stack Module

**Targets:** TypeScript projects using Zod for runtime validation and type inference.
**Appended to base CLAUDE.md when Zod is in use.**

---

## 0. Setup

### Prerequisites

- **Node.js** 20+
- **pnpm** 9+
- **TypeScript** 5.x with `strict: true` enabled

### Install

```bash
pnpm add zod
```

### Verify Installation

```bash
pnpm tsc --noEmit
```

Expected: Zero errors. Zod ships its own type declarations — no `@types/` package needed.

---

## File Structure Conventions

1. Place all Zod schemas in `src/types/schemas/` as separate files per domain entity (e.g., `src/types/schemas/user.ts`, `src/types/schemas/order.ts`). Re-export everything from `src/types/schemas/index.ts` as a barrel export.

2. Naming convention: `UserSchema`, `CreateUserSchema`, `UpdateUserSchema` for schemas. Derived types use the same name without the `Schema` suffix: `type User = z.infer<typeof UserSchema>`.

```typescript
// src/types/schemas/user.ts
import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(255),
  role: z.enum(['admin', 'user', 'guest']),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type User = z.infer<typeof UserSchema>;

export const CreateUserSchema = UserSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateUser = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = CreateUserSchema.partial();

export type UpdateUser = z.infer<typeof UpdateUserSchema>;
```

```typescript
// src/types/schemas/index.ts
export * from './user';
export * from './order';
```

---

## Conventions

3. **Schema is source of truth.** TypeScript types are ALWAYS inferred from Zod schemas — never hand-written then validated. The Zod schema defines the shape; the TypeScript type follows:

```typescript
// Correct — type derived from schema
const UserSchema = z.object({ name: z.string(), age: z.number() });
type User = z.infer<typeof UserSchema>;

// Wrong — hand-written type with separate schema
interface User { name: string; age: number; }
const UserSchema = z.object({ name: z.string(), age: z.number() }); // duplication, drift risk
```

4. **Composition.** Use `.extend()` to add fields, `.merge()` to combine schemas, `.pick()` / `.omit()` for subsets:

```typescript
const BaseEntitySchema = z.object({
  id: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// .extend() — add fields to an existing schema
const UserSchema = BaseEntitySchema.extend({
  email: z.string().email(),
  name: z.string().min(1),
});

// .merge() — combine two schemas (flat merge)
const ProfileSchema = UserSchema.merge(
  z.object({ bio: z.string().optional(), avatarUrl: z.string().url().optional() })
);

// .pick() / .omit() — create subsets
const UserSummarySchema = UserSchema.pick({ id: true, name: true });
const CreateUserSchema = UserSchema.omit({ id: true, createdAt: true, updatedAt: true });
```

5. **Refinements.** Use `.refine()` for custom single-field validation, `.superRefine()` for complex multi-field validation:

```typescript
// .refine() — single custom check
const PasswordSchema = z.string().min(8).refine(
  (val) => /[A-Z]/.test(val) && /[0-9]/.test(val),
  { message: 'Password must contain at least one uppercase letter and one number' }
);

// .superRefine() — multi-field validation with path-specific errors
const RegistrationSchema = z.object({
  password: z.string().min(8),
  confirmPassword: z.string(),
}).superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    });
  }
});
```

6. **Transforms.** Use `.transform()` sparingly — it changes the output type. Document when input type differs from output type:

```typescript
// Input: string, Output: Date — document this clearly
const DateStringSchema = z.string().datetime().transform((s): Date => new Date(s));

// Input: string, Output: string (normalized) — less surprising
const NormalizedEmailSchema = z.string().email().transform((email) => email.toLowerCase().trim());
```

7. **Default values.** Use `.default()` for optional fields with defaults. Prefer `.default()` over `?? fallback` in consuming code:

```typescript
const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// After parsing, all fields are guaranteed present — no fallback logic needed
const { page, limit, sortBy, order } = PaginationSchema.parse(queryParams);
```

8. **Error formatting.** Use `z.ZodError.flatten()` for form-friendly error messages. Never expose raw Zod errors to users:

```typescript
const result = UserSchema.safeParse(input);

if (!result.success) {
  const formatted = result.error.flatten();
  // formatted.fieldErrors: { email?: string[], name?: string[] }
  // formatted.formErrors: string[] (root-level errors)
  return { success: false, errors: formatted.fieldErrors };
}

// For nested schemas, use .format() instead:
const nested = result.error.format();
// nested.email?._errors: string[]
```

9. **Enums.** Prefer `z.enum(['a', 'b', 'c'])` over `z.nativeEnum(MyEnum)`. The Zod enum is the source of truth:

```typescript
// Correct — Zod enum is source of truth
const RoleSchema = z.enum(['admin', 'user', 'guest']);
type Role = z.infer<typeof RoleSchema>; // 'admin' | 'user' | 'guest'

// Access enum values programmatically
const roles = RoleSchema.options; // ['admin', 'user', 'guest']

// Wrong — hand-written enum duplicates the source of truth
enum Role { Admin = 'admin', User = 'user', Guest = 'guest' }
const RoleSchema = z.nativeEnum(Role); // duplication, TypeScript enum is now the source
```

10. **Coercion.** Use `z.coerce.date()`, `z.coerce.number()` for parsing string inputs (URL params, form data):

```typescript
const SearchParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  startDate: z.coerce.date(),
  active: z.coerce.boolean(),
});

// Parses { page: "2", startDate: "2024-01-15", active: "true" } correctly
const params = SearchParamsSchema.parse(Object.fromEntries(url.searchParams));
```

11. **Env validation.** Validate all env vars at app startup with a dedicated schema. Fail fast with descriptive errors:

```typescript
// src/env.ts
import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
});

// Fail fast at startup — not at first use
export const env = EnvSchema.parse(process.env);
```

12. **`.parse()` vs `.safeParse()`.** Use `.parse()` at internal trust boundaries where invalid data is a programming error. Use `.safeParse()` at user-facing boundaries where invalid data is expected:

```typescript
// .parse() — internal boundary, throw on invalid (programming error)
const config = ConfigSchema.parse(rawConfig);

// .safeParse() — user input, return structured error (expected invalid input)
const result = CreateUserSchema.safeParse(formData);
if (!result.success) {
  return { errors: result.error.flatten().fieldErrors };
}
const validData = result.data;
```

---

## Integration Patterns

### With tRPC

Every tRPC procedure `.input()` uses a Zod schema. Define the schema in `src/types/schemas/` and import it into the router — do not define schemas inline in procedure definitions:

```typescript
// src/types/schemas/user.ts
export const GetUserInputSchema = z.object({
  id: z.string().uuid(),
});

// server/trpc/routers/users.ts
import { GetUserInputSchema } from '@/types/schemas/user';

export const usersRouter = router({
  getById: publicProcedure
    .input(GetUserInputSchema)
    .query(async ({ ctx, input }) => {
      return ctx.db.query.users.findFirst({
        where: eq(users.id, input.id),
      });
    }),
});
```

See `modules/trpc-v11.md` rule 7 for the full tRPC input validation requirement.

### With Drizzle ORM

Validate query results with `.parse()` when data crosses trust boundaries. Use Zod schemas alongside Drizzle's `InferSelectModel` to ensure runtime safety:

```typescript
import { UserSchema } from '@/types/schemas/user';

export async function getUserById(id: string): Promise<User | undefined> {
  const row = await db.query.users.findFirst({
    where: eq(users.id, id),
  });
  // Validate at trust boundary (e.g., data returned to client)
  return row ? UserSchema.parse(row) : undefined;
}
```

See `modules/drizzle-orm.md` for schema definition and repository patterns.

### With Server Actions

Validate form data with `schema.safeParse()` before processing. Return structured errors for form display:

```typescript
'use server';

import { CreateUserSchema } from '@/types/schemas/user';
import { createUser } from '@/db/repositories/users';
import { revalidatePath } from 'next/cache';

export async function createUserAction(formData: FormData) {
  const raw = {
    email: formData.get('email'),
    name: formData.get('name'),
  };

  const result = CreateUserSchema.safeParse(raw);
  if (!result.success) {
    return { success: false, errors: result.error.flatten().fieldErrors };
  }

  const user = await createUser(result.data);
  revalidatePath('/users');
  return { success: true, data: user };
}
```

### With Environment Variables

Validate all env vars at app startup. Fail fast with descriptive errors so misconfiguration is caught at deploy time, not at first request:

```typescript
// src/env.ts
import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  PORT: z.coerce.number().int().positive().default(3000),
});

export const env = EnvSchema.parse(process.env);

// Usage anywhere in the app:
// import { env } from '@/env';
// console.log(env.DATABASE_URL); // fully typed, guaranteed valid
```

### With ts-to-zod (CI Schema Parity)

Use `ts-to-zod` in CI to verify that hand-written TypeScript interfaces (if any exist in legacy code) stay in sync with their Zod counterparts. See `quality/ci-pipeline.md` Gate 8 for the schema parity checking workflow.

---

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| Circular schema reference | Schema A references Schema B which references A | Use `z.lazy()` for self-referential or circular schemas: `const TreeSchema: z.ZodType<Tree> = z.object({ children: z.lazy(() => TreeSchema).array() })` |
| `.transform()` breaks type inference | Transform output type differs from input | Explicitly type the transform: `z.string().transform((s): Date => new Date(s))` |
| `.safeParse()` vs `.parse()` confusion | Unclear when to use which | `.parse()` throws on invalid input (internal boundaries). `.safeParse()` returns `{ success, data/error }` (user-facing input). |
| "Expected string, received object" | Passing object where schema expects string | Check schema matches data shape. Use `z.preprocess()` for data normalization before validation. |
| `z.infer` produces `any` | Missing or incorrect generic parameter | Ensure `typeof` prefix: `z.infer<typeof MySchema>`, not `z.infer<MySchema>`. |
| Schema not validating at runtime | Using type assertion instead of `.parse()` | Replace `data as User` with `UserSchema.parse(data)`. Type assertions bypass runtime validation entirely. |

---

## Cross-References

- **CLAUDE.md Section 3** — TypeScript: "Zod schemas are the source of truth. TypeScript types are inferred from Zod — never the reverse."
- **modules/trpc-v11.md** — Rule 7: All tRPC procedure inputs validated with Zod.
- **modules/drizzle-orm.md** — Repository pattern, type inference with `InferSelectModel`.
- **modules/typescript-strict.md** — Strict mode baseline that Zod schemas complement.
- **quality/ci-pipeline.md** — Gate 8: Schema validation with ts-to-zod parity check.
