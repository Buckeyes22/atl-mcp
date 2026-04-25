# Partner Integration: open-edison

## 1. Why this partner

**Category: B (pattern-lift).** open-edison is a Python MCP security middleware (FastMCP on port 3000 / FastAPI mgmt on port 3001) contributing 4 patterns to v6:

- **F-126**: Lethal trifecta + PUBLIC/PRIVATE/SECRET ACL ranking + wildcard permission JSON → §38.1, §38.2, §10 (`AclEntry.classification`)
- **F-128**: OTel counters template (tool_calls_total / tool_calls_blocked_total / private_data_access / untrusted_public_data / write_operation) → §27.2
- **F-129**: Install-unique deaggregation ID + opt-out telemetry → §27.3
- **F-130**: Dual-port architecture (MCP 3000 / mgmt API 3001) → §22.2

**Gap closed**: v6 §38.1 names the lethal trifecta (private data + untrusted exposure + external comms) as the foundational safety check; §22.2 mandates dual-port; §27.2 needs a counter template. open-edison delivers all three with session tracking, wildcard ACL composition, and OTel observability.

**Alternatives considered**: build safety gates in-house (rejected — months of work); use FastAPI without dual-port (rejected — §22.2 mandates separation); add OTel post-v1 (rejected — F-128 shows non-trivial; open-edison vectors it cleanly).

Findings reference: `repo-extraction-findings.md` lines 633–645, §40 F-126, F-128, F-129, F-130.

## 2. Prerequisites

N/A — pattern-lift. The orchestrator implements equivalent patterns in TS (`@opentelemetry/api` for counters; Express/Fastify for dual-port). If choosing to vendor open-edison as a sidecar gateway: Python 3.10+, FastAPI 0.104+, SQLAlchemy 2.0+ (becomes Category A then).

## 3. Source provenance

`open-edison` (Python, GPLv3). Pin commit SHA in v6 §40 F-126/F-128/F-129/F-130 rows. **No install required for pattern-lift**: implement equivalent middleware in `src/security/`. If vendoring, run as standalone gateway and connect via HTTP.

## 4. Configuration

### 4.1 Environment variables

N/A for pattern-lift; if vendoring as sidecar, extend v6 §20:

| Var | Required | Default | Notes |
|---|---|---|---|
| `EDISON_ENABLED` | No | `false` | Master switch |
| `EDISON_MCP_URL` | Yes (if enabled) | `http://localhost:3000` | MCP gateway port |
| `EDISON_MGMT_URL` | Yes (if enabled) | `http://localhost:3001` | Mgmt API port |
| `EDISON_ACL_MODE` | No | `enforce` | `enforce` blocks; `warn` logs only |
| `EDISON_OTEL_ENABLED` | No | `true` | OTel counter export |
| `EDISON_DEAGG_ID` | Auto | `<128bit hash>` | Install-unique deaggregation ID |
| `EDISON_OPT_OUT_TELEMETRY` | No | `false` | Disables export; audit logging continues |

### 4.2 Config file overlays

```yaml
security:
  accessGate:
    lethalTrifectaDetection: true
    aclMode: enforce            # enforce | warn
  acl:
    classifications: [PUBLIC, PRIVATE, SECRET]
    wildcardSupport: true
    permissionsFile: src/permissions.json

observability:
  otel:
    counters:
      - tool_calls_total
      - tool_calls_blocked_total
      - private_data_access_calls_total
      - untrusted_public_data_calls_total
      - write_operation_calls_total
    deaggregationId: ${EDISON_DEAGG_ID}
    optOutTelemetry: false

server:
  dualPort:
    mcpPort: 3000
    mgmtPort: 3001
    mgmtBindAddress: 127.0.0.1   # internal only
```

## 5. Adoption points in v6

- **F-126** → **§38.1** (lethal trifecta detection: 3 flags `has_private_data_access`, `has_untrusted_content_exposure`, `has_external_communication`; if all true → BLOCKED) + **§38.2** (PUBLIC/PRIVATE/SECRET ACL ranking + wildcard `filesystem/*` permission patterns) + **§10** (`AclEntry.classification` enum)
- **F-128** → **§27.2** (5 OTel counter template: `tool_calls_total{tool, result}`, `tool_calls_blocked_total{tool, reason}`, `private_data_access_calls_total{user, data_class}`, `untrusted_public_data_calls_total{source}`, `write_operation_calls_total{tool}`)
- **F-129** → **§27.3** (install-unique deaggregation ID: 128-bit hash of hostname+install_ts+random_seed; persisted to `.orchestrator/deagg_id`; tags all OTel exports; opt-out flag suppresses export but keeps audit hashing)
- **F-130** → **§22.2** (dual-port architecture: MCP on 3000 — auth required; mgmt API on 3001 — internal only; ports do not share session state)

## 6. Pattern excerpts

**Lethal trifecta detector** (`src/security/lethalTrifecta.ts`):
```ts
interface LethalTrifecta {
  has_private_data_access: boolean;
  has_untrusted_content_exposure: boolean;
  has_external_communication: boolean;
}
function isLethal(t: LethalTrifecta): boolean {
  return t.has_private_data_access && t.has_untrusted_content_exposure && t.has_external_communication;
}
```

**ACL classification enum** (`src/auth/aclClassification.ts`):
```ts
export enum AclClassification { PUBLIC = 0, PRIVATE = 1, SECRET = 2 }

export interface ToolPermission {
  pattern: string;                   // wildcard, e.g., "filesystem/*"
  classification: AclClassification;
  requiresApproval?: boolean;
}
```

**OTel counters** (`src/observability/counters.ts`):
```ts
import { metrics } from "@opentelemetry/api";
const meter = metrics.getMeter("orchestrator");
export const counters = {
  tool_calls_total:                meter.createCounter("tool_calls_total"),
  tool_calls_blocked_total:        meter.createCounter("tool_calls_blocked_total"),
  private_data_access_calls_total: meter.createCounter("private_data_access_calls_total"),
  untrusted_public_data_total:     meter.createCounter("untrusted_public_data_calls_total"),
  write_operation_total:           meter.createCounter("write_operation_calls_total"),
};
```

**Deaggregation ID** (`src/observability/deaggId.ts`):
```ts
import { createHash, randomBytes } from "node:crypto";
function generateDeaggId(): string {
  return createHash("sha256")
    .update(`${os.hostname()}:${Date.now()}:${randomBytes(16).toString("hex")}`)
    .digest("hex").slice(0, 32);    // 128 bits hex
}
```

**Dual-port bootstrap** (`src/server/dualPort.ts`):
```ts
const mcpServer = createMcpServer({ port: 3000, auth: true });
const mgmtServer = createMgmtServer({ port: 3001, bindAddress: "127.0.0.1" });
await Promise.all([mcpServer.listen(), mgmtServer.listen()]);
```

## 7. Gotchas

1. **Lethal-trifecta false-negatives**: the 3 flags are set by middleware that infers state from tool calls + response content. A tool that silently leaks private data without setting the flag is not caught. Mitigation: pair with explicit tool-output content scanning, or mark known-leaky tools as BLOCKED in the ACL. (findings.md L635; F-126)
2. **ACL classification escalation rules are strict**: a PRIVATE tool cannot be downgraded to PUBLIC by request context. If an ACL entry has a bug (PUBLIC when it should be PRIVATE), classification sticks until permissions.json updated and gateway restarted. CI-gate audit permissions.json changes. (findings.md L636; F-126)
3. **OTel counter cardinality blowup**: unbounded label dimensions (`tool` × `user` × `data_class`) explode series count. Configure OTEL_EXPORTER_OTLP_HEADERS for sampling, or post-aggregate in Prometheus. (findings.md L638; F-128)
4. **Deaggregation ID fingerprinting risk**: derived from hostname + ts + seed. If adversary reads `.orchestrator/deagg_id`, they correlate telemetry across deployments. Secure file with mode 0600; do not log cleartext; export only to trusted OTel Collector. (findings.md L640; F-129)
5. **Dual-port firewall rules**: port 3000 must be reachable; port 3001 must NOT be internet-accessible. If both behind NAT/proxy, restrict mgmt to localhost or private network only. Compromised mgmt endpoint exposes session logs + counter data. (findings.md L634; F-130)

## 8. Validation

```bash
# 1. Verify §38.1 cites lethal trifecta
grep -n "lethal trifecta\|has_private_data_access\|has_untrusted" agent-context-orchestrator-mcp-plan-v6.md | head -5

# 2. Verify §22.2 documents dual-port
grep -nE "dual.port|3000.*3001|mgmtPort" agent-context-orchestrator-mcp-plan-v6.md | head -5

# 3. Verify §27.2 enumerates 5 counter names
for c in tool_calls_total tool_calls_blocked_total private_data_access_calls_total \
         untrusted_public_data_calls_total write_operation_calls_total; do
  grep -q "$c" agent-context-orchestrator-mcp-plan-v6.md && echo "ok $c" || echo "missing $c"
done

# 4. ACL classification test
orchestrator cli acl test --tool send_email --user testuser
# Expect: PRIVATE classification with appropriate gate decision

# 5. Lethal-trifecta smoke
orchestrator cli security lethal-trifecta-test --private-data --untrusted --external
# Expect: BLOCKED with reason="lethal_trifecta"
```

## 9. Operational concerns

- **Upstream archival risk: low.** Pattern-lift implementations are independent of open-edison's Python codebase. If open-edison is abandoned, in-tree TS implementations continue.
- **In-tree absorption**: `src/security/lethalTrifecta.ts`, `src/auth/aclClassification.ts`, `src/observability/counters.ts`, `src/observability/deaggId.ts`, `src/server/dualPort.ts`, `src/permissions.json`.
- **Promotion to Category A** (vendoring open-edison as sidecar gateway): valid v2 path if Python sidecar fits deployment topology; orchestrator just becomes an HTTP client to ports 3000/3001.
- **Ownership**: orchestrator team owns implementation + permissions.json; security team reviews ACL changes.
- **Cost management**: OTel counter export low-cost; opt-out via `EDISON_OPT_OUT_TELEMETRY=true` for compliance-heavy deployments.
- **Disaster recovery**: deagg_id regenerable (new ID on next boot if file lost; do not commit). Permissions.json git-tracked.
