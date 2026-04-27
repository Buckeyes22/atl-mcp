---
description: "Vitest test runner: workspace projects, coverage, path aliases, test patterns"
globs: ["vitest.config.*", "vitest.workspace.*", "**/*.test.ts", "**/*.spec.ts"]
alwaysApply: false
---

# Vitest — Stack Module

**Targets:** TypeScript projects using Vitest as the test runner.
**Appended to base CLAUDE.md when Vitest is in use.**

---

## 0. Setup

### Prerequisites

- Node.js 20+
- pnpm 9+
- TypeScript 5.x with `strict: true`

### Install

```bash
pnpm add -D vitest @vitest/coverage-v8
```

For path alias resolution (matches `tsconfig.json` paths automatically):

```bash
pnpm add -D vite-tsconfig-paths
```

### Configure — `vitest.config.ts`

Place this file at the project root (same level as `package.json`):

```typescript
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      enabled: true,
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

### Workspace Configuration

For projects with separate test suites (unit, integration, property), use a workspace file:

```typescript
// vitest.workspace.ts
export default ['vitest.config.ts', 'vitest.integration.config.ts'];
```

Example integration config:

```typescript
// vitest.integration.config.ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.test.ts', 'tests/integration/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
```

### Package Scripts — `package.json`

```json
{
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run --config vitest.config.ts",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest"
  }
}
```

### Verify Installation

```bash
pnpm vitest run          # All tests pass
pnpm vitest --coverage   # Coverage report generated
```

Expected: Tests execute without import errors, coverage report prints to terminal and generates an HTML report in `coverage/`.

---

## Test File Conventions

1. **Test file naming:** `*.test.ts` co-located with source. Place the test file next to the module it tests (e.g., `src/lib/utils.ts` has `src/lib/utils.test.ts`).

2. **`describe` blocks** group related tests by function or feature. Nest `describe` blocks for sub-behaviors:

```typescript
describe('calculateTotal', () => {
  describe('with valid items', () => {
    it('sums item prices correctly', () => {
      const result = calculateTotal([{ price: 10 }, { price: 20 }]);
      expect(result).toBe(30);
    });
  });

  describe('with empty input', () => {
    it('returns zero', () => {
      expect(calculateTotal([])).toBe(0);
    });
  });
});
```

3. **`it`/`test` blocks** describe specific behavior in plain English. The test name should read as a sentence: `it('returns the user when found')`, not `it('test1')`.

4. **`beforeEach`/`afterEach`** for setup and teardown. Avoid `beforeAll`/`afterAll` — they share state across tests and compromise test isolation:

```typescript
// Correct — each test gets fresh state
let service: UserService;

beforeEach(() => {
  service = new UserService(createTestDb());
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Avoid — shared state leaks between tests
beforeAll(() => {
  service = new UserService(createTestDb()); // same instance for all tests
});
```

5. **Mock boundaries:** Only mock external services (third-party APIs, system clock, filesystem, network). Never mock the function under test, internal modules, or the database layer in integration tests. See CLAUDE.md Section 4.

6. **Snapshot testing:** Use sparingly, only for serializable output (JSON responses, rendered markup). Do not snapshot implementation details like internal state objects or class instances.

7. **Inline snapshots** (`toMatchInlineSnapshot`) are preferred over file snapshots for small values. They keep the expected value visible in the test file:

```typescript
it('formats the error response', () => {
  const response = formatError('Not found', 404);
  expect(response).toMatchInlineSnapshot(`
    {
      "error": "Not found",
      "status": 404,
    }
  `);
});
```

8. **No test-only utility functions defined outside test files.** Shared test helpers go in `tests/helpers/` or `__tests__/helpers/`. Do not scatter helper functions across unrelated modules.

9. **Every test must have at least one assertion.** Empty `it()` blocks are forbidden. A test without an assertion proves nothing:

```typescript
// Wrong — no assertion
it('creates a user', async () => {
  await createUser({ name: 'Alice' });
});

// Correct — asserts the result
it('creates a user and returns the record', async () => {
  const user = await createUser({ name: 'Alice' });
  expect(user.name).toBe('Alice');
  expect(user.id).toBeDefined();
});
```

10. **Use `vi.fn()` for function spies and `vi.mock()` for module mocks.** Avoid manual mock implementations that bypass Vitest's tracking:

```typescript
// Function spy
const onSubmit = vi.fn();
form.submit(onSubmit);
expect(onSubmit).toHaveBeenCalledOnce();

// Module mock
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));
```

---

## Integration Patterns

### With Stryker (Mutation Testing)

Use `@stryker-mutator/vitest-runner` in `stryker.conf.mjs` to run mutation tests through Vitest:

```javascript
// stryker.conf.mjs
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  vitest: {
    configFile: 'vitest.config.ts',
  },
  mutate: ['src/**/*.ts', '!src/**/*.test.ts', '!src/**/*.spec.ts'],
};
```

Reference `quality/stryker-config.md` for threshold configuration and CI integration.

### With fast-check (Property-Based Testing)

Use `fc.assert(fc.property(...))` inside `it` blocks. Property-based tests live alongside unit tests:

```typescript
import * as fc from 'fast-check';

describe('parseEmail', () => {
  it('never throws on arbitrary string input', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        // Should return a result, never throw
        const result = parseEmail(input);
        expect(result).toHaveProperty('success');
      })
    );
  });

  it('round-trips valid emails', () => {
    fc.assert(
      fc.property(fc.emailAddress(), (email) => {
        const parsed = parseEmail(email);
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data).toBe(email.toLowerCase());
        }
      })
    );
  });
});
```

Reference `modules/fast-check.md` for arbitraries and shrinking strategies.

### With tRPC (Procedure Testing)

Use `createCallerFactory` to test tRPC procedures without HTTP. This tests the procedure logic directly:

```typescript
import { appRouter } from '@/server/trpc/routers';
import { createCallerFactory } from '@/server/trpc/trpc';

const createCaller = createCallerFactory(appRouter);

describe('user.getById', () => {
  it('returns the user for a valid ID', async () => {
    const caller = createCaller({ db: testDb, user: testUser });
    const result = await caller.user.getById({ id: '123' });

    expect(result).toEqual(
      expect.objectContaining({
        id: '123',
        name: 'Test User',
      })
    );
  });

  it('throws NOT_FOUND for a missing user', async () => {
    const caller = createCaller({ db: testDb, user: testUser });

    await expect(
      caller.user.getById({ id: 'nonexistent' })
    ).rejects.toThrow('NOT_FOUND');
  });
});
```

### With CI Pipeline

Vitest runs at three gates in the CI pipeline:

- **Gate 4 (Unit Tests):** `pnpm test:unit` — runs all `*.test.ts` files via `vitest.config.ts`
- **Gate 5 (Integration Tests):** `pnpm test:integration` — runs all `*.integration.test.ts` files via `vitest.integration.config.ts`
- **Gate 6 (Property Tests):** `pnpm test:property` — runs property-based test files (fast-check)

Reference `quality/ci-pipeline.md` for gate ordering and failure behavior.

---

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| "Cannot find module '@/...'" | Path aliases not resolved | Add `vite-tsconfig-paths` plugin to `vitest.config.ts` |
| "SyntaxError: Cannot use import statement" | ESM/CJS interop issue | Set `"type": "module"` in `package.json` or add `transformMode` config |
| Test state leaking between files | Shared module-level state | Use `beforeEach` to reset state, or enable `isolate: true` |
| Coverage report shows 0% | Coverage not configured | Add `@vitest/coverage-v8` and set `coverage.enabled: true` |
| "ReferenceError: describe is not defined" | Globals not enabled | Add `globals: true` to `vitest.config.ts` or import from `vitest` |
| Tests hang on async operations | Missing `await` or unresolved promises | Ensure all async test bodies use `await`, set `testTimeout` for slow tests |
| "Vitest was initialised with... but... was used" | Config mismatch in workspace | Ensure each workspace config uses its own `include` pattern without overlap |

---

## Cross-References

- **CLAUDE.md Section 4** — Testing Requirements (TDD flow, coverage expectations, mock boundaries)
- **modules/fast-check.md** — Property-based testing with fast-check arbitraries
- **quality/stryker-config.md** — Mutation testing thresholds and Vitest runner configuration
- **quality/ci-pipeline.md** — CI gate ordering (unit, integration, property test gates)
- **quality/test-quality-analysis.md** — Static analysis of test quality (assertion strength, empty tests)
