---
title: Deployment Targets
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, operator]
sdlc_category: 09-deployment
related: [docs/sdlc/09-deployment/environments.md, Dockerfile]
---

# Deployment Targets

> **TL;DR:** Single deployable artifact: a Docker image. Three target shapes — Docker Compose (single host), Kubernetes (single-pod for v1; multi-pod runway), bare Node (rare; for development / debugging). All require Postgres + a writable filesystem for logs and audit keypair.

The image is the unit of deployment. The target shape is operational preference.

---

## The image

Built from the repo-root [`Dockerfile`](../../../Dockerfile):

- **Base:** Node 20+ Alpine (minimal footprint, fast pulls).
- **User:** non-root (`uid 1000`); enforced by Dockerfile.
- **Build:** multi-stage. Stage 1 installs dev deps + builds; stage 2 copies only built output + production deps.
- **Entrypoint:** `node dist/server/start.mjs` (or `npm run start`).
- **Ports:** 3000 (MCP HTTP), 3001 (mgmt API).
- **Volumes:**
  - `/data/logs` — log file destination (`LOG_FILE_PATH=/data/logs/orchestrator.log`).
  - `/data/audit-keys` — audit signing keypair (`AUDIT_KEYPAIR_PATH=/data/audit-keys/keypair.json`).
- **Healthcheck:** `HEALTHCHECK CMD curl -f http://127.0.0.1:3001/healthz || exit 1`.

## Target 1: Docker Compose (recommended for v1)

For single-tenant single-host deployments. The `docker-compose.yml` (when committed) wires:

- `atl-mcp` — the application container.
- `postgres` — Postgres 16 with persistent volume.
- (Optional) `redis` — for BullMQ when M6+ provisioning queue is wired.

Pros:
- Simple to operate (one host, one command).
- Co-located with DB; no network policy / discovery needed.
- Easy to back up (volume snapshots).

Cons:
- Single point of failure (host or container).
- No native rolling deploy (downtime during image swap).
- Scaling is vertical only.

For v1's use case (single-tenant, single-team), Docker Compose is right.

## Target 2: Kubernetes (post-v1 / multi-team)

Deploy as a single-pod Deployment for v1 (single-tenant), or multi-pod when multi-tenant lands. Manifests not yet checked in; this section is the reference shape.

```yaml
# atl-mcp-deployment.yaml (sketch)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: atl-mcp
spec:
  replicas: 1                         # v1: 1; multi-tenant: >1 with session-affinity TBD
  template:
    spec:
      containers:
      - name: atl-mcp
        image: atl-mcp:v0.X.Y
        ports:
        - containerPort: 3000           # MCP
        - containerPort: 3001           # mgmt
        env:
        - name: DATABASE_URL
          valueFrom: { secretKeyRef: { name: atl-mcp-db, key: url } }
        - name: TOKEN_MASTER_KEY
          valueFrom: { secretKeyRef: { name: atl-mcp-secrets, key: master-key } }
        # ... other env per secrets-provisioning.md
        livenessProbe:
          httpGet: { path: /healthz, port: 3001 }
        readinessProbe:
          httpGet: { path: /readyz, port: 3001 }
        volumeMounts:
        - name: logs
          mountPath: /data/logs
        - name: audit-keys
          mountPath: /data/audit-keys
          readOnly: true
      volumes:
      - name: logs
        emptyDir: {}                    # ephemeral; ship logs out via sidecar
      - name: audit-keys
        secret:
          secretName: atl-mcp-audit-keypair
```

Pros:
- Native rolling deploy.
- Standard ops tooling (HPA, PDB, Prometheus scrape annotations).
- Multi-tenant runway is easier here.

Cons:
- More moving parts.
- Mgmt API on 3001 needs network policy to keep loopback semantics (or replace with cluster-internal NetworkPolicy).

For the single-pod v1 case: choose Docker Compose unless your team already runs k8s.

## Target 3: Bare Node (development / debugging)

`npm install && npm run build && npm start` directly on a host. Used for:

- Developer machines.
- Triage / debugging when the container is the suspect.
- Performance profiling that benefits from native node-inspector.

Not a production target.

## Common requirements across targets

| Requirement | Why |
|---|---|
| Postgres 14+ (16 preferred per ADR-0001) | Schema target |
| Persistent volume for logs | Forensic + audit retention |
| Persistent volume for audit keypair | Lose the key, lose audit verifiability |
| TLS termination in front of MCP HTTP | Required for production HTTP transport |
| Network policy: mgmt API loopback OR firewall | `MGMT_API_HOST=127.0.0.1` is the default; replace with platform-equivalent in k8s |
| Clock sync (NTP) | Audit timestamps |
| Secret manager OR equivalent | Master key + tokens not in env files |

## Image sizing

The image is small (~150 MB) — Alpine + Node deps + the build output.

Resource sizing for a v1 single-tenant deploy:

| Resource | Recommendation |
|---|---|
| CPU | 0.5 vCPU baseline; bursts to 2 during sampling / blueprint workflows |
| Memory | 512 MB baseline; up to 1 GB during context-pack generation |
| Disk (logs + audit) | 10 GB to start; plan growth at ~1 GB/month per active project |
| Network | Modest (REST + MCP); spike during webhook bursts |

These are starting points. [`../15-capacity/`](../15-capacity/) refines as benchmarks land.

## Linked artifacts

- **Image:** [`Dockerfile`](../../../Dockerfile)
- **Docker Compose** (when committed): root `docker-compose.yml`
- **Sibling docs:** [`environments.md`](environments.md), [`release-process.md`](release-process.md), [`secrets-provisioning.md`](secrets-provisioning.md), [`ci-cd.md`](ci-cd.md)
- **DR:** [`../10-dr-bcp/backup-strategy.md`](../10-dr-bcp/backup-strategy.md)
- **Capacity:** [`../15-capacity/`](../15-capacity/)
- **ADR:** [ADR-0001](../../adr/0001-pglite-for-dev.md) (pglite for dev — Postgres in prod)

---

*Last reviewed: 2026-04-25 by Chris.*
