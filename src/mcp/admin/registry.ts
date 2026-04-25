// Admin MCP tool registry.
//
// Parallels src/mcp/toolRegistry.ts but holds only `admin.*` tools served on
// the loopback MCP transport (port 3001). Authorized by ADR 0006.
//
// Tools are added via registerAdminTools(deps, registry) called from
// src/mcp/admin/buildAdminServer.ts. Each tool emits structuredContent +
// optional `dataLimited` markers; write tools also append a signed audit
// chain entry through deps.auditSigner + deps.repositories.audit.

import type { ToolRegistry } from "../toolRegistry.js";
import type { Logger } from "pino";
import type { OrchestratorConfig } from "../../config.js";
import type { Repositories } from "../../storage/repositories/index.js";
import type { AuditSigner } from "../../security/auditChain.js";
import type { JiraProvider } from "../../providers/atlassian/jiraProvider.js";
import type { ConfluenceProvider } from "../../providers/atlassian/confluenceProvider.js";
import type { VcsProvider } from "../../providers/vcs/VcsProvider.js";
import type { UioAdapter } from "../../providers/uio/uioMcpAdapter.js";
import type { SessionRegistry } from "../sessionCapabilities.js";
import type { ProvisionQueue } from "../../queue/provisionQueue.js";
import type { DbHandle } from "../../storage/db.js";
import type { VelocityContentRegistry } from "../../velocity/contentRegistry.js";

export interface AdminToolDeps {
  readonly config: OrchestratorConfig;
  readonly logger: Logger;
  readonly db: DbHandle;
  readonly repositories: Repositories;
  readonly auditSigner: AuditSigner;
  readonly providers: {
    readonly jira: JiraProvider | undefined;
    readonly confluence: ConfluenceProvider | undefined;
    readonly vcs: VcsProvider | undefined;
    readonly uio?: UioAdapter;
  };
  /** The agent-facing transport's SessionRegistry — admin reads it to list/terminate sessions. */
  readonly agentSessionRegistry: SessionRegistry;
  readonly provisionQueue: ProvisionQueue | undefined;
  readonly velocityRegistry: VelocityContentRegistry;
  readonly startedAt: Date;
}

import { registerHealthAdminTool } from "./tools/health.js";
import { registerProjectsAdminTools } from "./tools/projects.js";
import { registerJobsAdminTool } from "./tools/jobs.js";
import { registerAuditAdminTools } from "./tools/audit.js";
import { registerPolicyAdminTools } from "./tools/policy.js";
import { registerSessionsAdminTool } from "./tools/sessions.js";
import { registerProvidersAdminTool } from "./tools/providers.js";
import { registerMigrationsAdminTool } from "./tools/migrations.js";
import { registerSecretsAdminTool } from "./tools/secrets.js";
import { registerConfigAdminTools } from "./tools/config.js";
import { registerAdminWriteTools } from "./tools/writes.js";
import { registerAdminDataLimitedTools } from "./tools/dataLimited.js";
import { registerAtlassianAdminTools } from "./tools/atlassian.js";
import { registerVelocityAdminTools } from "./tools/velocity.js";
import { registerLifecycleAdminTools } from "./tools/lifecycle.js";
import { registerDemoAdminTools } from "./tools/demo.js";
import { registerRequirementsAssistAdminTools } from "./tools/requirementsAssist.js";
import { registerAgentWorkAdminTools } from "./tools/agentWork.js";
import { registerQualityAdminTools } from "./tools/quality.js";

/**
 * Single point of registration for the `admin.*` tool surface (ADR 0006).
 * Phase 2 = read-only; Phase 3 = writes (audited); Phase 4 = data-limited.
 */
export function registerAdminTools(deps: AdminToolDeps, registry: ToolRegistry): void {
  // Phase 2 — read-only tools backed by EXISTS data.
  registerHealthAdminTool(deps, registry);
  registerProjectsAdminTools(deps, registry);
  registerJobsAdminTool(deps, registry);
  registerAuditAdminTools(deps, registry);
  registerPolicyAdminTools(deps, registry);
  registerSessionsAdminTool(deps, registry);
  registerProvidersAdminTool(deps, registry);
  registerMigrationsAdminTool(deps, registry);
  registerSecretsAdminTool(deps, registry);
  registerConfigAdminTools(deps, registry);

  // Phase 3 — write tools (audited).
  registerAdminWriteTools(deps, registry);

  // Phase 4 — data-limited tools (real but minimal data; record-only writes for missing backends).
  registerAdminDataLimitedTools(deps, registry);

  // Atlassian Cloud bridge: list Cloud projects + adopt them into atl-mcp's lifecycle.
  registerAtlassianAdminTools(deps, registry);

  // Velocity-ops content catalog (phases, templates, agents, workflows) for the operator UI.
  registerVelocityAdminTools(deps, registry);

  // Lifecycle (M5 preview, M6b/c executors, M9 handoff bundle).
  registerLifecycleAdminTools(deps, registry);

  // Role-specific workflow surfaces for Product and Developer lenses.
  registerRequirementsAssistAdminTools(deps, registry);
  registerAgentWorkAdminTools(deps, registry);
  registerQualityAdminTools(deps, registry);

  // Local operator demo data. Seeds real repository rows for the control plane.
  registerDemoAdminTools(deps, registry);
}
