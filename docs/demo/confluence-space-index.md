# Confluence Space Index — ACO

> **Live space:** [ACO — Agent Context Orchestrator](https://lateapexllc.atlassian.net/wiki/spaces/ACO) on `lateapexllc.atlassian.net`.
>
> **Provenance:** the 35-page tree below is the output of running the orchestrator's blueprint on the project's own profile. Where M6b (Confluence executor) isn't yet implemented, [`scripts/demo/seed-confluence.py`](../../scripts/demo/seed-confluence.py) faithfully simulates the executor's output shape.

---

## Page tree (35 pages, 8 sections)

```
Agent Context Orchestrator Home (homepage)
└── Project Overview
    ├── Product Brief
    ├── Architecture Overview                           ★ centerpiece (mirrored)
    │   ├── System Context Diagram
    │   ├── Runtime / Deployment Topology
    │   ├── Storage + Migration Design
    │   ├── Provider Layer
    │   ├── Policy + Approval Model
    │   ├── Audit Chain Design
    │   └── Webhook Ingestion Design
    ├── Engineering Practice
    │   ├── Definition of Ready
    │   ├── Definition of Done
    │   ├── Test Strategy
    │   └── Branching + Release Process
    ├── Operations
    │   ├── Operational Runbook                         ★ centerpiece (mirrored)
    │   ├── Health Checks + SLOs
    │   ├── Incident Response
    │   └── Backup + Restore
    ├── Security
    │   ├── Threat Model
    │   ├── Token Storage
    │   ├── Audit Chain Threat Model
    │   └── Webhook Verification
    ├── ADR Index
    ├── MCP Tool Catalog
    ├── Roadmap + Milestones
    ├── Audit Findings + Remediation Summary            ★ centerpiece (mirrored)
    ├── Known Limitations
    ├── Glossary
    └── Demo Walkthrough
        ├── 60-Second Pitch
        ├── 5-Minute Tour
        └── 15-Minute Deep Dive
```

★ Mirrored in this directory:
- [`architecture.md`](architecture.md)
- [`runbook.md`](runbook.md)
- [`audit-remediation-summary.md`](audit-remediation-summary.md)

The other 32 pages are accessible via the Confluence link above. The mirror does not duplicate them in markdown because they are either lightweight pointers to code, or detailed enough that maintaining two sources would create drift.

---

## Centerpiece pages (read these in order)

1. **Project Overview** — the landing page. Sets the dogfooding frame.
2. **Architecture Overview** — top-down system explanation. Has the system context diagram and the trust-boundary discussion.
3. **Audit Chain Design** (under Architecture) — drills into v6 §30.1 + ADR-0005.
4. **Operational Runbook** — health checks, three documented incidents, configuration reference.
5. **Audit Findings + Remediation Summary** — the most signal-dense page. Self-critique.

## Confluence mirror status

The curated demo tree above is not the full repo documentation set. The enterprise SDLC tree under [`docs/sdlc/`](../sdlc/) is mirrored through [`scripts/sync-sdlc-confluence.ts`](../../scripts/sync-sdlc-confluence.ts), which creates or updates a nested Confluence page tree from the local markdown and records the source path/hash in a content property.

Run a local plan without touching Confluence:

```powershell
npm run confluence:sync-sdlc -- --offline
```

Run a Confluence dry-run using configured credentials:

```powershell
npm run confluence:sync-sdlc
```

Publish the SDLC mirror into the configured project space:

```powershell
npm run confluence:sync-sdlc -- --execute
```

The repo remains canonical for source code, tests, build configuration, ADR markdown, and the v6 spec. Confluence is the operator/customer-readable project knowledge space and should link back to canonical repo paths.

This separation is deliberate: Confluence is for human-narrative documentation, GitHub is for canonical engineering artifacts. The cross-links bridge them.

---

## Cross-linking discipline

- Every Confluence page has a "Linked artifacts" footer with at least one Jira ticket OR one code path OR one ADR.
- Every flagship Jira ticket links to at least one Confluence page AND one ADR.
- Every ADR has a row in the Confluence ADR Index.
- Every v6 §-reference uses the section number, not page number, so it survives the doc evolving.

Goal: an interviewer landing on any page can reach any other artifact in ≤3 clicks.
