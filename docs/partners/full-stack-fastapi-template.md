# Partner Integration: full-stack-fastapi-template

## 1. Why this partner

**Category: B (pattern-lift).** full-stack-fastapi-template (Tiangolo) demonstrates two production-grade patterns:

- **F-152**: Sentry conditional init by environment **AND** Traefik dynamic discovery + constraint labels → §22.3 (Traefik), §27.1 (Sentry)

**Sibling note**: F-151 (OpenAPI codegen via `hey-api/openapi-ts`) is **Skipped-with-reason** in §40. The orchestrator's REST admin API uses manual TypeScript definitions; codegen revisited post-v1.

**Gap closed**: v6 §22.3 needs production-grade routing with automatic service discovery for multi-replica or sidecar deployments (Postgres, Redis, Qdrant). Traefik constraint-label pattern avoids hardcoded URLs. v6 §27.1 specifies Sentry for unhandled errors in production; conditional-init prevents dev environments from flooding shared Sentry projects.

Findings reference: `repo-extraction-findings.md` line 980, §40 F-151 (skipped), F-152 (integrated).

## 2. Prerequisites

N/A — pattern-lift. Sentry SDK + Traefik installed separately:
- `@sentry/node` + `@sentry/tracing` (npm dependency).
- Traefik gateway (Docker container or standalone binary).
- Docker + docker-compose for compose-based deployment.

## 3. Source provenance

`full-stack-fastapi-template` (Tiangolo, public). Pin commit SHA in v6 §40 F-152 row for audit traceability. **No install required**; do NOT vendor or git-submodule the template into orchestrator. Extract patterns from `docker-compose.yml` (Traefik labels) and `backend/app/core/config.py` (Sentry conditional init).

## 4. Configuration

### 4.1 Environment variables

| Var | Required | Default | Notes |
|---|---|---|---|
| `SENTRY_DSN` | No | — | Skip to disable Sentry entirely |
| `SENTRY_ENV` | No | — | dev / staging / production — Sentry init only on staging+production |
| `TRAEFIK_CONSTRAINT_LABELS` | No | `app=orchestrator` | Docker label constraint for Traefik discovery |

### 4.2 Config file overlays

```yaml
observability:
  sentry:
    enabled: ${SENTRY_DSN:-false}
    dsn: ${SENTRY_DSN}
    environment: ${SENTRY_ENV}
    initOnly: [staging, production]   # Sentry init only in these envs
    tracesSampleRate: 0.1

deployment:
  traefik:
    enabled: true
    constraintLabels:
      app: ${TRAEFIK_CONSTRAINT_LABELS:-orchestrator}
    dynamicDiscoveryEnabled: true
```

## 5. Adoption points in v6

- **F-152** → **§22.3** (Traefik dynamic service discovery + constraint labels: docker-compose labels register routes; constraints isolate replicas by deployment tier — staging vs production — on shared Swarm/Kubernetes) + **§27.1** (Sentry conditional init by environment: skip in dev/test, enable only when `SENTRY_ENV ∈ {staging, production}`)

## 6. Pattern excerpts

**Sentry conditional init** (`src/observability/sentry.ts`):
```ts
import * as Sentry from "@sentry/node";

export function initSentry(config: Config): void {
  const shouldInit = config.sentry.enabled &&
                     config.sentry.initOnly.includes(config.sentry.environment);
  if (!shouldInit) {
    console.log(`Sentry disabled: env=${config.sentry.environment} not in [${config.sentry.initOnly.join(", ")}]`);
    return;
  }
  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.sentry.environment,
    tracesSampleRate: config.sentry.tracesSampleRate,
  });
}
```

**Traefik discovery labels** (`docker-compose.yml`):
```yaml
services:
  orchestrator:
    image: orchestrator:${IMAGE_TAG}
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.orchestrator.rule=Host(`api.example.com`)"
      - "traefik.http.routers.orchestrator.service=orchestrator"
      - "traefik.http.services.orchestrator.loadbalancer.server.port=3000"
      - "app=orchestrator"               # constraint label
    deploy:
      placement:
        constraints:
          - node.labels.tier == staging   # or production
```

## 7. Gotchas

1. **Sentry init in test environments leaks events to production DSN.** If `SENTRY_ENV` missing or misconfigured and Sentry enabled, every test exception is sent. Always set `SENTRY_ENV` explicitly + include in `initOnly` allowlist. Smoke-test: `SENTRY_DSN=fake SENTRY_ENV=test npm start` — verify Sentry NOT initialized. (findings.md L980; F-152)
2. **Traefik label syntax errors silently drop routes.** A typo in `traefik.http.services.orchestrator.loadbalancer.server.port` does not error; Traefik logs misconfig in its own logs, not orchestrator's. After compose up, run `curl -s http://localhost:8081/api/http/routers | jq` to verify routes registered. (findings.md L980; F-152)
3. **Constraint-label scope collisions on shared clusters.** If multiple teams deploy with `app=orchestrator`, Traefik may route to wrong instance. Scope labels uniquely (`app=orchestrator-team-foo`) or use distinct Traefik instances per team. (findings.md L980; F-152)
4. **OpenAPI codegen explicitly skipped (F-151).** Orchestrator's REST admin API does NOT use `hey-api/openapi-ts` or similar. Manual TS definitions in `src/admin/api.ts` preferred for v1 to avoid schema-source-of-truth ambiguity. Post-v1, revisit if API stability warrants auto-generation. (findings.md L980; F-151 status: Skipped-with-reason)

## 8. Validation

```bash
# 1. Sentry conditional init: dev → disabled
SENTRY_DSN=https://fake@sentry.io/1 SENTRY_ENV=dev npm start
# Expect: log "Sentry disabled: env=dev not in [staging, production]"

# 2. Sentry conditional init: staging → enabled
SENTRY_DSN=https://fake@sentry.io/1 SENTRY_ENV=staging npm start
# Expect: log "Sentry enabled" (or successful init)

# 3. Traefik route registration
docker-compose up -d
curl -s http://localhost:8081/api/http/routers | jq '.[] | select(.name | contains("orchestrator"))'
# Expect: JSON entry with rule + service name

# 4. Verify §22.3 + §27.1 reference these patterns
grep -nE "Traefik|constraint.label|Sentry.*conditional|environment.*init" agent-context-orchestrator-mcp-plan-v6.md | head -10
```

## 9. Operational concerns

- **Upstream archival risk: low.** full-stack-fastapi-template is Tiangolo's well-maintained canonical template. Patterns (env-conditional Sentry, Traefik labels) are stable across FastAPI/Sentry/Traefik ecosystems. Patterns portable to any Docker-based deployment; no template-repo dependency.
- **In-tree absorption**: Sentry init in `src/observability/sentry.ts`; Traefik labels in `docker-compose.yml` + `deploy/traefik/`.
- **Version pinning**: pin `@sentry/node` + `@sentry/tracing` to specific npm versions; major Sentry versions may change DSN format. F-152 SHA in §40 is reference only; do not version-lock the template in lockfiles.
- **Cost management**: Sentry has monthly event quotas. Set quota alerts in sentry.io. Lower `tracesSampleRate` (default 0.1 = 10%) if approaching limit.
- **Promotion**: not applicable — orchestrator owns Sentry + Traefik integration.
- **Disaster recovery**: Sentry DSN is a credential — rotate quarterly. Traefik state is ephemeral (regenerated from labels on startup).
