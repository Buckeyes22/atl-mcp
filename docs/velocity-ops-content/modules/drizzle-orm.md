---
description: "Drizzle ORM patterns: schema definition, queries, migrations, repository layer"
globs: ["src/server/db/**/*.ts", "drizzle.config.*", "migrations/**/*.ts", "src/server/repositories/**/*.ts"]
alwaysApply: false
---

# Drizzle ORM — Stack Module

**Targets:** Drizzle ORM 0.36+, drizzle-kit 0.28+, TypeScript 5.x
**Supported drivers:** Neon serverless (PostgreSQL), PlanetScale/MySQL, Turso/SQLite, node-postgres
**Appended to base CLAUDE.md when Drizzle ORM is in use.**

---

## 0. Setup

### Prerequisites

- **Node.js** 20+
- **pnpm** 9+
- **Database access:** Neon (serverless PostgreSQL), Turso (edge SQLite), or local PostgreSQL

### Install per Driver

```bash
# PostgreSQL (Neon serverless) — recommended for Vercel/edge
pnpm add drizzle-orm @neondatabase/serverless
pnpm add -D drizzle-kit

# PostgreSQL (node-postgres) — for traditional Node.js servers
pnpm add drizzle-orm pg
pnpm add -D drizzle-kit @types/pg

# SQLite (Turso/libSQL) — for edge-first or embedded
pnpm add drizzle-orm @libsql/client
pnpm add -D drizzle-kit
```

### Drizzle Kit Configuration — `drizzle.config.ts`

Place this file at the project root (same level as `package.json`). Example for Neon/PostgreSQL:

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './db/schema/index.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

For other drivers, change `dialect` and `dbCredentials` accordingly:
- **node-postgres:** `dialect: 'postgresql'`, same `dbCredentials` shape.
- **Turso/libSQL:** `dialect: 'sqlite'`, `dbCredentials: { url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN }`.

### Database Client Singleton — `db/index.ts`

Create the database client once and export it as a singleton. Neon serverless example:

```typescript
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

For node-postgres:

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
```

### First Migration Workflow

```bash
# 1. Create your first schema file (db/schema/users.ts)
# 2. Generate migration SQL
pnpm drizzle-kit generate
# 3. Apply migration
pnpm drizzle-kit migrate
```

### Verify Installation

```bash
pnpm drizzle-kit studio
```

Expected: Browser opens Drizzle Studio at `https://local.drizzle.studio`. Tables visible and queryable.

---

## File Structure Conventions

1. Place all schema definitions in `db/schema/` as separate files per domain entity (e.g., `db/schema/users.ts`, `db/schema/posts.ts`). Re-export everything from `db/schema/index.ts`.
2. Place the database client singleton in `db/index.ts` (or `lib/db.ts`). Export it as `db`. Never instantiate the database client inside individual query functions.
3. Place all Drizzle migrations in `db/migrations/`. Do not manually edit migration files — always generate them with `drizzle-kit generate`.
4. Place repository functions (query abstractions) in `db/repositories/` or `lib/repositories/`. Never write raw Drizzle queries inline in route handlers or Server Actions.
5. Store `drizzle.config.ts` at the project root (same level as `package.json`).

## Schema Definitions

6. Define tables using the dialect-appropriate table function. Import column types from the matching dialect package:

```typescript
// PostgreSQL (Neon)
import { pgTable, text, integer, timestamp, boolean, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// SQLite (Turso/libSQL)
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// MySQL (PlanetScale)
import { mysqlTable, varchar, int, datetime } from 'drizzle-orm/mysql-core';
```

7. Always define relations using `relations()` from `drizzle-orm` when tables reference each other. Relations enable `with` in queries:

```typescript
import { relations } from 'drizzle-orm';

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));
```

8. Export TypeScript types derived from the schema. Use `InferSelectModel` and `InferInsertModel`:

```typescript
export type User = typeof users.$inferSelect;      // SELECT result type
export type NewUser = typeof users.$inferInsert;    // INSERT input type
```

## CRUD Query Patterns

9. Use the type-safe query builder (`db.query.*`) for relational queries with `with`. Use the fluent API (`db.select().from()`) for joins and complex filters:

```typescript
// Type-safe relational query (requires relations defined)
const userWithPosts = await db.query.users.findFirst({
  where: eq(users.id, userId),
  with: { posts: true },
});

// Fluent API for custom joins
const result = await db
  .select({ id: users.id, name: users.name, postCount: sql<number>`count(${posts.id})` })
  .from(users)
  .leftJoin(posts, eq(posts.authorId, users.id))
  .where(eq(users.id, userId))
  .groupBy(users.id);
```

10. For inserts, always use `.returning()` to get back the inserted row instead of running a separate query:

```typescript
const [newUser] = await db
  .insert(users)
  .values({ email, name })
  .returning();
```

11. For updates, always include a `where` clause. Never issue a bare update without a condition — it updates all rows:

```typescript
// Correct — scoped update
const [updated] = await db
  .update(users)
  .set({ name: newName, updatedAt: new Date() })
  .where(eq(users.id, userId))
  .returning();

// Wrong — updates every row in the table
await db.update(users).set({ name: 'default' }); // never do this
```

## Transactions

12. Wrap multi-table write operations in transactions using `db.transaction()`. Throw inside the callback to automatically trigger a rollback:

```typescript
const result = await db.transaction(async (tx) => {
  const [order] = await tx.insert(orders).values(orderData).returning();
  await tx.insert(orderItems).values(
    items.map((item) => ({ ...item, orderId: order.id }))
  );
  await tx
    .update(inventory)
    .set({ quantity: sql`${inventory.quantity} - ${item.quantity}` })
    .where(inArray(inventory.productId, items.map((i) => i.productId)));
  return order;
});
```

## Prepared Statements

13. Use prepared statements for queries that execute repeatedly in hot paths. Prepare once at module load, execute many times:

```typescript
import { placeholder } from 'drizzle-orm';

const getUserById = db
  .select()
  .from(users)
  .where(eq(users.id, placeholder('id')))
  .prepare('get_user_by_id');

// Usage
const user = await getUserById.execute({ id: userId });
```

## Migration Workflow

14. Always generate migrations with drizzle-kit. Never write migration SQL manually unless you have an exceptional reason, and document it:

```bash
pnpm drizzle-kit generate   # generates migration SQL from schema changes
pnpm drizzle-kit migrate    # applies pending migrations to the database
pnpm drizzle-kit studio     # opens Drizzle Studio for database inspection
```

15. Run `pnpm drizzle-kit check` in CI to verify no schema drift exists between the schema files and applied migrations.

## Repository Pattern

16. Encapsulate all database access in repository functions. Repository functions accept plain data, return typed results, and handle errors. Route handlers and Server Actions call repositories — they do not call `db.*` directly:

```typescript
// db/repositories/users.ts
export async function getUserById(id: string): Promise<User | undefined> {
  return db.query.users.findFirst({
    where: eq(users.id, id),
  });
}

export async function createUser(data: NewUser): Promise<User> {
  const [user] = await db.insert(users).values(data).returning();
  if (!user) throw new Error('Failed to create user');
  return user;
}
```

## Common Pitfalls

17. Do not use `drizzle-orm`'s `sql` template tag for user-provided values — use parameterized values instead to prevent SQL injection:

```typescript
// Wrong — SQL injection risk
const name = userInput;
await db.execute(sql`SELECT * FROM users WHERE name = '${name}'`);

// Correct — parameterized
await db.select().from(users).where(eq(users.name, userInput));
```

18. Neon serverless requires `@neondatabase/serverless` with `drizzle-orm/neon-serverless`. Do not use `pg` (node-postgres) with Neon in serverless/edge environments — the WebSocket-based Neon adapter is required for cold-start performance.

19. When testing, use a separate test database or an in-memory SQLite database. Never run tests against the production database. Set up the test DB client in a global test setup file and tear down after each test suite.

20. Do not share the Drizzle `db` instance between different Neon connection strings at runtime. Create the client once with the appropriate connection string and export it as a singleton.

---

## Integration Patterns

### In tRPC Context

Inject the `db` instance into the tRPC context so every procedure has access to it without importing the singleton directly:

```typescript
// server/trpc/context.ts
import { db } from '@/db';

export function createContext() {
  return { db };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
```

Use it in procedures through the context:

```typescript
// server/trpc/routers/users.ts
import { publicProcedure, router } from '../trpc';
import { eq } from 'drizzle-orm';
import { users } from '@/db/schema';
import { z } from 'zod';

export const usersRouter = router({
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.users.findFirst({
        where: eq(users.id, input.id),
      });
    }),
});
```

### In Next.js Server Actions

Call repository functions from `'use server'` files. Do not import `db` directly into Server Actions — use the repository layer:

```typescript
// app/actions/users.ts
'use server';

import { createUser, getUserById } from '@/db/repositories/users';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

export async function createUserAction(formData: FormData) {
  const parsed = CreateUserSchema.parse({
    email: formData.get('email'),
    name: formData.get('name'),
  });

  const user = await createUser(parsed);
  revalidatePath('/users');
  return user;
}
```

### In Astro API Routes

Use the repository layer from Astro API route handlers:

```typescript
// src/pages/api/users/[id].ts
import type { APIRoute } from 'astro';
import { getUserById } from '@/db/repositories/users';

export const GET: APIRoute = async ({ params }) => {
  const user = await getUserById(params.id!);

  if (!user) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(user), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
```

---

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| "Cannot connect to database" | Wrong connection string or SSL config | Verify `DATABASE_URL` format. For Neon: `postgresql://user:pass@host/db?sslmode=require` |
| "relation does not exist" | Migration not applied | Run `pnpm drizzle-kit migrate` |
| Migration drift | Manual DB changes outside Drizzle | Run `pnpm drizzle-kit introspect` to sync, then `pnpm drizzle-kit generate` |
| Neon error in local dev | Using `@neondatabase/serverless` without Neon proxy | Use `pg` for local dev, `@neondatabase/serverless` for production. Or use Neon's local proxy. |
| "Cannot use import statement" | ESM/CJS mismatch in drizzle-kit | Ensure `"type": "module"` in `package.json` or use `.mjs` config extension |
