---
description: "Kong gateway patterns: route/service ownership, auth plugins, rate limiting, and upstream contract discipline"
globs: ["kong*.yml", "kong/**/*.yml", "infra/**/*.yml", "docker-compose*.yml", "src/**/*.ts", "app/**/*.py"]
alwaysApply: false
---

# Kong Gateway — Platform Module

**Targets:** Kong Gateway, Kong declarative config
**Appended to base CLAUDE.md when Kong fronts service traffic.**

---

## Gateway Ownership

1. Treat Kong as a policy and routing surface, not a dumping ground for undocumented behavior.
2. Keep service, route, upstream, consumer, and plugin ownership explicit.

## Security and Traffic Rules

3. Authentication, authorization, rate limiting, and CORS policies should be reviewed at the gateway boundary and in the upstream service contract.
4. Do not rely on gateway plugins to compensate for missing upstream input validation or broken service-level auth semantics.
5. Keep secret material and credential issuance out of static config files.

## Change Discipline

6. Gateway config changes are shared-surface changes. Review them like API contract changes.
7. Stage route/plugin changes so rollback is clear and upstream blast radius is known.

## Observability

8. Capture request IDs, upstream latency, auth failures, and rate-limit events in a reviewable way.
