# [Runbook Title]

Title: [Runbook Title]
Status: [Draft | Active | Deprecated]
Last updated: YYYY-MM-DD
Related docs: [links to related documentation]

[One-paragraph description of what this runbook covers and when to use it.]

---

## Quick Reference

| Item | Value |
|------|-------|
| Key metric 1 | Target value |
| Key metric 2 | Target value |
| Emergency contact | [method] |

---

## 1. Overview

### 1.1 Purpose

[Why this runbook exists and when to use it.]

### 1.2 Scope

- **Covers:** [What this runbook addresses]
- **Does NOT cover:** [What is handled elsewhere]

### 1.3 Prerequisites

- [ ] Required access or permissions
- [ ] Required tools or dashboards
- [ ] Required knowledge or training

---

## 2. Procedure

### 2.1 Pre-Procedure Checklist

- [ ] Checklist item 1
- [ ] Checklist item 2
- [ ] Checklist item 3

### 2.2 Step-by-Step Procedure

**Step 1: [Action]**

[Description of what to do and why.]

```bash
# Command example (if applicable)
command --flag value
```

**Expected outcome:** [What should happen after this step.]

**Step 2: [Action]**

[Description.]

**Step 3: [Action]**

[Description.]

### 2.3 Verification Checklist

- [ ] Verify step 1 completed correctly
- [ ] Verify step 2 completed correctly
- [ ] Verify step 3 completed correctly

---

## 3. Decision Trees

### 3.1 [Decision Scenario]

```
Is condition A true?
├── YES → Action 1
│         └── Is sub-condition true?
│             ├── YES → Action 1a
│             └── NO → Action 1b
└── NO → Action 2
```

### 3.2 [Conditional Decision Table]

| Condition | Action |
|-----------|--------|
| Condition A | Do X |
| Condition B | Do Y |
| Condition C | Do Z |
| Default | Do W |

---

## 4. Troubleshooting

### Issue: [Problem Description]

**Symptoms:**
- Symptom 1
- Symptom 2

**Root Cause:** [Typical cause]

**Resolution:**
1. Step 1
2. Step 2
3. Step 3

### Issue: [Another Problem]

**Symptoms:**
- Symptom 1

**Resolution:**
- Action to take

---

## 5. Recovery Procedures

### 5.1 Rollback Procedure

**When to rollback:**
- Criteria 1
- Criteria 2

**Steps:**
1. [Rollback step 1]
2. [Rollback step 2]
3. [Verification step]

### 5.2 Emergency Procedures

**CRITICAL: [Emergency scenario]**

1. Immediate action
2. Next action
3. Verification

---

## 6. Communication

### 6.1 Notification Templates

**[Scenario] — Initial:**
```
[Template text with placeholders for team/status/impact/ETA]
```

**[Scenario] — Resolved:**
```
[Template text with placeholders for resolution/duration/root cause]
```

### 6.2 Escalation Path

| Severity | Contact | Method | Response Time |
|----------|---------|--------|---------------|
| SEV1 (Critical) | [Name/Role] | [Phone/Slack] | Immediate |
| SEV2 (High) | [Name/Role] | [Email] | < 1 hour |
| SEV3 (Low) | [Name/Role] | [Ticket] | < 4 hours |

---

## 7. Automation

### Currently Automated
- [List of automated steps]

### Candidates for Automation
- [ ] [Manual step that could be automated]
- [ ] [Another manual step]

---

## 8. Related Links

| Resource | URL | Purpose |
|----------|-----|---------|
| Dashboard | [URL] | Monitoring |
| Docs | [URL] | Reference |
| Status | [URL] | External service status |

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| YYYY-MM-DD | Initial version | [Name] |

---

## Runbook Quality Checklist

Before publishing, verify:

- [ ] Clear title and purpose
- [ ] Quick reference section for fast access
- [ ] Step-by-step procedures with commands
- [ ] Verification steps after each major action
- [ ] Decision trees for complex scenarios
- [ ] Troubleshooting section for common issues
- [ ] Rollback/recovery procedures
- [ ] Communication templates if customer-facing
- [ ] Links to related documentation
- [ ] Changelog started
