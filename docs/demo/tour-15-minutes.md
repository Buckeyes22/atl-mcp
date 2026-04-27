# atl-mcp — 15-Minute Deep Dive

> **For:** scheduled portfolio review, take-home walkthrough, second-round technical chat.
> **Live links:** [PCO Jira project](https://lateapexllc.atlassian.net/jira/software/projects/PCO/boards/1) · [ACO Confluence space](https://lateapexllc.atlassian.net/wiki/spaces/ACO) · [v6 spec](../../agent-context-orchestrator-mcp-plan-v6.md).

Seven sections plus a Q&A buffer. The 5-minute tour, expanded with a spec walkthrough, an ADR drill-in, and a real code-walk to defuse the "did you actually write this?" question.

---

## (0:00–1:00) Pitch and frame

Same as the 5-minute version, slightly slower. After the dogfooding sentence:

> "If you have specific things you want to see, tell me — I'll redirect. Otherwise I'll walk through the spec, the architecture, the generated artifacts, a code-walk, the self-critique, and what's deferred."

Putting the choice on the interviewer signals respect for their time.

## (1:00–3:00) Spec walkthrough

Open [`agent-context-orchestrator-mcp-plan-v6.md`](../../agent-context-orchestrator-mcp-plan-v6.md). Show the table of contents — 40+ sections. Don't read them.

Drill into **§17 (Readiness Rubric)**. Walk through:

- §17.1 — the deterministic 6-category score (zero LLM, fully reproducible).
- §17.2 — the LLM-judged 4-tier verdict layered on top.
- §17.3 — the project-level rubric (weighted).
- §17.4 — the 5-category test framework with mandatory + auditable N/A.
- §17.5 — the issue-level rubric (weighted, separate from project-level).
- §17.6 — the 5-section skill format for orchestrator-emitted skills.
- §17.7 — the readiness score itself.

Why §17? It's the section most likely to demonstrate that the spec has thought through measurable quality, not just architectural flourish.

## (3:00–6:00) Architecture deep dive

Open the [Architecture Overview](https://lateapexllc.atlassian.net/wiki/spaces/ACO) Confluence page (or [`architecture.md`](architecture.md) in repo).

Walk through:

1. The TL;DR (dual-port transport, Postgres+pglite, policy + audit gates).
2. The system context diagram. Three trust boundaries.
3. The dataflow: requirement → preflight → blueprint → plan → execute → audit.

Then drill into the audit chain. Open [`docs/adr/0005-audit-signing-pipeline.md`](../adr/0005-audit-signing-pipeline.md). Read the Decision section. Walk through:

- Hash chain: `chain_hash = SHA-256(prev_hash || payload_hash)`.
- ed25519 signature over `chain_hash`.
- Public key registry stored in a git ref (versioned, atomic, verifiable).
- Genesis block: `prev_hash = NULL`, signed identically.
- Rotation: documented as registry ref-update + log-the-rotation event.

Then open [`src/storage/schema/auditEntries.ts`](../../src/storage/schema/auditEntries.ts) and confirm the implementation matches the design. Specifically: the column shape, the constraint that `prev_hash` is nullable only for the genesis row, the FK back to a key registry row.

## (6:00–9:00) Generated artifacts tour

Same structure as the 5-minute version, plus drill into a second flagship.

Open [PCO-11: \[Spike\] Confluence storage format vs ADF — pick a default](https://lateapexllc.atlassian.net/jira/software/projects/PCO/issues/PCO-11) (the spike).

Walk through:

- The question being answered (storage format vs ADF — which to default).
- The constraints (round-trip correctness, table support, code support, time-box).
- The outcome (ADF as default with a flag, captured in ADR-0003).
- The cost (dual-renderer, ongoing maintenance).

This is the second flagship because its closure is ADR-0003 and the dual-representation problem is genuinely hard. It also demonstrates research → ADR → code as a pattern, which is the pattern most senior engineers care about.

Then show the Confluence space, especially the **Audit Chain Design** child page under Architecture. It mirrors the v6 §30.1 spec content with a concrete entry-shape table.

## (9:00–11:00) Implementation — the "I really wrote this" moment

Switch to a terminal in the repo.

Run:
```bash
npm run lint:no-stdout
```

Show it passing. Open [`scripts/lint-no-stdout.mjs`](../../scripts/lint-no-stdout.mjs) and walk through what it does:

- Globs `src/**/*.ts`.
- Greps for forbidden tokens (`process.stdout.write`, `console.log`, `console.error`, etc.).
- Allowlists `src/observability/logger.ts` (pino's writer is the legitimate stdout user).
- Fails non-zero if any match found in non-allowlisted files.

Acknowledge the gap: this is regex-based, not AST-based. PCO-12 documents the alias-form gap.

Run `npm test`. Show the green output. Note the test categories: unit (domain serialization, security primitives), integration (storage repositories, providers, MCP build), lint (no-stdout enforcement).

Open [`src/storage/migrationRunner.ts`](../../src/storage/migrationRunner.ts) and walk through it line by line. Specifically:

- The metadata table check (idempotency).
- The lock acquisition (advisory lock to prevent concurrent runners).
- The rehearsal mode branch (apply to a temp DB, verify post-conditions, discard).
- The error handling: if a migration fails mid-apply, the metadata record is NOT written, so the next runner re-applies. (Documented intentionally — re-applies must be idempotent, which is the migration author's responsibility.)

Open the matching test [`tests/integration/storage/migrationRehearsal.test.ts`](../../tests/integration/storage/migrationRehearsal.test.ts). Show the test that validates the "fail fast on rehearsal post-condition violation" behavior.

This is the **"I really wrote this" moment**. Make it count. Eye contact. Slow pace.

## (11:00–13:00) Self-critique + roadmap

Switch back to Confluence (or the markdown mirror).

Open the **Audit Findings + Remediation Summary** page. Walk through F-01 (the embarrassing finding) in full as in the 5-minute version. Then add:

- F-03 (master key rotation, deferred for envelope encryption refactor).
- F-10 (planner race, deferred until M5 lands).
- F-11 (per-tenant isolation, out of v1 scope by design).

Open the **Roadmap + Milestones** page. Show milestone status:

- M0: Done (PCO-1).
- M1: Done (PCO-2).
- M2: In progress (PCO-3) — auth and read path done, capability discovery and preflight emitter open.
- M3: In progress (PCO-4) — auth and REST done, worktree manager open.
- M4–M6c: To Do.
- M11: In progress (PCO-7) — schema and signing pipeline done, verifier and wrap-executors open.

Be explicit. Don't gloss over what's not done.

Open [`known-limitations.md`](known-limitations.md). Read the top three:

1. Single-tenant only.
2. Atlassian-only in v1 (Bitbucket Cloud only on the VCS side).
3. No persistent agent memory.

These aren't apologies; they're scope decisions.

## (13:00–15:00) Q&A buffer

Use the time. If they have no questions, ask:

> "What would you want to dig into more? Anything I glossed over?"

If they ask "what would you do next?" — open [`roadmap.md`](roadmap.md) or the Confluence Roadmap page and walk M6a as the next priority (first shippable slice).

If they ask "what was the hardest part?" — see [`qa-vault.md`](qa-vault.md) Q "depth question". 90-second answer ready.

---

## Backing material referenced

- [v6 spec](../../agent-context-orchestrator-mcp-plan-v6.md)
- [`architecture.md`](architecture.md)
- [`audit-remediation-summary.md`](audit-remediation-summary.md)
- [`runbook.md`](runbook.md)
- [`roadmap.md`](roadmap.md)
- [`known-limitations.md`](known-limitations.md)
- [`qa-vault.md`](qa-vault.md)
- [`ai-honesty.md`](ai-honesty.md)
- ADR-0001 through ADR-0005 in [`docs/adr/`](../adr/)
- Code: [`src/storage/migrationRunner.ts`](../../src/storage/migrationRunner.ts), [`src/storage/schema/auditEntries.ts`](../../src/storage/schema/auditEntries.ts), [`src/security/policyDecisionLayer.ts`](../../src/security/policyDecisionLayer.ts), [`scripts/lint-no-stdout.mjs`](../../scripts/lint-no-stdout.mjs)
- Live: [PCO board](https://lateapexllc.atlassian.net/jira/software/projects/PCO/boards/1), [ACO space](https://lateapexllc.atlassian.net/wiki/spaces/ACO)
