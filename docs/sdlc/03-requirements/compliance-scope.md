---
title: Compliance Scope
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [executive, auditor, integrator]
sdlc_category: 03-requirements
related: [docs/sdlc/06-security/threat-model.md, docs/sdlc/05-data/classification.md]
---

# Compliance Scope

> **TL;DR:** v1 is a single-tenant on-prem deployment for self-hosted use. **No formal compliance certification (SOC2, HIPAA, ISO 27001) is in scope for v1.** GDPR applicability is limited; the orchestrator handles project artifacts (code, requirements, tickets), not personal data. This doc is the applicability statement, not a controls inventory.

Compliance scope statements are easier to read when they say what's NOT covered first. We do that here.

---

## What v1 is NOT certified / committed to

- **SOC2 (Type 1 or Type 2).** Not pursued. Out of scope for single-maintainer v1. Revisit when commercializing.
- **HIPAA.** Not applicable. The orchestrator does not handle PHI (Protected Health Information). If a customer attempts to use it for healthcare workflows, this is a misuse — addressed in customer-facing documentation.
- **ISO 27001 / ISO 27017.** Not pursued for v1.
- **PCI-DSS.** Not applicable. No payment processing.
- **FedRAMP.** Not applicable. No US federal customers in v1.
- **CCPA / state privacy laws.** Limited applicability — see GDPR section below for the analogous reasoning.

## GDPR applicability

GDPR is the framework most likely to apply to atl-mcp's data handling, even informally.

### What atl-mcp does with personal data

The orchestrator may incidentally handle personal data:

- **Operator account info** (the user running the orchestrator). The Atlassian account email + display name appears in audit entries.
- **Build agent session metadata.** If the build agent is human-driven, the human's identity may be associated with the session.
- **Customer code / project content.** Project profiles and blueprints may include identifying information about customers, employees, or third parties whose names appear in code or documentation.

It does NOT process:

- End-user personal data of the customer's customers.
- Health records.
- Financial transactions.
- Government IDs.

### GDPR roles

If a customer deploys atl-mcp and uses it on data containing personal information:

- The customer is the **data controller**.
- atl-mcp (the software) is a **processor** of whatever data flows through it.

In v1 single-tenant on-prem deployment: the customer hosts the orchestrator themselves; atl-mcp's authors don't process the data. The customer is fully responsible for GDPR compliance in their use.

If atl-mcp becomes SaaS post-v1: the relationship changes — the SaaS operator becomes a processor under contract.

### GDPR-relevant capabilities

| GDPR right | atl-mcp capability |
|---|---|
| Right to access | Customer can query their own data (DB direct access; mgmt REST) |
| Right to erasure | Schema-level: rows can be deleted. Audit chain retains a permanent record of operations (compliance with right-to-erasure for audit logs is debated; documented as a limitation). |
| Right to data portability | Export via mgmt REST or DB dump |
| Right to rectification | Update via the orchestrator's normal workflow |
| Privacy by default | Single-tenant; data classification policy in place |
| Privacy by design | Threat model + controls matrix at the architecture level |
| Data minimization | Context packs are bounded + redacted |

### Audit chain vs. GDPR right-to-erasure

The audit chain is intentionally append-only and tamper-evident. This conflicts with right-to-erasure when an audit entry contains personal data.

Mitigation:

- Avoid storing personal data in audit-entry payloads. Reference identifiers only (no email addresses, no names beyond actor accountId).
- Redact PII from audit-entry payloads at write time when detectable.
- For erasure requests: redact the *payload* of an entry while keeping the *signed envelope* (so chain integrity is preserved). This loses some forensic detail.

This is a known v1 limitation. Customers with strict GDPR posture should review and either accept or defer adoption.

## Data residency

v1 is on-prem deployed by the customer. Data residency is the customer's choice (where they host the orchestrator and its DB).

Post-v1 SaaS would have explicit residency commitments (region selection, no cross-region replication without consent).

## Logging + retention

| Data class | Retention | Justification |
|---|---|---|
| Audit chain entries | Indefinite | Forensic integrity |
| Application logs | 90 days hot, 1 year cold (when M11 archive is wired) | Investigation + audit requirements |
| Encrypted token rows | Until rotated | Functional |
| Project profiles + blueprints | Customer-managed | Customer's data lifecycle |
| Webhook deliveries | 30 days | Dedup window |

Retention is documented in [`../05-data/retention.md`](../05-data/retention.md).

## Customer-facing compliance commitments (v1)

We commit to:

- **Documenting our security posture** — see [`../06-security/`](../06-security/) for the full set.
- **Disclosing vulnerabilities** — see [`../06-security/vulnerability-disclosure.md`](../06-security/vulnerability-disclosure.md).
- **Honesty about scope** — this doc.
- **Reproducible security controls** — every control has a code path + test path.

We do NOT commit to:

- Formal certifications (see "What v1 is NOT certified / committed to" above).
- A specific compliance posture beyond what's documented.
- Notification timelines for security events affecting customer data (depends on customer contract; v1 is on-prem and the customer manages their own data flow).

## Roadmap

When commercializing atl-mcp post-v1:

- **Year 1 of commercial:** SOC2 Type 1.
- **Year 2:** SOC2 Type 2.
- **Specific customer requirements:** addressable contract-by-contract (HIPAA-eligible if a healthcare customer requires it; ISO 27001 if EU customers require it).

The compliance ladder is real money + real time. v1 doesn't pretend otherwise.

## Linked artifacts

- **Threat model:** [`../06-security/threat-model.md`](../06-security/threat-model.md)
- **Controls matrix:** [`../06-security/controls-matrix.md`](../06-security/controls-matrix.md)
- **Data classification:** [`../05-data/classification.md`](../05-data/classification.md)
- **Data retention:** [`../05-data/retention.md`](../05-data/retention.md)
- **Vulnerability disclosure:** [`../06-security/vulnerability-disclosure.md`](../06-security/vulnerability-disclosure.md)
- **Sibling NFRs:** [`nfr-security.md`](nfr-security.md), [`nfr-availability.md`](nfr-availability.md)
- **Charter:** [`../01-charter/README.md`](../01-charter/README.md)

---

*Last reviewed: 2026-04-25 by Chris.*
