# Velocity-ops content (lifted)

Structured prose lifted from `velocity-ops-engine` per
[`docs/velocity-ops-port-plan.md`](../velocity-ops-port-plan.md).
atl-mcp's M4–M9 tools read from this directory at runtime to drive intake,
blueprint synthesis, Confluence page generation, and repo scaffolding.

## Layout

| Subdir | What's there | Used by |
|---|---|---|
| `phases/` | 6 lifecycle phase READMEs (intake, discovery, scoping, setup, architecture, handoff) | M4 (intake + blueprint synthesis prompt scaffolding); M5 (planner); M9 (handoff readiness gate) |
| `templates/` | 16 generation templates (project-brief, PRD, ADR, SLO, threat-model, feature-spec, runbook, …) | M6b (Confluence page generation) and M6c (repo scaffold seed files) |
| `agents/` | 13 agent role cards (architect, researcher, thinking-partner, implementer, tester, reviewer, …) | M4 (synthesis personas); M9 handoff bundle (build-phase persona library) |
| `workflows/` | 7 orchestration patterns (multi-agent-flow, feature-flow, decision-flow, …) | M5 (planner sub-procedures); M9 (build-phase orchestration) |

## Why these are physically copied here

- **Same-repo source-of-truth.** atl-mcp tools at runtime read deterministic paths under its own repo, not a sibling directory that may or may not exist on a given machine.
- **Auditability.** When a generated Confluence page or a repo scaffold ships, the audit chain references the exact `docs/velocity-ops-content/...` path. That path's content has a SHA in `.framework-manifest.json`, so the rendering is reproducible.
- **License posture.** Both repos belong to the same operator. The lift is intra-portfolio. Per-template attribution lives in the template's own front matter where applicable.

## What's NOT lifted

The full velocity-ops-engine has 68 templates, 38 stack modules, and 40 commands.
Only the in-scope subset for atl-mcp's M4–M9 lives here. The rest stay in
`velocity-ops-engine/`; consult the port plan's Section F for the skip list and the
reasoning per item.

## Updating

This is a snapshot. When velocity-ops-engine evolves, run a small re-sync
script (TBD) that diffs the source against this dir and surfaces drift.
Manual merges follow the catalog rule in [`CLAUDE.md`](../../CLAUDE.md).
