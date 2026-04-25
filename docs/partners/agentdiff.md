# Partner Integration: agentdiff

## 1. Why this partner

agentdiff is the signing-infrastructure partner for v6 §30.1 (audit log) and §38.7 (audit signing pipeline). It defines the Agent Trace v0.1.0 JSONL spec (aligned with Cognition / Cursor / Vercel / Cloudflare), ed25519 signatures over RFC 8785 JCS-canonicalized records, and — most distinctively — a **git-ref key registry** at `refs/agentdiff/keys/{key_id}:pub.key` that replaces the need for KMS or Vault for v1 public-key distribution. Key_id is `first 16 hex chars of sha256(pubkey)`, so verifiers fetch by key_id without out-of-band exchange.

**Gap closed**: v6 §30 requires tamper-evident audit logs. The canonical approach is a hash chain plus signatures with keys managed by KMS or Vault. Those are operational dependencies that complicate v1 deployment. agentdiff's git-ref registry works offline, requires no external service, and survives squash/rebase via UUID dedup. It is the cleanest v1 path; KMS becomes an optional post-v1 enhancement.

**Alternatives considered**: KMS, Vault, AWS Secrets Manager, co-located keystore. All rejected for v1 because they add an external infrastructure dependency and complicate small-team deployments. agentdiff's git-ref approach piggybacks on the repo that is already the source of truth (v6 §35.5 unidirectional sync). Recorded in v6 §0 conflict-resolution 3 and `docs/adr/0004-agentdiff-key-registry-replaces-kms-v1.md`.

Findings reference: `repo-extraction-findings.md` lines 614–632 (batch 3 write-up), L1263 (§30 refinement), §40 F-117, F-118.

## 2. Prerequisites

- Rust toolchain (for agentdiff's CLI), **or** a TS/Node port of the signing pipeline (see §3 for options).
- `ed25519-dalek` (Rust) or `@noble/ed25519` / `tweetnacl` (TS) for signing/verifying.
- `json-canon` (Rust) or `rfc8785` / `canonicalize-json` (TS) for RFC 8785 JCS canonicalization.
- `sha2` (any language) for sha256 of the public key to derive key_id.
- Git ≥2.30 with push/fetch permission to the repo namespace `refs/orchestrator/keys/*`.
- `openssl` or `ssh-keygen` as a fallback for ed25519 keypair generation if the chosen library does not include generation.

## 3. Clone and install

Two adoption paths. **Path B is the recommended default for v1**.

### Path A: vendor the agentdiff Rust CLI

```bash
git clone https://github.com/<upstream>/agentdiff.git
cd agentdiff
git checkout <AGENTDIFF_COMMIT_SHA>  # record in v6 §40 F-117
cargo build --release
cp target/release/agentdiff /usr/local/bin/
agentdiff configure    # generates keypair at ~/.agentdiff/keys/
agentdiff --version
```

This path invokes `agentdiff` as a subprocess from the orchestrator for sign/verify. Works but adds Rust to the deploy image.

### Path B: TS port of the signing pipeline (recommended)

The signing pipeline is small enough to port. No clone or binary install; just dependencies.

```bash
cd /path/to/orchestrator
pnpm add @noble/ed25519 @noble/hashes canonicalize
# Or: tweetnacl + tweetnacl-util + rfc8785
```

Then implement `src/security/auditChain.ts` (v6 §8) with the pipeline in §6 below. This is the recommended default because it keeps the orchestrator on a single runtime (Node) and avoids vendoring Rust.

**Either path**: on first start, generate or import the ed25519 keypair and mirror the public key to the git-ref registry (§5.1 below).

## 4. Configuration

### 4.1 Environment variables

Extends v6 §20 env block.

| Var | Required | Default | Example | Notes |
|---|---|---|---|---|
| `AUDIT_SIGNING_ENABLED` | No | `true` | — | Master switch. When false, audit entries still get hash-chained but not signed. Disable only for smoke-test environments. |
| `AUDIT_SIGNING_PRIVKEY_PATH` | Yes (when enabled) | `~/.orchestrator/keys/private.key` | — | ed25519 private key; chmod 600. |
| `AUDIT_SIGNING_PUBKEY_PATH` | No (derivable) | `~/.orchestrator/keys/public.key` | — | ed25519 public key; used to derive key_id and register in git. |
| `AUDIT_SIGNING_KEY_REGISTRY_REF` | Yes (when enabled) | `refs/orchestrator/keys/` | — | Git ref namespace for public-key mirror. |
| `AUDIT_SIGNING_KEY_REGISTRY_REMOTE` | No | `origin` | — | Which git remote to push the registry ref to. |
| `AUDIT_SIGNING_KEY_ROTATION_DAYS` | No | — | `365` | If set, emit a warning when the key is older than this. No auto-rotation. |

### 4.2 Config file overlays

In the orchestrator's `config.yaml`:

```yaml
audit:
  signing:
    enabled: ${AUDIT_SIGNING_ENABLED:-true}
    keyAlg: ed25519
    privateKeyPath: ${AUDIT_SIGNING_PRIVKEY_PATH:-~/.orchestrator/keys/private.key}
    publicKeyPath: ${AUDIT_SIGNING_PUBKEY_PATH}
    keyRegistryRef: ${AUDIT_SIGNING_KEY_REGISTRY_REF:-refs/orchestrator/keys/}
    keyRegistryRemote: ${AUDIT_SIGNING_KEY_REGISTRY_REMOTE:-origin}
    keyRotationDays: ${AUDIT_SIGNING_KEY_ROTATION_DAYS}
  hashChain:
    enabled: true

observability:
  agentTraceJsonl:
    enabled: true
    # Agent Trace v0.1.0 records use the same signing pipeline as audit entries.
```

## 5. Integration points with the orchestrator

### 5.1 Keypair bootstrap and registry mirror (one-time per deployment; M6a)

**Trigger**: orchestrator startup detects no keypair at `AUDIT_SIGNING_PRIVKEY_PATH`. **Data out**: generate ed25519 keypair, persist (chmod 600), compute `key_id = sha256(pubkey).slice(0, 16)`, create the git ref `refs/orchestrator/keys/{key_id}:pub.key` containing the base64 public key, push to `origin`. **Failure mode**: git push rejected → orchestrator logs error and refuses to start in audit-signing-enabled mode (fail-closed).

### 5.2 Audit entry signing (v6 §10, §30.1, §38.7; M6a)

**Trigger**: every tool call that creates or updates remote artifacts. **Data in**: `AuditEntry` without `signature`. **Data out**: signed entry — JCS-canonicalize the record → ed25519-sign canonical bytes → set `signature = { alg: "ed25519", keyId, value: base64(rawSignature) }`. Written to audit log + optional SIEM sink. **Failure mode**: signing fails (private key unreadable, etc.) → tool call fails with `AUDIT_SIGNING_FAILED` error; provisioning does not proceed without a signed audit record.

### 5.3 Agent Trace JSONL record signing (v6 §27.4; M11)

**Trigger**: long-running workflows emit trajectory records. **Data out**: each JSONL record signed using the same pipeline as §5.2. Records land at `.orchestrator/traces/{projectId}/{jobId}.jsonl`. **Failure mode**: matches §5.2.

### 5.4 Verification (tooling, not runtime)

**Trigger**: out-of-band audit review. **Data out**: CLI command `orchestrator audit verify --since <sha>` walks the audit log, fetches each record's public key from the git-ref registry by `key_id`, JCS-canonicalizes each record, and verifies the ed25519 signature. Outputs pass/fail per record.

### 5.5 Telemetry counters (v6 §27.2)

**Trigger**: every signing and verification operation. **Counters**: `orchestrator.audit_entries_total`, `orchestrator.audit_signature_failures_total`. Signature failures are a security signal and should page on any non-zero count.

## 6. Glue code patterns

TS port of the signing pipeline. Informational, not normative.

```ts
// src/security/auditChain.ts
import { sign, verify, getPublicKey, utils as edUtils } from "@noble/ed25519";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, bytesToUtf8, utf8ToBytes } from "@noble/hashes/utils";
import { canonicalize } from "canonicalize";
import { readFileSync } from "node:fs";
import { Buffer } from "node:buffer";

export interface AuditSigner {
  sign(record: Omit<AuditEntry, "signature">): Promise<AuditEntry>;
  verify(entry: AuditEntry, pubkey: Uint8Array): Promise<boolean>;
}

export function createAuditSigner(config: AuditSigningConfig): AuditSigner {
  const privKey = edUtils.randomPrivateKey.name
    ? readPrivateKey(config.privateKeyPath)
    : readPrivateKey(config.privateKeyPath);

  const pubKey = deriveAsync(privKey);   // ed25519 pubkey from privkey
  const keyIdPromise = pubKey.then(pk => bytesToHex(sha256(pk)).slice(0, 16));

  return {
    async sign(record) {
      const keyId = await keyIdPromise;
      const canonical = canonicalize(record)!;  // RFC 8785 JCS
      const canonicalBytes = utf8ToBytes(canonical);
      const signature = await sign(canonicalBytes, privKey);
      return {
        ...record,
        signature: {
          alg: "ed25519",
          keyId,
          value: Buffer.from(signature).toString("base64"),
        },
      };
    },
    async verify(entry, pubkey) {
      const { signature, ...withoutSig } = entry;
      const canonical = canonicalize(withoutSig)!;
      const canonicalBytes = utf8ToBytes(canonical);
      const sigBytes = new Uint8Array(Buffer.from(signature.value, "base64"));
      return verify(sigBytes, canonicalBytes, pubkey);
    },
  };
}

// src/storage/repositories/keyRegistryRepository.ts
import { execSync } from "node:child_process";

export class KeyRegistryRepository {
  constructor(private config: AuditSigningConfig) {}

  /** Publish public key to refs/orchestrator/keys/{key_id}:pub.key on the configured remote. */
  async registerPublicKey(keyId: string, pubkeyBase64: string): Promise<void> {
    const ref = `${this.config.keyRegistryRef}${keyId}`;
    // Git plumbing: create a blob, point the ref at it, push.
    const blobSha = execSync(`git hash-object -w --stdin`, { input: pubkeyBase64 }).toString().trim();
    execSync(`git update-ref ${ref} ${blobSha}`);
    execSync(`git push ${this.config.keyRegistryRemote} ${ref}`);
  }

  /** Fetch a public key by key_id. Used by verification tooling. */
  async fetchPublicKey(keyId: string): Promise<string | null> {
    const ref = `${this.config.keyRegistryRef}${keyId}`;
    try {
      execSync(`git fetch ${this.config.keyRegistryRemote} ${ref}`, { stdio: "ignore" });
      return execSync(`git cat-file -p ${ref}`).toString();
    } catch {
      return null;
    }
  }
}
```

## 7. Gotchas

1. **The git-ref registry requires `git push` on startup**. If the orchestrator runs in a sandbox without git push permission, registry publication fails and signing is disabled (fail-closed in production). For offline deployments, pre-populate the registry and set `AUDIT_SIGNING_KEY_REGISTRY_REMOTE=none` to skip the push attempt (add this flag behavior in §6 implementation).
2. **Key rotation is manual in v1.** There is no automatic re-signing or re-registration. When you rotate, (a) generate a new keypair, (b) register the new public key (new key_id), (c) deprecate the old key in an ADR, (d) retain the old public key in the registry for verification of historical entries. Old entries stay signed with the old key; new entries are signed with the new.
3. **JCS canonicalization is not JSON.stringify**. Do not substitute `JSON.stringify(record)` for `canonicalize(record)` — the canonical form is deterministic (sorted keys, fixed number formatting, etc.). Using `JSON.stringify` silently produces signatures that won't verify on independent re-canonicalization. (agentdiff docs; findings.md L~617)
4. **key_id collisions are theoretically possible but astronomically unlikely.** sha256 truncated to 16 hex chars = 64 bits of entropy. In a deployment with fewer than 2^32 rotations, collisions will not happen in practice. Do not attempt to handle collision ambiguity in v1; if it ever happens, re-key with a 32-hex truncation as a post-v1 schema bump.
5. **Git-ref registry ACL**: anyone with push to `refs/orchestrator/keys/*` can publish a public key, which could be used to sign audit entries attributable to that key_id. Restrict this namespace via branch-protection rules on the remote ("only protected pushes to `refs/orchestrator/keys/*`"). Alternatively, host the registry on a dedicated repo with tighter ACLs.
6. **Verification requires the git remote to be fetchable by the verifier.** For air-gapped audit-review workflows, maintain an offline mirror of the registry ref and point `AUDIT_SIGNING_KEY_REGISTRY_REMOTE` at the mirror.
7. **The CLI `openssl genpkey -algorithm Ed25519` output is PEM-encoded**, but `@noble/ed25519` expects raw 32-byte private keys. Convert on read (strip PEM, base64-decode, slice the last 32 bytes).

## 8. Validation

```bash
# 1. Generate keypair and register
orchestrator cli audit keys init
# Expect: logs "Generated key_id=<16hex>, registered at refs/orchestrator/keys/<16hex>"

# 2. Write and sign a smoke audit entry
orchestrator cli audit smoke
# Expect: returns a signed AuditEntry JSON; signature.keyId matches step 1

# 3. Verify the smoke entry
orchestrator cli audit verify --since HEAD~1
# Expect: "Verified N entries; 0 failures"

# 4. Tamper detection
orchestrator cli audit smoke --tamper
# Expect: verification fails with "SignatureInvalid" for the tampered entry

# 5. Fetch public key by key_id (verifier flow)
git fetch origin refs/orchestrator/keys/<key_id>
git cat-file -p refs/orchestrator/keys/<key_id>
# Expect: base64-encoded ed25519 public key
```

## 9. Operational concerns

- **Version pinning policy**: if Path A (vendored Rust CLI), pin to a commit SHA and re-validate on upgrade. If Path B (TS port), pin `@noble/ed25519` and `canonicalize` to specific versions; validate that JCS output is byte-identical before and after upgrade.
- **Upgrade path**: (a) read changelog for signature-format or canonicalization changes, (b) run validation §8, (c) if JCS output changes, old entries become un-verifiable on the new code path — pin the canonicalizer version permanently or ship a fallback verifier that handles old records.
- **Ownership**: orchestrator team owns the `AuditSigner` implementation, the `KeyRegistryRepository`, and the verification CLI. agentdiff is a reference implementation — its maintainers do not have operational responsibility for the orchestrator's audit trail.
- **Partner repo archived/abandoned scenario**: agentdiff is a spec + reference implementation; the relevant pieces (ed25519, JCS, git-ref registry pattern) are all algorithms and git commands. The orchestrator's TS port (Path B) has no runtime dependency on the agentdiff repo. Safe.
- **Disaster recovery**: private key at `~/.orchestrator/keys/private.key` must be backed up to a secure, offline location. If the private key is lost, no new entries can be signed with the old key_id; rotate and continue. Historical entries remain verifiable as long as the public key persists in the git-ref registry.
- **Migration to KMS post-v1**: the abstraction (`AuditSigner` interface, `KeyRegistryRepository` interface) is intentionally narrow. A KMS-backed implementation replaces both without touching audit-log callers. See `docs/adr/0004-agentdiff-key-registry-replaces-kms-v1.md` for the decision log.
