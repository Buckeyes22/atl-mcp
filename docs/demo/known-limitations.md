# Known Limitations

> **Mirror of** [`ACO/Known Limitations`](https://lateapexllc.atlassian.net/wiki/spaces/ACO). Things this system explicitly does not do well, with rationale and (where applicable) the milestone or ticket where it gets fixed.

## Single-tenant only

The audit chain key registry, the token store, and the storage schema are all single-tenant. Multi-tenant runway is documented in v6 §7.3 and tracked as [PCO-51](https://lateapexllc.atlassian.net/browse/PCO-51) (spike). This is the most significant limitation for "could you ship this to prod with multiple customers?"

## Atlassian-only (in v1)

Bitbucket Cloud only for v1. GitHub, GitLab, and Bitbucket Data Center / Server are post-v1 (v6 §3 non-goals). The provider abstraction at [`src/providers/Provider.ts`](../../src/providers/Provider.ts) is designed to add new VCS providers, but capacity is not.

## No persistent agent memory

This is a context provider, not an agent memory store. Per-session memory is the agent's responsibility (v6 §4 non-goals; see [`docs/partners/hindsight.md`](../partners/hindsight.md) for the considered approach).

## Workflow has 3 statuses, not 5

The seed Jira project (PCO) uses Jira's next-gen Kanban template, which provides To Do / In Progress / Done. The original plan called for 5 statuses (Backlog / Ready / In Progress / Review / Done). Adapted because customizing the workflow is theater unless wired to gating logic. The Definition of Ready and Definition of Done pages serve the gating role instead.

## Master key rotation requires manual drill

The token store does not rotate the master encryption key cleanly. [PCO-57](https://lateapexllc.atlassian.net/browse/PCO-57) documents the long-term fix (envelope encryption with per-row data keys). Workaround: master key rotation requires a re-encrypt drill (documented in the runbook, Incident C).

## Lint gap on stdout aliases

[PCO-12](https://lateapexllc.atlassian.net/browse/PCO-12) documents that `lint:no-stdout` doesn't catch alias forms (`const w = process.stdout`). Replacement is an AST-walk lint instead of regex. Severity is medium because the literal form (which IS caught) is the path normal coding takes.

## ADF round-trip incomplete

[PCO-58](https://lateapexllc.atlassian.net/browse/PCO-58) documents that the ADF renderer drops nested table cells on round-trip. Affects pages with deeply-nested tables. Workaround: keep tables flat in generated content; an editor's manual edits with nested tables will round-trip lossily.

## Confluence v2 space-create endpoint had a validation bug

When seeding ACO, `POST /wiki/api/v2/spaces` returned 400 with "Representation cannot be null" despite the request including a valid `description.plain.representation`. Fell back to v1 (`POST /wiki/rest/api/space`). Documented in audit findings F-13. Will revisit when v2 stabilizes.

## No Bitbucket credentials in this environment

Bitbucket app-password / OAuth credentials weren't loaded in the demo environment, so the VCS executor (M6c) couldn't run live during the seed. The Jira and Confluence sides of the dogfooding loop are complete; the VCS side is design-only until those credentials are wired. No code change required — just env vars.
