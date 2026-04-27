---
description: "MCP gateway governance: tool allowlisting, RBAC, audit logging, version pinning, trust evaluation"
globs: ["mcp.config.*", ".claude/settings.json", ".codex/config.toml", "tools/registry.json", "tools/mcp-allowlist.json", "tools/mcp-remote-policy.json"]
alwaysApply: false
---

# MCP Gateway Governance — Stack Module

**Targets:** MCP SDK (@modelcontextprotocol/sdk) latest, multi-agent deployments, gateway-managed environments
**Appended to base CLAUDE.md when operating MCP servers under governance controls.**

Companion governance artifact:
- `tools/mcp-allowlist.json` — trust, provenance, and version allowlist for every server
- `tools/mcp-remote-policy.json` — required when any MCP server crosses the network; records gateway, auth, and capability policy for remote HTTP/SSE/streamable deployments

---

## Tool Allowlisting

1. Maintain an explicit allowlist of approved MCP servers in `tools/mcp-allowlist.json`. No agent may connect to an MCP server not present in the allowlist. The allowlist is the single source of truth for which servers are permitted in any environment. Every entry must include provenance metadata (who approved it, when, at what trust level, and where the trust review lives) plus at least one pinned provenance signal (`sha256`, `integrity`, or `source_ref`):

```json
{
  "version": "1.0.0",
  "servers": [
    {
      "name": "github-mcp",
      "url": "https://gateway.example.com/mcp/github",
      "version": "1.2.3",
      "sha256": "abc123def456789abcdef0123456789abcdef0123456789abcdef0123456789a",
      "approved_by": "security-team",
      "approved_date": "2026-02-28",
      "trust_level": "verified",
      "trust_review": "tools/trust-reviews/github-mcp.md"
    },
    {
      "name": "context7",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@2.1.4"],
      "version": "2.1.4",
      "integrity": "sha512-...",
      "approved_by": "platform-team",
      "approved_date": "2026-03-12",
      "trust_level": "sandboxed",
      "trust_review": "tools/trust-reviews/context7.md"
    },
    {
      "name": "daem0nmcp",
      "transport": "stdio",
      "command": "python3",
      "args": ["-m", "daem0nmcp.server"],
      "version": "6.6.6",
      "source_ref": "6084416c532c743b7f5f3f3e915459f26f528140",
      "approved_by": "platform-team",
      "approved_date": "2026-03-12",
      "trust_level": "experimental",
      "trust_review": "tools/trust-reviews/daem0nmcp.md"
    }
  ]
}
```

Valid `trust_level` values are: `verified` (fully audited, trusted maintainer), `sandboxed` (approved but must run in a sandbox), `experimental` (dev/staging only, never production). Agents must refuse to connect to any server not in this file. CI pipelines should validate that deployed configurations reference only allowlisted servers.

For project-local stdio servers, the allowlist is not just a name registry. The configured client entry must match the reviewed `command` and `args` tuple exactly across the live Claude, Codex, and VS Code MCP surfaces. If a project-local config points `codebase-memory-mcp` or another allowlisted name at a different wrapper, binary, or argument set, treat that as policy drift and fail the security gate until the allowlist/trust review is updated. The framework-managed configurators also normalize stale remote-style entries back to the reviewed local contract instead of preserving a mismatched `type`, `url`, or stale launcher. GitHub coding-agent handoff artifacts may use a different reviewed launcher contract when the framework provisions a wrapper during setup, but that launcher contract must still match the reviewed framework registry for managed servers or the reviewed allowlist contract for non-managed local servers.

## Version Pinning

2. Pin MCP server versions by exact version number and pinned provenance metadata in the allowlist. Never use `latest`, `stable`, or any floating tag in production deployments. Depending on the distribution channel, the provenance field may be a container/image digest (`sha256`), registry integrity string (`integrity`), or reviewed source commit/reference (`source_ref`). Floating tags create non-reproducible environments and allow supply-chain attacks to propagate silently:

```dockerfile
# WRONG — floating tag, non-reproducible
FROM modelcontextprotocol/github-server:latest

# CORRECT — pinned version with digest verification
FROM modelcontextprotocol/github-server:1.2.3@sha256:abc123def456789abcdef0123456789abcdef0123456789abcdef0123456789a
```

When updating a pinned version, follow this sequence: (1) pull the new image or package in a staging environment, (2) capture the relevant provenance signal for that channel, (3) run the trust evaluation checklist (Rule 5), (4) update the allowlist entry with the new version, provenance, and approval date, (5) deploy to production. Never skip the staging verification step.

Remote MCP clients must also obey the remote-policy contract consistently across all managed client surfaces, including `.claude/settings.json`, `.codex/config.toml`, `.vscode/mcp.json`, and any GitHub coding-agent handoff artifacts. Do not assume Codex or GitHub surfaces are exempt from the same transport, TLS, and header rules enforced elsewhere.

## RBAC Configuration

3. Define tool access policies per agent role. Map roles to the framework's agent boundary table (CLAUDE.md Section 1b). Architect agents receive broader tool access for planning and analysis. Implementer agents receive scoped access limited to their task domain. Reviewer agents get read-only tool access. Store role-to-tool mappings in the gateway configuration:

```json
{
  "roles": {
    "architect": {
      "description": "Planning and system design agent",
      "allowed_tools": ["*"],
      "denied_tools": ["deploy_production", "delete_database"],
      "max_concurrent_calls": 10
    },
    "implementer": {
      "description": "Code implementation agent scoped to assigned files",
      "allowed_tools": [
        "read_file",
        "write_file",
        "query_database",
        "run_tests",
        "search_code"
      ],
      "denied_tools": ["modify_schema", "deploy_*"],
      "max_concurrent_calls": 5
    },
    "reviewer": {
      "description": "Code review and analysis agent",
      "allowed_tools": [
        "read_file",
        "search_code",
        "query_database",
        "list_resources"
      ],
      "denied_tools": ["write_file", "delete_*", "deploy_*"],
      "max_concurrent_calls": 3
    }
  }
}
```

The gateway enforces RBAC at the proxy layer before forwarding requests to MCP servers. An agent's role is determined by its authentication token. Wildcard patterns (`*`) in `denied_tools` take precedence over wildcards in `allowed_tools` — deny rules always win.

## Audit Logging

4. All tool invocations routed through the gateway must produce a structured audit log entry. Log the timestamp, agent identity, tool name, a hash of the input (never the full input, which may contain secrets or PII), the result status, and the call duration. Audit logs are append-only and must be shipped to a centralized log store:

```json
{
  "timestamp": "2026-02-28T14:32:01.445Z",
  "agent_id": "implementer-agent-7b3c",
  "agent_role": "implementer",
  "server_name": "github-mcp",
  "tool_name": "create_pull_request",
  "input_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "result_status": "success",
  "error_code": null,
  "duration_ms": 1243,
  "request_id": "req-a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

Critical requirements for audit logs:
- Never log raw tool inputs — they may contain API keys, tokens, database credentials, or user data. Log only the sha256 hash of the serialized input.
- Never log raw tool outputs for tools that return sensitive data. Log the result status and byte length only.
- Retain audit logs for a minimum of 90 days.
- Alert on anomalies: unusual tool call volume, calls to denied tools, repeated authentication failures, or calls from unrecognized agent IDs.

## Trust Evaluation

5. Before adding any MCP server to the allowlist, complete the following trust evaluation checklist. All items must be reviewed and documented. Store completed evaluations in `tools/trust-reviews/`. The framework-managed default is a stable path such as `tools/trust-reviews/context7.md`; if you prefer dated archives, keep the stable file as the current approved review and link out to dated history from there.

```markdown
## Trust Evaluation: [server-name] v[version]
Date: YYYY-MM-DD
Reviewer: [name/team]

### Provenance
- [ ] Maintainer identity verified (organization or known individual)
- [ ] Source repository is public and auditable
- [ ] Repository has a security policy (SECURITY.md) or responsible disclosure process

### Code Quality
- [ ] Last commit within 90 days (not abandoned)
- [ ] No known unpatched CVEs in the server or its direct dependencies
- [ ] Dependency tree reviewed — no typosquatting or suspicious packages
- [ ] License is compatible with project requirements (MIT, Apache 2.0, etc.)

### Runtime Safety
- [ ] Server supports sandboxed execution (no root requirement)
- [ ] Network access requirements are documented and minimal
- [ ] Filesystem access is scoped (no unrestricted read/write)
- [ ] Resource consumption is bounded (memory, CPU, disk)

### Supply Chain
- [ ] Package is published to official registry (npm, PyPI, Docker Hub official)
- [ ] Build provenance is verifiable (signed releases, reproducible builds)
- [ ] Number of maintainers > 1 (bus factor check)
- [ ] Download/usage statistics indicate community adoption

### Decision
- [ ] APPROVED — trust_level: [verified | sandboxed | experimental]
- [ ] REJECTED — reason: [documented reason]
```

Do not bypass this checklist for "well-known" servers. Supply-chain compromises often target popular packages precisely because teams skip review.

## Gateway-First Architecture

6. In multi-agent deployments, all MCP tool access must route through the governance gateway. Direct agent-to-MCP-server connections are prohibited because they bypass RBAC enforcement, audit logging, rate limiting, and credential isolation. The gateway is the single enforcement point for all governance policies:

```
+------------------+
|  Architect Agent  |---+
+------------------+   |
                        |    +-------------------+    +------------------+
+------------------+   +--->|  MCP Governance   |--->|  GitHub MCP      |
|  Implementer     |---+--->|  Gateway          |--->|  Filesystem MCP  |
|  Agent           |   |    |                   |--->|  Database MCP    |
+------------------+   |    |  - RBAC           |    +------------------+
                        |    |  - Audit Log      |
+------------------+   |    |  - Rate Limit     |
|  Reviewer Agent  |---+    |  - Credential Mgmt|
+------------------+        +-------------------+
```

The gateway validates every request against the RBAC policy (Rule 3), logs the invocation (Rule 4), verifies the target server is on the allowlist (Rule 1), and injects credentials (Rule 7) before forwarding. Agents never hold MCP server credentials directly. If the gateway is unavailable, agents must fail closed — they do not fall back to direct connections.

## Credential Isolation

7. MCP server credentials (API keys, OAuth tokens, service account keys) are stored exclusively in the gateway's secret store, never in individual agent configurations. Agents authenticate to the gateway using short-lived, scoped tokens. The gateway authenticates to MCP servers on behalf of the agent using the stored credentials:

```yaml
# gateway-config.yaml — credentials section (stored in vault, not in repo)
credentials:
  github-mcp:
    type: "oauth2"
    token_ref: "vault://secrets/mcp/github-token"
    scopes: ["repo", "read:org"]
    rotate_interval: "24h"
  database-mcp:
    type: "api_key"
    key_ref: "vault://secrets/mcp/database-key"
    rotate_interval: "7d"

# Agent config — NO credentials, only gateway endpoint
agent:
  gateway_url: "https://gateway.internal.example.com/mcp"
  auth:
    type: "jwt"
    issuer: "https://auth.internal.example.com"
    audience: "mcp-gateway"
    token_ttl: "15m"
```

Credential isolation provides three guarantees: (1) a compromised agent cannot exfiltrate long-lived API keys because it never possesses them, (2) credential rotation happens in one place (the gateway) rather than across all agent configurations, (3) audit logs tie tool usage to agent identity, not to the underlying service credential.

## Sandbox Requirements

8. MCP servers that execute code, modify the filesystem, or spawn subprocesses must run in sandboxed containers with strict resource limits. Servers with `trust_level: sandboxed` in the allowlist must meet all of the following requirements at deployment time:

```yaml
# docker-compose.yaml — sandboxed MCP server example
services:
  filesystem-mcp:
    image: modelcontextprotocol/filesystem-server:0.9.1@sha256:def456...
    read_only: true
    user: "65534:65534"  # nobody:nogroup — non-root
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: "0.5"
        reservations:
          memory: 64M
    tmpfs:
      - /tmp:size=50M,noexec
    networks:
      - mcp-internal
    volumes:
      - type: bind
        source: /data/workspace
        target: /workspace
        read_only: false  # only if write access is required by the tool

networks:
  mcp-internal:
    internal: true  # no external network access unless explicitly required
```

Mandatory sandbox constraints:
- `read_only: true` root filesystem — prevent modification of server binaries at runtime.
- `user: "65534:65534"` — run as non-root (nobody). Never run MCP servers as root.
- `cap_drop: ALL` — drop all Linux capabilities. Add back only what is explicitly needed.
- `no-new-privileges` — prevent privilege escalation via setuid binaries.
- Memory limit enforced — prevent a runaway server from consuming host memory.
- Network isolation — `internal: true` network by default. Only grant external network access for servers that require it (e.g., GitHub API calls), and document why.

## Transport Security

9. All MCP connections in production must use TLS. Stdio transport is acceptable for agent-launched local servers where the agent spawns the server as a subprocess (no network involved). HTTP without TLS is acceptable only when both the client and server are on localhost (development environments). For any network-crossing MCP connection, enforce TLS 1.2 or higher:

```nginx
# nginx reverse-proxy for MCP server TLS termination
upstream mcp_gateway {
    server 127.0.0.1:3100;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name gateway.internal.example.com;

    ssl_certificate     /etc/ssl/certs/mcp-gateway.crt;
    ssl_certificate_key /etc/ssl/private/mcp-gateway.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;
    ssl_session_timeout 1d;
    ssl_session_cache   shared:MCP:10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;

    location /mcp/ {
        proxy_pass http://mcp_gateway/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts for long-running tool calls
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

For SSE (Server-Sent Events) transport used by some MCP clients, ensure the proxy does not buffer responses (`proxy_buffering off;`) and supports long-lived connections. For WebSocket-based transports, the `Upgrade` and `Connection` headers shown above are required.

## Supply Chain Review

10. When adopting a new MCP server, perform a full supply chain review before it reaches the allowlist. This review complements the trust evaluation (Rule 5) with deeper technical analysis of the server's dependency tree and build pipeline:

```bash
# 1. Clone and inspect the source repository
git clone https://github.com/org/mcp-server-example.git
cd mcp-server-example

# 2. Check repository health signals
git log --oneline -20                    # Recent commit activity
git shortlog -sn --all                   # Contributor distribution (bus factor)
gh issue list --label "security"         # Open security issues

# 3. Audit the dependency tree
npm audit                                # Known vulnerabilities in dependencies
npx depcheck                             # Unused or missing dependencies
npx license-checker --summary            # License compatibility check

# 4. Verify build reproducibility
npm ci                                   # Clean install from lockfile
npm run build                            # Build from source
shasum -a 256 dist/index.js              # Compare hash to published artifact

# 5. Check for suspicious patterns in source code
# Look for dynamic code evaluation
grep -r "eval\b\|new Function(" src/
# Look for subprocess spawning
grep -r "child_process\|\.exec(" src/
# Look for network calls (document each one found)
grep -r "http://\|fetch(" src/
```

Red flags that require additional review or rejection:
- No lockfile committed (package-lock.json or pnpm-lock.yaml) — builds are non-reproducible.
- Dependencies with zero or very low download counts — potential typosquatting.
- Postinstall scripts that download binaries or run network calls.
- Dynamic code evaluation (`eval`, `new Function`) without clear justification.
- Single maintainer with no organizational backing on a security-sensitive server.

After completing the review, record findings in the trust evaluation document (Rule 5) and update the allowlist (Rule 1) with the approved version and digest. If the review surfaces unresolvable concerns, reject the server and document the reason for future reference.

## Remote HTTP/SSE/OAuth Policy

11. Any MCP server that crosses a network boundary (HTTP, HTTPS, SSE, or streamable HTTP) must be described in `tools/mcp-remote-policy.json`. This file complements the allowlist by capturing the runtime policy that cannot live safely inside client config alone:

```json
{
  "version": "1.0.0",
  "default_mode": "gateway_required",
  "gateway": {
    "required": true,
    "base_url": "https://gateway.example.com/mcp",
    "auth": {
      "token_passthrough_allowed": false,
      "require_audience_validation": true,
      "require_short_lived_tokens": true,
      "allowed_credential_sources": ["gateway", "vault", "oidc-broker"]
    }
  },
  "remote_servers": [
    {
      "name": "github-mcp",
      "url": "https://gateway.example.com/mcp/github",
      "transport": "https",
      "via_gateway": true,
      "auth": {
        "type": "oauth2",
        "audience": "mcp-gateway",
        "credential_source": "gateway",
        "token_passthrough": false,
        "token_ttl": "15m"
      },
      "capabilities": {
        "tools": true,
        "resources": false,
        "prompts": false,
        "roots": false
      }
    }
  ]
}
```

Remote policy requirements:
- Every remote server in `tools/mcp-allowlist.json` must have a matching entry in `tools/mcp-remote-policy.json`.
- `default_mode` must remain `gateway_required`. Direct client-to-server connections are exceptions, not defaults.
- `token_passthrough` must be `false`. Clients authenticate to the gateway; the gateway exchanges or injects the downstream credential.
- `audience` must be explicit. Never accept generic bearer tokens with no audience binding.
- `credential_source` must identify the secret owner (`gateway`, `vault`, `oidc-broker`, etc.). Secrets do not live in `.claude/settings.json`, `.vscode/mcp.json`, `.github/copilot-coding-agent-mcp.json`, or `.codex/config.toml`.
- Remote client config must not carry inline `headers` objects with credential material. Route those concerns through the gateway.
