# Glossary

> **↗ Canonical version:** [`docs/sdlc/17-glossary/README.md`](../sdlc/17-glossary/README.md) plus [`docs/sdlc/17-glossary/domain-vocabulary.md`](../sdlc/17-glossary/domain-vocabulary.md). This file is the interview-audience subset.
> **Mirror of** [`ACO/Glossary`](https://lateapexllc.atlassian.net/wiki/spaces/ACO). Project-specific vocabulary. Skip terms that are obvious (REST, Postgres). Keep terms that are project-specific.

**MCP** — Model Context Protocol. The protocol agentic AI build agents use to consume tools, resources, and prompts. atl-mcp implements the server side.

**ADF** — Atlassian Document Format. JSON tree representation of rich content used by Confluence (and Jira issue descriptions). Round-trips cleanly; preferred for new content.

**Storage format** — Confluence's legacy XHTML-ish body format. Required for some macros; supported as a fallback per [ADR-0003](../adr/0003-confluence-storage-default-adf-flagged.md).

**ed25519** — Edwards-curve digital signature algorithm. Public-key signature with small keys, fast verification, no PRNG needed for signing. Used in the audit chain (v6 §30.1).

**The four agent modes** — Orchestrator, Builder, Reviewer, Operator. Per v6 §14.1, the orchestrator emits skills tailored to the agent's mode.

**Readiness rubric** — The 6-category deterministic score + 4-tier LLM-judged verdict that gates handoff. Defined in v6 §17.

**Iron laws** — Two non-negotiables in [`CLAUDE.md`](../../CLAUDE.md): (1) never claim a task done without verification evidence, (2) never write production code without a failing test first when adding behavior.

**Dogfooding frame** — The portfolio strategy: use atl-mcp to seed atl-mcp's own Jira+Confluence project. The structure of the seeded project IS the demonstration.

**Genesis block** — The first entry in the audit chain. `prev_hash` is null. Verifier handles it as a special case.

**PHASE-STATE.json** — The on-disk concurrent-safe state file for the project state machine, per v6 §6.1.

**Preflight profile** — JSON document emitted by capability discovery describing what the target Atlassian + VCS sites support. Consumed by the planner.

**Adversarial verification triplet** — Three-pass validation pattern (v6 §18.1): emit, critique-by-different-prompt, accept-or-reject. Used on blueprint outputs.

**Hunk-level review gate** — Mid-execution approval gate (v6 §18.3) that pauses risky writes until a human approves a specific change diff.

**Tool-collapse pattern** — MCP design pattern where one tool with an `action` enum replaces many narrow tools. v6 §14.

**The first shippable slice** — Milestone M6a. The point at which the orchestrator can produce a real Jira project end-to-end. Earliest milestone where the v0.1 release tag becomes valid.
