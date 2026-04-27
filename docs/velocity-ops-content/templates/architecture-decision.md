# ADR-[NNN]: [Short Decision Title]

<!-- ADR number: Sequential, zero-padded. Example: ADR-005 -->
<!-- Title: Noun phrase naming the decision, not the problem. Example: "Error Response Contract for API Endpoints"
     NOT "How should we handle API errors?" — that's a question, not a decision. -->

**Date:** <!-- YYYY-MM-DD — date the decision was made, not when the doc was drafted -->
**Status:** <!-- proposed | accepted | deprecated | superseded-by:ADR-NNN -->
**Deciders:** <!-- Who was in the room / who approved. Example: "Lead Engineer, PM, Security Lead" -->
**Consulted:** <!-- Who provided input but did not decide. Example: "Frontend team, DevOps" -->
**Informed:** <!-- Who was notified after the decision. Example: "All engineers" -->

> **Status definitions:**
> - **proposed** — Under discussion, not yet binding.
> - **accepted** — Binding. Agents and developers must follow this decision.
> - **deprecated** — Was accepted, now discouraged. New code should not follow this pattern, but existing code is not required to migrate immediately.
> - **superseded-by:ADR-NNN** — Replaced by a newer decision. Link the superseding ADR.

---

## Context

<!-- What is the situation? What forces (technical, organizational, product) are at play?
     Describe the world BEFORE the decision — what problem or need drives it?
     Write this as if explaining to someone who was not present.
     Include: current state, the tension or constraint that makes a decision necessary,
     any relevant prior decisions this builds on or reacts to.

     Example:
     "Our API currently returns errors in three inconsistent formats: some endpoints return
     `{ message: string }`, others return `{ error: string, code: number }`, and some return
     plain HTTP status codes with no body. This has caused frontend bugs (#42, #67) and makes
     it impossible to write a generic error handler. As we add more endpoints, the inconsistency
     will compound. We need a single error shape before the mobile app ships (2026-Q2), because
     changing the contract after mobile release requires a versioned API." -->

[Describe the situation that necessitates this decision. What's the problem or opportunity?
Include relevant constraints: timeline, team capability, existing code, external dependencies.]

**Forces at play:**
- [Force 1: e.g., "Frontend needs a predictable error shape to implement a generic error boundary"]
- [Force 2: e.g., "We have 3 existing error formats we cannot change overnight"]
- [Force 3: e.g., "Mobile app ships in 6 weeks — contract must be stable before then"]

---

## Decision

<!-- State the decision plainly. One or two sentences. Then elaborate.
     Start with: "We will [verb]..." or "The [system] MUST [verb]..."
     This should be immediately actionable — an agent reading only this section
     knows exactly what to implement.

     Example:
     "We will adopt a single error response envelope: `{ error: { code: string, message: string, details?: unknown } }`
     for all API endpoints. HTTP status codes remain meaningful. The `code` field is a stable string
     constant (SCREAMING_SNAKE_CASE) that clients can switch on. The `message` field is human-readable
     and may change; clients MUST NOT switch on `message`." -->

**Decision statement:** [We will / The system MUST / We are adopting...]

### Implementation Contract

<!-- The precise specification agents must implement. Use code blocks for schemas, types, examples.
     Be specific enough that two different agents independently produce compatible implementations. -->

```typescript
// Example: Error response contract
interface ApiErrorResponse {
  error: {
    code: string;        // Stable SCREAMING_SNAKE_CASE constant. Clients switch on this.
    message: string;     // Human-readable. May change between releases. Do not switch on.
    details?: unknown;   // Optional structured context (field errors, etc.)
  };
}

// HTTP status codes map to error categories:
// 400 Bad Request      → validation errors, malformed input
// 401 Unauthorized     → missing or invalid authentication
// 403 Forbidden        → authenticated but not authorized
// 404 Not Found        → resource does not exist
// 409 Conflict         → state conflict (duplicate, version mismatch)
// 422 Unprocessable    → semantically invalid (valid JSON, wrong business logic)
// 500 Internal         → unexpected server error (do not expose internals)
```

**Canonical example:**
```json
// POST /api/auth/register — duplicate email
// HTTP 409
{
  "error": {
    "code": "EMAIL_IN_USE",
    "message": "An account with this email address already exists.",
    "details": null
  }
}
```

---

## Alternatives Considered

<!-- For each alternative: name it, describe it briefly, list pros, list cons, explain why it was rejected.
     Having this documented prevents relitigating the decision later. -->

### Alternative 1: [Name]
<!-- Example: "Keep existing ad-hoc error formats" -->

**Description:** [What this alternative involves.]

**Pros:**
- [Pro 1: e.g., "Zero migration cost — no existing code changes needed"]
- [Pro 2]

**Cons:**
- [Con 1: e.g., "Frontend continues to have 3 code paths for error handling"]
- [Con 2]

**Why rejected:** [Specific reason this was not chosen over the accepted decision.]

---

### Alternative 2: [Name]
<!-- Example: "RFC 7807 Problem Details (application/problem+json)" -->

**Description:** [What this alternative involves.]

**Pros:**
- [Pro 1: e.g., "IETF standard — well-understood by API consumers"]
- [Pro 2]

**Cons:**
- [Con 1: e.g., "Verbose — adds `type`, `title`, `status`, `instance` fields we would always leave null"]
- [Con 2]

**Why rejected:** [Specific reason this was not chosen.]

---

### Alternative 3: [Name] (optional)

**Description:** [What this alternative involves.]

**Pros:**
- [Pro 1]

**Cons:**
- [Con 1]

**Why rejected:** [Specific reason.]

---

## Consequences

### Positive
<!-- What becomes easier, safer, or more consistent as a result of this decision? -->

- [Positive consequence 1: e.g., "Frontend engineers can implement a single error boundary component"]
- [Positive consequence 2: e.g., "API errors are now machine-readable; clients can auto-retry on specific codes"]
- [Positive consequence 3]

### Negative
<!-- What becomes harder, more expensive, or constrained? Be honest — hiding negatives
     causes downstream problems when the constraints surface unexpectedly. -->

- [Negative consequence 1: e.g., "All 14 existing endpoints must be updated to use the new envelope"]
- [Negative consequence 2: e.g., "Client libraries that parse the old format will break on upgrade"]
- [Negative consequence 3]

### Neutral / Trade-offs
<!-- Consequences that are neither clearly good nor bad — context-dependent. -->

- [Neutral consequence 1: e.g., "Error responses are now larger (extra wrapping object) — negligible for our volumes"]
- [Neutral consequence 2]

---

## Implementation Notes

<!-- Guidance for agents and engineers implementing this decision.
     Include: migration path for existing code, code patterns to use/avoid,
     gotchas discovered during proof-of-concept, links to reference implementations. -->

### Migration Path
<!-- How to migrate existing code that conflicts with this decision.
     Example: "Update endpoints in order: auth → user → content → billing.
     Each PR should update one domain area and include a CHANGELOG entry." -->

[Step-by-step migration plan, if applicable.]

### Code Patterns

**Do this:**
```typescript
// Example of correct implementation
```

**Not this:**
```typescript
// Example of the old pattern or anti-pattern to avoid
```

### Related Specs
<!-- Link the specs that implement this decision. -->

- [SPEC-{DOMAIN}-{FEAT}-{NN}: Title]
- [SPEC-{DOMAIN}-{FEAT}-{NN}: Title]

### Testing This Decision
<!-- How to verify an implementation follows this ADR.
     Example: "Semgrep rule `enforce-error-envelope.yml` will catch non-conforming responses.
     Integration test `api/error-contract.test.ts` validates all endpoints return the correct shape." -->

[How to mechanically verify compliance — semgrep rules, test files, CI checks.]

---

## Review Date

<!-- When should this decision be re-evaluated?
     Example: "Re-evaluate if we adopt GraphQL (error handling is built into the spec)
     or when we version the API (v2 could adopt RFC 7807)." -->

**Review by:** <!-- YYYY-MM-DD or event trigger, e.g., "Before API v2 design begins" -->
**Review condition:** [What would prompt earlier review — technology change, team growth, performance issue, etc.]

---

## References

<!-- Links to research, prior art, standards, or conversations that informed this decision. -->

- <!-- [RFC 7807: Problem Details for HTTP APIs](https://datatracker.ietf.org/doc/html/rfc7807) -->
- <!-- GitHub issue #67: "Frontend error handling is fragile" -->
- <!-- ADR-002: API versioning strategy (provides context for migration path) -->
- <!-- [Reference doc]: ai-agent-project-framework-example.md, Section: Error Response Contract -->
