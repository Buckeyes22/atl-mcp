# Plain-language reference for a project-wide language pass

**Purpose:** hand this to an agent doing a language-improvement pass across frontend component text and documentation. The owner of the receiving project is a non-technical operator who couldn't read most of what's currently in the UI and the docs. The job is to make the words land for that person without dumbing the technical content down or stripping out the terms that are actually load-bearing.

**Audience for the rewritten text:** assume the reader is sharp but not in your subfield. They run the business. They read every screen and every doc. If a sentence makes them feel stupid, the sentence is wrong — not them.

---

## The one rule

**Plainest word that carries the meaning.**

Domain terms (the actual names of things in the system, the names of libraries, the names of patterns the team has agreed on) stay. Abstract vocabulary that signals competence without adding meaning goes.

That's it. Everything below this line is how to apply that rule.

---

## The test that decides every word

**"Would a senior engineer explaining to another senior engineer in a different subdomain use this word?"**

- Yes → keep it. It's precise. It's the actual name of the thing.
- No → drop it. It's reaching for vocabulary that sounds smart.

Worked examples:

| Word/phrase | Test result | Why |
|---|---|---|
| `tRPC`, `Drizzle`, `Auth.js`, `Stripe webhook`, `Server Component` | Keep | These are the actual names of the things. A backend engineer talking to a mobile engineer would still say "tRPC procedure" because that's what it's called. |
| `calibrated to observed runtime` | Drop | A senior backend engineer wouldn't say this to a senior frontend engineer. They'd say "the test got set to whatever the code happened to do that day." |
| `structural regression` | Drop | They'd say "the work got worse in a fundamental way, not just a small slip." |
| `tautology by construction` | Drop | They'd say "the test asserts something that's automatically true because of how the file is written, so it can never fail." |
| `idempotent webhook handler` | Keep | This *is* how engineers in different subdomains talk to each other about webhooks. It has a precise meaning. |
| `leverage`, `utilize`, `architect` (as verb) | Drop | These are corporate-speak versions of "use," "use," and "design." Always drop. |
| `holistic`, `synergy`, `paradigm` | Drop | Always drop. These are tells that the writer is hedging. |
| `actionable`, `bandwidth`, `circle back` | Drop | Same. |

The rule is **don't pad**, not **don't be technical**.

---

## Why this matters: jargon as a hedge

When a writer reaches for abstract vocabulary, they're usually doing one of two things:

1. **Hedging.** They aren't sure the reader trusts the answer, so they reach for words that sound smart. The reader feels talked-down-to and trusts the answer less.
2. **Performing competence.** They're showing the reader they know the field. The reader can't tell the difference between knowing the field and performing it, so this fails on its own terms.

Both are tells. The fix is the same: say the thing. If you know what you're talking about, the plain version is also the precise version. If the plain version sounds wrong, you didn't actually know what you were saying.

---

## The verbosity pattern (a separate failure mode, related)

A different agent on this owner's projects (Codex) writes responses that elaborate every consideration before getting to the point. It conflates "show your work for code review" with "give the operator a decision."

**The pattern looks like this:**

> The implementation considers several factors. First, we evaluated whether to use approach A, which has the benefit of X but the drawback of Y. We then considered approach B, which inverts the tradeoff. Ultimately we selected approach C because it balances both concerns while also addressing the secondary requirement of Z. The implementation is structured to allow future migration to approach A or B if requirements change.

**The plain version:**

> Used C. A and B were the alternatives. C was the best fit because of Z.

If the reader needs to see the alternatives evaluated, they'll ask. Don't preempt. Lead with the answer or action.

This shows up in UI text too. Long modal copy that explains why a feature exists before saying what the button does. Long error messages that apologize before saying what went wrong. Long onboarding screens that justify the product before showing the next step.

**Frontend rule:** lead with what the user can do or what just happened. Justification, if any, comes after.

---

## Concrete jargon → plain translations

These are real translations from this session. Use them as a calibration set when the agent is making the same kind of substitution.

| Jargon version | Plain version |
|---|---|
| "calibrated to observed runtime" | "the test got set to whatever the code happened to do that day" |
| "structural regression" | "the work got worse in a fundamental way, not just a small slip" |
| "tautology by construction" | "the test asserts something that's automatically true because of how the file is written, so it can never fail" |
| "shallow depth coverage" | "the tests look like they cover the surface but don't actually exercise the code" |
| "scope was narrowed to clear the threshold" | "they cut the work down until the number went green" |
| "padding tests inflate the density floor" | "fake tests get counted to hit the per-file minimum" |
| "the entitlement projection layer" | "the part of the code that decides what each user is allowed to do" |
| "anti-fraud gates" | "checks that catch tests faking their results" |
| "first-class domain state" | "real data the system stores and uses, not a side effect" |
| "registry-defined budgets" | "the budget numbers the spec says we have to hit" |

Pattern across all of them: **drop the abstract noun, name the actual thing or actual action.**

---

## Frontend component text — patterns to apply

### Button labels

- **Verb + noun.** "Save changes," "Delete account," "Cancel booking." Not "Submit," not "OK," not "Continue."
- **Match the consequence.** A destructive button says "Delete account permanently," not "Confirm." A button that sends an email says "Send invite," not "Submit."
- **Skip filler.** "Click here to" is always wrong. "Please" in button labels is wrong.

### Error messages

- **What broke. What to do.** Two sentences, max. "Your card was declined. Try a different card or contact your bank."
- **Never apologize in the error.** No "Oops!" No "Sorry, something went wrong." It wastes the reader's time and signals you don't know what happened.
- **Never use error codes alone.** `E_AUTH_401` is for the developer console. The user-facing version is "Your session expired. Sign in again."
- **Plainest word that names the failure.** "Couldn't connect to the server" beats "Network request failed." "We couldn't find that page" beats "404 — Resource not found."

### Empty states

- **Name what would be there.** "No bookings yet" is fine. "Your bookings will appear here once you make one" is better. "Welcome to your booking management dashboard" is wrong.
- **Action if applicable.** "Book your first session →"
- **No metaphors.** No "Looks like it's quiet around here!" — the reader knows the page is empty, you don't have to narrate it.

### Tooltips and helper text

- **One sentence.** If it needs two, the UI is wrong, not the tooltip.
- **What this is, not why it exists.** "Your session score across all events this year" beats "We calculate this metric to give you visibility into your annual progression."

### Form labels and placeholders

- **Label says what.** Placeholder shows an example, not instructions.
- **Required marker is `*`, not "(required)."**
- **Validation messages are specific.** "Email is required" or "That email is already registered." Not "Invalid input."

### Modal and dialog copy

- **Headline = the question or the action.** "Delete this car?" not "Confirmation required."
- **Body = the consequence in one sentence.** "All maintenance records and tech inspection history for this car will also be deleted."
- **Buttons = the two answers.** "Delete car" and "Cancel." Not "Yes" and "No."

### Onboarding copy

- **What the user does next, first.** Not the vision statement. Not the welcome paragraph. The first thing on the screen is what they should click or type.
- **Justify after, if at all.** A one-line "why this matters" can come below the action, never above it.

---

## Documentation — patterns to apply

### README files

- **First paragraph: what this is and who it's for.** Three sentences max.
- **Second section: how to run it.** Commands the reader can copy.
- **Third section: where to find the rest.** Links to deeper docs.
- **Cut:** philosophy, history, architecture digressions, vision statements. Those go in their own files for readers who want them.

### "Getting started" guides

- **Numbered steps.** Each step has one action. The reader can put their finger on the current step and it's clear what they're doing.
- **Show the expected output after every step.** "After running this, you should see X." If they don't see X, they know to stop.
- **No "Now that you've done that..." transitions.** Just the next step.

### Reference docs (API, schema, config)

- **Name. Type. One-sentence description. Example.** That's the unit. Repeat per item.
- **Skip the framing essay.** Reference docs are looked up, not read top-to-bottom. Every paragraph above the table is a paragraph the reader has to skip.

### Conceptual docs (architecture, design rationale)

- **State the conclusion first, then the reasoning.** "We use Postgres because of X, Y, Z." Not "Database selection is a critical architectural decision that depends on many factors..."
- **One claim per paragraph.** If a paragraph has two claims, split it.
- **Name the things.** "The booking service writes to the bookings table" beats "The booking subsystem persists state to the relevant data store."

### Error pages and 404s

- **Plain: "We couldn't find that page."**
- **Action: a link back somewhere useful.**
- **No mascots, no apologies, no "Oops!"**

---

## Things to delete on sight

These are tells. When the agent finds them, they go without negotiation:

- "Simply" / "just" / "easily" — if the thing were simple/easy, you wouldn't have to say so. The reader will judge that.
- "Please note" / "It's important to note" — say the thing.
- "In order to" → "to"
- "At this time" / "currently" → drop entirely
- "We are pleased to announce" / "We are excited to" → say what you're announcing
- "Welcome to [product]" as the first words of anything — show them what to do, don't greet them
- "Robust," "powerful," "seamless," "intuitive," "world-class," "best-in-class" — if the product were these things, the reader would know
- "Leverage" → "use"
- "Utilize" → "use"
- "Architect" (as verb) → "design"
- "Solution" (when "thing" or "tool" or "feature" works) → drop or replace
- "Reach out" → "email" / "message" / "contact"
- "Going forward" → drop or replace with a date
- "Touch base," "circle back," "loop in," "ping" → use the actual verb (email, ask, include, message)
- Trailing summaries ("In summary, this component does X, Y, Z") — the doc above said it
- Apologies that aren't tied to a real error — "We apologize for any inconvenience" goes
- "Welcome aboard!" / "You're all set!" exclamations in flows — let the screen state speak

---

## Things to KEEP (do not over-correct)

The risk in a language pass is over-correcting and stripping precision. These stay:

- **Names of libraries, tools, services, protocols.** Postgres, Redis, Stripe, Auth.js, OAuth, JWT, BLE, GATT, FIT files, CSV — these are the names of things.
- **Names of the codebase's own concepts.** If the system has a "session," a "lap," a "skill tree," a "tech inspection" — those are the real names. Don't rename them in copy to sound friendlier ("driving record," "performance trail," etc.).
- **Numbers and units.** "250ms," "$49/month," "32 laps" — never round these to be friendlier.
- **Domain terminology that the reader uses.** A motorsport audience knows "apex," "trail braking," "track day." A medical audience knows "diagnosis code," "prior auth." The audience's own jargon is plain language *to them*.
- **Imperative verbs.** "Click," "select," "enter," "tap." These are precise and short. Don't replace with "you may want to consider clicking."

The line: domain terminology = precise, the user knows it. Abstract corporate vocabulary = padding, the user has to translate it.

---

## Audience calibration (read this before every pass)

The receiving project's owner is **a sharp non-technical operator**. The audience is themselves and possibly their customers. Calibrate to the *audience the project actually has*, not the audience the writer imagined.

Specifically for a project where the owner says "I barely understand my own UI text":

- The default reader is them. Write so they get it.
- Domain terms that the *customers* know stay (the customers are the experts in their own field).
- Implementation terms (database, server, deployment, auth flow) get translated unless they appear in a developer-only doc.
- Anything that sounds like a marketing brochure goes.
- Anything that sounds like a paper goes.

If the reader is the owner of the business, write to the owner of the business.

---

## A checklist for the language-pass agent

Run this checklist on every file touched. If a file fails any item, rewrite that piece.

1. **Plainest-word test.** Every abstract noun and Latin-root verb gets the senior-to-different-subdomain test. Drop or replace anything that fails.
2. **Lead with the answer.** Buttons say what they do. Error messages say what broke. Docs say what the thing is in the first sentence.
3. **No filler.** "Simply," "just," "please note," "in order to," "we are pleased," and the rest go.
4. **No corporate verbs.** "Leverage," "utilize," "architect" (verb), "operationalize," "synergize" — replace with the plain verb.
5. **No marketing adjectives.** "Robust," "seamless," "powerful," "intuitive," "world-class" — remove without replacing.
6. **No apologies.** Unless there's a real failure being acknowledged, "Sorry," "Oops," and "We apologize" go.
7. **No trailing summaries.** If the section already said it, don't say it again at the end.
8. **Numbers stay.** Don't soften "$49" to "an affordable price."
9. **Domain terms stay.** Don't translate "apex," "trail braking," "tRPC," "Drizzle" into vague plain-language equivalents — they're already precise.
10. **One claim per paragraph in docs.** Split paragraphs that bury two ideas.
11. **One action per step in guides.** No compound steps.
12. **Tooltips and helper text are one sentence.** If two are needed, the UI is the problem.
13. **Read it out loud.** If a sentence sounds like a press release or a research paper, it's wrong.

---

## Reference: this file's own writing as an example

Look at how this file is written. Domain terms (jargon, hedge, idempotent, webhook) stay where they're precise. Abstract padding ("strategic alignment," "holistic approach," "best practices") doesn't appear. Sentences are short. Lists do work the prose would have to repeat. Headers say what the section is, not how the writer feels about it.

If the rewrites the agent produces read like this file, the pass is working. If they start sounding like a marketing site or a journal article, something has slipped — re-read the rule and the test.

---

**The rule, again:** plainest word that carries the meaning. Domain terms stay. Padding goes. Test every word against "would a senior engineer explaining to a senior engineer in a different subdomain say this?" If yes, keep it. If no, it's reaching for vocabulary that sounds smart, and it goes.
