# Project Brief: [Project Name]

**Brief ID:** BRIEF-{PROJECT}
**Date:** YYYY-MM-DD
**Author:** [Name]
**Status:** [Draft | Under Review | Approved]

---

## 1. System Purpose

[One paragraph maximum. What does this system do? What problem does it solve? If you cannot describe the purpose in one paragraph, the scope is too broad — split into multiple projects or narrow the focus.]

---

## 2. Users and Contexts

| User Role | Description | Primary Workflows | Access Level |
|---|---|---|---|
| [Role name] | [Who they are] | [What they do in the system] | [Public / Authenticated / Admin / etc.] |

---

## 3. Domain Boundaries

Domains are the major conceptual areas of the system. Each domain becomes a namespace for requirements, features, and specs. Identify domains from the nouns in your system purpose and workflows.

| Domain | Prefix | Description | Key Entities |
|---|---|---|---|
| [Domain name] | [3-4 letter uppercase] | [What this domain covers] | [Primary data objects] |

---

## 3.5 Traceability Model

This brief is the business-intent source of truth for downstream planning artifacts.

| Layer | ID Format | Source of Truth | Notes |
|---|---|---|---|
| Brief | `BRIEF-{PROJECT}` | This document | Root reference for the brownfield planning chain |
| Workflow / Intent | `WF-{DOMAIN}-{NN}` | Section 4 | Every downstream requirement cites at least one workflow or brief section |
| Requirement | `REQ-{DOMAIN}-{NNN}` | Requirements catalog | Stable once assigned; do not renumber after features/specs reference it |
| Feature | `FEAT-{DOMAIN}-{NNN}` | Feature inventory / feature spec | Groups one or more requirements into a cohesive capability |
| Spec | `SPEC-{DOMAIN}-{FEAT}-{NN}` | Implementation spec | Atomic buildable slice derived from one feature; `{FEAT}` reuses the parent feature sequence |

If a requirement or feature spans multiple domains, assign one owning domain prefix and list the secondary domains in notes instead of inventing a second ID.

---

## 4. Critical Workflows

Describe the end-to-end workflows that define the system's core value. Each workflow should cross at least one domain boundary. These become the primary source for requirements.

Assign every workflow an explicit ID. These workflow IDs are the primary business-intent anchors used by the requirements catalog, feature inventory, and implementation specs.

### Workflow: [WF-{DOMAIN}-{NN}] — [Name]

**Domains touched:** [Primary domain prefix plus any secondary domains]
**Trigger:** [What initiates this workflow]
**Actor:** [Which user role]
**Steps:**
1. [Step description — focus on what happens, not how it's implemented]
2. [Step description]
3. [Step description]

**Success outcome:** [What state the system is in when the workflow completes successfully]
**Failure modes:** [What can go wrong and what should happen when it does]

[Repeat for each critical workflow]

---

## 5. Hard Constraints

> Source of truth for constraints. PRDs should reference this section, not duplicate it.

Non-negotiable requirements that apply across the entire system.

### 5.1 Regulatory / Compliance

[GDPR, SOC 2, PCI-DSS, HIPAA, accessibility standards, etc. If none, state "None identified."]

### 5.2 Infrastructure

[Hosting environment, deployment model, database technology, existing systems.]

### 5.3 Security

[Authentication requirements, authorization model, data classification, encryption.]

### 5.4 Performance

[Response time targets, throughput, concurrent users, data volume. If unknown, state "To be determined during design."]

### 5.5 Business Rules

[Rules that constrain behavior across domains: pricing logic, approval chains, retention policies, etc.]

---

## 6. External Integrations

| System | Direction | Purpose | Auth Method | Documentation |
|---|---|---|---|---|
| [System name] | [Inbound / Outbound / Bidirectional] | [What data flows and why] | [API key / OAuth / Webhook / etc.] | [Link or "None available"] |

---

## 7. Out of Scope

> Source of truth for exclusions. PRDs should reference this section, not duplicate it.

[Explicitly list what this project does NOT include. Prevents scope creep during requirements generation and spec decomposition.]

---

## 8. Research References

| Document | Type | Maturity | Key Takeaways | Routing |
|---|---|---|---|---|
| [Filename or title] | [Competitive analysis / Technical research / Regulatory review / etc.] | [background | actionable | decision-pending] | [1-2 sentence summary] | [brief only | requirements catalog | feature inventory | spec | ADR | implementation plan | issue] |

---

## 9. Open Questions

| Question | Affects | Owner | Status |
|---|---|---|---|
| [Question text] | [Which brief section, workflow ID, or downstream artifact it affects] | [Who can answer] | [Open / Resolved] |
