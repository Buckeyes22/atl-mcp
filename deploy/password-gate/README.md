# atl-mcp Password Gate

Small host-level password gate for exposing the loopback management UI through a Cloudflare tunnel.

The gate listens on `127.0.0.1:3001`, renders `/gate/login`, and proxies authenticated traffic to the orchestrator management API on `127.0.0.1:3101`. It is a simple presentation gate for the deployed control plane, not a replacement for proper identity-aware access.

## cvps3 Topology

```text
Cloudflare tunnel -> 127.0.0.1:3001 gate -> 127.0.0.1:3101 orchestrator mgmt API
```

Apply `cvps3-compose-port.patch` or make the equivalent compose change so the orchestrator host mapping is `127.0.0.1:3101:3001`.

## Install

```bash
sudo install -d -m 0755 /opt/atl-mcp-gate
sudo install -m 0755 deploy/password-gate/gate.py /opt/atl-mcp-gate/gate.py
sudo install -m 0644 deploy/password-gate/atl-mcp-gate.service /etc/systemd/system/atl-mcp-gate.service
sudo install -m 0600 deploy/password-gate/atl-mcp-gate.env.example /etc/atl-mcp-gate.env
sudo editor /etc/atl-mcp-gate.env
sudo systemctl daemon-reload
sudo systemctl enable --now atl-mcp-gate.service
```

Set a real `GATE_PASSWORD` and a long random `GATE_COOKIE_SECRET` in `/etc/atl-mcp-gate.env`. Do not commit those values.

## Smoke

```bash
curl -I http://127.0.0.1:3001/ui/
curl -I http://127.0.0.1:3001/gate/login?next=/ui/
```

Expected unauthenticated `/ui/` behavior is `302` to `/gate/login?next=/ui/`.
