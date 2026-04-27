# Common Tasks Runbook

<!-- PURPOSE:
  This is a "How To" runbook template for common project operations.
  It serves as a reference for:
    - AI agents executing development tasks
    - New developers onboarding to the project
    - On-call engineers performing operational tasks

  HOW TO USE THIS TEMPLATE:
  1. Copy to your project as docs/runbook.md or RUNBOOK.md
  2. Fill in every <!-- FILL IN --> section with project-specific details
  3. Remove placeholder HTML comments before committing
  4. Keep this file updated as procedures change — it is a living document

  AGENT NOTE:
  If you are an AI agent, read this file before starting any of these tasks.
  Follow the steps exactly. Do not skip verification steps.
  If a step fails or is unclear, stop and ask the human for clarification.
-->

---

## Table of Contents

1. [Add an API Endpoint](#1-add-an-api-endpoint)
2. [Add a Database Migration](#2-add-a-database-migration)
3. [Add a UI Component](#3-add-a-ui-component)
4. [Add a New Test Suite](#4-add-a-new-test-suite)
5. [Add a New Dependency](#5-add-a-new-dependency)
6. [Deploy to Staging](#6-deploy-to-staging)
7. [Deploy to Production](#7-deploy-to-production)
8. [Roll Back a Deployment](#8-roll-back-a-deployment)
9. [Add a New Environment Variable](#9-add-a-new-environment-variable)
10. [Debug a Production Issue](#10-debug-a-production-issue)

---

## 1. Add an API Endpoint

### Prerequisites

<!-- FILL IN: List everything that must be true before starting this task.
  Example:
  - The database schema for the resource already exists (or a migration is being added in the same PR)
  - Authentication middleware is set up (see section 2 of architecture.md)
  - You have read the API conventions in docs/api-conventions.md
-->

- [ ] <!-- Prerequisite 1 -->
- [ ] <!-- Prerequisite 2 -->
- [ ] <!-- Prerequisite 3 -->

### Steps

<!-- FILL IN: Replace each step with your project's actual file paths, frameworks, and conventions.
  Example steps for a Next.js API route:
  1. Create the route file at `src/app/api/<resource>/route.ts`
  2. Implement GET/POST/etc. handlers following the pattern in `src/app/api/health/route.ts`
  3. Add input validation using Zod schema in `src/lib/schemas/<resource>.schema.ts`
  4. Add the route to the API documentation in `docs/api.md`
  5. Write integration tests in `src/app/api/<resource>/route.test.ts`
-->

1. <!-- Step 1 -->
2. <!-- Step 2 -->
3. <!-- Step 3 -->
4. <!-- Step 4 -->
5. <!-- Step 5 -->

### Verification

<!-- FILL IN: How do you confirm the endpoint works correctly?
  Example:
  - Run: curl -X GET http://localhost:3000/api/<resource>
  - Expected response: 200 OK with { data: [...] }
  - Run unit tests: pnpm test src/app/api/<resource>
  - Check request appears in local server logs
-->

```bash
# FILL IN: Add verification commands here
```

### Common Pitfalls

<!-- FILL IN: List known mistakes, gotchas, and how to avoid them.
  Example:
  - Forgetting to add the route to the OpenAPI spec causes CI to fail the schema check
  - Not wrapping database calls in try/catch causes unhandled 500s
  - Using `req.body` directly without validation allows injection attacks
-->

- <!-- Pitfall 1 -->
- <!-- Pitfall 2 -->
- <!-- Pitfall 3 -->

---

## 2. Add a Database Migration

### Prerequisites

<!-- FILL IN: Example:
  - Local database is running (`docker compose up db`)
  - You understand the existing schema (see prisma/schema.prisma or migrations/)
  - Migration is backward-compatible with the currently deployed code
-->

- [ ] <!-- Prerequisite 1 -->
- [ ] <!-- Prerequisite 2 -->

### Steps

<!-- FILL IN: Replace with your ORM/migration toolchain (Prisma, Drizzle, Alembic, Flyway, etc.)
  Example for Prisma:
  1. Edit `prisma/schema.prisma` to add/modify the model
  2. Run: pnpm prisma migrate dev --name <descriptive-name>
  3. Review the generated SQL in `prisma/migrations/<timestamp>_<name>/migration.sql`
  4. Verify the migration is reversible or document the rollback procedure
  5. Update seed data in `prisma/seed.ts` if necessary
  6. Run: pnpm prisma generate to regenerate the client

  Example for raw SQL:
  1. Create file: db/migrations/<timestamp>_<name>.sql
  2. Write idempotent UP and DOWN blocks
  3. Test locally: psql $DATABASE_URL -f db/migrations/<timestamp>_<name>.sql
-->

1. <!-- Step 1 -->
2. <!-- Step 2 -->
3. <!-- Step 3 -->
4. <!-- Step 4 -->

### Verification

```bash
# FILL IN: Commands to confirm the migration applied correctly
# Example:
# pnpm prisma studio        — visual inspection
# pnpm test:integration     — integration tests against migrated schema
```

### Common Pitfalls

- <!-- Pitfall 1: e.g., Non-nullable column added without default breaks existing rows -->
- <!-- Pitfall 2: e.g., Renaming a column requires two deployments (add new, backfill, drop old) -->
- <!-- Pitfall 3: e.g., Migration file must not be edited after it has been applied to any environment -->

---

## 3. Add a UI Component

### Prerequisites

<!-- FILL IN: Example:
  - Design spec or Figma link is available
  - Component fits within the existing design token system (see src/styles/tokens.ts)
  - You have read the component conventions in docs/components.md
-->

- [ ] <!-- Prerequisite 1 -->
- [ ] <!-- Prerequisite 2 -->

### Steps

<!-- FILL IN: Example for React + Tailwind:
  1. Create `src/components/<ComponentName>/<ComponentName>.tsx`
  2. Create `src/components/<ComponentName>/<ComponentName>.test.tsx`
  3. Create `src/components/<ComponentName>/index.ts` (re-export)
  4. Add Storybook story: `src/components/<ComponentName>/<ComponentName>.stories.tsx`
  5. Export from the barrel file: `src/components/index.ts`
  6. Use only design tokens from `src/styles/tokens.ts` — no hardcoded colors/sizes
-->

1. <!-- Step 1 -->
2. <!-- Step 2 -->
3. <!-- Step 3 -->
4. <!-- Step 4 -->

### Verification

```bash
# FILL IN: Example:
# pnpm storybook            — inspect visually at http://localhost:6006
# pnpm test src/components/<ComponentName>
# pnpm lint
```

### Common Pitfalls

- <!-- Pitfall 1: e.g., Inline styles bypass the design token system and cause visual drift -->
- <!-- Pitfall 2: e.g., Forgetting the index.ts barrel causes circular import issues -->
- <!-- Pitfall 3: e.g., Not adding aria-* attributes fails accessibility CI checks -->

---

## 4. Add a New Test Suite

### Prerequisites

<!-- FILL IN: Example:
  - Understand which test runner is used (Jest, Vitest, Playwright, Pytest, etc.)
  - Identify what type of test is needed (unit, integration, E2E, contract)
  - The feature or module being tested is already implemented or in-progress
-->

- [ ] <!-- Prerequisite 1 -->
- [ ] <!-- Prerequisite 2 -->

### Steps

<!-- FILL IN: Example for Vitest unit tests:
  1. Create test file adjacent to source: `src/lib/<module>/<module>.test.ts`
  2. Import from the module under test — never reach into internals
  3. Use `describe` / `it` / `expect` — see src/lib/example.test.ts for conventions
  4. Mock external dependencies with `vi.mock(...)` — do not call real APIs in unit tests
  5. Aim for: happy path, error path, and at least one edge case per exported function
  6. Run tests and confirm they pass: pnpm test src/lib/<module>
-->

1. <!-- Step 1 -->
2. <!-- Step 2 -->
3. <!-- Step 3 -->
4. <!-- Step 4 -->

### Verification

```bash
# FILL IN: Example:
# pnpm test                 — full test suite
# pnpm test:coverage        — confirm coverage thresholds are met
# pnpm test:watch           — run in watch mode during development
```

### Common Pitfalls

- <!-- Pitfall 1: e.g., Tests that depend on real environment variables fail in CI — use test env -->
- <!-- Pitfall 2: e.g., Shared mutable state between tests causes flakiness — reset state in beforeEach -->
- <!-- Pitfall 3: e.g., Testing implementation details (private methods) makes tests brittle -->

---

## 5. Add a New Dependency

### Prerequisites

<!-- FILL IN: Example:
  - You have evaluated whether the dependency is necessary (check bundle impact with bundlephobia.com)
  - You have checked the license is compatible with this project (see docs/licenses.md)
  - You have reviewed the package's security posture (check npm audit, Snyk, or OSV)
-->

- [ ] <!-- Prerequisite 1 -->
- [ ] <!-- Prerequisite 2 -->

### Steps

<!-- FILL IN: Example for pnpm:
  1. Install: pnpm add <package>
     Or dev dependency: pnpm add -D <package>
  2. Pin to a specific version if the package has a history of breaking changes
  3. Update docs/dependencies.md with: package name, purpose, chosen version, reason
  4. If it is a build dependency, verify it does not inflate the production bundle
  5. Run: pnpm audit — resolve any high/critical advisories before merging
-->

1. <!-- Step 1 -->
2. <!-- Step 2 -->
3. <!-- Step 3 -->

### Verification

```bash
# FILL IN: Example:
# pnpm audit
# pnpm build                — confirm build still passes
# pnpm test                 — confirm no regressions
```

### Common Pitfalls

- <!-- Pitfall 1: e.g., Adding a runtime dep that should be a devDependency inflates production bundle -->
- <!-- Pitfall 2: e.g., Not pinning versions leads to surprise breakage on CI -->
- <!-- Pitfall 3: e.g., Some packages ship both CJS and ESM — check for dual-module hazard -->

---

## 6. Deploy to Staging

### Prerequisites

<!-- FILL IN: Example:
  - All CI checks pass on the branch (`pnpm test`, `pnpm lint`, `pnpm build`)
  - Database migrations have been reviewed and tested locally
  - The branch has been reviewed by at least one team member
  - You have access to the staging deployment pipeline
-->

- [ ] <!-- Prerequisite 1 -->
- [ ] <!-- Prerequisite 2 -->
- [ ] <!-- Prerequisite 3 -->

### Steps

<!-- FILL IN: Example for GitHub Actions + Vercel:
  1. Push the branch to origin: git push origin <branch>
  2. Open a PR targeting `main` (or `staging` branch, per your convention)
  3. CI runs automatically — wait for all checks to pass
  4. Merge to the staging branch (or use a preview deployment URL from Vercel)
  5. Monitor the deployment in the Vercel dashboard or your CD platform
  6. Run smoke tests against the staging URL (see scripts/smoke-test.sh)
-->

1. <!-- Step 1 -->
2. <!-- Step 2 -->
3. <!-- Step 3 -->
4. <!-- Step 4 -->

### Verification

```bash
# FILL IN: Example:
# bash scripts/smoke-test.sh staging   — automated smoke tests
# curl https://staging.<your-domain>/api/health  — health check
```

### Common Pitfalls

- <!-- Pitfall 1: e.g., Staging environment variables differ from local — check .env.staging -->
- <!-- Pitfall 2: e.g., Pending migrations are not auto-applied — run them manually or via migration job -->
- <!-- Pitfall 3: e.g., Staging database is shared — destructive tests can break other developers' work -->

---

## 7. Deploy to Production

### Prerequisites

<!-- FILL IN: Example:
  - The change has been tested on staging for at least 24 hours
  - A rollback plan is documented (see section 8)
  - The deployment window is during low-traffic hours (check analytics for your traffic pattern)
  - All stakeholders have been notified if this is a significant change
  - Database migrations are backward-compatible with the current production code
-->

- [ ] <!-- Prerequisite 1 -->
- [ ] <!-- Prerequisite 2 -->
- [ ] <!-- Prerequisite 3 -->
- [ ] <!-- Prerequisite 4 -->

### Steps

<!-- FILL IN: Example:
  1. Create a GitHub Release tagging the commit: git tag v<semver> && git push --tags
  2. The release pipeline triggers automatically (see .github/workflows/deploy-prod.yml)
  3. Monitor the deployment dashboard in real time
  4. Watch error rates in Sentry / Datadog for the first 15 minutes post-deploy
  5. Run production smoke tests: bash scripts/smoke-test.sh production
  6. Announce the deployment in #deployments Slack channel
-->

1. <!-- Step 1 -->
2. <!-- Step 2 -->
3. <!-- Step 3 -->
4. <!-- Step 4 -->
5. <!-- Step 5 -->

### Verification

```bash
# FILL IN: Example:
# bash scripts/smoke-test.sh production
# curl https://<your-domain>/api/health
# — Check Sentry for new error spikes
# — Check p95 latency in your APM tool
```

### Common Pitfalls

- <!-- Pitfall 1: e.g., Deploying on Friday afternoons — incidents have no on-call coverage -->
- <!-- Pitfall 2: e.g., Not watching error rates after deploy — silent failures go undetected -->
- <!-- Pitfall 3: e.g., Feature flags not set correctly in production environment -->

---

## 8. Roll Back a Deployment

### Prerequisites

<!-- FILL IN: Example:
  - You have confirmed the current deployment is causing a production incident
  - You have identified the last known good deployment version or commit SHA
  - You have notified the on-call engineer and relevant stakeholders
-->

- [ ] <!-- Prerequisite 1 -->
- [ ] <!-- Prerequisite 2 -->

### Steps

<!-- FILL IN: Example for Vercel instant rollback:
  1. Go to the Vercel dashboard → Project → Deployments
  2. Find the last known-good deployment
  3. Click "..." → Promote to Production (instant, no rebuild required)

  Example for Docker / ECS / Kubernetes rollback:
  1. Identify the previous image tag: git log --oneline -10
  2. Update the service to use the previous image:
     kubectl set image deployment/<app> <app>=<registry>/<image>:<prev-tag>
  3. Confirm rollout: kubectl rollout status deployment/<app>

  IMPORTANT: If migrations ran with the broken deployment:
  - Do NOT automatically rollback the database
  - Assess whether the migration is compatible with the previous code
  - If not, a forward-fix (new migration) is safer than a rollback
-->

1. <!-- Step 1 -->
2. <!-- Step 2 -->
3. <!-- Step 3 -->

### Verification

```bash
# FILL IN: Example:
# bash scripts/smoke-test.sh production
# — Confirm error rates return to baseline in your APM
# — Confirm the health check returns the previous version identifier
```

### Common Pitfalls

- <!-- Pitfall 1: e.g., Rolling back code but not the migration breaks the previous schema assumptions -->
- <!-- Pitfall 2: e.g., Cache (CDN, Redis) still serves stale data from the broken deployment -->
- <!-- Pitfall 3: e.g., Third-party webhooks fired during the incident may need to be replayed -->

---

## 9. Add a New Environment Variable

### Prerequisites

<!-- FILL IN: Example:
  - You know whether the variable is a secret (API key) or a configuration value
  - You know which environments need the variable (dev, staging, prod, all)
  - You have access to the secrets manager or CI secrets configuration
-->

- [ ] <!-- Prerequisite 1 -->
- [ ] <!-- Prerequisite 2 -->

### Steps

<!-- FILL IN: Example:
  1. Add the variable to `.env.example` with a placeholder value and a comment explaining it
     DO NOT add the real value to .env.example — it is committed to git
  2. Add the variable to your local `.env` (not committed) with the real dev value
  3. Add the variable to the staging environment:
     - Vercel: Project Settings → Environment Variables
     - AWS: SSM Parameter Store or Secrets Manager
     - Doppler / 1Password Secrets Automation / your secrets manager
  4. Add the variable to the production environment (same tool, production scope)
  5. Add the variable to CI:
     - GitHub Actions: Repository Settings → Secrets and Variables → Actions
  6. Add runtime validation in `src/lib/env.ts` (or equivalent):
     Use zod or similar to parse and validate at startup — fail fast if missing
  7. Document the variable in docs/environment-variables.md
-->

1. <!-- Step 1 -->
2. <!-- Step 2 -->
3. <!-- Step 3 -->
4. <!-- Step 4 -->
5. <!-- Step 5 -->

### Verification

```bash
# FILL IN: Example:
# pnpm dev              — confirm app starts without errors
# pnpm build            — confirm build passes with new variable in env
# Check CI run passes after adding the secret to GitHub Actions
```

### Common Pitfalls

- <!-- Pitfall 1: e.g., Forgetting to add to CI secrets breaks the build pipeline -->
- <!-- Pitfall 2: e.g., Adding a NEXT_PUBLIC_ variable to .env.example exposes it in the client bundle -->
- <!-- Pitfall 3: e.g., No runtime validation means typos in var names produce silent failures -->

---

## 10. Debug a Production Issue

### Prerequisites

<!-- FILL IN: Example:
  - You have access to production logs (Datadog, Grafana, CloudWatch, etc.)
  - You have access to error tracking (Sentry, Bugsnag, etc.)
  - You have a local environment that can reproduce the issue (if applicable)
  - You have a rollback plan ready (see section 8) if the fix introduces risk
-->

- [ ] <!-- Prerequisite 1 -->
- [ ] <!-- Prerequisite 2 -->

### Steps

<!-- FILL IN: Example structured debugging process:
  1. TRIAGE — Determine scope and severity
     - What percentage of users / requests are affected?
     - Is the issue still occurring or was it a spike?
     - Which service, endpoint, or feature is involved?

  2. GATHER SIGNALS — Collect data before acting
     - Sentry: filter errors by the affected time window; look at stack traces
     - APM (Datadog/Grafana): check p95 latency, error rate, DB query time
     - Logs: grep for ERROR or WARN around the incident start time

  3. ISOLATE — Narrow down the cause
     - Was there a deployment immediately before the incident? (check deploy log)
     - Is the issue specific to one region, user segment, or data condition?
     - Reproduce locally with production-like data if possible

  4. FIX — Apply the minimum change that resolves the issue
     - Prefer a targeted fix over a large refactor in a hotfix context
     - If uncertain, roll back first (section 8), then investigate safely

  5. VERIFY — Confirm the fix works
     - Deploy to staging and run smoke tests
     - Monitor error rates for 15 minutes post-fix in production
     - Confirm affected users are no longer experiencing the issue

  6. POST-MORTEM — Document what happened
     - Timeline of events
     - Root cause
     - What was done to fix it
     - What will prevent recurrence
-->

1. <!-- Step 1 -->
2. <!-- Step 2 -->
3. <!-- Step 3 -->
4. <!-- Step 4 -->
5. <!-- Step 5 -->

### Verification

```bash
# FILL IN: Example:
# — Error rate returns to baseline in Sentry / Datadog
# — bash scripts/smoke-test.sh production passes
# — Affected users confirmed working (via support ticket or direct test)
```

### Common Pitfalls

- <!-- Pitfall 1: e.g., Acting before gathering data leads to wrong fixes and wasted time -->
- <!-- Pitfall 2: e.g., Making multiple changes at once makes it impossible to identify the root cause -->
- <!-- Pitfall 3: e.g., Skipping the post-mortem means the same issue recurs -->
- <!-- Pitfall 4: e.g., Debugging in production (console.log, test queries) can expose PII in logs -->

---

<!-- MAINTENANCE NOTE:
  This runbook is a living document. Update it whenever:
  - A procedure changes due to tooling or infrastructure updates
  - A new common pitfall is discovered during an incident
  - A step is found to be missing or incorrect during a real task
  Treat it with the same review rigor as source code.
-->
