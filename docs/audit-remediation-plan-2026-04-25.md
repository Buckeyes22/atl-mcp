# Audit — Comprehensive Gap Closure Plan (2026-04-25)

**Companion to**: [`audit-findings-2026-04-25.md`](audit-findings-2026-04-25.md). This plan closes all 18 findings (F-001 through F-018) sequenced by dependency order. Each phase is sized to fit a single working session unless explicitly noted.

**Operating rules** (carry over from the audit protocol):
- Do not claim a finding closed without verification evidence (test name, command + output, or file:line excerpt).
- Each finding-closure commit message references the finding ID (e.g., `fix(audit): close F-002 — wire PolicyDecisionLayer into provisionJob.execute`).
- Do not bundle unrelated findings into a single commit; one finding per PR makes review tractable.
- Add an entry to `docs/audit-findings-2026-04-25.md` under "Closures since 2026-04-25" as each fix lands.

**Phase ordering rationale**: Phase A is non-negotiable first because every later phase reads "the M4–M11 stubs" differently depending on whether they remain wired. Phase B unblocks any real-write smoke. Phases C and D can interleave once B is done. Phase E is independent infrastructure work that can run in parallel.

---

## Phase A — De-risk the false-positive surface (Sessions 1–2)

The audit's headline finding (F-001) is that the MCP server presents M4–M11 surface area whose names match the spec but whose bodies do not satisfy the acceptance bars. Until that's resolved, every other gap is interpreted against an unstable baseline.

### A.1 — Close F-001 + F-013: gate the stubs and update the handoff doc

**Findings closed**: F-001 (Critical), F-013 (Medium).

**Decision required first** — pick exactly one:
- **(a)** Replace each stub body with a `ToolNotImplementedYetError` that the dispatcher renders as an error with `isError: true` + a message naming the milestone. Tools remain *listed* (so consumers see the planned surface) but unusable.
- **(b)** Gate registration behind per-milestone feature flags (`MILESTONE_4_ENABLED`, etc.); when off, the tool isn't registered at all. Default all to `false` until each ships.
- **(c)** Remove the stub registrations entirely from `registerCompositionTools`; restore them as each milestone is built. (Most aggressive; loses the discovery surface.)

**Recommended**: option (b) — keeps the planned surface visible in code, prevents accidental use, and the flag flip is the natural gate at milestone-completion time.

**Steps** (option b):
1. Add a typed `MilestoneFlags` block to `src/config.ts` reading `MILESTONE_4_ENABLED`, `MILESTONE_5_ENABLED`, ..., `MILESTONE_11_ENABLED`. Default all to `false` in dev, all to `false` in deployed (operators flip per milestone).
2. In `src/mcp/registerCompositionTools.ts`, wrap each `register*Tools` call in:
   ```ts
   if (config.flags.milestone4Enabled) { registerProjectIntakeTools({ ... }); }
   ```
3. Add a smoke test at `tests/integration/registerCompositionTools.test.ts` asserting that with all flags off, the registered tools list is **only** `health_check, project_preflight_check, project_profile_get`.
4. Update `docs/remaining-phases.md` §2 to reflect:
   - "Production-quality through M3."
   - "M4–M11 surface area exists as wired stubs gated by `MILESTONE_N_ENABLED` flags. **The stub bodies do not satisfy v6 §28 acceptance.** Each milestone's first task is to replace the stub before flipping the flag."
5. Update `docs/remaining-phases.md` §9 item 4 (the "MCP server doesn't yet expose preflight tools" item) — this is now resolved; preflight + profile_get are exposed unconditionally.

**Acceptance**:
- `MILESTONE_4_ENABLED=false` (default) → `tools/list` excludes `project_intake_create` etc.
- Test from step 3 passes.
- `docs/remaining-phases.md` reads correctly to a session that has zero context.

**Effort**: 1 session.

### A.2 — Add a per-milestone "delivery checklist" template

**Why**: F-001 happened because there is no enforcement that "tool registered" → "acceptance bar met." A per-milestone checklist file makes the gap visible.

**Steps**:
1. Add `docs/milestone-checklists/` (one file per milestone, e.g., `M4.md`).
2. Template content per file: the acceptance paragraph from v6 §28, then a bullet list of every clause with a checkbox. Cite the test file or code path that proves each clause.
3. Tie this to a CI gate (later phase): `lint:milestone-checklists` fails if a milestone is `_ENABLED=true` but its checklist has unchecked items.

**Acceptance**: M0/M1/M2/M3 checklist files exist with **every** acceptance clause cited as backed by a test or code path. Disagreements that surface during this exercise become new findings.

**Effort**: 0.5 sessions per milestone × 4 = 2 sessions. Treat as homework, not blocking.

---

## Phase B — M6a foundations (Sessions 3–6)

These four findings are interlocked: each is a prerequisite for any real-write smoke against Atlassian. Until they land, do **not** flip `MILESTONE_6A_ENABLED`.

### B.1 — Close F-002: wire PolicyDecisionLayer into `provisionJob.execute`

**Finding closed**: F-002 (Critical).

**Steps**:
1. In `src/queue/jobs/provisionJob.ts`:
   - Add `policy: PolicyDecisionLayer` to `createProvisionJobExecutor` deps.
   - Before each `jira.createIssue`, call:
     ```ts
     const decision = await deps.policy.decide(scope, {
       toolName: "project_provision_execute",
       projectId: input.plan.projectId,
       intent: "mutate_external",
       attributes: { target: "jira_issue", actionId: action.id },
     });
     if (decision.effect === "deny") {
       skippedActions.push({ actionId: action.id, reason: `policy denied: ${decision.reasons.join("; ")}` });
       continue;
     }
     if (decision.effect === "require_approval") {
       // Honor the approval token: the caller's `input.approved` boolean is the
       // first-pass; eventually session-scoped approval tokens land here.
       if (!input.approved) throw new Error(`policy requires approval: ${decision.reasons.join("; ")}`);
     }
     await deps.audit.append(scope, { ...policyDecisionRecord(decision) });  // optional: persist the decision
     ```
2. In `src/mcp/registerCompositionTools.ts:65-78`, pass `policy` (already created at line 60) into `createProvisionJobExecutor`.
3. Add a unit test in `tests/unit/queue/provisionJob.test.ts`:
   - Mock policy returns `effect: "deny"` → assert `jira.createIssue` was never called.
   - Mock policy returns `effect: "require_approval"` + `approved: false` → assert throws.
   - Mock policy returns `effect: "allow"` → assert createIssue ran, audit chain extended.

**Acceptance**: All three new tests pass; the existing `provisionJob` integration test still passes.

**Effort**: 1 session.

### B.2 — Close F-003 + F-004: persistent audit signing key + JCS canonicalization

**Findings closed**: F-003 (Critical), F-004 (High).

**Steps**:
1. **Decide ADR direction first**:
   - Option (i): use `@noble/curves` ed25519 (matches ADR 0002's stated rationale). Add `@noble/curves` to `dependencies`.
   - Option (ii): keep Node `crypto` and amend ADR 0002's More Information section with the rationale ("zero new deps, sufficient security profile").
   - Recommended: option (i). It matches what ADR 0002 already pre-decided.
2. Add JCS canonicalization. Pick:
   - `canonicalize` npm package (smallest, ~600 bytes, RFC 8785-aligned), OR
   - `rfc8785` npm package (more thorough number-handling).
   - Recommended: `rfc8785`.
3. Replace `src/security/auditChain.ts:canonicalize` with the chosen lib.
4. Persistent key handling:
   - On startup (in `compositionRoot`), check for `AUDIT_SIGNING_PRIVKEY_PATH`.
   - If present and the file exists: read the private key.
   - If absent or file missing: generate a new keypair, write the private key to that path with `0600`, register the public key via `keyRegistryRepository`.
   - `createAuditSigner` becomes `createAuditSigner({ privateKey, publicKey, keyId })`.
5. Wire `keyRegistryRepository` into `compositionRoot` and use it during the bootstrap step above. Set `AUDIT_SIGNING_KEY_REGISTRY_REF=refs/orchestrator/keys/` as the default `refPrefix` (already in `.env.example`).
6. `scripts/audit-keys-init.ts` becomes the explicit bootstrap path for first deployment; document in a new ADR.
7. New ADR: `docs/adr/0005-audit-signing-pipeline.md` (MADR format) capturing: cipher choice (i or ii above), JCS lib choice, key rotation procedure, and the ed25519/JCS/git-ref key-registry triad.
8. Add a vitest at `tests/integration/security/auditChain.test.ts`:
   - Round-trip sign → verify with the same key → PASS.
   - Round-trip sign with key A → verify with key B → FAIL.
   - JCS-canonicalized sign of `{a:1,b:2}` and `{b:2,a:1}` produce **identical** signatures.
   - First-boot scenario: empty key file → key generated, file written, ref registered.
   - Second-boot scenario: existing key file → key reused, no new ref written.

**Acceptance**:
- All new tests pass.
- `git fetch origin refs/orchestrator/keys/<keyId>` (against a remote with this commit pushed) retrieves the public key blob.
- `provisionJob` smoke against real Jira (V-1 follow-up) produces audit entries whose signatures verify against the registered ref.

**Effort**: 1.5–2 sessions.

### B.3 — Close F-011: persistent provision job state

**Finding closed**: F-011 (High).

**Steps** — pick one:
- **(a) Database-backed (interim)**: add `provisionJobs` table + `provisionJobRepository` mirroring the existing repo pattern. Replace `globalProvisionJobStore` reads in `src/mcp/registerResources.ts:74-82` with repository reads.
- **(b) BullMQ + Redis (per spec)**: stand up Redis (`docker compose up redis`), wire `createBullMqProvisionQueue` from `src/queue/provisionQueue.ts`, persist job state via the provision job repository. Update `compositionRoot` to require `REDIS_URL`.

**Recommended**: (b), because v6 §24 mandates BullMQ. Use (a) only if Redis is genuinely not part of the deployment story.

**Steps for (b)**:
1. Add `BullMQ` worker process module at `src/queue/provisionQueue.ts`.
2. In `compositionRoot`, instantiate the queue if `REDIS_URL` is present.
3. Replace `globalProvisionJobStore` with a thin adapter over the BullMQ Queue (jobs become BullMQ jobs; states map to BullMQ states).
4. `orchestrator://job/{id}` resource reads via `queue.getJob(id)`.
5. `orchestrator://jobs/recent` reads via `queue.getJobs(['active','completed','failed'], 0, 19)`.
6. Add an integration test at `tests/integration/queue/provisionQueue.test.ts` requiring a Redis fixture (gate on `REDIS_URL`).

**Acceptance**:
- After server restart, an in-flight job's state survives (verifiable via `orchestrator://job/{id}` after a deliberate restart).
- Concurrent execute calls don't corrupt state (BullMQ serializes per job).

**Effort**: 1.5 sessions for (b); 1 session for (a).

### B.4 — Close F-006: real adversarial verification triplet

**Finding closed**: F-006 (High).

**Steps**:
1. Replace `src/review/adversarialTriplet.ts` body. New shape:
   ```ts
   export async function runAdversarialTriplet(
     plan: ArtifactPlan,
     deps: { sampling: SamplingAdapter; now: () => string }
   ): Promise<AdversarialTripletResult> {
     const [fp, mi, cv] = await Promise.all([
       deps.sampling.sample({ prompt: falsePositiveFilterPrompt(plan), ... }),
       deps.sampling.sample({ prompt: missingIssuesFinderPrompt(plan), ... }),
       deps.sampling.sample({ prompt: contextValidatorPrompt(plan), ... }),
     ]);
     const synthesizer = await deps.sampling.sample({ prompt: synthesizerPrompt([fp, mi, cv]), ... });
     return parseSynthesisVerdict(synthesizer.text, deps.now());
   }
   ```
2. Add three prompt files: `prompts/triplet-false-positive-filter.md`, `prompts/triplet-missing-issues-finder.md`, `prompts/triplet-context-validator.md`, plus `prompts/triplet-synthesizer.md`. Reference `docs/partners/claude-workflow-v2.md` F-083/F-084 for the prompt patterns.
3. Fallback when `sampling.enabled === false`: keep the deterministic-checks path **but** return `verdict: "FAIL"` with reason "sampling unavailable; cannot run adversarial critics" in deployed tier. Dev tier may PASS to support local testing.
4. Update `provisioningWorkflow.ts:46` to await the new async signature; pass the sampling adapter from the workflow's deps.
5. Update unit tests at `tests/unit/workflows/provisioningWorkflow.test.ts` to mock the sampling adapter.

**Acceptance**:
- New unit test: with mocked critics returning PASS → verdict PASS. With one returning FAIL → verdict FAIL.
- Existing snapshot tests (if any) are updated to reflect the LLM-driven verdict shape; do not auto-update silently.

**Effort**: 1.5 sessions, mostly prompt-template iteration.

---

## Phase C — M2 wire-shape correctness (Session 7)

### C.1 — Close F-010: per-issue-type required-fields drill-down

**Finding closed**: F-010 (High, latent).

**Steps**:
1. In `src/providers/atlassian/jiraRestProvider.ts:discoverProjectCapabilities`, after the existing `/createmeta/{key}/issuetypes` call, add a second pass:
   ```ts
   const perTypeRequired = await Promise.all(
     createMeta.body.issueTypes.map(async (t) => {
       const fields = await client.request<JiraCreateMetaFieldsResponse>({
         method: "GET",
         path: `/rest/api/3/issue/createmeta/${encodeURIComponent(projectKeyOrId)}/issuetypes/${encodeURIComponent(t.id)}`,
       });
       return [t.name, fields.body.fields.filter((f) => f.required && !f.hasDefaultValue).map((f) => f.name)] as const;
     }),
   );
   const requiredFields = Object.fromEntries(perTypeRequired);
   ```
2. Add `JiraCreateMetaFieldsResponse` interface mirroring the real shape.
3. Update `tests/integration/providers/jiraRestProvider.test.ts` with a recorded fixture for the per-issue-type endpoint covering at least one team-managed and one company-managed project.
4. Verify against real API per `docs/audit-verification-plan-2026-04-25.md` V-1 procedure (curl + jq | keys).

**Acceptance**:
- Preflight against `lateapexllc.atlassian.net/SAM1` returns non-empty `requiredFields[Story]` (or any other type that has required custom fields).
- Existing M2 fixture tests still pass.
- M5 planner (when wired) can read the populated `requiredFields` map.

**Effort**: 1 session.

---

## Phase D — Discipline, hygiene, docs (Sessions 8–10)

These are independent of B/C and can run in parallel. Group them by ergonomics.

### D.1 — Superseded: file-size guard removed

**Finding closed**: F-007 (Medium).

**Per-file split plan** (lowest-risk first):

| File | Lines | Suggested split |
|---|---|---|
| `tests/integration/storage/repositories.test.ts` | 222 | Split per repository (one test file per repo) |
| `src/transport/http.ts` | 209 | Extract `createSession` to `src/transport/http/session.ts`; extract `toNodeReqRes` |
| `src/providers/atlassian/jiraRestProvider.ts` | 210 | Extract wire types to `jiraWireTypes.ts`; keep public surface in the main file |
| `src/providers/http/restClient.ts` | 230 | Extract `defaultFetch` + URL builder helpers to `restHttpAdapter.ts` |
| `src/providers/atlassian/confluenceRestProvider.ts` | 233 | Extract content-property helpers + wire types |
| `src/preflight/preflightWorkflow.ts` | 250 | Extract per-target safe-discover helpers (`safeDiscoverJira`, etc.) into `preflightDiscoverers.ts` |
| `src/providers/vcs/worktreeManager.ts` | 257 | Extract git-shellout primitives to `gitWorktreeShell.ts` |
| `src/providers/vcs/bitbucket/bitbucketRestProvider.ts` | 328 | Split per resource: `bitbucketRepo.ts`, `bitbucketPullRequest.ts`, `bitbucketWebhook.ts` |

**Steps per file**:
1. Move helpers/types to a sibling file.
2. Re-export from the original file if the surface is publicly imported elsewhere (preserve the existing import paths).
3. Run `npm test` after each split.

**Add a CI gate**:
Operator decision on 2026-04-25 removed the file-size guard entirely. Do not re-add a blocking 200-line check without a new decision.

**Acceptance**: no `lint:file-size` script, test, or CI step remains. Large files may still be split opportunistically.

**Effort**: 1–2 sessions.

### D.2 — Close F-008: comment or remove `as unknown as` casts

**Finding closed**: F-008 (Low).

**Steps**:
1. `src/server/mgmtApi.ts:82`, `src/transport/http.ts:125`: both cast `serve()`'s return type to `HttpServer`. Add a `// HACK: @hono/node-server's serve() returns `unknown`-typed server; cast to access close().` comment, or wrap the cast in a typed helper.
2. `src/transport/http.ts:189`: cast `transport as unknown as Transport`. The MCP SDK's `Transport` type is structurally compatible with `StreamableHTTPServerTransport`. Add a comment, or upgrade the SDK if a newer version fixes the typing.

**Acceptance**: every remaining double-cast has an inline `// HACK:` or `// SDK-types:` comment with the reason.

**Effort**: <1 hour.

### D.3 — Close F-012: per-host emitter for `syncAgentConfigs`

**Finding closed**: F-012 (Medium).

**Steps**:
1. Refactor `scripts/syncAgentConfigs.ts`:
   - Read `AGENTS.md` as source.
   - For each emitter target, call a per-host transformer:
     - `emitClaudeMd(agentsContent)` — composes AGENTS.md + Claude-specific addendum (from a new `docs/host-addenda/claude.md`).
     - `emitCodexMd(agentsContent)` — composes for Codex.
     - `emitCursorRules(agentsContent)` — Cursor uses a specific format; reference `docs/partners/everything-claude-code.md` and `docs/partners/agent-maestro.md`.
     - `emitCopilotInstructions(agentsContent)` — Copilot uses `.github/copilot-instructions.md`.
2. **Refuse-to-overwrite guard**: before writing each target, read its current content. If it doesn't begin with a marker line `<!-- AUTO-GENERATED FROM AGENTS.md — DO NOT EDIT BY HAND -->`, refuse with a clear error pointing at the per-host addendum file.
3. Add the marker line as the first content line of each emitted file.
4. Add a unit test at `tests/unit/scripts/syncAgentConfigs.test.ts` for the refusal behavior.

**Acceptance**:
- Running `npm run sync:agents` after a fresh checkout (where CLAUDE.md is hand-authored) fails with a clear error and exit 1.
- After moving the hand-authored content to `docs/host-addenda/claude.md` and re-running, CLAUDE.md is regenerated correctly.

**Effort**: 1 session.

### D.4 — Close F-014 + F-016: ADR currency notes

**Findings closed**: F-014 (Low), F-016 (Low).

**Steps**:
1. Append to `docs/adr/0001-pglite-for-dev.md`:
   ```markdown
   ## Status notes
   - 2026-04-25: `src/storage/vector/` referenced in §Decision Outcome lands with M7; not present today.
   ```
2. Append to `docs/adr/0002-token-encryption-noble-ciphers.md` and `0003-confluence-storage-default-adf-flagged.md`:
   - "2026-04-25: M2 ships storage-only; ADF renderer placeholder remains TBD."
3. If F-004 is closed by adopting `@noble/curves`, no further edit; if by amending the ADR, append the rationale to ADR 0002.

**Acceptance**: ADRs read accurately to a session that has zero context.

**Effort**: 30 minutes.

### D.5 — Close F-018: env var doc gap

**Finding closed**: F-018 (Low).

**Steps**:
1. Add to `.env.example` under a new "Server identity" section:
   ```
   # === Server identity ===
   # ORCHESTRATOR_NAME=atl-mcp-orchestrator
   # ORCHESTRATOR_VERSION=0.1.0
   ```
2. Verify the `.env.example` ↔ `src/`-readers diff (as run in audit Pass 6.5) is now empty.

**Acceptance**: zero env vars consumed by code that aren't in `.env.example` (commented or active).

**Effort**: 5 minutes.

### D.6 — Close F-009: scope from session, not hardcoded

**Finding closed**: F-009 (Medium).

**Steps**:
1. In `src/mcp/registerCompositionTools.ts:30`, replace `const scope = defaultTenantScope();` with:
   ```ts
   const resolveScope = (sessionId: string | undefined): TenantScope => {
     // v1 single-tenant: always default. v2+ derives from session profile.
     return defaultTenantScope();
   };
   ```
2. Pass `resolveScope` through to each `register*Tools` factory; wire `args.resolveCurrentSessionId` at the call site.
3. Document the seam with a `// SaaS-runway:` comment per v6 §7.3.

**Acceptance**: refactor is mechanical; existing tests pass unchanged.

**Effort**: <1 session.

---

## Phase E — Operational hardening (Session 11)

### E.1 — Close F-005: env-gated live tests

**Finding closed**: F-005 (High).

**Steps**:
1. Create `tests/integration/live/` directory with subdirs per provider:
   - `tests/integration/live/atlassian.test.ts` — gated on `process.env["ATLASSIAN_LIVE_TEST"] === "1"`.
   - `tests/integration/live/bitbucket.test.ts` — gated on `BITBUCKET_LIVE_TEST=1`.
   - `tests/integration/live/uio.test.ts` — gated on `UIO_LIVE_TEST=1`.
2. Each file uses `describe.runIf(...)` so it skips silently in normal `npm test`.
3. Tests load `.env`-style creds, hit the same endpoints `npm run preflight` does, assert wire-shape stability.
4. Add a CI job (separate from the matrix in V-2) that sets `ATLASSIAN_LIVE_TEST=1` and runs nightly.

**Acceptance**:
- `npm test` count unchanged when env vars unset.
- `ATLASSIAN_LIVE_TEST=1 npm test` exercises the live tests; passes against `lateapexllc.atlassian.net`.
- A breaking change in real-API shape now surfaces in CI within 24 hours.

**Effort**: 1 session.

### E.2 — Close F-015: anti-stub scanner gates CI

**Finding closed**: F-015 (Medium).

**Steps**:
1. Strengthen `src/security/antiStubScanner.ts`:
   - Detect minimum-body stubs: a function whose entire body is `return {...};` (configurable threshold of N lines).
   - Detect static-literal returns where the function name suggests dynamic behavior (e.g., `generate*`, `validate*`, `compute*` returning a string literal).
   - Detect `new Set<string>()` used as a singleton in code paths whose acceptance bar requires distributed dedup (M10).
2. Replace the broad `/placeholder/i` regex (which matches the word "placeholder" in any context, including legitimate docs) with a stricter pattern: `/placeholder(?: for | implementation| stub| fixme)/i`.
3. Add `npm run lint:anti-stub` to the `test` script (or wrap as a vitest at `tests/lint/anti-stub.test.ts`).
4. Run the scanner against `src/`. Surface every hit as a candidate finding for the next audit (do not silence by relaxing the rule).

**Acceptance**:
- `npm test` runs the scanner.
- The scanner catches the F-001 stub bodies (this is the test for the test).

**Effort**: 1 session.

---

## Phase F — POSIX coverage (Session 12)

### F.1 — Close F-017: CI matrix for POSIX worktree

**Finding closed**: F-017 (Medium).

**Steps**: see V-2 in `docs/audit-verification-plan-2026-04-25.md`. The matrix unblocks both V-2 and F-017.

**Effort**: 1–2 hours.

---

## Sequencing summary

| Session | Phase | Findings closed | Notes |
|---|---|---|---|
| 1 | A.1 | F-001, F-013 | Most important; unblocks everything |
| 2 | A.2 | (M0/M1/M2/M3 checklists) | Can run in parallel with B |
| 3 | B.1 | F-002 | Required before any real Jira write |
| 4 | B.2 | F-003, F-004 | Required for M6a acceptance |
| 5 | B.3 | F-011 | Required for M6a operational acceptance |
| 6 | B.4 | F-006 | Required for M5/M6a acceptance |
| 7 | C.1 | F-010 | Required for M5 planner correctness |
| 8 | D.1 | F-007 | Mechanical; can defer |
| 9 | D.2, D.3, D.4, D.5, D.6 | F-008, F-009, F-012, F-014, F-016, F-018 | Bundle as a hygiene PR series |
| 10 | E.1 | F-005 | Independent; needed before any post-fix smoke |
| 11 | E.2 | F-015 | Independent |
| 12 | F.1 | F-017 | Independent; same CI work as V-2 |

**Critical path**: A.1 → B.1 → B.2 → B.3 → B.4 → C.1 → (M5/M6a real-write smoke). 7 sessions to a credible "first shippable slice" per v6 §37.

**Parallelizable**: D.* and E.* can run alongside the critical path with no coordination.

---

## Closing the audit

When all 18 findings have closure evidence, append to `docs/audit-findings-2026-04-25.md`:

```markdown
## Closures since 2026-04-25

- F-001 — closed YYYY-MM-DD by <PR/commit>; evidence: <test-file:line> + `tools/list` excerpt.
- F-002 — closed YYYY-MM-DD by <PR>; evidence: `tests/unit/queue/provisionJob.test.ts > policy denial path`.
- ... (one row per finding, in F-NNN order)
```

Then schedule a re-audit per the original "Re-audit cadence" section, expecting most issues to be closed and net-new issues to surface.
