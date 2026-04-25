import type { Server as McpServer } from "@modelcontextprotocol/sdk/server/index.js";
import type { CompositionRoot } from "../compositionRoot.js";
import { defaultTenantScope } from "../domain/tenantScope.js";
import { registerProjectPreflightTools } from "./tools/projectPreflight.js";
import { registerProjectIntakeTools } from "./tools/projectIntake.js";
import { registerProjectProvisionTools } from "./tools/projectProvision.js";
import { registerProjectWorkflowTools } from "./tools/projectWorkflows.js";
import { createHostDelegatedSamplingAdapter } from "./sampling.js";
import { createIntakeWorkflow } from "../workflows/intakeWorkflow.js";
import { createBlueprintWorkflow } from "../workflows/blueprintWorkflow.js";
import { createBlueprintReviseWorkflow } from "../workflows/blueprintReviseWorkflow.js";
import { createProvisioningWorkflow } from "../workflows/provisioningWorkflow.js";
import { createCodePolicyAdapter } from "../security/policyAdapters/codePolicyAdapter.js";
import { createContextPackWorkflow } from "../workflows/contextPackWorkflow.js";
import { createReadinessWorkflow } from "../workflows/readinessWorkflow.js";
import { createHandoffWorkflow } from "../workflows/handoffWorkflow.js";
import { createWebhookIngestionWorkflow } from "../workflows/webhookIngestionWorkflow.js";
import { agentMemorySessionContext, createAgentMemoryWorkflow } from "../workflows/agentMemoryWorkflow.js";
import type { SessionRegistry } from "./sessionCapabilities.js";
import type { ToolRegistry } from "./toolRegistry.js";
import type { PreflightDeps } from "../preflight/preflightWorkflow.js";

export function registerCompositionTools(args: {
  readonly registry: ToolRegistry;
  readonly server: McpServer;
  readonly root: CompositionRoot;
  readonly sessionRegistry: SessionRegistry;
  readonly resolveCurrentSessionId: () => string | undefined;
}): void {
  // SaaS-runway (F-009): single-tenant in v1, but the resolveScope seam is
  // here so multi-tenant deployments can derive scope from sessionId without
  // touching every tool registration site. v6 §7.3 carries the runway.
  const resolveScope = (_sessionId: string | undefined) => defaultTenantScope();
  const scope = resolveScope(args.resolveCurrentSessionId());
  const flags = args.root.config.flags;

  // M2: preflight is unconditional — production-quality.
  registerProjectPreflightTools({
    registry: args.registry,
    logger: args.root.logger,
    resolveScope: () => scope,
    buildPreflightDeps: async () => preflightDeps(args.root),
    persistProfile: async (_, profile) => {
      await args.root.repositories.projectProfile.insert(scope, profile);
    },
    fetchLatestProfile: async (_, projectId) => args.root.repositories.projectProfile.findLatestForProject(scope, projectId),
  });

  // M4 — flag-gated until intake/blueprint workflows actually meet v6 §28 M4 acceptance.
  if (flags.milestone4Enabled) {
    const sampling = createHostDelegatedSamplingAdapter({
      sessionRegistry: args.sessionRegistry,
      resolveCurrentSessionId: args.resolveCurrentSessionId,
      createMessage: (params) => args.server.createMessage(params),
    });
    registerProjectIntakeTools({
      registry: args.registry,
      resolveScope: () => scope,
      intakeWorkflow: createIntakeWorkflow({
        projectRepository: args.root.repositories.project,
        uio: args.root.providers.uio,
      }),
      blueprintWorkflow: createBlueprintWorkflow({
        projectRepository: args.root.repositories.project,
        sampling,
        velocityRegistry: args.root.velocityRegistry,
      }),
      reviseWorkflow: createBlueprintReviseWorkflow({
        projectRepository: args.root.repositories.project,
        registry: args.root.velocityRegistry,
        sampling,
      }),
    });
  }

  // M5 + M6a — preview is M5; execute is M6a. Execute requires policy gate (see F-002 in audit remediation).
  if (flags.milestone5Enabled || flags.milestone6aEnabled) {
    const policy = createCodePolicyAdapter();
    // Sampling adapter for the adversarial triplet (F-006). Falls back to the
    // disabled adapter when no host advertises sampling — the triplet then runs
    // deterministic critics (and fails closed in non-dev tiers).
    const provisioningSampling = createHostDelegatedSamplingAdapter({
      sessionRegistry: args.sessionRegistry,
      resolveCurrentSessionId: args.resolveCurrentSessionId,
      createMessage: (params) => args.server.createMessage(params),
    });
    const provisioning = createProvisioningWorkflow({
      projectRepository: args.root.repositories.project,
      policy,
      sampling: provisioningSampling,
      tier: args.root.config.deployment.tier,
    });
    registerProjectProvisionTools({
      registry: args.registry,
      resolveScope: () => scope,
      provisionJobs: args.root.repositories.provisionJob,
      ...(flags.milestone5Enabled
        ? {
            preview: (tenantScope, input) =>
              provisioning.preview(tenantScope, {
                projectId: input.projectId,
                jiraProjectKey: input.jiraProjectKey,
                actorPrincipalId: input.actorPrincipalId,
                ...(input.confluenceSpaceId !== undefined ? { confluenceSpaceId: input.confluenceSpaceId } : {}),
                ...(input.vcsWorkspace !== undefined ? { vcsWorkspace: input.vcsWorkspace } : {}),
                ...(input.vcsRepoSlug !== undefined ? { vcsRepoSlug: input.vcsRepoSlug } : {}),
                ...(input.vcsBaseBranch !== undefined ? { vcsBaseBranch: input.vcsBaseBranch } : {}),
              }),
          }
        : {}),
      ...(flags.milestone6aEnabled
        ? {
            execute: async (tenantScope, input) => {
              if (!args.root.provisionQueue) throw new Error("Provision queue is not configured");
              return args.root.provisionQueue.enqueue(tenantScope, input);
            },
          }
        : {}),
    });
  }

  // M7-M10 plus promoted deferred memory — workflow tools, each gated independently.
  if (
    flags.milestone7Enabled ||
    flags.milestone8Enabled ||
    flags.milestone9Enabled ||
    flags.milestone10Enabled ||
    flags.persistentAgentMemoryEnabled
  ) {
    const memory = flags.persistentAgentMemoryEnabled
      ? createAgentMemoryWorkflow({
          projectRepository: args.root.repositories.project,
          memoryRepository: args.root.repositories.agentMemory,
          auditRepository: args.root.repositories.audit,
          auditSigner: args.root.auditSigner,
          vectorIndex: args.root.agentMemoryVectorIndex,
        })
      : undefined;
    const contextPacks = flags.milestone7Enabled
      ? createContextPackWorkflow({
          projectRepository: args.root.repositories.project,
          targetModel: "claude-sonnet-4-6",
          budgetTokens: 8_000,
          ...(memory
            ? {
                recallMemory: (tenantScope, input) =>
                  memory.recall(tenantScope, {
                    projectId: input.projectId,
                    ...(input.issueKey !== undefined ? { issueKey: input.issueKey } : {}),
                    query: input.query,
                    limit: input.limit,
                    includeVector: flags.agentMemoryVectorEnabled,
                    ...currentAgentMemorySession(args),
                  }),
              }
            : {}),
        })
      : undefined;
    const readiness = flags.milestone8Enabled
      ? createReadinessWorkflow({ projectRepository: args.root.repositories.project })
      : undefined;
    const handoff = flags.milestone9Enabled ? createHandoffWorkflow() : undefined;
    const webhooks = flags.milestone10Enabled
      ? createWebhookIngestionWorkflow({
          deliveries: args.root.repositories.webhookDelivery,
          secrets: args.root.webhookSecrets,
        })
      : undefined;

    registerProjectWorkflowTools({
      registry: args.registry,
      resolveScope: () => scope,
      ...(contextPacks
        ? {
            generateContextPack: async (tenantScope, input) => {
              const pack = await contextPacks.generate(tenantScope, {
                projectId: input.projectId,
                ...(input.issueKey !== undefined ? { issueKey: input.issueKey } : {}),
              });
              await args.root.repositories.contextPack.insert(tenantScope, pack);
              return pack;
            },
            getContextPack: (tenantScope, regenerationKey) =>
              args.root.repositories.contextPack.findByRegenerationKey(tenantScope, regenerationKey),
          }
        : {}),
      ...(readiness
        ? {
            validateReadiness: async (tenantScope, input) => {
              const report = await readiness.validate(tenantScope, input);
              await args.root.repositories.readiness.insert(tenantScope, report);
              return report;
            },
          }
        : {}),
      ...(handoff ? { generateHandoff: (input) => handoff.generate(input) } : {}),
      ...(webhooks ? { ingestWebhook: (tenantScope, input) => webhooks.ingest(tenantScope, input) } : {}),
      ...(memory
        ? {
            memory: {
              retain: (tenantScope, input) => memory.retain(tenantScope, { ...input, ...currentAgentMemorySession(args) }),
              recall: (tenantScope, input) => memory.recall(tenantScope, { ...input, ...currentAgentMemorySession(args) }),
              reflect: (tenantScope, input) => memory.reflect(tenantScope, { ...input, ...currentAgentMemorySession(args) }),
              forget: (tenantScope, input) => memory.forget(tenantScope, { ...input, ...currentAgentMemorySession(args) }),
            },
          }
        : {}),
    });
  }
}

function preflightDeps(root: CompositionRoot): PreflightDeps {
  return {
    ...(root.providers.jira ? { jira: root.providers.jira } : {}),
    ...(root.providers.confluence ? { confluence: root.providers.confluence } : {}),
    ...(root.providers.vcs ? { vcs: root.providers.vcs } : {}),
    uio: root.providers.uio,
    authMode: "api_token",
    logger: root.logger,
  };
}

function currentAgentMemorySession(args: {
  readonly sessionRegistry: SessionRegistry;
  readonly resolveCurrentSessionId: () => string | undefined;
}) {
  const sessionId = args.resolveCurrentSessionId();
  return agentMemorySessionContext(sessionId ? args.sessionRegistry.get(sessionId) : undefined);
}
