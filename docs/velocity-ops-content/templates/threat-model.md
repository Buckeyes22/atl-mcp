# Threat Model: [Domain/Component Name]

Status: [Draft | Active]
Last updated: YYYY-MM-DD
Related docs: [Architecture docs, security docs, compliance docs]

---

## 1. Overview

### 1.1 Component Description

[Brief description of the domain or component being threat-modeled.]

### 1.2 Trust Boundaries

[Identify where trust levels change — e.g., browser → API, API → database, internal → external.]

### 1.3 Data Flow Summary

```
[User] → [Edge/CDN] → [Application] → [Database]
                                     → [External Service]
```

---

## 2. Asset Inventory

| Asset | Classification | Location | Owner |
|-------|---------------|----------|-------|
| [User credentials] | Restricted | Database (hashed) | Auth team |
| [Session tokens] | Confidential | Redis / cookies | Auth team |
| [Business data] | Internal | Database | Domain team |

---

## 3. Entry Points

| Entry Point | Protocol | Authentication | Rate Limited |
|-------------|----------|---------------|-------------|
| Public API endpoint | HTTPS | None (public) | Yes |
| Authenticated API | HTTPS | Session cookie | Yes |
| Webhook receiver | HTTPS | HMAC signature | Yes |
| Admin interface | HTTPS | Session + MFA | Yes |

---

## 4. STRIDE Analysis

### Spoofing

| Threat | Risk | Mitigation | Status |
|--------|------|-----------|--------|
| [Credential stuffing] | High | Rate limiting, CAPTCHA, breach-check | [Mitigated/Open] |
| [Session hijacking] | High | HttpOnly cookies, HSTS, SameSite | [Mitigated/Open] |

### Tampering

| Threat | Risk | Mitigation | Status |
|--------|------|-----------|--------|
| [Request parameter manipulation] | Medium | Server-side validation (Zod) | [Mitigated/Open] |
| [Webhook payload tampering] | High | HMAC-SHA256 signature verification | [Mitigated/Open] |

### Repudiation

| Threat | Risk | Mitigation | Status |
|--------|------|-----------|--------|
| [Denial of actions] | Medium | Append-only audit log | [Mitigated/Open] |

### Information Disclosure

| Threat | Risk | Mitigation | Status |
|--------|------|-----------|--------|
| [PII in logs] | High | PII scrubbing in log pipeline | [Mitigated/Open] |
| [Error message leakage] | Medium | Generic error messages; no stack traces | [Mitigated/Open] |
| [Cross-tenant data leakage] | Critical | RLS policies; NOT_FOUND for cross-tenant | [Mitigated/Open] |

### Denial of Service

| Threat | Risk | Mitigation | Status |
|--------|------|-----------|--------|
| [API abuse] | High | Rate limiting, WAF, edge caching | [Mitigated/Open] |
| [Resource exhaustion] | Medium | Connection pooling, query timeouts | [Mitigated/Open] |

### Elevation of Privilege

| Threat | Risk | Mitigation | Status |
|--------|------|-----------|--------|
| [Role escalation] | Critical | Server-side RBAC; never trust client roles | [Mitigated/Open] |
| [Tenant context bypass] | Critical | Middleware-injected tenant ID; RLS enforcement | [Mitigated/Open] |

---

## 5. Domain-Specific Threats

| Threat ID | Description | Risk | Mitigation |
|-----------|-------------|------|-----------|
| [DOMAIN-001] | [Domain-specific threat] | [High/Med/Low] | [Mitigation approach] |

---

## 6. Per-Domain Checklist

- [ ] Asset identification complete
- [ ] Entry points identified
- [ ] Abuse scenarios enumerated
- [ ] Mitigations mapped to requirements/tests
- [ ] Residual risk documented

---

## 7. Residual Risk

| Risk | Likelihood | Impact | Acceptance Rationale |
|------|-----------|--------|---------------------|
| [Remaining risk 1] | Low | Medium | [Why this is acceptable] |

---

## 8. Review Schedule

| Trigger | Action |
|---------|--------|
| New feature in this domain | Update threat model |
| Quarterly review | Re-assess risk ratings |
| After security incident | Review and update mitigations |
| Architecture change | Re-evaluate trust boundaries |
