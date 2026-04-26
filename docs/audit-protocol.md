# Audit Protocol — M0 → M11

**Purpose**: a repeatable, evidence-based audit of every milestone delivered so far. The first pass at building M0–M3 (and possibly more by the time you read this) was done iteratively; this protocol surfaces what slipped through.

**Audience**: a Claude Code session whose only job in this run is to *audit*, not build. You should produce findings, not patches (unless the user explicitly says "and fix them as you go").

**Output**: a single dated findings file at `docs/audit-findings-YYYY-MM-DD.md` following the template in §11 below.

---

## How to use this doc

1. Read the entire protocol once before running any commands. The passes are ordered to catch high-signal issues early.
2. Run each pass in order. Capture evidence (command + output snippet) for every finding — never assert "this is broken" without quoting the failure.
3. Each pass tells you **what to verify**, **how to verify it** (specific commands + files), **what "passed" looks like**, and **common gap patterns**.
4. At the end, write the findings file using §11's template. Do **not** edit code unless the user asked you to remediate.
5. Adhere to the verify-before-handoff memory rule (`~/.claude/projects/.../memory/feedback_verify_inability_before_handoff.md`): if a check needs a credential or external system, attempt it first and quote the failure before saying "operator must do this."

**Companion docs you must read before starting**:
- [`agent-context-orchestrator-mcp-plan-v6.md`](../agent-context-orchestrator-mcp-plan-v6.md) — §28 (Implementation Milestones, M0–M11) and §29 (Build Agent Prompts) are the spec the audit measures against.
- [`docs/build-orchestration.md`](build-orchestration.md) — the milestone × partner-guide map.
- [`docs/remaining-phases.md`](remaining-phases.md) — what was *expected* to be delivered per phase.
- [`docs/partners/README.md`](partners/README.md) — partner guides cited by §28 milestone "Uses patterns from" lines.

**Things to assume** going in:
- Files may exist that the previous builder didn't write (linter changes, partial M4+ stubs added by someone else, etc.). Treat current state as ground truth; don't assume the prior session's mental model is current.
- The Bitwarden vault has working Atlassian credentials (item: `atlassian-api-token-jira-cli`). Real-API smoke tests against `lateapexllc.atlassian.net` are expected to work.
- No real Bitbucket Cloud creds; M3 is fixture-only on the live-API axis.

---

## Pass 1 — Static checks (5 minutes)

Catch the obvious mechanical breakage before anything else.

### 1.1 Typecheck

```bash
npm run typecheck
```

**Pass**: zero output beyond the `tsc -p tsconfig.json --noEmit` echo.

**Fail patterns**:
- `Cannot find name 'X'` — likely a missing import after someone added a new domain type / module.
- `Type 'X | undefined' is not assignable to type 'X'` — `exactOptionalPropertyTypes` violation; spread the optional conditionally.
- `'X' is declared but its value is never read` — dead import; flag for cleanup.

### 1.2 No-stdout invariant (F-031)

```bash
npm run lint:no-stdout
```

**Pass**: `F-031 invariant OK: 0 forbidden stdout-writing calls in src/.`

**Fail pattern**: any `console.*` or `process.stdout.write` in `src/`. Quote the file:line. The CLI scripts in `scripts/` are exempt; `src/` is not.

### 1.3 Test suite

```bash
npm test
```

**Pass criteria**:
- Zero failed tests.
- Skipped tests are only the Postgres-parity ones gated on `DATABASE_URL` (count should be 2 unless that gating expanded; if higher, investigate why).
- Test count should be ≥ the count recorded in [`docs/remaining-phases.md`](remaining-phases.md) §2 baseline. Lower count = tests deleted somewhere; investigate.

**Fail patterns**:
- "File has not been read yet" — vitest config issue; rare.
- Time-flaky tests that pass on second run — flag, don't accept.
- Snapshot mismatches — investigate whether the source change was intentional; do **not** auto-update the snapshot during an audit.

### 1.4 Module size review

There is no blocking file-size guard. During review, flag large files only when size is creating concrete reviewability, ownership, or testability risk.

### 1.5 Type cheats

```bash
grep -nrE '(\bas any\b|as unknown as|@ts-ignore|@ts-expect-error|@ts-nocheck)' src/ scripts/ 2>/dev/null
```

**Pass**: zero hits, OR every hit has an inline comment explaining why and pointing to a tracking issue / ADR.

**Fail pattern**: undocumented type cheats; flag each with a one-line context excerpt.

### 1.6 Dead-code sweep (cheap)

```bash
npx --yes ts-prune --project tsconfig.json 2>&1 | grep -v "used in module" | head -50
```

**Pass**: small / well-explained list (intentional public API surface).

**Fail pattern**: many unused exports, especially recently-added ones — suggests stub work that didn't get wired in. Cross-reference Pass 5 (composition gaps).

---

## Pass 2 — Spec compliance vs v6 §28 acceptance bullets

For each milestone delivered, walk the **Acceptance** paragraph in v6 §28 bullet-by-bullet and verify each clause is actually true today. The v6 plan is the contract; this pass tests it.

### Procedure (per milestone)

1. Open `agent-context-orchestrator-mcp-plan-v6.md` and locate the milestone's `### Milestone N` heading.
2. Copy the "Acceptance" paragraph into your audit notes.
3. For each clause in that paragraph, formulate a single check (a command, a file inspection, or a test name).
4. Run/inspect. Quote evidence in the findings file.

### Per-milestone shortcut checklists

These are the most-skipped clauses. Don't trust them as exhaustive — always re-read the v6 paragraph.

**M0 (Scaffold)**:
- Server starts on **both** transports? Run `npm run start:stdio &` (stdin probe) and `npm run start:http &` separately; ensure each comes up cleanly.
- `tools/list` includes `health_check` over **both** transports? For stdio: pipe `{"jsonrpc":"2.0","id":1,"method":"tools/list"}` and grep response. For HTTP: `curl -X POST http://localhost:3000/mcp ...`.
- Session capability + preflight resources work? Verify `orchestrator://session/current/capabilities` and `orchestrator://session/current/preflight` are listed in `resources/list`.
- `docker compose up` succeeds? Don't just typecheck the YAML — actually run `docker compose config` to validate, and if Docker is available, `docker compose build`.

**M1 (Domain + storage)**:
- Create/read/update a draft project succeeds on **PGlite AND Postgres**? Postgres path is gated on `DATABASE_URL`; if not set, flag the gap (acceptance requires both, not "PGlite only").
- Trace links / readiness / policy decisions / session profiles / ACL / audit entries persist? Each repo must have a CRUD test that round-trips.
- Repository calls require `TenantScope`? Spot-check 3 repos: ensure first arg is `TenantScope` and there's a tenant-mismatch rejection test.
- Snapshot tests cover **serialized blueprint AND context pack**? Both, not one.
- Encrypted token round-trip passes? Verify ciphertext-at-rest is not the plaintext (one of the existing tests already does this; confirm it's still present).
- Migration rehearsal test passes (parity between PGlite and Postgres)? Same `DATABASE_URL` gate concern.

**M2 (Atlassian + capability discovery)**:
- Providers work against **recorded fixtures** AND **OpenAPI-driven contract tests**? OpenAPI codegen is `Skipped-with-reason` per F-151, but fixture tests must cover both providers. Verify the fixture-test count for each provider.
- Optional **live integration tests** run only when credentials are present? Look for env-gated test files (`describe.runIf(process.env["ATLASSIAN_LIVE_TEST"])` or similar). Acceptance allows skipping when creds absent; flag if there are no live-test entry points at all.
- **Token encryption AND refresh rotation** tested? Atlassian OAuth refresh-token rotation is in `auth.test.ts`. Verify it covers both happy-path + endpoint-failure.
- Preflight produces a project profile that includes Jira create metadata + required fields + Confluence space/page capabilities + supported body representations + vector-store connectivity + embedding endpoint reachability + **UIO partner reachability when configured** + webhook registration state + auth warnings? Run `npm run preflight` and verify every field above is present in the output JSON. Any missing field is a gap.

**M3 (VCS provider)**:
- Bitbucket Cloud adapter passes contract tests? Fixture tests exist; flag if any HTTP method/path is exercised in code but not tested.
- Interface surface accommodates GitHub without changes? Verify by inspecting `src/providers/vcs/VcsProvider.ts` — types must not have Bitbucket-specific shapes (e.g., `repoSlug` vs `repoId`).
- Worktree acquire/release works on **POSIX AND Windows**? Tests run on whichever OS the CI runs on. If only Windows-tested, flag the POSIX gap as "untested" (not "broken" — `git worktree` is POSIX-tested by git itself, but our wrapper may have OS-specific bugs).

**M4–M11**: when these land, walk their acceptance paragraphs the same way. The protocol scales.

---

## Pass 3 — Wire-shape correctness against real systems

Fixture-driven tests are necessary but not sufficient — they encode our *assumptions* about what the real API returns. Real responses can differ in field shapes, enum values, pagination structure, error formats. We learned this with Confluence v2 in M2 (`/spaces/{id}` vs `?keys=`).

For every provider that has real credentials available in the environment, run a real-API probe and compare the response shape to the TS types in the provider implementation.

### Atlassian (creds available via `.env`)

```bash
# Verify .env has Atlassian creds; if not, instruct operator to populate.
grep -q "^ATLASSIAN_API_TOKEN=" .env || echo "MISSING: ATLASSIAN_API_TOKEN in .env"

# Run preflight against real instance.
npm run preflight 2>&1 | tee /tmp/audit-preflight.log

# Verify each ProjectProfile field has a non-stub value (or a documented stub):
jq '{jira: .jira | keys, confluence: .confluence | keys, vcs: .vcs | keys, vector: .vector | keys, auth: .auth | keys, webhooks: .webhooks | keys, uio: (.uio // "absent")}' /tmp/audit-preflight.log
```

**For each provider call** (Jira `/project/PCO`, `/createmeta`, `/field`; Confluence `/spaces?keys=KEY`, `/pages`, properties; Bitbucket if creds present): make a one-off `curl` to the real endpoint and `jq | keys` the response. Compare against the TS interface in `*RestProvider.ts`. Flag each field that the real response has but the TS interface doesn't model (and vice versa).

**Common gap patterns**:
- Real response has more fields than the TS interface (over-specified). Acceptable but flag for awareness.
- TS interface expects fields the real response doesn't have (under-specified). **Bug** — code may crash or return undefined. Quote the gap.
- Enum values in the real response that aren't in the TS union (e.g., `style: "next-gen"` when union is `"classic"`). **Bug**.
- Pagination shape mismatch (`{startAt, total}` vs `{nextPageToken, isLast}`). **Bug** — pagination is broken even if first page works.

### Bitbucket / GitHub / GitLab

Real creds may not be available. If absent, note in findings: "Real-API smoke for VCS deferred until creds provided." Don't synthesize.

### UIO (probably absent)

The UIO partner described in v6 §35.1 is the *Universal Intake Orchestrator*; the BW vault contains `uio-burst` infra creds (Cloudflare R2 / RunPod / Tailscale) which are a different system. Confirm with operator before assuming UIO is reachable. If absent, the preflight UIO branch should report `enabled: false` and emit no UIO warnings.

---

## Pass 4 — Cross-cutting concerns

Per [`docs/build-orchestration.md`](build-orchestration.md) §7 there are five cross-cutting threads. Verify each is wired through every milestone that touches it.

### 4.1 Security

| Sub-concern | What to verify | How |
|---|---|---|
| File-only logger (F-031) | No `console.*` in `src/` | Pass 1.2 |
| Tenant scoping | Every repo public method takes `TenantScope`; tenant-mismatch rejection test exists | Read each `src/storage/repositories/*.ts`; grep for `TenantScope` in the public interface |
| Token encryption | Master key never echoed; sealed records don't contain plaintext substrings | `grep -r "TOKEN_MASTER_KEY" src/ scripts/`; verify only `readString("TOKEN_MASTER_KEY")` reads it |
| Audit chain (M6a+) | Every external write produces an `AuditEntry`; chain integrity verifier exists | `grep -r "audit\.append\|auditRepository" src/workflows/ src/providers/` |
| Lethal trifecta gate (M7+) | Every cache/vector hit goes through `lethalTrifecta` check | `grep -r "lethalTrifecta\|isLethal" src/` |

### 4.2 Observability

| Check | How |
|---|---|
| `pino` logger used everywhere | `grep -L "pino\|logger" src/**/*.ts \| grep -v test \| grep -v ".d.ts"` finds files that touch I/O without a logger |
| Mgmt API `/healthz`, `/readyz`, `/metrics` reachable | `curl -sf http://127.0.0.1:3001/healthz` after `npm start` |
| OTel counter template (M11+) registered if M11 has shipped | grep for `meter.createCounter` |
| Sentry conditional init (M11+) gates on `SENTRY_ENV` | grep `initSentry` |

### 4.3 Testing

| Check | How |
|---|---|
| 5-cat coverage exists per category that's applicable to the milestone | Inspect `tests/` tree; verify unit (`tests/unit/`), integration (`tests/integration/`), and any contract / conformance / eval directories called out by milestones |
| Iron laws applied: no production code without a failing test first | Check git log for commits — each "feat" should have a paired "test" or include tests. Manual judgment, not automated. |
| Two-stage review (spec → code quality) per superpowers F-107 | If M8/M9 have shipped, look for `twoStageReview` or equivalent in `src/review/` |

### 4.4 Workflow / handoff discipline

| Check | How |
|---|---|
| Per-session worktrees on `orchestrator/<sessionId>` (M3) | `cat src/providers/vcs/worktreeManager.ts` and verify branch prefix matches v6 §24.5 |
| File-based handoff (BRIEF/REQUEST/FEEDBACK) per three-man-team (M5+) | grep for `BRIEF.md\|REQUEST.md\|FEEDBACK.md` references |
| Single-message Task-call constraint documented | grep `docs/claude-code.md` (when emitted by M9) for the constraint |

### 4.5 Conventions / governance

| Check | How |
|---|---|
| `AGENTS.md` follows LF spec (4 sections) | `grep -E "^## (Dev environment tips\|Testing instructions\|PR instructions\|Coding conventions)" AGENTS.md \| wc -l` should be ≥ 4 |
| Every architectural decision has an ADR | `ls docs/adr/` count vs the number of decisions surfaced in the milestones (manual judgment; aim for ~1 ADR per non-trivial decision) |
| ADRs use MADR frontmatter | `grep -L "^---$" docs/adr/*.md` should be empty (every ADR has frontmatter) |

---

## Pass 5 — Composition + wiring gaps (highest-value pass)

This is where the previous build sessions repeatedly missed things: code exists in `src/` but is never wired into the running server or any CLI. Symptom: it compiles, has tests, but does nothing in production.

### Procedure

```bash
# Find every exported function/class that *creates* a runtime component:
grep -rnE "^export function (create|build)[A-Z]" src/ | sort

# For each one, verify it's referenced from at least one of:
#   src/server.ts
#   src/compositionRoot.ts
#   scripts/*.ts
#   src/mcp/buildServer.ts
grep -rnE "create[A-Z]|build[A-Z]" src/server.ts src/compositionRoot.ts scripts/ src/mcp/buildServer.ts | sort
```

For every `create*`/`build*` factory not referenced from one of the four entry points, flag it as **unwired**. For each unwired factory:
1. Identify which milestone introduced it (`git log --oneline -- <file>`).
2. Determine whether it's intentionally unwired (planned for a later milestone) or accidentally unwired (M3 built it, forgot to register it).
3. Quote the file + the absence of references.

### Tools-not-registered check

```bash
# All tool definitions:
grep -rn 'name: "[a-z_]\+"' src/mcp/tools/ src/mcp/registerTools.ts | sort

# Tools registered in server.ts via registerExtraTools:
grep -A 30 "registerExtraTools" src/server.ts | grep -E "register[A-Z]"
```

If a tool is defined but never registered, the running server can't see it. **High-priority finding** — this directly affects user-visible functionality.

### MCP resources check

```bash
grep -rn "resource\|Resource" src/mcp/registerResources.ts | head -20
```

Verify every documented resource URI in the v6 plan is registered. Missing resources are silent gaps — clients will get "resource not found" with no warning.

### Stub workflows (recently added, possibly stubs)

```bash
ls -la src/workflows/ 2>/dev/null
wc -l src/workflows/*.ts 2>/dev/null
```

For each workflow file, check:
- Does it have functional code, or is it a 20-line stub?
- Is it imported by any tool / CLI / server entry point?
- Does it have tests?

Stubs are fine **if intentional** (placeholder for a future milestone) but should be flagged so the auditor's report distinguishes "not built yet" from "built but unwired."

---

## Pass 6 — Documentation accuracy

Drift between docs and code is a slow-acting failure mode. The audit catches it.

### 6.1 AGENTS.md

```bash
# Verify every claim in AGENTS.md is true today:
grep -E "^- " AGENTS.md
```

For each bullet (e.g., "no `console.*` in src/"), verify it via Pass 1's checks. Report any divergence.

### 6.2 CLAUDE.md

```bash
# Verify the "three authoritative docs" + partner guide claims:
grep -E "^[0-9]\." CLAUDE.md
ls agent-context-orchestrator-mcp-plan-v6.md docs/build-orchestration.md docs/partners/
```

### 6.3 Partner guide accuracy

For each partner cited as "Uses patterns from" in v6 §28, open the partner guide and verify:
- §3 source URL still resolves (don't actually fetch every URL; check that the format looks right).
- §5 adoption points reference v6 sections that still exist.
- §8 validation commands are runnable (e.g., `grep -nE "anti-stub" agent-context-orchestrator-mcp-plan-v6.md`).

Flag any partner guide whose adoption points reference v6 sections that changed shape.

### 6.4 ADR currency

```bash
ls docs/adr/*.md | xargs -I{} sh -c 'echo "=== {} ==="; head -10 {}'
```

For each ADR:
- Is the `status` still `accepted`? If `proposed`, what's blocking acceptance?
- Are the Consequences still accurate? If the code has changed materially since the ADR landed, the ADR may need an amendment or a successor ADR.
- Are referenced files / line numbers still valid?

### 6.5 README.md + .env.example

```bash
diff <(grep -oE "^[A-Z_]+=" .env.example | sort -u) <(grep -oE "readString\(\"([A-Z_]+)\"\|readOptionalString\(\"([A-Z_]+)\"\|readBoolean\(\"([A-Z_]+)\"\|readNumber\(\"([A-Z_]+)\"\|readEnum\(\"([A-Z_]+)\"" -r src/ scripts/ | grep -oE '"[A-Z_]+"' | tr -d '"' | sort -u)
```

Env vars in `.env.example` that aren't read by code → dead config (or pre-emptive doc for future milestones; check intent).
Env vars read by code that aren't in `.env.example` → operators won't know to set them. **Bug**.

### 6.6 docs/remaining-phases.md

If milestones beyond M3 have shipped, ensure this file's "current state" snapshot has been updated. Stale handoff doc is worse than missing handoff doc — it actively misleads the next session.

---

## Pass 7 — Test coverage gaps

Quantitative coverage matters less than category coverage.

### 7.1 Coverage by category

```bash
ls -la tests/
# Expected directories at minimum:
#   tests/unit/        — pure unit tests, no IO
#   tests/integration/ — Hono / DB / real-process tests
#   tests/lint/        — invariants like F-031
# When milestones land:
#   tests/contract/    — provider contract tests (M2+)
#   tests/conformance/ — six-dim rubric (M11)
#   tests/evals/       — eval-view golden + judge (M11)
```

Flag any expected category that's missing for a shipped milestone.

### 7.2 Per-milestone test count

Cross-reference [`docs/remaining-phases.md`](remaining-phases.md) §2 for the test-count progression. Verify the current count is at or above the recorded baseline. If lower, find the deletion.

### 7.3 Real-API tests gated on env vars

```bash
grep -rn "process\.env\[\"" tests/ | grep -E "ATLASSIAN_LIVE|BITBUCKET_LIVE|UIO_LIVE|EVAL_VIEW_LIVE"
```

If milestones M2/M3/M4/M11 have shipped, look for env-gated live tests. None found = no real-API smoke coverage in CI; flag.

### 7.4 Snapshot test currency

```bash
find tests -name "__snapshots__" -type d
```

For each snapshot directory, verify the snapshots haven't drifted from actual output. `npm test` should report 0 written snapshots on a clean run; if snapshots are being re-written, investigate why.

---

## Pass 8 — Inter-milestone integration

Each milestone is supposed to consume the previous one's outputs. Verify the seams hold.

### Per-pair seam checks

| Seam | Verify |
|---|---|
| M0 → M1 | `compositionRoot` uses `loadConfig` + `createLogger`; storage uses `OrchestratorConfig` env helpers |
| M1 → M2 | Atlassian providers receive `Repositories` via `compositionRoot`; token store is constructed before any auth provider |
| M2 → M3 | VCS provider uses the same `restClient` pattern + retry semantics; preflight workflow accepts both Atlassian + VCS providers |
| M3 → M4 | (when M4 ships) blueprint workflow uses the composition root; sampling provider is a sibling of Atlassian providers, not a replacement |
| M4 → M5 | Planner consumes `ProjectBlueprint` + `ProjectProfile` from M1+M2 storage; emits `ArtifactPlan` consumed by M6a |
| M5 → M6a | Executor reads the same plan shape the planner emits; idempotency-key stays stable across plan → execute for the same artifact |
| M6 → M7 | Context packs reference `ArtifactRef` produced by M6 provisioning |
| M7 → M8 | Readiness validation reads `TokenBudgetReport` from M7 packs |
| M8 → M9 | Handoff `ManifestSpawn` includes the readiness verdict from M8 |
| M9 → M10 | Webhooks update artifacts referenced by emitted manifests; resource subscriptions notify subscribers |

For each seam, find the actual code path that crosses it. Quote the file + line where the integration happens. If you can't find one, flag the seam as **integration gap** even if both sides compile.

---

## Pass 9 — Memory + decision-record continuity

```bash
ls ~/.claude/projects/C--Users-Chris-Documents-git-atl-mcp/memory/ 2>&1
cat ~/.claude/projects/C--Users-Chris-Documents-git-atl-mcp/memory/MEMORY.md 2>&1
```

Verify:
- `MEMORY.md` exists and indexes any `feedback_*.md` / `project_*.md` files.
- Every feedback rule that surfaced during the build (e.g., "verify before handoff") is captured.
- ADRs in `docs/adr/` are sequentially numbered with no gaps.
- Status frontmatter in each ADR is `accepted` (not stuck at `proposed`).

---

## Pass 10 — Risk register vs delivered code

v6 §34 lists FM-1..FM-20. For each shipped milestone, the audit should note which FM-* risks are mitigated and which are still latent.

```bash
grep -nE "FM-[0-9]+" src/ -r | head -30
```

Cross-reference v6 §34. If a risk is supposed to be mitigated by a milestone that's shipped (e.g., FM-12 destructive-writes mitigated by M5 adversarial triplet) but the mitigation isn't visible in code, flag it.

---

## Pass 11 — Findings report template

Write to `docs/audit-findings-YYYY-MM-DD.md` (use today's date). Use the v6 plan's tone: factual, terse, evidence-bearing.

```markdown
# Audit Findings — YYYY-MM-DD

**Scope**: M0–MX (whichever milestones were claimed delivered as of audit date).
**Auditor**: Claude Code session, audit-only run.
**Companion docs read**: v6 §28, build-orchestration.md, remaining-phases.md, all ADRs, all partner guides cited by shipped milestones.

## Summary

- **Total findings**: N
  - Critical (blocks acceptance): N
  - High (functional gap, but workaround exists): N
  - Medium (quality / discipline): N
  - Low (doc drift / cosmetic): N
- **Real-API smoke results**: pass/fail per provider.
- **Test count**: NNN (vs baseline NNN per remaining-phases.md).
- **Typecheck + no-stdout + lint**: pass/fail.

## Findings

For each finding:

### F-NNN: <one-line title>

- **Severity**: Critical | High | Medium | Low
- **Pass / Milestone**: which audit pass surfaced it; which milestone it belongs to.
- **Evidence**: command run + output snippet (5–10 lines max), or file:line excerpt.
- **What's broken / missing**: one paragraph.
- **Suggested remediation**: one paragraph; do **not** apply unless the user asked.
- **Blocks**: which downstream milestone is gated by fixing this (if any).

(Repeat per finding.)

## What I did NOT verify

Be honest about gaps in the audit itself:
- "Did not run real-Bitbucket smoke (no creds)."
- "Did not test stdio transport with a real MCP client (no inspector available)."
- "Did not verify Postgres parity (DATABASE_URL not set)."

## Recommended next actions for the operator

A short ranked list. Top item should be the most-impactful Critical finding.

## Re-audit cadence

When should the next audit run? (E.g., "after Phase 2 ships" or "when DATABASE_URL becomes available.")
```

---

## Operating notes for the auditor

- **You are an auditor, not a builder this session.** Resist the urge to fix things you find. Surface them in the report.
- **Quote evidence, never paraphrase.** A finding without a command + output is unactionable.
- **Distinguish "broken" from "not built yet" from "built but unwired."** The remediation paths are very different.
- **If a check needs creds you don't have, attempt it once with whatever's available (BW vault session, etc.) before deferring to the operator.** The verify-before-handoff memory rule applies.
- **Time-box passes**: Pass 1 should finish in 10 minutes. If a single pass takes > 1 hour, you're going too deep — note it as "audit deferred" and move on.
- **At the end, hand back to the operator with: total findings count + the report path.** Don't summarize all findings inline in chat; that defeats the report's purpose.
