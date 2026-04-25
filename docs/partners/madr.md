# Partner Integration: madr

## 1. Why this partner

**Category: C (spec / docs source).** madr (Markdown ADR) provides the lightweight, git-native ADR template framework adopted by v6:

- **F-122**: MADR template structure (`NNNN-decision-title.md` + frontmatter + Consequences Good/Bad/Neutral) → §8 (repo structure), §9 (ADR conventions)

**Gap closed**: v6 §8 specifies `docs/adr/` as the home for architectural decisions. madr provides the template structure and naming scheme that enforce consistency without requiring an MCP, database, or CI plugin. The Good/Bad/Neutral consequence taxonomy aligns with v6's qualification framework (§17.1, §17.2).

Findings reference: `repo-extraction-findings.md` lines 1026–1030, §40 F-122.

## 2. Prerequisites

N/A — spec reference. Tools optional: `adr-tools` / `madr-cli` for scaffolding new ADRs.

## 3. Source provenance

**Spec source**: https://madr.github.io/ (MADR 4.0 as of 2024). Pin spec version in v6 §40 F-122 row. **No install required**; conformance enforced via repo convention + linter.

## 4. Configuration

N/A — spec reference. Directory structure documented in §8.

## 5. Adoption points in v6

- **F-122** → **§8** (`docs/adr/` directory hosts MADR-formatted ADRs) + **§9** (ADR conventions: filename `NNNN-decision-title.md`, optional YAML frontmatter, Consequences Good/Bad/Neutral subsections; readiness review §17.3 includes ADR conformance check)

## 6. Pattern excerpts

**Filename**: `NNNN-decision-title.md` (zero-padded number).

**Frontmatter (optional YAML)**:
```yaml
status: proposed | accepted | superseded | deprecated
date: 2026-04-25
deciders: [person-a, person-b]
consulted: [person-c]
informed: [team-x]
```

**Sections (in order)**:
1. Title (H1)
2. Status
3. Context
4. Decision Drivers
5. Considered Options
6. Decision Outcome
7. Consequences (Good / Bad / Neutral subsections)
8. Pros and Cons (optional table)
9. More Information

## 7. Gotchas

1. **ADR number collision in parallel branches**: NNNN assigned sequentially on main; if two branches both create `0042-*.md`, merge conflict is inevitable. Mitigation: assign numbers only on merge to main, or use timestamps as tie-breaker during parallel development. (findings.md L1028; F-122)
2. **Status field enum is not free-form**: MADR specifies `status ∈ {proposed, accepted, superseded, deprecated}`. Do not invent new statuses ("on-hold", "rejected"). Inactive decisions use `superseded` + reference to successor ADR. (findings.md L1028; F-122)
3. **Date field timezone conventions**: MADR does not mandate a timezone. Adopt ISO 8601 (YYYY-MM-DD) for all ADRs; omit time-of-day unless decision was made in a specific hour (rare). (findings.md L1029; F-122)
4. **Good/Bad/Neutral consequence interpretation is subjective**: "good" = favorable to stated drivers; "bad" = adverse; "neutral" = trade-off without clear valence. Relative to decision context, not absolute. Review (§17.2 verdict layer) escalates ambiguous statements to human review. (findings.md L1027; F-122)
5. **Frontmatter is optional but recommended**: without it, parser tools (ADR indexers, linters) cannot extract metadata. Always populate `status`, `date`, `deciders`. (findings.md L1028; F-122)

## 8. Validation

```bash
# 1. Verify v6 §9 references MADR template
grep -n "MADR\|NNNN-decision-title\|Consequences.*Good.*Bad.*Neutral" agent-context-orchestrator-mcp-plan-v6.md

# 2. Naming convention
ls docs/adr/ | grep -E "^[0-9]{4}-[a-z0-9-]+\.md$"
# Expect: all files match pattern

# 3. Status field validity
grep "^status:" docs/adr/*.md | grep -vE "(proposed|accepted|superseded|deprecated)"
# Expect: empty output

# 4. Consequences section structure
grep -A 10 "^## Consequences" docs/adr/*.md | grep -E "###.*Good|###.*Bad|###.*Neutral"
# Expect: matches in all ADRs that have Consequences
```

## 9. Operational concerns

- **Spec stability**: MADR is community-maintained, stable since 2016. MADR 4.0 backward-compatible with 3.x. Conformance review per orchestrator minor version + annually against latest MADR spec.
- **Upgrade path**: MADR minor versions are additive (new optional sections); no migration required for existing ADRs.
- **In-tree absorption**: ADR template at `docs/adr/0000-template.md`; conformance documented in v6 §8/§9; linter rules enforced in CI.
- **Ownership**: orchestrator team owns `docs/adr/` + conformance audit. MADR community owns the spec; orchestrator adopts without modification.
- **Partner repo archived/abandoned scenario**: madr is a stable specification; if upstream stalls, MADR 4.0 covers all foreseeable use cases. No runtime dependency on madr tooling. Safe.
- **Promotion**: not applicable.
