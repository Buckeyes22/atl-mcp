// Phase 3 write tools — every operation here:
//   1. Validates input via zod.
//   2. Performs the underlying side-effect (DB / queue / repository call).
//   3. Emits a signed audit chain entry through appendOperatorAudit().
//
// All writes accept a `reason` field that is hashed into inputHash and
// recorded verbatim in the audit chain payload. The UI's ConfirmModal
// requires the reason be at least a few characters.

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { defaultTenantScope } from "../../../domain/tenantScope.js";
import { canTransition, type ProjectState, PROJECT_STATES, IllegalStateTransitionError } from "../../../domain/projectState.js";
import type { ProjectBlueprint } from "../../../domain/projectBlueprint.js";
import type { PolicyDecision } from "../../../domain/policyDecision.js";
import { appendOperatorAudit } from "../auditedWrite.js";
import type { AdminToolDeps } from "../registry.js";
import type { ToolRegistry } from "../../toolRegistry.js";

// ───── admin.projects.transition ─────

const TRANSITION_INPUT = z.object({
  key: z.string().min(1),
  toState: z.enum(PROJECT_STATES as readonly [string, ...string[]]),
  reason: z.string().min(4),
  operatorBadge: z.string().optional(),
}).strict();

const TRANSITION_OUTPUT = z.object({
  ok: z.boolean(),
  previousState: z.string(),
  newState: z.string(),
  auditEntryId: z.string(),
});

function registerProjectsTransition(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.projects.transition",
      description: "Operator-driven project state transition (audited). The reason is recorded in the audit chain.",
      inputSchema: {
        type: "object",
        properties: {
          key: { type: "string" },
          toState: { type: "string", enum: PROJECT_STATES as unknown as string[] },
          reason: { type: "string", minLength: 4 },
          operatorBadge: { type: "string" },
        },
        required: ["key", "toState", "reason"],
        additionalProperties: false,
      },
      annotations: { title: "Admin: project state transition", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async handler(params) {
      const input = TRANSITION_INPUT.parse(params);
      const scope = defaultTenantScope();
      const project = await deps.repositories.project.findByKey(scope, input.key);
      if (!project) throw new Error(`unknown project: ${input.key}`);
      const prev = project.state;
      const next = input.toState as ProjectState;
      if (!canTransition(prev, next)) throw new IllegalStateTransitionError(prev, next);

      const updated: ProjectBlueprint = {
        ...project,
        state: next,
        blueprintVersion: project.blueprintVersion + 1,
        updatedAt: new Date().toISOString(),
      };
      await deps.repositories.project.update(scope, updated);

      const audit = await appendOperatorAudit(deps, {
        tool: "admin.projects.transition",
        input,
        projectId: project.id,
        ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
      });

      const output = TRANSITION_OUTPUT.parse({
        ok: true,
        previousState: prev,
        newState: next,
        auditEntryId: audit.id,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  });
}

// ───── admin.audit.verify ─────

const AUDIT_VERIFY_INPUT = z.object({
  projectId: z.string().optional(),
  operatorBadge: z.string().optional(),
}).strict();

const AUDIT_VERIFY_OUTPUT = z.object({
  ok: z.boolean(),
  entriesChecked: z.number().int().nonnegative(),
  mismatches: z.array(z.object({ entryId: z.string(), reason: z.string() })),
  auditEntryId: z.string(),
});

function registerAuditVerify(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.audit.verify",
      description: "Run the audit chain integrity verifier on demand. Records the verification request as an audit entry.",
      inputSchema: {
        type: "object",
        properties: { projectId: { type: "string" }, operatorBadge: { type: "string" } },
        additionalProperties: false,
      },
      annotations: { title: "Admin: verify audit chain", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler(params) {
      const input = AUDIT_VERIFY_INPUT.parse(params ?? {});
      const scope = defaultTenantScope();
      const verification = await deps.repositories.audit.verifyChain(scope, input.projectId ?? null);
      const audit = await appendOperatorAudit(deps, {
        tool: "admin.audit.verify",
        input,
        ...(input.projectId ? { projectId: input.projectId } : {}),
        ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
        ...(verification.mismatches.length > 0 ? { errorState: `${verification.mismatches.length} mismatch(es)` } : {}),
      });
      const output = AUDIT_VERIFY_OUTPUT.parse({
        ok: verification.mismatches.length === 0,
        entriesChecked: verification.entriesChecked,
        mismatches: verification.mismatches.map((m) => ({ entryId: m.entryId, reason: m.reason })),
        auditEntryId: audit.id,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  });
}

// ───── admin.policy.approve / admin.policy.deny ─────

const POLICY_DECISION_INPUT = z.object({
  decisionId: z.string().min(1),
  reason: z.string().min(4),
  operatorBadge: z.string().optional(),
}).strict();

const POLICY_DECISION_OUTPUT = z.object({
  ok: z.boolean(),
  followUpDecisionId: z.string(),
  auditEntryId: z.string(),
});

function registerPolicyApproveDeny(deps: AdminToolDeps, registry: ToolRegistry): void {
  for (const verb of ["approve", "deny"] as const) {
    const effect = verb === "approve" ? "allow" : "deny";
    registry.register({
      definition: {
        name: `admin.policy.${verb}`,
        description: `Operator ${verb} for a require_approval policy decision. Records a follow-up decision and an audit entry.`,
        inputSchema: {
          type: "object",
          properties: {
            decisionId: { type: "string" },
            reason: { type: "string", minLength: 4 },
            operatorBadge: { type: "string" },
          },
          required: ["decisionId", "reason"],
          additionalProperties: false,
        },
        annotations: { title: `Admin: ${verb} policy decision`, readOnlyHint: false, destructiveHint: verb === "deny", idempotentHint: false, openWorldHint: false },
      },
      async handler(params) {
        const input = POLICY_DECISION_INPUT.parse(params);
        const scope = defaultTenantScope();
        const original = await deps.repositories.policyDecision.findById(scope, input.decisionId);
        if (!original) throw new Error(`unknown policy decision: ${input.decisionId}`);

        const followUp: PolicyDecision = {
          ...original,
          id: randomUUID(),
          effect,
          confidenceCategorical: "high",
          confidenceScore: 1.0,
          evaluatedAt: new Date().toISOString(),
        };
        await deps.repositories.policyDecision.insert(scope, followUp);

        const audit = await appendOperatorAudit(deps, {
          tool: `admin.policy.${verb}`,
          input,
          ...(original.projectId ? { projectId: original.projectId } : {}),
          ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
        });

        const output = POLICY_DECISION_OUTPUT.parse({
          ok: true,
          followUpDecisionId: followUp.id,
          auditEntryId: audit.id,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
          structuredContent: output,
        };
      },
    });
  }
}

// ───── admin.providers.probe ─────

const PROBE_INPUT = z.object({
  id: z.enum(["jira", "confluence", "bitbucket"]),
  operatorBadge: z.string().optional(),
}).strict();

const PROBE_OUTPUT = z.object({
  id: z.string(),
  reachable: z.boolean(),
  latencyMs: z.number().nullable(),
  details: z.string().nullable(),
  auditEntryId: z.string(),
});

function registerProvidersProbe(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.providers.probe",
      description: "Run a healthCheck() against a configured provider on demand. Audit-logged.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", enum: ["jira", "confluence", "bitbucket"] },
          operatorBadge: { type: "string" },
        },
        required: ["id"],
        additionalProperties: false,
      },
      annotations: { title: "Admin: probe provider", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async handler(params) {
      const input = PROBE_INPUT.parse(params);
      const provider = pickProvider(deps, input.id);
      let reachable = false;
      let latencyMs: number | null = null;
      let details: string | null = null;
      if (!provider) {
        details = "provider not configured";
      } else {
        try {
          const h = await provider.healthCheck();
          reachable = h.reachable;
          latencyMs = h.latencyMs ?? null;
          details = h.details ?? null;
        } catch (err) {
          details = err instanceof Error ? err.message : String(err);
        }
      }
      const audit = await appendOperatorAudit(deps, {
        tool: "admin.providers.probe",
        input,
        ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
        ...(reachable ? {} : { errorState: details ?? "unreachable" }),
      });
      const output = PROBE_OUTPUT.parse({
        id: input.id,
        reachable,
        latencyMs,
        details,
        auditEntryId: audit.id,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  });
}

interface ProbeShape {
  healthCheck(): Promise<{ reachable: boolean; details?: string; latencyMs?: number }>;
}
function pickProvider(deps: AdminToolDeps, id: "jira" | "confluence" | "bitbucket"): ProbeShape | undefined {
  if (id === "jira") return deps.providers.jira as ProbeShape | undefined;
  if (id === "confluence") return deps.providers.confluence as ProbeShape | undefined;
  return deps.providers.vcs as ProbeShape | undefined;
}

// ───── admin.migrations.apply ─────

const MIGRATIONS_APPLY_INPUT = z.object({
  reason: z.string().min(4),
  operatorBadge: z.string().optional(),
}).strict();

const MIGRATIONS_APPLY_OUTPUT = z.object({
  applied: z.array(z.string()),
  skipped: z.array(z.string()),
  auditEntryId: z.string(),
});

function registerMigrationsApply(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.migrations.apply",
      description: "Apply all pending DB migrations. Idempotent — already-applied versions are skipped. Audit-logged.",
      inputSchema: {
        type: "object",
        properties: {
          reason: { type: "string", minLength: 4 },
          operatorBadge: { type: "string" },
        },
        required: ["reason"],
        additionalProperties: false,
      },
      annotations: { title: "Admin: apply migrations", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async handler(params) {
      const input = MIGRATIONS_APPLY_INPUT.parse(params);
      const result = await deps.db.migrate();
      const audit = await appendOperatorAudit(deps, {
        tool: "admin.migrations.apply",
        input,
        ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
      });
      const output = MIGRATIONS_APPLY_OUTPUT.parse({
        applied: result.applied,
        skipped: result.skipped,
        auditEntryId: audit.id,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  });
}

// ───── admin.jobs.queue.pause / resume ─────

const QUEUE_PAUSE_INPUT = z.object({
  reason: z.string().min(4),
  operatorBadge: z.string().optional(),
}).strict();

const QUEUE_RESUME_INPUT = z.object({
  operatorBadge: z.string().optional(),
}).strict();

const QUEUE_STATE_OUTPUT = z.object({
  ok: z.boolean(),
  paused: z.boolean(),
  auditEntryId: z.string(),
});

function registerQueuePauseResume(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.jobs.queue.pause",
      description: "Pause the provisioning queue. In-flight jobs continue to completion. Audit-logged.",
      inputSchema: {
        type: "object",
        properties: { reason: { type: "string", minLength: 4 }, operatorBadge: { type: "string" } },
        required: ["reason"],
        additionalProperties: false,
      },
      annotations: { title: "Admin: pause queue", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler(params) {
      const input = QUEUE_PAUSE_INPUT.parse(params);
      if (!deps.provisionQueue) throw new Error("provisioning queue is not configured (MILESTONE_6A_ENABLED=false)");
      await deps.provisionQueue.pause();
      const paused = await deps.provisionQueue.isPaused();
      const audit = await appendOperatorAudit(deps, {
        tool: "admin.jobs.queue.pause",
        input,
        ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
      });
      const output = QUEUE_STATE_OUTPUT.parse({ ok: true, paused, auditEntryId: audit.id });
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  });

  registry.register({
    definition: {
      name: "admin.jobs.queue.resume",
      description: "Resume the provisioning queue. Audit-logged.",
      inputSchema: {
        type: "object",
        properties: { operatorBadge: { type: "string" } },
        additionalProperties: false,
      },
      annotations: { title: "Admin: resume queue", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler(params) {
      const input = QUEUE_RESUME_INPUT.parse(params ?? {});
      if (!deps.provisionQueue) throw new Error("provisioning queue is not configured (MILESTONE_6A_ENABLED=false)");
      await deps.provisionQueue.resume();
      const paused = await deps.provisionQueue.isPaused();
      const audit = await appendOperatorAudit(deps, {
        tool: "admin.jobs.queue.resume",
        input,
        ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
      });
      const output = QUEUE_STATE_OUTPUT.parse({ ok: true, paused, auditEntryId: audit.id });
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  });
}

export function registerAdminWriteTools(deps: AdminToolDeps, registry: ToolRegistry): void {
  registerProjectsTransition(deps, registry);
  registerAuditVerify(deps, registry);
  registerPolicyApproveDeny(deps, registry);
  registerProvidersProbe(deps, registry);
  registerMigrationsApply(deps, registry);
  registerQueuePauseResume(deps, registry);
}
