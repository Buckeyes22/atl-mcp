---
title: atl-mcp Conformance Rubric
owner: Chris
status: draft (target M11)
last_reviewed: 2026-04-26
audience: [engineer, operator, auditor]
related: [docs/velocity-ops-port-plan.md (Phase 7), docs/conformance/rubric-source.md]
---

# atl-mcp conformance rubric

> **What this is.** The scoring framework for atl-mcp's M11 MCP conformance test suite. Adapted from `velocity-ops-engine/benchmarks/rubric.md`; categories preserved, scoring criteria rewritten for MCP-server behavior (not consulting deliverables). Used by graders (human or LLM-as-judge) to score every conformance run.

Score every run on a **0–5 scale** in each category. Final score is the sum (max 30).

## Categories

| Category | What it measures (atl-mcp specific) |
|---|---|
| `mcp_protocol_compliance` | Followed the MCP spec: initialize handshake, capability negotiation, JSON-RPC framing, error envelopes, session-id propagation, content/structuredContent shape on tool results. |
| `tool_correctness` | Each `admin.*` and agent-facing tool produced the expected effect: blueprint persisted, Jira issues with the right type/parent linkage, Confluence pages with correct space/parent, repo files with correct paths/content, audit chain entries signed with the configured key. |
| `audit_evidence` | Every write tool emitted an `audit_chain` entry signed with ed25519 + JCS canonicalization. The chain verifies post-hoc with no mismatches; signature key id matches the expected fingerprint. |
| `policy_gating` | Lethal-trifecta and require_approval decisions actually blocked or routed correctly. Approve/deny tools wrote follow-up decisions. No write tool bypassed its declared gate. |
| `data_limited_honesty` | When a backend is missing (alerts, SLO computation, capacity cost, secrets rotation execution, DR scheduler), the tool returned `dataLimited` with a specific reason, NOT a fake value or a thrown error. The UI surfaced the badge correctly. |
| `idempotency_and_failure` | Re-running a write tool against the same blueprint version is a no-op (idempotency key respected). On provider failure (Jira 5xx, Confluence 401, Bitbucket 429), the tool retried per ADR 0004's policy and either succeeded or returned a structured failure with an audit entry. |

## Rating guide

- `5` — complete and convincing with no material weakness; ready to ship.
- `4` — strong with one minor weakness (cosmetic logging issue, marginal latency, etc.).
- `3` — acceptable but clearly incomplete or inconsistent in one area; would block release until addressed.
- `2` — weak or partially compliant; multiple gaps.
- `1` — mostly failed the category; major rework needed.
- `0` — absent or directly violated the category (e.g., write tool without an audit entry → 0 in audit_evidence).

## Scoring evidence

For every score, record in the run bundle:

1. **Trace.** The set of tool calls executed (name + args + result + duration).
2. **Audit chain head.** Length + signing-key-id + verification result, sampled at start and end of the run.
3. **Provider receipts.** Jira issue keys created, Confluence page ids, repo URL, commit ids — all referenced from the audit-chain entries via `outputArtifactIds`.
4. **dataLimited matrix.** For each tool that ran, whether `dataLimited` was returned and the reason. A `dataLimited` claim that's false (e.g., the backend was actually configured) drops the `data_limited_honesty` score to ≤2.

## Calibration runs

Until M11 ships, run the rubric manually against the existing admin integration tests in `tests/integration/admin/`. The current test suite covers most of `tool_correctness` and `audit_evidence` for the read tools and the write tools wired so far; gaps are tracked in `docs/velocity-ops-port-status.md`.

## Decision: aggregate scoring

The aggregate score is the sum of the 6 categories (0–30). Release gates:

| Aggregate | Verdict |
|---|---|
| 28–30 | Ship. |
| 24–27 | Ship with one followup ticket. |
| 18–23 | Hold the milestone; address the lowest-scoring category before release. |
| ≤ 17 | Material rework needed; the milestone has structural problems. |

## See also

- `docs/conformance/rubric-source.md` — the original velocity-ops-engine rubric this was adapted from. Preserved for traceability and license posture.
- `docs/velocity-ops-port-plan.md` Section 6 — the M11 conformance work in context.
