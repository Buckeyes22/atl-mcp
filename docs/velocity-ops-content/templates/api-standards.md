# API Standards

Status: [Draft | Active]
Last updated: YYYY-MM-DD

This document defines standards for API design, including internal (type-safe RPC) and external
(REST + OpenAPI) APIs. All API decisions should be recorded as ADRs when they affect architecture.

---

## 1. API Posture

| API Type | Protocol | Use Case |
|----------|----------|----------|
| Internal (web ↔ backend) | tRPC / type-safe RPC | Full type safety between frontend and backend |
| External / Public | REST + OpenAPI 3.1 | Third-party integrations, partner APIs |

---

## 2. Versioning and Deprecation

- **Strategy:** URL path versioning (`/api/v1/...`) for external APIs.
- **Deprecation window:** Minimum 6 months notice before removing a version.
- **Sunset header:** Emit `Sunset: <date>` HTTP header on deprecated versions.
- **Changelog:** Maintain a public API changelog for external consumers.

---

## 3. Authentication

- **Standard:** OAuth 2.1 (or current best practice)
  - PKCE required for all clients
  - Exact redirect URI matching (no wildcards)
  - Short-lived access tokens (15–60 minutes)
  - Refresh token rotation on use
  - Never send bearer tokens in URLs or query strings
- **Internal APIs:** Session-based authentication via HttpOnly cookies.
- **API keys:** For server-to-server integrations; rotate quarterly.

---

## 4. Error Format

Use **RFC 9457 Problem Details** for all error responses:

```
Content-Type: application/problem+json
```

```json
{
  "type": "https://api.example.com/errors/not-found",
  "title": "Resource Not Found",
  "status": 404,
  "detail": "Event with ID evt_123 was not found.",
  "instance": "/api/v1/events/evt_123"
}
```

### Error Code Mapping

| Code | HTTP Status | When to Use |
|------|-------------|-------------|
| `BAD_REQUEST` | 400 | Invalid input that passed schema validation but fails business rules |
| `UNAUTHORIZED` | 401 | No valid session or token |
| `FORBIDDEN` | 403 | Authenticated but insufficient permissions |
| `NOT_FOUND` | 404 | Resource doesn't exist or not accessible to current tenant |
| `CONFLICT` | 409 | Duplicate resource, concurrent edit conflict |
| `PRECONDITION_FAILED` | 412 | Business rule violation (capacity full, registration closed) |
| `TOO_MANY_REQUESTS` | 429 | Rate limit exceeded |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected errors (DB failures, external service errors) |

### Error Rules

1. **Never expose internal details.** No stack traces, SQL errors, or internal paths.
2. **Tenant isolation in errors.** Return `NOT_FOUND` (not `FORBIDDEN`) for cross-tenant resources.
3. **Schema validation errors** are automatically mapped to `BAD_REQUEST` with field-level details.
4. **External service errors** are wrapped in `INTERNAL_SERVER_ERROR`; log originals server-side.
5. **Idempotent error handling.** Mutations that already completed should return success, not conflict.

---

## 5. Pagination

- **Prefer cursor-based pagination** for stability and performance.
- **Parameters:** `cursor` (opaque string), `limit` (default 20, max 100).
- **Response shape:**
  ```json
  {
    "data": [...],
    "nextCursor": "eyJpZCI6MTIzfQ==",
    "hasMore": true
  }
  ```
- **Offset pagination** is acceptable for admin/reporting endpoints only.

---

## 6. Rate Limiting

### Tier Structure (Example)

| Tier | Limit | Use Case |
|------|-------|----------|
| Anonymous | 100 req/hour | Public browsing |
| Authenticated | 1,000 req/hour | Standard users |
| Pro/Partner | 10,000 req/hour | API partners |
| Enterprise | 100,000+ req/hour | Custom agreement |

### Headers

Use IETF draft rate-limit headers:
- `RateLimit-Policy` — advertises quota policy and window
- `RateLimit` — current status (remaining quota and reset timing)
- `Retry-After` — included on 429 responses

---

## 7. Webhooks (Outbound)

### Event Types

Define event types using `resource.action` naming:

```
resource.created
resource.updated
resource.deleted
```

### Delivery

- **Signature:** HMAC-SHA256 (include timestamp in signed payload to prevent replay)
- **Retry schedule:** Exponential backoff — immediate → 5s → 25s → 125s → 625s
- **Dead letter queue:** After 24–48 hours of failures
- **Idempotency:** Receivers must handle duplicate deliveries safely

### Webhook Payload Shape

```json
{
  "id": "evt_abc123",
  "type": "resource.created",
  "created": "2026-01-15T10:30:00Z",
  "data": { ... }
}
```

---

## 8. Input Validation

- **All API inputs validated with Zod** (or equivalent runtime schema validation).
- **Zod schemas are the source of truth.** TypeScript types are inferred from schemas.
- **Validate at the boundary:** Every endpoint validates input before processing.
- **Sanitize user content:** Strip or escape HTML in user-provided strings.

---

## 9. OpenAPI Contract (External APIs)

- **Location:** `docs/api/openapi.yaml` is the external source of truth.
- **Requirements for any API change:**
  - Updated OpenAPI spec
  - Contract tests where feasible
  - Backward compatibility note or version bump
- **Generation:** Consider generating server stubs or client SDKs from the spec.

---

## 10. Client-Side Error Handling Pattern

```typescript
// Example: tRPC error handling in React
const mutation = trpc.resource.create.useMutation({
  onError: (error) => {
    if (error.data?.code === "PRECONDITION_FAILED") {
      toast.error(error.message); // Business rule message
    } else if (error.data?.code === "UNAUTHORIZED") {
      router.push("/sign-in");
    } else {
      toast.error("Something went wrong. Please try again.");
    }
  },
});
```

---

## 11. Logging

| Category | Action | PII Handling |
|----------|--------|-------------|
| Application errors | Log with context (userId, operation) | Never log PII |
| Payment errors | Log to audit trail table + application logs | Mask card data |
| Validation errors | Do not log (expected behavior, high volume) | N/A |
| External service errors | Log full error server-side for debugging | Redact tokens |
