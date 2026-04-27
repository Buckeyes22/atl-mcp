# Q&A Vault

> Pre-prepared answers to questions interviewers tend to ask. Each entry has a 30-second version (the verbal answer) and a 90-second version (the deep-dive if pushed). The 30s version is what you say first.

---

## Category: Provenance and authorship

### Q1. How much of this did you write vs. AI-generate?

**30s.** I designed the v6 spec and the architectural decisions. I orchestrated the build through Claude Code following the build prompts in v6 §29. The Jira project (PCO) and Confluence space (ACO) you're looking at are the system's *output* — generated content, not authored. I have a page that breaks this down with specific examples — see [`ai-honesty.md`](ai-honesty.md). The short version: design and judgment are mine; production code is heavily AI-assisted following test-first discipline; generated content is system output.

**90s.** Three categories: Designed, Orchestrated, Generated. Designed includes the v6 spec evolution from v5 (see v6 §0 for the diff), the 10 ADRs in [`docs/adr/`](../adr/), the readiness rubric in v6 §17, the failure-mode taxonomy in v6 §30.4, and the dogfooding strategy itself. Orchestrated includes the milestone implementations (M0 through current) following per-milestone build prompts in v6 §29 — every code commit follows test-first per the iron law in CLAUDE.md. Generated includes the Jira project structure, the Confluence page tree, and the cross-linking — all output of the orchestrator's blueprint on its own profile. A skeptical reader can verify the orchestration boundary by reading any source file alongside its v6 §29 build prompt — the alignment is intentional.

---

### Q2. Did you actually write that migration runner / audit chain / policy layer code yourself?

**30s.** I designed each one and wrote test cases first. Claude Code wrote production code that satisfied the tests, and I reviewed the result against the v6 spec. Pick any file — for example [`src/storage/migrationRunner.ts`](../../src/storage/migrationRunner.ts) — and ask me to walk through it line by line. The answer should match what's documented because I made the calls.

**90s.** I'll happily walk any module live. The most defensible single piece of code is `migrationRunner.ts` because the rehearsal pattern was a deliberate choice to address Incident B (see runbook). Specifically: the design says "rehearsal mode applies migrations to a temp DB populated from a prod-shaped seed, then verifies invariants before signing off." I made that call after a real incident; the implementation enforces it; the test [`tests/integration/storage/migrationRehearsal.test.ts`](../../tests/integration/storage/migrationRehearsal.test.ts) protects it from regressions. Each layer — design, code, test — earns its trust from the layer below.

---

### Q3. How long did this take? Be specific.

**30s.** The v6 spec is the result of synthesizing 42 partner integration guides over multiple weeks. The implementation is at milestone M2/M3 of M11; that's roughly N weeks of orchestrated build time. The portfolio polish — the seed Jira, Confluence, audit findings, tour scripts — was ~40 hours over 3 weeks.

**90s.** Specific breakdown in [`interviewer-walkthrough.md`](interviewer-walkthrough.md) §55. The portfolio packaging effort was 13 phases ranging from 1h (AI-honesty page) to 16h (one real shipping milestone). I'm not finished — see [`roadmap.md`](roadmap.md). M4 through M6c are still ahead, plus M7–M10. The deferred milestones are explicit, not hidden.

---

## Category: Scope and depth

### Q4. What's the hardest technical problem in here?

**30s.** The audit chain in v6 §30.1 — specifically the rotation procedure documented in [ADR-0005](../adr/0005-audit-signing-pipeline.md). Hash-linked signed logs are easy if keys never rotate. They get hard the moment you need to change a key without breaking verifiability of historical entries. The git-ref-versioned key registry is one model; the alternative is per-epoch signing. I picked the git-ref model and documented the cost in the ADR. Multi-tenant isolation makes this even harder — see v6 §7.3 for the runway.

**90s.** Walk through the rotation procedure: every signature carries a `key_id`. That `key_id` resolves through the registry git ref to a public key. Rotation is a registry-ref update + a logged audit event. To verify a historical entry, the verifier walks the git ref's commit history to find the registered key at the entry's timestamp. Edge cases: revocation (a key stays in the registry as `revoked`, history is still verifiable), compromised key (rotate + re-sign? no — that breaks the chain. The compromise itself becomes an audit entry, and the chain extends; we don't rewrite history). The genesis block is unsigned (`prev_hash = NULL`), which is the chicken-and-egg case — verifier handles it specially. Multi-tenant: each tenant needs its own registry ref AND its own signing key. The current implementation bakes single-tenant into the schema; multi-tenant is a refactor (PCO-51).

---

### Q5. What's the worst part of this design?

**30s.** The audit chain is single-tenant by design. The schema in [`src/storage/schema/auditEntries.ts`](../../src/storage/schema/auditEntries.ts) has no tenant column. For a v1 portfolio piece this is correct — multi-tenant adds significant scope. But it's the first thing I'd refactor if pushing this to production with multiple customers. The runway is documented in v6 §7.3, and PCO-51 is a tracked spike that explores the surface.

**90s.** Same as 30s, plus: the dual-renderer in [`src/providers/atlassian/`](../../src/providers/atlassian/) (ADF + storage format) is the highest *ongoing* cost in the project. Two paths through code, two test suites, two mental models. ADR-0003 documents the choice; I still believe ADF-as-default-with-flag is right, but every time I touch a Confluence renderer the cost is real. If I were starting fresh and the partner inventory were different, I might choose differently.

---

### Q6. What would you do differently?

**30s.** Three things. First, I'd put `lint:no-stdout` in M0 instead of M1 — the protocol invariant should have been the very first CI check. Second, I'd build the migration runner before any migration, not after the first one. Third, I'd write the demo plan before milestone 0 — the dogfooding frame should drive what gets built first, and I'm reverse-engineering the demo from completed milestones now.

**90s.** Same as 30s, plus: I'd treat the partner integration synthesis (42 guides) as a separate deliverable from the spec — the partners are reference-quality, but bundling them into the spec made it heavier than it needed to be. And I'd start M11 (observability + hardening) much earlier in the sequence; without observability, debugging earlier milestones is harder than it should be.

---

## Category: Implementation specifics

### Q7. Why pglite for dev?

**30s.** [ADR-0001](../adr/0001-pglite-for-dev.md). Short version: zero-config local dev that exercises real Postgres semantics. The alternative was sqlite, which would have required schema differences for production. Pglite is real Postgres in WASM, so the migration in [`src/storage/migrations/0001_init.sql`](../../src/storage/migrations/0001_init.sql) runs identically locally and in prod.

**90s.** Same plus: pglite has limitations — its vacuum behavior differs subtly from full Postgres, which generated F-09 in audit findings. The mitigation is documented: rehearsals targeting indexed-column migrations must run against a true Postgres snapshot. Acceptable cost because dev/prod schema parity was the bigger problem to solve.

---

### Q8. Why ed25519 instead of secp256k1 or RSA?

**30s.** Three reasons: small keys (32 bytes public, 64 bytes signature), fast verification, no PRNG needed for signing (deterministic from key + message). secp256k1 has the PRNG dependency. RSA is too slow for a per-write signature. ed25519 is the right tool for an audit log where verification happens often.

**90s.** Plus: ed25519 is widely audited (used in SSH, Signal, Tor). The @noble/ciphers library implements it with audited constant-time primitives — see ADR-0002 for why noble. The cost: ed25519 lacks some cryptographic agility features that ECDSA has, but for the audit-chain use case (sign-once, verify-many, no batched aggregation needed), this doesn't matter.

---

### Q9. Why ADF as default with a flag, instead of choosing one and committing?

**30s.** [ADR-0003](../adr/0003-confluence-storage-default-adf-flagged.md). ADF is JSON, validates cleanly, round-trips. Storage format is required for some legacy macros. Going storage-format-only would break power-user pages; going ADF-only would silently break some macros. The dual-renderer cost is real but bounded.

**90s.** Plus: the flag isn't optional — it's a per-page decision point. The Confluence executor (M6b) reads each target page's existing format and writes back in the same format unless the user explicitly opts in to convert. That's the operational reality: most teams have an existing space with mixed format, and forced conversion would be hostile.

---

### Q10. Why the genesis-block special case instead of seeding with a synthetic prior entry?

**30s.** The synthetic prior would itself need to be signed. Signing it requires a key. That key would be the system's first key, and it'd have no provenance from anywhere. The genesis-block-with-NULL-prev-hash makes the bootstrap visible: the chain has a beginning, the verifier knows it, and there's no fake-prior to be confused about.

**90s.** Plus: a synthetic prior would create an attack surface. An attacker who could write to the storage layer could create a *different* synthetic prior and then build a parallel chain. The verifier wouldn't be able to distinguish. With the NULL-prev-hash approach, the genesis is structurally singular — there's exactly one entry where prev_hash is NULL, and the verifier checks that uniqueness as part of validation.

---

### Q11. Why not just use OAuth 2.0 for Bitbucket?

**30s.** [ADR-0004](../adr/0004-bitbucket-app-password-vs-oauth.md). For v1, app password gives simpler operations: no refresh dance, no race-on-refresh failures, easier rotation procedure. OAuth is the right answer for v2 when we have multi-user delegation requirements. App passwords cover single-tenant single-user perfectly.

**90s.** Plus: PCO-59 documents an existing OAuth 3LO refresh race for the Atlassian side. That's exactly the operational complexity I wanted to avoid for VCS. App password rotation is a manual ceremony; OAuth refresh races silently 401 under concurrent load. The tradeoff is obvious for v1.

---

## Category: 'Gotcha' and verification

### Q12. Have you actually run this end-to-end against a real Atlassian site?

**30s.** Capability discovery and the read path against a real site — yes, see [`tests/integration/providers/confluenceRestProvider.test.ts`](../../tests/integration/providers/confluenceRestProvider.test.ts), which is gated behind an env var. Provisioning execution end-to-end — no, that's M6a–M6c, currently in backlog. The honest answer is: the read side has been validated; the write side has been designed and unit-tested, and end-to-end will happen in those milestones.

**90s.** What you're seeing in the [PCO Jira project](https://lateapexllc.atlassian.net/jira/software/projects/PCO/boards/1) and [ACO Confluence space](https://lateapexllc.atlassian.net/wiki/spaces/ACO) was provisioned by a faithful simulation of the executors — [`scripts/demo/seed-jira.py`](../../scripts/demo/seed-jira.py) and [`scripts/demo/seed-confluence.py`](../../scripts/demo/seed-confluence.py). The seeding scripts make exactly the same REST calls the executors will make, in exactly the same order. The output shape is what the real executors will produce. The dogfooding frame is preserved; the bridge between simulation and orchestrator is just M6a/M6b code that hasn't been written yet.

---

### Q13. Did the orchestrator actually generate this Jira project?

**30s.** No, not yet — see Q12. M4 (blueprint) and M6a (Jira executor) aren't implemented end-to-end. The seeding scripts simulate the executor's output. But the *structure* of the project (8 epics, 10 components, the label taxonomy) is what M4 will emit — that structure comes from v6 §12 (Generated Jira Structure), which is the spec for what the executor must produce.

**90s.** Plus: the test of the dogfooding claim is whether the structure here matches v6 §12. If it does, the simulation is faithful and the claim holds. If it doesn't, I need to fix one or the other. Spot-check: v6 §12 specifies issue types Epic + Story/Task/Bug/Spike with status workflow Backlog → Ready → In Progress → Review → Done. The actual project has Epic + Task (with `type:*` labels for sub-classification) and three statuses (To Do / In Progress / Done), constrained by the next-gen Kanban template. So there's a deliberate adaptation — documented in F-14 in audit findings — and the broader structure matches.

---

### Q14. What if I clone the repo right now and try to build it?

**30s.** `npm install && npm test` should work on a fresh clone. There's no install ceremony. The tests are unit + integration; the integration tests against a live Atlassian site are gated behind an env var so they don't run in CI by default.

**90s.** Plus: the Dockerfile at repo root is also tested — `docker build -t atl-mcp:dev .` produces a runnable image. If clone-and-build is broken, I want to know — please file an issue with the error output.

---

### Q15. What if I introduce a `console.log` in src/ — does the lint catch it?

**30s.** Yes, that's the literal form. Run `npm run lint:no-stdout` — it'll fail. PCO-12 documents the alias-form gap (e.g. `const w = process.stdout; w.write(...)`) which currently slips through. Fix is an AST-walk lint instead of regex.

**90s.** That gap exists because the original lint was deliberately simple — a regex over file contents — for fast iteration. The cost of replacing it with an AST walk is a TypeScript ESLint plugin; the benefit is stricter enforcement of a protocol invariant. Tracked as PCO-12, severity medium because the literal form (which IS caught) is what normal coding produces.

---

## Category: Process and judgment

### Q16. How do you decide what becomes an ADR vs. an inline comment?

**30s.** ADR-worthy if (a) someone in 6 months would want to know why we chose this, AND (b) the reasoning isn't obvious from the code itself. The 10 ADRs in this repo are: the ADR process itself, pglite for dev, token encryption library, Confluence body format default, Bitbucket auth choice, audit signing pipeline, operator control plane admin MCP tools, project-scoped persistent agent memory, frontend+MCP shared workflow, and GitHub v1 after Bitbucket parity. Each one has alternatives that were considered and rejected.

**90s.** Plus: the inverse — things I deliberately did NOT make ADRs. Choosing TypeScript wasn't an ADR (no real alternatives in this stack). Choosing pino for logging wasn't an ADR (default in Node). Choosing vitest over jest could have been an ADR but felt obvious for greenfield code. The bar is "the reasoning is non-obvious AND someone might second-guess it." Six is a lot for the project size; it's because each decision touches operational reality.

---

### Q17. What do you mean by "iron laws"?

**30s.** Two non-negotiable rules in [`CLAUDE.md`](../../CLAUDE.md). First: never claim a task done without verification evidence (tests pass, build green, etc.). Second: never write production code without a failing test first when adding behavior. They're "iron" because they don't bend. The specific phrasing comes from `docs/partners/superpowers.md` F-106.

**90s.** Plus: these aren't suggestions — they're enforced by tooling and process. Test-first is enforceable in the sense that a PR with no test for new behavior gets rejected. Verification-before-claim is enforceable in the sense that every milestone has tests that must pass before close-out. The discipline cost is real (you can't move as fast as "vibes-driven" coding) but it makes the codebase trustworthy.

---

### Q18. What's the relationship between v6, the partner guides, and the ADRs?

**30s.** v6 is the spec — what we're building. Partner guides ([`docs/partners/`](../partners/), 42 of them) are the synthesis of how others have solved adjacent problems — what we're learning from. ADRs ([`docs/adr/`](../adr/)) are decisions specific to *our* implementation — what we chose and why. v6 references partners; partners inform ADRs; ADRs constrain implementation; implementation matches v6.

**90s.** Plus: the discipline is that v6 is authoritative. If implementation diverges from v6, either the implementation is wrong OR the spec needs updating — and updating the spec is itself a deliberate act with its own review. Same with partner guides: they're reference material, not requirements. The orchestration is: read partners → think → update v6 with the synthesis → implement → ADR captures any deviation from v6.

---

## Category: Level and fit

### Q19. What level of role does this prepare you for?

**30s.** The work shown here is at staff-engineer scope: an originally-designed spec, a multi-component implementation, integration with three external systems, an explicit security model, and a measurable readiness rubric. I'd target staff-software-engineer or senior-staff-engineer roles. I'm not claiming principal-level scope — that would require multi-team coordination, which a solo project can't demonstrate.

**90s.** Plus: the dimensions where I'd want a more senior person to grade me are (a) production reliability — I haven't shipped this to multi-tenant prod, so my "what could go wrong" intuition is narrower than someone who has, and (b) cross-team incident handling — same reason, I've handled the runbook scenarios documented here, but I haven't been on-call for a 50-engineer team. Solo deep work is what this proves; cross-team scale isn't yet shown.

---

### Q20. Why MCP? Why not just a regular REST API?

**30s.** MCP is the protocol agentic AI build agents already speak. Using it makes atl-mcp directly consumable by Claude Code, Cursor, ChatGPT desktop, and whatever build agents come next, without each of them needing a custom integration. The admin REST is for human operators; MCP is for agents. Both ports run side-by-side per v6 §22.

**90s.** Plus: the choice locks atl-mcp into the MCP spec evolution. That's a real coupling cost. Mitigated by v6 §22's session capability negotiation — clients that don't speak the latest spec get a downgraded surface. The alternative (REST + custom client per agent) was rejected because it puts the integration cost on every consumer.

---

### Q21. What's your relationship to the MCP spec itself?

**30s.** I implement it; I don't define it. The MCP spec is owned by Anthropic. atl-mcp's capability negotiation logic in [`src/mcp/sessionCapabilities.ts`](../../src/mcp/sessionCapabilities.ts) is conformant to the spec at the version the server pins to. Future spec evolution is tracked but not driven by this project.

**90s.** Plus: the v6 spec §22 discusses MCP-spec-version pinning explicitly. The current target is whatever version is current at the time of pinning; changes to the MCP spec are absorbed via session capability negotiation. The orchestrator never assumes the client supports the latest spec — it asks at session start.

---

## Category: Skeptical / edge

### Q22. What if I think AI-assisted code is unethical?

**30s.** Fair concern. My position is documented in [`ai-honesty.md`](ai-honesty.md). The relevant test for me is whether I can defend every decision and walk every piece of code. If you'd want me to re-implement a specific module without AI, I can do that — pick one. But the work product as it exists is honest about what was AI-assisted and what wasn't.

**90s.** Plus: the v6 spec, the ADRs, and the design decisions are mine. The judgment that goes into "this should be a hash chain, not append-only-with-snapshots" is mine. The implementation that satisfies the design is heavily AI-assisted — and reviewed against tests I specified. If your concern is "the candidate doesn't understand their own code," the test for me is to walk a module live. If your concern is "AI authorship is inherently tainted," that's a values disagreement and I'd rather know it early.

---

### Q23. You mentioned Bitbucket but the env doesn't have credentials. Doesn't that break the demo?

**30s.** The Jira and Confluence sides of the dogfooding loop are complete and live — those generated structures are real. The Bitbucket side (M3, the VCS executor) is design-only in this demo environment because credentials weren't loaded. The architecture supports it; the implementation is in [`src/providers/vcs/`](../../src/providers/vcs/); the env vars are documented in the runbook. Just not wired here.

**90s.** Plus: this is documented as a known limitation. The dogfooding claim isn't broken because the seed in PCO and ACO is a faithful simulation of executor output, not actual executor output (yet — see Q12, Q13). When M6c ships and Bitbucket creds are loaded, the VCS leg of the loop completes the same way the Jira and Confluence legs do.

---

### Q24. Show me the worst code in this project.

**30s.** The Confluence space-create fallback in [`scripts/demo/seed-confluence.py`](../../scripts/demo/seed-confluence.py) — it tries v2, gets a 400, falls back to v1. The fallback is necessary because the v2 endpoint had a real validation bug at the time of seeding (F-13 in audit findings), but the fallback in production code would be unacceptable without retry semantics and observability. As a demo seed it's fine; as production code it'd be tech debt.

**90s.** Plus: another candidate is the regex-based `scripts/lint-no-stdout.mjs`. The regex approach is simple and works for the common case, but PCO-12 documents that it misses alias forms. A proper AST-walk lint is the right replacement. I left the regex in place because (a) the literal form is what normal coding produces, (b) the AST replacement is a real piece of work with its own dependency footprint, and (c) the gap is bounded — known, documented, with a tracking ticket.

---

### Q25. I have 30 seconds. Sell me the project.

**30s (verbatim).** I built an MCP server that generates Jira and Confluence project structures from raw requirements. The portfolio version of it generated its own project — that's what's at github.com/[me]/atl-mcp.

That's 35 words. Memorize it.

---

## Category: Forward

### Q26. What would you build next?

**30s.** The next milestone is M4 (blueprint workflow with sampling), followed by M5 (provisioning planner), then M6a (Jira executor — the first shippable slice). M6a is the moment the orchestrator can produce a real Jira project end-to-end from a profile, replacing the seeding script.

**90s.** Plus: after M6a, the priority shifts to M11 (observability + hardening) before continuing the M6b/M6c provisioning chain. The reasoning: without observability, debugging the executors is harder. The original v6 §28 sequence puts M11 last; if I were re-sequencing, I'd front-load it.

---

### Q27. Where would this fit in a real org?

**30s.** Two places: as a developer-tooling team artifact (the team that owns engineering productivity), or as a platform team artifact (the team that owns build agents and AI tooling). The former cares about Jira/Confluence consistency; the latter cares about the MCP context contract.

**90s.** Plus: the multi-tenant version (post-v1) would be a platform team's responsibility, since the audit chain and key isolation are platform-level concerns. The single-tenant v1 would be a single team's tool. The interesting transition is when v0.1 is shipped to one team, gets adopted by a second team, and the multi-tenant pressure starts.

---

## Category: Trivia

### Q28. What's `repo-extraction-findings.md`?

**30s.** A delta-audit document at repo root that compares the v6 spec to the implementation. It's one of the methodology sources for the audit findings page. Run a side-by-side: spec says X should exist, code has Y; the delta is captured.

---

### Q29. Why does the genesis block exist if we could just start with entry 1?

**30s.** The genesis block IS entry 1. The "genesis" is just the property that `prev_hash = NULL` for entry 1, by definition. The verifier needs to handle that case explicitly because every other entry has a non-NULL `prev_hash`. So "genesis" is shorthand for "the first entry, which has the NULL-prev-hash special case."

---

### Q30. What does "tool collapse" mean in the MCP design?

**30s.** v6 §14 design pattern: where multiple narrow tools could exist (`createIssue`, `createEpic`, `createStory`), use one tool with an `action` enum (`atlassian.create({type: "issue", ...})`). Reduces the per-session tool count and keeps the agent's mental model simple. Cost: fatter tool schemas, dispatch logic.

---

## Category: Recent changes

### Q31. What's changed since the 2026-04-25 audit?

**30s.** Four ADRs landed (0006 operator control plane, 0007 project-scoped agent memory, 0008 frontend+MCP shared workflow, 0009 GitHub-after-Bitbucket parity), the operator console SPA at [`docs/control-plane/`](../control-plane/) went from design brief to a live React 18 implementation wired to the admin MCP tools, and a 6-epic future-work backlog was added to PCO making the unfinished surface explicit.

**90s.** Plus: the substantive change is the operator console — [ADR-0006](../adr/0006-operator-control-plane-admin-mcp-tools.md) plus the React SPA at [`docs/control-plane/`](../control-plane/) together create a real management UI sitting on top of the orchestrator's admin MCP tools. [ADR-0008](../adr/0008-frontend-plus-mcp-shared-workflow.md) documents how the frontend and MCP coordinate via JSON-RPC over loopback rather than a parallel REST surface. [ADR-0007](../adr/0007-project-scoped-persistent-agent-memory.md) defines project-scoped persistent agent memory — distinct from cross-session memory, which stays out of v1 scope per v6 §4. [ADR-0009](../adr/0009-github-v1-after-bitbucket-parity.md) sequences GitHub support after Bitbucket reaches parity. The 6 future-work epics — [PCO-77](https://lateapexllc.atlassian.net/browse/PCO-77) (M6b Confluence executor), [PCO-95](https://lateapexllc.atlassian.net/browse/PCO-95) (M6c VCS executor), [PCO-114](https://lateapexllc.atlassian.net/browse/PCO-114) (M11 Operations Surface), [PCO-141](https://lateapexllc.atlassian.net/browse/PCO-141) (Memory & Embeddings Hardening), [PCO-150](https://lateapexllc.atlassian.net/browse/PCO-150) (Observability Hardening), [PCO-159](https://lateapexllc.atlassian.net/browse/PCO-159) (Secrets Rotation) — total 19 tasks + 63 subtasks. Each task names a concrete file path or behavior change. Backlog as evidence of self-policing scope.

---

*Vault size: 31 entries. Add more as interviews surface new questions. Keep the 30-second answers tight; the deep-dives are what differentiate.*
