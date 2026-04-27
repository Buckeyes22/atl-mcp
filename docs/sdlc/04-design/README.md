---
title: Design Documentation Index
owner: Chris
status: accepted
last_reviewed: 2026-04-27
version: 1.1.0
audience: [engineer, operator, integrator, auditor]
sdlc_category: 04-design
related: [docs/sdlc/README.md, docs/sdlc/02-architecture/README.md, docs/control-plane/STYLE-NOTES.md]
---

# Design Documentation

> **TL;DR:** This section is the implementation design layer for atl-mcp. It maps architecture and requirements into modules, APIs, sequences, and the role-aware operator control plane UI.

## Module designs

| Document | Scope |
|---|---|
| [`module-mcp-runtime.md`](module-mcp-runtime.md) | MCP server runtime, transports, session lifecycle, and tool execution. |
| [`module-storage.md`](module-storage.md) | Repository interfaces, database boundary, persistence contracts. |
| [`module-providers-atlassian.md`](module-providers-atlassian.md) | Jira and Confluence provider integration design. |
| [`module-providers-vcs.md`](module-providers-vcs.md) | VCS provider design, Bitbucket implementation, and worktree behavior. |
| [`module-security.md`](module-security.md) | Token storage, audit chain, policy, and security primitives. |
| [`module-workflows.md`](module-workflows.md) | Intake, blueprint, provisioning, readiness, handoff, webhook, work classification, and content quality workflows. |
| [`module-queue.md`](module-queue.md) | Provisioning queue design and operational behavior. |
| [`module-context.md`](module-context.md) | Context pack assembly and redaction. |
| [`module-preflight.md`](module-preflight.md) | Capability discovery and readiness preflight. |
| [`module-observability.md`](module-observability.md) | Logging, metrics, tracing, and telemetry design. |

## API and sequence designs

| Document | Scope |
|---|---|
| [`api-mcp-tools.md`](api-mcp-tools.md) | Agent-facing and admin-facing MCP tool catalog. |
| [`api-mgmt-rest.md`](api-mgmt-rest.md) | Management REST endpoints such as health, readiness, metrics, and UI hosting. |
| [`sequence-diagrams.md`](sequence-diagrams.md) | End-to-end workflow sequence diagrams. |

## Operator control plane UI

| Document | Scope |
|---|---|
| [`control-plane-ui/README.md`](control-plane-ui/README.md) | UI system overview, route map, implementation topology, and page inventory. |
| [`control-plane-ui/runtime-data-flow.md`](control-plane-ui/runtime-data-flow.md) | Static asset serving, MCP client behavior, polling, write path, and data-limited contract. |
| [`control-plane-ui/ux-system.md`](control-plane-ui/ux-system.md) | Enterprise UI/UX decisions, component vocabulary, information density, and accessibility constraints. |
| [`control-plane-ui/role-workflows.md`](control-plane-ui/role-workflows.md) | Role lens, Requirements Assist, developer agent assignment, content quality scoring, and agent role catalog. |
| [`control-plane-ui/pages-core.md`](control-plane-ui/pages-core.md) | Screen index, dashboard, project list, project detail, and provisioning tab. |
| [`control-plane-ui/pages-operations.md`](control-plane-ui/pages-operations.md) | Jobs, audit, and policy operations pages. |
| [`control-plane-ui/pages-platform-admin.md`](control-plane-ui/pages-platform-admin.md) | Providers, sessions, alerts, migrations, secrets, SLO, capacity, DR, and settings pages. |
| [`control-plane-ui/data-contracts.md`](control-plane-ui/data-contracts.md) | Page-to-tool data provenance, write side effects, and data-limited behavior. |
| [`control-plane-ui/testing-governance.md`](control-plane-ui/testing-governance.md) | UI verification strategy and change governance. |

## Authoring rules

- Keep module docs tied to code paths and tests through `## Linked artifacts`.
- Record external behavior in API docs, not inside individual module docs.
- UI docs must name the route, React component, source file, admin tools, and generation model for every page they cover.
- Prototype implementation notes can live near the prototype in [`docs/control-plane/STYLE-NOTES.md`](../../control-plane/STYLE-NOTES.md), but SDLC-level intent and governance live here.

## Linked artifacts

- [`docs/sdlc/02-architecture/README.md`](../02-architecture/README.md)
- [`docs/sdlc/03-requirements/functional.md`](../03-requirements/functional.md)
- [`docs/control-plane/`](../../control-plane/)
- [`src/server/uiAssets.ts`](../../../src/server/uiAssets.ts)
- [`src/mcp/admin/registry.ts`](../../../src/mcp/admin/registry.ts)

---

*Last reviewed: 2026-04-27 by Chris.*
