---
description: "Stripe billing patterns: freemium entitlements, webhooks, idempotency, and subscription state boundaries"
globs: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.svelte", "app/api/**/*.ts", "src/routes/**/*.server.ts", "src/lib/billing/**/*.ts", "src/server/billing/**/*.ts"]
alwaysApply: false
---

# Stripe Billing — Domain Module

**Targets:** Stripe Checkout, Billing Portal, Subscriptions, Webhooks
**Appended to base CLAUDE.md when Stripe billing is in use.**

---

## Billing Model

1. Treat freemium entitlements as first-class domain state, not scattered boolean checks.
2. Keep subscription status, product/price mapping, trial state, and entitlement decisions in one reviewed billing domain layer.
3. Never make feature access decisions directly from raw Stripe payloads inside UI code.

## Checkout and Customer State

4. Use stable internal customer/account IDs and map them to Stripe customer IDs in durable storage.
5. Treat Stripe price IDs and product IDs as configuration, not inline literals across multiple handlers.
6. Keep billing-domain transitions explicit: free -> trial -> active -> grace -> canceled should be modeled as state, not guessed from one field.

## Webhooks

7. Verify webhook signatures against the raw request body before parsing events.
8. Webhook handlers must be idempotent. Replayed events must not duplicate grants, invoices, or side effects.
9. Persist processed event IDs or equivalent replay protection for every externally triggered billing mutation.

## Entitlements and Access Control

10. A subscription payment event is not the same thing as access state. Build a reviewed entitlement projection layer.
11. Keep entitlement checks server-side. Client UI can reflect entitlement state, but it should not be the enforcement boundary.

## Testing Requirements

12. Test billing state transitions as domain logic before testing provider adapters.
13. Add regression coverage for:
    - first checkout
    - upgrade/downgrade
    - cancellation
    - invoice payment failure
    - replayed webhook delivery
14. When possible, separate pure billing-state logic from Stripe SDK calls so tests do not depend on live provider behavior for every scenario.


## Engine Vertical Integration

When this module is used in a client engagement, check the relevant industry vertical config in `engine/verticals/` for:
- **Compliance signals** that affect technology choices (e.g., HIPAA → encryption at rest, GLBA → audit logging)
- **Pain points** that the technology stack should address
- **Recommended services** that pair with this stack

Cross-reference `engine/verticals/{industry}.md` before making data storage, authentication, and API design decisions for client work.
