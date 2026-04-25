# Partner Integration: everything-claude-code

## 1. Why this partner

**Category: C (spec / docs source).** everything-claude-code documents observed Claude Code plugin emission rules in v2.1+, specifically:

- **F-203**: `.claude-plugin/plugin.json` MUST NOT declare hooks (Claude v2.1+ auto-loads `hooks/hooks.json`) → §20.gotchas, §29 prompt 13 (when emitting Claude Code plugin)

**Gap closed**: v6 §29 prompt 13 prompts the LLM to generate a complete Claude Code plugin structure for an emitted agent. Without clarity on the hooks-declaration rule, auto-generated plugins fail to load in v2.1+. The rule is deterministic; document it as a §20 gotcha and embed in the prompt.

**Alternatives considered**: none — this is a Claude Code spec constraint from Anthropic, not a feature choice.

Findings reference: `repo-extraction-findings.md` line 1284, §40 F-203.

## 2. Prerequisites

N/A — spec reference; no runtime dependency.

## 3. Source provenance

Spec source: Claude Code v2.1+ behavior, observed via everything-claude-code's plugin examples. Pin Claude Code spec version (e.g., `claude-code 2.1.0`) in v6 §40 F-203 row. **No install required**; conformance referenced in v6 §20.gotchas + §29 prompt 13.

## 4. Configuration

N/A — spec reference.

## 5. Adoption points in v6

- **F-203** → **§20.gotchas** (operational rule: emitted plugin.json MUST NOT contain `hooks` field; Claude v2.1+ auto-discovers `hooks/hooks.json`) + **§29 prompt 13** (when orchestrator emits a Claude Code plugin for agent deployment, the plugin-generation prompt enforces this rule)

## 6. Pattern excerpts

**Correct plugin.json (no hooks key)**:
```json
{
  "name": "orchestrator-agent-smoke",
  "version": "1.0.0",
  "description": "Orchestrator-provisioned agent",
  "commands": [
    { "name": "preflight", "description": "Run preflight checks" }
  ]
}
```

**Separate hooks.json** (auto-loaded by Claude v2.1+):
```json
// .claude-plugin/hooks/hooks.json
{
  "SessionStart": { "handler": "src/hooks/sessionStart.ts" },
  "PreToolUse":   { "handler": "src/hooks/preToolUse.ts" }
}
```

## 7. Gotchas

1. **Pre-v2.1 Claude Code uses old plugin format.** Older versions expect `hooks` declared in plugin.json. Verify Claude Code version on deployment; for v2.0 and earlier, revert to inline hooks. Migration tooling outside v6 scope. (findings.md L1284; F-203)
2. **hooks.json discovery requires correct directory structure.** Claude Code v2.1+ looks for `hooks/hooks.json` relative to `.claude-plugin/`. Missing directory or file → hooks silently do not load; no warning. Verify directory tree before deployment. (findings.md L1284; F-203)
3. **plugin.json hooks field silently ignored on v2.1+.** A copy-paste mistake (`"hooks": {...}` in plugin.json) is silently ignored on v2.1+; Claude loads from `hooks/hooks.json` instead. Lint plugin.json to reject any top-level `hooks` key. (findings.md L1284; F-203)
4. **Downgrade path from v2.1+ to v2.0**: rolling back Claude Code requires restoring old plugin.json with inline hooks. Maintain dual variants (`plugin.v2.1.json` + `plugin.v2.0.json`) and deploy correct one per environment. (findings.md L1284; F-203)

## 8. Validation

```bash
# 1. Verify v6 §20.gotchas documents the rule
grep -n "MUST NOT declare hooks\|auto-loads.*hooks.json\|F-203" agent-context-orchestrator-mcp-plan-v6.md

# 2. Verify emitted plugin templates do NOT contain hooks key
grep -r '"hooks"' src/templates/plugin/plugin.json
# Expect: no output

# 3. Verify hooks.json exists separately
test -f src/templates/plugin/hooks/hooks.json && echo "ok"
```

## 9. Operational concerns

- **Spec ownership**: Claude Code specification owned by Anthropic, not this repo. plugin.json + hooks.json structure is part of Claude's public spec. Anthropic minor releases may change spec → require update to v6 §20.gotchas + §29 prompts.
- **Spec stability**: Claude Code v2.1+ has maintained the auto-load convention through point releases. Monitor Anthropic's Claude Code release notes for spec changes.
- **In-tree absorption**: rule documented in v6 §20.gotchas + `docs/claude-code.md` §plugin emission; plugin templates in `src/templates/plugin/`.
- **Conformance review per Claude Code minor version**: re-verify rule on each Claude Code release; bump pinned version in §40 F-203.
- **Migration strategy**: if Claude Code v3.0 changes plugin structure, plugin-emission prompts (§29 prompt 13) must be rewritten. Rule lives in prompt language, not code; updates fast but require human review.
