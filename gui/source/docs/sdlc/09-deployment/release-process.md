---
title: Release Process
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, operator]
sdlc_category: 09-deployment
related: [docs/sdlc/09-deployment/ci-cd.md, docs/build-orchestration.md, docs/sdlc/09-deployment/environments.md]
---

# Release Process

> **TL;DR:** Semantic versioning. Releases gated by milestone-cumulative CI gates. Rollback is the inverse of forward — re-deploy the previous tag and run migrations in reverse if applicable. Release notes auto-derived from commit history. v0.x while pre-M6a; v1.0.0 when first shippable slice (M6a) ships.

This is the canonical release procedure. Cross-references: [`ci-cd.md`](ci-cd.md) covers the gate definitions; [`environments.md`](environments.md) covers tier semantics; [`feature-flags.md`](feature-flags.md) covers the milestone toggle conventions.

---

## Versioning scheme

**Semantic versioning** (semver.org). For atl-mcp specifically:

- **MAJOR** — breaking changes to the MCP tool surface, the storage schema (non-additive migrations), or the audit chain entry shape.
- **MINOR** — new features, additive migrations, new MCP tools.
- **PATCH** — bug fixes, doc updates, dependency bumps that don't change behavior.

Pre-1.0 (current): MINOR can include breaking changes (per semver convention for 0.x).

### Version → milestone mapping

| Version | Milestone gate |
|---|---|
| `v0.1.0` | M6a (first shippable slice) ships |
| `v0.2.0` | M7 (context resources + packs) ships |
| `v0.3.0` | M8 (readiness validation) ships |
| `v0.4.0` | M9 (agent handoff) ships |
| `v0.5.0` | M10 (webhook ingestion) ships |
| `v1.0.0` | M11 (notifications, evals, hardening) complete + production deployment proven |

PATCH bumps in between. Multiple PATCH releases per MINOR is normal.

---

## Release procedure

### Pre-flight (the day before, or hour-of for low-risk)

```bash
# 1. Confirm clean working tree
git status                              # clean
git pull --rebase                       # current

# 2. Run the full CI gate locally
npm run typecheck                       # zero errors
npm test                                # all green
npm run lint:no-stdout                  # zero violations
npm run lint                            # standard lint
npm run audit:findings                  # no new HIGH/CRITICAL

# 3. Migration rehearsal (if migrations in this release)
npm run migrate:rehearse                # against prod-shaped snapshot
```

If any of these fail, **do not proceed.** Fix, rebase, re-run.

### Tagging

```bash
# 4. Pick the version
NEW_VERSION="v0.X.Y"   # follow semver

# 5. Update package.json version
npm version "${NEW_VERSION#v}" --no-git-tag-version

# 6. Generate release notes (from commits since last tag)
git log --pretty=format:'- %s' "$(git describe --tags --abbrev=0)..HEAD" > /tmp/release-notes.txt
# Review and edit /tmp/release-notes.txt; the commit log is the input, not the output.

# 7. Commit + tag
git add package.json package-lock.json
git commit -m "release: ${NEW_VERSION}"
git tag -a "${NEW_VERSION}" -F /tmp/release-notes.txt
git push --follow-tags
```

### Build + push artifact

```bash
# 8. Build container
docker build -t "atl-mcp:${NEW_VERSION}" -t "atl-mcp:latest" .

# 9. Push to registry (platform-specific)
# docker push <registry>/atl-mcp:${NEW_VERSION}
# docker push <registry>/atl-mcp:latest
```

### Deploy

The deploy command is platform-dependent. The orchestration is the same:

1. **Stage:** apply migrations against staging DB (real schema; the rehearsal earlier used a snapshot).
2. **Promote:** point production at the new tag.
3. **Health check:** `curl /healthz`, `curl /readyz`, `curl /admin/health/audit`. Each returns 200; readyz returns the new migration version.
4. **Smoke:** invoke one read-only MCP tool against production. Confirm response shape.
5. **Verify SLOs:** check `/metrics`; confirm session success rate hasn't dropped.

### Post-flight

- Update `docs/build-orchestration.md` milestone table if a milestone closed.
- Note the release in [`../12-governance/decision-log.md`](../12-governance/decision-log.md) if the release embodies a decision worth logging.
- Resolve any tracking tickets that this release closes.

Total time, end to end, for a clean release: ~30 minutes if everything passes. Allow longer if rehearsal surfaces issues.

---

## Rollback

The inverse of forward. **Always assume the most recent operations were the cause** — don't roll back further than necessary.

### Rollback procedure

```bash
# 1. Identify the previous good tag
PREV_VERSION="$(git describe --tags --abbrev=0 HEAD~1)"

# 2. Re-deploy the previous tag
# Platform-specific: pin container image to atl-mcp:${PREV_VERSION}

# 3. If schema migrations were applied: reverse them
# Reverse-migrations are NOT auto-generated. Each migration that introduces a
# breaking change must be paired with a reverse migration in the same PR.
# If reverse not available: emergency restore from backup ([`../10-dr-bcp/backup-strategy.md`](../10-dr-bcp/backup-strategy.md)).

# 4. Health check
curl http://<host>:3001/healthz | jq
curl http://<host>:3001/readyz | jq

# 5. Audit chain integrity
node scripts/audit-verify.mjs   # M11; planned

# 6. Document the rollback as an incident
# File a postmortem per [`../14-incidents/postmortem-template.md`](../14-incidents/postmortem-template.md)
```

### What rollback DOES NOT do

- **Does not roll back the audit chain.** Audit entries during the bad release window stay; they're evidence of the operation that occurred.
- **Does not delete artifacts created during the bad window.** Jira issues / Confluence pages / VCS branches written during the rollback window remain. Cleaning them up is a separate operation (potentially manual).

### When to rollback vs. forward-fix

- **Rollback** when: the issue is widespread, root cause is unclear, or forward-fix would take > 2x rollback time.
- **Forward-fix** when: the issue is bounded, root cause is clear, and a hotfix can ship in < 30 minutes.

There's no shame in rolling back. Forward-fixing under pressure tends to introduce more bugs.

---

## Hotfix release

For an urgent bug fix that can't wait for the next normal release:

1. Branch from the affected production tag (not from main).
2. Fix the bug + add a test.
3. Bump PATCH (e.g., `v0.4.2` → `v0.4.3`).
4. Merge into the release branch AND back into main.
5. Run the full release procedure.
6. Backport to other supported tags if applicable.

For v1 single-maintainer: support exactly one production tag at a time. No backporting.

---

## Pre-release / canary

For v1: no canary — single-tenant deployment. The release process is straight-cut.

Post-v1 (multi-tenant): canary deploys are documented in [`environments.md`](environments.md). Briefly: stage to one tenant, monitor SLOs for 24h, then full rollout.

---

## What gets released

The release artifact is the Docker image. Everything else is reference:

- Source code (in git, tagged).
- Container image (in registry, tagged).
- Release notes (in git tag annotation + GitHub releases page when applicable).
- Migration scripts (in `src/storage/migrations/`, applied by the runner).

What is NOT in the release artifact:

- Configuration (env vars; deploy platform manages).
- Secrets (deploy platform manages).
- Audit signing keys (per-environment; not in source).
- Database content.

---

## Release notes shape

Each release tag has annotation that follows this shape:

```
release: v0.X.Y

Highlights
- <one-line summary of the most user-facing change>
- ...

Breaking changes (if any)
- <breaking change 1, with migration guidance>

Bug fixes
- <fix 1>
- <fix 2>

Internal
- <refactor / dependency / docs change>

Spec / ADR references
- v6 §X.Y
- ADR-NNNN
```

Auto-derived from commits, then hand-edited. Conventional commit prefixes (`feat:`, `fix:`, `docs:`, `refactor:`, `release:`) make the auto-derivation reliable.

---

## Linked artifacts

- **Spec:** v6 §28 (milestones), §32 (Definition of Done), §36 (versioning)
- **Sibling docs:** [`ci-cd.md`](ci-cd.md), [`environments.md`](environments.md), [`feature-flags.md`](feature-flags.md), [`deployment-targets.md`](deployment-targets.md), [`secrets-provisioning.md`](secrets-provisioning.md)
- **Build sequence:** [`../../build-orchestration.md`](../../build-orchestration.md)
- **DR for failed releases:** [`../10-dr-bcp/`](../10-dr-bcp/)
- **Incident framework:** [`../14-incidents/postmortem-template.md`](../14-incidents/postmortem-template.md)
- **Code:** `package.json`, `Dockerfile`, `src/storage/migrationRunner.ts`

---

*Last reviewed: 2026-04-25 by Chris.*
