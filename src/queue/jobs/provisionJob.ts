import { randomUUID } from "node:crypto";
import type { AuditEntry } from "../../domain/auditEntry.js";
import type { TenantScope } from "../../domain/tenantScope.js";
import type { TraceLink } from "../../domain/traceLink.js";
import type { JiraProvider } from "../../providers/atlassian/jiraProvider.js";
import { doc, paragraph, text } from "../../providers/atlassian/adf.js";
import type { ArtifactPlan } from "../../planning/artifactPlan.js";
import type { AuditRepository } from "../../storage/repositories/auditRepository.js";
import type { PolicyDecisionRepository } from "../../storage/repositories/policyDecisionRepository.js";
import type { ProjectProfileRepository } from "../../storage/repositories/projectProfileRepository.js";
import type { TraceLinkRepository } from "../../storage/repositories/traceLinkRepository.js";
import { auditPayloadHash, sha256Text, type AuditSigner } from "../../security/auditChain.js";
import type { PolicyDecisionLayer } from "../../security/policyDecisionLayer.js";

export interface ProvisionExecutionInput {
  readonly plan: ArtifactPlan;
  readonly approved: boolean;
  readonly approvalEvidence: {
    readonly approvedBy: string;
    readonly approvedAt: string;
    readonly previewPlanId: string;
    readonly projectProfileId: string;
  };
}

export interface ProvisionExecutionResult {
  readonly projectId: string;
  readonly createdIssues: ReadonlyArray<{ actionId: string; issueId: string; issueKey: string }>;
  readonly skippedActions: ReadonlyArray<{ actionId: string; reason: string }>;
  readonly auditEntryId: string;
}

export function createProvisionJobExecutor(deps: {
  readonly jira: JiraProvider;
  readonly policy: PolicyDecisionLayer;
  readonly traceLink: TraceLinkRepository;
  readonly audit: AuditRepository;
  readonly projectProfile: ProjectProfileRepository;
  readonly policyDecision: PolicyDecisionRepository;
  readonly signer: AuditSigner;
  readonly now?: () => string;
}) {
  const now = deps.now ?? (() => new Date().toISOString());
  return {
    async execute(scope: TenantScope, input: ProvisionExecutionInput): Promise<ProvisionExecutionResult> {
      if (input.plan.triplet?.verdict !== "PASS") throw new Error("provision execute requires adversarial triplet PASS");
      if (!input.approved) throw new Error("provision execute requires explicit approval");
      if (input.approvalEvidence.previewPlanId !== input.plan.id) {
        throw new Error("approval evidence must reference the exact preview plan id");
      }
      const profile = await deps.projectProfile.findById(scope, input.approvalEvidence.projectProfileId);
      if (!profile || profile.projectId !== input.plan.projectId) {
        throw new Error("fresh preflight profile is required for provision execute");
      }
      if (Date.parse(profile.expiresAt) <= Date.parse(now())) {
        throw new Error("fresh preflight profile is required for provision execute");
      }
      if (profile.accessGateMode !== "local") {
        throw new Error(`access gate mode ${profile.accessGateMode} is not executable by the local M6a gate`);
      }
      const createdIssues: Array<{ actionId: string; issueId: string; issueKey: string }> = [];
      const skippedActions: Array<{ actionId: string; reason: string }> = [];
      for (const action of input.plan.actions) {
        if (action.target !== "jira_issue") {
          skippedActions.push({ actionId: action.id, reason: `target ${action.target} is handled by the shared provider executor, not the Jira executor` });
          continue;
        }
        const existing = await deps.traceLink.findBySource(scope, action.blueprintRef.kind, action.blueprintRef.id);
        const issueLink = existing.find((link) => link.projectId === input.plan.projectId && link.target.kind === "jira_issue");
        if (issueLink) {
          skippedActions.push({ actionId: action.id, reason: `already linked to ${issueLink.target.id}` });
          continue;
        }
        if (action.action !== "create") {
          skippedActions.push({ actionId: action.id, reason: `action ${action.action} is not executable in M6a` });
          continue;
        }

        // F-002: PolicyDecisionLayer must approve every external write per v6 §28 M6a acceptance.
        const decision = await deps.policy.decide(scope, {
          toolName: "project_provision_execute",
          projectId: input.plan.projectId,
          intent: "mutate_external",
          attributes: { target: "jira_issue", actionId: action.id, idempotencyKey: action.idempotencyKey },
        });
        await deps.policyDecision.insert(scope, decision);
        if (decision.effect === "deny") {
          skippedActions.push({ actionId: action.id, reason: `policy denied: ${decision.reasons.join("; ")}` });
          continue;
        }
        if (decision.effect === "require_approval" && !input.approved) {
          skippedActions.push({ actionId: action.id, reason: `policy requires approval: ${decision.reasons.join("; ")}` });
          continue;
        }

        const issue = await deps.jira.createIssue({
          projectKey: input.plan.jiraProjectKey,
          issueType: action.issueType,
          summary: action.summary,
          labels: action.labels,
          idempotencyKey: action.idempotencyKey,
          description: doc(...action.description.map((line) => paragraph(text(line)))),
        });
        createdIssues.push({ actionId: action.id, issueId: issue.id, issueKey: issue.key });
        await deps.traceLink.create(scope, buildIssueLink(scope, input.plan.projectId, action.blueprintRef, issue.key, now()));
      }
      const auditEntry = await appendAudit(scope, deps, input, createdIssues, now());
      return { projectId: input.plan.projectId, createdIssues, skippedActions, auditEntryId: auditEntry.id };
    },
  };
}

function buildIssueLink(
  scope: TenantScope,
  projectId: string,
  source: TraceLink["source"],
  issueKey: string,
  createdAt: string,
): TraceLink {
  return {
    id: randomUUID(),
    tenantId: scope.tenantId,
    projectId,
    source,
    target: { kind: "jira_issue", id: issueKey },
    relation: "implements",
    createdAt,
    observedBy: "project_provision_execute",
  };
}

async function appendAudit(
  scope: TenantScope,
  deps: { readonly audit: AuditRepository; readonly signer: AuditSigner },
  input: ProvisionExecutionInput,
  createdIssues: ReadonlyArray<{ actionId: string; issueId: string; issueKey: string }>,
  timestamp: string,
): Promise<AuditEntry> {
  const chain = await deps.audit.readChainForProject(scope, input.plan.projectId);
  const prevHash = chain.length === 0 ? "0" : auditPayloadHash(chain[chain.length - 1]);
  const unsigned: AuditEntry = {
    id: randomUUID(),
    tenantId: scope.tenantId,
    projectId: input.plan.projectId,
    timestamp,
    actor: {
      mcpPrincipalId: input.plan.actorAttribution.principalId,
      mcpPrincipalFingerprint: input.plan.actorAttribution.fingerprint,
      credentialFingerprint: input.plan.actorAttribution.fingerprint,
      authMode: input.plan.actorAttribution.authMode,
    },
    toolName: "project_provision_execute",
    inputHash: sha256Text(JSON.stringify({ planId: input.plan.id, approved: input.approved })),
    outputArtifactIds: createdIssues.map((issue) => issue.issueKey),
    prevHash,
    signature: { alg: "ed25519", keyId: deps.signer.keyId, value: "" },
  };
  return deps.audit.append(scope, { entry: deps.signer.sign(unsigned) });
}
