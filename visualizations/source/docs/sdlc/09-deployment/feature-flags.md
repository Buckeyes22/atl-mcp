---
title: Feature Flags
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, operator]
sdlc_category: 09-deployment
related: [docs/sdlc/09-deployment/release-process.md, docs/build-orchestration.md, docs/sdlc/09-deployment/environments.md]
---

# Feature Flags

> **TL;DR:** Milestone-gated flags (`MILESTONE_4_ENABLED` through `MILESTONE_11_ENABLED`) toggle whether each milestone's MCP tools, resources, and workflows are exposed at runtime. Flags are env-var-only — no runtime mutation. v1 has no A/B / experimentation flags. Flags exist purely to keep half-built milestones from leaking into shipped behavior.

The flag conventions are intentionally small. atl-mcp does NOT have a general-purpose feature-flag service.

---

## Why feature flags exist (and don't)

**Why they exist (legit uses):**

- A milestone's tool surface is partially implemented. The flag keeps it off in production while allowing dev / staging tests.
- Cumulative gates (per [`ci-cd.md`](ci-cd.md)) only stay green if half-built tools don't auto-load.
- Operator can selectively enable a milestone post-deploy without redeploying.

**Why they don't (anti-patterns):**

- atl-mcp does NOT use feature flags for A/B testing.
- atl-mcp does NOT use feature flags for personalization.
- atl-mcp does NOT use feature flags for runtime behavior changes (no LaunchDarkly, no Unleash, no flag service in v1).

The discipline: a flag is a transient lifecycle state, not a permanent toggle. When a milestone closes, its flag goes away (defaults to true; flag conditional removed from code).

---

## Flag inventory

| Flag | Default | What it gates |
|---|---|---|
| `MILESTONE_4_ENABLED` | `false` | Intake + blueprint workflows; sampling provider chain |
| `MILESTONE_5_ENABLED` | `false` | Provisioning planner; provision_preview tool |
| `MILESTONE_6A_ENABLED` | `false` | Jira provisioning executor; provision_execute tool against Jira |
| `MILESTONE_6B_ENABLED` | `false` | Confluence provisioning executor |
| `MILESTONE_6C_ENABLED` | `false` | VCS provisioning executor; worktree per-session |
| `MILESTONE_7_ENABLED` | `false` | Context resources + packs; context_pack_generate / context_get tools |
| `MILESTONE_8_ENABLED` | `false` | Readiness validation; readiness_validate tool |
| `MILESTONE_9_ENABLED` | `false` | Agent handoff; generateHandoff tool |
| `MILESTONE_10_ENABLED` | `false` | Webhook ingestion; ingestWebhook tool + dedup table writes |
| `MILESTONE_11_ENABLED` | `false` | Notifications + evals + hardening features |

`MILESTONE_0_*` through `MILESTONE_3_*` are not flags — they're considered baseline (M0–M3 ship in v0.1). The implementation removes the flag conditionals when each milestone closes.

## Lifecycle of a flag

1. **Born** — flag added when a milestone's first PR lands. Default `false`.
2. **Lives** — stays off in production; toggled true in dev / staging for testing.
3. **Dies** — when the milestone closes:
   - Flag default flips to `true`.
   - All code conditioned on `if (flags.MILESTONE_X_ENABLED)` is uncondititioned.
   - Flag is removed from `src/config/env.ts`.
   - Doc updated; this table reflects the deletion.

A flag that lives more than two minor versions is a code smell. Either the milestone is taking too long, or the flag is being treated as permanent (anti-pattern).

## How flags are read

`src/config/env.ts` parses each `MILESTONE_*_ENABLED` env var as a boolean. The result is held in a frozen `flags` object that's read at startup and not re-read.

```typescript
// Pseudocode
const flags = {
  m4: readBoolean("MILESTONE_4_ENABLED", false),
  m5: readBoolean("MILESTONE_5_ENABLED", false),
  // ...
}
```

Tools / workflows / resources check the flag at registration time:

```typescript
if (flags.m4) {
  registerTool(projectIntakeCreateTool)
  registerTool(projectBlueprintGenerateTool)
}
```

This means: **changing a flag requires restart.** No runtime hot-toggle. This is intentional — runtime mutation is a class of bug we don't want.

## Per-tier defaults

| Tier | Flag default behavior |
|---|---|
| `dev` | All flags `true` by default; can override individually for testing the closed-flag path |
| `test` | Each test fixture sets the flags it needs; no global default |
| `staging` | Flags match the next-release plan; e.g., M6a flag is `true` if M6a is shipping next |
| `production` | Flags conservative; off until milestone proven in staging |

Tier-specific defaults live in `src/config/env.ts`. Override always works via env var.

## What flags do NOT control

- Cryptographic / security primitives (always on in production code).
- Audit chain (always emitting, always signing).
- Health endpoints (always served).
- Migrations (always running).
- Token encryption (always encrypting).

Security and integrity invariants are not flag-conditional, ever.

---

## Anti-patterns to avoid

- **Permanent flags.** A flag with no removal date is dead weight. Track each flag's expected close milestone.
- **Conditioning on flag at runtime.** Flag check should be at registration / startup, not inside hot paths. Hot-path checks are a smell.
- **Flag-of-flag.** Don't gate flag behavior on another flag. If you need it, you need a state machine.
- **Flag-conditioned tests.** Tests should run against the flag-on path AND the flag-off path. CI runs both.

---

## Linked artifacts

- **Code:** `src/config/env.ts`, `src/mcp/registerTools.ts` (flag-gated tool registration)
- **Sibling docs:** [`release-process.md`](release-process.md), [`environments.md`](environments.md), [`ci-cd.md`](ci-cd.md)
- **Spec:** v6 §28 (milestones), §22 (transport)
- **Build sequence:** [`../../build-orchestration.md`](../../build-orchestration.md)

---

*Last reviewed: 2026-04-25 by Chris.*
