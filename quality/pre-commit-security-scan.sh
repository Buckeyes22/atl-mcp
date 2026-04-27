#!/usr/bin/env bash
# pre-commit-security-scan.sh — atl-mcp pre-commit security gate.
# Adapted from velocity-ops-engine/quality/pre-commit-security-scan.sh per
# docs/velocity-ops-port-plan.md (Phase 7). Strips consulting-specific
# rules (PII, personal names, hardcoded company emails); adds atl-mcp
# concerns (provider-token-encryption audit, Drizzle migration safety,
# Redis key injection audit, audit-chain key handling).
#
# EXIT CODES:
#   0 — no issues, commit proceeds
#   1 — sensitive data detected, commit blocked

set -uo pipefail

FOUND_ISSUES=0

log_issue() {
  local category="$1"; local file="$2"; local line="$3"; local match="$4"
  echo "[BLOCKED] $category in $file (line $line): $match" 1>&2
  FOUND_ISSUES=1
}

# Staged files (added or modified, not deleted).
staged_files() {
  git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true
}

# ───── 1. API keys + tokens (universal) ─────
# Covers: AWS access keys, GitHub PATs, generic bearer tokens with sk- prefix
# (OpenAI / Anthropic / Stripe), bare 32+ hex strings that look like secrets.
scan_api_keys() {
  for file in $(staged_files); do
    [ -f "$file" ] || continue
    case "$file" in
      *.lock|*.lockb|*.snap|*.png|*.jpg|*.jpeg|*.gif|*.pdf|*.zip|node_modules/*|dist/*|.git/*) continue ;;
    esac
    # Skip the security scan itself + test fixtures that quote known patterns.
    case "$file" in
      *security-scan*|*fixture*|*test-fixtures*) continue ;;
    esac
    while IFS=: read -r line content; do
      if echo "$content" | grep -qE '\b(AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36,}|sk-[A-Za-z0-9_-]{32,}|xoxb-[0-9A-Za-z-]+)\b'; then
        log_issue "api_key" "$file" "$line" "$content"
      fi
    done < <(grep -nE '\b(AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36,}|sk-[A-Za-z0-9_-]{32,}|xoxb-[0-9A-Za-z-]+)\b' "$file" 2>/dev/null || true)
  done
}

# ───── 2. Sensitive filenames (universal) ─────
# Block staging of .env, *.pem, *.key, .ssh/*, etc. .env.example is allowed.
scan_sensitive_files() {
  for file in $(staged_files); do
    case "$file" in
      .env|.env.local|.env.production|.env.staging|*.pem|*.p12|*.pfx|*.keystore|id_rsa|id_ed25519|id_ecdsa|.ssh/*)
        log_issue "sensitive_file" "$file" "0" "filename matches sensitive-file pattern; do not commit"
        ;;
    esac
  done
}

# ───── 3. atl-mcp: token encryption audit ─────
# Encrypted token storage MUST go through src/security/tokenStore.ts. Direct
# writes to the encryptedTokens table from anywhere else are a red flag.
scan_token_encryption() {
  for file in $(staged_files); do
    [ -f "$file" ] || continue
    case "$file" in
      *.ts|*.tsx) ;;
      *) continue ;;
    esac
    # Allow tokenStore.ts itself + the repository implementation.
    case "$file" in
      *tokenStore.ts|*encryptedTokenRepository.ts|*compositionRoot.ts) continue ;;
    esac
    while IFS=: read -r line content; do
      log_issue "token_encryption_bypass" "$file" "$line" "$content"
    done < <(grep -nE 'encryptedTokens\.|encryptedToken\.upsert|encryptedToken\.delete' "$file" 2>/dev/null || true)
  done
}

# ───── 4. atl-mcp: Drizzle migration safety ─────
# New migration files (src/storage/migrations/*.sql) that contain DROP TABLE
# or DROP COLUMN without an "IF EXISTS" guard, OR that lack a rollback note,
# are flagged. atl-mcp's audit chain depends on stable schema; destructive
# migrations need explicit operator review.
scan_migration_safety() {
  for file in $(staged_files); do
    case "$file" in
      src/storage/migrations/*.sql) ;;
      *) continue ;;
    esac
    [ -f "$file" ] || continue
    # Flag DROP TABLE/COLUMN without IF EXISTS.
    while IFS=: read -r line content; do
      log_issue "migration_destructive_no_guard" "$file" "$line" "$(echo "$content" | tr -d '\r')"
    done < <(grep -niE 'DROP\s+(TABLE|COLUMN)(\s+(?!IF\s+EXISTS))' "$file" 2>/dev/null || true)
    # Require a "-- rollback:" or "-- ROLLBACK:" comment block somewhere in the file.
    if ! grep -qiE -- '--\s*rollback' "$file"; then
      log_issue "migration_missing_rollback_note" "$file" "0" "no '-- rollback:' comment block found"
    fi
  done
}

# ───── 5. atl-mcp: Redis key injection ─────
# Redis keys must use a configured prefix (atl-mcp uses BullMQ which prefixes
# its own queue keys; bare ioredis writes from src/ are flagged unless they
# use the prefix utility).
scan_redis_keys() {
  for file in $(staged_files); do
    [ -f "$file" ] || continue
    case "$file" in
      *.ts|*.tsx) ;;
      *) continue ;;
    esac
    # Allow specific known integration sites.
    case "$file" in
      *queue/provisionQueue.ts|*provisionQueue.test.ts|*ioredis-mock*) continue ;;
    esac
    # Bare `redis.set(` or `client.set(` without going through a key-prefix helper
    # is flagged. This is heuristic; false positives go in the allow-list above.
    while IFS=: read -r line content; do
      log_issue "redis_key_no_prefix" "$file" "$line" "$content"
    done < <(grep -nE '\b(redis|client)\.(set|setex|hset|sadd|lpush|rpush)\(' "$file" 2>/dev/null || true)
  done
}

# ───── 6. atl-mcp: audit signing key handling ─────
# Files writing to AUDIT_SIGNING_PRIVKEY_PATH or holding ed25519 raw bytes
# outside compositionRoot.ts / auditChain.ts are flagged.
scan_audit_key_handling() {
  for file in $(staged_files); do
    [ -f "$file" ] || continue
    case "$file" in
      *.ts|*.tsx) ;;
      *) continue ;;
    esac
    case "$file" in
      *compositionRoot.ts|*auditChain.ts|*auditChain.test.ts) continue ;;
    esac
    while IFS=: read -r line content; do
      log_issue "audit_key_outside_known_sites" "$file" "$line" "$content"
    done < <(grep -nE 'AUDIT_SIGNING_PRIVKEY_PATH|generateAuditKeypair|loadAuditKeypair' "$file" 2>/dev/null || true)
  done
}

# ───── 7. Absolute home paths (operator's local machine leaking) ─────
scan_local_paths() {
  for file in $(staged_files); do
    [ -f "$file" ] || continue
    case "$file" in
      *.lock|*.lockb|*.snap|*.png|*.jpg|*.pdf|*.zip|*.framework-manifest.json|node_modules/*|dist/*|.git/*) continue ;;
      *.md|*.json) continue ;;  # Docs and configs may legitimately reference operator paths.
    esac
    while IFS=: read -r line content; do
      log_issue "local_path" "$file" "$line" "$content"
    done < <(grep -nE '/(Users|home)/[a-zA-Z0-9_-]+/' "$file" 2>/dev/null || true)
  done
}

# ───── Run all scans ─────
scan_api_keys
scan_sensitive_files
scan_token_encryption
scan_migration_safety
scan_redis_keys
scan_audit_key_handling
scan_local_paths

if [ "$FOUND_ISSUES" -ne 0 ]; then
  echo "" 1>&2
  echo "Security scan failed. Address the issues above or override with --no-verify (NOT recommended)." 1>&2
  exit 1
fi
exit 0
