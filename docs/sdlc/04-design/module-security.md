---
title: Module — Security
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, auditor]
sdlc_category: 04-design
related: [docs/sdlc/06-security/, docs/adr/0002-token-encryption-noble-ciphers.md, docs/adr/0005-audit-signing-pipeline.md, agent-context-orchestrator-mcp-plan-v6.md §7.2, §30, §38]
---

# Module — Security

> **TL;DR:** Cross-cutting security primitives. Owns the policy decision layer (gates state changes), the audit chain writer (hash-linked + ed25519-signed), the token store (XChaCha20-Poly1305 envelope), and the webhook signature verifier (HMAC-SHA256). The single entry point per concern is the discipline: every state-change passes through `policyDecisionLayer.evaluate()`; every token read goes through `tokenStore.open()`; every webhook is verified before parsing. Per-component threat models in [`../06-security/`](../06-security/).

The security module is small in lines of code but disproportionately important. Bypassing any of its entry points = a real defect (caught by review, ideally also by lint/AST checks in M11+).

---

## Purpose

Owns the cross-cutting security primitives:

- **Policy decision layer** (`policyDecisionLayer.ts`) — gates every state-changing operation; default deny in strict mode; adapter pattern for richer rules.
- **Code-policy adapter** (`policyAdapters/codePolicyAdapter.ts`) — v1 default adapter; conservative built-in rules.
- **Token sealing/opening** (`tokenEncryption.ts` + `tokenStore.ts`) — XChaCha20-Poly1305 envelope per ADR-0002; plaintext only in memory at request time.
- **Webhook signature verification** (`webhookSignatures.ts`) — HMAC-SHA256 + constant-time compare.
- **Audit-chain construction** — the hash-chain + signing logic; storage lives in `src/storage/schema/auditEntries.ts`.

Does NOT own:
- The audit-entry schema itself (storage owns; this module operates on it).
- Provider-specific auth flows (each provider's `auth/` directory owns).
- Policy *rules* — those live in adapters; this module holds the contract.
- Secret provisioning (deploy-platform concern; this module assumes secrets arrive through env / mount).

---

## Public surface

| Symbol | Kind | Signature | Purpose |
|---|---|---|---|
| `policyDecisionLayer.evaluate` | function | `(req: PolicyDecisionRequest) => Promise<PolicyDecision>` | Single entry: every state-change passes through. Returns effect + obligations + confidence + reasons. |
| `PolicyDecision` | type | `{ effect, obligations, confidence, reasons }` | Output shape |
| `PolicyDecisionRequest` | type | `{ projectId, intent, context }` | Input shape |
| `Obligation` | type | discriminated union | Constraints to honor downstream (redact_field, rate_limit, require_review, audit_extra) |
| `codePolicyAdapter` | impl | implements `PolicyAdapter` | Default v1 adapter |
| `tokenStore.seal` | function | `(plaintext, kind, subject) => Promise<TokenId>` | Persist plaintext as encrypted row |
| `tokenStore.open` | function | `(kind, subject) => Promise<string>` | Decrypt to plaintext (in memory only) |
| `tokenStore.rotate` | function | `(kind, subject, newPlaintext) => Promise<TokenId>` | Supersedes prior; preserves history for rollback |
| `tokenEncryption.seal/open` | low-level | XChaCha20-Poly1305 wrappers | Used by tokenStore; testable in isolation |
| `tokenEncryption.testDouble` | impl | implements the encryption contract without crypto | Fake for non-encryption tests |
| `verifyWebhookSignature` | function | `(rawBody, signatureHeader, secret) => boolean` | HMAC-SHA256 verify; constant-time compare |
| `auditChainAppend` | function | `(entry) => Promise<AuditId>` | Append a signed entry to the chain |

---

## Architecture

<figure>

<svg viewBox="0 0 1200 480" xmlns="http://www.w3.org/2000/svg" font-family="IBM Plex Sans, system-ui">
  <text x="40" y="28" font-family="IBM Plex Mono" font-size="10.5" letter-spacing="1.4" fill="#9a9690">V15a · STORAGE CONTAINER · C4 LEVEL 3</text>

  <defs>
    <marker id="ar15a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#43434a"/>
    </marker>
  </defs>

  <!-- container boundary -->
  <rect x="40" y="56" width="1120" height="400" fill="none" stroke="#1a1a1c" stroke-dasharray="4 3" stroke-width="1.5"/>
  <text x="58" y="76" font-family="IBM Plex Mono" font-size="10.5" letter-spacing="1.2" fill="#1a1a1c">«container» Storage</text>

  <!-- repositories -->
  <g transform="translate(80,110)">
    <rect width="220" height="100" fill="#dde9f2" stroke="#1f5f8a" stroke-width="1.5"/>
    <text x="14" y="22" font-family="IBM Plex Mono" font-size="10" letter-spacing="1.2" fill="#11364f">«component»</text>
    <text x="14" y="44" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#11364f">Repositories</text>
    <line x1="14" y1="54" x2="206" y2="54" stroke="#a3c4d8"/>
    <text x="14" y="74" font-family="IBM Plex Sans" font-size="11.5" fill="#11364f">domain queries by aggregate</text>
    <text x="14" y="90" font-family="IBM Plex Mono" font-size="10.5" fill="#1f5f8a">Audit · Token · Job · Schedule</text>
  </g>

  <!-- query builder -->
  <g transform="translate(330,110)">
    <rect width="200" height="100" fill="#faf9f6" stroke="#43434a" stroke-width="1.5"/>
    <text x="14" y="22" font-family="IBM Plex Mono" font-size="10" letter-spacing="1.2" fill="#43434a">«component»</text>
    <text x="14" y="44" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#1a1a1c">Kysely query builder</text>
    <line x1="14" y1="54" x2="186" y2="54" stroke="#c8c3b6"/>
    <text x="14" y="74" font-family="IBM Plex Sans" font-size="11.5" fill="#43434a">type-safe SQL · no ORM</text>
    <text x="14" y="90" font-family="IBM Plex Mono" font-size="10.5" fill="#43434a">v6 §11</text>
  </g>

  <!-- driver -->
  <g transform="translate(560,110)">
    <rect width="200" height="100" fill="#faf9f6" stroke="#43434a" stroke-width="1.5"/>
    <text x="14" y="22" font-family="IBM Plex Mono" font-size="10" letter-spacing="1.2" fill="#43434a">«component»</text>
    <text x="14" y="44" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#1a1a1c">Driver — pg / pglite</text>
    <line x1="14" y1="54" x2="186" y2="54" stroke="#c8c3b6"/>
    <text x="14" y="74" font-family="IBM Plex Sans" font-size="11.5" fill="#43434a">runtime choice via PGLITE_PATH</text>
    <text x="14" y="90" font-family="IBM Plex Mono" font-size="10.5" fill="#43434a">v6 §11.1</text>
  </g>

  <!-- migrations -->
  <g transform="translate(790,110)">
    <rect width="200" height="100" fill="#fbeed8" stroke="#b96b16" stroke-width="1.5"/>
    <text x="14" y="22" font-family="IBM Plex Mono" font-size="10" letter-spacing="1.2" fill="#7a4408">«component»</text>
    <text x="14" y="44" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#7a4408">Migrator</text>
    <line x1="14" y1="54" x2="186" y2="54" stroke="#e3c486"/>
    <text x="14" y="74" font-family="IBM Plex Sans" font-size="11.5" fill="#7a4408">forward-only · schema_migrations</text>
    <text x="14" y="90" font-family="IBM Plex Mono" font-size="10.5" fill="#7a4408">runs on boot</text>
  </g>

  <!-- audit writer -->
  <g transform="translate(80,250)">
    <rect width="220" height="120" fill="#fbe7e4" stroke="#b8281d" stroke-width="1.5"/>
    <text x="14" y="22" font-family="IBM Plex Mono" font-size="10" letter-spacing="1.2" fill="#7a1d14">«component»</text>
    <text x="14" y="44" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#7a1d14">AuditWriter</text>
    <line x1="14" y1="54" x2="206" y2="54" stroke="#e3a39a"/>
    <text x="14" y="74" font-family="IBM Plex Sans" font-size="11.5" fill="#7a1d14">single writer · serial commits</text>
    <text x="14" y="90" font-family="IBM Plex Sans" font-size="11.5" fill="#7a1d14">canonical JSON · Ed25519 sign</text>
    <text x="14" y="108" font-family="IBM Plex Mono" font-size="10.5" fill="#b8281d">v6 §10 · V1 detail</text>
  </g>

  <!-- audit verifier -->
  <g transform="translate(330,250)">
    <rect width="200" height="120" fill="#fbe7e4" stroke="#b8281d" stroke-width="1.5"/>
    <text x="14" y="22" font-family="IBM Plex Mono" font-size="10" letter-spacing="1.2" fill="#7a1d14">«component»</text>
    <text x="14" y="44" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#7a1d14">AuditVerifier</text>
    <line x1="14" y1="54" x2="186" y2="54" stroke="#e3a39a"/>
    <text x="14" y="74" font-family="IBM Plex Sans" font-size="11.5" fill="#7a1d14">re-derive hash · check sig</text>
    <text x="14" y="90" font-family="IBM Plex Sans" font-size="11.5" fill="#7a1d14">offline-runnable utility</text>
    <text x="14" y="108" font-family="IBM Plex Mono" font-size="10.5" fill="#b8281d">scripts/verify-audit.ts</text>
  </g>

  <!-- token store -->
  <g transform="translate(560,250)">
    <rect width="200" height="120" fill="#ece1f3" stroke="#6e1a82" stroke-width="1.5"/>
    <text x="14" y="22" font-family="IBM Plex Mono" font-size="10" letter-spacing="1.2" fill="#3e0d4d">«component»</text>
    <text x="14" y="44" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#3e0d4d">TokenStore</text>
    <line x1="14" y1="54" x2="186" y2="54" stroke="#c39bd1"/>
    <text x="14" y="74" font-family="IBM Plex Sans" font-size="11.5" fill="#3e0d4d">at-rest envelope encryption</text>
    <text x="14" y="90" font-family="IBM Plex Sans" font-size="11.5" fill="#3e0d4d">decrypts only into memory</text>
    <text x="14" y="108" font-family="IBM Plex Mono" font-size="10.5" fill="#6e1a82">v6 §9 · V5 detail</text>
  </g>

  <!-- pg singleton -->
  <g transform="translate(790,250)">
    <rect width="200" height="120" fill="#1a1a1c" stroke="#1a1a1c"/>
    <text x="14" y="22" font-family="IBM Plex Mono" font-size="10" letter-spacing="1.2" fill="#9a9690">«database»</text>
    <text x="14" y="44" font-family="IBM Plex Sans" font-size="13" font-weight="600" fill="#fff">Postgres 17</text>
    <line x1="14" y1="54" x2="186" y2="54" stroke="#43434a"/>
    <text x="14" y="74" font-family="IBM Plex Sans" font-size="11.5" fill="#c8c3b6">single-tenant instance</text>
    <text x="14" y="90" font-family="IBM Plex Sans" font-size="11.5" fill="#c8c3b6">audit_log · tokens · jobs · ...</text>
    <text x="14" y="108" font-family="IBM Plex Mono" font-size="10.5" fill="#9a9690">PITR · daily logical backup</text>
  </g>

  <!-- arrows: repos -> kysely -> driver -> pg -->
  <line x1="300" y1="160" x2="330" y2="160" stroke="#43434a" marker-end="url(#ar15a)"/>
  <line x1="530" y1="160" x2="560" y2="160" stroke="#43434a" marker-end="url(#ar15a)"/>
  <line x1="660" y1="210" x2="890" y2="250" stroke="#43434a" marker-end="url(#ar15a)"/>
  <text x="700" y="232" font-family="IBM Plex Mono" font-size="10" fill="#6f6e6a">SQL</text>

  <!-- migrator -> pg -->
  <line x1="890" y1="210" x2="890" y2="250" stroke="#43434a" marker-end="url(#ar15a)"/>

  <!-- audit writer -> repo -->
  <line x1="190" y1="250" x2="190" y2="210" stroke="#43434a" marker-end="url(#ar15a)"/>
  <text x="200" y="232" font-family="IBM Plex Mono" font-size="10" fill="#6f6e6a">via AuditRepo</text>

  <!-- token store -> repo -->
  <line x1="660" y1="250" x2="220" y2="210" stroke="#43434a" marker-end="url(#ar15a)"/>

  <!-- verifier reads pg directly -->
  <path d="M530,310 Q700,400 890,370" stroke="#43434a" fill="none" stroke-dasharray="3 3" marker-end="url(#ar15a)"/>
  <text x="650" y="395" font-family="IBM Plex Mono" font-size="10" fill="#6f6e6a">read-only</text>

  <!-- KMS callout -->
  <g transform="translate(1010,250)">
    <rect width="130" height="120" fill="#faf9f6" stroke="#1a1a1c" stroke-dasharray="3 3"/>
    <text x="10" y="22" font-family="IBM Plex Mono" font-size="9.5" letter-spacing="1.2" fill="#43434a">«external»</text>
    <text x="10" y="42" font-family="IBM Plex Sans" font-size="12" font-weight="600" fill="#1a1a1c">KMS / KEK</text>
    <text x="10" y="62" font-family="IBM Plex Sans" font-size="11" fill="#43434a">unwraps DEK on</text>
    <text x="10" y="76" font-family="IBM Plex Sans" font-size="11" fill="#43434a">demand</text>
    <text x="10" y="100" font-family="IBM Plex Mono" font-size="10" fill="#43434a">audit-logged</text>
  </g>
  <line x1="760" y1="290" x2="1010" y2="290" stroke="#43434a" marker-end="url(#ar15a)"/>
</svg>

<figcaption><strong>V15b — C4-L3 Security.</strong> The two C4-L3 component diagrams that anchor the architecture chapter. **Storage (V15a)** shows the read/write paths: AuditWriter is single-writer; tokens go through envelope encryption; Postgres is single-tenant. **Security (V15b)** shows the request pipeline every entry point shares: authn → authz → confirmation → redaction → rate limit → prompt-injection guard, with every decision audit-hooked. There is no bypass path — that's the point. (See <a href="../../visualizations/v15-c4-l3.html">full visualization page</a>.)</figcaption>
</figure>


```mermaid
graph TB
    subgraph Sec["src/security/"]
        Policy[policyDecisionLayer]
        Adapter[policyAdapters/codePolicyAdapter]
        TokEnc[tokenEncryption]
        TokStore[tokenStore]
        Webhook[webhookSignatures]
        AuditWriter[audit-chain writer]
    end

    Storage[(src/storage/schema/auditEntries)]
    SchemaTok[(src/storage/schema/encryptedTokens)]
    SchemaPol[(src/storage/schema/policyDecisions)]
    SecretMgr[(secret manager / env)]
    Registry[(audit key registry git ref)]

    Policy --> Adapter
    Adapter -.uses classification.-> Storage
    TokStore --> TokEnc
    TokStore --> SchemaTok
    TokStore --> SecretMgr
    TokEnc --> SecretMgr
    Webhook --> Storage
    Policy --> AuditWriter
    AuditWriter --> Storage
    AuditWriter --> Registry
    Adapter --> SchemaPol
```

Each primitive has a clear ownership boundary. `policyDecisionLayer` orchestrates; the others are leaf primitives.

---

## Key flows

### Policy evaluation

Every state-changing operation in the orchestrator calls `policyDecisionLayer.evaluate()`. The flow:

```mermaid
sequenceDiagram
    participant Caller as Workflow / executor
    participant Layer as policyDecisionLayer
    participant Adapter as codePolicyAdapter
    participant Audit as audit chain
    participant Decisions as policyDecisions table

    Caller->>Layer: evaluate(req)
    Layer->>Adapter: evaluate(req)
    Adapter->>Adapter: apply rules
    Adapter-->>Layer: PolicyDecision
    Layer->>Decisions: insert structured record
    Layer->>Audit: append "policy.decision" entry (signed)
    Layer-->>Caller: decision

    alt decision.effect = deny
        Caller->>Caller: throw PolicyDeniedError
    else require_approval
        Caller->>Caller: pause for human approval
    else allow
        Caller->>Caller: honor obligations; proceed
    end
```

The decision is **always** persisted: once in `policyDecisions` (queryable via SQL), once in `auditEntries` (tamper-evident). Redundancy is intentional — different consumers, different ergonomics.

### Token seal/open

Sealing (write):
1. Generate 24-byte random nonce.
2. `xchacha20poly1305.seal(masterKey, nonce, plaintext)` → ciphertext + auth tag.
3. Insert row in `encryptedTokens`: `(id, kind, subject, nonce, ciphertext, ...)`.
4. Return token row id.

Opening (read):
1. Query `encryptedTokens` for `(kind, subject)`.
2. `xchacha20poly1305.open(masterKey, nonce, ciphertext)` → plaintext (or throw on auth failure).
3. Return plaintext.
4. Caller must zero plaintext after use (best-effort; JS limitation).

### Webhook verify

1. Read raw body bytes (BEFORE parsing JSON or any structured interpretation).
2. Compute `HMAC-SHA256(secret, body)`.
3. `crypto.timingSafeEqual(computed, signatureHeader)`.
4. Return boolean. **Caller never proceeds past this** unless the result is true.

The "before parsing" rule is critical: a malicious body can't trigger a parser exploit before signature verification.

### Audit chain append

1. Look up the prior entry's serialized canonical form (RFC 8785 JCS).
2. Compute `prevHash = SHA-256(prior canonical)`.
3. Compute `payloadHash = SHA-256(this entry's payload, JCS-canonicalized)`.
4. Compute `chainHash = SHA-256(prevHash || payloadHash)`.
5. Resolve current signing key from the registry git ref.
6. Sign `chainHash` with ed25519.
7. Insert row with all fields.
8. Return entry id.

Failure to write = **fail closed** (the calling operation aborts). Documented in v6 §30.1.

---

## Threat coverage

Per-component threat models (in [`../06-security/`](../06-security/)):

- [`policy-decision-layer.md`](../06-security/policy-decision-layer.md) — T-PDL-* (bypass, wrong decision, obligation skip, runtime tamper).
- [`token-storage.md`](../06-security/token-storage.md) — T-2201, T-2202 (exfil, log leak).
- [`webhook-verification.md`](../06-security/webhook-verification.md) — T-1103, T-1104 (forge, replay).
- [`audit-chain-threat-model.md`](../06-security/audit-chain-threat-model.md) — T-3302 through T-3306 (forge, key compromise, registry compromise, silent fail, clock manipulation).

Parent: [`../06-security/threat-model.md`](../06-security/threat-model.md).

---

## Configuration

Per [`../09-deployment/secrets-provisioning.md`](../09-deployment/secrets-provisioning.md):

| Var | Required | Default | Purpose |
|---|---|---|---|
| `TOKEN_MASTER_KEY` | Yes (non-dev) | — | 32-byte hex master key for envelope encryption |
| `AUDIT_KEYPAIR_PATH` | No | `./.orchestrator-audit-keypair.json` | Audit signing keypair file |
| `AUDIT_KEY_REGISTRY_REF` | Yes (non-dev) | — | Git ref for the public-key registry |
| `WEBHOOK_SHARED_SECRETS` | Conditional | — | JSON map of source → HMAC-SHA256 secret |
| `POLICY_ADAPTER` | No | `code` | Adapter selection (only `code` in v1) |
| `POLICY_STRICT_MODE` | No | `true` for `production`, `false` for `dev` | Strict mode treats unknown intents as deny |

Failure to load any of these (where required) causes startup failure with a clear error message. Silent fallback is **not** a defensible choice for security primitives.

---

## Failure modes

### Master key unset at startup

**Symptom:** Application fails to start with a clear error.

**Recovery:** set `TOKEN_MASTER_KEY` per [`../09-deployment/secrets-provisioning.md`](../09-deployment/secrets-provisioning.md). Don't proceed with token features until set.

### Master key malformed

**Symptom:** Startup fails with "expected 64 hex chars, got X."

**Recovery:** correct the key; restart.

### Audit keypair missing

**Symptom:** Startup fails (or auto-generates in dev tier only).

**Recovery:** in production, mount the keypair via secret manager. In dev, the bootstrap script generates one.

### Registry git ref unreachable

**Symptom:** New audit-chain writes fail closed (cannot resolve key id to public key for verification).

**Recovery:** check git ref reachability; check replication to secondary host. Existing chain remains verifiable; new writes blocked until restored.

### Policy adapter throws

**Symptom:** A policy evaluation throws an unexpected error.

**Recovery:** the layer catches + treats as `effect: deny` with `confidence: low` (fail safe). The throw is logged + audited.

### Webhook signature mismatch

**Symptom:** verification returns false.

**Recovery:** the calling endpoint returns 401; the failure is audited. If the rate of mismatches is high: a probe is suspected (alert).

---

## Tests

| Test | Path | What it proves |
|---|---|---|
| Token encryption round-trip | `tests/unit/security/tokenEncryption.test.ts` | Plaintext in = plaintext out; tamper detected |
| Wrong-key fails | Same file | Decrypt with wrong master key → auth failure, not garbage |
| Code-policy adapter | `tests/unit/security/codePolicyAdapter.test.ts` | All intents return canonical decision shape; lethal-trifecta path works |
| Webhook signatures | `tests/unit/security/webhookSignatures.test.ts` | Valid accepted; tampered rejected; constant-time compare |
| Token store integration | `tests/integration/storage/tokenStore.test.ts` | Real DB roundtrip across pglite + Postgres |
| Audit chain integrity | `tests/integration/storage/auditRepository.test.ts` | Chain construction; tamper detection; fail-closed behavior |

Coverage gaps:
- **Master-key rotation drill** — manual today; planned automation post-v1 (PCO-57).
- **Audit signing key rotation** end-to-end — designed; integration test pending (M11).
- **Lethal-trifecta detection adversarial cases** — needs broader corpus.

---

## Concurrency

- **Policy evaluation:** stateless; no shared mutable state. Reentrant.
- **Token seal/open:** uses no shared state per call. Master key held in memory.
- **Webhook verify:** stateless.
- **Audit chain writes:** serialized at the storage layer (each entry depends on prior). The writer holds an advisory lock for the duration of an append.

Performance implication: audit-chain throughput is bounded by serialization. At v1 scale (100 entries/sec sustained target), this is fine; at higher scale, batching or sharding becomes relevant.

---

## Performance characteristics

| Operation | Typical | p99 |
|---|---|---|
| Policy evaluation (in-memory adapter) | < 1 ms | < 5 ms |
| Token seal | < 5 ms | < 20 ms |
| Token open (DB read + decrypt) | < 5 ms | < 20 ms |
| HMAC-SHA256 verify | < 1 ms | < 5 ms |
| Audit chain append (sign + insert) | < 20 ms | < 100 ms |

These are dominated by I/O (DB write, key registry git lookup), not crypto. The crypto operations themselves are < 100µs.

---

## Tradeoffs

### Single policy adapter (code) for v1 vs. plug-in framework

**Chose:** code-only.

**Pro:** simpler. Rule changes are PRs with full review.

**Con:** rule changes require redeploy.

**Mitigation:** OPA / Cedar adapters can plug in behind the same interface in M7+ if needed.

### Master encryption key as single point vs. envelope w/ per-row keys

**Chose:** single master for v1.

**Pro:** simpler implementation.

**Con:** master-key compromise = all tokens decryptable. Master-key rotation = manual re-encrypt drill (Incident C).

**Mitigation:** PCO-57 tracks the envelope-encryption refactor.

### Fail-closed on audit failure vs. continue

**Chose:** fail-closed.

**Pro:** integrity preserved over availability. v6 §30.1.

**Con:** audit-chain outage takes the orchestrator down with it.

**Mitigation:** the audit chain has its own redundancy story (PITR + key registry replication).

### Hash-chain + ed25519 vs. simpler audit log

**Chose:** hash-chain + ed25519.

**Pro:** tamper-evident; cheap verification.

**Con:** key management complexity (registry git ref, rotation procedure).

**Reference:** [ADR-0005](../../adr/0005-audit-signing-pipeline.md) for the full rationale.

---

## Roadmap

- **M11:** full audit-chain wraps every executor (currently partial).
- **M11:** rotation drills exercised end-to-end against staging fixture.
- **PCO-51:** per-tenant key isolation spike (multi-tenant prerequisite).
- **PCO-57:** envelope encryption refactor (master-key rotation made cheap).
- **Post-v1:** OPA / Cedar adapter exploration if needed.

---

## Linked artifacts

- **Spec:** v6 §7.2 (policy decision layer), §30 (audit + security), §30.1 (audit chain), §38 (lethal trifecta + ACL ranking)
- **ADRs:** [ADR-0002](../../adr/0002-token-encryption-noble-ciphers.md), [ADR-0005](../../adr/0005-audit-signing-pipeline.md)
- **Code:** `src/security/`
- **Threat models:** [`../06-security/threat-model.md`](../06-security/threat-model.md), [`../06-security/policy-decision-layer.md`](../06-security/policy-decision-layer.md), [`../06-security/token-storage.md`](../06-security/token-storage.md), [`../06-security/webhook-verification.md`](../06-security/webhook-verification.md), [`../06-security/audit-chain-threat-model.md`](../06-security/audit-chain-threat-model.md), [`../06-security/lethal-trifecta.md`](../06-security/lethal-trifecta.md)
- **Sibling modules:** [`module-storage.md`](module-storage.md), [`module-mcp-runtime.md`](module-mcp-runtime.md), [`module-providers-atlassian.md`](module-providers-atlassian.md)
- **Audit data:** [`../05-data/audit-trail.md`](../05-data/audit-trail.md)
- **Tracking:** PCO-51 (multi-tenant), PCO-57 (envelope encryption)

---

*Last reviewed: 2026-04-25 by Chris.*
