# SLO Definition: [Domain/Service Name]

Status: [Draft | Active]
Last updated: YYYY-MM-DD
Related docs: [Architecture docs, observability docs, incident response]

---

## 1. Service Overview

[Brief description of the service or domain being measured.]

---

## 2. SLO Tiers

| Tier | Availability Target | Use Case |
|------|-------------------|----------|
| Critical | 99.9% (43.8 min/month) | Core revenue path, auth, payments |
| Important | 99.5% (3.6 hr/month) | Non-revenue features, secondary flows |
| Best-effort | 99.0% (7.3 hr/month) | Internal tools, admin dashboards |

---

## 3. SLO Definitions

### [SLO-1: Service Name — Metric]

**SLI (Service Level Indicator):**
- **What is measured:** [Specific metric — e.g., successful responses / total responses]
- **How it's measured:** [Data source — e.g., application metrics, load balancer logs]
- **Measurement window:** 30-day rolling

**SLO (Service Level Objective):**
- **Target:** [e.g., 99.9% success rate]
- **Tier:** [Critical / Important / Best-effort]

**Error Budget:**
- **Budget:** [e.g., 0.1% = 43.8 min/month]
- **Burn-rate alerts:**
  - 14.4x burn rate → SEV1 (budget consumed in 5 hours)
  - 6x burn rate → SEV1 (budget consumed in 12 hours)
  - 3x burn rate → SEV2 (budget consumed in 1 day)

**Error Budget Policy:**
- On budget exhaustion: [Action — e.g., freeze feature work, prioritize reliability]
- On 50% budget consumed: [Action — e.g., review recent changes, increase monitoring]

### [SLO-2: Service Name — Latency]

**SLI:**
- **What is measured:** Response latency at p95 and p99
- **Source:** Application tracing / APM
- **Measurement window:** 30-day rolling

**SLO:**
- **p95 target:** [e.g., < 500ms]
- **p99 target:** [e.g., < 1000ms]
- **Tier:** [Critical / Important]

---

## 4. SLO Template (Copy for Each Service)

```markdown
### [Service] — [Metric Type]

**SLI:**
- What: [metric description]
- Source: [data source]
- Window: 30-day rolling

**SLO:**
- Target: [percentage or latency]
- Tier: [Critical/Important/Best-effort]

**Error Budget:**
- Budget: [calculated from target]
- Burn alerts: 14.4x (SEV1), 6x (SEV1), 3x (SEV2)
- Policy: [actions on budget consumption]
```

---

## 5. Performance Baselines

| Metric | Baseline Target | Critical Threshold |
|--------|-----------------|-------------------|
| [API endpoint] p95 latency | [target] | [threshold] |
| [Query] p95 latency | [target] | [threshold] |
| [Background job] completion time | [target] | [threshold] |
| Concurrent users supported | [target] | [minimum] |

---

## 6. Alerting Configuration

| Alert | Threshold | Channel | Response Time |
|-------|-----------|---------|---------------|
| High error rate | > 1% for 5 min | [Slack/SMS] | < 15 min |
| High latency | p95 > [threshold] for 5 min | [Email] | < 30 min |
| Error budget burn | 14.4x rate | [SMS + Slack] | Immediate |
| Service down | Health check fails 3x | [SMS + Email] | Immediate |

---

## 7. Review Schedule

| Trigger | Action |
|---------|--------|
| Monthly | Review SLO performance and error budget status |
| Quarterly | Adjust targets based on actual performance data |
| After incident | Review if SLOs were appropriate; adjust if needed |
| New feature launch | Define SLOs before launch; add to monitoring |
