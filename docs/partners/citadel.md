# Partner Integration: Citadel

## 1. Why this partner

**Category: B (pattern-lift).** Citadel is a production agent-orchestration harness contributing 2 patterns to v6:

- **F-141**: Fleet pattern: discovery-brief compression (~500 tokens per wave) → §24.4, §38.4
- **F-142**: Claim-based scope coordination (`.planning/coordination/claims/`); 5-section skill format (Identity / Orientation / Protocol / Quality Gates / Exit) → §17.6, §24.4, §38.4

**Gap closed**: v6 §24.4 specifies the Fleet pattern for parallel agent waves; §38.4 needs concrete coordination primitives; §17.6 needs a canonical skill format. Citadel provides battle-tested implementations: 6–8× compression on wave outputs without losing decision context, file-based scope claims to prevent two agents claiming the same work, and a 5-section skill format that standardizes 50+ skills.

**Alternatives considered**: design Fleet brief format from scratch (rejected — Citadel's 500-token target is empirically validated); use distributed-lock service for claims (rejected — file-based is simpler for v1 single-tenant).

Findings reference: `repo-extraction-findings.md` lines 1060–1071, §40 F-141, F-142.

## 2. Prerequisites

N/A — pattern-lift. Algorithmic patterns + file-format conventions; no library to consume at runtime.

## 3. Source provenance

Citadel reference repo (internal/organizational). Pin commit SHA in v6 §40 F-141 row. **No install required**: patterns absorbed into v6 §24.4 (Fleet) and §17.6 (skill format).

## 4. Configuration

### 4.1 Environment variables

N/A — pattern-lift.

### 4.2 Config file overlays

```yaml
fleet:
  briefs:
    directory: .planning/fleet/briefs/
    targetTokens: 450             # 500 with 10% headroom for tokenizer drift
    pinPriorBriefsInWaveN: true   # inject all prior briefs into wave 2+

coordination:
  claims:
    directory: .planning/coordination/claims/
    defaultTtlSeconds: 3600
    retryBackoffBaseMs: 100
    retryBackoffMaxMs: 5000

skills:
  format:
    canonicalSections:
      - Identity
      - Orientation
      - Protocol
      - "Quality Gates"
      - Exit
    enforceOrder: true
```

## 5. Adoption points in v6

- **F-141** → **§24.4** (Fleet pattern: discovery-brief compression — after each Fleet wave, compress agent output to ~500-token brief at `.planning/fleet/briefs/{agentId}-wave{N}.md`; wave 2+ injects ALL prior briefs to prevent rediscovery; achieves 6–8× compression) + **§38.4** (cross-cutting coordination)
- **F-142** → **§17.6** (5-section skill format: Identity / Orientation / Protocol / Quality Gates / Exit — applied to all 50+ orchestrator skills) + **§24.4** + **§38.4** (claim-based scope coordination: file-based locks at `.planning/coordination/claims/{scope}.json` containing `{agent_id, claim_timestamp, ttl_seconds, reason}`)

## 6. Pattern excerpts

**Discovery-brief template** (~500 tokens, `.planning/fleet/briefs/{agentId}-wave{N}.md`):
```markdown
# Agent <agentId> Wave <N> Discovery Brief

## Identity
Role: <role>; Scope: <scope>; Artifacts: N items

## Orientation
Prior waves: [brief A, brief B]. Key decisions: [list].

## Key Findings
- Finding 1 (decision impact)
- Finding 2 (risk flagged)
- Finding 3 (blocker identified)

## Handoff
Next wave: <action>. Avoid: <pitfalls>. Pre-reqs: <setup>.
```

**Claim file** (`.planning/coordination/claims/{scope}.json`):
```json
{
  "scope": "subsystem-auth",
  "agent_id": "fleet-agent-2",
  "claim_timestamp": "2026-04-24T12:34:56Z",
  "ttl_seconds": 3600,
  "reason": "Refactoring OAuth 2.0 integration"
}
```

**5-section skill format** (template for `skills/<name>.md`):
```markdown
# Skill: <name>

## Identity
Purpose; role assumption; required context.

## Orientation
When to invoke; prerequisite state; similar skills.

## Protocol
Step-by-step; tool surface; examples.

## Quality Gates
Exit criteria; error handling; validation.

## Exit
Success summary; artifact locations; next skill.
```

## 7. Gotchas

1. **500-token brief drift under model-choice variance**: token count varies ±10% between Haiku/Sonnet/Opus tokenizers. Set `targetTokens: 450` for headroom; monitor brief lengths in CI. (findings.md L1061; F-141)
2. **Claim deadlock when 2+ agents claim same scope simultaneously**: if writes to `claims/scope.json` collide in same millisecond, last write wins silently. Mitigation: read-check before claim (`stat claims/scope.json && exit 1`); retry with exponential backoff (base 100ms, max 5s). (findings.md L1063; F-142)
3. **Claim-file race conditions on Windows**: Windows file-locking is not POSIX-compatible; rename-to-swap (atomic on POSIX) is not atomic on Windows. Use `fs.promises.writeFile` with tmp→final pattern + `.lock` sentinel. (findings.md L1064; F-142)
4. **5-section skill-format header rigidity**: 5 headings (Identity / Orientation / Protocol / Quality Gates / Exit) must appear in order with exact names. Tools parsing skill files by header break on variants like "Invocation" or "Prerequisites". Enforce via linter. (findings.md L1067; F-142)

## 8. Validation

```bash
# 1. Verify §24.4 documents Fleet brief compression
grep -nE "discovery.brief|wave.*brief|500.*token" agent-context-orchestrator-mcp-plan-v6.md | head -5

# 2. Verify §17.6 enumerates 5 sections
grep -E "Identity.*Orientation.*Protocol.*Quality Gates.*Exit" agent-context-orchestrator-mcp-plan-v6.md

# 3. Verify §38.4 cross-references F-141 + F-142
grep -A3 "§38.4\|## 38.4" agent-context-orchestrator-mcp-plan-v6.md

# 4. Skill format linter
orchestrator cli skills lint --check-format
# Expect: all skills pass 5-section validation
```

## 9. Operational concerns

- **Upstream archival risk: low.** Citadel is internal organizational repo; archival risk is low. Patterns are algorithmic + file-format conventions, not code to rot. If Citadel archived, patterns persist in v6 §24.4, §38.4, §17.6 + `src/coordination/claims/` + `src/skills/format.ts`.
- **In-tree absorption**: brief compression in `src/workflows/fleetOrchestration.ts`; claims in `src/coordination/claimsManager.ts`; skill-format enforcement in `src/skills/format.ts` + linter.
- **Extensibility**: brief format and claim-file schema are stable conventions. Future Fleet agents (Wave 3+, different orchestrator versions) following same conventions interoperate seamlessly.
- **Promotion**: not applicable — patterns, not runtime code.
