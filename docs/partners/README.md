# Partner Integration Guides

Partner repositories the Agent Context Orchestrator MCP Server either calls directly, embeds as infrastructure, or references for patterns. Each guide follows a fixed 9-section template so they are diff-able and skimmable.

This index mirrors v6 §39 and §40.

## Categories

Every partner guide declares a category in §1:

- **A. Runtime integration partner** — orchestrator calls it at runtime or installs it as a dependency. Full env/config/glue-code template.
- **B. Pattern-lift source** — orchestrator adopts code/design patterns but does not run the repo. §2/§4 marked N/A; §5 cites v6 §N.N + §40 F-NNN per adoption point; §8 verifies adopted pattern matches source at pinned SHA.
- **C. Spec / docs source** — orchestrator adopts conventions or templates. §2/§3 marked N/A; §5 lists v6 sections conforming to the spec; §8 verifies v6 conformance.

## P0 partners (ship with v6)

| Partner | Role | v6 sections | Guide |
|---|---|---|---|
| **UIO** | Direct integration partner: document ingestion + multi-vector embedding reuse. Orchestrator's `project_intake_create` calls `uio_ingest`; vectors fetched from UIO's Qdrant by `source_id`. | §9, §10, §15, §19, §22, §25, §27, §35.1 | [`uio.md`](uio.md) |
| **eval-view** | Direct integration partner: §31 testing framework (multi-provider LLM-as-judge, 4-tier verdict, drift tracker, golden baselines, auto-PR, model-drift canary). | §17.2, §31, §35.3 | [`eval-view.md`](eval-view.md) |
| **agentdiff** | Audit-chain signing infrastructure: ed25519 + RFC 8785 JCS canonicalization + git-ref key registry. Replaces planned KMS dependency for v1. | §10 (`AuditEntry`), §20, §27.4, §30.1, §38.7 | [`agentdiff.md`](agentdiff.md) |

## P1 partners (deferred)

Not shipped with v6. Re-promote to P0 if the referenced sections pull in a vendored copy rather than just pattern adoption.

| Partner | Status | v6 sections | Guide |
|---|---|---|---|
| **`context-fabric`** | Pattern-lift in v6 §16; promotion to A would mean vendoring the repo. | §16.1, §16.3, §16.5, §6.3, §8 | [`context-fabric.md`](context-fabric.md) |
| **`hindsight`** | Deferred reference; persistent agent memory is out of v1 scope per §4 non-goals. | §25.2, §4 | [`hindsight.md`](hindsight.md) |

## Pattern-lift sources (Category B)

Orchestrator adopts the repo's design patterns or code shape; does not vendor or run the repo at runtime.

| Partner | Pattern adopted | v6 sections | Guide |
|---|---|---|---|
| **agent-maestro** | 4-mode agent classification + 4 workflow strategies + manifest spawning + per-session worktrees + WebSocket batching | §10, §14.1, §6.2, §24.1, §14.3, §13, §19, §24.5, §22.1, M3, M6c | [`agent-maestro.md`](agent-maestro.md) |
| **agentic-rag-for-dummies** | Parent-child hierarchical chunking + hybrid Qdrant retrieval + LangGraph-style decomposition | §16, §25, M4, M7 | [`agentic-rag-for-dummies.md`](agentic-rag-for-dummies.md) |
| **ai-coding-framework** | Six-dim conformance rubric + banned-patterns semgrep + OWASP-LLM checklist + LF AGENTS.md spec (sec. C nuance) | §9, §17, §30.2 layer 2, §31, §38.6 | [`ai-coding-framework.md`](ai-coding-framework.md) |
| **atomic-agents** | Multi-transport MCP client (STDIO + SSE + HTTP Stream) with persistent session reuse | §19, §22 | [`atomic-agents.md`](atomic-agents.md) |
| **Caliber** | 6-category deterministic scoring (A/B/C/D grade) + 6-cat token tracking + seat-vs-API provider distinction | §17.1, §10, §16.1, §23.1 | [`caliber.md`](caliber.md) |
| **Citadel** | Fleet pattern: discovery-brief compression + claim-based scope coordination + 5-section skill format | §24.4, §38.4, §17.6 | [`citadel.md`](citadel.md) |
| **claude-agent-builder** | 6-phase agent generation workflow + 7-pattern library | §14.3, §29.2, M9 | [`claude-agent-builder.md`](claude-agent-builder.md) |
| **claude_agent_teams_ui** | Token tracking + post-compact recovery + action-mode injection + WebSocket batching + SSE keep-alive + hunk review | §10, §16.1, §23.1, §6.3, §7.2, §38.3, §22.1, §14, §18.3, §26.1, M6c, M10 | [`claude-agent-teams-ui.md`](claude-agent-teams-ui.md) |
| **claude-code-log-analyzer** | 6-enum observability taxonomy (autonomy / intent / decision / error_class / gate_type / severity) | §27.5, §30.4 | [`claude-code-log-analyzer.md`](claude-code-log-analyzer.md) |
| **claude-code-production-grade-plugin** | 4 shared protocols (ux / input-validation / tool-efficiency / conflict-resolution) + 4 engagement modes | §38.3 | [`claude-code-production-grade-plugin.md`](claude-code-production-grade-plugin.md) |
| **claude-sessions** | Incremental Haiku summarization + HTML-comment checkpoint format + stale-session auto-finalize | §6.1 | [`claude-sessions.md`](claude-sessions.md) |
| **claude-workflow-v2** | Single-message Task-call constraint + adversarial verification triplet | §24.6, §18.1, `docs/claude-code.md` | [`claude-workflow-v2.md`](claude-workflow-v2.md) |
| **codebase-memory-mcp** | 11-signal algorithmic embeddings + SQLite int8 (deferred — chose BGE-M3 via UIO) | §25.1 (deferred-recorded) | [`codebase-memory-mcp.md`](codebase-memory-mcp.md) |
| **full-stack-fastapi-template** | Sentry conditional init + Traefik dynamic discovery + constraint labels | §22.3, §27.1 | [`full-stack-fastapi-template.md`](full-stack-fastapi-template.md) |
| **grain** | Anti-slop linter rules (obvious comments, vague TODOs, hedge words, restated docstrings) | §30.2 layer 3, §31.2 | [`grain.md`](grain.md) |
| **indxr** | Streamable HTTP transport (axum + SSE + 1h sliding TTL + 1000 concurrent) + 5-step progressive truncation | §22.1, §16.2, M0 | [`indxr.md`](indxr.md) |
| **mcp_daemon** | Multi-transport `Transport` trait abstraction (stdio + WS + HTTP/2 + SSE + InMemory) | §22 | [`mcp-daemon.md`](mcp-daemon.md) |
| **mcpd** | MCP aggregator/proxy pattern for upstream MCP server mediation | §2, §19 | [`mcpd.md`](mcpd.md) |
| **mengram** | Proactive resource pinning (`memory://profile` auto-load) | §2, §14 | [`mengram.md`](mengram.md) |
| **open-edison** | Lethal trifecta detection + PUBLIC/PRIVATE/SECRET ACL + OTel counters + dual-port architecture | §38.1, §38.2, §10, §27.2, §27.3, §22.2 | [`open-edison.md`](open-edison.md) |
| **open-multi-agent** | Approval-gate callback with skip-cascade + 4 scheduler strategies | §7.2, §24.2, §24.3 | [`open-multi-agent.md`](open-multi-agent.md) |
| **PAE** | HTTP retry + provider interface + bundled rule-pack JSON + Handlebars template selector + confidence enum | §21, §19, §26.2, §29, §10, §17.3, M4 | [`pae.md`](pae.md) |
| **project-foundation** | Drizzle dual-mode + rate limiter + HMAC + RBAC + idempotent upsert + Transport interface + env helpers + repo split (10 findings) | §3, §7.2, §8, §9, §18, §19, §20, §21, §24, §26, M1, M3, M5, M6a, M11 | [`project-foundation.md`](project-foundation.md) |
| **project-foundation-workbench** | PHASE-STATE.json + 5-cat tests + 14 slash commands + unidirectional sync + agent-config sync + context hierarchy + large-file rule | §6.1, §17.4, §31, M5, §5, §35.5, §8, §9, M9, §35.4, §20.gotchas | [`project-foundation-workbench.md`](project-foundation-workbench.md) |
| **simple-commands-mcp** | Canonical MCP stdio scaffold + Winston file-only logger ("stdout breaks MCP") | §9, §22, §20.gotchas, M0 | [`simple-commands-mcp.md`](simple-commands-mcp.md) |
| **superpowers** | Skill-first 1% threshold + iron laws + two-stage review gate + SessionStart hook injection (sec. C nuance) | §14.2, §14.4, §29.1, §38.5, §27, `docs/claude-code.md` | [`superpowers.md`](superpowers.md) |
| **three-man-team** | Persona vocabulary + file-based handoff (BRIEF/REQUEST/FEEDBACK) + deploy-gate accountability + foreground-only subagents | §29, §18.2, §18.4, §20.gotchas, `docs/claude-code.md` | [`three-man-team.md`](three-man-team.md) |
| **velocity-ops-engine** | 12-pattern anti-stub guardrails + enforcement-v2 hooks + MCP development/governance modules + confidence-gate JSON | §30.2 layer 1, §31, §14, §22, §10, §17.3 | [`velocity-ops-engine.md`](velocity-ops-engine.md) |
| **vibe-tuning** | CATCH→DIAGNOSE→ROOT CAUSE→FIX→SAVE→ENFORCE postmortem + failure-mode + fix-type taxonomies | §30.3, §30.4, §30.5 | [`vibe-tuning.md`](vibe-tuning.md) |

## Spec / docs sources (Category C)

Orchestrator conforms to the spec or template; no code lifted, no runtime dependency.

| Partner | Spec adopted | v6 sections | Guide |
|---|---|---|---|
| **adr.github.io** | START Criteria + Definition of Done 5-element checklist for ADR governance | §9 | [`adr-github-io.md`](adr-github-io.md) |
| **agentic-coding-handbook** | 8 context strategies (incl. MCPs as #4) + Memory Bank pattern reference | §3, §35.4, §16.6 | [`agentic-coding-handbook.md`](agentic-coding-handbook.md) |
| **agents.md** | Canonical AGENTS.md spec sections (Dev tips / Testing / PR / Coding conventions) | §9 | [`agents-md.md`](agents-md.md) |
| **awesome-agentic-patterns** | 167-pattern catalog: context-window-auto-compaction + budget-aware routing + declarative YAML topology + layered configuration | §16.7, §16.2, §16.5, §23, §24 | [`awesome-agentic-patterns.md`](awesome-agentic-patterns.md) |
| **claude-code-best-practice** | Only 6 of 27 Claude Code hook events fire in agent contexts | §20.gotchas, `docs/claude-code.md` | [`claude-code-best-practice.md`](claude-code-best-practice.md) |
| **everything-claude-code** | `.claude-plugin/plugin.json` MUST NOT declare hooks (Claude v2.1+ auto-loads `hooks/hooks.json`) | §20.gotchas, §29 prompt 13 | [`everything-claude-code.md`](everything-claude-code.md) |
| **madr** | MADR template (`NNNN-decision-title.md` + frontmatter + Consequences Good/Bad/Neutral) | §8, §9 | [`madr.md`](madr.md) |
| **thinking-partner** | GT0–GT5 orientation detection + 7 cognitive operation pairs + 150+ mental models | §29.3 | [`thinking-partner.md`](thinking-partner.md) |

## Standard 9-section template

Every partner guide follows this structure:

```markdown
# Partner Integration: <repo-name>

## 1. Why this partner
  Category A | B | C. One paragraph: which v6 section depends on it, gap closed, alternatives, findings.md citation.

## 2. Prerequisites
  Versions, OS, accounts/keys, peer infra. (N/A for B/C.)

## 3. Clone and install OR Source provenance
  Exact commands (A) or pin SHA + URL + "no install required" (B/C).

## 4. Configuration
### 4.1 Environment variables
### 4.2 Config file overlays

## 5. Integration points (A) OR Adoption points in v6 (B/C)
  Per point: v6 §N.N + §40 F-NNN + trigger/data shape.

## 6. Glue code patterns (A) OR Pattern excerpts (B/C)
  Concrete TS sketches (A) or short excerpts citing source paths (B/C).

## 7. Gotchas
  Numbered list. Every gotcha cites a findings.md line number.

## 8. Validation
  Smoke-test commands (A) or grep/diff to verify pattern matches source (B/C).

## 9. Operational concerns
  Upgrade path, version pinning, ownership, partner-archived scenario, DR.
```

Add new partners by writing a guide using this template and appending a row to the appropriate table above + v6 §39.
