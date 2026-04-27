# Interviewer Walkthrough — Seed Project Build Plan

> **Status:** **executed 2026-04-25; backlog extended 2026-04-27.** Live artifacts: [PCO Jira project](https://lateapexllc.atlassian.net/jira/software/projects/PCO/boards/1) (8 epics, 5 flagships, 50 filler tickets) and [ACO Confluence space](https://lateapexllc.atlassian.net/wiki/spaces/ACO) (35 pages). GitHub mirror complete in `docs/demo/`. **Owner:** Chris.
> **Read this file if** you are about to extend the portfolio, OR you are in an interview and want to know what proof exists for which claim — see Part VIII.
> **Do not** confuse this file with the tour script itself. This is the build plan; the tour scripts are at [`tour-60-seconds.md`](tour-60-seconds.md), [`tour-5-minutes.md`](tour-5-minutes.md), [`tour-15-minutes.md`](tour-15-minutes.md).

---

## Execution Log (2026-04-25)

What was actually built when this plan was executed against the live `lateapexllc.atlassian.net` instance:

### Phase 1 — Live Atlassian provisioning

- **Jira project `PCO` (Project Context Orchestrator)** created via `POST /rest/api/3/project`. Template: `com.pyxis.greenhopper.jira:gh-simplified-agility-kanban` (next-gen Kanban). 10 components added matching `src/` directory layout.
- **63 issues** seeded by [`scripts/demo/seed-jira.py`](../../scripts/demo/seed-jira.py): 8 epics (PCO-1 through PCO-8), 5 flagship stories at production depth (PCO-9 through PCO-13), 50 filler tickets (PCO-14 through PCO-63). All issues have rich ADF descriptions; flagships have full G/W/T acceptance criteria, linked ADRs, and v6 §-references.
- **Confluence space `ACO` (Agent Context Orchestrator)** created via `POST /wiki/rest/api/space` (the v2 endpoint had a `representation` validation bug — fell back to v1; documented as F-13 in audit findings).
- **35 pages** seeded by [`scripts/demo/seed-confluence.py`](../../scripts/demo/seed-confluence.py) in the IA from §24 (the original plan undercounted at 28; expanded breakdown went deeper). Three centerpieces (Architecture Overview, Operational Runbook, Audit Findings) at production depth.

### Phase 2 — GitHub mirror

All files in [`docs/demo/`](.) were authored:

- [`README.md`](README.md), [`tour-60-seconds.md`](tour-60-seconds.md), [`tour-5-minutes.md`](tour-5-minutes.md), [`tour-15-minutes.md`](tour-15-minutes.md)
- [`architecture.md`](architecture.md), [`runbook.md`](runbook.md), [`audit-remediation-summary.md`](audit-remediation-summary.md) — full markdown mirrors of the Confluence centerpieces, with mermaid diagrams.
- [`ai-honesty.md`](ai-honesty.md) — full Designed/Orchestrated/Generated breakdown (lives only here, not in Confluence).
- [`qa-vault.md`](qa-vault.md) — 30 pre-prepared Q&A entries.
- [`security-posture.md`](security-posture.md), [`roadmap.md`](roadmap.md), [`known-limitations.md`](known-limitations.md), [`glossary.md`](glossary.md).
- [`jira-work-items.md`](jira-work-items.md), [`confluence-space-index.md`](confluence-space-index.md) — index pages routing into Atlassian.
- [`screenshots/README.md`](screenshots/README.md) — capture spec for the 10 numbered screenshots (handoff item).

### Phase 3 — Repo polish

- Repo root [`README.md`](../../README.md) updated with the dogfooding lead and interviewer routing line.
- [`CLAUDE.md`](../../CLAUDE.md) operating-rules updated: dropped the 200-line file constraint per project decision (this file alone is 1k+ lines).
- `scripts/demo/` directory created with `seed-jira.py` and `seed-confluence.py` (both idempotent, both reusable for re-seeding or evolving the dataset).

### What was deferred and why

- **Live screenshots (10 numbered captures).** Cannot be captured by Claude programmatically — Atlassian web UI requires session-cookie auth, and the API token authenticates the REST API only. The capture spec ([`screenshots/README.md`](screenshots/README.md)) details the 10 captures with redaction rules; a logged-in browser session can produce them in ~15 minutes.
- **Bitbucket VCS provisioning (M6c side of the dogfooding loop).** No Bitbucket app password / OAuth credentials were loaded in the demo environment. Code is in [`src/providers/vcs/`](../../src/providers/vcs/); env vars are documented in [`runbook.md`](runbook.md). Just needs credentials wired.
- **Mock interview run-through.** Owner task. Per §58, demo-ready definition requires three full 15-minute tours separated by 24h+, at least one with a real engineer playing interviewer.

### What this proves

If you're an interviewer reading this Execution Log, it proves three things at the meta level:

1. The plan was concrete enough to execute without re-design — every section translated directly to code, API calls, or markdown.
2. The dogfooding frame held under live execution — the structure of [PCO](https://lateapexllc.atlassian.net/jira/software/projects/PCO/boards/1) and [ACO](https://lateapexllc.atlassian.net/wiki/spaces/ACO) matches what v6 §11 / §12 specifies the orchestrator should produce.
3. The honesty-first stance held — F-13 (Confluence v2 API bug), F-14 (3-status workflow vs planned 5), and the deferred screenshots/Bitbucket are documented as audit findings, not hidden.

The remaining gap to "demo-ready" per §58 is the mock interview run-throughs.

---

---

## The pitch

> "I built an MCP server that turns raw project requirements into agent-ready Jira + Confluence + Bitbucket workspaces. Here's the workspace it generated for itself."

That sentence is the entire portfolio. Every artifact below — Jira project, Confluence space, GitHub mirror, screenshots, ADRs, audit findings — exists to back up that one claim and to reward an interviewer who decides to drill in.

If you can only deliver one thing, deliver that sentence and a working `atl-mcp` that produced visible output. Everything else is depth.

---

## Why this approach beats a typical engineering portfolio

A typical senior-level portfolio is "here's a project I built; here's the architecture; here's the code." It is indistinguishable from every other portfolio. The interviewer's question is always the same: did the candidate scope this themselves, or follow a tutorial / paste a spec into an LLM?

The dogfooding spine answers that question structurally:

1. The platform under review (`atl-mcp`) is non-trivial: a 2,400+ line v6 spec ([`agent-context-orchestrator-mcp-plan-v6.md`](../../agent-context-orchestrator-mcp-plan-v6.md)), 42 partner integration guides ([`docs/partners/`](../partners/)), and a real codebase with domain models, storage migrations, Atlassian + VCS providers, a policy decision layer, an ed25519-signed audit chain, and a dual-port MCP transport.
2. The artifact under review (the seed Jira+Confluence project) is the *output* of running that platform on its own requirements. So the seed project simultaneously demonstrates (a) you can build sophisticated infrastructure and (b) the infrastructure produces useful, professional output.
3. Anything an interviewer drills into has *two* layers of evidence: the artifact itself, and the code that produced it. A skeptic gets shown both.

That's a structural advantage no LLM can manufacture on the fly. Even if a candidate uses heavy AI assistance, the discipline of producing a self-bootstrapping system is the demonstration.

**This frame is the spine of every section below.** When in doubt about whether to include something, ask: "does this strengthen the dogfooding claim, or distract from it?"

---

## Part I — Strategy

### 1. Goals and non-goals

**Goals (in priority order):**

1. Convince a hiring manager in 90 seconds that this is real, professional work at a senior+ level.
2. Convince a staff/principal engineer in 5–10 minutes that the scope, tradeoffs, and self-critique are coherent.
3. Survive a 30+ minute deep-dive without improvising — every claim has a backing artifact, every weakness has a pre-canned answer.
4. Be defensible when asked "did you really build this, or did the LLM?"
5. Be recoverable when Atlassian access fails, when time gets cut to 5 minutes, or when the interviewer fixates on something unexpected.

**Explicit non-goals:**

- Not a live system demo. Live demos break in browsers and waste interview time. Static artifacts (Jira project, Confluence space, screenshots, mirrored docs) are the deliverable. A live run is *optional* if the interviewer asks.
- Not a tutorial of MCP. Interviewers either know it or don't care; either way, explaining the protocol burns time. Show what the server does, not what the protocol is.
- Not a sales pitch for the v6 spec. The spec is supporting evidence, not the artifact.
- Not a complete implementation of v6. The seed project demonstrates the *generated* output and the *implemented* surface area. Unimplemented milestones are explicit (see Part VIII §44 — self-critique is a feature, not a flaw).

### 2. Audience model

The portfolio must work for four readers, each with a different time budget and goal. Design for *all four*, but optimize for the first one — most candidates lose at the 90-second skim.

| Persona | Time | Wants | Loses interest if |
|---|---|---|---|
| Hiring manager / Director | 60–90 s | Scope, scale, "is this real?" | Has to read >2 paragraphs to find scope |
| Staff / principal engineer | 3–10 min | Tradeoffs, self-critique, taste | Sees only artifacts, no reasoning |
| Recruiter / sourcer | 30–60 s | Tech stack, recency, screenshots | No visuals, no obvious "level signal" |
| Skeptical AI-aware interviewer | Variable | Evidence of human judgment, not just artifact volume | Sees too much polish without rough edges |

Each persona has an entry point in the tour (see §7 below). The README at `docs/demo/README.md` (see §31) is the routing layer.

### 3. The dogfooding spine — concrete

The seed project's structure is **literally the structure that v6 §11 (Generated Confluence Structure) and v6 §12 (Generated Jira Structure) of [the spec](../../agent-context-orchestrator-mcp-plan-v6.md) say it should be**. Do not independently design a Jira workflow or Confluence page tree. Run `atl-mcp` (or, until the executor milestones are done, simulate its output with the same shape). Manual polish is layered on top, never replacing the generated bones.

This means the interviewer answer to "why is the project organized this way?" is: "because that's what the orchestrator produces — see v6 §11 for Confluence, §12 for Jira, §13 for VCS." That's a much stronger answer than "it's how I personally like to organize Jira."

### 4. Narrative arc

The tour follows this arc, in this order, regardless of length:

1. **Hook** — The dogfooding sentence.
2. **Demonstration** — Show the generated artifacts. They look like a real engineering program because they were produced by infrastructure that knows what a real engineering program looks like.
3. **Depth on demand** — Each artifact has a "why" link: an ADR, a partner integration guide, a code citation, a v6 spec section.
4. **Self-critique** — Show the audit findings against your own work. A senior interviewer reads this as judgment; a junior one as honesty.
5. **Forward** — What you deferred, why, and what you'd build next. This neutralizes "what's missing?" by saying it first.

Note the order. Self-critique comes *after* depth, not before. Lead with strength.

### 5. The "AI honesty" stance

Every senior interviewer in 2026 will wonder how much of this you wrote vs. orchestrated. The portfolio addresses this *directly*, on its own page (see Appendix I), not buried.

Three categories, separated:

- **Designed** — the v6 spec evolution (v5 → v6 review summary in §0), the ADRs in [`docs/adr/`](../adr/), the partner integration synthesis (42 docs in [`docs/partners/`](../partners/)), the choice of dogfooding as the demo strategy, the readiness rubric in v6 §17, the failure-mode taxonomy in v6 §30.4.
- **Orchestrated** — the implementation of milestones M0–MN, executed via Claude Code as the build agent, following v6 §29 build prompts as recipes. Tests written first per the iron law in CLAUDE.md.
- **Generated** — the Jira tickets, Confluence pages, and Bitbucket scaffolding that the orchestrator produces from a project profile. These are *outputs* of the system, not authored content.

Be explicit. "I designed the system. I orchestrated the build with Claude Code. The Jira project you're looking at is what the system generated when fed its own requirements." A skeptic respects clarity more than they respect denial.

### 6. Anti-goals (things that will tempt you and that you will skip)

- **Slick marketing site.** No. The repo + Atlassian artifacts + GitHub mirror is the surface area. A landing page distracts from the dogfooding claim.
- **Custom domain or branded subdomain.** No. `github.com/<you>/atl-mcp` is fine. Keeps focus on the work.
- **Demo video.** Maybe one 60-second screen capture as a fallback for async review (recruiters), but the static artifacts must stand alone.
- **More than 8 epics.** Past 8, the project starts looking padded. Tight scope reads as judgment.
- **Filling every Jira field.** Story points without velocity data are theater. Custom fields without a workflow that uses them are theater. Less is more.
- **Hiding incomplete milestones.** The roadmap page exists precisely to surface what's not done. Owning incomplete scope is more impressive than pretending.

---

## Part II — The Tour (designed first because it is the centerpiece)

The tour is the most important artifact. Everything else (Jira tickets, Confluence pages, screenshots) exists to back up specific claims the tour makes. Design the tour first, then choose backing artifacts.

### 7. Three tour lengths

Build all three. The reader picks one based on time available.

#### 7.1 The 60-second version

For: hiring manager skim, recruiter screen, end of an unrelated interview where someone says "what else are you working on?".

Lives at: top of `docs/demo/README.md`, mirrored verbatim at the top of the GitHub repo README.

Script (verbatim — Appendix A):

> "I built an MCP server that turns raw project requirements into agent-ready Jira + Confluence + Bitbucket workspaces. The Jira project and Confluence space you're about to see were generated by it, from its own requirements. The repo has the spec it implements (v6, ~2,400 lines), the partner integrations it draws from (42 of them), the ADRs justifying the design choices, and the audit findings against my own implementation. If you only have a minute, look at three things: the architecture diagram in `docs/demo/architecture.md`, the screenshot of the Jira board in `docs/demo/screenshots/`, and the audit findings summary in `docs/demo/audit-remediation-summary.md`. That last one is the most important — it's where I document what I got wrong."

That's roughly 110 words and reads in 50–60 seconds.

#### 7.2 The 5-minute version

For: technical recruiter handoff, staff engineer pre-screen, end of a coding interview where you have a few minutes to show something else.

Structure (Appendix B):

1. (30s) Pitch + dogfooding frame.
2. (60s) Architecture overview — the system context diagram, the dual-port MCP transport (v6 §22), the policy decision layer ([`src/security/policyDecisionLayer.ts`](../../src/security/policyDecisionLayer.ts)), the audit chain ([`src/storage/schema/auditEntries.ts`](../../src/storage/schema/auditEntries.ts), v6 §30.1).
3. (90s) The generated Jira project — show the board, an epic, a flagship story with full acceptance criteria. Emphasize: "all of this came out of running the orchestrator on its own profile." This is the dogfooding payoff.
4. (60s) The Confluence space — page tree, then the architecture page, then the operational runbook. Same emphasis: "generated, not hand-authored."
5. (60s) Self-critique — the audit findings page. Pick the most embarrassing finding and discuss it.

#### 7.3 The 15-minute deep dive

For: scheduled portfolio review, take-home walkthrough, second-round technical chat.

Structure (Appendix C):

1. (60s) Pitch + dogfooding.
2. (2 min) Spec walkthrough — open [`agent-context-orchestrator-mcp-plan-v6.md`](../../agent-context-orchestrator-mcp-plan-v6.md), show the table of contents (40+ sections), drill into one section that demonstrates depth. Recommended: §17 (Readiness Rubric) — the deterministic 6-category score combined with the LLM-judged 4-tier verdict, plus the project- and issue-level rubrics, is a tight piece of work that survives scrutiny.
3. (3 min) Architecture — system context, then the policy decision layer + audit chain together, since that's the security spine. Reference [`docs/adr/0005-audit-signing-pipeline.md`](../adr/0005-audit-signing-pipeline.md) and [`docs/adr/0002-token-encryption-noble-ciphers.md`](../adr/0002-token-encryption-noble-ciphers.md).
4. (3 min) Generated artifacts tour — Jira board, an epic, a flagship story, the Confluence page tree, the architecture page, the runbook.
5. (2 min) The implementation — clone the repo, show `npm run lint:no-stdout` (the rule that protects the JSON-RPC stream — see [`scripts/lint-no-stdout.mjs`](../../scripts/lint-no-stdout.mjs) and [`tests/lint/no-stdout.test.ts`](../../tests/lint/no-stdout.test.ts)), show the test suite, show one piece of code in depth (recommended: [`src/storage/migrationRunner.ts`](../../src/storage/migrationRunner.ts) and the migration in [`src/storage/migrations/0001_init.sql`](../../src/storage/migrations/0001_init.sql)).
6. (2 min) Self-critique — audit findings page, current milestone status (M0 → wherever you are), what's deferred.
7. (2 min) Q&A buffer.

#### 7.4 Tour-length selection rule

Open with: "I have a 60-second version, a 5-minute version, and a 15-minute version — which works for you?" Putting the choice on the interviewer signals respect for their time and gives you cover to pick the right depth.

If they say "show me whatever you want," default to 5 minutes. It's the version most candidates underuse and it's the one that proves you can scope a presentation.

### 8. Entry points per persona

Each persona enters the tour through `docs/demo/README.md`, which has explicit routing:

```
If you have 60 seconds → top of this file
If you have 5 minutes → docs/demo/walkthrough-5min.md
If you have 15 minutes → docs/demo/walkthrough-15min.md
If you only want screenshots → docs/demo/screenshots/
If you want to verify it's real → start at the v6 spec, then docs/adr/
If you want the brutal honest version → docs/demo/audit-remediation-summary.md
```

That last line is the most important. Telling a skeptical reader "go read my self-critique first" is disarming.

### 9. The Q&A vault — pre-scripted answers

Appendix D contains the full vault. Sample categories:

- **The AI question** — "How much of this did you write vs. generate?"
- **The scope question** — "How long did this take? Be specific."
- **The depth question** — "What's the hardest technical problem in here?"
- **The taste question** — "What's the worst part of this design?"
- **The opinion question** — "What would you do differently?"
- **The trivia question** — "Why pglite for dev?" (answer: [`docs/adr/0001-pglite-for-dev.md`](../adr/0001-pglite-for-dev.md))
- **The 'gotcha' question** — "Have you actually run this end-to-end against a real Atlassian site?"

For each: the 30-second answer, the 90-second deep-dive if pushed, the source of truth link.

The single most important pre-scripted answer is "what's the worst part of this design?" Senior interviewers ask it because it filters for taste. A weak candidate either dodges or names a trivial flaw. A strong candidate names a real architectural compromise and explains why it was the right tradeoff. Have one ready. Suggested candidates:

- The dual representation problem in [`docs/adr/0003-confluence-storage-default-adf-flagged.md`](../adr/0003-confluence-storage-default-adf-flagged.md) — Confluence Cloud's storage format vs. ADF, and the operational cost of supporting both.
- The non-CRDT collaboration model — concurrent provisioning is serialized via PHASE-STATE.json (v6 §6.1), which is correct for v1 but won't scale to multi-tenant.
- The token encryption boundary — encrypted at rest in `src/security/tokenStore.ts` but plaintext during request signing; document the trust boundary explicitly.

### 10. Failure-mode recovery scripts

Things that go wrong in interviews and the script for each:

| Failure | Recovery |
|---|---|
| Atlassian site is slow / down | "Let me show you the GitHub mirror — it has the same content." Switch to `docs/demo/`. |
| Screen-share crashes mid-demo | "While I reconnect — here's the 60-second version verbatim." Recite from memory. |
| Interviewer says "we only have 5 minutes left" | "Let me jump straight to the audit findings — that's the most signal-dense page." |
| Interviewer fixates on something outside the prepared depth | "Good question. I haven't thought about that specifically. Let me reason about it from first principles…" Then actually reason, don't bullshit. |
| Live demo of `atl-mcp` against a real site fails | "Live demos failing is why I built the readiness rubric in v6 §17 — it catches exactly this kind of thing pre-flight. Let me show you the rubric instead." |
| You forget where something is | Open `docs/demo/README.md`. It's the index. Use it visibly. Looking at your own index is professional, not embarrassing. |

### 11. The "worst flaw" pre-canned answer

Memorize this. It's the question that distinguishes candidates. Practice the 30-second version until it sounds natural.

Recommended answer (adapt to taste):

> "The audit chain in v6 §30.1 uses a hash-chained ed25519-signed log with the public-key registry stored in a git ref. That's elegant for a single-instance MVP, but it's the wrong abstraction for multi-tenant — you'd want per-tenant key isolation and separate registries. I documented the runway in v6 §7.3 but the current implementation in [`src/storage/schema/auditEntries.ts`](../../src/storage/schema/auditEntries.ts) bakes in a single-tenant assumption. If I were to push this to production with multiple customers, this is the first thing I'd refactor."

That answer demonstrates: knowledge of own work (§ references), understanding of a real architectural tension (single-tenant vs multi-tenant), forward-thinking (refactor priority), and humility (specific weakness named).

---

## Part III — The Jira Project

The structure here is what v6 §12 specifies the orchestrator generates. **Do not redesign it.** The point of the dogfooding frame is that the structure speaks for itself.

### 12. Scope decisions

Target volumes (calibrated to look real, not padded):

- **8 epics** (one per major v6 surface area; see §19 below)
- **40 stories/tasks** (5 per epic average)
- **12 bugs/risks/hardening items**
- **8 spike/research items**
- **Total: ~68 issues**

Why these numbers:

- 6–8 epics is the sweet spot where the board fits on one screen and the structure is legible. More than 8 reads as fragmented; fewer than 6 reads as toy.
- 40 stories at 5/epic averages out without forcing — some epics will have 8, some 3.
- The bug/spike count is what's plausible for a project this far along (M0 → ~M5). Fewer reads as no-discoveries (suspicious); more reads as fire-fighting (also suspicious).

Of the 68 issues, **5 are flagship** and built at production depth (acceptance criteria, linked ADRs, embedded design notes, comments, trace links). The remaining 63 are filler at lightweight depth (title, 1–2 sentences description, status, component, label).

The 5:63 ratio is calibrated. Interviewers who drill in will hit a flagship within their first two clicks — they'll click on the most-eye-catching ticket. Pre-position the flagships as the most-eye-catching ones.

### 13. Issue types

Use Jira's defaults, no custom types. Custom types without a workflow that uses them is theater (see anti-goals §6).

- **Epic** — a major surface area. 8 of these. See §19.
- **Story** — user-facing or operator-facing capability. ~30 of these.
- **Task** — implementation work that doesn't fit a user story. ~10 of these.
- **Bug** — known defect. ~8 of these.
- **Spike** — research or design work without a defined output. ~8 of these.
- **Sub-task** — used sparingly within flagship stories to show breakdown. ~10 across the 5 flagships.

### 14. Workflow / states / transitions

Five states, mapped to the v6 §6 project state machine where possible:

```
Backlog → Ready → In Progress → In Review → Done
```

With transitions:

- `Backlog → Ready` requires Definition of Ready met (see §18).
- `Ready → In Progress` is open.
- `In Progress → In Review` requires linked PR or completed work in description.
- `In Review → Done` requires Definition of Done met (see §18).
- `Done → In Progress` reopens (rare).
- Any state → `Won't Do` (terminal) with a comment explaining why. Use this on a few issues to show real triage decisions.

Cards in `Won't Do` are valuable: they prove judgment. Pick 3–5 that are obviously good calls to deprioritize (e.g., "Add OAuth 1.0 support" — won't do because v6 §3 explicitly excludes it).

### 15. Components

Components map directly to top-level directories in [`src/`](../../src/):

| Component | Purpose | Maps to |
|---|---|---|
| Runtime | Process lifecycle, transport, server bootstrap | `src/mcp/`, dual-port transport (v6 §22) |
| Domain | Domain models, types, value objects | [`src/domain/`](../../src/domain/) (18 files) |
| Storage | Schema, migrations, repositories | [`src/storage/`](../../src/storage/) |
| Providers — Atlassian | Jira + Confluence integration | [`src/providers/atlassian/`](../../src/providers/atlassian/) |
| Providers — VCS | Bitbucket integration | [`src/providers/vcs/`](../../src/providers/vcs/) |
| Security | Auth, encryption, policy, audit, webhooks | [`src/security/`](../../src/security/) |
| Observability | Logger, metrics, traces | [`src/observability/`](../../src/observability/) |
| Preflight | Capability discovery, readiness | [`src/preflight/`](../../src/preflight/) |
| Docs | Spec, partners, ADRs, demo | [`docs/`](../) |
| Demo Ops | This portfolio surface | [`docs/demo/`](.) |

That's 10 components. Each ticket gets exactly one. Multi-component tickets are a smell — break them down.

### 16. Labels

Labels are orthogonal to components and signal cross-cutting concerns. Limit to ~10 — past that, no one uses them.

| Label | Use case | Cardinality |
|---|---|---|
| `mcp` | Touches MCP protocol surface | ~12 |
| `atlassian` | Touches Jira or Confluence APIs | ~15 |
| `vcs` | Touches Bitbucket or Git | ~10 |
| `security` | Auth, audit, encryption, policy | ~10 |
| `audit` | Specifically the audit chain | ~6 |
| `queue` | Job queue / async workflow | ~6 |
| `ops` | Runbook, deployment, observability | ~8 |
| `demo` | Portfolio polish; will close at demo-ready | ~10 |
| `tech-debt` | Acknowledged debt with owner | ~6 |
| `breaking` | API or schema break risk | ~3 |

### 17. Versions / fixVersions

Two versions, mapped to v6 milestones:

- `v0.1 — First Shippable Slice` — closes when M6a (Jira provisioning executor) is done. Per v6 §28, M6a is the first shippable slice.
- `v0.2 — Read-Path Demo` — closes when M7 (context resources and packs) is done. This is the read-side complement to v0.1's write side.

Most tickets have no fixVersion. Tickets with fixVersions tell a story about what's being shipped together. Don't overdo it.

### 18. Custom fields, DoR, DoD

Skip custom fields. They're theater unless wired to a workflow.

DoR (Definition of Ready) — single Confluence page (`Definition of Ready`) referenced in board description:

1. Acceptance criteria written in Given/When/Then form.
2. Component assigned.
3. Linked to an epic or marked `standalone`.
4. Estimated at one of: `XS`, `S`, `M`, `L`, `XL` (no story points; estimation uncertainty is honest).
5. Risks / unknowns called out in description if non-trivial.

DoD (Definition of Done) — single Confluence page (`Definition of Done`):

1. All acceptance criteria pass.
2. Tests written first per the iron law (see [`CLAUDE.md`](../../CLAUDE.md) operating rules).
3. Lint passes including `npm run lint:no-stdout`.
4. ADR written if introducing a new design decision.
5. Linked PR merged.
6. Audit log entry generated for any state change in production.

These two pages are real evidence that the project takes engineering practice seriously. Reference both from the board.

### 19. Epic-level catalog

8 epics, one per major surface area. Each has: title, summary (1 sentence), why it exists (what v6 section drives it), child story count, status.

Three epics are designed at flagship depth in Appendix E. The other five are designed at lightweight depth here.

| # | Epic | Driver | Stories | Status |
|---|---|---|---|---|
| 1 | Runtime, Deployment, Transport | v6 §22 (dual-port HTTP), §28 M0 | 5 | Done |
| 2 | Domain Model and Storage | v6 §10, §28 M1 | 8 | Done |
| 3 | Atlassian Providers + Capability Discovery | v6 §19, §28 M2 | 7 | In Progress |
| 4 | VCS Provider | v6 §19, §28 M3 | 5 | In Progress |
| 5 | Blueprint Workflow with Sampling | v6 §23, §28 M4 | 6 | Backlog |
| 6 | Provisioning Planner + Executors | v6 §18, §28 M5–M6c | 8 | Backlog |
| 7 | Audit + Policy Enforcement | v6 §7.2, §30, §28 M11 | 6 | In Progress |
| 8 | Demo Documentation + Portfolio Packaging | this file | 5 | In Progress |

The 8th epic is the dogfooding moment in pure form: the portfolio itself is a tracked epic, with stories like "draft 60-second tour script", "capture screenshots of Jira board", "write architecture page in Confluence." That epic is unique among the 8 because it produces zero code and is 100% documentation work, but it's tracked the same way as everything else. That's the punchline: this tool produces project structure for *any* knowledge work.

### 20. Flagship tickets

Five tickets built at production depth. These are the ones a drilling interviewer will land on. Each has: full title, rich description, Given/When/Then acceptance criteria, linked ADR or v6 section, comments showing real iteration, sub-tasks if needed, trace links to other issues.

Flagship picks (specs in Appendix F):

1. **Story: Implement audit chain hash linkage with ed25519 signature** — concrete cryptographic work, links to ADR-0005 and v6 §30.1.
2. **Story: Capability discovery against Jira Cloud REST v3 with API token auth** — real API integration with edge cases (rate limits, pagination).
3. **Spike: Confluence storage format vs ADF — pick a default** — the research that produced ADR-0003.
4. **Bug: `npm run lint:no-stdout` doesn't catch dynamic `process.stdout.write`** — a real CI gap, demonstrates self-discovered defects.
5. **Task: Migrate from raw SQL migrations to a runner with rehearsal** — links to [`src/storage/migrationRunner.ts`](../../src/storage/migrationRunner.ts) and [`tests/integration/storage/migrationRehearsal.test.ts`](../../tests/integration/storage/migrationRehearsal.test.ts).

Each of these is a 5–10 minute read at full depth. The bug ticket is the most important because it shows you find your own bugs — a senior signal.

### 21. Filler tickets

The remaining ~63 tickets are filler. Lightweight templates:

**Story template (filler):**
- Title (imperative voice, ≤8 words)
- Description (2–3 sentences, includes "why")
- One Given/When/Then
- Component
- Label(s)
- Status
- Linked epic

**Task template (filler):**
- Title
- Description (1–2 sentences)
- Component
- Status

**Bug template (filler):**
- Title (start with "Bug:")
- Repro steps
- Expected vs actual
- Severity (low/med/high)
- Component
- Status

**Spike template (filler):**
- Title (start with "Spike:")
- Question being answered
- Constraints
- Definition of complete (e.g., "ADR drafted" or "decision documented")
- Time-box (e.g., "≤2 days")
- Component
- Status

Filler tickets are filler. Don't over-invest. The 5 flagships carry the depth; the 63 carry the volume.

### 22. Linking strategy

Use Jira's link types deliberately:

- `blocks` / `is blocked by` — between stories within an epic when there's real ordering.
- `relates to` — between issues across epics. Use for the audit chain story relating to the policy decision story, etc.
- `implements ADR-XXXX` — custom-text link. Wire flagship tickets to the ADR they implement. This is one of the strongest signals in the whole project.
- `caused by` — between bugs and the changes that caused them. Pick one or two to show post-incident discipline.

### 23. Boards and swimlanes

Single board, configured as Kanban. Why Kanban over Scrum:

- The project is solo-developed; sprints are theater.
- Kanban with a WIP limit demonstrates flow thinking, which is a senior signal.
- Cards-by-state reads better in a screenshot than burndown charts.

Swimlanes by Component. So the board is a 5-state × 10-component grid (with most cells empty most of the time). That visual layout immediately communicates "this is a real codebase with real surface area" — even at thumbnail resolution.

WIP limit: `In Progress` is capped at 3. `In Review` capped at 5. Real WIP discipline produces real flow. Document the limits in the board description.

---

## Part IV — The Confluence Space

The page tree mirrors v6 §11 (Generated Confluence Structure). Read that section before designing — what follows is a concrete instance of it, not an alternative design.

### 24. Information architecture

Top-level pages and their depth (depth indicates indentation in the tree):

```
Project Overview                         (1) — landing page
├── Product Brief                        (2)
├── Architecture Overview                (2) ★ centerpiece
│   ├── System Context Diagram           (3)
│   ├── Runtime / Deployment Topology    (3)
│   ├── Storage + Migration Design       (3)
│   ├── Provider Layer                   (3)
│   ├── Policy + Approval Model          (3)
│   ├── Audit Chain Design               (3)
│   └── Webhook Ingestion Design         (3)
├── Engineering Practice                 (2)
│   ├── Definition of Ready              (3)
│   ├── Definition of Done               (3)
│   ├── Test Strategy                    (3)
│   └── Branching + Release Process      (3)
├── Operations                           (2)
│   ├── Runbook                          (3) ★ centerpiece
│   ├── Health Checks + SLOs             (3)
│   ├── Incident Response                (3)
│   └── Backup + Restore                 (3)
├── Security                             (2)
│   ├── Threat Model                     (3)
│   ├── Token Storage                    (3) → ADR-0002
│   ├── Audit Chain Threat Model         (3)
│   └── Webhook Verification             (3)
├── ADR Index                            (2) — mirrors docs/adr/
├── MCP Tool Catalog                     (2) — mirrors v6 §14
├── Roadmap + Milestones                 (2)
├── Audit Findings + Remediation Summary (2) ★ centerpiece
├── Known Limitations                    (2)
├── Glossary                             (2)
└── Demo Walkthrough                     (2) — for interviewers
    ├── 60-Second Pitch                  (3)
    ├── 5-Minute Tour                    (3)
    └── 15-Minute Deep Dive              (3)
```

That's 28 pages, organized into 8 top-level sections. It's enough depth to feel real; not so much that it looks padded.

The three centerpiece pages (Architecture Overview, Runbook, Audit Findings) are where 80% of interviewer attention will land. Build those at production depth. The rest are short — sometimes a single paragraph plus a link.

### 25. Per-page spec — the three centerpieces

Detailed specs for the three centerpiece pages. The other 25 are sketched in Appendix G.

#### 25.1 Architecture Overview

**Audience:** staff/principal engineer reading for tradeoffs.
**Length:** 1,500–2,500 words on the parent page; deeper detail in 6 child pages.
**Sections:**

1. **One-paragraph summary.** Open with: "atl-mcp is an MCP server that ingests project requirements and emits agent-ready Jira + Confluence + Bitbucket workspaces. It runs on a dual-port HTTP transport (admin REST on one port, MCP streamable HTTP on the other — see v6 §22). Storage is Postgres in production and pglite in development (ADR-0001). Writes are gated by a policy decision layer (v6 §7.2) and recorded in a hash-chained ed25519-signed audit log (v6 §30.1)."
2. **System context diagram.** One image. Linked to a child page that explains every box.
3. **The three trust boundaries.** External callers (auth) → server (policy) → external systems (audit). Each gets two sentences.
4. **The state machine.** Reference v6 §6, embed the state diagram, link to PHASE-STATE.json discussion in §6.1.
5. **The data flow.** Requirement intake → blueprint → provisioning plan → executor → artifact. One paragraph per arrow.
6. **Where things live in the repo.** Map the architecture to `src/` directories. Cite specific files for each layer.
7. **Key tradeoffs.** Three to five paragraphs naming hard decisions and what was given up. Link each to an ADR.
8. **What's out of scope.** Multi-tenant (v6 §7.3), persistent agent memory across sessions (v6 §4 non-goals), GitHub/GitLab (v6 §3).

This page is the most-referenced page from the tour scripts. It must be tight, well-illustrated, and link-rich.

#### 25.2 Operational Runbook

**Audience:** ops-minded staff engineer or any engineer with on-call experience.
**Length:** 800–1,500 words on the parent page; child pages for SLOs, incident response, backup/restore.
**Sections:**

1. **Overview.** What this service is responsible for, what it isn't.
2. **Health checks.** Endpoints, expected responses, what they prove. Reference [`tests/integration/mgmtApi.test.ts`](../../tests/integration/mgmtApi.test.ts) for the contract.
3. **Common alerts.** Three to five plausible alerts with diagnosis steps. Examples: "Migration runner stuck", "Audit chain signature mismatch", "Atlassian API rate limit exhausted".
4. **Common incidents.** Three documented incidents (real or realistic) with timeline, diagnosis, fix. Senior interviewers love this — it shows you can write a postmortem.
5. **Configuration.** Reference v6 §20 (env vars) and [`src/config/env.ts`](../../src/config/env.ts).
6. **Deploy process.** Reference Dockerfile and v6 §22.3.

The "common incidents" section is the most valuable. Pick three:

- A migration that ran on the wrong shape of database (caught by the rehearsal test in [`tests/integration/storage/migrationRehearsal.test.ts`](../../tests/integration/storage/migrationRehearsal.test.ts)).
- A leaked stdout `console.log` that broke an MCP client (caught by the no-stdout lint).
- A token rotation that failed because the encryption key changed (handled by the test double in [`src/security/tokenEncryption.testDouble.ts`](../../src/security/tokenEncryption.testDouble.ts)).

Each gets a one-paragraph timeline, one-paragraph root cause, one-paragraph fix, one-paragraph "how we prevent this now." Total ~600 words across all three.

If the incidents didn't actually happen, document them as "what we'd do if" exercises and label them as such. Don't claim incidents that didn't occur.

#### 25.3 Audit Findings + Remediation Summary

**Audience:** the interviewer reading for self-critique.
**Length:** 1,000–1,500 words.
**Sections:**

1. **Methodology.** "I ran a security review of my own code using the security-review skill, plus a `repo-extraction-findings.md` audit ([`repo-extraction-findings.md`](../../repo-extraction-findings.md)) against the v6 spec to find places where implementation diverges from spec." Cite both.
2. **Findings table.** ~10–15 findings, each with: ID, title, severity, status (fixed / acknowledged / deferred), linked Jira ticket, one-paragraph remediation summary.
3. **The most embarrassing finding.** Pick one and write a full paragraph about it. Honesty here lands.
4. **What's deferred and why.** Three to five items deliberately not fixed yet, each with rationale.
5. **What I'd do differently if starting over.** One paragraph. This is the wisdom signal.

Real candidate findings to seed:

- "Several domain modules import `console` (forbidden per CLAUDE.md operating rule); fixed in commit X."
- "Token store doesn't rotate the master encryption key; deferred — documented as tech-debt-001."
- "ADF renderer doesn't handle Confluence custom macros; documented in ADR-0003 and tracked as PCO-XX."
- "No integration test exercises a 429-then-success retry path; added in commit X."
- "Audit chain genesis block has no signature (chicken-and-egg); documented intentionally."

The "embarrassing" finding could be: "I shipped M0 with `console.log` in `src/mcp/sessionCapabilities.ts` and didn't notice until the lint check was added in M1. This is a clean example of why protocol-level invariants must be encoded as automated checks before any production code."

That paragraph is gold. It admits the failure, names the lesson, and credits the tooling. A senior interviewer reading this trusts the candidate immediately.

### 26. Templates and consistency

Every Confluence page uses the same structure:

1. **TL;DR** (1–2 sentences at the top)
2. **Body** (varies)
3. **Linked artifacts** (always at the bottom — code paths, ADRs, v6 sections, related Jira tickets)
4. **Last reviewed** (date + reviewer)

The "Linked artifacts" footer is the cross-stitch that ties the whole space together. Every page links out, every page is reachable.

### 27. Cross-linking strategy

Hard rules:

- Every Confluence page links to at least one Jira ticket OR one code path OR one ADR.
- Every flagship Jira ticket links to at least one Confluence page AND one ADR.
- Every ADR is mirrored in the Confluence ADR Index page.
- Every v6 §-reference uses the section number, not page number, so it survives the doc evolving.

Goal: an interviewer landing on any page can reach any other page in ≤3 clicks.

### 28. ADR mirroring

Confluence "ADR Index" page is a mirror of [`docs/adr/`](../adr/), regenerated by a script (or hand-synced for now — note as tech debt). Each ADR has an entry: number, title, status (proposed/accepted/superseded), one-line summary, link to the markdown source in GitHub.

Why mirror instead of authoring in Confluence: the ADRs are checked-in, version-controlled artifacts. Confluence is the human-readable index pointing to the canonical source. Interviewers should land on the markdown.

Ten ADRs exist now ([`docs/adr/`](../adr/)):

- 0000-adr-process
- 0001-pglite-for-dev
- 0002-token-encryption-noble-ciphers
- 0003-confluence-storage-default-adf-flagged
- 0004-bitbucket-app-password-vs-oauth
- 0005-audit-signing-pipeline
- 0006-operator-control-plane-admin-mcp-tools
- 0007-project-scoped-persistent-agent-memory
- 0008-frontend-plus-mcp-shared-workflow
- 0009-github-v1-after-bitbucket-parity

Each is a real decision with real tradeoffs. They are the highest-density-per-word evidence in the project.

### 29. Glossary

One Confluence page. Defines: MCP, ADF, ed25519, the four agent modes (v6 §14.1), readiness rubric tiers (v6 §17.2), the iron laws (CLAUDE.md), the dogfooding frame.

Glossaries seem boring but they're the page that proves you have a vocabulary. Skip definitions that are obvious (REST, Postgres). Keep definitions that are project-specific.

---

## Part V — The GitHub Mirror

GitHub is the fallback layer for when Atlassian access fails or when the interviewer prefers reading code. It's also the only persistent surface — Confluence permissions can lapse, GitHub does not.

### 30. What mirrors, what stays

Mirror to GitHub (`docs/demo/`):

- All three tour scripts (60s, 5min, 15min).
- Architecture page (rewritten for markdown).
- Operational runbook (rewritten for markdown).
- Audit findings + remediation summary.
- Roadmap.
- Known limitations.
- Glossary.
- Screenshots (sanitized PNGs).
- A page index pointing to Confluence for the rest.

Stay in Atlassian only:

- The Jira board itself (interactive — interviewer should explore).
- Most filler Jira tickets.
- The bulk of Confluence operational pages (incident response sub-pages, etc.).

The mirror is **summary, not duplication**. If a Confluence page is 2,000 words, the mirror is 500 words pointing to it. The exception is the audit findings page, which mirrors in full because it's the most-likely-to-be-deeply-read page and Confluence access is a dependency.

### 31. The `docs/demo/` directory structure

```
docs/demo/
├── README.md                           — entry point + 60s pitch verbatim
├── tour-60-seconds.md
├── tour-5-minutes.md
├── tour-15-minutes.md
├── architecture.md                     — full markdown architecture page
├── runbook.md                          — abridged operational runbook
├── audit-remediation-summary.md        — full mirror of Confluence page
├── jira-work-items.md                  — index of epics and flagship tickets
├── confluence-space-index.md           — index pointing to Confluence
├── roadmap.md                          — milestone status
├── known-limitations.md
├── glossary.md
├── ai-honesty.md                       — designed vs orchestrated vs generated
├── interviewer-walkthrough.md          — this file (the build plan)
├── qa-vault.md                         — the Q&A vault (Appendix D promoted)
└── screenshots/
    ├── 01-jira-board.png
    ├── 02-jira-epic-list.png
    ├── 03-jira-flagship-story.png
    ├── 04-confluence-page-tree.png
    ├── 05-confluence-architecture.png
    ├── 06-confluence-runbook.png
    ├── 07-confluence-audit-findings.png
    ├── 08-architecture-diagram.png
    ├── 09-mcp-tools-list.png
    ├── 10-preflight-profile-json.png
    └── README.md                       — captions and what each shows
```

Numbered screenshots make tour scripts referenceable: "see screenshot 03." Filename conventions matter for interviewer-friendly browsing.

### 32. README rewrite for repo root

The current top-level README (if any) probably reads like a normal project README. It should be rewritten to lead with the dogfooding pitch, then route the reader.

Top of repo README:

> **atl-mcp** — An MCP server that turns raw project requirements into agent-ready Jira + Confluence + Bitbucket workspaces.
>
> The Jira project and Confluence space accompanying this repo were generated by atl-mcp from atl-mcp's own requirements. **For interviewers: start at [`docs/demo/README.md`](docs/demo/README.md).**
>
> Three docs are authoritative, in this order:
> 1. [`agent-context-orchestrator-mcp-plan-v6.md`](agent-context-orchestrator-mcp-plan-v6.md) — the spec.
> 2. [`docs/build-orchestration.md`](docs/build-orchestration.md) — the build sequence (M0 → M11).
> 3. [`docs/partners/`](docs/partners/) — 42 partner integration guides.

Below that, normal README content (install, build, test).

The interviewer routing line in the second paragraph is critical. Put it where a recruiter pasting the URL into Slack will see it without scrolling.

### 33. Code citations as evidence

A claim in the tour like "the audit chain is signed and hash-linked" is weak unless backed by a file path. Strong:

> "The audit chain is signed and hash-linked — see [`src/storage/schema/auditEntries.ts`](../../src/storage/schema/auditEntries.ts) for the schema, [`docs/adr/0005-audit-signing-pipeline.md`](../adr/0005-audit-signing-pipeline.md) for the design rationale, and v6 §30.1 for the spec."

Three citations per major claim is the rule:

1. **Code** — where the implementation lives.
2. **Decision** — the ADR that justifies it.
3. **Spec** — the v6 section that scoped it.

Every load-bearing claim in the architecture page, the audit findings page, and all three tour scripts must follow this pattern.

### 34. CI signal surfacing

Add to repo README:

- Build status badge.
- Test count badge (e.g., from vitest summary).
- Coverage badge if measured.
- License.
- Node version.

These are tiny investments with disproportionate signal for the recruiter persona, who scans for badges as a heuristic for project maturity.

### 35. The clone-and-explore experience

Test this scenario regularly: interviewer clones the repo, runs `npm install`, runs `npm test`, opens the repo in their editor. Does it just work? Does the test suite pass on a fresh clone? Are there any obvious "what does this do?" moments without an answer?

A 30-minute fresh-clone test once a week catches drift. Document any setup steps that aren't `npm install && npm test` in [`docs/demo/README.md`](README.md) under a "Reproduce" section.

---

## Part VI — The Scripted Tour File

The current file (this one) is the *build plan*. The actual tour script is what the interviewer reads when they sit down. It will eventually live at `docs/demo/tour.md` (or be split into the three length-variants per §31).

This section specifies what `tour.md` should contain. The full draft is in Appendices A–C.

### 36. Tour file header

```markdown
# atl-mcp — Interviewer Tour

> **Pick your length:** [60 seconds](#60-seconds) · [5 minutes](#5-minutes) · [15 minutes](#15-minutes)
>
> **Most signal-dense link if you only click one thing:** [Audit Findings + Remediation](audit-remediation-summary.md).
```

### 37. Per-section structure

Each tour-length section follows the same internal structure:

1. **The pitch.**
2. **What you'll see.**
3. **The walkthrough proper.**
4. **Where to drill in.** (Links to backing artifacts.)
5. **What to ask me about.** (Pre-emptive Q&A links.)

The "what to ask me about" line is unusual and deliberate. It signals confidence and steers the conversation toward your strongest material.

### 38. Embedded Q&A

The tour file embeds the top 5 anticipated questions inline at the bottom of each length variant, with collapsible answers. Full Q&A in `qa-vault.md`.

### 39. Pre-emptive depth links

Every named artifact in the tour links to its Confluence page (with code-path fallback in the GitHub mirror). The 60-second version has the fewest links (3–5). The 15-minute version has the most (15–20).

---

## Part VII — Visual Proof

A picture is the single highest-bandwidth communication channel in a portfolio. Get the screenshots right.

### 40. Screenshot inventory

Numbered list, with what each must show:

| # | File | What it shows | Annotation? |
|---|---|---|---|
| 01 | jira-board.png | Full Kanban board, swimlanes by component, all 5 states | None — the board speaks |
| 02 | jira-epic-list.png | List view of the 8 epics with progress bars | None |
| 03 | jira-flagship-story.png | One full flagship story with description + acceptance criteria + linked ADR | Highlight the ADR link |
| 04 | confluence-page-tree.png | Sidebar showing the full IA | None |
| 05 | confluence-architecture.png | Top of the architecture page including the system diagram | None |
| 06 | confluence-runbook.png | Top of the runbook page including health check section | None |
| 07 | confluence-audit-findings.png | Top of the audit findings page including the table | None |
| 08 | architecture-diagram.png | Standalone PNG of the system context diagram | Numbered callouts (1) request, (2) policy, (3) audit |
| 09 | mcp-tools-list.png | Output of `tools/list` MCP call against the server | None |
| 10 | preflight-profile-json.png | Excerpt of a generated preflight profile JSON | Highlight the capability detection field |

10 screenshots is enough. Less is more — the interviewer is not going to look at 30 PNGs.

### 41. Capture conventions

- **Resolution:** 1920×1080 minimum, ideally 2x retina (3840×2160) for sharp rendering on hiring-manager laptops.
- **Format:** PNG (lossless). No JPG.
- **Browser chrome:** Always include for context. A floating screenshot with no URL bar reads as suspicious.
- **Theme:** Light theme universally. Dark theme reads as casual.
- **Redaction:** Black bars or blur for: account names, email addresses, internal IDs, anything that would dox the Atlassian site URL beyond `<your-name>.atlassian.net`. Document the redaction in screenshots/README.md so the interviewer knows redactions are intentional.
- **Annotations:** Numbered red circles with white numerals. Captions in screenshots/README.md, not on the image.

### 42. Diagrams

Three diagrams to produce:

1. **System context diagram.** Shows: external callers (build agents, operators), atl-mcp (with internal subdivisions: MCP transport, policy layer, providers, storage, audit chain), external systems (Jira, Confluence, Bitbucket). Arrows labeled with protocols (MCP/JSON-RPC, REST, etc.). Trust boundaries marked.
2. **Audit chain diagram.** Shows: state change → policy decision → audit entry → hash-link to prior entry → ed25519 signature → key registry git ref. This is the most defensible diagram you can produce; it visually justifies v6 §30.1.
3. **Provisioning sequence diagram.** Shows: requirement intake → blueprint workflow → provisioning planner → executor (with idempotency check, see v6 §18) → audit log. This is the dataflow story.

Tools: prefer `mermaid` (renders in GitHub markdown) over draw.io exports. Mermaid diagrams are version-controlled, and updates don't require re-exporting.

### 43. Where each lives

All three diagrams as mermaid blocks in `docs/demo/architecture.md`. Also exported as PNG to `docs/demo/screenshots/` for cases where mermaid doesn't render (e.g., in Atlassian Confluence — Confluence has its own diagramming).

---

## Part VIII — Defensibility

Defensibility is the property that, when the interviewer pushes on something, you have an answer prepared. The shape of preparation:

### 44. Claim → evidence → objection → answer

The single most useful artifact for interview prep. A spreadsheet (or Confluence page) with these columns:

| Claim | Evidence (link) | Objection | 30s answer | 90s deep dive |
|---|---|---|---|---|

Sample rows:

| Claim | Evidence | Objection | 30s answer | 90s deep dive |
|---|---|---|---|---|
| "MCP-compatible" | [`src/mcp/sessionCapabilities.ts`](../../src/mcp/sessionCapabilities.ts), v6 §2 | "Did you actually run a client against it?" | "Yes — there's an integration test that initializes the server and confirms tool registration ([`tests/unit/buildServer.test.ts`](../../tests/unit/buildServer.test.ts)). I haven't run a third-party MCP client like Claude Desktop against it yet — that's planned for M11." | Walk through the `buildServer` test, the capability negotiation flow per v6 §2.2, and the dual-port architecture in v6 §22 that lets it work for both stdio and HTTP MCP clients. |
| "Audited" | [`docs/adr/0005-audit-signing-pipeline.md`](../adr/0005-audit-signing-pipeline.md), v6 §30.1, [`src/storage/schema/auditEntries.ts`](../../src/storage/schema/auditEntries.ts) | "Hash chains are easy. What about key rotation?" | "Keys rotate via a git ref-versioned registry; ADR-0005 documents the model. Practical rotation isn't implemented yet — it's a known gap in the audit findings page." | Walk through the genesis block, the chain-linkage formula, the registry git ref, the rotation procedure, and the open questions documented as tech debt. |
| "Tested" | `npm test` output, [`tests/`](../../tests/) | "What's covered, what's not?" | "Unit tests cover domain serialization and security primitives. Integration tests cover storage, Atlassian providers (against mocked HTTP), VCS provider, and the management API. End-to-end tests against a live Atlassian site are gated behind an env-var and not run in CI." | Open the test directory, walk the categories (`tests/unit/`, `tests/integration/`, `tests/lint/`), explain what's deliberately missing (e.g., no fuzz testing for the ADF renderer — known gap). |
| "Operationalized" | `docs/demo/runbook.md`, [`Dockerfile`](../../Dockerfile), v6 §22 | "Have you actually deployed this anywhere?" | "Locally and in a sandbox. Production-deploy isn't done — it's M11 work." | Show the Dockerfile, the dual-port config, the env vars in v6 §20, and explain the sequence to take it to production. |
| "Self-critiqued" | `docs/demo/audit-remediation-summary.md` | "How did you find these issues?" | "Three sources: a security review using a security-review skill, a `repo-extraction-findings.md` audit comparing implementation to spec, and routine self-review during ADR drafting." | Walk through the most embarrassing finding and how it was caught and fixed. |

Build this table in full before the first interview. Aim for ~25–30 rows. Update after each interview based on what was actually asked.

### 45. The audit findings layer

Already specified in §25.3. Reiterate: this is the most defensible page in the project because it preempts criticism. The shape of every finding entry:

```markdown
### F-XX: [Finding title]

**Severity:** Low / Medium / High
**Status:** Fixed / Acknowledged / Deferred
**Linked tickets:** PCO-XX, PCO-YY
**Source of truth:** [code path or ADR]

**What's wrong.** [1–2 sentences.]

**How it was found.** [1 sentence.]

**Remediation.** [1–2 sentences. If deferred, explain why.]

**Lesson.** [Optional. 1 sentence. The wisdom signal.]
```

### 46. Test summary

A short page (or section in the runbook) showing test counts, coverage, and what's deliberately untested. Use the actual `vitest run` output, not a fabrication.

### 47. Operational readiness checklist

Mirrored from v6 §33 (Prerequisites Checklist Before Live Provisioning). Every item gets a status: ✅ done, 🟡 in progress, ⏳ deferred to milestone N, ❌ won't do (with link to rationale).

This is the "would you ship this to prod?" answer in checklist form.

### 48. Security posture summary

One paragraph in `docs/demo/security-posture.md`:

> **Trust boundaries:** External callers (auth at session start, see [`src/providers/atlassian/auth/`](../../src/providers/atlassian/auth/)) → server (policy decisions at every state-changing op, see [`src/security/policyDecisionLayer.ts`](../../src/security/policyDecisionLayer.ts)) → external systems (Atlassian + Bitbucket).
>
> **Data sensitivity:** Tokens are encrypted at rest with libsodium primitives via noble-ciphers (ADR-0002). Tokens are plaintext during request signing and held only in memory. Audit entries are tamper-evident via hash linkage and ed25519 signatures (ADR-0005, v6 §30.1).
>
> **Threat model.** STRIDE summary in Confluence threat model page.
>
> **Known gaps.** Master key rotation not implemented. Per-tenant key isolation not implemented (single-tenant only in v1 — see v6 §7.3 for the runway). Documented as tech debt with tickets PCO-XX and PCO-YY.

That paragraph is the security 60-second pitch. It demonstrates: knowledge of trust boundaries, named primitives, named ADRs, named gaps. A senior security-minded interviewer reads this and registers the candidate as competent.

---

## Part IX — Risk Management

Things that go wrong in real interviews and how to handle them.

### 49. Failure modes during the interview

| Failure | Probability | Mitigation |
|---|---|---|
| Atlassian site is slow or down | Medium | GitHub mirror has same content. Switch tabs. |
| Screen-share crashes | Low | Have the 60s pitch memorized verbatim. Recite while reconnecting. |
| Time gets cut from 30 min to 5 min | Medium-High | Three tour lengths exist for this exact reason. |
| Interviewer asks about a deferred milestone | High | Roadmap page exists. Open it. Say "deferred to MN, here's why." |
| Interviewer asks an unprepared question | High | Reason from first principles out loud. The reasoning is the demonstration. |
| Network drops mid-share | Low | Have screenshots downloaded locally as PDFs as backup-of-backup. |
| Interviewer says "this is too much" | Medium | "Fair. What part is most relevant to the role?" Pivot. |

### 50. Time-budget variants

Already covered in §7 (three tour lengths). One additional variant:

**The 30-second pitch** for elevator situations:

> "I built an MCP server that generates Jira and Confluence project structures from raw requirements. The portfolio version of it generated its own project — that's what's at github.com/<you>/atl-mcp."

40 words. Use when there's no time to share a screen. Always end with the URL so the interviewer can find it later.

### 51. The skeptical-interviewer playbook

Some interviewers actively suspect AI-generated portfolios. Clues:

- They ask "did you write this code yourself?"
- They paste a snippet and ask you to walk through it line by line.
- They ask you to make a small live change and explain it.
- They ask about a design decision and watch for whether the answer matches what's documented.

Counter-strategy:

1. **Don't deny AI assistance.** Pretending you didn't use Claude Code in 2026 is implausible and you'll fail the consistency check.
2. **Be specific about boundaries.** "I designed the v6 spec. I orchestrated the build through Claude Code following the v6 §29 build prompts. The Jira project you're looking at is the system's output, not authored content."
3. **Pre-emptively volunteer the ai-honesty page.** "I have a page about exactly this — let me show you."
4. **Demonstrate live judgment.** When asked an unprepared question, reason aloud. Show how you think, not what you've memorized.
5. **Have one piece of code you can actually walk line-by-line.** Recommended: [`src/storage/migrationRunner.ts`](../../src/storage/migrationRunner.ts) (small, important, your own decision-making is visible). Practice the walk until it's natural.

### 52. Atlassian access failure recovery

Pre-flight before every interview:

- Test the Atlassian links 30 minutes before. If anything is slow or 401-ing, switch to GitHub mirror as primary.
- Have the GitHub mirror tabs already open in a second browser window.
- Have the 10 screenshots open in a tab as a backup-of-backup.
- Have a downloaded PDF of the architecture page as backup-of-backup-of-backup.

### 53. Live demo crash recovery

If you decide to attempt a live `atl-mcp` invocation:

- Pre-record the success path as a screen capture. If live fails, switch to the recording with: "the recording shows what success looks like; let me debug what's happening live in parallel."
- Always run the live demo in a tmux/screen session that's already up. Don't start fresh terminals during the share.
- Have `npm run` aliases for the two or three commands you might run. Don't type long commands live.

### 54. The "I don't know" recovery

When asked something you don't know:

1. Say "I don't know off the top of my head."
2. Ask "should I reason about it from first principles, or is this something we can come back to?"
3. If reasoning: do it out loud, slowly, with named tradeoffs.
4. End with: "I'd verify this by [specific action]."

That sequence is more impressive than a confident wrong answer. Senior interviewers actively probe for it.

---

## Part X — Production

What it takes to actually build this.

### 55. Effort budget

Total: **40–60 hours** across roughly 3 calendar weeks. Breakdown:

| Phase | Hours | What |
|---|---|---|
| 1. Build plan refinement | 4 | This document → final spec |
| 2. Core code on a key milestone | 16 | One real milestone shipped (e.g., complete M2 if not done) |
| 3. Generate seed Jira + Confluence | 6 | Run atl-mcp (or simulate) to produce structure |
| 4. Polish 5 flagship Jira tickets | 4 | Acceptance criteria, links, comments |
| 5. Build 3 centerpiece Confluence pages | 6 | Architecture, Runbook, Audit Findings |
| 6. Filler tickets + filler pages | 4 | Volume work |
| 7. Diagrams + screenshots | 4 | The 3 diagrams, the 10 screenshots |
| 8. GitHub mirror + README rewrite | 4 | `docs/demo/` build-out |
| 9. Tour scripts (60s, 5min, 15min) | 3 | Practice and refine |
| 10. Q&A vault | 2 | 25–30 entries |
| 11. AI-honesty page | 1 | One careful page |
| 12. Mock interview run-through | 4 | Time the tour, find rough edges |
| 13. Buffer | 2 | Things you forgot |

If under time pressure, cut: filler tickets (skip past 40 total), filler Confluence pages (skip everything that isn't a centerpiece, the ADR index, or a glossary), the second and third diagrams. Keep: flagship tickets, three centerpiece pages, all three tour lengths, screenshots, AI-honesty page, audit findings page.

### 56. Sequence

Phases 1 and 2 in parallel — refine the plan while shipping a real milestone. Then 3 produces the seed data, then 4–6 polish in priority order (flagships first, then centerpiece pages, then filler). Phases 7–11 can run in parallel after 4–6. Phase 12 (mock interview) is a hard gate before publishing.

Critical-path dependency graph:

```
1 ─→ 3 ─→ 4 ─┐
2 ─────────┐ │
            ├─→ 5 ─→ 8 ─→ 9 ─→ 12 (gate)
            │         │
            └─→ 7 ──┐ │
                    ├─→ 10
                    └─→ 11
                  6 ─┘
```

Phase 12 is the gate. Do not publish or send the URL until you've done a mock 15-minute tour, timed it, and felt the rough edges. Publishing a portfolio that crashes under 15 minutes of pressure is worse than publishing nothing.

### 57. Quality gates per artifact

| Artifact | Gate |
|---|---|
| Tour script (any length) | Read aloud in target time, no improvising, no stumbling |
| Flagship ticket | Could a stranger implement this from the description alone? |
| Centerpiece Confluence page | Could a senior engineer read this in 5 minutes and understand the design? |
| Architecture diagram | Could you reproduce it from memory on a whiteboard? |
| Screenshot | Looks crisp at thumbnail size in a Slack preview |
| Audit findings page | Did you include something genuinely embarrassing? |
| AI-honesty page | Would a skeptical reader walk away convinced? |
| GitHub README | First paragraph names the dogfooding pitch and the demo entry point |

### 58. Definition of demo-ready (sharper version)

You are demo-ready when **all** of the following are true. Do not declare ready until they are.

1. You can deliver the 60-second pitch verbatim, from memory, in 50–70 seconds.
2. You can deliver the 5-minute tour in 4:30–5:30 with no improvising.
3. You can deliver the 15-minute deep-dive in 13:00–17:00 with no improvising.
4. You have answered "what's the worst part of this design?" out loud, in 30 seconds, three times in practice.
5. You have explained your AI usage in 60 seconds out loud, three times.
6. You can name the file path of every centerpiece artifact without looking.
7. The GitHub mirror is reachable in incognito mode (not gated by login).
8. The audit findings page contains at least 8 findings, at least 2 of which feel embarrassing to publish.
9. A friend (not an engineer) has read `docs/demo/README.md` and can tell you what the project does in their own words.
10. A friend (an engineer at staff or above) has done the 15-minute tour and pushed back on at least three things, all of which you have answers for.
11. You have run a fresh-clone test in the last 7 days. Tests pass.
12. You can answer "did you actually build this end-to-end?" in 30 seconds with a specific true claim.

If any of these fail, you are not demo-ready. Fix the gap, don't declare anyway.

### 59. Stretch polish (only after demo-ready)

In priority order:

1. **A 60-second screen-recorded video** of the 60-second tour. Useful for async recruiter follow-ups.
2. **A blog post** that is the 5-minute tour rewritten for general audiences. Surface area for sourcers.
3. **One genuinely useful tool** built on top of `atl-mcp` and demoed alongside (e.g., a CLI that takes a markdown brief and spits out a provisioning preview). Not required, but a strong candidate.
4. **A second seed project** built using `atl-mcp` for a different domain (e.g., a content marketing project, not a software project). Demonstrates the platform isn't single-purpose.
5. **A LinkedIn / personal-site landing page** linking to the GitHub repo. Lowest impact; do last.

Stretch items that are *not* worth doing even after demo-ready:

- A custom domain.
- A demo deployment hosted somewhere.
- A "play with it live" sandbox.
- More than 8 epics worth of seed data.

These all increase surface area without strengthening the core dogfooding claim.

---

## Appendices

### Appendix A — The 60-second script (verbatim)

> I built an MCP server that turns raw project requirements into agent-ready Jira, Confluence, and Bitbucket workspaces. The Jira project and Confluence space you're about to see were generated by it, from its own requirements.
>
> The repo has the spec it implements — it's a v6, ~2,400 lines. It has 42 partner integration guides synthesized into the design. It has ten ADRs justifying the harder decisions, and an audit findings page where I document what I got wrong.
>
> If you only have a minute, three things are worth a look: the architecture diagram in `docs/demo/architecture.md`, the screenshot of the Jira board, and — most importantly — the audit findings summary. That last one is where I document my own mistakes. It's the most signal-dense page in the project.

≈ 130 words. Read in ~55 seconds at conversational pace.

### Appendix B — The 5-minute tour script

**(0:00–0:30) Pitch and frame.** Read the 60-second script. Skip the "if you only have a minute" lines.

**(0:30–1:30) Architecture.** Open `docs/demo/architecture.md`. Read the one-paragraph summary. Show the system context diagram. Name the three trust boundaries: external callers, server, external systems. Mention the dual-port HTTP transport (admin REST + MCP streamable HTTP, v6 §22). Mention the policy decision layer ([`src/security/policyDecisionLayer.ts`](../../src/security/policyDecisionLayer.ts)) and the audit chain ([`src/storage/schema/auditEntries.ts`](../../src/storage/schema/auditEntries.ts), v6 §30.1, ADR-0005). Don't drill in unless asked.

**(1:30–3:00) Generated Jira project.** Switch to Jira. Open the board. Note the swimlanes by component, the WIP limits in the description. Open one epic — "Audit + Policy Enforcement" is the most interesting because it ties together two architectural concerns. Open the flagship story under it. Read the description aloud. Note the linked ADR and v6 section. Pause and say: "all of this — the structure of the project, the issue types, the workflow, the components — came out of running the orchestrator on its own profile. None of this is hand-curated."

**(3:00–4:00) Confluence space.** Switch to Confluence. Open the page tree on the sidebar. Note the size. Open the architecture page — it's the same content as `docs/demo/architecture.md`, mirrored. Open the runbook — show the "common incidents" section with three documented incidents. Open the audit findings page. Don't read individual findings; just show the table.

**(4:00–5:00) Self-critique.** Stay on the audit findings page. Pick the most embarrassing finding (e.g., the `console.log` in M0). Read it aloud. Say: "this is the one I'm least proud of, and the one I think a reviewer should look at first. The fact that I shipped M0 without this being a CI rule, then caught it in M1, is the example of why protocol-level invariants must be encoded as automated checks. The lesson generalized into the `lint:no-stdout` check that's been in place since." End there.

If asked questions during, hold them to the end of each section.

### Appendix C — The 15-minute deep dive

**(0:00–1:00) Pitch.** Same as 5-minute version, slightly slower.

**(1:00–3:00) Spec walkthrough.** Open [`agent-context-orchestrator-mcp-plan-v6.md`](../../agent-context-orchestrator-mcp-plan-v6.md). Show the table of contents — there are 40+ sections. Don't read them. Drill into v6 §17 (Readiness Rubric). Walk through: the deterministic 6-category score, the LLM-judged 4-tier verdict, the project-level rubric, the issue-level rubric, the 5-section skill format. Why §17? It's the section most likely to demonstrate that the spec has thought through measurable quality, not just architectural flourish.

**(3:00–6:00) Architecture deep dive.** Open `docs/demo/architecture.md`. Same as the 5-minute version, plus drill into the audit chain. Open ADR-0005 ([`docs/adr/0005-audit-signing-pipeline.md`](../adr/0005-audit-signing-pipeline.md)). Read the "Decision" section. Walk through: hash chain → ed25519 signatures → public key registry stored in a git ref → genesis block → rotation. Then open the schema [`src/storage/schema/auditEntries.ts`](../../src/storage/schema/auditEntries.ts) and confirm the implementation matches the design.

**(6:00–9:00) Generated artifacts.** Same as 5-minute version, but drill into a second flagship story — recommend the spike "Confluence storage format vs ADF" because its closure is ADR-0003 and the discussion of dual representation is genuinely hard. Show the Confluence space; drill into the runbook's "common incidents" section in full.

**(9:00–11:00) Implementation.** Switch to a terminal in the repo. Run `npm run lint:no-stdout` — show it passing. Open [`scripts/lint-no-stdout.mjs`](../../scripts/lint-no-stdout.mjs) and walk through what it does. Run `npm test` — show the green output. Open [`src/storage/migrationRunner.ts`](../../src/storage/migrationRunner.ts) and walk through it line by line. This is your "I really wrote this" moment — make it count. Show [`tests/integration/storage/migrationRehearsal.test.ts`](../../tests/integration/storage/migrationRehearsal.test.ts) as the test that validates the rehearsal pattern.

**(11:00–13:00) Self-critique + roadmap.** Open audit findings. Walk through the embarrassing finding from the 5-minute version. Open the roadmap. Show milestone status: M0 done, M1 done, M2 in progress, M3 in progress, M4–M11 not started. Be explicit about what's not done. Open `docs/demo/known-limitations.md` and read the top 3 entries.

**(13:00–15:00) Q&A buffer.** Use the time. If they have no questions, ask: "what would you want to dig into more?"

### Appendix D — The Q&A vault (seed entries; aim for 25–30 total)

#### D.1 The AI question

**Q: How much of this did you write vs. AI-generate?**

> I designed the system architecture and wrote the v6 spec. I orchestrated the build through Claude Code following the build prompts in v6 §29 — every milestone has its own prompt. The Jira project and Confluence space are the system's *output*, not authored content. I have a page that breaks this down with specific examples — `docs/demo/ai-honesty.md`. The short version: design and judgment are mine; production code is heavily AI-assisted following test-first discipline; generated content is system output.

#### D.2 The scope question

**Q: How long did this take?**

> The v6 spec is the result of synthesizing 42 partner integration guides over [N] weeks. The implementation is at milestone [M] of 11; that's [hours] of orchestrated build time. The portfolio polish — the seed Jira, Confluence, audit findings, tour scripts — was about 40 hours over 3 weeks.

Be specific about time. Vague answers ("a while") read as evasive.

#### D.3 The depth question

**Q: What's the hardest technical problem in here?**

> The audit chain in v6 §30.1 — specifically the rotation procedure documented in ADR-0005. Hash-linked signed logs are easy if keys never rotate. They get hard the moment you need to change a key without breaking verifiability of historical entries. The git-ref-versioned key registry is one model; the alternative is per-epoch signing. I picked the git-ref model and documented the cost in the ADR. Multi-tenant isolation makes this even harder — see v6 §7.3 for the runway.

#### D.4 The taste question

**Q: What's the worst part of this design?**

(See §11. Use the audit chain single-tenant assumption answer.)

#### D.5 The opinion question

**Q: What would you do differently?**

> Three things. First, I'd start with M11 (notifications, evals, hardening) earlier in the sequence — observability infrastructure compounds, and starting it at the end means earlier milestones have less signal to debug from. Second, I'd treat the partner integration synthesis as a separate deliverable from the spec — the partner guides are reference-quality, but bundling them with the spec made the spec heavier than it needed to be. Third, I'd write the demo plan (this file) before milestone 0 — the dogfooding frame should drive what gets built first, and I'm reverse-engineering it now.

#### D.6 The trivia question

**Q: Why pglite for dev?**

> ADR-0001. Short version: zero-config local dev that exercises real Postgres semantics. The alternative was sqlite, which would have required schema differences for production. Pglite is a real Postgres in WASM, so the migration in `src/storage/migrations/0001_init.sql` runs identically locally and in prod.

#### D.7 The 'gotcha' question

**Q: Have you actually run this end-to-end against a real Atlassian site?**

> Capability discovery and the Confluence read path against a real site, yes — see [`tests/integration/providers/confluenceRestProvider.test.ts`](../../tests/integration/providers/confluenceRestProvider.test.ts), which is gated behind an env var. Provisioning execution end-to-end, no — that's M6a–M6c, currently in backlog. The honest answer is: the read side has been validated; the write side has been designed and unit-tested, and end-to-end will happen in those milestones.

Refusing to fake this is the right call. Fake "yes, totally" answers fail the consistency check.

#### D.8 The level question

**Q: What level of role does this prepare you for?**

> The work shown here is at staff-engineer scope: an originally-designed spec, a multi-component implementation, integration with three external systems, an explicit security model, and a measurable readiness rubric. I'd target staff-software-engineer or senior-staff-engineer roles. I'm not claiming principal-level scope — that would require multi-team coordination, which a solo project can't demonstrate.

(That phrasing is honest, lands well, and pre-empts overreach.)

(Add 17–22 more entries before the first interview. Categories to fill: questions about specific ADRs, questions about specific milestones, questions about deferred work, questions about why MCP, questions about why Atlassian over Linear/Notion, questions about why Bitbucket over GitHub, questions about how you'd add Linear/GitHub/GitLab support, questions about scaling, questions about cost, questions about deployment.)

### Appendix E — Flagship epic specs (3 of 8 designed in full)

#### E.1 Epic: Audit + Policy Enforcement

**Summary.** Implement the policy decision layer and the hash-chained ed25519-signed audit log. Every state-changing operation gates through the policy layer; every state change generates an audit entry. The audit chain is verifiable post-hoc.

**Why it exists.** v6 §7.2 (policy decision layer) and v6 §30.1 (audit log: hash chain + ed25519 signatures + git-ref key registry). Both are mandatory for a v1 that handles tokens and writes to external systems.

**Children stories (6):**

1. PCO-101: Schema for audit entries with hash + signature columns
2. PCO-102: Policy decision interface + code-policy adapter
3. PCO-103: Hash linkage + ed25519 signing pipeline
4. PCO-104: Git-ref-versioned key registry
5. PCO-105: Audit chain verifier (offline tool)
6. PCO-106: Integration: every executor wraps in policy + audit

**Status.** In Progress. Schema and signing pipeline (101, 103) are done; verifier (105) and integration (106) are open.

**Linked ADRs.** ADR-0005 (audit signing pipeline), ADR-0002 (token encryption — adjacent).

**Linked v6 sections.** §7.2, §30.1.

**Notes.** The genesis block has no signature (nothing to chain to). This is intentional and documented in ADR-0005. Verifier handles it as a special case.

#### E.2 Epic: Atlassian Providers + Capability Discovery

**Summary.** Implement Jira and Confluence provider classes that authenticate against Atlassian Cloud, discover site capabilities (REST API versions, available macros, etc.), and produce a preflight profile.

**Why it exists.** v6 §19 (Provider Interfaces), v6 §28 M2.

**Children stories (7):**

1. PCO-201: Jira REST v3 provider with API token auth
2. PCO-202: Confluence Cloud REST v2 provider with API token auth
3. PCO-203: OAuth 3LO auth flow (alternative to API token)
4. PCO-204: Actor attribution (impersonation handling)
5. PCO-205: Capability discovery for Jira (project types, issue types, workflows available)
6. PCO-206: Capability discovery for Confluence (storage format support, macro inventory)
7. PCO-207: Preflight profile JSON schema + emitter

**Status.** In Progress. 201, 202, 203, 204 are done. 205–207 open.

**Linked ADRs.** ADR-0003 (Confluence storage default ADF flagged) — discovery must include ADF compatibility.

**Linked v6 sections.** §19, §20 (auth modes), §28 M2.

**Notes.** Capability discovery is the gate for v6 §22's session capability negotiation. Without 205–207, sessions can't expose adaptive features.

#### E.3 Epic: Demo Documentation + Portfolio Packaging

**Summary.** Produce the seed Jira project, Confluence space, GitHub mirror, and tour scripts that constitute the interview portfolio.

**Why it exists.** This file. The dogfooding frame requires that the project structure itself be a generated artifact, so the portfolio epic is tracked the same as any other engineering work.

**Children stories (5):**

1. PCO-801: Build plan v2 (this file's rewrite)
2. PCO-802: Generate seed Jira project from atl-mcp profile
3. PCO-803: Generate seed Confluence space from atl-mcp profile
4. PCO-804: Author 3 centerpiece Confluence pages (architecture, runbook, audit findings)
5. PCO-805: Author tour scripts (60s, 5min, 15min) + Q&A vault + AI-honesty page + GitHub mirror

**Status.** In Progress. 801 in review (this file). 802–805 in backlog.

**Linked ADRs.** None directly. The strategy itself isn't an ADR — it's a portfolio decision documented in this file.

**Linked v6 sections.** None — this is meta-work outside the spec proper. That's deliberate; portfolio packaging is not a deliverable of the orchestrator, it's a use of it.

**Notes.** This is the punchline epic. Tracked the same as engineering work because the entire pitch is "this tool produces project structures for any kind of work — including portfolio work."

(Specs for the other 5 epics — Runtime, Domain Model, VCS, Blueprint Workflow, Provisioning — would follow the same template at lighter depth.)

### Appendix F — Flagship ticket specs (1 of 5 designed in full)

#### F.1 PCO-103: Implement hash linkage + ed25519 signing pipeline

**Type.** Story.
**Component.** Security.
**Labels.** `security`, `audit`.
**Epic.** Audit + Policy Enforcement.
**Status.** Done.
**Estimate.** L.

**Description.**

Implement the hash linkage and ed25519 signing pipeline for the audit log per v6 §30.1 and ADR-0005.

Each new audit entry must:

1. Compute `prevHash` as the SHA-256 of the previous entry's full canonical JSON serialization (including its own signature).
2. Compute `payloadHash` as the SHA-256 of the entry's payload JSON.
3. Compute `chainHash` as the SHA-256 of `prevHash || payloadHash`.
4. Sign `chainHash` with the active ed25519 private key, where "active key" is determined by the registry git ref pointed-to at write time.
5. Persist all four fields plus the `keyId` of the active key.

The genesis block has `prevHash = null` and is signed identically. The verifier handles genesis as a special case.

**Acceptance Criteria.**

**Given** an empty audit log
**When** I write the first entry
**Then** `prevHash` is null, `chainHash` equals SHA-256 of `payloadHash`, and `signature` verifies against the registered key.

**Given** an audit log with N entries
**When** I write entry N+1
**Then** `prevHash` equals the hash of entry N's canonical serialization including its signature, AND the verifier accepts the chain end-to-end.

**Given** an audit log with a tampered payload at entry K
**When** the verifier runs
**Then** verification fails at entry K with an error citing the chain break.

**Given** a key rotation between entries K and K+1
**When** I write entry K+1
**Then** the new entry's `keyId` is the new key's id, AND the verifier reads the registry git ref at the appropriate commit to validate K+1.

**Given** the registry git ref is unavailable
**When** I attempt to write any entry
**Then** the write fails closed with a logged error, NOT silently producing an unsigned entry.

**Linked artifacts.**
- ADR: [`docs/adr/0005-audit-signing-pipeline.md`](../adr/0005-audit-signing-pipeline.md)
- Spec: v6 §30.1
- Code: [`src/storage/schema/auditEntries.ts`](../../src/storage/schema/auditEntries.ts)
- Test: (links to integration test once written)

**Comments (real-iteration evidence).**

> *2026-04-12, Chris:* Initial implementation used SHA-512; switched to SHA-256 to match v6 §30.1 spec. Reviewed against §30 fix-type taxonomy — counts as a "spec-conformance fix."

> *2026-04-15, Chris:* Genesis block edge case caught in test. Verifier now special-cases `prevHash === null` rather than treating null as "missing chain hash."

> *2026-04-18, Chris:* Open question: should the registry git ref be a tag (immutable) or a branch (mutable)? Branch is operationally simpler; tag is verifiability-stronger. Going with branch + audit-log-the-rotation-event for now. Documented in ADR-0005 §"Open questions."

That comment thread is the interviewer payoff — it shows real iteration and judgment, not just final code.

(Specs for the other 4 flagships — capability discovery story, ADF spike, no-stdout bug, migration rehearsal task — would follow at similar depth.)

### Appendix G — Confluence page index (with sample centerpiece content)

(Page-by-page sketches for the 28 pages in the IA. Architecture, Runbook, and Audit Findings already specified in §25. The remaining 25 are 1-paragraph sketches each. Not produced here for length.)

### Appendix H — Screenshot capture list

(See §40. Numbered list of 10 screenshots with what each must show.)

### Appendix I — The "AI honesty" page draft

```markdown
# How this project was built

This page exists because senior engineering interviewers in 2026 have a reasonable question: how much of what you're looking at did I write, and how much was AI-assisted?

## Three categories

### Designed (by me, with no AI authorship)

- The choice to build atl-mcp at all, and what its scope is.
- The v6 spec evolution from v5 — see v6 §0 review summary for the diff.
- The choice of Atlassian + Bitbucket as the v1 surface, and the deferral of GitHub/GitLab/Linear.
- The dogfooding strategy as the demo frame.
- The 8-epic project structure documented in this file.
- The selection of the 10 ADRs in [`docs/adr/`](../adr/) — what to capture as a decision vs. what to leave inline.
- The readiness rubric in v6 §17, including the 6-category deterministic score, the 4-tier LLM-judged verdict, and the weighted project- and issue-level rubrics.
- The failure-mode taxonomy in v6 §30.4 and the fix-type taxonomy in §30.5.
- The audit chain design in v6 §30.1 + ADR-0005, including the genesis block treatment and the git-ref-versioned key registry.

### Orchestrated (by me, executed via Claude Code following test-first discipline)

- Implementation of milestones M0 through MN, each following its build prompt in v6 §29.
- The iron law in CLAUDE.md operating rules: no production code without a failing test first. This was followed in every milestone.
- The structural discipline of CLAUDE.md operating rules: no stdout from `src/` (enforced by lint), single-message Task dispatch for parallel sub-agents, no inventing skills/hooks/plugins outside spec.

A skeptical reader can verify the orchestration boundary by reading any single source file alongside the corresponding build prompt in v6 §29. The shape of the code matches the prompt's description. That alignment is intentional — predictable orchestration is the goal.

### Generated (system output, not authored content)

- The Jira project structure (8 build epics, ~76 issues from blueprint output, plus a 6-epic / 88-issue future-work backlog added 2026-04-27) is the output of running atl-mcp's blueprint workflow on the project's own profile.
- The Confluence space structure (28 pages) is the output of the Confluence executor (or a faithful simulation of its output, where the executor isn't yet implemented).
- The Bitbucket scaffolding (branches, agent-context manifest) is the output of the VCS executor (or a faithful simulation).

The dogfooding frame is the demonstration. If this approach were broken — if the orchestrator produced outputs incompatible with how engineers actually work — you'd see it in the Jira project. The fact that the project looks coherent is the validation.

## Where the boundaries blur

There are places where the categories overlap honestly:

- **Code review.** Claude Code reviews code it has written. I review it back. Disagreements get resolved by checking against the v6 spec.
- **ADR drafting.** I make the decisions. Claude Code drafts the MADR-format prose. I edit.
- **Test writing.** I specify test cases. Claude Code implements them. I review for coverage gaps.
- **Documentation.** Most prose in [`docs/`](../) was drafted by Claude Code from my outlines. The spec (v6) and the partner-integration synthesis was a collaboration where I steered structure and Claude Code filled detail.

I'm comfortable with these blurred lines because the decisions are mine and the outputs are reviewed. A reader who wanted to test this could pick any architectural decision and ask me to defend it — the answer would match what's documented because I made the call.

## What I'd be uncomfortable with

If someone built this without a v6-style spec — generating tickets and pages from a prompt and shipping them without architectural decisions — that would be a different artifact and I wouldn't represent it as engineering work.

The spec is the artifact. The implementation is the proof the spec is buildable. The generated output is the proof the implementation works. Each layer earns its trust from the layer above.
```

That page is one of the most important pages in the whole portfolio for a 2026 interview. Practice the verbal version too — be able to deliver this content out loud in 90 seconds.

---

## Closing notes

If anything in this plan conflicts with v6 §11, §12, §13 (the generated-structure specs), defer to the spec — the dogfooding frame requires that. If anything conflicts with operating rules in [`CLAUDE.md`](../../CLAUDE.md), defer to operating rules.

This plan is itself a piece of engineering work and should be reviewed as such. Open questions:

1. Should the actual tour script be split into three files (`tour-60-seconds.md`, `tour-5-minutes.md`, `tour-15-minutes.md`) or kept as anchored sections in one file? Recommend three files — easier to mirror to Confluence as separate pages.
2. Should the interviewer-walkthrough plan (this file) be renamed to `interviewer-walkthrough-plan.md` to free up `interviewer-walkthrough.md` for the tour itself? Recommend yes, after the tour scripts are drafted, with a redirect note in this file.
3. How much of the seed project structure can be generated by atl-mcp now vs. simulated by hand? This depends on how far M5 (planner) and M6a (Jira executor) have progressed. Update this section as those milestones land.
4. What's the mock-interview cadence before declaring demo-ready? Recommend three full 15-minute tours, separated by at least 24 hours each, with at least one of them done with a real engineer playing the interviewer role.

Last reviewed: 2026-04-25 by Chris.
