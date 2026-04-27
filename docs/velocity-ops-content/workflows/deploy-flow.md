# Deploy Flow — Controlled Rollout and Verification

**Workflow type:** Deployment execution
**Complexity target:** Staging and production deployments
**Source:** Framework quality-gate pipeline + runtime control-plane + ops-lane commands

---

## Core Principle

Deployments are operational changes, not just command execution. Each deploy requires strategy declaration, verification, and rollback readiness. No deployment is considered successful until post-deploy verification passes. If verification fails, the rollback path must be exercised immediately.

The framework provides:
- the deploy checklist runtime (`runtime/control-plane.mjs` / `scripts/runtime/start.sh`)
- framework gate scripts such as `quality-check.sh`, `security-policy-check.sh`, and `doc-staleness-check.sh` when this repo has adopted them
- the artifact contract for `.ai/deploy-intent.md` and `.ai/deploy-report.md`

The framework does not provide:
- a universal `deploy` command
- a universal production URL or health endpoint
- a universal smoke-test entry point

---

## Trigger Conditions

Use this flow when:
- Promoting a release candidate to staging or production
- Executing canary/rolling/blue-green rollout
- Performing a hotfix deployment outside the normal release cadence
- Re-deploying after a rollback to restore the corrected version

Do NOT use this flow for:
- Local development runs or test builds
- Non-deploying build checks (use `quality-check.sh`)
- Infrastructure-only changes that do not involve application code

---

## Prerequisites

- [ ] A release candidate exists with evidence (see `release-flow.md` or `.ai/release-candidate.md`)
- [ ] All quality gates have passed (`quality-check.sh --fail-fast` exits 0)
- [ ] Security policy checks have passed (`security-policy-check.sh` exits 0)
- [ ] A rollback target is documented (previous known-good tag/commit)
- [ ] The deployment strategy has been chosen and approved

---

## Step 0 — Deployment Context Declaration

Before any deployment action, create `.ai/deploy-intent.md` to explicitly record the deployment plan:

```markdown
# Deployment Intent

**Date:** [YYYY-MM-DD HH:MM UTC]
**Environment:** [staging | production]
**Strategy:** [rolling | blue-green | canary | direct]
**Version:** [version being deployed, e.g. v1.3.0]
**Commit SHA:** [full commit SHA]
**Rollback target:** [previous known-good version or commit]
**Rollback owner:** [who is authorized to trigger rollback]
**Expected impact window:** [estimated duration of deployment]
**Approval:** [who approved this deployment and when]
```

Record the deployment run in the framework runtime if the control plane is active. The
deploy workflow is a persisted checklist in the local control plane; the runbook steps
below remain the source of truth for the actual deploy commands and verification:

```bash
bash "$FRAMEWORK_DIR/scripts/runtime/start.sh" init --workflow deploy-flow --task "Deploy [version] to [environment]"
```

---

## Step 1 — Preflight Gate Verification

Run all preflight gates and record their outputs. All gates must pass before proceeding.

### 1a. Quality gates

```bash
bash scripts/quality-check.sh --fail-fast
```

If quality gates fail, the deployment status is `BLOCKED`. Do not proceed.

If the runtime quality gate will be used and the repo does not expose the canonical
`pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm build` scripts, define
`.ai/runtime-quality-contract.json` with the explicit commands the control plane should run.

### 1b. Security policy checks

```bash
bash scripts/security-policy-check.sh .
```

If security checks fail, the deployment status is `BLOCKED`. Do not proceed.

### 1c. Documentation staleness check

```bash
bash scripts/doc-staleness-check.sh --project . --event deploy
```

Deploy is a real doc-review trigger. If the check returns non-zero, either refresh the
review state or proceed under a documented waiver before continuing.

### 1d. Dependency audit

If `pnpm audit` or equivalent is configured:

```bash
pnpm audit --audit-level=high
```

High or critical vulnerabilities in production dependencies are blocking unless explicitly waived in `.ai/framework-waivers.md`.

### Gate failure handling

| Gate | Failure Action |
|------|----------------|
| Quality gates | Fix failing checks, re-run, do not deploy |
| Security policy | Remediate findings or obtain waiver with expiry date |
| Doc staleness | Refresh documentation or waive with justification |
| Dependency audit | Update or waive with specific CVE-level justification |

---

## Step 2 — Build Verification

Build the production artifact and confirm it succeeds:

```bash
pnpm build
```

For projects with preview/staging builds:

```bash
pnpm build:staging   # or environment-specific variant
```

Verify that:
- Build exits 0
- Build output is the expected size and contains expected entry points
- No warnings that indicate missing environment variables or misconfigured paths
- The build artifact reflects the intended version (check version strings if applicable)

Update `.ai/deploy-report.md` during or immediately after preflight/build so the runtime can
validate the checkpoint. At minimum, record:

```markdown
**Date:** 2026-03-12
**Environment:** production
**Version deployed:** 1.3.0
**Commit SHA:** abc1234
**Preflight gates passed:** yes

## Preflight Gates
- **Quality:** [PASS/FAIL/WAIVED — command or waiver ref]
- **Security policy:** [PASS/FAIL/WAIVED — command or waiver ref]
- **Documentation staleness:** [PASS/FAIL/WAIVED — review state or waiver ref]
- **Dependency audit:** [PASS/FAIL/SKIPPED — command, waiver ref, or reason]
```

---

## Step 3 — Execute Deployment

Use the repo or platform's actual deploy command. Record the exact command used. The commands
below are examples only:

```bash
# Example commands only — replace with the repo's real deploy mechanism
pnpm deploy
# or
pnpm run deploy:staging
# or
vercel deploy --prod
# or
fly deploy
```

### Deployment execution rules

1. Deploy to staging first. Production deployments require a successful staging deployment.
2. Record the deploy start time in `.ai/deploy-report.md`.
3. Monitor the deployment output for errors. If the deploy command exits non-zero, immediately record the failure and abort.
4. For canary/rolling strategies, monitor the initial rollout percentage before expanding to full traffic.

### During deployment

Watch for:
- Error rate spikes in monitoring (if available)
- Deployment command timeouts
- Infrastructure provisioning failures
- DNS propagation issues (for blue-green)

---

## Step 4 — Post-Deploy Verification

After the deployment command succeeds, verify the deployment is healthy.

### 4a. Health endpoint check

```bash
# Example only — point this at the real deployed health URL if one exists
curl -fsS "$DEPLOY_HEALTHCHECK_URL"
```

Expected: success from the real service health endpoint. If the repo has no health endpoint,
use the platform's native health probe or a documented critical-path check instead.

### 4b. Critical path smoke test

Run the project's smoke test suite against the deployed environment:

```bash
# Example only — replace with the repo's actual smoke test command if it has one
pnpm test:smoke -- --env="$DEPLOY_ENVIRONMENT"
```

If no dedicated smoke test exists, manually verify:
1. The application loads without console errors
2. Authentication flow works end-to-end
3. The primary user action (create/read/update) succeeds
4. API responses return expected data shapes

### 4c. Error budget check

If error monitoring is configured (Sentry, LogRocket, Datadog, etc.), check that error rates have not increased beyond the deployment's error budget threshold. A spike above 2x the pre-deploy baseline within the first 15 minutes is a rollback trigger.

### 4d. Performance baseline

If performance monitoring is available, verify:
- P95 latency has not increased more than 20% from the pre-deploy baseline
- No new timeout errors
- Memory/CPU usage is within expected bounds

### Verification failure handling

| Failure | Action |
|---------|--------|
| Health endpoint returns non-200 | Check logs, wait 60s, retry. If still failing after 3 attempts, initiate rollback. |
| Smoke test fails | Investigate the specific failure. If it's a deploy issue (not a test issue), initiate rollback. |
| Error rate spike > 2x baseline | Initiate rollback immediately. Do not wait to diagnose. |
| Performance degradation > 20% P95 | Monitor for 10 minutes. If sustained, initiate rollback. |

---

## Step 5 — Evidence Logging

Write `.ai/deploy-report.md` with complete evidence:

```markdown
# Deployment Report

**Date:** [YYYY-MM-DD]
**Environment:** [staging | production]
**Version deployed:** [version]
**Commit SHA:** [SHA]
**Deploy command:** [exact command used]

## Preflight Gates
- **Quality:** [PASS/FAIL/WAIVED — command or waiver ref]
- **Security policy:** [PASS/FAIL/WAIVED — command or waiver ref]
- **Documentation staleness:** [PASS/FAIL/WAIVED — review state or waiver ref]
- **Dependency audit:** [PASS/FAIL/SKIPPED — command, waiver ref, or reason]

## Timeline
- **Preflight gates passed:** [timestamp]
- **Build completed:** [timestamp]
- **Deploy started:** [timestamp]
- **Deploy completed:** [timestamp]
- **Verification started:** [timestamp]
- **Verification completed:** [timestamp]

## Verification Results
- **Health endpoint:** [PASS/FAIL — HTTP status]
- **Smoke tests:** [PASS/FAIL — summary]
- **Error rate:** [normal / elevated — baseline vs current]
- **Performance:** [within bounds / degraded — P95 comparison]

## Status
[DEPLOYED | ROLLED_BACK | BLOCKED]

## Rollback Information
- **Rollback target:** [version/commit]
- **Rollback trigger conditions:** [what would trigger a rollback]
- **Rollback executed:** [yes/no — if yes, link to rollback-flow session]

## Incidents
[none | link to incident record]
```

---

## Step 6 — Runtime State Update

If the framework runtime is active, advance the run after each checkpoint update. The deploy
workflow has five artifact-gated checkpoints: deploy intent, preflight report, deploy
execution evidence, post-deploy verification evidence, and final handoff status.

```bash
bash "$FRAMEWORK_DIR/scripts/runtime/start.sh" advance --run-id [run-id]
```

At the end of the deploy, you may also close the run with:

```bash
bash "$FRAMEWORK_DIR/scripts/runtime/start.sh" complete --run-id [run-id] --summary "DEPLOYED"
```

`complete` now validates the remaining deploy checkpoints instead of blindly marking the run complete.

---

## Step 7 — Session Close

Update `.ai/` state:

**`.ai/active-context.md`:** Record deployment outcome:

```markdown
## Deployment: [version] → [environment]
**Status:** [DEPLOYED / ROLLED_BACK]
**Completed:** [timestamp]
**Next action:** [monitoring period / none]
```

**`.ai/session-log.md`:** Append:

```markdown
## [YYYY-MM-DD] Deploy
**Task:** Deploy [version] to [environment]
**Accomplished:** [deployment completed / rolled back]
**Decisions:** [strategy choice, any waivers granted]
**Next session needs:** [monitoring continuation / none]
```

---

## Failure Handling Summary

| Failure | Action |
|---------|--------|
| Preflight gates fail | Fix findings, do not deploy |
| Build fails | Fix build issues, do not deploy |
| Deploy command exits non-zero | Record failure, investigate, retry or abort |
| Post-deploy verification fails | Initiate rollback (see `rollback-flow.md`) |
| Error rate spike after deploy | Initiate rollback immediately |
| Performance degradation sustained | Initiate rollback after 10-minute observation |
| Rollback fails | Escalate to incident (see `incident-flow.md`) |

---

## Strategy Reference

| Strategy | When to use | Rollback speed |
|----------|------------|----------------|
| **Direct** | Non-critical services, staging only | Slow (redeploy previous version) |
| **Rolling** | Stateless services, multiple replicas | Medium (stop rollout, drain new instances) |
| **Blue-green** | Zero-downtime requirement, DNS-switchable | Fast (switch traffic back to blue) |
| **Canary** | High-risk changes, gradual validation | Fast (route all traffic to stable) |
