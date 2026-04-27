# Requirements Catalog: [Project Name]

**Brief ID:** BRIEF-{PROJECT}
**Source Brief:** [path/to/project-brief.md]
**Status:** [Draft | Under Review | Approved]
**Last Updated:** YYYY-MM-DD

---

## 1. Purpose

[One paragraph maximum. This catalog turns business intent into explicit, stable requirement records. It is the canonical source of `REQ-{DOMAIN}-{NNN}` identifiers for this project.]

---

## 2. Traceability Rules

| Layer | ID Format | Source of Truth | Notes |
|---|---|---|---|
| Business intent | `BRIEF-{PROJECT}`, `WF-{DOMAIN}-{NN}` | Project brief | Each requirement cites at least one upstream intent reference |
| Requirement | `REQ-{DOMAIN}-{NNN}` | This catalog | Stable once assigned; do not renumber after features or specs reference it |
| Feature | `FEAT-{DOMAIN}-{NNN}` | Feature inventory / feature spec | One requirement may map to one or many features |
| Spec | `SPEC-{DOMAIN}-{FEAT}-{NN}` | Implementation spec | Specs inherit requirement coverage through the parent feature; `{FEAT}` reuses the parent feature sequence |

If a requirement is cross-cutting, assign one owning domain prefix and record the other impacted domains in notes instead of creating duplicate IDs.

---

## 3. Domain Summary

| Domain | Prefix | Business Intent Refs | Requirement Range | Notes |
|---|---|---|---|---|
| [Domain name] | [AUTH] | [WF-AUTH-01, WF-AUTH-02] | [REQ-AUTH-001 to REQ-AUTH-00N] | [Key theme or boundary note] |

---

## 4. Requirement Records

Repeat this section for each domain prefix from the project brief.

### Domain: [Domain Name] ([PREFIX])

| Requirement ID | Type | Priority | Requirement Statement | Upstream Refs | Candidate Feature IDs | Current Coverage | Notes |
|---|---|---|---|---|---|---|---|
| REQ-{DOMAIN}-001 | [Functional | Non-Functional | Constraint] | [P0 | P1 | P2] | [System MUST / SHOULD / MUST NOT ...] | [BRIEF-{PROJECT}, WF-{DOMAIN}-01, Section 5.3] | [FEAT-{DOMAIN}-001 or "Unassigned"] | [Implemented | Partial | Missing | Unknown] | [Evidence, rationale, or dependency note] |
| REQ-{DOMAIN}-002 | [Functional | Non-Functional | Constraint] | [P0 | P1 | P2] | [Requirement statement] | [WF ref(s)] | [FEAT-{DOMAIN}-002] | [Implemented | Partial | Missing | Unknown] | [Notes] |

---

## 5. Cross-Cutting Requirements

Use this section for requirements that apply across multiple domains but still need explicit IDs.

| Requirement ID | Owning Prefix | Requirement Statement | Affected Domains | Candidate Feature IDs | Notes |
|---|---|---|---|---|---|
| REQ-{OWNING_PREFIX}-001 | [SHRD / CORE / PLAT] | [Cross-cutting requirement] | [AUTH, BILL, OPS] | [FEAT-...] | [Why this is centralized] |

---

## 6. Open Questions and Conflicts

| Ref | Question or conflict | Needed decision | Owner | Status |
|---|---|---|---|---|
| [REQ-{DOMAIN}-{NNN} or WF-{DOMAIN}-{NN}] | [What is uncertain or contradictory] | [Decision needed] | [Who owns the answer] | [Open / Resolved] |
