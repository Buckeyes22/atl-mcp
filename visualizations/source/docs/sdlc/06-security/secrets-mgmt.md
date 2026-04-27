---
title: Secrets Management
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, operator, auditor]
sdlc_category: 06-security
related: [docs/sdlc/06-security/token-storage.md, docs/sdlc/09-deployment/secrets-provisioning.md]
---

# Secrets Management

> **TL;DR:** What secrets exist, where they live, who reads them, how they rotate. Master encryption key (`TOKEN_MASTER_KEY`), audit signing keypair (`AUDIT_KEYPAIR_PATH`), per-credential tokens (in `encryptedTokens` table), webhook shared secrets. None of these are ever in source control or logs.

This is the inventory + lifecycle view. Operational provisioning (where secrets come from in each environment) lives in [`../09-deployment/secrets-provisioning.md`](../09-deployment/secrets-provisioning.md).

---

## Secret inventory

| Secret | Location | Read by | Rotation cadence (v1) | Compromise impact |
|---|---|---|---|---|
| `TOKEN_MASTER_KEY` (32-byte hex) | env var | `src/security/tokenEncryption.ts` at startup | At-will; no schedule | All stored tokens decryptable; manual re-encrypt drill required |
| `AUDIT_KEYPAIR_PATH` (file) | filesystem (mode 0400) | `src/security/auditSigner.ts` (planned) | At-will; recommended quarterly | Audit forgery possible until rotation |
| Per-credential tokens (Atlassian/Bitbucket/webhook) | `encryptedTokens` table | Provider HTTP clients on each request | At-will per source | API access for that account; rotate secret + re-seed |
| Webhook shared secrets | `encryptedTokens` (`kind = webhook_shared_secret`) | `src/security/webhookSignatures.ts` per-request | At-will | Forge webhook events for that source |
| `DATABASE_URL` (with credentials) | env var | `src/storage/db.ts` at startup | DBA-managed | Full DB access |
| `UIO_MCP_SOCKET` path | env var | UIO partner adapter | n/a (unix socket) | n/a (path is not the secret; access control is filesystem-level) |

Note: there is **no** "session token" secret because v1 doesn't issue session tokens — MCP capability negotiation handles session identity.

## What's NOT a secret (despite seeming like one)

- **Audit chain public keys** — INTERNAL, not SECRET. Stored in the git registry openly.
- **MCP tool catalog** — public. The capability negotiation announces what's available.
- **Migration version numbers** — public. `/admin/health/db` exposes them.
- **Project keys** (e.g., PCO) — INTERNAL but not secret; they appear in URLs.

## Lifecycle per secret

### Master encryption key

**Provisioning:**
- Dev: set in `.env.local` as a 64-character hex string.
- Staging / production: from secret manager (Vault, AWS Secrets Manager, GCP Secret Manager) injected as env var by the deploy platform.

**Reading:** loaded once at startup by `src/config/env.ts`. Never re-read at runtime; never logged; never returned by any API.

**Rotation:** see [`token-storage.md`](token-storage.md) "Master-key rotation" — manual re-encrypt drill, PCO-57 tracks the long-term envelope-encryption refactor.

**Compromise response:** rotate immediately; invalidate all sealed tokens with the old key by re-sealing with the new key.

### Audit signing keypair

**Provisioning:**
- Dev: auto-generated on first run by `scripts/audit-keys-init.ts` (planned, M11). Path defaults to `./.orchestrator-audit-keypair.json`. **NOT checked in.**
- Staging / production: generated externally; private half delivered to host as a file, public half pushed to the registry git ref.

**Reading:** loaded at startup; private key held in memory for signing.

**Rotation:** see [`audit-chain-threat-model.md`](audit-chain-threat-model.md) Key rotation procedure.

**Compromise response:** rotate; revoke compromised key in registry; flag forensic review of entries signed during the compromise window.

### Per-credential tokens (Atlassian / Bitbucket)

**Provisioning:**
- Operator submits via mgmt REST or CLI.
- Token is sealed (encrypted) before persistence.

**Reading:** opened only at request time, in memory only, zeroed after use (best-effort; JS limitation).

**Rotation:** at-will. Operator obtains new token from Atlassian/Bitbucket, submits via the same path. New row supersedes old.

**Compromise response:** rotate at the source (Atlassian/Bitbucket), then update in atl-mcp. Audit log captures the operation that involved the compromised token.

### Webhook shared secrets

Same lifecycle as per-credential tokens, just `kind = webhook_shared_secret`.

### Database URL

**Provisioning:** env var, injected by deploy platform.

**Reading:** at startup; connection pool persists.

**Rotation:** DBA-managed. Cycle through the deploy platform.

## Where secrets MUST NOT appear

| Location | Reason |
|---|---|
| Git history | Permanent, scannable, leaked |
| CI logs | Logs often retained openly |
| Application logs (`./orchestrator.log`) | Pino redaction config covers known shapes; review at every milestone |
| API responses | No "echo back" of submitted secrets |
| Error messages to clients | Errors may include redacted markers but never raw values |
| `.env.example` files | Use placeholders only |

## Pino redaction config

Active redaction paths in `src/observability/logger.ts`:

```typescript
redact: {
  paths: [
    "*.token",
    "*.apiToken",
    "*.authorization",
    "headers.authorization",
    "headers['x-hub-signature-256']",
    "*.password",
    "*.apiKey",
    "TOKEN_MASTER_KEY",
    "AUDIT_KEYPAIR_PATH",
    // Add new secret-bearing field names here at every milestone review
  ],
  censor: "[REDACTED]",
}
```

When a new field is added that might carry a secret: add to the redaction config in the same PR. Lint catches `console.*` (`scripts/lint-no-stdout.mjs`); redaction config catches structured logs.

## Verification

How to verify the inventory is complete:

```bash
# Find any string that looks like a secret in source
grep -rE "[a-f0-9]{32,}|api[_-]?key|secret|password" src/ tests/ --include='*.ts'

# Find any reference to env vars in source vs. what's documented
grep -roh 'process\.env\.[A-Z_]*' src/ | sort -u | diff - <(grep -oh 'process\.env\.[A-Z_]*' src/config/env.ts | sort -u)
```

Both commands are part of the audit pre-flight ([`docs/audit-protocol.md`](../../audit-protocol.md)).

## Linked artifacts

- **Code:** `src/config/env.ts`, `src/security/tokenStore.ts`, `src/security/tokenEncryption.ts`, `src/security/webhookSignatures.ts`, `src/observability/logger.ts`
- **Operational provisioning:** [`../09-deployment/secrets-provisioning.md`](../09-deployment/secrets-provisioning.md)
- **Token storage detail:** [`token-storage.md`](token-storage.md)
- **Audit chain detail:** [`audit-chain-threat-model.md`](audit-chain-threat-model.md)
- **Webhook detail:** [`webhook-verification.md`](webhook-verification.md)
- **Threat model:** [`threat-model.md`](threat-model.md) (T-2201, T-2202, T-2203)
- **Audit pre-flight:** [`docs/audit-protocol.md`](../../audit-protocol.md)

---

*Last reviewed: 2026-04-25 by Chris.*
