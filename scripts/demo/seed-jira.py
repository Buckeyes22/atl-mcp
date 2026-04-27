#!/usr/bin/env python3
"""Seed the PCO Jira project with epics, flagship tickets, and filler tickets.

Idempotent: skips creating an issue if one with the same summary already exists in PCO.
Reads ATLASSIAN_* env vars from the process environment (load from .env before running).
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.parse
from base64 import b64encode
from urllib.request import Request, urlopen
from urllib.error import HTTPError


SITE = os.environ["ATLASSIAN_SITE_URL"].rstrip("/")
EMAIL = os.environ["ATLASSIAN_EMAIL"]
TOKEN = os.environ["ATLASSIAN_API_TOKEN"]
PROJECT_KEY = "PCO"

ISSUE_TYPE_TASK = "10127"
ISSUE_TYPE_EPIC = "10128"
ISSUE_TYPE_SUBTASK = "10129"

AUTH = "Basic " + b64encode(f"{EMAIL}:{TOKEN}".encode()).decode()


def api(method: str, path: str, body: dict | None = None) -> dict:
    url = f"{SITE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = Request(url, data=data, method=method)
    req.add_header("Authorization", AUTH)
    req.add_header("Accept", "application/json")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urlopen(req, timeout=30) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except HTTPError as e:
        body_text = e.read().decode("utf-8", "replace")
        print(f"HTTP {e.code} on {method} {path}: {body_text[:600]}", file=sys.stderr)
        raise


def adf_doc(blocks: list) -> dict:
    """Build a top-level ADF doc node from a list of block specs."""
    return {"type": "doc", "version": 1, "content": blocks}


def adf_p(text: str) -> dict:
    return {"type": "paragraph", "content": [{"type": "text", "text": text}]}


def adf_h(level: int, text: str) -> dict:
    return {"type": "heading", "attrs": {"level": level}, "content": [{"type": "text", "text": text}]}


def adf_bullet(items: list[str]) -> dict:
    return {
        "type": "bulletList",
        "content": [
            {"type": "listItem", "content": [adf_p(item)]} for item in items
        ],
    }


def adf_code(text: str, lang: str | None = None) -> dict:
    block = {"type": "codeBlock", "content": [{"type": "text", "text": text}]}
    if lang:
        block["attrs"] = {"language": lang}
    return block


def adf_paragraphs(texts: list[str]) -> list[dict]:
    return [adf_p(t) for t in texts]


def search_existing_summaries() -> set[str]:
    """JQL-search PCO for existing summaries to make this idempotent.

    Uses the new /rest/api/3/search/jql endpoint (post-CHANGE-2046).
    Pagination is via nextPageToken, not startAt.
    """
    summaries: set[str] = set()
    next_token: str | None = None
    while True:
        body: dict = {
            "jql": f"project = {PROJECT_KEY}",
            "fields": ["summary"],
            "maxResults": 100,
        }
        if next_token:
            body["nextPageToken"] = next_token
        res = api("POST", "/rest/api/3/search/jql", body)
        for issue in res.get("issues", []):
            summaries.add(issue["fields"]["summary"])
        next_token = res.get("nextPageToken")
        if not next_token or res.get("isLast"):
            break
    return summaries


def find_issue_key_by_summary(summary: str) -> str | None:
    body = {
        "jql": f'project = {PROJECT_KEY} AND summary ~ "\\"{summary}\\""',
        "fields": ["summary"],
        "maxResults": 5,
    }
    try:
        res = api("POST", "/rest/api/3/search/jql", body)
    except HTTPError:
        return None
    for issue in res.get("issues", []):
        if issue["fields"]["summary"] == summary:
            return issue["key"]
    return None


def create_issue(
    summary: str,
    issue_type_id: str,
    description_adf: dict,
    *,
    labels: list[str] | None = None,
    components: list[str] | None = None,
    parent_key: str | None = None,
) -> str:
    fields: dict = {
        "project": {"key": PROJECT_KEY},
        "summary": summary,
        "issuetype": {"id": issue_type_id},
        "description": description_adf,
    }
    if labels:
        fields["labels"] = labels
    if components:
        fields["components"] = [{"name": c} for c in components]
    if parent_key:
        fields["parent"] = {"key": parent_key}
    res = api("POST", "/rest/api/3/issue", {"fields": fields})
    return res["key"]


def transition_to(issue_key: str, target_state: str) -> None:
    """Move issue to To Do / In Progress / Done."""
    target_state_l = target_state.lower()
    res = api("GET", f"/rest/api/3/issue/{issue_key}/transitions")
    for t in res.get("transitions", []):
        if t["to"]["name"].lower() == target_state_l:
            api("POST", f"/rest/api/3/issue/{issue_key}/transitions", {"transition": {"id": t["id"]}})
            return
    print(f"  warning: no transition to {target_state} found for {issue_key}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Epic specs (8 epics)
# ---------------------------------------------------------------------------

EPICS = [
    {
        "summary": "Runtime, Deployment, Transport (M0)",
        "labels": ["mcp", "ops"],
        "components": ["Runtime"],
        "state": "Done",
        "description_blocks": [
            adf_h(2, "Why this epic exists"),
            adf_p(
                "Implements the dual-port HTTP transport, server bootstrap, and deployable artifact (Dockerfile). "
                "Drives v6 §22 (Transport and Deployment) and is milestone M0 in v6 §28."
            ),
            adf_h(2, "Definition of done"),
            adf_bullet([
                "MCP server initializes with stdio AND streamable-HTTP transports (v6 §22).",
                "Admin REST and MCP traffic isolated on separate ports (v6 §22.2).",
                "lint:no-stdout enforced in CI (CLAUDE.md operating rule).",
                "Dockerfile produces a runnable image; docker-compose for local dev.",
            ]),
            adf_h(2, "Linked artifacts"),
            adf_bullet([
                "Code: src/mcp/, src/observability/logger.ts, scripts/lint-no-stdout.mjs",
                "Spec: v6 §22, §28 M0",
                "Tests: tests/unit/buildServer.test.ts, tests/lint/no-stdout.test.ts",
            ]),
        ],
    },
    {
        "summary": "Domain Model and Storage (M1)",
        "labels": ["security"],
        "components": ["Domain", "Storage"],
        "state": "Done",
        "description_blocks": [
            adf_h(2, "Why this epic exists"),
            adf_p(
                "Establishes the canonical domain model and the storage layer with versioned migrations. "
                "Drives v6 §10 (Domain Model) and is milestone M1 in v6 §28."
            ),
            adf_h(2, "Definition of done"),
            adf_bullet([
                "All 18 domain types defined under src/domain/ with serialization round-trips tested.",
                "Storage schema, repositories, and a migration runner with rehearsal-mode (ADR-0001).",
                "Token storage encrypted at rest via libsodium primitives (ADR-0002).",
                "Audit-entry schema includes hash-chain and signature columns (ADR-0005).",
            ]),
            adf_h(2, "Linked artifacts"),
            adf_bullet([
                "Code: src/domain/, src/storage/, src/security/tokenStore.ts",
                "Spec: v6 §10, §28 M1, §30.1",
                "ADR: ADR-0001 (pglite for dev), ADR-0002 (token encryption), ADR-0005 (audit signing)",
            ]),
        ],
    },
    {
        "summary": "Atlassian Providers + Capability Discovery (M2)",
        "labels": ["atlassian", "mcp"],
        "components": ["Providers - Atlassian", "Preflight"],
        "state": "In Progress",
        "description_blocks": [
            adf_h(2, "Why this epic exists"),
            adf_p(
                "Implements Jira and Confluence provider classes that authenticate against Atlassian Cloud, "
                "discover site capabilities (REST API versions, available macros, ADF support), and emit a preflight profile. "
                "Drives v6 §19 and is milestone M2 in v6 §28."
            ),
            adf_h(2, "Definition of done"),
            adf_bullet([
                "Jira REST v3 provider with API token auth (working).",
                "Confluence Cloud REST v2 provider with API token auth (working).",
                "OAuth 3LO flow as alternative (working).",
                "Capability discovery for Jira (project types, issue types, workflows) — open.",
                "Capability discovery for Confluence (storage format support, macro inventory) — open.",
                "Preflight profile JSON schema + emitter — open.",
            ]),
            adf_h(2, "Linked artifacts"),
            adf_bullet([
                "Code: src/providers/atlassian/, src/preflight/preflightWorkflow.ts",
                "Spec: v6 §19, §20, §22, §28 M2",
                "ADR: ADR-0003 (Confluence storage default ADF flagged)",
            ]),
        ],
    },
    {
        "summary": "VCS Provider — Bitbucket (M3)",
        "labels": ["vcs"],
        "components": ["Providers - VCS"],
        "state": "In Progress",
        "description_blocks": [
            adf_h(2, "Why this epic exists"),
            adf_p(
                "Implements the Bitbucket Cloud REST provider, app-password auth, and a per-session worktree manager "
                "for safe concurrent provisioning. Drives v6 §13 and §19; milestone M3 in v6 §28."
            ),
            adf_h(2, "Definition of done"),
            adf_bullet([
                "App-password auth with documented rotation procedure (ADR-0004).",
                "REST provider for repos, branches, commits, PRs.",
                "Per-session worktree manager (v6 §24.5).",
                "Webhook signature verification (v6 §26.2).",
            ]),
            adf_h(2, "Linked artifacts"),
            adf_bullet([
                "Code: src/providers/vcs/, src/security/webhookSignatures.ts",
                "Spec: v6 §13, §19, §24.5, §26",
                "ADR: ADR-0004 (Bitbucket app password vs OAuth)",
            ]),
        ],
    },
    {
        "summary": "Blueprint Workflow with Sampling (M4)",
        "labels": ["mcp"],
        "components": ["Domain"],
        "state": "To Do",
        "description_blocks": [
            adf_h(2, "Why this epic exists"),
            adf_p(
                "Turns a project profile into an epic-and-story blueprint via MCP sampling. "
                "Drives v6 §23 (Sampling and LLM Integration). Milestone M4 in v6 §28."
            ),
            adf_h(2, "Definition of done"),
            adf_bullet([
                "Blueprint JSON schema validates round-trip.",
                "Sampling provider chain (seat-based, API-key) per v6 §23.1.",
                "GBNF-constrained JSON optional path (v6 §23.2).",
                "Blueprint validator with adversarial verification triplet (v6 §18.1).",
            ]),
            adf_h(2, "Linked artifacts"),
            adf_bullet([
                "Code (planned): src/workflows/blueprintWorkflow.ts, src/validators/blueprintValidator.ts",
                "Spec: v6 §18, §23, §28 M4",
            ]),
        ],
    },
    {
        "summary": "Provisioning Planner + Executors (M5–M6c)",
        "labels": ["atlassian", "vcs"],
        "components": ["Providers - Atlassian", "Providers - VCS"],
        "state": "To Do",
        "description_blocks": [
            adf_h(2, "Why this epic exists"),
            adf_p(
                "Plans and executes idempotent provisioning of Jira issues, Confluence pages, and Bitbucket scaffolding. "
                "Drives v6 §18 (Write Safety) and is milestones M5, M6a, M6b, M6c in v6 §28. M6a is the first shippable slice."
            ),
            adf_h(2, "Definition of done"),
            adf_bullet([
                "Planner produces an ordered, idempotent diff against the live target.",
                "Jira executor (M6a) — first shippable slice. Creates epics + stories with retry-safe semantics.",
                "Confluence executor (M6b) — creates pages with storage/ADF dual support per ADR-0003.",
                "VCS executor (M6c) — branches + agent-context manifest + initial PR.",
                "Hunk-level review gate (v6 §18.3) — humans approve risky writes mid-execution.",
            ]),
            adf_h(2, "Linked artifacts"),
            adf_bullet([
                "Spec: v6 §18, §28 M5, §28 M6a, §28 M6b, §28 M6c",
            ]),
        ],
    },
    {
        "summary": "Audit + Policy Enforcement (M11)",
        "labels": ["security", "audit"],
        "components": ["Security"],
        "state": "In Progress",
        "description_blocks": [
            adf_h(2, "Why this epic exists"),
            adf_p(
                "Implements the policy decision layer and the hash-chained ed25519-signed audit log. "
                "Every state-changing operation gates through policy; every state change generates an audit entry. "
                "Drives v6 §7.2 and v6 §30.1. Both are mandatory for v1."
            ),
            adf_h(2, "Definition of done"),
            adf_bullet([
                "Schema for audit entries with prevHash, payloadHash, chainHash, signature, keyId.",
                "Policy decision interface and code-policy adapter.",
                "Hash linkage and ed25519 signing pipeline.",
                "Git-ref versioned key registry.",
                "Offline audit-chain verifier.",
                "Every executor wraps writes in policy-check + audit-emit.",
            ]),
            adf_h(2, "Linked artifacts"),
            adf_bullet([
                "Code: src/security/policyDecisionLayer.ts, src/security/policyAdapters/codePolicyAdapter.ts, src/storage/schema/auditEntries.ts, src/storage/repositories/policyDecisionRepository.ts",
                "Spec: v6 §7.2, §30.1, §28 M11",
                "ADR: ADR-0005 (audit signing pipeline)",
            ]),
        ],
    },
    {
        "summary": "Demo Documentation + Portfolio Packaging",
        "labels": ["demo"],
        "components": ["Demo Ops", "Docs"],
        "state": "In Progress",
        "description_blocks": [
            adf_h(2, "Why this epic exists"),
            adf_p(
                "Produces the seed Jira project, Confluence space, GitHub mirror, and tour scripts that constitute the demo portfolio. "
                "The dogfooding frame requires that the project structure itself be a generated artifact — so this epic is tracked the same as any engineering work."
            ),
            adf_h(2, "Definition of done"),
            adf_bullet([
                "Build plan finalized (docs/demo/interviewer-walkthrough.md).",
                "Seed Jira project provisioned with epics + flagship + filler tickets.",
                "Seed Confluence space provisioned with 28-page IA.",
                "Three centerpiece pages authored (Architecture, Runbook, Audit Findings).",
                "Three tour scripts authored (60s, 5min, 15min).",
                "Q&A vault, AI-honesty page, security-posture page authored.",
                "10 screenshots captured.",
                "GitHub mirror complete in docs/demo/.",
                "Mock walkthrough run-through passed.",
            ]),
            adf_h(2, "Linked artifacts"),
            adf_bullet([
                "Plan: docs/demo/interviewer-walkthrough.md",
                "Spec: this epic is meta-work outside v6 — portfolio packaging is a use of the orchestrator, not a deliverable of it.",
            ]),
            adf_p(
                "This is the punchline epic. Tracked the same as engineering work because the entire pitch is: "
                "this tool produces project structures for any kind of work — including portfolio work."
            ),
        ],
    },
]


# ---------------------------------------------------------------------------
# Flagship stories — five tickets at production depth
# ---------------------------------------------------------------------------

FLAGSHIPS = [
    {
        "summary": "Implement audit chain hash linkage with ed25519 signature",
        "epic_index": 6,  # Audit + Policy Enforcement
        "labels": ["security", "audit", "type:story"],
        "components": ["Security"],
        "state": "Done",
        "description_blocks": [
            adf_h(2, "Background"),
            adf_p(
                "The audit log is tamper-evident via two mechanisms: a SHA-256 hash chain across entries, "
                "and an ed25519 signature on each entry. The active signing key is determined by a "
                "git-ref-versioned key registry. See v6 §30.1 and ADR-0005."
            ),
            adf_h(2, "Implementation steps"),
            adf_bullet([
                "Compute prevHash = SHA-256(canonical JSON of previous entry, including its signature).",
                "Compute payloadHash = SHA-256(canonical JSON of this entry's payload).",
                "Compute chainHash = SHA-256(prevHash || payloadHash).",
                "Sign chainHash with the active ed25519 private key.",
                "Persist prevHash, payloadHash, chainHash, signature, keyId.",
            ]),
            adf_h(2, "Acceptance criteria"),
            adf_p("Given an empty audit log, when I write the first entry, then prevHash is null, chainHash equals SHA-256 of payloadHash, and signature verifies against the registered key."),
            adf_p("Given an audit log with N entries, when I write entry N+1, then prevHash equals the hash of entry N's canonical serialization including its signature, AND the verifier accepts the chain end-to-end."),
            adf_p("Given an audit log with a tampered payload at entry K, when the verifier runs, then verification fails at entry K with an error citing the chain break."),
            adf_p("Given a key rotation between entries K and K+1, when I write entry K+1, then the new entry's keyId is the new key's id, AND the verifier reads the registry git ref at the appropriate commit to validate K+1."),
            adf_p("Given the registry git ref is unavailable, when I attempt to write any entry, then the write fails closed with a logged error, NOT silently producing an unsigned entry."),
            adf_h(2, "Linked artifacts"),
            adf_bullet([
                "ADR: docs/adr/0005-audit-signing-pipeline.md",
                "Spec: v6 §30.1",
                "Code: src/storage/schema/auditEntries.ts",
                "Open question (resolved in ADR §Open questions): registry as git tag (immutable) vs branch (operationally simpler) — chose branch + log-the-rotation-event.",
            ]),
            adf_h(2, "Notes"),
            adf_p("The genesis block has prevHash=null and is signed identically. The verifier handles genesis as a special case."),
        ],
    },
    {
        "summary": "Capability discovery against Jira Cloud REST v3 with API token auth",
        "epic_index": 2,
        "labels": ["atlassian", "type:story"],
        "components": ["Providers - Atlassian", "Preflight"],
        "state": "In Progress",
        "description_blocks": [
            adf_h(2, "Background"),
            adf_p(
                "Capability discovery is the gate for v6 §2's session capability negotiation. The Jira provider must, at session start, "
                "introspect the target site for: project types in use, issue types per project, workflow definitions, and rate-limit behavior. "
                "The output is a structured preflight profile consumed downstream by the planner."
            ),
            adf_h(2, "Acceptance criteria"),
            adf_p("Given valid Atlassian API token credentials, when capability discovery runs, then the resulting JSON profile validates against the preflightProfile schema in src/domain/projectProfile.ts."),
            adf_p("Given the target site is rate-limited (HTTP 429), when discovery runs, then it retries with the Retry-After header up to 3 attempts before failing closed."),
            adf_p("Given the user lacks BROWSE_PROJECTS on a project, when discovery runs, then that project is omitted from the profile with a logged warning, NOT failing the whole discovery."),
            adf_p("Given a project uses a custom workflow with non-default statuses, when discovery runs, then those statuses appear in the profile with their canonical names."),
            adf_h(2, "Edge cases (must be tested)"),
            adf_bullet([
                "Pagination: more than 50 projects on the site.",
                "Mixed project types (next-gen + classic).",
                "OAuth 3LO mode (alternative to API token) per ADR-0004 / v6 §20.",
                "Site with custom field config that breaks default field assumptions.",
            ]),
            adf_h(2, "Linked artifacts"),
            adf_bullet([
                "Spec: v6 §2.2 (capability negotiation), §19, §21 (rate limits)",
                "Code: src/providers/atlassian/jiraProvider.ts, src/providers/http/retry.ts, src/preflight/preflightWorkflow.ts",
                "Tests: tests/unit/providers/http/retry.test.ts, tests/integration/preflight.test.ts",
            ]),
        ],
    },
    {
        "summary": "[Spike] Confluence storage format vs ADF — pick a default",
        "epic_index": 2,
        "labels": ["atlassian", "type:spike"],
        "components": ["Providers - Atlassian"],
        "state": "Done",
        "description_blocks": [
            adf_h(2, "Question being answered"),
            adf_p(
                "Confluence Cloud accepts page bodies in two formats: the legacy 'storage' format (XHTML-like) and ADF "
                "(Atlassian Document Format, a JSON tree). Which should the orchestrator use as default, and what's the cost of supporting both?"
            ),
            adf_h(2, "Constraints"),
            adf_bullet([
                "Must produce pages indistinguishable from human-authored ones at typical page complexity.",
                "Must round-trip via the API: read a page, render to chosen format, write it back unchanged.",
                "Must support tables, code blocks, info macros (the bare minimum for engineering docs).",
                "Time-boxed to two days.",
            ]),
            adf_h(2, "Outcome"),
            adf_p(
                "Decision: ADF as default with a flag to fall back to storage format. Captured in ADR-0003. "
                "ADF is JSON, easier to validate and round-trip; storage format is required for some legacy macros. "
                "Cost: dual-renderer in src/providers/atlassian/ (adf.ts + confluenceStorageRenderer.ts) and dual test paths. "
                "Honest assessment: this is the design choice with the highest ongoing operational cost in the project."
            ),
            adf_h(2, "Linked artifacts"),
            adf_bullet([
                "ADR: docs/adr/0003-confluence-storage-default-adf-flagged.md",
                "Code: src/providers/atlassian/adf.ts, src/providers/atlassian/confluenceStorageRenderer.ts",
                "Tests: tests/unit/providers/atlassian/adf.test.ts, tests/unit/providers/atlassian/confluenceStorageRenderer.test.ts",
            ]),
        ],
    },
    {
        "summary": "[Bug] lint:no-stdout misses dynamic process.stdout.write calls",
        "epic_index": 0,  # Runtime
        "labels": ["mcp", "tech-debt", "type:bug"],
        "components": ["Runtime"],
        "state": "To Do",
        "description_blocks": [
            adf_h(2, "Severity"),
            adf_p("Medium. Risk of a future regression silently corrupting the JSON-RPC stream on stdio."),
            adf_h(2, "Repro"),
            adf_p("Add a line like const w = process.stdout; w.write('test\\n'); to any file in src/. Run npm run lint:no-stdout. The lint passes."),
            adf_h(2, "Expected vs actual"),
            adf_p("Expected: lint flags any reference to process.stdout in src/ except in src/observability/logger.ts (allowlisted). Actual: lint only flags the literal token process.stdout.write — alias forms (const w = process.stdout) slip through."),
            adf_h(2, "Why this matters"),
            adf_p(
                "The CLAUDE.md operating rule (no stdout from src/) protects the JSON-RPC frames carried over stdio. "
                "A single rogue stdout write corrupts the protocol stream and breaks every connected client. "
                "The lint check exists precisely so this rule is mechanical, not vibes-based."
            ),
            adf_h(2, "Proposed fix"),
            adf_p("Replace the regex-based check in scripts/lint-no-stdout.mjs with an AST walk (TypeScript ESLint plugin) that flags any expression whose type resolves to NodeJS.WriteStream where the static binding traces to process.stdout or process.stderr."),
            adf_h(2, "Linked artifacts"),
            adf_bullet([
                "Code: scripts/lint-no-stdout.mjs",
                "Test: tests/lint/no-stdout.test.ts (must add a regression case for the alias form)",
                "Operating rule: CLAUDE.md",
            ]),
        ],
    },
    {
        "summary": "Migrate from raw SQL migrations to a runner with rehearsal",
        "epic_index": 1,
        "labels": ["security", "type:story"],
        "components": ["Storage"],
        "state": "Done",
        "description_blocks": [
            adf_h(2, "Background"),
            adf_p(
                "Initial M1 used hand-applied SQL migration files. This breaks down once the schema changes shape — "
                "you can't safely run a destructive migration in prod without rehearsing it on a snapshot first. "
                "Replaced with a migration runner that supports a 'rehearsal' mode: applies migrations to a temp database "
                "populated from a prod-shaped seed, then verifies invariants before signing off."
            ),
            adf_h(2, "Acceptance criteria"),
            adf_p("Given a new SQL migration in src/storage/migrations/, when migrationRunner runs in normal mode, then it applies the migration in order and records it in a migrations metadata table."),
            adf_p("Given the same migration, when migrationRunner runs in rehearsal mode, then it spins up a temp DB, applies all prior migrations, applies the new one, verifies post-conditions, and discards the temp DB."),
            adf_p("Given a migration that violates a rehearsal post-condition, when rehearsal runs, then it surfaces the failing condition with the affected row count, NOT just 'migration failed'."),
            adf_p("Given two concurrent runner invocations, when both attempt to apply the same migration, then exactly one succeeds and the other observes the metadata lock and exits cleanly."),
            adf_h(2, "Linked artifacts"),
            adf_bullet([
                "Code: src/storage/migrationRunner.ts, src/storage/migrations/0001_init.sql",
                "Test: tests/integration/storage/migrationRehearsal.test.ts",
                "ADR: ADR-0001 (pglite for dev — rehearsals run in pglite, not Postgres, for speed)",
                "Spec: v6 §10 (domain model implies the migration shape)",
            ]),
        ],
    },
]


# ---------------------------------------------------------------------------
# Filler tickets — lightweight stories/tasks/bugs/spikes
# Distributed across the epics to fill out the backlog and demonstrate breadth.
# ---------------------------------------------------------------------------

FILLERS = [
    # Runtime (M0) — already done; add 4 historical
    ("Bootstrap MCP server with stdio transport", 0, ["mcp", "type:story"], ["Runtime"], "Done"),
    ("Wire pino file logger and rotate by size", 0, ["mcp", "ops", "type:story"], ["Runtime", "Observability"], "Done"),
    ("Add lint:no-stdout check to CI pipeline", 0, ["mcp", "type:task"], ["Runtime"], "Done"),
    ("Dockerfile: minimal Node 20 alpine image with non-root user", 0, ["ops", "type:task"], ["Runtime"], "Done"),

    # Domain + Storage (M1) — done; add 7
    ("Define ProjectProfile domain type with capability fields", 1, ["type:story"], ["Domain"], "Done"),
    ("Define ContextPack domain type with token-budget fields", 1, ["type:story"], ["Domain"], "Done"),
    ("Define AuditEntry schema with hash-chain columns", 1, ["security", "audit", "type:story"], ["Domain", "Storage"], "Done"),
    ("Implement repository pattern for projects/profiles", 1, ["type:story"], ["Storage"], "Done"),
    ("Add token-encryption layer with libsodium primitives", 1, ["security", "type:story"], ["Security", "Storage"], "Done"),
    ("Round-trip serialization tests for all domain types", 1, ["type:task"], ["Domain"], "Done"),
    ("[Spike] pglite vs sqlite vs full Postgres for dev", 1, ["type:spike"], ["Storage"], "Done"),

    # Atlassian providers (M2) — in progress; add 6 (excluding the flagship)
    ("Confluence REST v2 provider (read path)", 2, ["atlassian", "type:story"], ["Providers - Atlassian"], "Done"),
    ("OAuth 3LO auth flow for Atlassian", 2, ["atlassian", "security", "type:story"], ["Providers - Atlassian", "Security"], "Done"),
    ("Actor-attribution metadata on impersonated calls", 2, ["atlassian", "audit", "type:story"], ["Providers - Atlassian"], "Done"),
    ("Capability discovery for Confluence (macros + storage)", 2, ["atlassian", "type:story"], ["Providers - Atlassian", "Preflight"], "In Progress"),
    ("Preflight profile JSON schema + emitter", 2, ["mcp", "type:story"], ["Preflight"], "In Progress"),
    ("[Bug] Pagination cursor in Confluence v2 silently truncates at 250 entries", 2, ["atlassian", "type:bug"], ["Providers - Atlassian"], "To Do"),

    # VCS provider (M3) — in progress; add 4
    ("Bitbucket app-password auth with documented rotation", 3, ["vcs", "security", "type:story"], ["Providers - VCS"], "Done"),
    ("Bitbucket REST: repos / branches / commits / PRs", 3, ["vcs", "type:story"], ["Providers - VCS"], "Done"),
    ("Per-session worktree manager (concurrency safety)", 3, ["vcs", "queue", "type:story"], ["Providers - VCS"], "In Progress"),
    ("Webhook signature verification (HMAC-SHA256)", 3, ["vcs", "security", "type:story"], ["Security"], "Done"),

    # Blueprint workflow (M4) — todo; add 5
    ("Blueprint JSON schema with Zod validators", 4, ["mcp", "type:story"], ["Domain"], "To Do"),
    ("MCP sampling provider chain (seat-based + API-key)", 4, ["mcp", "type:story"], ["Domain"], "To Do"),
    ("[Spike] GBNF-constrained JSON for blueprint emission", 4, ["mcp", "type:spike"], ["Domain"], "To Do"),
    ("Adversarial verification triplet for blueprint outputs", 4, ["mcp", "security", "type:story"], ["Domain", "Security"], "To Do"),
    ("Token-budget enforcement on context packs (v6 §16.1)", 4, ["mcp", "type:story"], ["Domain"], "To Do"),

    # Provisioning (M5–M6c) — todo; add 7
    ("Provisioning planner — diff against live state", 5, ["atlassian", "vcs", "type:story"], ["Providers - Atlassian", "Providers - VCS"], "To Do"),
    ("Jira executor (M6a — first shippable slice)", 5, ["atlassian", "type:story"], ["Providers - Atlassian"], "To Do"),
    ("Confluence executor (M6b)", 5, ["atlassian", "type:story"], ["Providers - Atlassian"], "To Do"),
    ("VCS executor (M6c) with per-session worktree", 5, ["vcs", "queue", "type:story"], ["Providers - VCS"], "To Do"),
    ("Hunk-level review gate for risky writes", 5, ["security", "type:story"], ["Security"], "To Do"),
    ("Idempotency keys + retry-safe semantics", 5, ["atlassian", "vcs", "type:story"], ["Providers - Atlassian", "Providers - VCS"], "To Do"),
    ("[Bug] Race in planner when two sessions provision overlapping namespaces", 5, ["atlassian", "type:bug"], ["Providers - Atlassian"], "To Do"),

    # Audit + Policy (M11) — in progress; add 5 (excluding the flagship)
    ("Policy decision interface and code-policy adapter", 6, ["security", "type:story"], ["Security"], "Done"),
    ("Git-ref versioned key registry for audit signing", 6, ["security", "audit", "type:story"], ["Security"], "In Progress"),
    ("Offline audit-chain verifier (CLI tool)", 6, ["security", "audit", "type:story"], ["Security"], "To Do"),
    ("Wrap every executor in policy-check + audit-emit", 6, ["security", "audit", "type:story"], ["Security"], "To Do"),
    ("[Spike] Per-tenant key isolation runway (v6 §7.3)", 6, ["security", "audit", "type:spike"], ["Security"], "To Do"),

    # Demo Ops — in progress; add 4
    ("Author docs/demo/architecture.md centerpiece", 7, ["demo", "type:story"], ["Demo Ops", "Docs"], "In Progress"),
    ("Author docs/demo/runbook.md centerpiece", 7, ["demo", "type:story"], ["Demo Ops", "Docs"], "In Progress"),
    ("Author docs/demo/audit-remediation-summary.md", 7, ["demo", "type:story"], ["Demo Ops", "Docs"], "In Progress"),
    ("Capture 10 numbered screenshots from live Atlassian", 7, ["demo", "type:task"], ["Demo Ops"], "In Progress"),

    # Cross-cutting bugs and tech debt
    ("[Bug] Storage migration rehearsal can't represent vacuumed-row schemas", 1, ["tech-debt", "type:bug"], ["Storage"], "To Do"),
    ("[Bug] Token store doesn't rotate the master encryption key", 1, ["security", "tech-debt", "type:bug"], ["Security", "Storage"], "To Do"),
    ("[Bug] ADF renderer drops nested table cells on round-trip", 2, ["atlassian", "type:bug"], ["Providers - Atlassian"], "To Do"),
    ("[Bug] OAuth 3LO refresh races with concurrent calls", 2, ["atlassian", "security", "type:bug"], ["Providers - Atlassian", "Security"], "To Do"),
    ("[Spike] Hatchet vs in-tree job queue (v6 §24.7)", 5, ["queue", "type:spike"], ["Domain"], "To Do"),

    # Won't Do candidates (transitioned to Done with explicit Won't-Do label)
    ("Add OAuth 1.0 support for Atlassian", 2, ["atlassian", "security", "wont-do", "type:story"], ["Providers - Atlassian", "Security"], "Done"),
    ("Replace pino with bunyan for log compatibility", 0, ["ops", "wont-do", "type:task"], ["Observability"], "Done"),
    ("Vendor-lock Confluence storage format (drop ADF)", 2, ["atlassian", "wont-do", "type:task"], ["Providers - Atlassian"], "Done"),
]


# ---------------------------------------------------------------------------
# Subtasks — sparingly within flagship stories to show implementation breakdown
# ~13 across the 5 flagships (matches the build plan's "~10" intent).
# ---------------------------------------------------------------------------
# Tuple shape: (parent_summary, summary, description_paragraph, state)

SUBTASKS = [
    # ----- PCO-9: Implement audit chain hash linkage with ed25519 signature (Done) -----
    (
        "Implement audit chain hash linkage with ed25519 signature",
        "Add hash-chain columns to auditEntries schema",
        "Add prevHash, payloadHash, chainHash, signature, keyId, ts columns to the auditEntries Drizzle schema. Migration in src/storage/migrations/. Acceptance: schema round-trips; existing entries unaffected; new column defaults documented.",
        "Done",
    ),
    (
        "Implement audit chain hash linkage with ed25519 signature",
        "Implement chain_hash + ed25519 signing pipeline",
        "Implement the chain_hash = SHA-256(prev_hash || payload_hash) computation and ed25519 signing using @noble/curves. Resolve active key from registry git ref. Acceptance: round-trip seal/verify works; tampered entry fails verification at the chain break.",
        "Done",
    ),
    (
        "Implement audit chain hash linkage with ed25519 signature",
        "Build offline audit-chain verifier CLI",
        "scripts/audit-verify.mjs walks the chain in order, recomputes each chain_hash, validates each signature against the registered public key. Reports first-failed entry with specific failure mode (chain break / signature invalid / key unknown).",
        "To Do",
    ),

    # ----- PCO-10: Capability discovery against Jira Cloud REST v3 (In Progress) -----
    (
        "Capability discovery against Jira Cloud REST v3 with API token auth",
        "Implement Jira capability probe set",
        "GET /rest/api/3/myself for auth verification, /rest/api/3/project/<key>?expand=... for project capabilities, /rest/api/3/issuetype/project/{projectId}, /rest/api/3/workflowscheme/project. Compose into ProjectProfile JSON. Acceptance: end-to-end discovery against sandbox returns valid profile.",
        "Done",
    ),
    (
        "Capability discovery against Jira Cloud REST v3 with API token auth",
        "Add 429 retry path with exponential backoff",
        "Wrap provider HTTP client with retry-on-429 honoring Retry-After header. Max 3 attempts with backoff 1s, 4s, 16s plus jitter. Acceptance: synthetic 429-then-success path covered by unit test in tests/unit/providers/http/retry.test.ts.",
        "Done",
    ),
    (
        "Capability discovery against Jira Cloud REST v3 with API token auth",
        "Add ProjectProfile warnings array + emitter",
        "Each probe accumulates non-fatal warnings (missing custom field, custom workflow status, etc.) into a structured warnings[] field on the profile. Operator-visible. Acceptance: warnings render in mgmt-API response without breaking happy path.",
        "In Progress",
    ),

    # ----- PCO-11: [Spike] Confluence storage format vs ADF (Done) -----
    (
        "[Spike] Confluence storage format vs ADF — pick a default",
        "Build round-trip fixtures for both body formats",
        "Test fixtures for ADF and storage format covering: tables, code blocks, info macros, nested lists. Round-trip each through the Confluence v2 API; diff output against input. Document lossiness per format.",
        "Done",
    ),
    (
        "[Spike] Confluence storage format vs ADF — pick a default",
        "Document tradeoff matrix",
        "Comparison: format, ergonomics, macro coverage, round-trip stability, ongoing operational cost. Output: a one-page tradeoff matrix that informed the ADR decision.",
        "Done",
    ),
    (
        "[Spike] Confluence storage format vs ADF — pick a default",
        "Draft ADR-0003 with chosen default + flag rationale",
        "MADR-format ADR documenting: ADF as default, storage format as flag-gated fallback, dual-renderer cost accepted. Link round-trip fixtures and tradeoff matrix as evidence.",
        "Done",
    ),

    # ----- PCO-12: [Bug] lint:no-stdout misses dynamic process.stdout.write calls (To Do) -----
    (
        "[Bug] lint:no-stdout misses dynamic process.stdout.write calls",
        "Add regression test for alias-form pattern",
        "Test fixture under tests/lint/no-stdout.test.ts that includes `const w = process.stdout; w.write('test')` in a synthetic source file. Test should FAIL initially (proving the bug exists) and PASS after the fix.",
        "To Do",
    ),
    (
        "[Bug] lint:no-stdout misses dynamic process.stdout.write calls",
        "Replace regex check with TypeScript ESLint AST walk",
        "Rewrite scripts/lint-no-stdout.mjs to use a TypeScript ESLint visitor that flags any expression whose static binding traces to process.stdout or process.stderr. Allowlist src/observability/logger.ts. Acceptance: regression test passes; no new false positives in existing src/.",
        "To Do",
    ),

    # ----- PCO-13: Migrate from raw SQL migrations to a runner with rehearsal (Done) -----
    (
        "Migrate from raw SQL migrations to a runner with rehearsal",
        "Implement migrationRunner with metadata + advisory lock",
        "src/storage/migrationRunner.ts: applies migrations from src/storage/migrations/ in order, records in _migrations metadata table, holds Postgres advisory lock during apply to prevent concurrent runners. Acceptance: idempotent re-apply; concurrent runner attempts cleanly serialize.",
        "Done",
    ),
    (
        "Migrate from raw SQL migrations to a runner with rehearsal",
        "Implement rehearsal-mode (temp DB + post-conditions)",
        "Rehearsal applies pending migration to a temp DB seeded from prod-shaped snapshot, runs post-condition assertions, tears down. Required before any production apply. Acceptance: tests/integration/storage/migrationRehearsal.test.ts covers rehearsal-pass and rehearsal-fail paths.",
        "Done",
    ),
]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print(f"Seeding Jira project {PROJECT_KEY}...", flush=True)
    existing = search_existing_summaries()
    print(f"  {len(existing)} existing issue summaries (skipping these)", flush=True)

    epic_keys: list[str] = []

    for epic in EPICS:
        summary = epic["summary"]
        if summary in existing:
            key = find_issue_key_by_summary(summary)
            if key:
                print(f"  epic exists: {key}  {summary}")
                epic_keys.append(key)
                continue
        try:
            key = create_issue(
                summary,
                ISSUE_TYPE_EPIC,
                adf_doc(epic["description_blocks"]),
                labels=epic.get("labels"),
                components=epic.get("components"),
            )
            print(f"  created epic: {key}  {summary}")
            target_state = epic.get("state")
            if target_state and target_state != "To Do":
                transition_to(key, target_state)
            epic_keys.append(key)
        except Exception as e:
            print(f"  FAILED to create epic '{summary}': {e}", file=sys.stderr)
            epic_keys.append(None)

    # Flagship stories
    for fs in FLAGSHIPS:
        summary = fs["summary"]
        if summary in existing:
            print(f"  flagship exists: {summary}")
            continue
        epic_key = epic_keys[fs["epic_index"]]
        if not epic_key:
            print(f"  skipping flagship (no epic): {summary}", file=sys.stderr)
            continue
        try:
            key = create_issue(
                summary,
                ISSUE_TYPE_TASK,
                adf_doc(fs["description_blocks"]),
                labels=fs.get("labels"),
                components=fs.get("components"),
                parent_key=epic_key,
            )
            print(f"  created flagship: {key}  {summary}")
            target_state = fs.get("state")
            if target_state and target_state != "To Do":
                transition_to(key, target_state)
        except Exception as e:
            print(f"  FAILED flagship '{summary}': {e}", file=sys.stderr)

    # Filler tickets
    for summary, epic_idx, labels, components, state in FILLERS:
        if summary in existing:
            print(f"  filler exists: {summary}")
            continue
        epic_key = epic_keys[epic_idx]
        if not epic_key:
            print(f"  skipping filler (no epic): {summary}", file=sys.stderr)
            continue
        # Lightweight description: one paragraph stub.
        desc_blocks = [adf_p(f"Filler ticket for breadth coverage. See parent epic {epic_key} for context. Linked v6 spec sections live on the parent epic.")]
        try:
            key = create_issue(
                summary,
                ISSUE_TYPE_TASK,
                adf_doc(desc_blocks),
                labels=labels,
                components=components,
                parent_key=epic_key,
            )
            print(f"  created filler: {key}  {summary}")
            if state and state != "To Do":
                transition_to(key, state)
        except Exception as e:
            print(f"  FAILED filler '{summary}': {e}", file=sys.stderr)

    # Subtasks — nested under flagship stories
    # Refresh existing summaries so subtask idempotency works after the first pass.
    existing = search_existing_summaries()
    for parent_summary, sub_summary, sub_desc, state in SUBTASKS:
        if sub_summary in existing:
            print(f"  subtask exists: {sub_summary}")
            continue
        parent_key = find_issue_key_by_summary(parent_summary)
        if not parent_key:
            print(f"  skipping subtask (parent not found: {parent_summary!r}): {sub_summary}", file=sys.stderr)
            continue
        try:
            key = create_issue(
                sub_summary,
                ISSUE_TYPE_SUBTASK,
                adf_doc([adf_p(sub_desc)]),
                parent_key=parent_key,
            )
            print(f"  created subtask: {key}  (parent {parent_key})  {sub_summary}")
            if state and state != "To Do":
                transition_to(key, state)
        except Exception as e:
            print(f"  FAILED subtask '{sub_summary}': {e}", file=sys.stderr)

    print("Done.", flush=True)


if __name__ == "__main__":
    main()
