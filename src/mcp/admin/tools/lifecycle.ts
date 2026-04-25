// Lifecycle admin tools — M5 preview, M6b Confluence executor, M6c VCS
// scaffolder, M7 context packs, M9 handoff bundle. Consumed by the operator
// control plane UI to drive the intake-to-handoff flow.
//
// Each write tool emits a signed audit-chain entry through appendOperatorAudit
// (per ADR 0006). Tools that depend on a configured provider (Confluence,
// VCS) report dataLimited when the provider isn't configured rather than
// throwing — keeps the operator UI usable in dev / partial-config setups.

import { z } from "zod";
import { defaultTenantScope } from "../../../domain/tenantScope.js";
import {
  createConfluencePagesWorkflow,
  defaultPageEntries,
  defaultVariables,
} from "../../../workflows/confluencePagesWorkflow.js";
import { createVcsRepoScaffoldWorkflow } from "../../../workflows/vcsRepoScaffoldWorkflow.js";
import {
  VELOCITY_MODULES,
  type VelocityModuleSlug,
} from "../../../velocity/contentRegistry.js";
import type { VcsProvider } from "../../../providers/vcs/VcsProvider.js";
import { createJiraIssueTreeWorkflow } from "../../../workflows/jiraIssueTreeWorkflow.js";
import { appendOperatorAudit } from "../auditedWrite.js";
import type { AdminToolDeps } from "../registry.js";
import type { ToolRegistry } from "../../toolRegistry.js";

// ───── admin.lifecycle.confluence.preview ─────

const CONFLUENCE_PREVIEW_INPUT = z.object({
  projectKey: z.string().min(1),
  spaceId: z.string().min(1).optional(),
}).strict();

const CONFLUENCE_PREVIEW_OUTPUT = z.object({
  projectKey: z.string(),
  pages: z.array(z.object({
    templateSlug: z.string(),
    title: z.string(),
    bodySnippet: z.string(),
    substitutionsMade: z.number().int().nonnegative(),
    unresolvedPlaceholders: z.array(z.string()),
  })),
  totalPages: z.number().int().nonnegative(),
});

function registerConfluencePreview(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.lifecycle.confluence.preview",
      description: "Preview the Confluence page tree atl-mcp would generate for a project. No side effects; renders templates locally.",
      inputSchema: {
        type: "object",
        properties: {
          projectKey: { type: "string" },
          spaceId: { type: "string" },
        },
        required: ["projectKey"],
        additionalProperties: false,
      },
      annotations: { title: "Admin: Confluence preview", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler(params) {
      const input = CONFLUENCE_PREVIEW_INPUT.parse(params);
      const scope = defaultTenantScope();
      const blueprint = await deps.repositories.project.findByKey(scope, input.projectKey);
      if (!blueprint) throw new Error(`unknown project: ${input.projectKey}`);

      const dummyConfluence = {
        kind: "atlassian.confluence" as const,
        name: "preview",
        async healthCheck() { return { reachable: false, checkedAt: new Date().toISOString() }; },
        async discoverSpaceCapabilities() { throw new Error("preview only"); },
        async getPage() { throw new Error("preview only"); },
        async createPage() { throw new Error("preview only"); },
        async updatePage() { throw new Error("preview only"); },
        async getContentProperty() { throw new Error("preview only"); },
        async setContentProperty() { throw new Error("preview only"); },
      };

      const workflow = createConfluencePagesWorkflow({
        registry: deps.velocityRegistry,
        confluence: dummyConfluence,
      });
      const previewInput: Parameters<typeof workflow.preview>[0] = {
        spaceId: input.spaceId ?? "preview-space",
        entries: defaultPageEntries(blueprint),
        variables: defaultVariables(blueprint),
      };
      const result = await workflow.preview(previewInput);
      const output = CONFLUENCE_PREVIEW_OUTPUT.parse({
        projectKey: input.projectKey,
        pages: result.pages.map((p) => ({
          templateSlug: p.templateSlug,
          title: p.title,
          bodySnippet: p.bodyStorage.slice(0, 300),
          substitutionsMade: p.substitutionsMade,
          unresolvedPlaceholders: [...p.unresolvedPlaceholders],
        })),
        totalPages: result.pages.length,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  });
}

// ───── admin.lifecycle.confluence.execute ─────

const CONFLUENCE_EXECUTE_INPUT = z.object({
  projectKey: z.string().min(1),
  spaceId: z.string().min(1),
  reason: z.string().min(4),
  operatorBadge: z.string().optional(),
}).strict();

const CONFLUENCE_EXECUTE_OUTPUT = z.object({
  ok: z.boolean(),
  pagesCreated: z.array(z.object({
    templateSlug: z.string(),
    title: z.string(),
    pageId: z.string(),
    version: z.number().int().nonnegative(),
  })),
  auditEntryId: z.string(),
  dataLimited: z.object({ reason: z.string() }).optional(),
});

function registerConfluenceExecute(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.lifecycle.confluence.execute",
      description: "Generate the Confluence page tree for a project (creates real pages). Audit-logged.",
      inputSchema: {
        type: "object",
        properties: {
          projectKey: { type: "string" },
          spaceId: { type: "string" },
          reason: { type: "string", minLength: 4 },
          operatorBadge: { type: "string" },
        },
        required: ["projectKey", "spaceId", "reason"],
        additionalProperties: false,
      },
      annotations: { title: "Admin: Confluence execute", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async handler(params) {
      const input = CONFLUENCE_EXECUTE_INPUT.parse(params);
      const scope = defaultTenantScope();
      const blueprint = await deps.repositories.project.findByKey(scope, input.projectKey);
      if (!blueprint) throw new Error(`unknown project: ${input.projectKey}`);

      if (!deps.providers.confluence) {
        const audit = await appendOperatorAudit(deps, {
          tool: "admin.lifecycle.confluence.execute",
          input,
          projectId: blueprint.id,
          ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
          errorState: "confluence provider not configured",
        });
        const output = CONFLUENCE_EXECUTE_OUTPUT.parse({
          ok: false,
          pagesCreated: [],
          auditEntryId: audit.id,
          dataLimited: { reason: "Confluence provider is not configured (set CONFLUENCE_BASE_URL + ATLASSIAN_AUTH_MODE)" },
        });
        return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
      }

      const workflow = createConfluencePagesWorkflow({
        registry: deps.velocityRegistry,
        confluence: deps.providers.confluence,
      });
      const executeInput: Parameters<typeof workflow.execute>[0] = {
        spaceId: input.spaceId,
        entries: defaultPageEntries(blueprint),
        variables: defaultVariables(blueprint),
      };
      const result = await workflow.execute(executeInput);
      const audit = await appendOperatorAudit(deps, {
        tool: "admin.lifecycle.confluence.execute",
        input,
        projectId: blueprint.id,
        ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
        outputArtifactIds: result.pages.map((p) => `confluence:${p.pageId}`),
      });
      const output = CONFLUENCE_EXECUTE_OUTPUT.parse({
        ok: true,
        pagesCreated: result.pages.map((p) => ({
          templateSlug: p.templateSlug,
          title: p.title,
          pageId: p.pageId,
          version: p.version,
        })),
        auditEntryId: audit.id,
      });
      return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
    },
  });
}

// ───── admin.lifecycle.vcs.preview ─────

const VCS_PREVIEW_INPUT = z.object({
  projectKey: z.string().min(1),
  workspace: z.string().min(1),
  repoSlug: z.string().min(1),
  stackChoices: z.array(z.string()).optional(),
}).strict();

const VCS_PREVIEW_OUTPUT = z.object({
  projectKey: z.string(),
  workspace: z.string(),
  repoSlug: z.string(),
  files: z.array(z.object({
    path: z.string(),
    bytes: z.number().int().nonnegative(),
    executable: z.boolean(),
    headSnippet: z.string(),
  })),
  totalFiles: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
});

const VELOCITY_MODULE_SET: ReadonlySet<string> = new Set(VELOCITY_MODULES);

function isVelocityModuleSlug(slug: string): slug is VelocityModuleSlug {
  return VELOCITY_MODULE_SET.has(slug);
}

function parseStackChoices(stackChoices: readonly string[] | undefined): readonly VelocityModuleSlug[] | undefined {
  if (stackChoices === undefined) return undefined;
  const parsed: VelocityModuleSlug[] = [];
  for (const slug of stackChoices) {
    if (!isVelocityModuleSlug(slug)) {
      throw new Error(`unknown module slug: ${slug}`);
    }
    parsed.push(slug);
  }
  return parsed;
}

function registerVcsPreview(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.lifecycle.vcs.preview",
      description: "Preview the repo scaffold atl-mcp would seed for a project. No side effects; renders files locally.",
      inputSchema: {
        type: "object",
        properties: {
          projectKey: { type: "string" },
          workspace: { type: "string" },
          repoSlug: { type: "string" },
          stackChoices: { type: "array", items: { type: "string", enum: [...VELOCITY_MODULES] } },
        },
        required: ["projectKey", "workspace", "repoSlug"],
        additionalProperties: false,
      },
      annotations: { title: "Admin: VCS scaffold preview", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler(params) {
      const input = VCS_PREVIEW_INPUT.parse(params);
      const scope = defaultTenantScope();
      const blueprint = await deps.repositories.project.findByKey(scope, input.projectKey);
      if (!blueprint) throw new Error(`unknown project: ${input.projectKey}`);

      const dummyVcs: VcsProvider = {
        kind: "vcs.bitbucket" as const,
        name: "preview",
        async healthCheck() { return { reachable: false, checkedAt: new Date().toISOString() }; },
        async createRepository() { throw new Error("preview only"); },
        async discoverRepoCapabilities() { throw new Error("preview only"); },
        async listBranches() { return []; },
        async createBranch() { throw new Error("preview only"); },
        async getFile() { return undefined; },
        async putFile() { throw new Error("preview only"); },
        async createPullRequest() { throw new Error("preview only"); },
        async getPullRequest() { throw new Error("preview only"); },
        async updatePullRequest() { throw new Error("preview only"); },
      };

      const workflow = createVcsRepoScaffoldWorkflow({
        registry: deps.velocityRegistry,
        vcs: dummyVcs,
      });
      const stackChoices = parseStackChoices(input.stackChoices);
      const result = await workflow.preview(blueprint, {
        workspace: input.workspace,
        repoSlug: input.repoSlug,
        ...(stackChoices ? { stackChoices } : {}),
      });
      const output = VCS_PREVIEW_OUTPUT.parse({
        projectKey: input.projectKey,
        workspace: input.workspace,
        repoSlug: input.repoSlug,
        files: result.files.map((f) => ({
          path: f.path,
          bytes: Buffer.byteLength(f.content, "utf8"),
          executable: f.executable === true,
          headSnippet: f.content.slice(0, 200),
        })),
        totalFiles: result.files.length,
        totalBytes: result.totalBytes,
      });
      return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
    },
  });
}

// ───── admin.lifecycle.vcs.execute ─────

const VCS_EXECUTE_INPUT = z.object({
  projectKey: z.string().min(1),
  workspace: z.string().min(1),
  repoSlug: z.string().min(1),
  reason: z.string().min(4),
  operatorBadge: z.string().optional(),
  stackChoices: z.array(z.string()).optional(),
}).strict();

const VCS_EXECUTE_OUTPUT = z.object({
  ok: z.boolean(),
  repoUrl: z.string().nullable(),
  defaultBranch: z.string().nullable(),
  filesSeeded: z.number().int().nonnegative(),
  alreadyExisted: z.boolean(),
  initialCommitId: z.string().optional(),
  auditEntryId: z.string(),
  dataLimited: z.object({ reason: z.string() }).optional(),
});

function registerVcsExecute(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.lifecycle.vcs.execute",
      description: "Create the Bitbucket repo for a project and seed it from blueprint + velocity templates. Audit-logged.",
      inputSchema: {
        type: "object",
        properties: {
          projectKey: { type: "string" },
          workspace: { type: "string" },
          repoSlug: { type: "string" },
          reason: { type: "string", minLength: 4 },
          operatorBadge: { type: "string" },
          stackChoices: { type: "array", items: { type: "string", enum: [...VELOCITY_MODULES] } },
        },
        required: ["projectKey", "workspace", "repoSlug", "reason"],
        additionalProperties: false,
      },
      annotations: { title: "Admin: VCS scaffold execute", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async handler(params) {
      const input = VCS_EXECUTE_INPUT.parse(params);
      const scope = defaultTenantScope();
      const blueprint = await deps.repositories.project.findByKey(scope, input.projectKey);
      if (!blueprint) throw new Error(`unknown project: ${input.projectKey}`);

      if (!deps.providers.vcs) {
        const audit = await appendOperatorAudit(deps, {
          tool: "admin.lifecycle.vcs.execute",
          input,
          projectId: blueprint.id,
          ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
          errorState: "vcs provider not configured",
        });
        const output = VCS_EXECUTE_OUTPUT.parse({
          ok: false,
          repoUrl: null,
          defaultBranch: null,
          filesSeeded: 0,
          alreadyExisted: false,
          auditEntryId: audit.id,
          dataLimited: { reason: "VCS provider is not configured (set BITBUCKET_USERNAME + BITBUCKET_APP_PASSWORD)" },
        });
        return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
      }

      const workflow = createVcsRepoScaffoldWorkflow({
        registry: deps.velocityRegistry,
        vcs: deps.providers.vcs,
      });
      try {
        const stackChoices = parseStackChoices(input.stackChoices);
        const result = await workflow.execute(blueprint, {
          workspace: input.workspace,
          repoSlug: input.repoSlug,
          ...(stackChoices ? { stackChoices } : {}),
        });
        const audit = await appendOperatorAudit(deps, {
          tool: "admin.lifecycle.vcs.execute",
          input,
          projectId: blueprint.id,
          ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
          outputArtifactIds: [`vcs:${result.repoUrl}`],
        });
        const output = VCS_EXECUTE_OUTPUT.parse({
          ok: true,
          repoUrl: result.repoUrl,
          defaultBranch: result.defaultBranch,
          filesSeeded: result.filesSeeded,
          alreadyExisted: result.alreadyExisted,
          ...(result.initialCommitId ? { initialCommitId: result.initialCommitId } : {}),
          auditEntryId: audit.id,
        });
        return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const audit = await appendOperatorAudit(deps, {
          tool: "admin.lifecycle.vcs.execute",
          input,
          projectId: blueprint.id,
          ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
          errorState: message,
        });
        const output = VCS_EXECUTE_OUTPUT.parse({
          ok: false,
          repoUrl: null,
          defaultBranch: null,
          filesSeeded: 0,
          alreadyExisted: false,
          auditEntryId: audit.id,
          dataLimited: { reason: message },
        });
        return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
      }
    },
  });
}

// ───── admin.lifecycle.handoff.bundle ─────

const HANDOFF_INPUT = z.object({
  projectKey: z.string().min(1),
  jiraProjectKey: z.string().optional(),
  confluenceSpaceId: z.string().optional(),
  repoUrl: z.string().optional(),
  reason: z.string().min(4),
  operatorBadge: z.string().optional(),
}).strict();

const HANDOFF_OUTPUT = z.object({
  ok: z.boolean(),
  bundleId: z.string(),
  packet: z.object({
    project: z.object({
      key: z.string(),
      name: z.string(),
      blueprintVersion: z.number(),
      state: z.string(),
    }),
    artifacts: z.object({
      jiraProjectKey: z.string().nullable(),
      confluenceSpaceId: z.string().nullable(),
      repoUrl: z.string().nullable(),
    }),
    auditChainHead: z.object({
      length: z.number().int().nonnegative(),
      lastVerifiedAt: z.string(),
      signingKeyId: z.string(),
    }),
    rolesIncluded: z.array(z.string()),
    workflowsIncluded: z.array(z.string()),
  }),
  auditEntryId: z.string(),
});

function registerHandoffBundle(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.lifecycle.handoff.bundle",
      description: "Compose the M9 handoff packet for a project. Includes Jira/Confluence/repo references, audit-chain head, and the bundled agent role-card list.",
      inputSchema: {
        type: "object",
        properties: {
          projectKey: { type: "string" },
          jiraProjectKey: { type: "string" },
          confluenceSpaceId: { type: "string" },
          repoUrl: { type: "string" },
          reason: { type: "string", minLength: 4 },
          operatorBadge: { type: "string" },
        },
        required: ["projectKey", "reason"],
        additionalProperties: false,
      },
      annotations: { title: "Admin: handoff bundle", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async handler(params) {
      const input = HANDOFF_INPUT.parse(params);
      const scope = defaultTenantScope();
      const blueprint = await deps.repositories.project.findByKey(scope, input.projectKey);
      if (!blueprint) throw new Error(`unknown project: ${input.projectKey}`);

      const auditChain = await deps.repositories.audit.readChainForProject(scope, null);
      const verification = await deps.repositories.audit.verifyChain(scope, null);
      const manifest = deps.velocityRegistry.manifest();

      const audit = await appendOperatorAudit(deps, {
        tool: "admin.lifecycle.handoff.bundle",
        input,
        projectId: blueprint.id,
        ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
      });

      const output = HANDOFF_OUTPUT.parse({
        ok: verification.mismatches.length === 0,
        bundleId: audit.id,
        packet: {
          project: {
            key: blueprint.key,
            name: blueprint.name,
            blueprintVersion: blueprint.blueprintVersion,
            state: blueprint.state,
          },
          artifacts: {
            jiraProjectKey: input.jiraProjectKey ?? blueprint.atlassianProjectKey ?? null,
            confluenceSpaceId: input.confluenceSpaceId ?? null,
            repoUrl: input.repoUrl ?? null,
          },
          auditChainHead: {
            length: auditChain.length,
            lastVerifiedAt: new Date().toISOString(),
            signingKeyId: deps.auditSigner.keyId,
          },
          rolesIncluded: [...manifest.agents],
          workflowsIncluded: [...manifest.workflows],
        },
        auditEntryId: audit.id,
      });
      return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
    },
  });
}

// ───── admin.lifecycle.jira.preview ─────

const JIRA_PREVIEW_INPUT = z.object({
  projectKey: z.string().min(1),
}).strict();

const JIRA_PREVIEW_OUTPUT = z.object({
  projectKey: z.string(),
  plannedNodes: z.array(z.object({
    kind: z.enum(["epic", "story", "task"]),
    nodeId: z.string(),
    title: z.string(),
  })),
  totalNodes: z.number().int().nonnegative(),
});

function registerJiraPreview(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.lifecycle.jira.preview",
      description: "Preview the Jira issue tree atl-mcp would create for a project. Walks blueprint epics and stories. No side effects.",
      inputSchema: {
        type: "object",
        properties: { projectKey: { type: "string" } },
        required: ["projectKey"],
        additionalProperties: false,
      },
      annotations: { title: "Admin: Jira preview", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler(params) {
      const input = JIRA_PREVIEW_INPUT.parse(params);
      const scope = defaultTenantScope();
      const blueprint = await deps.repositories.project.findByKey(scope, input.projectKey);
      if (!blueprint) throw new Error(`unknown project: ${input.projectKey}`);

      const dummyJira = {
        kind: "atlassian.jira" as const,
        name: "preview",
        async healthCheck() { return { reachable: false, checkedAt: new Date().toISOString() }; },
        async discoverProjectCapabilities() { throw new Error("preview only"); },
        async listProjects() { return []; },
        async searchByJql() { return []; },
        async getIssue() { throw new Error("preview only"); },
        async createIssue() { throw new Error("preview only"); },
        async updateIssue() { throw new Error("preview only"); },
      };
      const workflow = createJiraIssueTreeWorkflow({ jira: dummyJira });
      const preview = await workflow.preview(blueprint, { jiraProjectKey: blueprint.atlassianProjectKey ?? blueprint.key });
      const output = JIRA_PREVIEW_OUTPUT.parse({
        projectKey: input.projectKey,
        plannedNodes: preview.plannedNodes.map((n) => ({ kind: n.kind, nodeId: n.nodeId, title: n.title })),
        totalNodes: preview.plannedNodes.length,
      });
      return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
    },
  });
}

// ───── admin.lifecycle.jira.execute ─────

const JIRA_EXECUTE_INPUT = z.object({
  projectKey: z.string().min(1),
  jiraProjectKey: z.string().min(1),
  reason: z.string().min(4),
  operatorBadge: z.string().optional(),
}).strict();

const JIRA_EXECUTE_OUTPUT = z.object({
  ok: z.boolean(),
  created: z.array(z.object({
    nodeKind: z.string(),
    nodeId: z.string(),
    title: z.string(),
    issueKey: z.string(),
    issueId: z.string(),
  })),
  totalCreated: z.number().int().nonnegative(),
  auditEntryId: z.string(),
  dataLimited: z.object({ reason: z.string() }).optional(),
});

function registerJiraExecute(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.lifecycle.jira.execute",
      description: "Create the Jira issue tree (epics + stories + tasks) for a project. Audit-logged. Idempotent on re-run with same blueprint version.",
      inputSchema: {
        type: "object",
        properties: {
          projectKey: { type: "string" },
          jiraProjectKey: { type: "string" },
          reason: { type: "string", minLength: 4 },
          operatorBadge: { type: "string" },
        },
        required: ["projectKey", "jiraProjectKey", "reason"],
        additionalProperties: false,
      },
      annotations: { title: "Admin: Jira execute", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async handler(params) {
      const input = JIRA_EXECUTE_INPUT.parse(params);
      const scope = defaultTenantScope();
      const blueprint = await deps.repositories.project.findByKey(scope, input.projectKey);
      if (!blueprint) throw new Error(`unknown project: ${input.projectKey}`);

      if (!deps.providers.jira) {
        const audit = await appendOperatorAudit(deps, {
          tool: "admin.lifecycle.jira.execute",
          input,
          projectId: blueprint.id,
          ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
          errorState: "jira provider not configured",
        });
        const output = JIRA_EXECUTE_OUTPUT.parse({
          ok: false,
          created: [],
          totalCreated: 0,
          auditEntryId: audit.id,
          dataLimited: { reason: "Jira provider is not configured (set JIRA_BASE_URL + ATLASSIAN_AUTH_MODE)" },
        });
        return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
      }

      const workflow = createJiraIssueTreeWorkflow({ jira: deps.providers.jira });
      try {
        const result = await workflow.execute(blueprint, { jiraProjectKey: input.jiraProjectKey });
        const audit = await appendOperatorAudit(deps, {
          tool: "admin.lifecycle.jira.execute",
          input,
          projectId: blueprint.id,
          ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
          outputArtifactIds: result.created.map((c) => `jira:${c.issueKey}`),
        });
        const output = JIRA_EXECUTE_OUTPUT.parse({
          ok: result.created.length > 0 || result.skippedReason !== undefined,
          created: result.created.map((c) => ({ nodeKind: c.nodeKind, nodeId: c.nodeId, title: c.title, issueKey: c.issueKey, issueId: c.issueId })),
          totalCreated: result.created.length,
          auditEntryId: audit.id,
          ...(result.skippedReason ? { dataLimited: { reason: result.skippedReason } } : {}),
        });
        return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const audit = await appendOperatorAudit(deps, {
          tool: "admin.lifecycle.jira.execute",
          input,
          projectId: blueprint.id,
          ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
          errorState: message,
        });
        const output = JIRA_EXECUTE_OUTPUT.parse({
          ok: false,
          created: [],
          totalCreated: 0,
          auditEntryId: audit.id,
          dataLimited: { reason: message },
        });
        return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
      }
    },
  });
}

export function registerLifecycleAdminTools(deps: AdminToolDeps, registry: ToolRegistry): void {
  registerJiraPreview(deps, registry);
  registerJiraExecute(deps, registry);
  registerConfluencePreview(deps, registry);
  registerConfluenceExecute(deps, registry);
  registerVcsPreview(deps, registry);
  registerVcsExecute(deps, registry);
  registerHandoffBundle(deps, registry);
}
