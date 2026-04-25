# Partner Integration: agents.md

## 1. Why this partner

**Category: C (spec / docs source).** agents.md is the canonical specification reference for agent configuration format conventions. It defines the **Linux Foundation AGENTS.md format** (Jan 2026) — four canonical sections (Dev environment tips / Testing instructions / PR instructions / Coding conventions) standardizing how AI coding agents document setup, tests, PR conventions, and code style.

- **F-121**: Canonical AGENTS.md spec sections → §9 (AGENTS.md conventions)

**Gap closed**: v6 §9 designates this as the authority for the orchestrator's AGENTS.md schema. The `scripts/syncAgentConfigs.ts` script (project-foundation-workbench F-085) regenerates downstream agent configs (`.cursor/rules/`, `.codex/config.toml`, `.github/copilot-instructions.md`) from the canonical AGENTS.md to ensure no drift across Cursor, Codex, and GitHub Copilot.

Findings reference: `repo-extraction-findings.md` lines 1017–1019, §40 F-121.

## 2. Prerequisites

N/A — spec reference; no installation required.

## 3. Source provenance

**Spec source**: https://agents.md (Linux Foundation reference). **Spec version pinned in v6**: Jan 2026 release. Pin in v6 §40 F-121 row. **No install required**; conformance referenced in v6 §9 + enforced by `scripts/syncAgentConfigs.ts`.

## 4. Configuration

N/A — spec reference.

## 5. Adoption points in v6

- **F-121** → **§9** (AGENTS.md conventions: orchestrator's `AGENTS.md` MUST include all four canonical sections; sections may extend with subsections but the four headings are non-negotiable; downstream tooling — Cursor / Codex / Copilot configs — regenerated from this canonical file via `scripts/syncAgentConfigs.ts`)

## 6. Pattern excerpts

**Four canonical AGENTS.md section headings** (LF spec, Jan 2026):

1. **Dev environment tips** — runtime requirements (Node version, Python, Docker), pre-commit setup, local tooling checklist.
2. **Testing instructions** — how to invoke tests (npm test, pytest, etc.), expected outputs, coverage thresholds, env assumptions.
3. **PR instructions** — commit message conventions, branch naming, code review checklist, CI gate expectations, approval process.
4. **Coding conventions** — language-specific style guide cross-references, import/export rules, naming patterns, documentation requirements, file organization.

**Example skeleton**:
```markdown
# AGENTS

## Dev environment tips
- Node.js 22+
- Run `pnpm install` to set up
- Run `cp .env.example .env` and fill secrets

## Testing instructions
- `pnpm test` for unit tests
- `pnpm test:integration` for integration tests
- Coverage threshold: 80%

## PR instructions
- Conventional commits format
- Branch naming: `feat/<scope>` or `fix/<scope>`
- Require 1 code review approval

## Coding conventions
- TypeScript strict mode
- Import order: stdlib → external → internal
- Keep files focused and split when it improves reviewability or ownership
```

## 7. Gotchas

1. **Spec evolution risk**: agents.md is maintained by Linux Foundation; may introduce new sections or subdivisions in future releases. Monitor agents.md changelog; when v6 §9 pins a new spec version, validate that orchestrator's AGENTS.md remains conformant. (findings.md L1018; F-121)
2. **Optional vs mandatory ambiguity**: some orgs interpret sections as optional or treat subsections as equivalent to top-level sections. v6 §9 is explicit: all four sections required. Partial AGENTS.md (e.g., omitting Testing) cause `syncAgentConfigs.ts` to emit warnings and risk silent config omissions in downstream agent configs. (findings.md L1018; F-121)
3. **Multiple AGENTS.md per repository**: large repos may place AGENTS.md in subdirectories (root, src/, docs/). agents.md spec does not forbid this but does not specify precedence. v6 §35.5 (unidirectional sync) treats root AGENTS.md as canonical; subdirectory variants ignored by `syncAgentConfigs.ts`. (findings.md L1019; F-121)
4. **Priority when CLAUDE.md exists alongside**: CLAUDE.md is project-specific, hand-authored guidance (v6 §9 notes it intentionally diverges from AGENTS.md). agents.md AGENTS.md is the agent contract. Operators must not confuse them: sync scripts consume AGENTS.md only; CLAUDE.md changes do not propagate to .cursor / .codex / .github configs. (findings.md L1019; F-121)

## 8. Validation

```bash
# 1. Verify v6 §9 lists 4 spec sections
grep -nE "Dev environment tips|Testing instructions|PR instructions|Coding conventions" agent-context-orchestrator-mcp-plan-v6.md

# 2. Validate that AGENTS.md contains all four required sections
grep -E "^##\s+(Dev environment tips|Testing instructions|PR instructions|Coding conventions)" AGENTS.md
# Expect: 4 matches

# 3. Regenerate configs and check for drift
pnpm exec ts-node scripts/syncAgentConfigs.ts --agents AGENTS.md
git diff .cursor/rules/agents.mdc .codex/config.toml .github/copilot-instructions.md
# Expect: regenerated files; no manual-edit drift
```

## 9. Operational concerns

- **Spec ownership**: Linux Foundation owns agents.md spec. Orchestrator's conformance is versioned per v6 release; each v6 point release pins an agents.md spec commit/release tag in §9.
- **Conformance review triggers**: (a) new v6 minor or major release planned; (b) breaking spec change announced (new mandatory sections, schema changes); (c) operators report incompatibility with downstream tooling.
- **In-tree absorption**: AGENTS.md template at repo root; sync script in `scripts/syncAgentConfigs.ts`; conformance documented in v6 §9.
- **Backward compatibility**: not guaranteed across major spec versions. Plan v6 §9 spec-pin upgrade in coordination with agent ecosystem releases.
- **Promotion**: not applicable — spec, not runtime code.
