# Partner Integration: adr.github.io

## 1. Why this partner

**Category: C (spec / docs source).** adr.github.io provides the canonical ADR governance framework referenced by v6 §9 (ADR conventions):

- **F-123**: START Criteria + Definition of Done 5-element checklist for ADR governance → §9

**Gap closed**: v6 §9 adopts MADR (F-122) as the template and adr.github.io's START + DoD as the governance layer. START Criteria establish Definition of Ready for ADRs; DoD checklist gates merge. Together they prevent ADR-bureaucracy drift while ensuring rigor.

Findings reference: `repo-extraction-findings.md` lines 1020–1025, §40 F-123.

## 2. Prerequisites

N/A — spec reference; no installation.

## 3. Source provenance

**Spec source**: https://adr.github.io/ (community-maintained ADR reference site). Pin spec snapshot in v6 §40 F-123 row. **No install required**; governance referenced in v6 §9.

## 4. Configuration

N/A — spec reference.

## 5. Adoption points in v6

- **F-123** → **§9** (ADR conventions: every decision record must satisfy START Criteria at write-time and pass the 5-element Definition of Done before merge; conformance enforced by pre-commit hooks and PR review gate per §18.2)

## 6. Pattern excerpts

**START Criteria** (Definition of Ready for ADRs):
- **S**ignificant — impacts API, architecture, or cost
- **T**eam-enabled — team has capacity to implement
- **A**greed — supermajority of stakeholders signed off in `decision-makers`
- **R**eviewed — at least one other architect reviewed the alternatives
- **T**imely — non-urgent decisions batch monthly; urgent decisions escalate per §30.5

**Definition of Done 5-element checklist**:
1. **Decision recorded** — `docs/adr/NNNN-title.md` exists, named per MADR convention
2. **Rationale documented** — Consequences section lists Good/Bad/Neutral; Considered Options enumerate ≥2 alternatives with rejection reasons
3. **Alternatives considered** — MADR "Decision Outcome" explains why the chosen option was selected
4. **Consequences listed** — explicit Good/Bad/Neutral consequences; no vague "TBD" entries
5. **Status set** — frontmatter `status` field is one of `proposed`/`accepted`/`superseded`/`deprecated`; never blank

## 7. Gotchas

1. **Criteria interpretation drift**: "Significant" is project-relative. A schema change is Significant for v6's persistent layer (§20) but not for internal utility refactoring. Define Significance thresholds in `docs/adr/0000-adr-process.md` to prevent criteria creep. (findings.md L1020; F-123)
2. **"Active" vs "Accepted" status confusion**: MADR uses `accepted` to mean "approved and in effect"; there is no "active" status. Rejected decisions are `superseded` (by which ADR) or `deprecated` (no replacement). Enforce via linter. (findings.md L1022; F-123)
3. **DoD checklist gaming**: "Rationale documented" is not "I wrote something" — PR reviewers must verify Consequences actually describe trade-offs, not marketing language. Anti-pattern: "Good: fast, Bad: uses memory" without numbers. Require quantified consequences (latency SLO, memory budget, cost delta). (findings.md L1023; F-123)
4. **Governance overhead killing adoption**: START can feel like bureaucracy if not coupled to expedited review for urgent decisions. Establish a fast-track lane: PM-urgent + decision-maker sign-off within 24h bypasses "Timely" criterion. Document the exception in `docs/adr/0000-adr-process.md` to legitimate it. (findings.md L1024; F-123)

## 8. Validation

```bash
# 1. Verify v6 §9 documents START + DoD
grep -nE "START Criteria|Definition of Done|Significant.*Team-enabled|S.T.A.R.T" agent-context-orchestrator-mcp-plan-v6.md

# 2. Status field validity
grep -r "^status:" docs/adr/ | grep -vE "(proposed|accepted|superseded|deprecated)"
# Expect: empty

# 3. Consequences non-empty
for f in docs/adr/[0-9]*.md; do
  grep -q "^## Consequences" "$f" && \
  grep -A20 "^## Consequences" "$f" | grep -qE "Good|Bad" || echo "missing consequences: $f"
done

# 4. CI conformance gate
test -f .github/workflows/adr-conformance.yml && echo "ok: ADR conformance workflow present"
```

## 9. Operational concerns

- **Spec stability**: adr.github.io is maintained by the ADR community (Karl Wiegers et al.) and stable since ~2013. Conformance review per orchestrator minor version (annually) is sufficient; no breaking changes expected.
- **Process documentation**: orchestrator's adoption of START + DoD lives in `docs/adr/0000-adr-process.md` (this is itself an ADR-formatted process doc).
- **Tooling**: optional `@adr/cli` (npm) generates and lints MADR. Integrate into project template if desired.
- **In-tree absorption**: governance documented in v6 §9 + `docs/adr/0000-adr-process.md`; CI conformance check at `.github/workflows/adr-conformance.yml`.
- **Promotion**: not applicable.
- **Disaster recovery**: ADRs are git-tracked; backup with repo.
