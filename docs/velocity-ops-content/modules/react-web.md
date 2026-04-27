---
description: "React web app patterns: component boundaries, state ownership, effects, and testable UI composition"
globs: ["src/**/*.tsx", "src/**/*.ts", "app/**/*.tsx", "components/**/*.tsx"]
alwaysApply: false
---

# React Web — Stack Module

**Targets:** React 18/19, TypeScript 5.x
**Appended to base CLAUDE.md when React is the primary UI layer outside the Next.js-specific module.**

---

## Component Boundaries

1. Prefer functional components and hooks. Do not introduce class components.
2. Keep components focused on one responsibility:
   - presentational rendering
   - data loading/orchestration
   - interaction state
3. Push business logic and data transformation out of JSX-heavy components into typed helpers or hooks.

## State and Effects

4. Keep state as local as possible. Promote state upward only when multiple children truly share ownership.
5. Effects should synchronize with external systems, not compensate for poor data flow design.
6. Avoid derived-state duplication. If a value can be computed from props/state, compute it instead of storing a second copy.

## Forms and Interactions

7. Validate inputs at boundaries and keep form state explicit.
8. Make loading, error, empty, and success states visible in component structure.

## Performance and Testing

9. Do not add memoization by reflex. First keep render boundaries clean and props stable.
10. Test component behavior, not implementation details. Prefer user-visible outcomes over internals.
11. Isolate expensive rendering logic and keep chart/map/table adapters thin enough to unit-test separately.
