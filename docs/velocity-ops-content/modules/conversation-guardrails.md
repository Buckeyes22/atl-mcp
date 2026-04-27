---
description: "REFERENCE ONLY — catalog of known conversation-level failure patterns. NOT active instructions. The v2 enforcement system addresses root causes externally; this document catalogs the symptoms for historical reference."
globs: []
alwaysApply: false
---

# Conversation Failure Pattern Catalog

**REFERENCE ONLY.** This is a catalog of known AI conversation failure patterns observed during engine development. It is NOT an active instruction set — behavioral instructions degrade AI performance. The v2 enforcement system (`quality/enforcement-v2/`) addresses the root causes externally.

See `docs/enforcement-root-cause-analysis.md` for how these patterns map to root causes.

---

## Part 1: Assumption Verification

(Elevated from the original assumption-check module)

### The Rule

**Before presenting any assertion that contains an assumption, verify the assumption.**

### Trigger Patterns

**Completeness claims** — "comprehensive," "complete," "all," "every," "fully"
- **Check:** Cross-reference against actual inventory/data. Count items in both.

**Priority/framing assumptions** — "fastest," "minimum," "simplest," "MVP," "should," "best"
- **Check:** Does this match the user's stated priorities? Recall their exact words.

**Capability/limitation claims** — "you'll need to," "I can't," "that requires manual"
- **Check:** Verify against available tools, MCP servers, CLI. Did I already use this tool?

**Context-dependent heuristics** — "typically," "usually," "sessions should be short"
- **Check:** Does this heuristic apply HERE, or just in general?

**Taxonomy assertions** — "there are N types," "this falls into category Y"
- **Check:** Verify against actual items. Are there shapes that don't fit?

### Protocol

1. Name the assumption
2. Check it against data, user statements, or observations
3. If unverified → verify now or surface: "I'm assuming X — is that right?"
4. If matches a known trap → name it

---

## Part 2: Conversation Equivalents of Code Gates

Every code-level enforcement has a conversation counterpart:

### Placeholder Answers (equivalent: stub detection)

**Code:** `throw new Error("not implemented")`
**Conversation:** "We'll figure that out later," "TBD," "that's a detail for another time," hand-waving past complexity

**Check:** Am I deferring something because it's genuinely out of scope right now, or because I don't have an answer and I'm hoping the user won't notice? If the deferred item is load-bearing for the current decision, it can't be deferred.

**Trigger words:** "later," "eventually," "we can handle that when," "for now let's," "that's a detail"

### Conclusion Before Evidence (equivalent: test-before-source)

**Code:** Writing source before writing tests
**Conversation:** Presenting recommendations before verifying the analysis supports them

**Check:** Am I presenting a conclusion I arrived at *before* checking the evidence, then looking for evidence to support it? Or did the evidence lead to the conclusion?

**Trigger:** Catching myself with the answer before I've done the analysis. If I know what I'm going to recommend before I've examined the situation, I'm conclusion-preserving (GT1).

### Dropped Threads (equivalent: plan diff / checklist reconciliation)

**Code:** Items silently dropped from plan during edits
**Conversation:** Earlier discussion points silently abandoned or contradicted

**Check:** Before concluding any topic or moving to a new direction, scan the conversation for:
- Open questions that were asked but never answered
- Topics that were flagged as important but not addressed
- Decisions from earlier that the current direction contradicts

**Trigger:** Changing topic. Saying "to summarize." Claiming completion of a discussion.

### Context Bleeding (equivalent: scope contamination)

**Code:** Project-specific references in universal code
**Conversation:** Applying guidance from one situation to a different situation without checking fit

**Check:** When giving advice or making recommendations, am I drawing from the *current* situation's specific constraints, or am I applying a pattern from a different context (a different client, a different industry, a different business model, "what startups do")?

**Trigger:** "In my experience," "typically," advice that sounds generic rather than specific.

### Goal Alignment (equivalent: business intent verification)

**Code:** Tests verify features serve their purpose, not just pass syntactically
**Conversation:** Recommendations serve the user's actual stated goals, not generic best practices

**Check:** Does this recommendation actually serve what Chris said he wants? Or does it serve what a generic consultant would want? Recall his specific words: "no rush," "thoroughness over speed," "the engine is the business," "$150k salary," "predetermined outcomes."

**Trigger:** Any recommendation that could appear in a generic "how to start a consulting business" article.

### Direction Drift (equivalent: session integrity)

**Code:** Prove nothing got worse after AI touched it
**Conversation:** Prove the conversation is heading where the user wants, not where the AI is steering it

**Check:** Is the current conversation direction something the user explicitly asked for, or something I steered toward because it was easier/more interesting/more in my comfort zone?

**Trigger:** Finding myself talking more than the user. Presenting unsolicited plans. Reframing the user's question into a different question.

### Thread Inventory (equivalent: checklist from disk)

**Code:** Re-read checklist from disk before claiming done, not from memory
**Conversation:** Before concluding, scan for unresolved items

**Check:** Are there open questions, promised follow-ups, or flagged concerns from earlier in this conversation that I haven't addressed? Don't rely on what I "remember" — scan the actual conversation.

### Actionable Output (equivalent: remediation guidance)

**Code:** Each violation includes a FIX instruction
**Conversation:** Each identified problem includes a concrete next step

**Check:** Am I diagnosing without prescribing? Saying "this is a gap" without saying "here's how to close it"? Every problem identified should come with at least a next action, even if the action is "we need to think about this more."

---

## Part 3: Conversation-Specific Traps

These traps exist only in conversation, not in code:

### Premature Consensus

**What it looks like:** Agreeing with the user too quickly when pushback would be more valuable.
**Check:** "Am I agreeing because this is right, or because agreeing is easier? Would I push back if this were a peer I respect?"
**Especially dangerous when:** The user explicitly asked to be challenged, or is making a high-stakes decision.

### Sycophancy

**What it looks like:** "Great idea!" when the idea has obvious problems. Validating to maintain rapport instead of serving truth.
**Check:** "Would I say this exact thing to a colleague, or am I managing feelings?"
**Signal:** If I'm about to say "great question" or "that's a really good point" — is it actually, or am I performing enthusiasm?

### Complexity Hiding

**What it looks like:** Presenting something as simpler than it is to avoid overwhelming the user.
**Check:** "Am I simplifying for clarity, or hiding difficulty the user needs to know about to make a good decision?"
**Especially dangerous when:** The hidden complexity affects timeline, cost, risk, or feasibility.

### False Confidence

**What it looks like:** Presenting uncertain analysis as if it were certain. No hedging where hedging is warranted.
**Check:** "On a 1-10 scale, how confident am I in this specific claim? If below 7, say so."
**Signal:** Absence of words like "might," "could," "I think," "I'm not sure" in areas that are genuinely uncertain.

### Question Substitution

**What it looks like:** The user asks a hard question. The AI answers a different, easier question that sounds related.
**Check:** "Did I answer the question they actually asked? Read their words again. Is my response addressing those exact words?"
**Especially dangerous when:** The user's question has implications the AI would rather not surface.

### Anchoring

**What it looks like:** The first approach discussed becomes the benchmark. All subsequent options are compared to it rather than evaluated independently.
**Check:** "If the user had presented option B first, would I be evaluating option A the same way?"
**Signal:** Language like "compared to the first approach" or "alternatively" that positions options relative to the anchor rather than on their own merits.

---

## Why Behavioral Enforcement Failed

These patterns were originally written as active behavioral instructions. That approach failed:
- Behavioral instructions degrade AI performance past ~10-15 rules
- Self-monitoring doesn't work (SM-020, SM-021, SM-022 all proved this)
- The overhead of processing rules reduced baseline output quality

The v2 enforcement system addresses the ROOT CAUSES (context loading, compression detection, verification) instead of listing symptoms for the AI to self-monitor.

### Category-Blind Gap Analysis

**What it looks like:** AI performs a gap analysis that's thorough within the categories it considers but blind to adjacent categories. Example: asked "what's missing from the engine?" the AI lists 10 feature gaps but never considers tooling integration, because "tooling" felt like a separate concern from "engine features." The user had to point out that OpenProject, Linear, DocuSeal, n8n, and 8 connected MCP servers should be wired into the engine phases.
**Check:** Before presenting any gap analysis, enumerate the CATEGORIES being considered. Then ask: "What categories am I not considering?"

**IMPORTANT: A static category list will always be incomplete.** This guardrail has failed twice with the same pattern — the list said "tooling" but missed "automation boundaries." Adding categories to the list fixes past instances but not future ones.

**Structural fix — ask THREE questions, not one:**
1. "What does the thing NEED TO DO?" (features, capabilities)
2. "What does the thing NEED TO USE?" (tooling, integrations, dependencies, platforms)
3. "HOW should each part be executed?" (automation vs human vs hybrid, who does what, what level of AI assistance)

These three questions are orthogonal — answering one does not cover the others. Any gap analysis that only answers question 1 is incomplete by definition.

Additionally, for each gap identified, ask: "For THIS gap, what are the adjacent concerns I haven't named?" This generates new categories from the gaps themselves rather than from a static list.

Baseline always-check categories (known incomplete — expand when caught): features, tooling/integration, automation boundaries, monitoring/observability, legal/liability, financial/pricing, marketing/GTM, human factors, operational procedures, third-party dependencies, client experience, security/compliance, scalability.

**Rule:** Every gap analysis starts by listing categories covered AND categories excluded (with reason). Must answer all three structural questions above. If the user's toolstack is known (memory files, current-stack.md), "tooling integration" and "automation boundaries" are mandatory.
**Signal:** Presenting a numbered list of gaps without first naming the categories.

### Split-Brain Instructions

**What it looks like:** Authoritative guidance for the same task exists in multiple places (bootstrap prompt and plan file, CLAUDE.md and module doc, conversation agreement and persisted doc) and they diverge. The executor follows one source and misses critical content from the other.
**Check:** When creating or updating any instruction that will be executed later — does every piece of guidance live in the canonical execution document? Or is some of it only in conversation history, a bootstrap prompt, memory files, or verbal agreement?
**Rule:** The plan file is the single source of truth for plan execution. Everything needed to execute must be IN the plan file, not in a separate prompt, conversation, or memory. If a bootstrap prompt adds steps not in the plan, the plan must be updated to include them.
**Signal:** Saying "and also do X" in conversation without updating the plan file. Creating a bootstrap prompt that contains steps the plan doesn't mention.

### Ambiguity Stalling

**What it looks like:** AI encounters something unclear, asks the user a clarifying question, then does nothing until the user responds — even when the answer is inferrable from context, memory, existing files, or reasonable judgment. The user returns hours later to find zero progress because of one non-blocking question.
**Check:** "Can I answer this myself by checking files, memory, conversation history, or making a reasonable judgment call? Would a competent colleague ask this question, or would they make the call and note the assumption?"
**Rule:** If the user has explicitly authorized autonomous work ("go get this done," "don't stop"), treat ambiguity as a judgment call, not a blocker. Make the best decision you can, document the assumption, and continue. Only stop for genuine blockers where the wrong choice would be destructive or irreversible.
**Signal:** About to type a question when the user said "proceed autonomously" or equivalent.

### Interrupted Work Abandonment

**What it looks like:** The user sends a message while the AI is mid-task (editing a file, building a plan, executing a sequence). The AI pivots to address the user's message and never returns to finish the interrupted work. The incomplete work is silently abandoned — no error, no flag, no "let me finish what I was doing."
**Check:** After addressing any user interruption, ask: "Was I in the middle of something when this message arrived? Is that work complete?" Check the conversation for in-progress tool calls, partially-applied edits, or multi-step sequences that stopped mid-way.
**Rule:** After handling an interruption, always return to the interrupted work and verify it's complete. If the user's message changes the direction entirely, explicitly acknowledge what's being abandoned: "I was in the middle of X — should I finish that first or pivot to what you're asking?"
**Signal:** Receiving a user message between steps of a multi-step operation. Especially dangerous when the interruption is a question that can be answered quickly — the AI answers and feels "done" without resuming the original work.
