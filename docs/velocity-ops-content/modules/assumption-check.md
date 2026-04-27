---
description: "REFERENCE ONLY — catalog of assumption verification patterns. Path E hooks have been removed. v2 enforcement addresses root causes externally."
globs: []
alwaysApply: false
---

# Assumption Check — REFERENCE ONLY

**Pattern catalog, not active instructions. Path E has been removed. See `quality/enforcement-v2/` for the replacement system.**

## The Problem

Gates fire on tool use (Edit, Write, Bash). They don't fire on conversation output. When the AI presents a plan, matrix, recommendation, or coverage claim in plain text, no gate checks the assumptions underneath it. Unverified assumptions pass straight to the user as if they were facts.

Every trap caught live in this project was caught by the user pushing back on an AI assertion, not by a gate. The AI:
- Claimed "comprehensive coverage" with a 6-cell matrix when the actual inventory had 12 shapes
- Applied "fastest path" startup thinking to a situation with no time pressure
- Suggested manual work while having the tool available in the same session
- Hardcoded a project name into universal code
- Proposed stopping the session based on old context-window heuristics that don't apply to 1M context

## The Rule

**Before presenting any assertion that contains an assumption, verify the assumption.**

This is not optional. This is not "when you remember." This is a behavioral requirement on every response, the same way §12 Self-Verification is a requirement before claiming code is complete.

## Trigger Patterns

Self-check when your response contains any of:

### Completeness claims
- "comprehensive," "complete," "all," "every," "fully," "entire," "covers everything"
- Any matrix, table, or list claiming to represent full coverage of something
- **Check:** Cross-reference against the actual inventory/data. Count distinct items in both. If inventory > matrix, the claim is false.

### Priority/framing assumptions
- "fastest," "quickest," "minimum," "simplest," "just," "MVP," "good enough"
- "should," "best approach," "the right way," "obviously"
- **Check:** Verify the framing matches the user's stated priorities. Recall what they explicitly said about speed, thoroughness, quality. If they said "I'm in no rush," don't optimize for speed.

### Capability/limitation claims
- "you'll need to," "I can't," "that requires manual," "you should do this yourself"
- **Check:** Verify against available tools, MCP servers, and CLI commands. Check if you already used a tool that could do this. If the capability exists, use it.

### Context-dependent heuristics
- "sessions should be kept short," "this is getting complex," "we should start fresh"
- "based on my experience," "typically," "usually," "in most cases"
- **Check:** Verify the heuristic applies to THIS situation, not just situations in general. Check for changed conditions (1M context, no time pressure, unique constraints).

### Category/taxonomy assertions
- "there are N types of X," "this falls into category Y"
- Any grouping, classification, or decomposition
- **Check:** Verify the taxonomy against the actual items. Are there items that don't fit any category? Are there categories with sub-types that behave differently?

## Self-Check Protocol

When a trigger pattern is detected in your own response, before sending:

1. **Name the assumption:** "I'm assuming X"
2. **Check it:** Is X verified by data, user statement, or observation? Or am I just asserting it?
3. **If unverified:** Either verify it now (check files, check memory, check tool list) or surface it: "I'm assuming [X] — is that right, or am I off base?"
4. **If it matches a known trap:** Name the trap. "I notice I'm about to do [Category 8: progressive simplification]. Let me check..."

## What This Does NOT Mean

- Do NOT preface every response with "assuming X, Y, Z." That's noise.
- Do NOT ask the user to confirm obvious things. Only surface assumptions that could meaningfully change the response.
- Do NOT slow down to self-check on simple factual answers, file reads, or tool operations.
- DO self-check on plans, recommendations, matrices, coverage claims, priority judgments, and framing choices.

## Examples

**Bad (unchecked assumption):**
> "Here's a comprehensive coverage matrix with 6 entries across delivery types and pillars."

**Good (checked):**
> "Let me verify this matrix is actually comprehensive. The service catalog has... 12 distinct engagement shapes. 6 entries isn't enough. Here's the real matrix."

**Bad (mismatched heuristic):**
> "This session is getting long — we should pick this up fresh."

**Good (checked):**
> "We're at 60% of 1M context with no compression. Everything from the start is still loaded. No reason to stop unless you want to."

**Bad (capability denial):**
> "You'll need to manually check the Cloudflare DNS settings."

**Good (checked):**
> "Let me check — I have the Cloudflare MCP server connected. I can do this directly."
