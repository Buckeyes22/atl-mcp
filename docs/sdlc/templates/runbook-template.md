---
title: Runbook Entry Template
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [operator, engineer]
sdlc_category: templates
related: [docs/sdlc/08-operations/runbook.md]
---

# Runbook entry template

> **TL;DR:** Each runbook entry follows a strict shape — symptom → diagnosis → action → lesson. Operators in incident find what they need by symptom, not by component.

Use this when adding a new entry to [`docs/sdlc/08-operations/runbook.md`](../08-operations/runbook.md).

---

## Entry: [Symptom phrased as the operator sees it]

> **Symptom:** What the operator observed or what an alert fired on. One sentence. Avoid jargon — say "MCP clients drop connections within 100 ms of session start" not "stdout corruption."

> **Severity:** P0 (page now) | P1 (page during business hours) | P2 (file ticket).

> **First-touch time-budget:** How long the first responder has to acknowledge / triage. Examples: 5 min for P0, 30 min for P1, 1 day for P2.

### What it might be

The most common root causes, in rough order of likelihood. Each item is a hypothesis to test, not a verdict.

1. **Hypothesis 1.** One sentence. Test: how to confirm or rule out.
2. **Hypothesis 2.** …
3. …

### Diagnostic commands

The exact commands to run to narrow down the root cause. Each command:

- Runs in a known location (specify which env: prod, staging, local).
- Has a clear pass/fail or value-to-look-at output.
- Doesn't have side effects without explicit `# WRITES` annotation.

```bash
# Read-only
curl -s http://localhost:3001/healthz | jq
curl -s http://localhost:3001/readyz | jq
tail -100 ./orchestrator.log | grep ERROR

# WRITES — only run with on-call lead approval
# (no examples here; runbook entries don't recommend writes blindly)
```

### Action

The procedure to recover, broken into discrete steps. Each step:

- Has a precondition (what must be true before running it).
- Has a postcondition (how to verify it succeeded).
- Has a rollback if it fails.

```
1. Confirm symptom is present (run /healthz; verify status != 200).
2. Capture diagnostic state (run the commands above; save output to incident channel).
3. Apply fix:
   - If hypothesis 1: …
   - If hypothesis 2: …
4. Verify postcondition (re-run /healthz; verify status == 200).
5. If fix didn't work, escalate to on-call lead with diagnostic state captured in step 2.
```

### What we know about prior occurrences

- Date | incident-id | brief one-line outcome | linked postmortem.
- "First seen 2026-04-18; Incident A; root caused to console.log in src/mcp/sessionCapabilities.ts; fixed by lint:no-stdout (Incident A in [`runbook.md`](../08-operations/runbook.md))."

### Lesson

The one-sentence durable takeaway. Examples:

- "Invariants are tooling, not vibes."
- "Migrations require rehearsal against a prod-shaped snapshot."
- "Crypto rotation is a system, not a key change."

The lesson is the part that survives — even after the specific fix is automated away, the lesson stays in the runbook for the next class-of-issue.

### Linked artifacts

- ADR (if a decision codified the fix): `docs/adr/NNNN-…md`
- Postmortem (if a major incident): `docs/sdlc/14-incidents/library/YYYY-MM-DD-name.md`
- Code (if a code path is implicated): `src/…`
- Spec: v6 §X.Y
- Jira: PCO-XX

---

## Style rules

- **Symptom-first ordering** in the parent runbook. Operators search by symptom, not by component.
- **No fluff prose.** Tables and lists. If you write a paragraph, justify it.
- **Concrete commands.** Pseudocode is for designs; runbooks need exact strings.
- **Time budgets.** Every action step has an expected duration in production.
- **Escalation defined.** When a step fails, who gets paged?
- **Read-only by default.** If a step writes, mark it `# WRITES` and document the rollback adjacent to the action.

A runbook entry that doesn't help an operator at 3 AM is failing its job. Test draft entries by reading them aloud to someone who hasn't seen the system before.
