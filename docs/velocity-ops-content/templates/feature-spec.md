# Feature Spec: [FEAT-{DOMAIN}-{NNN}] — [Feature Name]

Title: Feature Spec: [FEAT-{DOMAIN}-{NNN}] — [Feature Name]
Status: [Draft | In Progress | Complete]
Last updated: YYYY-MM-DD
Related docs: [Project brief, requirements catalog, domain spec, architecture docs]

---

## Summary

[One paragraph: what this feature does and why it exists.]

---

## Traceability

- **Brief:** `BRIEF-{PROJECT}`
- **Business intent refs:** `WF-{DOMAIN}-{NN}`, `WF-{DOMAIN}-{NN}`
- **Requirement IDs:** `REQ-{DOMAIN}-{NNN}`, `REQ-{DOMAIN}-{NNN}`
- **Planned implementation specs:** `SPEC-{DOMAIN}-{FEAT}-{NN}` (reuse the numeric portion of `FEAT-{DOMAIN}-{NNN}`, e.g. `FEAT-AUTH-001` -> `SPEC-AUTH-001-01`)
- **Current coverage:** [Planned | Existing | Partial | Unknown]

---

## Scope

**In scope:**
- [Deliverable 1]
- [Deliverable 2]
- [Deliverable 3]

**Out of scope:**
- [Excluded item 1 — covered by FEAT-{DOMAIN}-{NNN}]
- [Excluded item 2 — deferred to future phase]

---

## Users and Roles

**Primary users:**
- [Role — description of how they interact with this feature]

**Secondary users:**
- [Role — description of indirect interaction]

**Permissions required:**
- [Permission/auth requirements for each role]

---

## User Journeys

### Happy Path

1. User navigates to [page/action].
2. System displays [UI element].
3. User performs [action].
4. System validates [input].
5. System processes [operation].
6. User sees [confirmation/result].

### Edge Cases

1. **[Edge case name]:** [Description of what happens and how the system handles it.]
2. **[Edge case name]:** [Description.]
3. **[Edge case name]:** [Description.]

---

## Requirements

Every requirement listed here should already exist in the requirements catalog. Do not invent local-only `FR-1` or `NFR-1` identifiers inside a feature spec.

### Functional Requirements

- **REQ-{DOMAIN}-{NNN}:** [Requirement description]
- **REQ-{DOMAIN}-{NNN}:** [Requirement description]
- **REQ-{DOMAIN}-{NNN}:** [Requirement description]

### Non-Functional Requirements

- **REQ-{DOMAIN}-{NNN}:** [Performance — e.g., p95 latency < 500ms]
- **REQ-{DOMAIN}-{NNN}:** [Availability — e.g., 99.9% uptime]
- **REQ-{DOMAIN}-{NNN}:** [Accessibility — e.g., WCAG 2.2 AA compliance]
- **REQ-{DOMAIN}-{NNN}:** [Security — e.g., rate limiting, encryption]

---

## Data and Domain Model

### Entities Impacted

| Entity | Table | Change | PII | Tenant-Scoped |
|--------|-------|--------|-----|---------------|
| [Entity] | `table_name` | Create/Modify | Yes/No | Yes/No |

### Data Retention Impact

- [Entity]: [Retention policy and deletion method]

### Audit Logging Requirements

- Log [event type]: [fields to capture]

---

## API and Integration Surface

### Internal APIs

| Type | Endpoint/Procedure | Input | Output | Auth |
|------|-------------------|-------|--------|------|
| mutation | `router.method` | `{ field: type }` | `{ result: type }` | Required |
| query | `router.method` | `{ field: type }` | `{ result: type }` | Required |

### External Systems

| System | Purpose | Integration Pattern |
|--------|---------|-------------------|
| [Service] | [What it does] | [HTTPS API / Webhook / File sync] |

---

## Security and Privacy

### Data Classification

| Data | Tier | Handling |
|------|------|---------|
| [Data field] | T1 (PII) | Encrypt at rest; mask in logs |
| [Data field] | T3 (Financial) | Tokenization only |

### Threat Considerations

- **[Threat ID]:** [Description] — Mitigated by [control]

### Compliance Requirements

- [Standard]: [Specific requirement and how it's met]

---

## Observability

### Metrics

- `[metric.name]` (counter/histogram) — [What it measures]

### Logs

- Structured JSON log: `{ event: "[event]", [fields] }`
- [PII handling rules for this feature's logs]

### Alerts

- [Alert condition]: [Threshold and response]

---

## Testing and Quality

### Unit Tests

- [What to test at the unit level]

### Integration Tests

- [What to test with real module boundaries]

### E2E Tests

- [Critical user journeys to test end-to-end]

### Performance Tests

- [Load/stress scenarios and targets]

---

## Architecture

### Implementation Spec Decomposition

| Spec ID | Scope | Primary Requirement IDs | Status |
|----------|----------|-------------------------|--------|
| `SPEC-{DOMAIN}-{FEAT}-01` | [Atomic deliverable] | [REQ-{DOMAIN}-{NNN}] | [Draft / Planned / In Progress / Done] |
| `SPEC-{DOMAIN}-{FEAT}-02` | [Atomic deliverable] | [REQ-{DOMAIN}-{NNN}, REQ-{DOMAIN}-{NNN}] | [Draft / Planned / In Progress / Done] |

### Code Structure

```
src/[domain]/
├── index.ts              # Public exports (barrel)
├── [feature-logic].ts    # Business logic (pure functions)
├── [feature-db].ts       # Database operations
├── types.ts              # Type definitions
└── __tests__/
    ├── [feature].test.ts
    └── [feature].integration.test.ts
```

### Extracted Functions

| Function | Location | Signature | REQ | Tests |
|----------|----------|-----------|-----|-------|
| `functionName` | `domain/file.ts` | `(input: Type) => ReturnType` | REQ-{DOMAIN}-{NNN} | UT-N |

---

## Companion Files

This feature spec is supported by companion documents:

- `[SPEC-{DOMAIN}-{FEAT}-01].md` — Atomic implementation spec derived from this feature
- `[FEAT-{DOMAIN}-{NNN}].acceptance.md` — Acceptance criteria in Given/When/Then format
- `[FEAT-{DOMAIN}-{NNN}].testplan.md` — Detailed test plan with test IDs
- `[FEAT-{DOMAIN}-{NNN}].deps.md` — Internal and external dependencies, sequencing
- `[FEAT-{DOMAIN}-{NNN}].asvs.md` — OWASP ASVS security mapping (if applicable)

---

## Open Questions

- [Question 1 — current assumption and what needs resolution]
