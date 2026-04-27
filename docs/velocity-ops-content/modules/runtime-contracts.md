---
description: "Runtime contracts and design-by-contract patterns for TypeScript: preconditions, postconditions, and type invariants using invariant() and Zod"
globs: ["src/**/*.ts", "src/**/*.tsx"]
alwaysApply: false
---

# Runtime Contracts — Stack Module

**Targets:** TypeScript projects that need explicit, enforceable behavioral contracts at module boundaries, trust boundaries, and state mutation points.
**Appended to base CLAUDE.md when design-by-contract patterns are in use.**

---

## L1 — Install

### Option A: tiny-invariant (recommended)

```bash
pnpm add tiny-invariant
```

`tiny-invariant` is 200 bytes, tree-shakeable, and strips to a no-op in production builds when configured (see L4 Performance). It throws an `Error` with your message when the condition is false.

```typescript
import invariant from 'tiny-invariant';

invariant(user !== null, 'user must be defined before accessing profile');
```

### Option B: inline helper (zero dependencies)

If you prefer zero runtime dependencies, define a local helper once and import it across the project:

```typescript
// src/lib/invariant.ts
export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Invariant violated: ${message}`);
  }
}
```

This satisfies TypeScript's `asserts` contract — after the call, the type system narrows `condition` to truthy. Use this form when the bundle size budget is already met by other dependencies.

---

## L2 — Configure

### Where to place contracts

Contracts belong at three location types. Do not place them everywhere — targeted placement is the point.

**Module boundaries (exported functions):** Any function that is part of a public API — exported from a module, called across feature boundaries, or consumed by another agent or service — gets preconditions on entry and postconditions before return.

**Trust boundaries (external input):** Any point where data arrives from outside the process — HTTP requests, database query results, message queue payloads, file reads, `localStorage`, `process.env` — gets validated before it enters internal logic. Use Zod at these boundaries (see L5 Integration).

**State mutations (invariants after write):** After any operation that mutates shared or persistent state, assert that the invariant that must hold after the mutation actually holds. This catches partial updates, concurrent mutation races, and ORM quirks before they propagate.

### Where NOT to place contracts

- Pure utility functions with no side effects and full unit test coverage — tests are the contract
- Internal helpers called only from one place — the caller's precondition covers it
- Hot paths in tight loops where the overhead of a failed condition check matters (see L4 Performance)

---

## L4 — Conventions

### 1. Preconditions — assert input constraints at entry

Assert what must be true about inputs before any logic executes. Preconditions protect the function from being called incorrectly.

**External input (trust boundary):** Use `Zod.parse()` or `Zod.safeParse()`. Zod schemas are runtime contracts — they enforce the type and the constraint simultaneously.

```typescript
import { z } from 'zod';

const CreateOrderInputSchema = z.object({
  userId: z.string().uuid(),
  items: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive() })).min(1),
  currency: z.enum(['USD', 'EUR', 'GBP']),
});

export async function createOrder(rawInput: unknown): Promise<Order> {
  // Trust boundary — parse and throw on invalid
  const input = CreateOrderInputSchema.parse(rawInput);
  // input is now fully typed and validated
  // ...
}
```

**Internal input (module boundary):** Use `invariant()` for conditions that represent programming errors — situations that should never happen if callers follow the contract.

```typescript
import invariant from 'tiny-invariant';

export function applyDiscount(order: Order, discountPct: number): Order {
  invariant(discountPct >= 0 && discountPct <= 100, `discountPct must be 0–100, got ${discountPct}`);
  invariant(order.items.length > 0, 'cannot apply discount to empty order');
  // ...
}
```

### 2. Postconditions — assert output constraints before return

Assert what must be true about the return value before returning it. Postconditions catch implementation bugs — cases where the logic produced a value that violates the function's contract.

```typescript
export function computeTax(subtotal: number, rate: number): number {
  const tax = subtotal * rate;
  // Postcondition: tax cannot exceed the subtotal, cannot be negative
  invariant(tax >= 0, `tax must be non-negative, got ${tax}`);
  invariant(tax <= subtotal, `tax ${tax} exceeds subtotal ${subtotal} — rate ${rate} invalid`);
  return tax;
}
```

Postconditions are most valuable when the computation involves multiple branches, external calls, or transformations where intermediate state could silently corrupt the result.

### 3. Type invariants — assert state consistency after mutation

After any operation that mutates state, assert that the structural invariant of that state still holds. This is the "invariant" in design-by-contract's strictest sense.

```typescript
class ShoppingCart {
  private items: CartItem[] = [];
  private total: number = 0;

  addItem(item: CartItem): void {
    this.items.push(item);
    this.total += item.price * item.quantity;

    // State invariant: total must equal sum of all item prices
    const expectedTotal = this.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    invariant(
      Math.abs(this.total - expectedTotal) < 0.001,
      `Cart total ${this.total} is out of sync with items total ${expectedTotal}`
    );
  }
}
```

Run invariant assertions after every mutation, not just after "suspicious" ones. The value is catching the unexpected case.

### 4. When NOT to use contracts

Do not add contracts to:

- **Pure utility functions** (`clamp`, `formatDate`, `slugify`) that are fully covered by unit tests — the test suite is the contract, and adding `invariant()` calls adds noise without protection
- **Internal single-callsite helpers** where the wrapping function already validates inputs — double-checking at every layer creates redundancy that obscures what is actually being enforced
- **Generated code** or ORM-mapped types where the runtime type is already guaranteed by the layer above
- **Conditional branches that already throw** — if the logic already throws a domain error on invalid state, an `invariant()` before it is redundant

### 5. Performance — stripping contracts in production

`tiny-invariant` supports build-time stripping via the `babel-plugin-transform-remove-invariant` plugin or via dead-code elimination when `process.env.NODE_ENV` is `'production'`:

```javascript
// vite.config.ts or next.config.js
define: {
  'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
}
```

When `NODE_ENV` is `production` and tree-shaking is active, the invariant calls and their string messages are eliminated from the bundle entirely.

**Keep contracts on critical paths even in production** — a postcondition on a payment calculation that might silently return a negative amount is worth the microsecond overhead. Strip contracts aggressively from performance-sensitive loops and not from business logic.

---

## L5 — Integration

### With Zod

Zod schemas are the primary mechanism for trust-boundary contracts. The relationship is:

- **Zod:** use at external input boundaries where the caller is untrusted and may provide malformed data. `z.parse()` throws a structured `ZodError`. `z.safeParse()` returns `{ success, data/error }` for user-facing inputs where structured error messages are needed.
- **`invariant()`:** use at internal module boundaries where the caller is trusted code and a violation is a programming error, not user error. `invariant()` throws a plain `Error` with a message.

Do not duplicate Zod constraints with `invariant()` at the same boundary. Parse with Zod at entry; use `invariant()` after parse for conditions Zod cannot express (cross-field state, object graph consistency, post-mutation invariants).

```typescript
// Trust boundary: Zod parses, then invariant enforces a relational constraint Zod cannot express
const input = UpdateOrderSchema.parse(rawInput);
invariant(
  input.shippingDate > input.orderDate,
  `shippingDate must be after orderDate`
);
```

### With error handling

Contracts throw, so they must integrate with your error boundary strategy:

- Precondition failures (`invariant()`) at module boundaries are programmer errors — let them propagate as 500s unless you have a specific handling policy
- Trust-boundary failures (`ZodError`) are input errors — catch and convert to 400-class responses at the HTTP layer
- Do not catch `invariant()` errors to produce user-facing messages — they indicate a bug in the calling code, not a user mistake

```typescript
// API route error boundary
try {
  const result = await createOrder(req.body);
  return res.json(result);
} catch (err) {
  if (err instanceof z.ZodError) {
    return res.status(400).json({ errors: err.flatten().fieldErrors });
  }
  // invariant() and other programming errors bubble as 500
  throw err;
}
```

### With the tester agent

Contracts are property-based testing targets. Every `invariant()` call states a property that must hold — the `agents/tester.md` agent and `quality/guardrails/property-generator.sh` can read contract assertions to generate PBT cases automatically.

When writing a function with explicit contracts, document the invariants in a JSDoc `@invariant` tag so the property generator can extract them:

```typescript
/**
 * @precondition rate >= 0 && rate <= 1
 * @postcondition result >= 0 && result <= subtotal
 * @invariant result + subtotal equals gross input
 */
export function computeTax(subtotal: number, rate: number): number { ... }
```

The `property-generator.sh` script reads these tags and emits `fc.property()` test cases using the domains derived from the constraint expressions. See `quality/guardrails/property-generator.sh` for the extraction format.

---

## Cross-References

- **modules/zod.md** — Full Zod conventions; schemas as runtime contracts at trust boundaries
- **modules/typescript-strict.md** — Strict mode baseline; `asserts` narrowing that `invariant()` enables
- **agents/tester.md** — Property-based test generation from contracts
- **quality/guardrails/property-generator.sh** — Automated PBT case extraction from `@precondition`/`@postcondition` JSDoc tags
