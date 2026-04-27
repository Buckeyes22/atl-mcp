---
title: Backend Capability Gap Closure Plan
owner: Chris
status: proposed
last_reviewed: 2026-04-27
version: 0.1.0
audience: [engineer, operator, product, auditor]
sdlc_category: 04-design
related: [docs/sdlc/04-design/control-plane-ui/README.md, docs/sdlc/04-design/control-plane-ui/role-workflows.md, docs/sdlc/04-design/api-mcp-tools.md, docs/control-plane/frontend-refinement-catalog.md]
---

# Backend Capability Gap Closure Plan

> **TL;DR:** The control plane has broad admin visibility, but several backend-built capabilities are still exposed as thin status summaries or not exposed as workflows at all. This plan closes those gaps by adding role-specific workspaces for project initiation, developer work routing, memory, context packs, readiness, traceability, quality, webhooks, content library browsing, and operational evidence.

## Goal

Turn backend-built orchestration capabilities into frontend workflows that users can operate end to end.

The objective is not to add authorization roles, duplicate backend workflows, or create a separate product architecture. The objective is to make the existing orchestrator visibly usable by each internal role:

| Role | Primary UI outcome |
|---|---|
| Customer | Understand delivery status, blockers, milestones, readiness, and approved artifact links. |
| Product Owner | Initiate projects from descriptions and briefs, review requirements, shape Jira/Confluence output, and judge content quality. |
| Scrum Master | See flow, blocked work, queue pressure, assignment state, approvals, and aging work. |
| Developer | Classify work, select agents, inspect context packs, use memory and trace links, and prepare handoffs. |
| DevOps Engineer | Validate preflight, provider health, webhook flow, queue/runtime status, and platform readiness. |
| Operator | Preserve the broad control plane across audit, providers, jobs, policy, lifecycle execution, and governance evidence. |

## Success Criteria

- Every backend capability listed in this plan has a visible UI entry point.
- Existing data remains available; role-specific UX changes prominence, not authorization.
- Project Detail becomes the canonical place to connect blueprint, Jira, Confluence, VCS, context, memory, readiness, quality, trace, jobs, audit, and handoff state.
- Product and developer workflows are complete enough that users do not need raw MCP calls for normal initiation or work-routing tasks.
- Every mutating action goes through an audited admin tool and requires the same operator evidence as existing admin writes.
- Secrets are never displayed. Security-related UI shows metadata, status, age, verification evidence, and drift only.

## Backend Capabilities To Surface

| Capability | Backend already present | Current UI gap | Target UI |
|---|---|---|---|
| Agent memory | `memory_*` tools, memory workflow, vector index, repository | No memory panel, recall flow, or forget workflow | Project Memory panel and developer workspace memory drawer |
| Context packs | `context_pack_generate`, `context_get`, context workflow/repository | Context is referenced but not generated, listed, or inspected | Context Pack Workspace with generate/list/get/copy actions |
| Readiness validation | `readiness_validate`, readiness workflow/repository | Readiness summaries exist, but no validation run/history UI | Readiness Runs panel with latest verdict and report history |
| Blueprint revise/update | blueprint generate/revise/update workflows | Requirements Assist creates, but does not support review/diff/accept | Blueprint Review Studio |
| Preflight/profile | `project_preflight_check`, `project_profile_get`, profile repository | Provider feasibility is summarized, but profile detail is hidden | Preflight Profile Viewer |
| Webhook ingestion | `webhook_ingest`, delivery repository, ingress workflow | No delivery/event timeline or signature/failure visibility | Webhook and Drift Timeline |
| Trace links | trace domain/repository | Trace is derived into summaries, not inspectable as links | Trace Explorer |
| Artifact quality | `admin.quality.score.artifact`, quality repository | Project scoring exists, artifact-level scoring is underexposed | Score actions on Jira, Confluence, blueprint, context, and handoff artifacts |
| Velocity content | `admin.velocity.content.read`, content registry | Agent catalog is mostly static frontend metadata | Content Library backed by registry content |
| Agent classification | work classification/recommendation/assignment | Recommend/assign exists, but classification is not a first-class flow | Classify Work and Bulk Route Stories workflow |
| SDLC Confluence mirror | `sdlcConfluenceMirror` workflow | No sync status, preview, or publish action | SDLC Mirror panel |
| Jira/Confluence generation | issue tree and page workflows | Limited editorial control before external writes | Jira/Confluence Preview and Edit surfaces |
| VCS scaffold | VCS scaffold workflow | Provision output exists, but no file-by-file preview | Scaffold Preview panel |
| ACL/policy visibility | ACL and policy decision repositories | Policy exists, but artifact access/drift is not visible | Artifact Permissions and Policy Evidence panel |
| Notification workflow | notification workflow | Alerts are mostly status-only | Notification Delivery History |
| Token/key registry | encrypted token and key repositories | Secrets page lacks deeper metadata inventory | Token and Key Metadata Inventory |
| Demo seed | `admin.demo.seed` | Useful for demos, but no explicit UI action | Demo Seed control, clearly labeled and gated |

## Implementation Plan

### Phase 1 - Admin Facades For UI-Safe Access

Add thin loopback `admin.*` wrappers where the browser cannot safely call the existing public MCP tool directly.

Required admin tool families:

| Tool family | Required operations | Notes |
|---|---|---|
| `admin.memory.*` | `list`, `recall`, `retain`, `reflect`, `forget` | Wrap existing memory workflow. Mutations append audit. Forget requires reason. |
| `admin.context.*` | `generate`, `get`, `list` | Wrap context pack workflow/repository. Show regeneration key and issue scope. |
| `admin.readiness.*` | `validate`, `reports.list` | Wrap readiness workflow/repository. Validation persists a report. |
| `admin.preflight.*` | `run`, `profile.get` | Wrap preflight/profile behavior. Include freshness and warnings. |
| `admin.webhooks.*` | `deliveries.list`, `delivery.get` | Read persisted deliveries. Replay/retry only if backend support exists safely. |
| `admin.trace.*` | `links.list` | Add create/delete only if audited repository support is already present or added deliberately. |
| `admin.sdlc.mirror.*` | `preview`, `execute` | Wrap SDLC Confluence mirror workflow. Return data-limited output when Confluence is unavailable. |
| `admin.notifications.*` | `deliveries.list` | Read notification delivery/evidence if available. Do not create a user subscription system in v1. |

Rules:

- Do not create alternate business logic in admin tools.
- Use Zod input schemas and typed structured output.
- Follow existing admin audit conventions.
- Preserve data-limited reporting when providers are not configured.
- Add integration tests for each new admin tool family before frontend wiring.

### Phase 2 - Project Initiation Workspace

Upgrade Requirements Assist into a full product-owner initiation workspace.

Primary route:

- `#/requirements-assist`

Embedded locations:

- Projects page quick-start panel.
- Project Detail Assist tab.
- Product Owner role first-screen focus.

Required frontend components:

| Component | Behavior |
|---|---|
| Description editor | Captures project name, key, and narrative description. |
| Brief intake area | Allows pasted brief text and file-derived text entries. File parsing may remain frontend text extraction or manual paste until backend upload exists. |
| Requirement parser panel | Shows normalized requirements, source count, open questions, and suspected gaps. |
| Blueprint Review Studio | Shows generated blueprint, validation issues, proposed revisions, diff, and accept/update action. |
| Jira issue tree preview | Shows planned epics/stories/tasks before writes. |
| Confluence page tree preview | Shows planned pages/sections before writes. |
| Quality score panel | Scores generated or existing project content. |
| Readiness preview | Shows readiness gates before provisioning or handoff. |

Acceptance criteria:

- A product owner can start from description plus briefs and reach a reviewed blueprint without leaving the UI.
- Jira and Confluence previews are visible before external writes.
- Quality and readiness signals are shown before work is handed to developers.

### Phase 3 - Developer Work Routing Workspace

Upgrade Agent Assignment into a developer-facing work-routing workflow.

Primary route:

- `#/agent-assignment`

Embedded locations:

- Project Detail Assignments tab.
- Developer role first-screen focus.
- Agents page detail drawer.

Required frontend components:

| Component | Behavior |
|---|---|
| Work item selector | Lists blueprint stories/subtasks and, when available, Jira work items. |
| Classifier result card | Shows work type, skill tags, risk, confidence, and explanation. |
| Recommendation table | Ranks live/persisted agents by fit, availability, and specialization. |
| Agent catalog detail drawer | Shows backend-backed role descriptions, strengths, and best-use guidance. |
| Context pack attachment | Generates or selects a context pack for assigned work. |
| Memory signals | Shows relevant retained facts and reflections for the work item. |
| Assignment history | Shows prior assignments, reasons, assigned-by, and audit evidence. |
| Bulk route stories | Classifies multiple stories and proposes agent assignments in a reviewable batch. |

Acceptance criteria:

- A developer can classify a work item, understand why it was classified, compare agents, attach context, and record assignment intent.
- Bulk routing never assigns silently. It stages recommendations for human review.

### Phase 4 - Project Detail Capability Panels

Project Detail should become the canonical surface for connecting orchestration artifacts.

Add or enhance these panels:

| Panel | Role emphasis | Required behavior |
|---|---|---|
| Project Memory | Developer, Product, Operator | List, recall, retain, reflect, forget with audit reason. |
| Context Packs | Developer, Operator | Generate, list, inspect, copy URI/regeneration key. |
| Readiness Runs | Product, Scrum, DevOps, Operator | Validate, show latest verdict, failed gates, report history. |
| Preflight Profile | DevOps, Operator | Show provider capability profile, warnings, freshness, rerun. |
| Trace Explorer | Product, Developer, Auditor | Link requirements to Jira, Confluence, repo, context, readiness, handoff. |
| Artifact Quality | Product, Developer, Operator | Score specific artifacts and show findings/recommendations. |
| Webhook Activity | DevOps, Operator | Show project-related deliveries, source, signature status, failures. |
| Scaffold Preview | Developer, DevOps | Show planned VCS files and generated content preview before execute. |
| Permissions Evidence | Operator, Auditor | Show ACL/policy metadata and drift without exposing secrets. |

Layout rules:

- Keep dense operational panels compact and packed to avoid whitespace from uneven card rows.
- Prefer tables, drawers, tabs, and split workspaces over marketing-style cards.
- Keep all existing lifecycle/provision/audit/job panels reachable.

### Phase 5 - Content Library And Agent Catalog

Replace static-only frontend content descriptions with backend content where available.

Target surfaces:

- Agents page.
- New or embedded Content Library page.
- Agent Assignment detail drawer.

Required content categories:

- Agents.
- Workflows.
- Templates.
- Modules.
- Phases.

Required behavior:

- Browse manifest categories.
- Read full markdown body with `admin.velocity.content.read`.
- Search/filter by category and tag where metadata exists.
- Deep-link from agent recommendation rows to the relevant agent catalog entry.
- Keep a data-limited/static fallback if content read fails.

Acceptance criteria:

- Developers assigning agents can inspect what each analyzed agent does using backend content, not only frontend hardcoded copy.

### Phase 6 - Operations Evidence Workspaces

Add focused views for capabilities that matter most to DevOps, Operator, and Auditor roles.

| Workspace | Required behavior |
|---|---|
| Webhook and Drift Timeline | List deliveries, signature status, accepted/rejected state, linked artifact, failure detail. |
| SDLC Mirror | Preview changed docs, show target Confluence space, execute sync, show last run and data-limited state. |
| Token and Key Inventory | Show logical token ids, provider, status, age, rotation state, signing key id, no raw secrets. |
| Notification History | Show notification attempts, target class, result, related project/job. |
| Demo Seed Control | Trigger demo seed only as clearly labeled demo/operator action. |

Acceptance criteria:

- Operational evidence can be reviewed without database access.
- No panel displays credential material.

## Frontend Routing And Role Lens Updates

Add route entries only where a standalone workflow is justified. Otherwise embed panels in existing pages.

Recommended new route IDs:

| Route id | Path | Purpose |
|---|---|---|
| `content-library` | `#/content-library` | Browse backend velocity content. |
| `webhook-events` | `#/webhook-events` | Inspect webhook delivery and drift evidence. |
| `context-packs` | `#/context-packs` | Portfolio/project context pack browser if embedded project panels are insufficient. |

Existing routes to enhance:

- `#/requirements-assist`
- `#/agent-assignment`
- `#/projects`
- `#/projects/<key>`
- `#/sessions`
- `#/providers`
- `#/alerts`
- `#/audit`
- `#/settings`

Role lens emphasis:

| Role | First-screen emphasis |
|---|---|
| Customer | Delivery status, milestones, readiness, blockers, approved Jira/Confluence links. |
| Product Owner | Project Initiation, Blueprint Review, Jira/Confluence Preview, Quality, Readiness. |
| Scrum Master | Flow, blocked work, queue aging, assignments, approvals, readiness blockers. |
| Developer | Work Routing, Agent Assignment, Context Packs, Memory, Trace, Handoff. |
| DevOps Engineer | Preflight, Providers, Webhooks, Queue, Runtime Readiness, Context infrastructure. |
| Operator | Audit, Policy, Jobs, Providers, Lifecycle execution, Governance evidence. |

The role lens remains a presentation preference. It must not hide data as a security boundary.

## Public Interfaces And Types

New frontend model helpers:

| Helper | Purpose |
|---|---|
| `capabilityGapCatalog()` | Stable list of backend capabilities and UI coverage states. |
| `roleWorkflowPriority(role)` | Orders workspaces for the selected role. |
| `artifactQualityTargetOptions(project)` | Builds scoreable artifact refs. |
| `contextPackDisplayRows(packs)` | Normalizes context pack cards/table rows. |
| `memoryDisplayRows(entries)` | Normalizes memory list/search rows. |
| `traceExplorerRows(links, artifactSummary)` | Combines trace repository rows and derived artifact summary rows. |
| `webhookDeliveryRows(deliveries)` | Normalizes delivery status and source metadata. |

New admin output shapes should be deterministic and frontend-safe:

- Memory rows include id, kind, text summary, tags, issue key, source refs, created/updated time, forgotten status, and provenance.
- Context pack rows include project id/key, issue key, regeneration key, URI, generated time, included section summary, and memory fingerprint when present.
- Readiness reports include score, verdict, gates, blockers, evidence, and generated time.
- Preflight profiles include provider capability status, warnings, freshness, and profile id.
- Webhook deliveries include source, event id, signature status, accepted/rejected state, error detail, linked project/artifact when known, and timestamps.
- Trace links include source, target, relation, confidence/provenance when available, and created time.
- Token/key inventory rows include logical id, provider/purpose, status, age, rotation state, and key id only.

## Security And Governance Requirements

- Mutating memory, readiness, mirror, assignment, provision, policy, and provider actions must append audit evidence.
- Memory forget requires an explicit reason and must be soft-delete/audit-preserving.
- Artifact quality reports are advisory unless a future policy gate explicitly enforces them.
- Webhook panels must show signature verification status without exposing signing secrets.
- Token/key panels must not display raw tokens, encrypted blobs, session keys, private keys, or decrypted values.
- Demo seed controls must be visibly labeled as demo-only/operator-only and should not be placed in customer/product first-screen flows.
- Role-specific UI must not imply access control. Authorization remains backend/admin transport responsibility.

## Testing Plan

### Unit Tests

- Admin Zod schemas accept valid inputs and reject malformed project ids, artifact refs, memory ids, and missing operator evidence.
- UI model helpers return deterministic rows for empty, healthy, degraded, and data-limited states.
- Role priorities place the correct workspaces first for all six role lenses.
- Artifact quality target builder includes blueprint, Jira, Confluence, context pack, and handoff refs when present.
- Trace row builder preserves explicit trace links and derived artifact summary links without duplicating rows.

### Integration Tests

- `admin.memory.*` retains, recalls, reflects, forgets, and appends audit evidence.
- `admin.context.*` generates, lists, and retrieves context packs.
- `admin.readiness.*` validates and lists persisted reports.
- `admin.preflight.*` runs profile checks and returns stored profile detail.
- `admin.webhooks.*` lists persisted webhook deliveries.
- `admin.trace.*` lists project trace links.
- `admin.sdlc.mirror.*` previews and returns data-limited output when Confluence is unavailable.
- `admin.velocity.content.read` remains compatible with the new content library UI.

### UI Source Tests

- Navigation exposes new standalone workflow routes.
- Project Detail contains Memory, Context Packs, Readiness, Trace, Artifact Quality, and Webhook Activity entry points.
- Requirements Assist includes blueprint review, Jira preview, Confluence preview, quality, and readiness.
- Agent Assignment includes classification, recommendations, catalog details, context, memory, and assignment history.
- Agents page links recommendation/capability data to backend-backed content library detail.
- Packed two-column layouts remain compact after adding the new panels.

### Regression Commands

Run before completion:

```powershell
npm run typecheck
npm test
npm run build
```

### Browser Smoke

Open the control plane at desktop and mobile widths and verify:

- Dashboard, Projects, Project Detail, Requirements Assist, Agent Assignment, Agents, Providers, Alerts, Audit, Content Library, and Webhook Events load.
- All six role lenses can be selected and persist after reload.
- No console errors.
- No failed MCP fetches beyond explicit data-limited provider states.
- No horizontal overflow.
- New panels preserve dense operational layout without excessive whitespace.

## Rollout Order

1. Add admin facades and integration tests for memory, context, readiness, preflight, webhooks, trace, and SDLC mirror.
2. Add frontend model helpers and unit tests.
3. Upgrade Requirements Assist into the Project Initiation Workspace.
4. Upgrade Agent Assignment into the Developer Work Routing Workspace.
5. Add Project Detail panels for memory, context packs, readiness, preflight, trace, artifact quality, webhooks, and scaffold preview.
6. Add backend-backed Content Library and connect Agents/Assignment surfaces to it.
7. Add operations evidence workspaces for webhooks, SDLC mirror, token/key metadata, notification history, and demo seed.
8. Update SDLC documentation and browser smoke the complete control plane.

## Assumptions And Defaults

- The control plane continues to use loopback `admin.*` MCP tools.
- Existing public MCP tools remain agent-facing and are not called directly from the browser unless already routed through an admin-safe facade.
- Existing repositories and workflows are reused before adding new storage.
- New admin facades are thin wrappers over existing backend capability, not alternate implementations.
- Demo seed is useful but must stay explicitly labeled as demo/operator functionality.
- Token/key/security panels expose metadata and verification status only.
- The first implementation favors embedded Project Detail panels plus a few dedicated workflow routes over a large SPA rewrite.
- File upload parsing for Requirements Assist may start as pasted/extracted text unless a backend file-upload contract is added deliberately.

## Documentation Updates After Implementation

Update the SDLC set when implementation lands:

- `control-plane-ui/README.md`: route inventory, file ownership, and design principles.
- `control-plane-ui/role-workflows.md`: expanded role workflows for memory, context, readiness, trace, and content library.
- `control-plane-ui/data-contracts.md`: frontend-safe shapes for the new admin facades.
- `api-mcp-tools.md`: new admin tool families and security boundaries.
- `module-agent-memory.md`, `module-context.md`, `module-preflight.md`, `module-observability.md`, and `module-security.md`: any changed operational contracts.
- `docs/control-plane/frontend-refinement-catalog.md`: mark implemented frontend refinement items and leave any deferred items in backlog.

---

*Last reviewed: 2026-04-27 by Chris.*
