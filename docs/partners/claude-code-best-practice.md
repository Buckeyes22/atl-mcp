# Partner Integration: claude-code-best-practice

## 1. Why this partner

**Category: C (spec / docs source).** claude-code-best-practice documents hook-event dispatch behavior in Claude Code:

- **F-204**: Only 6 of 27 Claude Code hook events fire in agent contexts → §20.gotchas, `docs/claude-code.md`

**Gap closed**: v6 emits Claude Code plugins (§29 prompt 13). Without knowing which hook events fire in agent contexts (vs interactive contexts), emitted plugins silently fail. Documenting the 6-of-27 firing constraint as a §20 gotcha and referencing it in `docs/claude-code.md` (when emitted) prevents wasted hook declarations.

Findings reference: `repo-extraction-findings.md` line 1285, §40 F-204.

## 2. Prerequisites

N/A — spec reference; no runtime dependency.

## 3. Source provenance

Spec source: Claude Code v2.1+ hook-dispatch behavior. Pin Claude Code spec version in v6 §40 F-204 row. **No install required**; conformance referenced in v6 §20.gotchas + `docs/claude-code.md`.

## 4. Configuration

N/A — spec reference.

## 5. Adoption points in v6

- **F-204** → **§20.gotchas** (operational rule: only 6 of 27 hook events fire in agent contexts; remaining 21 fire only in interactive sessions or not at all) + **`docs/claude-code.md`** (when orchestrator emits Claude Code integration guide, the firing-event list is documented for plugin authors)

## 6. Pattern excerpts

Hook events that **DO** fire in agent contexts (canonical list — verify against current Claude Code release before relying on):
- `PreToolUse`
- `PostToolUse`
- `PermissionRequest`
- `PostToolUseFailure`
- `Stop`
- `SubagentStop`

Remaining 21 events (`SessionStart`, `ToolOutputReady`, `Idle`, etc.) fire only in interactive mode or do not fire in agent contexts. For canonical authoritative list, consult Claude Code spec and cross-reference findings.md L1285.

## 7. Gotchas

1. **Hook events fail silently in agent contexts.** A hook declaration targeting `SessionStart` or any of the 21 non-firing events will not be invoked when the plugin runs in an agent session. No error surfaced to plugin author or orchestrator. Mitigation: audit hook declarations against the 6 firing events; remove/mark obsolete any non-firing hooks. (findings.md L1285; F-204)
2. **No error on misconfigured hooks.** Claude Code does not validate that declared hooks correspond to supported events; silently ignores unsupported. Test hook invocation in a real agent session before production deployment. (findings.md L1285; F-204)
3. **Agent context vs interactive context distinction is not exposed via metadata.** A plugin cannot detect at runtime which context it's in and conditionally define hooks. Mitigation: author two hook definitions (agent-optimized + interactive-optimized) and choose at plugin-emit time, or accept that some hooks won't fire. (findings.md L1285; F-204)
4. **Spec changes per Claude Code release.** The 6 firing events and total count (27) are pinned to current Claude Code version. Point releases may add events or change dispatch. Update v6 §20.gotchas + §40 F-204 row whenever Claude Code is upgraded; re-validate hook declarations. (findings.md L1285; F-204)

## 8. Validation

```bash
# 1. Verify v6 §20.gotchas documents the 6-of-27 rule
grep -nE "Only 6 of 27|6 of 27 hook|F-204" agent-context-orchestrator-mcp-plan-v6.md

# 2. Verify docs/claude-code.md (when present) lists firing events
grep -nE "PreToolUse|PostToolUse|PermissionRequest|SubagentStop" docs/claude-code.md 2>/dev/null

# 3. Audit emitted plugin hooks against firing list
for h in $(jq -r 'keys[]' src/templates/plugin/hooks/hooks.json 2>/dev/null); do
  echo "$h" | grep -qE "PreToolUse|PostToolUse|PermissionRequest|PostToolUseFailure|Stop|SubagentStop" \
    && echo "ok: $h" || echo "FAIL: $h not in firing list"
done
```

## 9. Operational concerns

- **Spec ownership**: Anthropic-owned Claude Code specification. No external maintenance burden.
- **Conformance review per release**: whenever Claude Code is upgraded, re-run §8 validation and bump spec version in §40 F-204 + `docs/claude-code.md`. Low-effort check (a few greps) preventing silent hook failures.
- **In-tree absorption**: rule documented in v6 §20.gotchas + `docs/claude-code.md` §plugin emission.
- **Partner repo context**: claude-code-best-practice is a documentation artifact. Orchestrator has zero runtime dependency; reference for plugin authors and v6 conformance record.
- **Promotion**: not applicable.
