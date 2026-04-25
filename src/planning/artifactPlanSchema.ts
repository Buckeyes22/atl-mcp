import { z } from "zod";

const ARTIFACT_REF_SCHEMA = z.object({
  kind: z.enum(["jira_issue", "confluence_page", "vcs_repo", "vcs_branch", "vcs_pull_request", "vcs_file", "blueprint_section", "uio_source"]),
  id: z.string().min(1),
  version: z.string().optional(),
  url: z.string().optional(),
});

const POLICY_DECISION_SCHEMA = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  toolName: z.string().min(1),
  effect: z.enum(["allow", "deny", "require_approval"]),
  reasons: z.array(z.string()),
  obligations: z.array(z.object({
    kind: z.enum([
      "require_preview",
      "require_fresh_preflight",
      "require_human_approval",
      "require_access_gate_allow",
      "require_non_dirty_context",
      "require_sandbox_target",
      "require_tenant_scope",
      "require_read_only_mode",
      "require_approve_each_tool",
    ]),
    message: z.string(),
  })),
  evaluatedAt: z.string().min(1),
  confidenceCategorical: z.enum(["very_low", "low", "medium", "high", "very_high"]),
  confidenceScore: z.number().min(0).max(1),
  checks: z.array(z.object({
    name: z.string().min(1),
    checked: z.boolean(),
    confidence: z.number().int().min(0).max(100),
  })),
});

const TRIPLET_SCHEMA = z.object({
  verdict: z.enum(["PASS", "FAIL"]),
  critics: z.array(z.object({
    name: z.enum(["false_positive_filter", "missing_issues_finder", "context_validator"]),
    pass: z.boolean(),
    findings: z.array(z.string()),
  })),
  synthesizedAt: z.string().min(1),
});

const PLANNED_ACTION_BASE_SCHEMA = z.object({
  id: z.string().min(1),
  action: z.enum(["create", "update", "no_op", "blocked"]),
  blueprintRef: ARTIFACT_REF_SCHEMA,
  idempotencyKey: z.string().min(1),
  policy: POLICY_DECISION_SCHEMA,
  blockedReason: z.string().optional(),
});

export const ARTIFACT_PLAN_SCHEMA = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  blueprintVersion: z.number().int().positive(),
  jiraProjectKey: z.string().min(1),
  actorAttribution: z.object({
    principalId: z.string().min(1),
    fingerprint: z.string().min(1),
    authMode: z.enum(["api_token", "oauth3lo", "service_account"]),
    jiraLabel: z.string().min(1),
    metadataBlock: z.string().min(1),
  }),
  actions: z.array(z.discriminatedUnion("target", [
    PLANNED_ACTION_BASE_SCHEMA.extend({
      target: z.literal("jira_issue"),
      issueType: z.enum(["Epic", "Story", "Task"]),
      summary: z.string().min(1),
      description: z.array(z.string()),
      labels: z.array(z.string()),
    }),
    PLANNED_ACTION_BASE_SCHEMA.extend({
      target: z.literal("confluence_page"),
      spaceId: z.string().min(1),
      title: z.string().min(1),
      bodyStorage: z.string().min(1),
      metadata: z.record(z.unknown()),
    }),
    PLANNED_ACTION_BASE_SCHEMA.extend({
      target: z.literal("vcs_file"),
      workspace: z.string().min(1),
      repoSlug: z.string().min(1),
      branch: z.string().min(1),
      baseBranch: z.string().min(1),
      path: z.string().min(1),
      contents: z.string(),
      commitMessage: z.string().min(1),
    }),
    PLANNED_ACTION_BASE_SCHEMA.extend({
      target: z.literal("vcs_pull_request"),
      workspace: z.string().min(1),
      repoSlug: z.string().min(1),
      sourceBranch: z.string().min(1),
      destinationBranch: z.string().min(1),
      title: z.string().min(1),
      description: z.string(),
    }),
  ])),
  estimatedRequestCount: z.number().int().nonnegative(),
  triplet: TRIPLET_SCHEMA.optional(),
});
