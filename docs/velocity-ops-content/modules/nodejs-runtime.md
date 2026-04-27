---
description: "Standalone Node.js service patterns: process lifecycle, typed boundaries, config, and testable modules"
globs: ["src/**/*.ts", "src/**/*.js", "server/**/*.ts", "server/**/*.js", "scripts/**/*.ts", "scripts/**/*.js", "package.json"]
alwaysApply: false
---

# Node.js Runtime — Stack Module

**Targets:** Node.js 20+, TypeScript 5.x or modern ESM/CommonJS services
**Appended to base CLAUDE.md when a standalone Node.js runtime is in use outside framework-specific presets like Next.js.**

---

## Runtime Boundaries

1. Treat the Node process as an application boundary, not a dumping ground for script logic. Keep startup, config loading, transport wiring, and domain logic separate.
2. Isolate framework or transport adapters from domain logic. HTTP handlers, queue consumers, cron jobs, and CLI entrypoints should call typed services rather than own business behavior directly.
3. Keep long-lived resources explicit: database pools, broker clients, schedulers, and caches should be initialized once and closed cleanly on shutdown.

## Configuration and Safety

4. Validate runtime configuration at startup before the service accepts traffic or processes jobs.
5. Do not read unchecked `process.env` throughout the codebase. Centralize environment parsing and export typed configuration.
6. Prefer deterministic, observable startup failure over partial runtime boot with missing configuration.

## Async and Error Handling

7. Await top-level async work through explicit bootstrap functions. Do not hide startup failures in unhandled promises.
8. Convert infrastructure errors into stable application errors at the boundary. Do not leak raw driver, SDK, or broker payloads through the service contract.
9. Treat retries, idempotency, and backpressure as first-class concerns for workers, consumers, and scheduled jobs.

## Module Design

10. Keep modules small enough to test without booting the whole process.
11. Separate pure transformation logic from side-effectful I/O so unit tests can cover the core behavior without mocks everywhere.
12. Prefer dependency injection through typed constructor parameters or factory functions over module-level singleton mutation.

## Delivery and Testing

13. Define one clear entrypoint per deployable process.
14. Test domain logic separately from process/bootstrap behavior. Integration tests should focus on boundary contracts, startup/shutdown behavior, and adapter wiring.
15. If the repo is plain Node.js today but may later add a framework-specific surface, keep shared domain packages runtime-agnostic so they can be reused cleanly.
