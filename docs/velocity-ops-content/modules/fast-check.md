---
description: "fast-check property-based testing: arbitraries, properties, CI seed configuration"
globs: ["**/*.property.test.ts", "**/*.prop.test.ts"]
alwaysApply: false
---

# fast-check — Stack Module

**Targets:** TypeScript projects using fast-check for property-based testing.
**Appended to base CLAUDE.md when property-based testing is in use.**

---

## L1 — Install

```bash
pnpm add -D fast-check
```

---

## L2 — Configure

### CI Seed for Reproducibility — `vitest.setup.ts`

```typescript
import fc from 'fast-check';
fc.configureGlobal({ seed: Number(process.env.FAST_CHECK_SEED) || undefined });
```

### File Naming

Property test files use `.property.test.ts` or `.prop.test.ts` suffix. This convention separates property-based tests from standard unit tests and allows CI to run them as a distinct project.

### CI Environment Variable

Set `FAST_CHECK_SEED=42` in `.github/workflows/quality-gates.yml` under Gate 6 (Property-Based Tests):

```yaml
# .github/workflows/quality-gates.yml (Gate 6)
- name: Property-based tests
  env:
    FAST_CHECK_SEED: 42
  run: pnpm vitest run --project property
```

---

## L4 — Conventions

1. **When to use** (from CLAUDE.md Section 4): Functions that process user-supplied input, perform type coercion/parsing, or have invariants that must hold for all valid inputs. If you suspect happy-path tests only cover the cases you thought of, add property tests.

2. Use `fc.assert(fc.property(arbitrary, predicate))` as the primary pattern inside `it` blocks:

```typescript
it('reverses a string twice to get the original', () => {
  fc.assert(fc.property(fc.string(), (s) => {
    expect(reverse(reverse(s))).toBe(s);
  }));
});
```

3. Define custom arbitraries for domain types. Build them from fast-check's built-in arbitraries to match your domain model:

```typescript
const emailArb = fc.emailAddress();
const userArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }),
  email: emailArb,
  age: fc.integer({ min: 0, max: 150 }),
});
```

4. Test invariants, not examples. Good: "parsed output always round-trips back to input." Bad: "parsing 'hello' returns 'hello'." Property tests prove universal truths — example tests belong in unit test files.

5. Keep `numRuns` reasonable: 100 for CI (default), up to 1000 for critical paths. Never set above 10,000 — diminishing returns destroy CI speed with negligible coverage gain.

6. Use `.filter()` sparingly on arbitraries — excessive filtering slows generation because fast-check discards values that do not pass the filter. Prefer constructing valid values directly:

```typescript
// Wrong — filter rejects most values, generation is slow
const positiveEvenArb = fc.integer().filter((n) => n > 0 && n % 2 === 0);

// Correct — construct the valid value directly
const positiveEvenArb = fc.integer({ min: 1 }).map((n) => n * 2);
```

7. When a test fails, fast-check shrinks the counterexample to the minimal failing input. Always include the shrunk value in bug reports — it is the most useful debugging artifact.

8. Seed reproducibility: pass a seed to `fc.assert` to reproduce a specific failure locally:

```typescript
fc.assert(fc.property(myArbitrary, myPredicate), { seed: 12345 });
```

Log the seed in CI output so any failure can be reproduced deterministically.

---

## L5 — Integration

### With Vitest

Property tests run in the same Vitest workspace as unit tests. CI pipeline Gate 6 runs them as a separate Vitest project. Configure the project in `vitest.workspace.ts`:

```typescript
// vitest.workspace.ts
export default [
  'packages/*/vitest.config.ts',
  {
    test: {
      name: 'property',
      include: ['**/*.property.test.ts', '**/*.prop.test.ts'],
      setupFiles: ['./vitest.setup.ts'],
    },
  },
];
```

### With Zod

Test that `schema.parse(generated_input)` never throws for valid arbitraries, and always throws for invalid ones. This validates that your Zod schemas accept exactly the inputs you expect:

```typescript
it('UserSchema accepts all valid users', () => {
  fc.assert(fc.property(validUserArb, (user) => {
    expect(() => UserSchema.parse(user)).not.toThrow();
  }));
});

it('UserSchema rejects users with empty names', () => {
  const invalidUserArb = fc.record({
    name: fc.constant(''),
    email: fc.emailAddress(),
    age: fc.integer({ min: 0, max: 150 }),
  });

  fc.assert(fc.property(invalidUserArb, (user) => {
    expect(() => UserSchema.parse(user)).toThrow();
  }));
});
```

### With CI

Reference `quality/ci-pipeline.md` Gate 6. The `FAST_CHECK_SEED` environment variable ensures reproducibility across CI runs. When a property test fails in CI:

1. Copy the seed from the CI output.
2. Set `FAST_CHECK_SEED` locally to that value.
3. Run the failing test — it reproduces the exact same counterexample.
4. Fix the function, not the test.

---

## L6 — Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| Tests very slow | Too many `numRuns` or expensive predicate | Reduce `numRuns` to 100. Optimize predicate or use simpler arbitraries. |
| "No arbitrary could generate a value" | `.filter()` rejects too many values | Construct valid values directly instead of filtering. See convention 6. |
| Counterexample not reproducible | Seed not set | Add seed to CI config and log seed in test output. See L2 configuration. |
| "Property failed after X tests" | Actual bug found | Read the shrunk counterexample — it is the minimal failing input. Fix the function under test. |
| Type mismatch with arbitrary | Arbitrary generates values outside expected type | Use `fc.record()` with explicit field arbitraries matching your TypeScript interface. |
| Flaky property tests | Non-deterministic predicate (e.g., uses `Date.now()`, `Math.random()`) | Remove side effects from predicates. Mock time/randomness or pass them as parameters. |

---

## Cross-References

- **CLAUDE.md Section 4** — Property-Based Testing Trigger (defines when to use fast-check)
- **modules/vitest.md** — Test runner configuration and workspace setup
- **quality/ci-pipeline.md** — Gate 6: Property-based test execution in CI
- **quality/stryker-config.md** — Mutation testing thresholds for property-tested code
