# Incident Response Framework

---

## 1. Severity Classification

| Severity | Definition | Response Time | Examples |
|----------|-----------|---------------|---------|
| **SEV-1 (Critical)** | System down, data breach, or security compromise affecting all users | Immediate (within 15 minutes) | Production outage, confirmed data breach, payment system failure |
| **SEV-2 (Major)** | Significant degradation affecting many users, no data loss | Within 1 hour | Major feature unavailable, performance degradation >5x, authentication issues |
| **SEV-3 (Minor)** | Limited impact, workaround available | Within 4 hours | Single feature broken for subset of users, non-critical integration failure |
| **SEV-4 (Low)** | Cosmetic or minor issue, no user impact | Next business day | UI glitch, non-blocking warning, documentation error |

---

## 2. Response Phases

### Phase 1: Identify and Classify

1. Confirm the incident is real (not a false alarm or monitoring noise)
2. Assign severity using the classification table above
3. Identify the blast radius (which users, services, or data are affected)
4. Designate an incident commander (IC) — the single decision-maker during the incident
5. Open an incident channel or thread for communication

### Phase 2: Contain

1. Stop the bleeding — prevent the issue from spreading
2. Isolate affected systems if necessary
3. Communicate status to affected stakeholders
4. Document timeline of actions taken

**Containment options (escalating):**
- Feature flag toggle (disable affected feature)
- Rollback to last known good deployment
- Scale down/isolate affected service
- DNS redirect to maintenance page
- Full system shutdown (last resort, SEV-1 only)

### Phase 3: Mitigate and Restore

1. Identify root cause (or a likely hypothesis)
2. Implement a fix or workaround
3. Verify the fix resolves the issue
4. Gradually restore service (canary → percentage rollout → full)
5. Monitor for recurrence

### Phase 4: Post-Incident

1. Preserve evidence (logs, metrics, screenshots, timeline)
2. Write a post-incident review within 48 hours
3. Identify action items to prevent recurrence
4. Update monitoring and alerting if gaps were found
5. Share learnings with the team

---

## 3. Communication Templates

### Internal Status Update

```
[SEVERITY] Incident: [Short description]
Status: [Investigating / Identified / Mitigating / Resolved]
Impact: [Who is affected and how]
Current action: [What is being done right now]
ETA: [When we expect resolution, or "Unknown"]
Next update: [When the next status update will be posted]
```

### External Status Update (if applicable)

```
We are aware of [issue description] affecting [scope].
Our team is actively working on a resolution.
We will provide an update by [time].
```

---

## 4. Post-Incident Review Template

| Field | Value |
|-------|-------|
| **Incident ID** | [INC-YYYY-MM-DD-NNN] |
| **Severity** | [SEV-1/2/3/4] |
| **Duration** | [Start time → Resolution time] |
| **Impact** | [Users affected, data affected, revenue impact] |
| **Root cause** | [What caused the incident] |
| **Detection** | [How was it detected? Monitoring, user report, etc.] |
| **Resolution** | [What fixed it] |

### Timeline

| Time | Event |
|------|-------|
| [HH:MM] | [What happened] |

### Action Items

| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| [Preventive action] | [Name] | [Date] | [Open / Done] |

### Lessons Learned

- [What went well]
- [What could be improved]
- [What was lucky (and should be hardened)]

---

## 5. Runbook Cross-Reference

Every production service should have a runbook. During an incident, the runbook is the first reference for:
- Service health check commands
- Common failure modes and their fixes
- Rollback procedures
- Escalation contacts

See `runbook.md` template for the standard runbook format.

> **Related:** See disaster-recovery.md for the process to follow during a disaster event (full outage, data loss, credential compromise).
