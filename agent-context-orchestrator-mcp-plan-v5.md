# Agent Context Orchestrator MCP Server — Project Plan (v5)


## 0. v5 Review Summary and Material Changes

v4 is a strong and buildable plan. v5 keeps the same mission, architecture, and milestone shape, but resolves the three open items left by Claude and tightens a few current MCP/Atlassian implementation details that will matter when Codex starts writing code.

Material changes from v4:

1. Add a session capability registry and adaptive feature exposure. The server records the client protocol version, client info, and client capabilities during MCP initialization, then gates sampling, elicitation, completions, resource subscriptions, and optional task-style behavior on what was actually negotiated for that session.
2. Fix the Rovo MCP endpoint in configuration. The upstream Rovo provider uses `https://mcp.atlassian.com/v1/mcp` for Streamable HTTP. Legacy HTTP+SSE endpoints are not a default path and are not used for upstream Rovo integration.
3. Clarify the formal policy-engine decision. v1 uses a small `PolicyDecisionLayer` interface backed by code-based policy checks, Zod validation, write guards, preview approvals, and the access gate. OPA/Rego or Cedar adapters are planned post-v1 when a second or third deployment proves the need for declarative policy.
4. Add a multi-tenant SaaS runway without making v1 SaaS. v1 remains single-tenant per deployment, but the persistence model carries `tenantId = "default"`, repository calls require a tenant scope, vector collections and secret paths are tenant-scoped, and the SaaS admin plane plus Postgres RLS remain post-v1 work.
5. Require structured tool outputs. High-level workflow tools declare `outputSchema` and return `structuredContent` that conforms to it, while also returning a short text summary for older or less capable clients.
6. Make model/tokenizer selection fully configurable. Examples no longer rely on a hard-coded future model name; the context-pack token budget is computed against the configured build-agent target.
7. Add Codex/Claude client notes as generated docs. The repo emits `docs/codex.md` and `docs/claude-code.md` with MCP setup, tool approval, elicitation, and transport guidance, but the server does not assume that every host supports elicitation or subscriptions.

Material changes v4 made to v3, preserved and endorsed here:

1. Declare target MCP spec versions. The server explicitly targets a stable MCP spec version and lists optional or draft capabilities behind flags so client compatibility is knowable.
2. Design the access-control gate for cached and vectorized context. Because downstream-token pass-through is prohibited, the gate runs in one of three modes — single-user local, remote re-check per read, or cached-ACL with webhook-triggered invalidation — each with explicit failure behavior.
3. Specify actor attribution for service-account and OAuth-app writes. When the server uses a server-owned credential to create a Jira issue, a Confluence page, or a PR, it records the originating MCP principal as a label/fingerprint, metadata block, and audit entry so the trail survives the identity hop.
4. Extend preflight. The preflight profile covers vector-store connectivity, embedding endpoint reachability, webhook registration state, TTL, and invalidation triggers.
5. Export preflight results to telemetry. Structured-log and OTel-span emission of preflight warnings make operational patterns across projects observable.
6. Add webhook delivery idempotency. Atlassian and Bitbucket deliver at least once; dedup uses provider event ID where available and payload hash otherwise.
7. Specify a default Rovo MCP allowlist. Search and fetch-by-ID only; writes and administrative calls are blocked by default.
8. Split Milestone 6. M6a is Jira provisioning, M6b is Confluence provisioning, M6c is VCS branch+PR provisioning. The first shippable slice terminates at M6a.
9. Use non-deprecated Jira create-meta endpoints: `/rest/api/3/issue/createmeta/{projectIdOrKey}/issuetypes` and `/rest/api/3/issue/createmeta/{projectIdOrKey}/issuetypes/{issueTypeId}`.
10. Resource pagination. MCP resources that enumerate many items support server-side filtering and pagination.

Material changes v3 made to v2, preserved and endorsed here:

1. Preflight and capability discovery before provisioning, with a stored `ProjectProfile` consumed by the planner.
2. Confluence rendering defaults to `body.representation = "storage"`; `atlas_doc_format` is optional behind a feature flag and compatibility tests for the target site. Jira rich-text fields continue to use ADF.
3. Pass-through of MCP-client downstream tokens is prohibited. Server-owned OAuth 2.0/2.1 flows, server-owned API token, or service-account/bot credentials are the supported auth modes; standards-based token exchange is reserved for enterprise deployments that need it.
4. Tool annotations for every tool (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) as UI hints, not enforcement.
5. Elicitation support for clarification and approval, with non-elicitation fallbacks and an explicit prohibition on using elicitation to collect secrets.
6. Access-control gate before returning cached, summarized, or vector-retrieved content.
7. VCS writes are branch-and-PR-first by default.
8. Operational states: `VALIDATION_FAILED`, `DRIFT_DETECTED`, `ARCHIVED`. Drift affects readiness.
9. Atlassian Rovo MCP is an optional upstream read-only provider only, accessed through the current Streamable HTTP `/v1/mcp` endpoint.
10. The first shippable slice is narrowed below the full plan.

## 1. Mission

Build an MCP server that turns raw project requirements into an agent-ready Atlassian workspace. The system creates and maintains the Confluence, Jira, and VCS context that implementation agents need to begin work with minimal ambiguity.

The server is not primarily a Jira/Confluence/Bitbucket API wrapper. It is an orchestration layer that accepts project requirements, converts them into a normalized project blueprint, generates a linked Confluence documentation tree and a Jira issue hierarchy, prepares VCS repository context and agent instructions, builds task-level context packs reachable through MCP resources, validates that the project is ready for implementation agents, and keeps the context graph synchronized as pages, issues, and code evolve through a push-based webhook pipeline.

The server is build-agent-agnostic. Codex and Claude Code are reference integration targets; other MCP-capable agents are supported through the same surface.

## 2. Strategic Design Decision

Use an orchestration MCP server, not an Atlassian MCP clone.

Atlassian already ships a Rovo MCP server for Jira, Confluence, Compass, and Bitbucket Cloud. This project sits above that layer and owns the higher-level workflow: project intake, artifact generation, traceability, readiness validation, context-pack assembly, and agent handoff.

The architecture is a hybrid provider model. Direct Atlassian REST APIs are used for provisioning, idempotent writes, custom field handling, dry-run diffs, and exact payload control. Rovo MCP is used optionally for semantic search and read-only retrieval where available and allowed, and is explicitly never used on write paths. Provider interfaces stay abstract so the server can switch between direct REST, Rovo MCP, mocks, or Data Center adapters later.

The Rovo MCP provider is an upstream provider implementation, not a tool surface exposed transitively to build agents. The orchestrator does not mirror all upstream Rovo tools into its own MCP tool list because that would recreate tool sprawl and weaken safety boundaries. If Rovo is enabled, calls are mediated through typed provider methods with explicit allowlists and audit records. The default Rovo allowlist covers read and search operations only — specifically, Rovo tools equivalent to Jira issue search, Jira issue fetch, Confluence content search, Confluence page fetch, and cross-product semantic search. Writes, administrative operations, and anything outside the allowlist are blocked unless explicitly extended in configuration. Use Atlassian's Streamable HTTP `/mcp` endpoint for Rovo; do not depend on legacy SSE endpoints.

### Target MCP spec version

The server declares support for a stable MCP specification version in its server info. As of 2026-04-24, the latest published MCP specification is `2025-11-25`, and Milestone 0 should target it when the TypeScript SDK and reference hosts support it. If either reference host or the SDK lags, the server may initially negotiate `2025-06-18`, but the compatibility matrix must record the fallback and must keep newer features behind flags. Draft or opt-in capabilities — for example, MCP Tasks for long-running operations — are enabled only behind feature flags and are not relied upon in the default configuration.

### Session capability negotiation and adaptive feature exposure

MCP initialization is not just a version check. The server records a `McpSessionProfile` for each session containing the negotiated protocol version, client info, client capabilities, enabled server features, and disabled feature reasons. The server then follows these rules:

1. Only send `sampling/createMessage` requests when the client advertised sampling and the current workflow is tied to an originating request that permits sampling.
2. Only send elicitation requests when the client advertised elicitation and Codex/Claude policy allows elicitation prompts to surface. Otherwise, return a structured approval or clarification request through normal tool output.
3. Only advertise task-style execution metadata when the server feature flag is enabled, the negotiated protocol supports it, and the client capabilities indicate task support. Job resources remain the default long-running-operation mechanism.
4. Only advertise completions when the server implements `completion/complete` and declares the `completions` capability.
5. Only emit resource update notifications to sessions that subscribed to the resource and only when the server declared `resources.subscribe`.
6. Never hide safety-critical fallback tools just because a client lacks an optional feature. For example, `approval_request` remains available; its behavior adapts to the session.

A diagnostic resource, `orchestrator://session/current/capabilities`, exposes the current session profile for debugging and support. The compatibility matrix in Section 36 records, per server release and per reference client, which features are expected to work: elicitation, resource subscriptions, Streamable HTTP, completion, task-style execution, and host-delegated sampling.

## 3. Assumptions for the First Build

These assumptions are safe defaults. Each is configurable rather than hard-coded.

Atlassian Cloud is the first target. Bitbucket Cloud is the first VCS target; Bitbucket Data Center and Bitbucket Server are out of scope for MVP because their REST APIs differ substantially from Bitbucket Cloud and would require a separate adapter. Codex and Claude Code are first-class reference agents; neither is privileged in the design. The MCP server is built in TypeScript on Node.js 22+. Confluence, Jira, and Bitbucket Cloud are the sources of truth. The orchestrator stores metadata, trace links, readiness state, checksums, pinned source versions, and optional generated summaries; it does not store full Atlassian content by default. All write operations support dry-run mode and high-impact writes require a preview result before execution. One Atlassian site, one Jira project, one Confluence space, and one VCS workspace/repo are sufficient for MVP. Multi-site, multi-repo, and multi-tenant support are planned. The server supports both stdio and Streamable HTTP transports from MVP. SSE fallback is optional and temporary for downstream clients that still require it; it must not be used as the default upstream Rovo integration path. Local development can run with SQLite plus an in-memory queue, while deployed mode uses Postgres, Redis/BullMQ, and Qdrant.

Preflight capability discovery can run at any point after intake capture; it does not require a complete blueprint. Running preflight early is preferred because the intake and blueprint prompts can then incorporate profile warnings (for example, "the target Jira project lacks the Epic issue type, decomposition will collapse Epic into Story parents"). Preflight is still mandatory before `PROVISIONING_PREVIEWED` and is re-verified before `PROVISIONED`.

## 4. Non-Goals for MVP

The following are explicitly out of scope for v1: building a general AI project manager; replacing Jira, Confluence, or Bitbucket as systems of record; shipping a full Atlassian Marketplace app; fine-tuning a model; allowing agents to make silent destructive changes; requiring custom Jira workflows; solving every company-specific project-management convention on day one; and providing human-in-the-loop UI beyond approval prompts surfaced through the MCP host.

Also out of scope for the first shippable slice: automatic deletion/cleanup of remote artifacts, default-branch VCS commits, automatic merges, cross-tenant SaaS hosting, full Jira workflow customization, relying on cached/vector content without a fresh access check, and Bitbucket Data Center / Server support.

## 5. Core User Flow

```text
Raw requirements
  -> intake (optionally via UIO document extraction)
  -> preflight capability discovery (early)
  -> clarification questions and assumptions
  -> normalized project blueprint
  -> preflight re-verification
  -> Confluence documentation tree
  -> Jira epic/story/task hierarchy
  -> VCS repo preparation (generated branch + PR)
  -> context graph and cross-links
  -> readiness validation
  -> task-level agent context packs
  -> build agents begin implementation
```

Webhook-driven change data capture runs in parallel once the project is PROVISIONED, keeping the context graph current without requiring agent polling.

## 6. Project State Machine

```text
DRAFT_INTAKE
  -> CLARIFICATION_NEEDED
  -> BLUEPRINT_READY
  -> PREFLIGHT_PASSED
  -> PROVISIONING_PREVIEWED
  -> PROVISIONED
  -> LINKED
  -> VALIDATED
  -> READY_FOR_BUILD

Any active state
  -> VALIDATION_FAILED
  -> DRIFT_DETECTED
  -> ARCHIVED
```

State meanings. `DRAFT_INTAKE` indicates requirements captured but not normalized. `CLARIFICATION_NEEDED` indicates missing information or conflicting assumptions. `BLUEPRINT_READY` indicates a structured project blueprint exists. `PREFLIGHT_PASSED` indicates the server has verified required Jira, Confluence, VCS, auth, permission, vector-store, and webhook capabilities. `PROVISIONING_PREVIEWED` indicates a dry-run plan for Atlassian/VCS writes has been produced. `PROVISIONED` indicates pages, issues, and repo artifacts have been created. `LINKED` indicates cross-links among Jira, Confluence, and VCS have been created and verified. `VALIDATED` indicates readiness checks have passed or produced approved waivers. `READY_FOR_BUILD` indicates agents can fetch task-specific context packs and begin work. `VALIDATION_FAILED` indicates readiness checks failed without waivers. `DRIFT_DETECTED` indicates generated artifacts were changed outside the orchestrator or source pins are stale. `ARCHIVED` indicates the project is intentionally no longer active.

## 7. High-Level Architecture

```text
MCP Host / Agent (Codex, Claude Code, other)
        |
        v
Agent Context Orchestrator MCP Server
 |-- Transports: stdio, Streamable HTTP (optional temporary SSE fallback)
 |-- MCP Tools: intake, preflight, blueprint, preview, provision, validate, context, handoff
 |-- MCP Resources: manifest, context, readiness, trace-map, task packs (paginated)
 |-- MCP Prompts: intake, decomposition, handoff, validation
 |-- MCP Sampling client: LLM calls delegated to host model
 |-- MCP Elicitation client: clarification and approval requests where supported
 |-- MCP Session Capability Registry
 |
 |-- Domain Orchestration Engine
 |-- Project Blueprint Builder
 |-- Capability/Profile Discovery Engine
 |-- Artifact Planner
 |-- Context Graph Store (relational)
 |-- Vector Store (semantic retrieval)
 |-- Readiness Validator
 |-- Context Pack Builder
 |-- Access-Control Gate for cached/vector context
 |-- Policy Decision Layer (code-based MVP; OPA/Cedar adapters planned) and Write Guards
 |-- Renderer Registry (Jira ADF, Confluence storage, optional Confluence ADF)
 |-- Audit Log (tamper-evident)
 |-- Job Queue Worker (provisioning, sync, validation)
 |-- Webhook Ingress (Atlassian + VCS CDC, with delivery dedup)
 |-- Notification Dispatcher
 |
 |-- Provider Interfaces
       |-- Atlassian Capability Discovery Provider
       |-- Jira REST Provider (direct, ADF for Jira rich-text fields)
       |-- Confluence REST Provider (v2, storage representation by default)
       |-- Vcs Provider
       |     |-- Bitbucket Cloud REST Adapter (MVP)
       |     |-- GitHub REST Adapter (planned)
       |     |-- GitLab REST Adapter (planned)
       |-- Notification Provider
       |     |-- Slack Adapter
       |     |-- Teams Adapter
       |-- Optional Atlassian Rovo MCP Provider (read-only, allowlisted)
       |-- Mock Provider (tests)
```

### Access-control gate for cached and vectorized context

Because the server authenticates to Atlassian with credentials it obtained and manages itself (service account, API token, or a per-user OAuth 3LO token stored by the orchestrator) rather than blindly passing through MCP-client tokens, a cache or vector hit cannot implicitly inherit the caller's permissions. The gate enforces one of three modes, selected by configuration and declared in the `ProjectProfile`. Shared deployments should prefer per-user OAuth 3LO. Service-account-only shared deployments must either operate under an explicit shared-principal policy or fail closed for cached/vectorized private content.

Mode A — single-user local. The gate is disabled. All cache and vector hits are returned without re-checking. This mode is intended for single-user homelab and development deployments and is refused when the server is running multi-user.

Mode B — remote re-check per read. Every cache or vector hit is verified by a lightweight read against Atlassian using the caller's linked downstream credential when available, or by an approved provider-specific permission check when the deployment has the required admin scope. This mode is authoritative but adds latency and quota cost. It is the default for shared deployments until mode C is populated. If no caller-bound downstream credential or admin-grade permission-check path exists, the read fails closed unless the deployment is explicitly configured as a shared-principal environment.

Mode C — cached ACL with webhook-triggered invalidation. The server records per-artifact access decisions observed in prior reads and returns cache hits based on the stored ACL. Webhook events that signal permission changes (Jira permission scheme edits, Confluence space permission edits, project role changes) invalidate the affected ACL entries. Unknown principals or ACL entries older than the configured staleness window fall through to mode B. Mode C is used when remote-check cost is prohibitive.

The gate's failure behavior is fail-closed. A gate timeout, a provider error, or an ambiguous ACL result denies the cache hit and returns either a mode-B live read or an access-denied response, logged to audit.

### Policy decision layer

v1 does not ship a full declarative policy engine. It ships a narrow `PolicyDecisionLayer` interface with a code-based adapter. Every tool call, resource read, provisioning action, access-gate decision, and waiver request is evaluated through that interface. The initial adapter is implemented in TypeScript and composes Zod schema validation, actor/principal checks, tenant scope checks, write guards, preview approval state, access-gate output, and project-state constraints.

The interface returns one of three effects: `allow`, `deny`, or `require_approval`, plus reasons and obligations. Obligations are concrete server-side requirements such as `requirePreview`, `requireFreshPreflight`, `requireNonDirtyContextPack`, `requireHumanWaiver`, or `requireSandboxOnly`. These obligations are enforced by the workflow layer and cannot be satisfied by tool arguments alone.

OPA/Rego and Cedar are explicitly post-v1 adapters. They should be added only when deployments need policy maintained by security/platform teams outside the application code. The interface exists now so the migration does not require rewriting every tool and workflow.

### Multi-tenant SaaS runway

v1 remains single-tenant per deployment. However, v1 should not paint the project into a corner. The storage layer carries a `tenantId` field with default value `default`; repository methods require a `TenantScope`; Qdrant collections, secret paths, webhook dedup keys, audit records, and actor fingerprints are tenant-scoped; and tests verify that repository methods cannot be called without an explicit tenant scope.

The following remain post-v1: SaaS admin plane, tenant provisioning UI/API, tenant-level billing, cross-tenant organization management, Postgres row-level security policies, per-tenant Qdrant cluster decisions, tenant-aware rate-limit budgets, tenant-scoped support tooling, and customer-facing audit export. When SaaS hosting becomes real, Postgres RLS is required rather than optional, and the app-level tenant filter becomes defense in depth.


## 8. Repository Structure

```text
agent-context-orchestrator/
  package.json
  tsconfig.json
  README.md
  AGENTS.md
  CLAUDE.md
  .cursor/rules/
  .env.example
  Dockerfile
  docker-compose.yml
  src/
    server.ts
    config.ts
    transport/
      stdio.ts
      http.ts
    mcp/
      registerTools.ts
      registerResources.ts
      registerPrompts.ts
      sampling.ts
      elicitation.ts
      subscriptions.ts
      sessionCapabilities.ts
      capabilityAwareRegistration.ts
      schemas.ts
    domain/
      projectBlueprint.ts
      projectGraph.ts
      artifactPlan.ts
      projectProfile.ts
      readiness.ts
      contextPack.ts
      traceLinks.ts
      relevance.ts
    workflows/
      intakeWorkflow.ts
      blueprintWorkflow.ts
      provisioningWorkflow.ts
      validationWorkflow.ts
      syncWorkflow.ts
      webhookWorkflow.ts
    queue/
      worker.ts
      jobs/
        provisionJob.ts
        syncJob.ts
        validateJob.ts
        webhookJob.ts
    providers/
      Provider.ts
      atlassian/
        auth/
          oauth3lo.ts
          apiToken.ts
          serviceAccount.ts
          actorAttribution.ts
          tokenStore.ts
        capabilityDiscovery.ts
        jiraRestProvider.ts
        confluenceRestProvider.ts
        rovoMcpProvider.ts
        rovoAllowlist.ts
        adf.ts
        confluenceStorageRenderer.ts
        confluenceAdfRenderer.ts
        storageFormat.ts
        rateLimit.ts
        pagination.ts
      vcs/
        VcsProvider.ts
        bitbucket/
          bitbucketRestProvider.ts
        github/
          githubRestProvider.ts
      notification/
        NotificationProvider.ts
        slackProvider.ts
        teamsProvider.ts
    storage/
      db.ts
      tenantScope.ts
      migrations/
      repositories/
        projectRepository.ts
        graphRepository.ts
        auditRepository.ts
        jobRepository.ts
        tokenRepository.ts
        aclRepository.ts
      vector/
        qdrantClient.ts
        chunker.ts
        embedder.ts
    webhooks/
      ingress.ts
      atlassianHandlers.ts
      vcsHandlers.ts
      signatureVerification.ts
      deliveryDedup.ts
    security/
      redaction.ts
      injectionScanner.ts
      permissions.ts
      writeGuards.ts
      policyDecision.ts
      policyAdapters/
        codePolicyAdapter.ts
      accessGate.ts
      toolAnnotations.ts
      auditChain.ts
    observability/
      logger.ts
      telemetry.ts
      langfuseTracer.ts
      preflightTelemetry.ts
    evals/
      datasets/
      judges/
      runners/
    validators/
      blueprintValidator.ts
      jiraValidator.ts
      confluenceValidator.ts
      vcsValidator.ts
    utils/
      stableIds.ts
      tokenBudget.ts
      confluenceProperties.ts
      markdown.ts
      links.ts
      pagination.ts
  tests/
    unit/
    contract/
    integration/
    conformance/
    evals/
    fixtures/
  docs/
    architecture.md
    operations.md
    deployment.md
    context-pack-schema.md
    auth.md
    webhooks.md
    access-gate.md
    policy.md
    multi-tenancy.md
    codex.md
    claude-code.md
```

## 9. Technology Choices

### MVP stack

The implementation language is TypeScript on Node.js 22+. The MCP SDK is the official Model Context Protocol TypeScript SDK. Schema validation uses Zod v4 or another Standard Schema-compatible validator supported by the SDK. HTTP uses undici with a retry and rate-limit wrapper. Relational storage is SQLite for local MVP and Postgres 16+ for deployed versions; migrations use drizzle. The queue provider is abstract: local development can use an in-memory queue, while deployed mode uses BullMQ backed by Redis 7+. The vector store is Qdrant, deployed either as the existing homelab instance or a project-scoped instance. Embeddings use BGE-M3 via a local inference endpoint or a hosted embedding API, selected by config. Structured logging uses pino. Tests use vitest. Observability exports OpenTelemetry spans and traces to Langfuse for any sampling call or context-pack assembly.

### Storage policy

The orchestrator database stores tenant IDs, project IDs, Jira issue keys and IDs, Confluence page IDs and versions, VCS workspace/repo slugs and commit SHAs, blueprint versions, trace links, readiness results, content checksums, pinned source versions, observed ACL entries for mode-C access gating, audit records with hash-chain linkage, session capability profiles, policy decisions, and optional generated summaries. Full Atlassian content is not stored by default. The vector store holds chunked, embedded representations of requirements documents, ADRs, selected Confluence pages, and repo README/CONTRIBUTING content for relevance ranking during context pack assembly.

### Secret and token storage

API tokens, OAuth access tokens, and OAuth refresh tokens are encrypted at rest using envelope encryption. Acceptable implementations include libsodium `secretbox`/XChaCha20-Poly1305 with a deployment key from a secrets manager, or a cloud/Vault KMS data-key envelope. Sealed-box primitives are public-key constructs and are not appropriate for a deployment-secret model; do not use them for this purpose. Tokens are never written to logs or audit records. The audit record stores the auth-mode identifier and a truncated token fingerprint only.

### Capability discovery and preflight profile

Before any live provisioning, the server must run `project_preflight_check`. The result is stored as a `ProjectProfile` and used by the planner. The profile includes Jira project type and management mode, available issue types, required fields, parent/hierarchy behavior, available issue link types, components, versions, custom field IDs that are safe to write, Confluence space ID, page-create/update permission, supported Confluence body representations, VCS default branch, branch protection, webhook registration state, CI provider, vector-store connectivity and collection existence, embedding endpoint reachability, auth capability (OAuth scopes granted, service-account roles), and maximum safe request budget.

The planner fails fast if the profile is missing or stale. A profile is stale when its TTL has expired or when an invalidation event has been recorded against it. The default TTL ceiling is 7 days, configurable down to 1 hour. Invalidation events include: a webhook signalling a Jira permission scheme change, a webhook signalling a Confluence space permission change, an auth token rotation, a VCS branch protection change recorded through a VCS webhook, and an explicit `project_preflight_check` call with `forceRefresh: true`. Preflight does not create or update remote artifacts.

Preflight warnings are emitted as structured log records (`orchestrator.preflight.warning`) and as OTel span events on the `orchestrator.preflight.discover` span. Warning attributes include the affected target (`jira`, `confluence`, `vcs`, `vector`, `auth`), the capability code, severity, and a stable warning ID. This makes cross-project operational patterns observable in aggregate — for example, service accounts that consistently lack a required Jira permission across sites.

## 10. Domain Model

```ts
export type ProjectState =
  | "DRAFT_INTAKE"
  | "CLARIFICATION_NEEDED"
  | "BLUEPRINT_READY"
  | "PREFLIGHT_PASSED"
  | "PROVISIONING_PREVIEWED"
  | "PROVISIONED"
  | "LINKED"
  | "VALIDATED"
  | "READY_FOR_BUILD"
  | "VALIDATION_FAILED"
  | "DRIFT_DETECTED"
  | "ARCHIVED";

export interface ProjectBlueprint {
  id: string;
  tenantId: string;   // default: "default" for single-tenant v1
  name: string;
  key: string;
  state: ProjectState;
  schemaVersion: number;
  blueprintVersion: number;
  goals: string[];
  nonGoals: string[];
  stakeholders: Stakeholder[];
  requirements: Requirement[];
  features: Feature[];
  epics: EpicPlan[];
  architecture: ArchitecturePlan;
  risks: Risk[];
  openQuestions: OpenQuestion[];
  testingStrategy: TestingStrategy;
  securityPrivacy: SecurityPrivacyPlan;
  releasePlan: ReleasePlan;
  sourcePins: SourcePin[];
  projectProfileId?: string;
}

export interface ProjectProfile {
  id: string;
  tenantId: string;
  projectId: string;
  generatedAt: string;
  expiresAt: string;
  accessGateMode: "local" | "remote_check" | "cached_acl";
  jira: JiraProjectProfile;
  confluence: ConfluenceSpaceProfile;
  vcs: VcsRepoProfile;
  vector: VectorStoreProfile;
  auth: AuthCapabilityProfile;
  webhooks: WebhookRegistrationProfile;
  warnings: ProfileWarning[];
}

export interface ProfileWarning {
  id: string;
  target: "jira" | "confluence" | "vcs" | "vector" | "auth" | "webhooks";
  code: string;
  severity: "info" | "warn" | "error";
  message: string;
}

export interface SourcePin {
  artifactRef: ArtifactRef;
  version: string;        // Confluence page version, Jira updated timestamp, Git SHA
  contentChecksum: string;
  pinnedAt: string;
}

export interface Requirement {
  id: string;
  title: string;
  description: string;
  type: "functional" | "non_functional" | "constraint" | "assumption";
  priority: "must" | "should" | "could" | "wont";
  acceptanceSignals: string[];
  sourceRefs: SourceRef[];
}

export interface EpicPlan {
  id: string;
  title: string;
  outcome: string;
  stories: StoryPlan[];
  confluenceRefs: string[];
  dependencies: string[];
}

export interface StoryPlan {
  id: string;
  title: string;
  userStory: string;
  acceptanceCriteria: string[];
  implementationNotes: string[];
  testNotes: string[];
  contextRefs: string[];
  dependencies: string[];
  estimatedComplexity: "S" | "M" | "L" | "XL";
}

export interface TraceLink {
  id: string;
  tenantId: string;
  projectId: string;
  source: ArtifactRef;
  target: ArtifactRef;
  relation:
    | "defines"
    | "implements"
    | "depends_on"
    | "documents"
    | "tests"
    | "references"
    | "blocks"
    | "annotates";
}

export interface ContextPack {
  id: string;
  tenantId: string;
  projectId: string;
  issueKey?: string;
  title: string;
  summary: string;
  goals: string[];
  nonGoals: string[];
  acceptanceCriteria: string[];
  implementationPlan: string[];
  testPlan: string[];
  linkedArtifacts: ArtifactRef[];
  relevantFiles: RepoFileRef[];
  risks: Risk[];
  openQuestions: OpenQuestion[];
  tokenBudget: TokenBudgetReport;
  sourcePins: SourcePin[];
  generatedAt: string;
  regenerationKey: string;   // deterministic seed for reproducible regeneration
  freshness: "current" | "stale" | "dirty";
  accessDecision: "allowed" | "denied" | "requires_remote_check";
}

export interface TokenBudgetReport {
  targetModel: string;
  budgetTokens: number;
  usedTokens: number;
  sections: { name: string; tokens: number; truncated: boolean }[];
}

export interface AclEntry {
  tenantId: string;
  projectId: string;
  artifactRef: ArtifactRef;
  principalId: string;
  decision: "allowed" | "denied";
  observedAt: string;
  source: "jira_permission_check" | "confluence_content_permission" | "vcs_repo_permission";
}

export interface McpSessionProfile {
  id: string;
  tenantId: string;
  protocolVersion: string;
  clientInfo: { name: string; title?: string; version?: string };
  clientCapabilities: {
    roots: boolean;
    sampling: boolean;
    elicitation: boolean;
    tasks: boolean;
  };
  enabledServerFeatures: string[];
  disabledFeatureReasons: Record<string, string>;
  createdAt: string;
  lastSeenAt: string;
}

export interface PolicyDecision {
  effect: "allow" | "deny" | "require_approval";
  reasons: string[];
  obligations: PolicyObligation[];
  evaluatedAt: string;
}

export interface PolicyObligation {
  kind:
    | "require_preview"
    | "require_fresh_preflight"
    | "require_human_approval"
    | "require_access_gate_allow"
    | "require_non_dirty_context"
    | "require_sandbox_target"
    | "require_tenant_scope";
  message: string;
}
```

## 11. Generated Confluence Structure

For every orchestrated project, generate or maintain this page tree.

```text
Project Home
  00 - Project Brief
  01 - Product Requirements
  02 - Scope and Non-Goals
  03 - Stakeholders and Roles
  04 - User Journeys
  05 - Functional Requirements
  06 - Non-Functional Requirements
  07 - Domain Model and Glossary
  08 - Architecture Overview
  09 - Component Specifications
  10 - API and Data Contracts
  11 - Security and Privacy Requirements
  12 - Testing Strategy
  13 - Release and Rollout Plan
  14 - Risks, Assumptions, and Open Questions
  15 - ADR Index
  16 - Agent Build Guide
  17 - Context Map
```

Each generated page carries required metadata: stable orchestrator artifact ID, blueprint version, schema version, generated timestamp, related Jira issue links, related VCS repo/path links, status (draft, reviewed, ready), and owner/steward. Metadata is stored primarily in Confluence content properties and labels, with a small human-visible metadata block in the page body. Page bodies are generated against Confluence v2 REST using `PageBodyWrite`; the default representation is `storage` because it is the documented create/update path. `atlas_doc_format` support is optional and must be feature-flagged until compatibility is proven against the target site. Jira rich-text fields still use ADF through the Jira renderer.

## 12. Generated Jira Structure

MVP hierarchy is Epic → Story → Task as a logical model, not a hard-coded Jira assumption. The project profile maps this logical hierarchy to the target Jira project's available issue types and parent-link behavior. A later hierarchy option supports Initiative → Epic → Story → Task/Sub-task when the target Jira configuration supports it.

Each generated Jira issue contains summary, description in ADF, acceptance criteria, definition of ready, definition of done, context pack URI, Confluence context links, VCS repo/path links, dependencies, risks, open questions, labels, component, priority, a "Generated By: Agent Context Orchestrator" marker, blueprint version, and actor attribution (see Section 20). The artifact planner probes project type (`projectTypeKey`), management mode (`simplified`), create metadata, required fields, safe custom fields, link types, components, and hierarchy behavior before generating payloads. Team-managed projects skip custom-field-scheme-dependent writes; company-managed projects use the full discovered field set only when the field is present and safe to write.

Suggested labels include `agent-ready`, `generated-by-context-orchestrator`, `needs-human-review`, `blocked-by-open-question`, `architecture-required`, `security-review-required`, `test-plan-required`, and an actor-attribution label `orchestrator-actor-<principal>`.

## 13. Generated VCS Artifacts

For a new or existing repository, the VCS provider generates or updates a common set of files, with CI configuration specialized per provider. By default, all generated VCS changes are written to a generated branch and proposed through a pull request. Direct commits to the default branch require an explicit configuration override and a separate approval path.

```text
README.md
AGENTS.md
CLAUDE.md
CONTRIBUTING.md
.bitbucket/pull-request-template.md     # when provider is Bitbucket Cloud
.github/PULL_REQUEST_TEMPLATE.md        # when provider is GitHub
.cursor/rules/project.mdc
bitbucket-pipelines.yml                 # when provider is Bitbucket Cloud and CI is required
.github/workflows/ci.yml                # when provider is GitHub and CI is required
docs/
  agent-context/
    manifest.yaml
    project-brief.md
    architecture-summary.md
    task-index.md
    readiness-report.md
  adr/
    0001-initial-architecture.md
```

`AGENTS.md`, `CLAUDE.md`, and `.cursor/rules/project.mdc` are generated from a single canonical source to preserve parity across build agents. `docs/agent-context/manifest.yaml` is the authoritative agent manifest.

### Example `docs/agent-context/manifest.yaml`

```yaml
project:
  id: pco-123
  key: PCO
  name: Agent Context Orchestrator
  blueprintVersion: 1
  schemaVersion: 1

atlassian:
  jira:
    projectKey: PCO
    issueSearch: 'project = PCO ORDER BY Rank ASC'
  confluence:
    spaceKey: PCO
    homePageTitle: Project Home

vcs:
  provider: bitbucket_cloud
  workspace: example-workspace
  repoSlug: agent-context-orchestrator

contextResources:
  projectManifest: orchestrator://project/pco-123/manifest
  projectContext: orchestrator://project/pco-123/context
  readinessReport: orchestrator://project/pco-123/readiness
  taskContextTemplate: orchestrator://issue/{issueKey}/context

agentRules:
  alwaysRead:
    - AGENTS.md
    - docs/agent-context/manifest.yaml
    - docs/agent-context/project-brief.md
  beforeImplementing:
    - fetch the Jira issue context pack
    - check linked Confluence pages
    - check acceptance criteria and test plan
    - confirm no blocking open questions
```

## 14. MCP Surface Area

### Design principle

Three MCP primitive types are exposed intentionally. Resources serve read-only context and support subscriptions for change notifications. Tools expose workflow actions and writes; they are kept high-level to avoid agent overload. Prompts codify repeatable agent workflows and are versioned alongside the blueprint schema. Tool outputs are structured by default: tools that return machine-actionable data declare `outputSchema`, populate `structuredContent`, and include a concise text summary for clients that only render text.

### Tools

| Tool | Purpose | Side Effects |
|---|---|---:|
| `project_preflight_check` | Discover and validate Jira, Confluence, VCS, vector, auth, permission, webhook, and rate-limit capabilities before planning. | local DB only |
| `project_profile_get` | Return the current preflight/capability profile and staleness status. | none |
| `session_capabilities_get` | Return the current MCP session profile and feature-gating decisions. | none |
| `project_intake_create` | Capture raw requirements or a UIO document reference and create a draft project record. | local DB only |
| `project_blueprint_generate` | Convert requirements into a normalized blueprint using host-delegated sampling. | local DB only |
| `project_blueprint_update` | Apply human-approved changes to the blueprint. | local DB only |
| `project_provision_preview` | Produce a dry-run write plan for Confluence/Jira/VCS with request-count estimate. Requires a non-stale project profile. | none |
| `project_provision_execute` | Enqueue an approved provisioning job and return a job handle. | writes Atlassian and VCS |
| `project_sync` | Force a reconciliation read of Atlassian and VCS artifacts and refresh the graph. | local DB only |
| `context_pack_generate` | Generate project-level or issue-level context packs with hybrid relevance ranking. | local DB optional |
| `context_get` | Return bounded context for an issue, epic, or project. | none |
| `readiness_validate` | Validate whether the project or issue is build-ready against the weighted rubric. | local DB only |
| `artifact_annotate` | Attach metadata to a blueprint artifact — trace links, decision records, or open questions — discriminated by `kind`. | local DB and optional Atlassian |
| `handoff_generate` | Generate a build-agent handoff for one Jira issue, targeting Codex, Claude Code, or a generic agent. | none |
| `approval_request` | Ask the user to approve a high-impact action through MCP elicitation when supported, otherwise return a structured approval request. | none |

### Resource URI scheme

```text
orchestrator://session/current/capabilities
orchestrator://project/{projectId}/manifest
orchestrator://project/{projectId}/profile
orchestrator://project/{projectId}/blueprint
orchestrator://project/{projectId}/context
orchestrator://project/{projectId}/readiness
orchestrator://project/{projectId}/trace-map
orchestrator://project/{projectId}/job/{jobId}
orchestrator://issue/{issueKey}/context
orchestrator://issue/{issueKey}/handoff
orchestrator://issue/{issueKey}/acceptance-criteria
orchestrator://issue/{issueKey}/linked-artifacts
orchestrator://repo/{workspace}/{repoSlug}/agent-guide
```

Resources support `resources/subscribe` and emit `notifications/resources/updated` when the underlying graph entry changes due to webhook ingestion or sync completion. `resources/templates/list` is implemented for discoverability. `completion/complete` is implemented for prompt arguments that reference project keys and issue keys.

Resources that can enumerate many items — notably `trace-map`, `linked-artifacts`, the job list under a project, and any future issue-enumeration resource — accept query-string filters (`?since=`, `?kind=`) and pagination cursors (`?cursor=`, `?limit=`). Server responses include a `nextCursor` field when more pages are available. Subscribed clients continue to receive updates scoped to the filter they originally supplied.

### Prompts

| Prompt | Purpose |
|---|---|
| `project-intake-interview` | Ask concise questions needed to complete missing requirements. |
| `requirements-decomposer` | Convert raw requirements into features, epics, stories, and risks. |
| `architecture-review` | Review the blueprint for missing technical decisions. |
| `jira-story-writer` | Produce implementation-ready story descriptions and acceptance criteria. |
| `confluence-page-writer` | Produce standardized Confluence pages from blueprint sections. |
| `readiness-reviewer` | Review an issue or project against the readiness rubric. |
| `build-agent-handoff` | Generate a bounded implementation handoff for any compliant build agent. |
| `post-implementation-sync` | Summarize changes and update context after implementation. |

Prompts carry a `promptVersion` field. When a prompt version is bumped, dependent context packs are marked as eligible for regeneration but are not invalidated automatically.

### Tool annotations and approval hints

Every MCP tool declares annotations. Suggested defaults:

| Tool group | `readOnlyHint` | `destructiveHint` | `idempotentHint` | `openWorldHint` |
|---|---:|---:|---:|---:|
| Read-only context/profile/readiness tools | true | false | true | false |
| Preview/planning tools | true | false | true | false |
| Local DB update tools | false | false | true | false |
| Provisioning/write tools | false | false | true | true |
| Explicit destructive tools, if ever added | false | true | false | true |

Annotations are advisory hints, not a substitute for the policy decision layer, write guards, preview approval, or server-side access checks. For workflow tools, `outputSchema` is required and must match `structuredContent`; contract tests validate this.

## 15. Example Tool Schema

```ts
export const ProjectPreflightCheckSchema = z.object({
  projectId: z.string(),
  targets: z.array(z.enum(["jira", "confluence", "vcs", "vector", "auth", "webhooks"])).default([
    "jira",
    "confluence",
    "vcs",
    "vector",
    "auth",
    "webhooks",
  ]),
  forceRefresh: z.boolean().default(false),
});

export const ProjectProvisionPreviewSchema = z.object({
  projectId: z.string(),
  targets: z.array(z.enum(["confluence", "jira", "vcs"])).default([
    "confluence",
    "jira",
    "vcs",
  ]),
  mode: z.enum(["create_missing", "update_existing", "full_reconcile"]).default("create_missing"),
  includeDestructiveChanges: z.boolean().default(false),
});

export const ProjectProvisionExecuteSchema = z.object({
  projectId: z.string(),
  previewId: z.string(),
  approved: z.literal(true),
  idempotencyKey: z.string(),
  notifyOnCompletion: z.array(z.enum(["slack", "teams"])).optional(),
});

export const ArtifactAnnotateSchema = z.object({
  projectId: z.string(),
  kind: z.enum(["trace_link", "decision_record", "open_question"]),
  payload: z.union([TraceLinkInputSchema, DecisionRecordInputSchema, OpenQuestionInputSchema]),
  writeThrough: z.array(z.enum(["jira", "confluence", "vcs"])).default([]),
});

export const ProjectProvisionPreviewOutputSchema = z.object({
  previewId: z.string(),
  projectId: z.string(),
  tenantId: z.string(),
  profileId: z.string(),
  actions: z.array(z.object({
    target: z.enum(["jira", "confluence", "vcs"]),
    action: z.enum(["create", "update", "noop", "blocked"]),
    artifactStableId: z.string(),
    summary: z.string(),
    requestEstimate: z.number().int().nonnegative(),
    policyDecision: z.enum(["allow", "deny", "require_approval"]),
  })),
  estimatedRequests: z.number().int().nonnegative(),
  requiresApproval: z.boolean(),
  warnings: z.array(ProfileWarningSchema).default([]),
});
```

## 16. Context Pack Design

A context pack is the primary thing implementation agents consume. Context packs are bounded, traceable to source artifacts, specific to one issue/epic/workflow, explicit about goals and non-goals, explicit about acceptance criteria, explicit about risks and open questions, linked to Confluence/Jira/VCS sources, and deterministically regeneratable from pinned source versions. Every context pack carries a freshness state: `current`, `stale`, or `dirty`. Agents may use stale packs only when the handoff explicitly allows it; dirty packs block readiness.

### Token budgeting

Context packs are budgeted in tokens against the target model's tokenizer, not in characters. The budget is partitioned into reserved sections and optional expandable sections. A typical partition for a configured large-context build-agent target reserves 800 tokens for required objective and acceptance criteria, 1,200 tokens for linked-artifact summaries, 2,000 tokens for implementation notes, and the remainder for expandable content (code snippets, Confluence excerpts). When the expandable section would exceed budget, content is ranked by a hybrid score (trace-link hop distance as a hard filter, embedding similarity against the issue summary as the ranking signal) and truncated from the lowest-scored end.

### Source version pinning

Each context pack records pinned versions of every source it references: Confluence page version IDs, Jira issue `updated` timestamps, and VCS commit SHAs. The `regenerationKey` field combines a hash of the pins with the prompt version. Regenerating a pack with identical pins and identical prompt version produces identical output, subject to sampling temperature set to 0 where the underlying model supports it.

### Relevance ranking

The context pack builder collects candidate sources through trace-link traversal up to a configured depth, then ranks them by cosine similarity between a query embedding (the issue summary plus acceptance criteria) and precomputed chunk embeddings in Qdrant. The top-k scored chunks are included until the token budget is exhausted. Chunks outside the trace-link set are never included, preventing unrelated content leakage. Before a chunk from cached or vectorized content is returned, the access-control gate (Section 7) verifies that the requesting principal can still access the underlying artifact under the deployment's configured gate mode.

### Example task context pack

```md
# Context Pack: PCO-42 - Implement Confluence Page Provisioner

## Objective
Implement the Confluence page provisioning workflow for generated project documentation.

## Scope
- Create missing pages from the artifact plan.
- Update pages that have matching orchestrator artifact IDs.
- Preserve manual edits when possible.
- Store page IDs and versions in the project graph.

## Non-Goals
- Do not create new Confluence spaces in this task.
- Do not implement Jira issue creation in this task.

## Acceptance Criteria
- Given a dry-run artifact plan, the tool creates the expected page tree.
- Re-running the same plan is idempotent.
- Existing generated pages are updated, not duplicated.
- Manual pages without orchestrator IDs are not overwritten.
- Unit and integration tests pass.

## Freshness
- Current: true
- Source pins verified: true
- Dirty artifacts: none

## Required Context
- Confluence REST Provider interface
- ArtifactPlan model
- ProjectGraph repository
- Confluence storage-format renderer utilities

## Linked Artifacts
- Jira: PCO-42 (updated: 2026-04-22T10:14:00Z)
- Confluence: Architecture Overview (v7), Agent Build Guide (v3)
- VCS: src/providers/atlassian/confluenceRestProvider.ts @ 4f1c9ab

## Test Plan
- Mock provider test for page tree creation.
- Snapshot test for generated page bodies.
- Integration test against sandbox space when credentials are present.

## Token Budget
- Target: configured-build-agent-model
- Budget: 32000
- Used: 18430
- Truncated sections: none
```

## 17. Readiness Rubric

A project is `READY_FOR_BUILD` only when the weighted score meets threshold or exceptions have approved waivers.

### Project-level readiness (weighted)

Each check carries a weight and an evidence type. Mechanical evidence is verified programmatically (field presence, length threshold, link resolvability). Semantic evidence is verified by an LLM judge prompt against a rubric.

| Check | Weight | Evidence |
|---|---:|---|
| Project brief exists | 5 | mechanical |
| Goals and non-goals are documented | 5 | mechanical |
| Stakeholders are documented | 3 | mechanical |
| Preflight profile exists and is not stale | 8 | mechanical |
| Requirements are decomposed into epics/stories/tasks | 10 | mechanical |
| All epics have related Confluence context | 8 | mechanical |
| All stories have acceptance criteria (testable) | 15 | semantic |
| Architecture overview exists | 8 | mechanical |
| Domain model or glossary exists | 5 | mechanical |
| Testing strategy exists | 5 | semantic |
| Security/privacy requirements documented or N/A marked | 8 | mechanical |
| Risks and open questions tracked | 5 | mechanical |
| VCS repo context exists | 5 | mechanical |
| Agent manifest and AGENTS.md/CLAUDE.md exist | 5 | mechanical |
| Context map links are resolvable | 8 | mechanical |
| No blocking open questions | 10 | mechanical |
| No dirty generated artifacts or unresolved drift | 8 | mechanical |

### Issue-level readiness (weighted)

| Check | Weight | Evidence |
|---|---:|---|
| Clear objective | 10 | semantic |
| Scope and non-goals | 10 | semantic |
| Acceptance criteria present and testable | 20 | semantic |
| Test plan present | 15 | semantic |
| Links to relevant Confluence pages | 10 | mechanical |
| Links to repo paths or explicit "unknown" marker | 10 | mechanical |
| Dependencies documented | 10 | mechanical |
| No blocking open questions | 10 | mechanical |
| Context pack available through MCP | 5 | mechanical |

### Readiness score

```text
90-100: Ready for autonomous agent implementation
75-89:  Ready with human review
50-74:  Needs planning work
0-49:   Not ready
```

Weights are configurable per project type via profile (infra, web-app, data-pipeline). Waivers carry an actor, timestamp, reason, and expiration.

## 18. Write Safety and Idempotency

All write tools follow a fixed pattern. The server reads current remote state, builds desired state, produces a dry-run diff, returns the diff to the agent/user, requires explicit `approved: true` and `previewId` to execute, enqueues the write job with an idempotency key, executes through provider interfaces, stores resulting artifact IDs and checksums, validates links, and writes a tamper-evident audit entry.

MVP write operations never delete Jira issues, delete Confluence pages, delete branches, merge pull requests, force-push, write directly to the default branch without explicit override, overwrite pages without matching orchestrator metadata, or expose secrets in generated context. These are enforced at the `writeGuards` layer and cannot be bypassed by tool arguments.

## 19. Provider Interfaces

```ts
export interface CapabilityDiscoveryProvider {
  discoverProjectProfile(input: DiscoverProjectProfileInput): Promise<ProjectProfile>;
  verifyProfile(profileId: string): Promise<ProjectProfileVerificationResult>;
}

export interface JiraProvider {
  getProject(projectKey: string): Promise<JiraProject | null>;
  searchIssues(jql: string, options?: PageOptions): Promise<Page<JiraIssue>>;
  createIssue(input: CreateJiraIssueInput): Promise<JiraIssue>;
  updateIssue(issueKey: string, input: UpdateJiraIssueInput): Promise<JiraIssue>;
  linkIssues(input: LinkIssuesInput): Promise<void>;
  addRemoteLink(issueKey: string, input: RemoteLinkInput): Promise<void>;

  // Create-meta uses the non-deprecated variant:
  // GET /rest/api/3/issue/createmeta/{projectIdOrKey}/issuetypes
  // GET /rest/api/3/issue/createmeta/{projectIdOrKey}/issuetypes/{issueTypeId}
  getCreateMetaIssueTypes(projectKey: string): Promise<JiraCreateMetaIssueType[]>;
  getCreateMetaFields(projectKey: string, issueTypeId: string): Promise<JiraCreateMetaField[]>;

  getIssueLinkTypes(): Promise<JiraIssueLinkType[]>;
}

export interface ConfluenceProvider {
  getSpace(spaceKey: string): Promise<ConfluenceSpace | null>;
  getPageByTitle(spaceKey: string, title: string, parentId?: string): Promise<ConfluencePage | null>;
  createPage(input: CreateConfluencePageInput): Promise<ConfluencePage>;
  updatePage(pageId: string, input: UpdateConfluencePageInput): Promise<ConfluencePage>;
  addLabels(pageId: string, labels: string[]): Promise<void>;
  getContentProperties(pageId: string): Promise<Record<string, unknown>>;
  setContentProperty(pageId: string, key: string, value: unknown): Promise<void>;
  supportsBodyRepresentation(representation: "storage" | "atlas_doc_format"): Promise<boolean>;
}

export interface VcsProvider {
  readonly providerName: "bitbucket_cloud" | "github" | "gitlab";
  getRepository(workspace: string, repoSlug: string): Promise<VcsRepo | null>;
  createRepository(input: CreateRepositoryInput): Promise<VcsRepo>;
  getFile(workspace: string, repoSlug: string, path: string, ref?: string): Promise<string | null>;
  putFiles(input: PutFilesInput): Promise<CommitResult>;
  createPullRequest(input: CreatePullRequestInput): Promise<PullRequest>;
  getWebhookSignatureVerifier(): (headers: Record<string, string>, body: string) => boolean;
}

export interface NotificationProvider {
  readonly channel: "slack" | "teams";
  send(input: NotificationInput): Promise<void>;
}
```

## 20. Authentication and Configuration

### Auth modes

The server supports three modes. API token auth (email + token) is the simplest and suitable for single-user homelab deployments. OAuth 2.0 3LO is required for normal multi-user direct-REST deployments and supports PKCE flow with refresh token rotation. Service-account/bot auth is allowed for controlled automation when paired with explicit policy restrictions, actor attribution, and approval gates.

Do not implement raw downstream-token pass-through from an MCP client to Atlassian or VCS APIs. The MCP client authenticates to the orchestrator; the orchestrator separately authenticates to Atlassian/VCS using credentials issued for that downstream service. If a future enterprise deployment needs user-context propagation without storing user refresh tokens, use a standards-based token-exchange or delegated authorization pattern only when the downstream provider supports the correct audience and actor semantics.

Tokens in all modes are encrypted at rest using the same envelope-encryption policy described in Section 9. Tokens are never logged. Audit records store the auth-mode identifier and a truncated token fingerprint only.

### Actor attribution

Because the server writes to Atlassian and VCS with its own credentials (service account, server-owned OAuth principal, or server-held API token), the remote artifact's "creator" or "author" field records the server identity, not the originating MCP principal. To preserve the audit trail across this identity hop, the server attaches originating-actor metadata to every remote write in three locations:

1. A Jira label of the form `orchestrator-actor-<principal-fingerprint>` added to every created or updated issue, where `<principal-fingerprint>` is a stable, non-reversible hash of the originating principal identifier. Raw principal identifiers are not placed in labels because Jira labels are world-visible within the project.
2. A trailing description block in the Jira issue ADF and the Confluence page storage body, marked as an orchestrator-managed metadata block and not modifiable by agents. The block lists the originating principal display name (if disclosed by the host), the blueprint version, the generating tool name, and the audit entry ID.
3. An entry in the orchestrator's own audit log, which carries the unhashed principal identifier, the truncated credential fingerprint, the target artifact ID(s), and the previous-entry hash for chain integrity.

VCS writes follow the same pattern: the PR description contains the orchestrator-managed metadata block, and the git commit's trailer line includes `Orchestrator-Actor-Fingerprint: <hash>` and `Orchestrator-Audit-Id: <id>`. This lets auditors correlate any Atlassian or VCS artifact back to the MCP principal that initiated it without relying on downstream identity fields that the orchestrator does not own.

### Environment variables

```bash
# Deployment and tenancy
DEPLOYMENT_MODE=single_tenant       # single_tenant | multi_tenant_saas_future
TENANT_ID=default

# Atlassian site
ATLASSIAN_SITE_URL=https://example.atlassian.net
ATLASSIAN_CLOUD_ID=...

# Auth mode: api_token | oauth3lo | service_account
ATLASSIAN_AUTH_MODE=api_token
ATLASSIAN_EMAIL=...
ATLASSIAN_API_TOKEN=...

# OAuth 3LO
ATLASSIAN_OAUTH_CLIENT_ID=...
ATLASSIAN_OAUTH_CLIENT_SECRET=...
ATLASSIAN_OAUTH_REDIRECT_URI=...

# Project defaults
JIRA_PROJECT_KEY=PCO
CONFLUENCE_SPACE_KEY=PCO

# VCS
VCS_PROVIDER=bitbucket_cloud
BITBUCKET_WORKSPACE=example-workspace
BITBUCKET_REPO_SLUG=agent-context-orchestrator
BITBUCKET_APP_PASSWORD=...
GITHUB_TOKEN=...

# Storage
DATABASE_URL=postgres://orchestrator:...@db:5432/orchestrator
REDIS_URL=redis://redis:6379/0
QDRANT_URL=http://qdrant:6333
QDRANT_API_KEY=...

# Transport
MCP_TRANSPORT=stdio,http
MCP_HTTP_PORT=7411
MCP_HTTP_BIND=127.0.0.1

# Webhooks
WEBHOOK_INGRESS_PORT=7412
WEBHOOK_PUBLIC_BASE_URL=https://orchestrator.example.com
WEBHOOK_SIGNING_SECRET=...
WEBHOOK_DEDUP_TTL_SECONDS=86400

# Access gate
ACCESS_GATE_MODE=cached_acl     # local | remote_check | cached_acl
ACCESS_GATE_ACL_STALENESS_HOURS=24

# Model/token budgeting
TARGET_MODEL=configured-build-agent-model

# Observability
LOG_LEVEL=info
LANGFUSE_HOST=https://langfuse.example.com
LANGFUSE_PUBLIC_KEY=...
LANGFUSE_SECRET_KEY=...
OTEL_EXPORTER_OTLP_ENDPOINT=...

# Policy
POLICY_MODE=code                    # code | opa_future | cedar_future
POLICY_FAIL_CLOSED=true

# Security
TOKEN_ENCRYPTION_KEY_REF=vault://kv/orchestrator/encryption_key
WRITE_GUARD_REQUIRE_PREVIEW=true
INJECTION_SCAN_ENABLED=true
REDACTION_RULES=gitleaks,default
ACTOR_ATTRIBUTION_FINGERPRINT_SALT_REF=vault://kv/orchestrator/actor_salt
```

### Configuration file

```yaml
tenant:
  mode: single_tenant
  defaultTenantId: default

mcp:
  targetProtocolVersion: "2025-11-25"
  adaptiveRegistration: true
  featureFlags:
    tasks: false
    confluenceAtlasDocFormat: false

atlassian:
  mode: hybrid # direct_rest | rovo_mcp | hybrid
  authMode: api_token # api_token | oauth3lo | service_account
  siteUrl: ${ATLASSIAN_SITE_URL}
  cloudId: ${ATLASSIAN_CLOUD_ID}
  jira:
    projectKey: ${JIRA_PROJECT_KEY}
  confluence:
    spaceKey: ${CONFLUENCE_SPACE_KEY}
    apiVersion: v2
    bodyRepresentation: storage # storage | atlas_doc_format_feature_flagged

rovo:
  enabled: false
  endpoint: https://mcp.atlassian.com/v1/mcp
  allowlist:
    - jira.search
    - jira.get_issue
    - confluence.search
    - confluence.get_page
    - crossproduct.semantic_search

vcs:
  provider: bitbucket_cloud
  workspace: ${BITBUCKET_WORKSPACE}
  repoSlug: ${BITBUCKET_REPO_SLUG}
  branchAndPrDefault: true

notifications:
  channels: [slack]
  slack:
    webhookUrl: ${SLACK_WEBHOOK_URL}

sampling:
  mode: host_delegated  # host_delegated | direct_api
  targetModel: ${TARGET_MODEL}
  temperature: 0
  maxTokens: 4000

queue:
  provider: bullmq # in_memory | bullmq
  concurrency:
    provision: 2
    sync: 4
    validate: 4

vector:
  provider: qdrant
  collection: orchestrator_${tenantId}_${projectKey}
  embeddingModel: bge-m3
  chunkSize: 512
  chunkOverlap: 64

preflight:
  ttlHours: 168               # 7-day ceiling, configurable
  invalidateOnAuthRotation: true
  invalidateOnPermissionWebhook: true
  invalidateOnBranchProtectionChange: true

policy:
  mode: code
  failClosed: true

writes:
  requirePreview: true
  allowDestructiveChanges: false
  idempotencyRequired: true

accessGate:
  mode: cached_acl # local | remote_check | cached_acl
  aclStalenessHours: 24
  failClosed: true

context:
  targetModel: ${TARGET_MODEL}
  maxBudgetTokens: 32000
  reservedTokens:
    required: 800
    linkedArtifacts: 1200
    implementationNotes: 2000
  includeFullPageBodies: false
  includeRepoSnippets: true
  redactSecrets: true
  injectionScanEnabled: true
```

## 21. Rate Limits, Pagination, and Retries

Provider middleware handles paginated Jira search, paginated Confluence v2 results, paginated VCS list endpoints, retryable HTTP failures, 429 handling with backoff honoring `Retry-After`, rate-limit response headers, per-workflow request budgeting, and concurrency limits. Provisioning prefers fewer large structured operations over unbounded per-issue loops. The dry-run planner estimates write counts before execution and fails the preview if the estimate exceeds a configurable ceiling.

## 22. Transport and Deployment

The server exposes two transports from MVP. Stdio transport is the default for local agent hosts (Claude Code, Codex CLI). Streamable HTTP transport listens on a configurable port and bind address. Optional SSE fallback can be implemented only for downstream clients that require it and should be considered temporary. Both transports share the same tool, resource, and prompt registrations.

The HTTP transport shares its process with the webhook ingress listener but exposes them on distinct ports so that MCP auth and webhook signature verification remain separate concerns. The webhook listener verifies signatures using the provider-specific verifier exposed by each `VcsProvider` and the Atlassian webhook secret; unsigned or mis-signed events are dropped without processing.

### Deployment artifacts

A single-stage Dockerfile builds from `node:22-bookworm-slim` and emits a non-root image. The `docker-compose.yml` composes the server with Postgres 16, Redis 7, and Qdrant, mounts a persistent volume for Postgres and Qdrant, and exposes only the MCP HTTP and webhook ports. A `docker-compose.override.yml` is provided for local development that enables live reload. A systemd unit is provided for non-containerized deployments targeting Debian 12 hosts. Healthchecks are exposed at `/health/live` and `/health/ready`, distinct from the MCP `health_check` tool.

## 23. Sampling and LLM Integration

The server delegates LLM inference to the MCP host by default using `sampling/createMessage` only while handling an originating MCP request that permits server-to-client sampling. This keeps the server BYO-LLM, inherits the user's model and credential choices, and avoids duplicate billing. The host negotiation declares requested capabilities (model hint, max tokens, temperature) and the server accepts whatever the host grants, falling back to a deterministic non-sampling path for prompts that can be handled without LLM inference (template-driven page generation, mechanical readiness checks).

A direct-API mode is supported for headless deployments where no host is present or where the work is no longer associated with an active MCP request — for example, webhook-triggered background regeneration. Direct-API mode selects the configured provider and model. The default is intentionally not hard-coded in this plan; deployments set `TARGET_MODEL` and tokenizer mapping in config. All sampling calls are traced to Langfuse with project ID, blueprint version, prompt version, and token counts as trace attributes.

## 24. Job Queue and Async Workflows

Long-running workflows are executed by BullMQ workers rather than inline in tool handlers. `project_provision_execute` enqueues a `provision` job and returns a job handle; the handle is exposed as `orchestrator://project/{projectId}/job/{jobId}` with subscription support so the agent can observe progress. `project_sync` and `readiness_validate` use the same pattern.

Jobs are idempotent and carry an idempotency key stored in the configured queue backend with a configurable TTL. Duplicate enqueues with the same key return the existing job handle. Job state transitions (`queued → running → succeeded|failed|retrying`) emit MCP resource update notifications so subscribed agents see progress without polling. If the stable MCP Tasks utility becomes broadly supported by the target clients, job resources can be mapped to task-backed tool calls behind a feature flag; job resources remain the default because they work across current clients.

## 25. Semantic Retrieval and Vector Store

Qdrant stores chunked, embedded representations of requirements documents, ADRs, selected Confluence pages, Jira issue descriptions, and repo README/CONTRIBUTING content. Chunking uses a recursive text splitter tuned to 512-token chunks with 64-token overlap; markdown and code are split along natural boundaries (headers, function definitions). Embeddings default to BGE-M3, matching the UIO stack.

Collections are scoped by tenant ID and project key to prevent cross-project and future cross-tenant retrieval leakage. When the optional UIO integration is enabled, the orchestrator reuses UIO's embeddings rather than recomputing them, referencing them by UIO document ID. The relevance ranker combines trace-link membership (hard filter) with embedding cosine similarity (ranking signal) as described in Section 16.

## 26. Webhook Ingestion and Change Data Capture

The webhook ingress endpoint accepts Atlassian webhooks (Jira `jira:issue_updated`, `jira:issue_created`, `jira:issue_deleted`, Confluence `page_updated`, `page_created`) and VCS webhooks (Bitbucket Cloud `repo:push`, `pullrequest:updated`; GitHub `push`, `pull_request` when the GitHub adapter is enabled). Signatures are verified against provider-specific secrets before processing.

Verified events are deduplicated before normalization. Dedup uses the provider-supplied event ID where available (Atlassian `X-Atlassian-Webhook-Identifier`, GitHub `X-GitHub-Delivery`, Bitbucket Cloud `X-Hook-UUID`) and falls back to a payload hash when no ID is supplied. Dedup state is held in Redis with a TTL of 24 hours by default. Duplicate deliveries are acknowledged with 200 and discarded.

Deduplicated events are normalized into a common `GraphChangeEvent` and handed to the queue worker, which updates the affected graph entries and fires `notifications/resources/updated` for subscribed MCP resources. Delete events create tombstone records and drift flags rather than silently removing graph entries. Checksums are recomputed and compared; unchanged payloads are discarded to avoid update storms. Events that touch orchestrator-generated artifacts trigger a drift flag on the associated blueprint artifact, visible in the readiness report. Permission-affecting events additionally invalidate the relevant preflight profile entries and any matching cached ACL entries.

## 27. Observability and Telemetry

All tool calls, provider calls, sampling calls, and job executions emit OpenTelemetry spans with a consistent attribute set: `orchestrator.project_id`, `orchestrator.blueprint_version`, `orchestrator.tool_name`, `orchestrator.job_id`, `mcp.session_id`, `mcp.client_name`. Span names follow `orchestrator.<component>.<operation>`. Preflight warnings are emitted as span events on `orchestrator.preflight.discover` with attributes `preflight.target`, `preflight.code`, `preflight.severity`. Traces export to the configured OTLP endpoint and, for sampling calls, additionally to Langfuse with prompt version and token counts.

SLO definitions are documented in `docs/operations.md`: provisioning success rate ≥ 98% over a 7-day window, context pack generation p95 latency ≤ 8 seconds, webhook ingestion lag p95 ≤ 30 seconds, preflight discovery p95 latency ≤ 15 seconds. SLO violations write a notification to the configured channel.

## 28. Implementation Milestones

### Milestone 0 — Scaffold

Deliver a TypeScript project, MCP server entrypoint, dual-transport support (stdio + streamable HTTP), config loader, structured logger, health tool, session capability registry, feature flags, test setup, Dockerfile, and compose file.

Acceptance. Server starts on both transports. MCP inspector lists the health tool over both. The server records the negotiated protocol/client capabilities in memory and exposes `orchestrator://session/current/capabilities`. Unit tests pass. `docker compose up` brings up the server with a Postgres and Redis dependency.

### Milestone 1 — Domain model and storage

Deliver domain models for ProjectBlueprint, ProjectGraph, TraceLink, ArtifactRef, ContextPack, SourcePin, TokenBudgetReport, ProjectProfile, AclEntry, McpSessionProfile, TenantScope, and PolicyDecision. SQLite and Postgres storage with drizzle migrations, tenant-scoped repositories, code-based policy decision adapter, and encrypted token store.

Acceptance. Create/read/update a draft project succeeds on SQLite and Postgres with `tenantId = "default"`. Trace links, readiness results, policy decisions, session profiles, and ACL entries persist. Repository calls require `TenantScope`. Snapshot tests cover serialized blueprint and context pack. Encrypted token round-trip passes.

### Milestone 2 — Atlassian direct providers and capability discovery

Deliver Jira REST provider, Confluence v2 REST provider, Jira ADF utilities, Confluence storage-format renderer, optional feature-flagged Confluence ADF renderer, content-property helpers, capability discovery, pagination, rate-limit, and retry wrapper. OAuth 3LO support in addition to API token. Jira create-meta uses the non-deprecated `/issue/createmeta/{projectIdOrKey}/issuetypes` endpoints. Add `project_preflight_check` and `project_profile_get`.

Acceptance. Providers work against recorded HTTP fixtures. Optional live integration tests run only when credentials are present. OpenAPI-driven contract tests pass for both providers. Token encryption and refresh rotation tested. Preflight produces a project profile that includes Jira create metadata, required fields, Confluence space/page capabilities, supported body representations, vector-store connectivity, embedding endpoint reachability, webhook registration state, and auth warnings.

### Milestone 3 — VCS provider

Deliver the VcsProvider interface, Bitbucket Cloud adapter, file write APIs, pull-request APIs, and webhook signature verification. The GitHub adapter stub is created but not implemented in this milestone.

Acceptance. Bitbucket Cloud adapter passes contract tests. Interface surface accommodates GitHub without changes.

### Milestone 4 — Blueprint workflow with sampling

Deliver `project_intake_create`, `project_blueprint_generate`, `project_blueprint_update`, blueprint validator, and host-delegated sampling integration. UIO document ingestion path is accepted as an alternative to raw markdown.

Acceptance. Raw markdown requirements become a structured blueprint. Missing requirements produce open questions. Blueprint is deterministic for snapshot tests at temperature 0. Sampling call traces appear in Langfuse.

### Milestone 5 — Provisioning planner

Deliver artifact plan generator, Confluence page plan, Jira issue plan using the discovered project profile, VCS branch/PR file plan, actor-attribution plan (labels, metadata blocks, commit trailers), policy-decision evaluation for every planned action, structured output schemas, and `project_provision_preview`.

Acceptance. Dry-run output shows create/update/no-op/blocked actions including actor attribution and policy decisions. No remote writes happen during preview. Plan includes estimated request count. Company-managed and team-managed Jira projects produce distinct plans where appropriate. Preview fails if the project profile is stale or required field mappings are unresolved.

### Milestone 6a — Jira provisioning executor (first shippable slice terminates here)

Deliver BullMQ worker integration, `project_provision_execute` for Jira-only targets, idempotency key handling, policy-decision enforcement, job resource exposure, audit log with hash-chain integrity, actor-attribution writes (labels, description metadata block, audit entry), and graph update after writes.

Acceptance. Running the same plan twice does not duplicate Jira issues. Generated issue keys, IDs, and actor-attribution labels are stored. Job state is observable through the MCP resource. Audit hash chain validates end-to-end. The first shippable slice ends here; Confluence and VCS provisioning remain ahead.

### Milestone 6b — Confluence provisioning executor

Deliver Confluence page provisioning in the same executor, using the storage representation by default. Metadata is stored in Confluence content properties and labels, with a human-visible metadata block appended to the page body.

Acceptance. Running the same plan twice does not duplicate Confluence pages. Content properties persist across updates. Metadata block is preserved against manual edits.

### Milestone 6c — VCS branch and PR provisioning executor

Deliver VCS provisioning in the same executor. Generated files are committed to a generated branch and proposed through a PR by default. Commit trailers carry actor attribution; PR description carries the metadata block.

Acceptance. Running the same plan twice does not open duplicate PRs; subsequent runs update the existing PR. Direct commits to the default branch are refused unless the override configuration is set. PR description metadata block is preserved.

### Milestone 7 — Context resources and packs

Deliver `context_pack_generate`, `context_get`, MCP resources for project and issue context, token budgeting against the target model's tokenizer, Qdrant-backed relevance ranking, redaction pass with gitleaks-based rules, prompt-injection scanning, and access-control gate integration.

Acceptance. Agents can fetch `orchestrator://issue/{issueKey}/context`. Context includes linked Jira, Confluence, and VCS references with pinned versions. Context pack is bounded, traceable, and regenerates deterministically from pins. The access gate and policy decision layer return decisions on every cache or vector hit.

### Milestone 8 — Readiness validation

Deliver `readiness_validate`, weighted project-level and issue-level rubrics, readiness report resource, and waiver handling.

Acceptance. Report identifies missing acceptance criteria, test plans, links, risks, and unresolved questions with weights. Project can transition to `READY_FOR_BUILD` only when score threshold is met or waivers cover gaps.

### Milestone 9 — Agent handoff

Deliver `handoff_generate`, `build-agent-handoff` prompt, and a single canonical source that emits `AGENTS.md`, `CLAUDE.md`, and Cursor rules in parity.

Acceptance. Given a Jira issue key, the server returns a handoff that Codex and Claude Code can consume identically. The handoff includes objective, scope, acceptance criteria, test plan, links, and repo paths.

### Milestone 10 — Webhook ingestion and resource subscriptions

Deliver the webhook ingress endpoint, Atlassian webhook handlers, Bitbucket Cloud webhook handlers, signature verification, delivery dedup, normalized `GraphChangeEvent` pipeline, resource pagination, session-aware subscriptions, and `resources/subscribe` support.

Acceptance. Edits to a Confluence page or Jira issue land in the graph within SLO. Duplicate deliveries are discarded. Subscribed agents receive `notifications/resources/updated` without polling. Drift on orchestrator-generated artifacts is flagged in the readiness report. Permission-affecting events invalidate the relevant preflight profile entries and cached ACL entries.

### Milestone 11 — Notifications, evals, and hardening

Deliver notification provider with Slack and Teams adapters, prompt eval framework with golden datasets, MCP conformance tests via inspector, SLO metrics export, and the deployment runbook.

Acceptance. Provisioning completion and waiver events notify configured channels. Prompt eval framework runs on CI. MCP conformance suite passes. Operations runbook covers deployment, backup, restore, and disaster recovery.

## 29. Build Agent Prompts

The following prompts are executed one milestone at a time. Each is written to be agent-agnostic; "the build agent" refers to whichever agent is operating (Codex, Claude Code, or other).

Prompt 1 — Scaffold:
```text
Build Milestone 0 from docs/agent-context-orchestrator-mcp-plan-v5.md.
Create a TypeScript Node.js 22 MCP server with dual-transport support (stdio and streamable HTTP), config loading, structured logging, a health tool with proper annotations and output schema, session capability capture during initialize, a diagnostic session capabilities resource, feature flags, test setup, Dockerfile, and docker-compose.yml with Postgres and Redis dependencies.
Do not implement Atlassian providers yet.
Acceptance: server starts on both transports, tools/list includes health_check over both, session capability diagnostics work, tests pass, docker compose up succeeds.
```

Prompt 2 — Domain and storage:
```text
Implement Milestone 1.
Add domain models for ProjectBlueprint, ProjectGraph, TraceLink, ArtifactRef, ContextPack, SourcePin, TokenBudgetReport, ProjectProfile, AclEntry, McpSessionProfile, TenantScope, and PolicyDecision.
Add storage layer supporting SQLite and Postgres with drizzle migrations and tenant-scoped repositories.
Add a code-based PolicyDecisionLayer adapter and an encrypted token store using envelope encryption (libsodium secretbox or KMS data key), with a test double for local unit tests.
Add unit tests and snapshot tests. Do not call external services.
```

Prompt 3 — Atlassian providers:
```text
Implement Milestone 2.
Add provider interfaces and direct REST providers for Jira and Confluence. Use ADF for Jira rich-text fields. Use Confluence v2 `storage` representation by default, with optional feature-flagged `atlas_doc_format` support only when tests prove compatibility.
Implement project_preflight_check and project_profile_get. Discover Jira create metadata via the non-deprecated /issue/createmeta/{projectIdOrKey}/issuetypes endpoints, required fields, issue types, link types, Confluence space/page capabilities, supported body representations, vector-store connectivity, embedding endpoint reachability, webhook registration, and auth warnings. Emit warnings as structured logs and OTel span events.
Implement API token and OAuth 2.0 3LO auth modes with refresh token rotation. Do not implement raw MCP-client token passthrough.
Implement pagination, retry, rate-limit handling, ADF helpers, Confluence storage helpers, and content-property helpers.
All live integration tests must be skipped unless required env vars are present.
Contract tests must be driven by recorded HTTP fixtures or OpenAPI stubs.
```

Prompt 4 — VCS provider:
```text
Implement Milestone 3.
Add the VcsProvider interface and Bitbucket Cloud adapter.
Implement getRepository, createRepository, getFile, putFiles, createPullRequest, and getWebhookSignatureVerifier.
Stub the GitHub adapter to validate the interface without implementation.
Contract tests pass for Bitbucket Cloud.
```

Prompt 5 — Blueprint workflow with sampling:
```text
Implement Milestone 4.
Add MCP tools project_intake_create, project_blueprint_generate, and project_blueprint_update.
Use MCP sampling/createMessage for LLM-backed generation while handling an originating MCP request; fall back to a deterministic non-sampling path where possible, and to direct-API mode for headless background work.
Accept either raw markdown or a UIO document reference as intake input.
Add tests from fixture markdown requirements at temperature 0.
Sampling calls emit Langfuse traces.
```

Prompt 6 — Provisioning preview:
```text
Implement Milestone 5.
Generate a dry-run artifact plan for Confluence pages, Jira issues, and VCS files.
Use the stored project profile from project_preflight_check; fail if it is stale or missing. Adapt the issue plan to company-managed vs team-managed Jira projects, required fields, link types, and safe custom fields.
Plan actor-attribution writes: label, Jira description metadata block, Confluence body metadata block, commit trailer, PR description block. Evaluate every planned action through the PolicyDecisionLayer.
Add MCP tool project_provision_preview.
Ensure it never performs remote writes.
Return create/update/no-op/blocked actions, branch/PR VCS actions, estimated request counts, policy decisions, and a structuredContent payload conforming to the tool output schema.
```

Prompt 7 — Jira provisioning executor (first shippable slice terminates here):
```text
Implement Milestone 6a.
Add a BullMQ worker and job repository.
Add MCP tool project_provision_execute that enqueues a Jira-only provisioning job and returns a job handle.
Expose job state via orchestrator://project/{projectId}/job/{jobId}.
Require previewId, approved: true, and idempotencyKey.
Make repeated execution idempotent.
Enforce PolicyDecisionLayer obligations before any remote write.
Implement actor-attribution writes on Jira: orchestrator-actor-<fingerprint> label, description metadata block, audit log entry.
Implement tamper-evident audit log with hash chain.
```

Prompt 8 — Confluence provisioning executor:
```text
Implement Milestone 6b.
Extend the provisioning executor to create and update Confluence pages using the storage representation by default.
Store metadata in Confluence content properties and labels; append a human-visible metadata block to the page body.
Preserve manual edits on page bodies that lack the orchestrator metadata block.
```

Prompt 9 — VCS provisioning executor:
```text
Implement Milestone 6c.
Extend the provisioning executor to write generated files to a generated branch and open a PR by default.
Do not commit to the default branch unless the override configuration is explicitly set.
Write commit trailers carrying actor attribution (Orchestrator-Actor-Fingerprint, Orchestrator-Audit-Id).
Write PR description metadata block.
Repeat runs update the existing PR rather than opening a duplicate.
```

Prompt 10 — Context packs:
```text
Implement Milestone 7.
Add context_pack_generate, context_get, and MCP resources for project and issue context.
Implement token budgeting against the configured target model.
Integrate Qdrant for relevance ranking with trace-link filter and embedding similarity.
Wire the access-control gate; return gate decisions on every cache/vector hit according to configured mode (local | remote_check | cached_acl).
Implement prompt-injection scanning on pulled content and gitleaks-based redaction.
Context packs must include objective, scope, non-goals, acceptance criteria, test plan, linked artifacts, repo refs, source pins, freshness state, access decision, and token budget report.
```

Prompt 11 — Readiness validation and handoff:
```text
Implement Milestones 8 and 9.
Add readiness_validate with weighted project-level and issue-level rubrics.
Add handoff_generate and build-agent-handoff prompt.
Emit AGENTS.md, CLAUDE.md, and Cursor rules from a single canonical source.
Add tests for ready and not-ready projects and for waiver handling.
```

Prompt 12 — Webhook ingestion and subscriptions:
```text
Implement Milestone 10.
Add the webhook ingress endpoint on a distinct port from MCP HTTP.
Implement signature verification for Atlassian and Bitbucket Cloud webhooks.
Implement delivery dedup keyed on provider-supplied event IDs with Redis TTL.
Normalize events to GraphChangeEvent and update the graph through the queue.
Implement resources/subscribe, notifications/resources/updated, and resource pagination on enumerable resources.
Add drift flagging on orchestrator-generated artifacts.
Invalidate preflight profile and cached ACL entries on permission-affecting events.
```

Prompt 13 — Notifications, evals, and hardening:
```text
Implement Milestone 11.
Add NotificationProvider with Slack and Teams adapters.
Add a prompt eval framework with golden datasets and LLM-as-judge rubrics.
Add MCP conformance tests driven by the MCP inspector.
Add OTel exporters and SLO dashboards.
Produce docs/operations.md with deployment, backup, restore, and disaster recovery runbooks.
```

## 30. Security Requirements

Use least-privilege credentials. Never log tokens or secrets. Encrypt tokens at rest with envelope encryption backed by a KMS, Vault, or equivalent deployment secret. Sealed-box primitives are public-key constructs and are not appropriate for this purpose. Redact secrets from all generated context packs using a layered detection strategy combining gitleaks-rule-compatible patterns with entropy-based detection for generic high-entropy strings.

Preview before writes. Require explicit approval for writes. Block destructive operations by default and enforce the block at the policy decision layer and writeGuards layer below tool argument validation. Respect Atlassian and VCS permissions. Do not use raw downstream-token passthrough. Before returning cached or vectorized content, run the access-control gate in the configured mode; fail closed on gate timeouts and provider errors.

Write audit entries for all tool calls that create or update remote artifacts. Include actor (MCP principal and credential fingerprint), timestamp, tool name, input hash, output IDs, error state, and previous-entry hash. Audit entries form a hash chain so tampering is detectable. For compliance-adjacent deployments, additionally ship audit entries to an append-only SIEM sink. Actor attribution is mirrored into Jira labels, Jira/Confluence body metadata blocks, commit trailers, and PR description blocks so the audit trail survives the identity hop to downstream systems.

Scan pulled content for prompt-injection patterns before inclusion in context packs. Wrap pulled content in untrusted-data markers that the handoff prompts recognize. Verify webhook signatures before processing. Deduplicate webhook deliveries before normalization. Drop unsigned or mis-signed events without processing. Every MCP tool declares safety annotations, but enforcement lives in the server-side policy decision layer, write guards, access gate, and approval checks, not in annotations. Repository reads/writes must always carry a tenant scope, even in single-tenant mode.

## 31. Testing Strategy

Unit tests cover domain model validation, blueprint parsing, tenant-scope enforcement, session capability negotiation, preflight profile validation, artifact plan generation, policy-decision evaluation, actor-attribution planning, readiness scoring, context pack generation, token budgeting, redaction, injection scanning, Jira ADF generation, Confluence storage rendering, access gates, tool annotations, tool output schemas, audit-chain integrity, webhook delivery dedup, and Rovo allowlist enforcement.

Contract tests cover Jira, Confluence, and VCS provider behavior against recorded HTTP fixtures and OpenAPI-derived stubs. Confluence tests must separately verify storage representation and feature-flagged atlas_doc_format behavior. Pagination, 429 handling, retry, and idempotency are exercised.

Integration tests run only when credentials are present and target create/update on a sandbox Confluence space, a sandbox Jira project, and a sandbox VCS branch, with cleanup. Webhook signature verification is tested against real signature samples.

Conformance tests use the MCP inspector to validate JSON-RPC envelope compliance, capability negotiation, tool/resource/prompt registration, structuredContent/outputSchema behavior, subscription lifecycle, completion responses, and resource pagination.

Snapshot tests cover generated Confluence page bodies, generated Jira issue payloads, generated VCS manifests, and generated context packs.

Evals cover the LLM-backed prompts (`project-intake-interview`, `requirements-decomposer`, `jira-story-writer`, `confluence-page-writer`, `readiness-reviewer`, `build-agent-handoff`) against a golden dataset with an LLM-as-judge rubric. Eval regression runs on CI; prompt version bumps require passing evals before merge.

## 32. Definition of Done

The project is complete when a user can submit raw requirements (or a UIO document reference); the server creates a structured project blueprint; the server discovers a non-stale project profile; the server previews Confluence, Jira, and VCS changes; the server executes approved provisioning idempotently through the queue with actor attribution propagated into Jira labels, Jira and Confluence metadata blocks, commit trailers, and PR description blocks; the server creates linked Confluence pages and Jira issues with correct per-project-type behavior; the server creates or updates VCS agent-context files across supported providers through a generated branch and PR by default; the server exposes project and task context through paginated MCP resources with session-aware subscription support; the access-control gate and policy decision layer authorize every cache/vector hit according to the configured mode; the server ingests webhooks with delivery dedup and keeps the graph current; the server validates build readiness against the weighted rubric; any compliant MCP agent (Codex, Claude Code, or other) can fetch a task handoff and begin implementation; tests including evals pass; secrets are redacted; writes are audited with tamper-evident chaining; all persistence and vector/secret paths are tenant-scoped even in single-tenant mode; and the operations runbook covers deploy, backup, restore, and DR.

## 33. Prerequisites Checklist Before Live Provisioning

Run `project_preflight_check` first and review its warnings. Then collect or decide deployment mode (`single_tenant` for v1), tenant ID (`default` unless explicitly changed), policy mode (`code` for v1), the Atlassian Cloud site URL, Atlassian cloud ID, Jira project key or permission to create one, Jira project type (company-managed or team-managed), available Jira issue types, custom fields to use or avoid, Confluence space key or permission to create one, VCS provider (Bitbucket Cloud for MVP; GitHub/GitLab for future; Bitbucket Data Center and Server are out of scope), VCS workspace, VCS repo slug or permission to create one, whether the VCS workspace is linked to an Atlassian organization, auth mode (API token, OAuth 3LO, or service-account/bot), whether API token auth is allowed by org admins, rate-limit constraints, whether generated pages require human review before publish, required labels/components/versions, branch naming convention, PR template convention, CI requirements, security/privacy constraints, data caching policy, access gate mode, notification channel (Slack or Teams webhook URL), secrets-manager location for the token encryption key, and actor-attribution fingerprint salt location.

## 34. Key Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Tool sprawl overwhelms agents | Keep MCP tools few, high-level, and workflow-oriented. Consolidate metadata-attach operations into `artifact_annotate`. Expose detailed context as resources. |
| Duplicate Jira issues or pages | Use stable artifact IDs, idempotency keys, stored remote IDs, and preflight-derived field mappings. Enqueue through the queue to serialize writes per project. |
| Wrong Confluence body format | Default to Confluence `storage` representation. Keep `atlas_doc_format` behind a feature flag and live compatibility test. |
| Raw token passthrough violates MCP security model | Do not forward MCP client tokens to downstream APIs. Use server-owned OAuth/API-token/service-account credentials or standards-based token exchange where supported. |
| Lost actor attribution across identity hop | Propagate originating-principal fingerprints via Jira labels, body metadata blocks, commit trailers, PR description blocks, and the orchestrator audit log. |
| Tool annotations are trusted too much | Treat annotations as UI hints only. Enforce safety through the policy decision layer, write guards, approvals, access gate, and audit checks. |
| Formal policy engine is added too early | Keep v1 policy code-based behind a `PolicyDecisionLayer` interface. Add OPA/Rego or Cedar only after deployment evidence shows code policies are insufficient. |
| MCP client capability mismatch | Record session capabilities during initialize, gate optional features by session, and provide fallbacks for elicitation, sampling, subscriptions, completions, and tasks. |
| Cached/vector content leaks across permissions | Run access-control gate in configured mode with fail-closed semantics. Invalidate cached ACLs on permission-affecting webhooks. |
| Context packs become too large | Enforce token budgets with explicit section reservations. Use hybrid relevance ranking to drop low-value content first. |
| Agents act on stale context | Store pinned source versions and freshness state in every context pack. Webhook ingestion updates the graph in real time and fires resource update notifications. Dirty packs block readiness. |
| Destructive writes happen accidentally | Dry-run first, require approval, block destructive changes by default at the writeGuards layer. |
| Atlassian rate limits interrupt provisioning | Add request budgeting, backoff honoring Retry-After, pagination, and concurrency limits in provider middleware. Fail preview if request estimate exceeds configured ceiling. |
| Manual edits conflict with generated content | Preserve manual sections using generated markers, show diffs in preview, and flag drift in the readiness report. |
| Permissions differ per user | Prefer per-user OAuth 3LO for multi-user deployments. When cached content is used, the access gate verifies via remote check or cached ACL with invalidation. |
| VCS support differs by auth mode | Keep direct REST providers available and isolate Rovo MCP as an optional read-only provider behind an allowlist. |
| Webhook duplicate delivery corrupts state | Dedup on provider-supplied event IDs with Redis TTL before normalization. |
| Stale preflight profile causes provisioning failure | Invalidate on permission webhooks, token rotation, branch-protection changes, and TTL. Fail preview on stale profile. |
| Rovo provider exposes unintended capabilities | Default allowlist covers read/search only. Extensions require explicit config. |
| Prompt injection through Confluence or Jira content | Scan pulled content for injection patterns before inclusion. Wrap untrusted data in markers recognized by handoff prompts. |
| Secret leakage through generated context | Apply gitleaks-rule-compatible detection plus entropy-based detection. Test cases cover each rule class. |
| Audit log tampering | Hash-chain audit entries. Optionally ship to an append-only SIEM sink. |
| Prompt regressions break agents | Run eval suite on every prompt version bump. Gate merges on eval pass. |
| Blueprint schema evolution | Carry `schemaVersion` on every blueprint. Provide migration functions for each bump. Store old versions for replay. |
| Multi-tenant cache leakage | v1 remains single-tenant, but stores `tenantId`, requires `TenantScope`, scopes vector collections and secret paths by tenant, and plans Postgres RLS for SaaS. |
| Bitbucket Data Center/Server assumed compatible with Cloud | MVP explicitly targets Bitbucket Cloud only. DC/Server REST differences require a separate adapter; flagged as out of scope for v1. |

## 35. Relationship to Adjacent Systems

### UIO (Universal Intake Orchestrator)

When raw requirements arrive as PDFs or DOCX, UIO performs the ingestion and extraction (MinerU, BGE-M3). The orchestrator's `project_intake_create` tool accepts either raw markdown or a UIO document reference (document ID plus extracted structured content). When UIO is the source, the orchestrator reuses UIO's embeddings directly in Qdrant rather than recomputing them, keyed by UIO document ID and chunk index.

### Langfuse

All sampling calls and context pack assemblies export traces to the shared Langfuse instance. Trace attributes include project ID, blueprint version, prompt version, tool name, and token counts. Prompt eval runs also trace to Langfuse so prompt regressions are visible alongside production use.

### Brand and packaging

If this ships as a Velocity Ops offering, package and repo naming follows VO conventions (`@velocityops/context-orchestrator` or equivalent) and the documentation adopts the finalized VO visual identity. This decision is made before the v1.0 release, not before MVP.

## 36. Versioning and Compatibility

The server follows semver. The MCP spec version the server implements is declared in server info. The server targets the most recent stable MCP spec version supported by both the TypeScript SDK and the reference build-agent hosts (Codex, Claude Code); draft or opt-in capabilities (for example, MCP Tasks for long-running operations) are gated behind feature flags and are not required for default operation. Blueprint schema carries `schemaVersion` independent of the server version; migrations between schema versions are stored in `src/storage/migrations/blueprint/`. Prompts carry `promptVersion`; prompt version bumps mark dependent context packs as regeneration-eligible but do not invalidate them.

A compatibility matrix in the README documents, per server release, the supported MCP spec versions, target build-agent versions (Codex, Claude Code), Atlassian API versions, VCS API versions, Rovo MCP endpoint versions, and Bitbucket variant scope (Cloud only in MVP). The matrix also records which clients support elicitation, resource subscriptions, Streamable HTTP, resource pagination, completions, host-delegated sampling, and optional task-style long-running operations. At runtime, the `McpSessionProfile` is the source of truth for what was negotiated in the current session.

## 37. Immediate Next Step

Start with Milestone 0. Do not try to implement the entire system at once. The first useful deliverable is a working MCP server with both stdio and streamable HTTP transports, a health tool with proper annotations and output schema, session capability capture, a diagnostic session capabilities resource, typed config, logger, test harness, Dockerfile, compose file, and a documented project skeleton. The second useful deliverable is not provisioning; it is preflight capability discovery with recorded fixtures. The first shippable slice terminates at Milestone 6a (Jira-only provisioning with actor attribution); Confluence (M6b) and VCS (M6c) provisioning land as separate, orderable increments after the slice is proven.
