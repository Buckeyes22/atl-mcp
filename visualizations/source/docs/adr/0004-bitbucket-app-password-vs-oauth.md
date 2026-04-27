---
status: accepted
date: 2026-04-25
deciders: [orchestrator-team]
consulted: []
informed: [build-agents]
---

# 0004. Bitbucket Cloud auth: app password by default; OAuth 2.0 deferred

## Context

v6 §3 designates Bitbucket Cloud as the v1 VCS target. Bitbucket Cloud supports three auth modes for REST 2.0:

1. **App passwords** — per-user, scoped permissions, Basic auth `username:app_password`. Simple to set up; user-bound (app password is owned by a user account, not a workspace).
2. **OAuth 2.0** — three-legged or two-legged. Better for multi-user / SaaS deployments. Requires registering an OAuth consumer in the workspace and running an authorization-code flow.
3. **Repository / project / workspace access tokens** — newer; scoped to a single resource. Limited to specific use cases (CI/CD).

Same shape of decision as the Atlassian auth question (ADR for OAuth was effectively deferred there too). M3 ships the VCS provider; the first deployment uses single-user creds for simplicity.

## Decision Drivers

- M3 acceptance bar: contract tests pass against fixtures; interface accommodates GitHub/GitLab swaps. The acceptance bar does not specify auth mode.
- v1 deployment shape is single-tenant single-operator (v6 §3 + §7.3). Multi-user OAuth comes with multi-tenant SaaS later.
- App password is the lowest-friction path to a working real-Bitbucket smoke test — operator generates one in BB UI, drops it in `.env`, done.
- OAuth would require building an authorization-code bootstrap CLI (the same shape as the deferred Atlassian OAuth bootstrap noted in M2), an HTTP callback handler, refresh-token rotation logic, and persistence — ~1 day of work that doesn't move v1 closer to its first shippable slice (M6a).

## Considered Options

1. **App password (default)** — user creates an app password in Bitbucket → drop in `.env` as `BITBUCKET_APP_PASSWORD` + `BITBUCKET_USERNAME`. Provider uses Basic auth. Single env-var swap to rotate.
2. **OAuth 2.0** — build full bootstrap + refresh + persistence. Required for multi-user SaaS but overshoots v1 scope.
3. **Repository access tokens** — narrower scope (good security posture) but limited to per-repo grants; doesn't support cross-repo discovery operations cleanly. Possibly post-v1.

## Decision Outcome

**Adopt app password as the v1 default.** `createBitbucketAppPasswordAuth({ username, appPassword })` is the only auth implementation in M3. The `BitbucketAuth` interface is intentionally narrow so an OAuth implementation can swap in without changing `bitbucketRestProvider`.

The provider config takes the auth as an injected dependency:
```ts
createBitbucketRestProvider({ auth, logger, ... });
```

When OAuth becomes necessary (post-v1 or when first SaaS deployment lands), add `createBitbucketOAuth2Auth(...)` mirroring the shape of `createOAuth3loAuth` from `src/providers/atlassian/auth/oauth3lo.ts`. The existing refresh-token rotation pattern transfers; the only Bitbucket-specific bits are the token endpoint URL and the response field names.

## Consequences

### Good

- Real-Bitbucket smoke test is an env-var swap away. No bootstrap CLI required for v1.
- Same shape as the Atlassian API token auth — consistent operator UX across providers.
- App password fingerprint (sha256 first 8 hex) participates in actor-attribution audit chain (M6a) without modification.

### Bad

- App passwords are user-bound. If the user who minted the password leaves the org, the password breaks. Mitigation: use a service-account user for production deployments (Bitbucket workspace admins can create one).
- App passwords don't support fine-grained per-resource scoping the way newer access tokens do. Mitigation: pick the narrowest scopes when minting (Repositories: Write + Pull Requests: Write are enough for v6 §13's needs).
- Multi-user deployments (post-v1) need OAuth or the user must share creds, which is a non-starter. Mitigation: this ADR is revisited when multi-tenant SaaS work begins.

### Neutral

- The `BitbucketAuth` interface is the seam. Any future auth mode (OAuth, access tokens, JWT) implements the same interface; the provider doesn't change.

## More Information

- v6 §3 (Bitbucket Cloud is v1 VCS target).
- v6 §28 M3 acceptance.
- `src/providers/vcs/bitbucket/auth/appPassword.ts` — implementation.
- `src/providers/vcs/bitbucket/bitbucketRestProvider.ts` — provider that consumes the auth.
- ADR 0004 sibling: the deferred Atlassian OAuth bootstrap CLI follows the same pattern; both will land together when first OAuth-required deployment is configured.
