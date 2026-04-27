# Product Requirements Document: [Product/Feature Name]

<!-- Product/Feature Name: Concise name for this product or feature.
     Example: "User Email Verification Flow", "Dashboard Export to PDF", "Multi-tenant Workspace Management" -->

**PRD ID:** <!-- PRD-NNN. Example: PRD-007 -->
**Version:** <!-- 1.0 — increment on material changes -->
**Status:** <!-- draft | in-review | approved | superseded -->
**Author:** <!-- Name or agent ID -->
**Created:** <!-- YYYY-MM-DD -->
**Last Updated:** <!-- YYYY-MM-DD -->
**Approved By:** <!-- Name, date. Leave blank until approved. -->

---

## Step 1: Product Overview

<!-- 2–4 sentences. What is this? What does it do for users?
     Written for a new team member who has no prior context.
     Example: "Email verification requires users to confirm ownership of their email address
     before accessing protected features. The system sends a time-limited verification link
     to the registered address. Until verified, users can log in but cannot post content
     or access billing settings." -->

[Product/feature description. Audience-agnostic summary. What exists after this ships.]

---

## Step 2: Problem Statement

<!-- What problem does this solve? Be concrete: what is painful today, what breaks without this,
     what business or user need goes unmet?
     Use the format: "Today, [who] experiences [pain] when [situation], which causes [consequence]."
     Example: "Today, users who mistype their email address during registration receive no feedback,
     leading to locked accounts and a support load of ~40 tickets/month. Additionally, unverified
     email addresses mean we cannot rely on email as a recovery channel." -->

**Today's situation:**
[What exists today and what's wrong with it.]

**Impact of the problem:**
[Quantify if possible: support tickets, conversion rate, revenue, user churn, security risk.]

**Why now:**
[What changed that makes this the right time to solve it: new regulation, growth milestone, customer request, technical debt threshold reached.]

---

## Step 3: Target Users

<!-- Who uses this feature? Be specific — not "all users" but the persona(s) affected.
     Each persona should have: name, description, primary motivation, current workaround. -->

### Primary User
**Persona:** <!-- Example: "New Registrant" -->
**Description:** <!-- Example: "A user who just created an account and has not yet verified their email." -->
**Primary motivation:** <!-- Example: "Complete account setup quickly so they can access the product." -->
**Current workaround:** <!-- Example: "None — they are unblocked today but the product has no verification." -->

### Secondary User (optional)
**Persona:** <!-- Example: "Account Admin" -->
**Description:** <!-- Example: "A user managing team member accounts, who needs to resend verification emails." -->
**Primary motivation:** <!-- Example: "Ensure their team members can access the workspace." -->
**Current workaround:** <!-- Example: "Contact support to manually mark emails verified." -->

### Non-User (explicitly out of scope)
<!-- Who does NOT use this feature, to prevent over-engineering.
     Example: "Anonymous visitors — verification only applies to registered accounts." -->

## Step 3.5: Research Inputs

| Source | Type | Maturity | Constraint or decision impact |
|---|---|---|---|
| [Document or brief] | [technical research | security review | competitive analysis] | [background | actionable | decision-pending] | [what this changes in the PRD] |

---

## Step 4: User Stories / Jobs-to-be-Done

<!-- Format: "As a [persona], I want to [action] so that [outcome]."
     Each story should be independently deliverable and testable.
     Jobs-to-be-Done alternative: "When [situation], I want to [motivation], so I can [outcome]." -->

### Must-Have Stories (P0)
- **US-1:** As a [persona], I want to [action] so that [outcome].
  <!-- Example: "As a new registrant, I want to receive a verification email immediately after signup
       so that I can confirm my address while I still have the tab open." -->
- **US-2:** As a [persona], I want to [action] so that [outcome].
- **US-3:** As a [persona], I want to [action] so that [outcome].

### Should-Have Stories (P1)
- **US-4:** As a [persona], I want to [action] so that [outcome].
  <!-- Example: "As a registrant whose link expired, I want to request a new verification email
       so that I don't have to create a new account." -->
- **US-5:** As a [persona], I want to [action] so that [outcome].

### Nice-to-Have Stories (P2)
- **US-6:** As a [persona], I want to [action] so that [outcome].
  <!-- Example: "As an admin, I want to see which team members have unverified emails
       so that I can follow up proactively." -->

---

## Step 5: Functional Requirements

<!-- Numbered, prioritized. Each requirement maps to one or more user stories.
     Format: [Priority] REQ-N: [System MUST/SHOULD/MUST NOT] [behavior]. Maps to: [US-N].
     Priority: P0 = must ship | P1 = should ship | P2 = nice to have -->

### P0 — Must Ship

| ID | Requirement | Maps To |
|----|------------|---------|
| REQ-1 | The system MUST send a verification email within 60 seconds of account creation. | US-1 |
| REQ-2 | The system MUST [requirement]. | US-[N] |
| REQ-3 | The system MUST NOT [prohibition]. | US-[N] |

### P1 — Should Ship

| ID | Requirement | Maps To |
|----|------------|---------|
| REQ-4 | The system SHOULD [requirement]. | US-[N] |
| REQ-5 | The system SHOULD [requirement]. | US-[N] |

### P2 — Nice to Have

| ID | Requirement | Maps To |
|----|------------|---------|
| REQ-6 | The system MAY [requirement]. | US-[N] |

---

## Step 6: Non-Functional Requirements

### Performance
<!-- Specify measurable targets. Avoid "fast" — say "p95 < 200ms".
     Example: "Verification link generation MUST complete in < 100ms at p99 under 1,000 RPS." -->

- **Response time:** [p95 / p99 target for affected endpoints]
- **Throughput:** [RPS or concurrent users target]
- **Availability:** [uptime SLA, e.g., 99.9%]

### Security
<!-- List specific security requirements. Reference OWASP where applicable.
     Example: "Verification tokens MUST be cryptographically random (≥128 bits entropy).
     Tokens MUST expire after 24 hours. Expired tokens MUST return 410 Gone, not 404." -->

- [Security requirement 1]
- [Security requirement 2]
- [Security requirement 3 — No PII in logs (OWASP A09)]

### Accessibility
<!-- WCAG level target and any specific requirements.
     Example: "All new UI MUST meet WCAG 2.1 AA. Verification status MUST be conveyed
     via text, not color alone (SC 1.4.1)." -->

- **WCAG target:** <!-- AA | AAA -->
- [Specific accessibility requirement]

### Reliability
<!-- Error handling, retry behavior, graceful degradation.
     Example: "If the email provider is unavailable, queue the verification email
     for retry with exponential backoff (max 3 attempts over 15 minutes)." -->

- [Reliability requirement]

### Observability
<!-- Logging, metrics, alerting requirements.
     Example: "Emit a metric `email_verification.sent` on each send.
     Alert if verification send failure rate exceeds 1% over 5 minutes." -->

- [Metric / log / alert requirement]

---

## Step 7: Technical Constraints

<!-- Hard constraints the implementation must work within.
     These are not preferences — they are facts about the environment. -->

- **Language/Runtime:** <!-- Example: TypeScript 5.x, Node.js 20 LTS -->
- **Framework:** <!-- Example: Next.js 15 App Router -->
- **Database:** <!-- Example: PostgreSQL 16 via Drizzle ORM — no raw SQL strings -->
- **Authentication:** <!-- Example: Must integrate with existing NextAuth.js session -->
- **Email provider:** <!-- Example: Resend API (already in package.json) — do not add new email library -->
- **Deployment target:** <!-- Example: Vercel Edge Runtime — no Node.js-only APIs -->
- **Bundle size:** <!-- Example: No new dependencies over 50KB gzipped without approval -->
- **Existing patterns:** <!-- Example: Must follow error response contract from ADR-005 -->

---

## Step 8: Success Metrics

<!-- How will we know this worked? Specify measurement method and target value.
     Each metric should be measurable within 30 days of ship. -->

| Metric | Baseline (today) | Target (30 days post-ship) | Measurement Method |
|--------|-----------------|---------------------------|-------------------|
| <!-- Email verification rate (% of users who verify within 24h) --> | <!-- N/A (feature doesn't exist) --> | <!-- ≥60% --> | <!-- analytics.verified_within_24h / analytics.registrations --> |
| <!-- Support tickets: "can't verify email" --> | <!-- ~40/month --> | <!-- <5/month --> | <!-- Zendesk tag: email-verification --> |
| <!-- [Metric] --> | <!-- [Baseline] --> | <!-- [Target] --> | <!-- [Method] --> |

---

## Step 9: Out of Scope

<!-- Explicit list of what this PRD does NOT cover. Each item prevents a scope argument later.
     Example: "Social login (Google, GitHub) — covered in PRD-012."
     The more specific, the more valuable. -->

The following are explicitly NOT part of this PRD:

- **[Item]:** [Why it's excluded and where it's handled, if anywhere.]
- **[Item]:** [Why it's excluded.]
- **[Item]:** [Why it's excluded.]

---

## Step 10: Open Questions

<!-- Questions that must be answered before implementation can begin (blocking),
     or that are decided during implementation (non-blocking).
     Assign each question an owner and a target resolution date. -->

| # | Question | Owner | Target Date | Status |
|---|----------|-------|------------|--------|
| 1 | <!-- "Should unverified users be able to log in at all, or is login blocked?" --> | <!-- PM --> | <!-- 2026-03-01 --> | <!-- open --> |
| 2 | <!-- "What is the verification link TTL? 24h, 72h, 7d?" --> | <!-- Security lead --> | <!-- 2026-03-01 --> | <!-- resolved: 24h --> |
| 3 | <!-- [Question] --> | <!-- [Owner] --> | <!-- [Date] --> | <!-- open --> |

---

## Step 11: Risk Assessment

<!-- What could go wrong? Each risk should have a mitigation strategy.
     Likelihood: low | medium | high
     Impact: low | medium | high -->

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| <!-- Email provider outage blocks new signups --> | <!-- medium --> | <!-- high --> | <!-- Queue emails with 3-attempt retry; allow unverified login for 1h grace period --> |
| <!-- Verification tokens brute-forced --> | <!-- low --> | <!-- high --> | <!-- 128-bit entropy tokens, rate-limit /verify endpoint to 5 attempts/hour per IP --> |
| <!-- [Risk] --> | <!-- [L] --> | <!-- [I] --> | <!-- [Mitigation] --> |

---

## Step 12: Implementation Phases

<!-- Break the work into shippable increments. Each phase should be independently deployable.
     Reference the task specifications that implement each phase. -->

### Phase 1: [Phase Name] — [Ship Date]
<!-- Example: "Phase 1: Core Verification Flow — 2026-03-10" -->

**Goal:** [What this phase delivers to users.]

**Included:**
- REQ-1, REQ-2, REQ-3
- US-1, US-2
- Specs: [SPEC-{DOMAIN}-{FEAT}-{NN}]
- Test strategy: [test-first | test-alongside | deferred-exploratory]

**Not included (deferred to Phase 2+):**
- [What's left out]

**Rollout plan:** <!-- Feature flag | Dark launch | Full rollout -->

---

### Phase 2: [Phase Name] — [Ship Date]

**Goal:** [What this phase adds on top of Phase 1.]

**Included:**
- REQ-4, REQ-5
- US-3, US-4
- Specs: [SPEC-{DOMAIN}-{FEAT}-{NN}]

---

<!-- Add Phase 3+ as needed -->

---

## Appendix

### Related Documents
- **ADR(s):** <!-- ADR-NNN: [Title] -->
- **Design mockups:** <!-- Figma link or file path -->
- **API contract:** <!-- OpenAPI spec path or link -->
- **Prior art / research:** <!-- Links to relevant research, competitive analysis, etc. -->

### Revision History

| Version | Date | Author | Summary of Changes |
|---------|------|--------|--------------------|
| 1.0 | <!-- YYYY-MM-DD --> | <!-- Author --> | Initial draft |
