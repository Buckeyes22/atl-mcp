# Milestone delivery checklists

Per-milestone, per-clause acceptance ledger. Each file mirrors the v6 §28 acceptance paragraph and cites the test file or code path that proves each clause.

## Status legend

- `[x]` — clause met; evidence cited inline.
- `[ ]` — clause **NOT MET** today; remediation action linked.

## Index

- [M0 — Scaffold](M0.md) — production-quality.
- [M1 — Domain + storage](M1.md) — production-quality (Postgres parity awaits `DATABASE_URL`).
- [M2 — Atlassian providers + preflight](M2.md) — production-quality with the F-010 caveat (team-managed required fields).
- [M3 — VCS provider](M3.md) — production-quality on Windows; POSIX awaits CI matrix.
- M4–M11 — **stub state per F-001**; checklist files land alongside each milestone's actual delivery, NOT before.

## Rules

1. A milestone file lands when the milestone is delivered, NOT before.
2. A `[ ]` row blocks setting the corresponding `MILESTONE_N_ENABLED` flag to true.
3. Every `[x]` row cites a test file:line OR a real-API smoke procedure with reproducible commands.
4. When code drifts (e.g., a test gets renamed), update the citation here in the same PR.

## Re-audit cadence

After each `MILESTONE_N_ENABLED=true` flip, re-run the corresponding milestone's checklist as part of the PR review. A flag flip without a matching all-`[x]` checklist file fails Stage-1 review per AGENTS.md.
