---
description: "Production hardening patterns: circuit breakers, structured logging, data loss guards, health checks, graceful degradation, rate limiting"
globs: ["**/*.ts", "**/*.tsx", "**/*.py", "**/*.js"]
alwaysApply: false
---

# Production Hardening — Stack Module

**Targets:** Any production-deployed application
**Appended to base CLAUDE.md for projects that serve real users.**

These patterns go beyond language-specific tooling. They address the operational reality of production systems: services fail, data gets corrupted, and traffic spikes happen. This module defines the minimum patterns every production service should implement.

---

## 1. Circuit Breakers

External service calls (HTTP APIs, databases, message queues) must be wrapped in circuit breaker logic to prevent cascade failures.

**What to implement:**
- Failure threshold before opening the circuit (e.g., 5 failures in 30 seconds)
- Open state: fail fast without calling the service
- Half-open state: allow a single probe request to test recovery
- Retry with exponential backoff for transient failures

**TypeScript libraries:** `cockatiel`, `opossum`
**Python libraries:** `tenacity`, `pybreaker`, `circuitbreaker`

```typescript
// TypeScript with cockatiel
import { CircuitBreakerPolicy, ConsecutiveBreaker, handleAll, retry, wrap } from 'cockatiel';

const circuitBreaker = new CircuitBreakerPolicy(handleAll, {
  halfOpenAfter: 10_000,
  breaker: new ConsecutiveBreaker(5),
});

const retryPolicy = retry(handleAll, { maxAttempts: 3, backoff: { type: 'exponential' } });
const policy = wrap(retryPolicy, circuitBreaker);

const result = await policy.execute(() => fetch(externalApi));
```

```python
# Python with tenacity
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type(ConnectionError),
)
def call_external_service() -> dict:
    return httpx.get("https://api.example.com/data").json()
```

---

## 2. Structured Logging

All log output must be structured (JSON) with correlation IDs that propagate across service boundaries.

**What to implement:**
- JSON-formatted log output (not plain text)
- Correlation/request ID attached to every log entry
- Request ID propagated in headers across service calls
- Log levels used correctly: ERROR for failures, WARN for degradation, INFO for business events, DEBUG for troubleshooting

**TypeScript libraries:** `pino`, `winston`
**Python libraries:** `structlog`, `python-json-logger`

```typescript
// TypeScript with pino
import pino from 'pino';

const logger = pino({ level: 'info' });

// In middleware — attach request ID
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.log = logger.child({ requestId: req.requestId });
  next();
});
```

```python
# Python with structlog
import structlog
import uuid

structlog.configure(
    processors=[
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
)

logger = structlog.get_logger()

# In middleware — attach request ID
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
    structlog.contextvars.bind_contextvars(request_id=request_id)
    response = await call_next(request)
    response.headers["x-request-id"] = request_id
    return response
```

---

## 3. Data Loss Guards

Destructive operations must have safety mechanisms to prevent accidental data loss.

**What to implement:**
- Soft deletes: set `deleted_at` / `is_deleted` instead of `DELETE FROM`
- Backup-before-destructive: archive records before bulk operations
- Confirmation patterns: require explicit confirmation for irreversible actions
- Audit trails: log who changed what and when

```python
# Soft delete pattern
class SoftDeleteMixin:
    deleted_at: Mapped[datetime | None] = mapped_column(default=None)
    is_deleted: Mapped[bool] = mapped_column(default=False)

    def soft_delete(self) -> None:
        self.is_deleted = True
        self.deleted_at = datetime.now(UTC)
```

```typescript
// Audit trail pattern
interface AuditEntry {
  entity: string;
  entityId: string;
  action: 'create' | 'update' | 'delete';
  changes: Record<string, { from: unknown; to: unknown }>;
  userId: string;
  timestamp: Date;
}
```

---

## 4. Health Checks

Every service must expose health check endpoints for load balancers and orchestrators.

**What to implement:**
- `/health` or `/healthz` — basic liveness (returns 200 if process is running)
- `/ready` — readiness check (returns 200 only if dependencies are reachable: database, cache, external APIs)
- Dependency health: check each critical dependency individually and report status

```python
# FastAPI health checks
@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}

@app.get("/ready")
async def ready(db: AsyncSession = Depends(get_db)) -> dict:
    checks = {}
    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "error"
    all_ok = all(v == "ok" for v in checks.values())
    if not all_ok:
        raise HTTPException(status_code=503, detail=checks)
    return {"status": "ready", "checks": checks}
```

---

## 5. Graceful Degradation

When dependencies fail, the system should degrade gracefully rather than crash entirely.

**What to implement:**
- Fallback behaviors for non-critical features (cached data, default values)
- Feature flags to disable problematic features without deployment
- Timeout handling with sensible defaults for all external calls

```typescript
// Fallback pattern
async function getUserPreferences(userId: string): Promise<Preferences> {
  try {
    return await preferencesService.get(userId);
  } catch {
    logger.warn({ userId }, 'Preferences service unavailable, using defaults');
    return DEFAULT_PREFERENCES;
  }
}
```

```python
# Timeout pattern
import httpx

async def fetch_recommendations(user_id: str) -> list[str]:
    try:
        response = await httpx.get(
            f"{RECO_SERVICE}/users/{user_id}",
            timeout=httpx.Timeout(5.0),
        )
        return response.json()
    except httpx.TimeoutException:
        logger.warning("Recommendations service timeout", user_id=user_id)
        return []  # Graceful degradation — empty recommendations
```

---

## 6. Rate Limiting and Input Guards

Protect services from abuse and oversized payloads.

**What to implement:**
- Rate limiting middleware on public endpoints
- Request size limits
- Input sanitization beyond schema validation

**TypeScript libraries:** `express-rate-limit`, `@fastify/rate-limit`
**Python libraries:** `slowapi`, `fastapi-limiter`

```python
# Python with slowapi
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.post("/api/submit")
@limiter.limit("10/minute")
async def submit(request: Request, body: SubmitRequest) -> dict:
    ...
```

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Circuit breaker stays open | Threshold too low for normal error rate | Tune threshold based on baseline error rate |
| Logs not correlating | Request ID not propagated in headers | Ensure middleware sets `x-request-id` on all outgoing requests |
| Soft delete queries returning deleted rows | Missing `WHERE is_deleted = false` | Add default query filter or use a base query class |
| Health check passing but service unhealthy | `/health` only checks process, not dependencies | Implement `/ready` with dependency checks |
| Rate limiter blocking legitimate users | Limit too aggressive | Use per-user limits (not per-IP) for authenticated endpoints |
