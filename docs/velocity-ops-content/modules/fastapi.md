---
description: "FastAPI-specific patterns: routers, dependency injection, typed responses, and async API boundaries"
globs: ["app/**/*.py", "src/**/*.py", "api/**/*.py", "tests/**/*.py"]
alwaysApply: false
---

# FastAPI — Framework Module

**Targets:** FastAPI, Pydantic, async Python services
**Appended to base CLAUDE.md when FastAPI is in use.**

---

## API Architecture

1. Keep one router per domain and mount routers from the application entrypoint.
2. Route handlers should orchestrate, not contain business logic. Push domain logic into services or domain modules.
3. Treat Pydantic models as the request/response contract boundary.

## Dependencies and Context

4. Use `Depends()` for auth, database sessions, and request-scoped services.
5. Never instantiate infrastructure clients ad hoc inside handlers when a dependency provider should own them.

## Error Handling

6. Return typed error payloads with stable codes.
7. Do not raise bare, inconsistent `HTTPException` payloads across routes. Use a reviewed error contract.

## Async and I/O

8. Keep async boundaries honest. Do not block the event loop with synchronous network or database work inside async handlers.
9. Separate CPU-heavy jobs from request handlers if they will materially affect latency or concurrency.

## Testing

10. Test pure domain logic separately from FastAPI integration tests.
11. Keep integration tests focused on route contracts, dependency wiring, and serialization/error behavior.


## Engine Vertical Integration

When this module is used in a client engagement, check the relevant industry vertical config in `engine/verticals/` for:
- **Compliance signals** that affect technology choices (e.g., HIPAA → encryption at rest, GLBA → audit logging)
- **Pain points** that the technology stack should address
- **Recommended services** that pair with this stack

Cross-reference `engine/verticals/{industry}.md` before making data storage, authentication, and API design decisions for client work.
