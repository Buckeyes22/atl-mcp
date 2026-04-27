# Incident Flow — Detect, Contain, Recover, Learn

**Workflow type:** Incident response
**Complexity target:** Service degradation, outage, security incidents, local working-state corruption
**Source:** Framework ops-lane commands + incident-response template + rollback-flow integration

---

## Core Principle

Separate facts from hypotheses. Stabilize first, diagnose second, improve third. Every action during an incident must be recorded with a timestamp.

An incident is any event that causes customer-facing impact, violates an SLO, compromises security, or corrupts the working state of the codebase. Incidents are not only production failures — they include secret exposure, credential leakage, and unrecoverable local working-state corruption.

---

## Trigger Conditions

Use this flow when:
- A customer-facing failure is detected or reported
- A security incident is suspected or confirmed (credential exposure, unauthorized access)
- A critical SLO/SLA breach is active
- Error rates exceed the defined rollback threshold
- A deployment has caused regression beyond acceptable thresholds
- The local working tree, branch state, or staged changes have been corrupted by agent or human work

Do NOT use this flow for:
- Performance investigations without current customer impact (use monitoring → investigation → bugfix)
- Planned maintenance windows
- Test or staging environment issues (unless they block production work)

---

## Prerequisites

- [ ] An observable failure exists with at least one of: error alert, user report, monitoring signal, or local corruption symptom
- [ ] The person initiating has authority or delegation to make containment decisions

---

## Step 0 — Incident Record Creation

Create `.ai/incident.md` immediately. This is the source of truth for the incident.

```markdown
# Incident Record

**Incident ID:** INC-[YYYYMMDD]-[NNN]
**Status:** ACTIVE
**Summary:** [one-sentence description from $ARGUMENTS or initial report]
**Detection time (UTC):** [YYYY-MM-DD HH:MM:SS UTC]
**Detection method:** [alert / user report / monitoring / CI failure / manual discovery]
**Reporter:** [who detected or reported the incident]

## Severity Classification

**Severity:** [SEV-1 | SEV-2 | SEV-3 | SEV-4]
**Owner:** [incident commander — person responsible for driving resolution]

## Affected Systems

- [system, service, or component 1]
- [system, service, or component 2]

## Customer Impact

**Impact scope:** [all users / subset / internal only / local only]
**Impact description:** [what users experience]
```

### Severity guide

| Level | Definition | Response time | Examples |
|-------|-----------|---------------|----------|
| **SEV-1** | Full outage, data loss, security compromise | Immediate — all other work stops | Production down, credentials exposed in public repo, database corruption |
| **SEV-2** | Major user-facing degradation | Within 1 hour | Primary feature broken, significant error rate increase, auth failures |
| **SEV-3** | Partial degradation, workaround exists | Within 4 hours | Non-critical feature broken, degraded performance with workaround |
| **SEV-4** | Minor operational issue | Within 1 business day | Logging gaps, non-critical alert noise, cosmetic regression |

### Special incident types

**Secret exposure:** Treat any credential or secret appearing in source code, logs, CI output, or git history as SEV-1 regardless of the scope of the credential. The credential must be rotated before any other action.

**Local corruption:** If the incident is localized to the working tree or branch state:
- Note whether the blast radius is limited to one branch/worktree or affects shared history
- If shared history is affected, escalate to SEV-2 and notify the team before recovery
- See Step 4 for local-specific recovery procedures

---

## Step 1 — Containment

The goal of containment is to stop the bleeding. Containment actions reduce impact — they do not diagnose or fix the root cause.

### 1a. Identify containment options

List all available immediate actions:
- Disable failing feature flag
- Isolate failing integration or service
- Switch traffic to stable instance (for blue-green or canary)
- Initiate rollback to last known-good version (see `rollback-flow.md`)
- Rotate exposed credential
- Revert specific commit if the regression cause is obvious

### 1b. Execute containment

Execute the **fastest** safe containment action. Record each action:

```markdown
## Containment Actions

| Time (UTC) | Action | Outcome | Executed by |
|------------|--------|---------|-------------|
| HH:MM:SS | [action taken] | [result] | [person] |
```

### 1c. Verify containment effectiveness

After each containment action, verify:
- Customer impact is reduced or eliminated
- Error rates are trending down
- No new failures were introduced by the containment action

### Containment rules

1. **Speed over elegance.** The fastest action that reduces customer impact wins.
2. **Never debug in production.** Containment is about stopping impact, not understanding cause.
3. **Rollback is always a valid containment action.** If in doubt, roll back.
4. **Credential exposure requires immediate rotation.** Do not investigate first — rotate, then investigate.
5. **Record every action with a timestamp.** Actions without timestamps cannot be reconstructed for the postmortem.

---

## Step 2 — Evidence Collection

Once impact is contained, collect evidence. Do not rely on memory — capture artifacts.

### 2a. System state capture

```bash
# Git state
git rev-parse HEAD
git log --oneline -n 20
git status

# Application state (adapt to the real incident probe for this repo/environment)
curl -fsS "$INCIDENT_HEALTHCHECK_URL"
```

### 2b. Log collection

Gather relevant logs from:
- Application logs (last 30 minutes around the detection time)
- Deploy logs (if deployment-related)
- CI/CD pipeline output (if build-related)
- Error tracking service (Sentry, LogRocket, etc.)
- Infrastructure/platform logs (Vercel, Fly, AWS, etc.)

### 2c. Monitoring data

Capture screenshots or exports of:
- Error rate charts showing the spike
- Latency charts showing degradation
- Resource utilization (CPU, memory, connections)

### 2d. Additional capture for specific incident types

**For secret exposure incidents:**
- Where the secret appeared (source file, logs, CI output, git history)
- Whether the credential has been rotated
- Whether any commit history cleanup is still pending (e.g., `git filter-branch` or BFG)
- What systems the credential grants access to

**For local corruption incidents:**
- Full `git status` output
- `git reflog` entries (last 20)
- `git stash list` output
- Contents of any `.ai/` state files that may have been corrupted

### 2e. Add evidence to incident record

Append all collected evidence to `.ai/incident.md`:

```markdown
## Evidence

### Logs
[paste relevant log segments or link to log files]

### Recent Changes
[git log output showing recent commits]

### Monitoring
[error rate / latency data]

### Failing Checks
[quality gate or test failures]
```

### Evidence collection rules

1. **Do not invent causes.** Distinguish facts (observed data) from hypotheses (interpretations).
2. **Timestamp everything.** Every piece of evidence must be associated with a time range.
3. **Preserve raw data.** Summaries are useful, but keep pointers to raw logs.

---

## Step 3 — Diagnosis

With containment in place and evidence collected, identify the root cause.

### 3a. Timeline reconstruction

Build a timeline from evidence:

```markdown
## Timeline

| Time (UTC) | Event |
|------------|-------|
| HH:MM:SS | [deploy started / commit pushed / config changed / etc.] |
| HH:MM:SS | [first error observed] |
| HH:MM:SS | [user report received] |
| HH:MM:SS | [containment action taken] |
| HH:MM:SS | [impact reduced/eliminated] |
```

### 3b. Root cause analysis

Follow the same hypothesis discipline as `bugfix-flow.md`:

1. Generate 2-3 hypotheses based on evidence, not intuition
2. Test each hypothesis against collected evidence
3. Identify the root cause as the first point where the wrong decision was made

```markdown
## Root Cause Analysis

**Root cause:** [specific statement — what changed, why it caused the failure]
**Contributing factors:** [conditions that made the failure possible or worse]
**Detection gap:** [why was this not caught before reaching customers]
```

### 3c. Impact assessment

```markdown
## Impact Assessment

**Duration:** [time from first customer impact to impact eliminated]
**Users affected:** [count or percentage if available]
**Data impact:** [none / data delayed / data lost / data corrupted]
**Revenue impact:** [none / estimated if calculable]
**SLA impact:** [none / SLA breach with specific terms]
```

---

## Step 4 — Recovery and Validation

### 4a. Service recovery (for production incidents)

If the system is not yet fully recovered after containment:

1. Apply the targeted fix if root cause is confirmed and the fix is safe
2. Or complete the rollback if it was initiated but not yet verified

Run quality gates against the recovered state:

```bash
bash scripts/quality-check.sh --fail-fast
bash scripts/security-policy-check.sh .
```

Verify:
- Health endpoints return 200
- Critical user flows work end-to-end
- Error rates are back to pre-incident baseline
- No new test failures

### 4b. Local working-state recovery (for corruption incidents)

1. Stop code edits immediately
2. Inspect `git status` and preserve salvageable work:

```bash
git stash push -m "incident-recovery-salvage-$(date +%Y%m%dT%H%M%S)"
# or if stash is not possible:
git diff > /tmp/incident-salvage.patch
```

3. Inspect `git reflog` to identify the last known-good local state:

```bash
git reflog -20
```

4. Restore deliberately to the known-good state by following the rollback ladder in
   `workflows/rollback-flow.md` and choosing the least-destructive option that resolves
   the corruption:

```bash
# Preferred sequence:
git checkout -- [file]      # restore only affected files when possible
git reset --soft HEAD@{N}   # preserve changes as staged if recent commits are the issue
git reset --mixed HEAD@{N}  # keep changes in the working tree while moving HEAD
# Use git reset --hard HEAD@{N} only if the less-destructive options cannot recover the tree
```

5. Re-open work from a clean branch if the original branch is corrupted:

```bash
git checkout -b recovery/[original-branch-name] [known-good-commit]
```

6. Record the recovery in `.ai/troubleshooting.md`:

```markdown
## ERR-NNN: [corruption symptom]

**First seen:** [date]
**Root cause:** [what caused the corruption]
**Recovery:** [exact commands used]
**Prevention:** [rules to prevent recurrence]
```

---

## Step 5 — Postmortem

Create `.ai/incident-postmortem.md` for every SEV-1 and SEV-2 incident. SEV-3 and SEV-4 incidents get an abbreviated postmortem appended to `.ai/incident.md`.

```markdown
# Incident Postmortem — INC-[ID]

**Date:** [YYYY-MM-DD]
**Severity:** [SEV-N]
**Duration:** [total incident duration]
**Commander:** [who led the response]

## Summary
[2-3 sentence summary of what happened, impact, and resolution]

## Timeline
[copy from Step 3a]

## Root Cause
[copy from Step 3b]

## Impact
[copy from Step 3c]

## What Went Well
- [effective containment action]
- [good detection speed]
- [effective communication]

## What Went Poorly
- [delayed detection / missing monitoring]
- [missing runbook / unclear procedures]
- [containment caused secondary issue]

## Corrective Actions

| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| [specific corrective action] | [person] | [date] | [ ] |
| [add monitoring for X] | [person] | [date] | [ ] |
| [add test for regression Y] | [person] | [date] | [ ] |

## Prevention
[What structural or process changes would prevent this class of incident from recurring]
```

---

## Step 6 — Session Close

Update `.ai/` state:

**`.ai/active-context.md`:**

```markdown
## Incident Response: INC-[ID]
**Status:** [RESOLVED | MONITORING | CORRECTIVE_ACTIONS_PENDING]
**Resolved:** [timestamp]
**Next action:** [monitor for 24h / implement corrective actions / none]
```

**`.ai/session-log.md`:** Append:

```markdown
## [YYYY-MM-DD] Incident Response
**Task:** Incident response — [summary]
**Status:** [RESOLVED / MONITORING]
**Root cause:** [one sentence]
**Containment actions:** [list]
**Corrective actions assigned:** [count]
**Decisions:** [key decisions made during response]
```

---

## Failure Handling Summary

| Failure | Action |
|---------|--------|
| Containment does not reduce impact | Escalate to next-level containment (full rollback, service isolation) |
| Rollback fails | Escalate severity by one level, engage platform/infrastructure team |
| Root cause cannot be identified | Document known facts, implement defensive monitoring, schedule deep investigation |
| Multiple incidents overlap | Assign separate commanders, check for common root cause |
| Credential rotation fails or is incomplete | Escalate to SEV-1, engage security team, assume compromise until proven otherwise |
| Local recovery loses work | Check `git stash list` and `git reflog` for additional recovery points |

---

## Escalation Matrix

| Condition | Escalation |
|-----------|------------|
| SEV-1 not contained within 30 minutes | Notify stakeholders, engage all available engineers |
| SEV-2 not contained within 2 hours | Escalate to SEV-1 response posture |
| Data loss confirmed | Engage database/storage team for point-in-time recovery |
| Security compromise confirmed | Engage security team, begin credential rotation sweep |
| Customer-facing SLA breach | Engage customer communications |
