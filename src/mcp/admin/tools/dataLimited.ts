// Phase 4 data-limited tools — backends that aren't yet implemented in v1.
//
// Every tool here returns REAL but minimal data. The `dataLimited` field is
// surfaced in structuredContent so the UI can render an explicit "data
// limited" badge naming what's missing. Writes that have no underlying
// implementation still record an audit chain entry — operator INTENT is
// always visible — and return a `dataLimited.reason` so the UI can show why
// the action was record-only.

import { z } from "zod";
import { defaultTenantScope } from "../../../domain/tenantScope.js";
import { appendOperatorAudit } from "../auditedWrite.js";
import type { AdminToolDeps } from "../registry.js";
import type { ToolRegistry } from "../../toolRegistry.js";

// ───── admin.alerts.list ─────

const ALERTS_OUTPUT = z.object({
  alerts: z.array(z.object({
    id: z.string(),
    name: z.string(),
    severity: z.enum(["P0", "P1", "P2"]),
    firedAt: z.string(),
    threshold: z.string(),
    current: z.string(),
    runbookRef: z.string(),
  })),
  dataLimited: z.object({ reason: z.string() }),
});

function registerAlertsList(_deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.alerts.list",
      description: "Active alerts. v1 returns []; alertmanager integration is post-v1 (v6 §28 M11+).",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { title: "Admin: alerts (data limited)", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler() {
      const output = ALERTS_OUTPUT.parse({
        alerts: [],
        dataLimited: { reason: "alerting layer not wired (alertmanager integration deferred per v6 §28 M11+; see docs/sdlc/08-operations/alerting.md)" },
      });
      return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
    },
  });
}

// ───── admin.alerts.ack ─────

const ALERTS_ACK_INPUT = z.object({
  alertId: z.string().min(1),
  reason: z.string().min(4),
  operatorBadge: z.string().optional(),
}).strict();

const ALERTS_ACK_OUTPUT = z.object({
  ok: z.boolean(),
  auditEntryId: z.string(),
  dataLimited: z.object({ reason: z.string() }),
});

function registerAlertsAck(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.alerts.ack",
      description: "Acknowledge an alert. v1 records the operator intent in the audit chain; the alerting layer is post-v1.",
      inputSchema: {
        type: "object",
        properties: {
          alertId: { type: "string" },
          reason: { type: "string", minLength: 4 },
          operatorBadge: { type: "string" },
        },
        required: ["alertId", "reason"],
        additionalProperties: false,
      },
      annotations: { title: "Admin: ack alert", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler(params) {
      const input = ALERTS_ACK_INPUT.parse(params);
      const audit = await appendOperatorAudit(deps, {
        tool: "admin.alerts.ack",
        input,
        ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
      });
      const output = ALERTS_ACK_OUTPUT.parse({
        ok: true,
        auditEntryId: audit.id,
        dataLimited: { reason: "alerting layer not wired; ack is recorded but no alert state mutates" },
      });
      return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
    },
  });
}

// ───── admin.slos.list ─────

const SLOS = [
  { name: "mcp_session_establishment_success", target: "≥ 99%", window: "rolling 7d", consequence: "P1 review" },
  { name: "mcp_tool_call_latency_p99", target: "≤ 2000 ms", window: "rolling 7d", consequence: "P1 review" },
  { name: "mcp_tool_call_latency_p50", target: "≤ 200 ms", window: "rolling 7d", consequence: "P2; capacity work" },
  { name: "mgmt_healthz_availability", target: "≥ 99.9%", window: "rolling 30d", consequence: "P1 if breached" },
  { name: "audit_chain_integrity", target: "100%", window: "always", consequence: "P0 — never miss" },
  { name: "audit_chain_freshness", target: "≤ 5 min", window: "always", consequence: "P1" },
  { name: "provisioning_queue_lag_p99", target: "≤ 30 s", window: "rolling 7d", consequence: "P2" },
  { name: "provider_call_success_post_retry", target: "≥ 99%", window: "rolling 24h", consequence: "P1" },
  { name: "lint_no_stdout_writes", target: "100%", window: "always", consequence: "P0 in CI" },
] as const;

const SLOS_OUTPUT = z.object({
  slos: z.array(z.object({
    name: z.string(),
    target: z.string(),
    window: z.string(),
    consequence: z.string(),
    current: z.null(),
    state: z.null(),
    sparkline: z.array(z.number()).length(0),
  })),
  source: z.string(),
  dataLimited: z.object({ reason: z.string() }),
});

function registerSlosList(_deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.slos.list",
      description: "SLO targets from docs/sdlc/08-operations/slo-sli.md. Current values + state + sparkline are not yet computed.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { title: "Admin: SLO targets", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler() {
      const output = SLOS_OUTPUT.parse({
        slos: SLOS.map((s) => ({ ...s, current: null, state: null, sparkline: [] })),
        source: "docs/sdlc/08-operations/slo-sli.md",
        dataLimited: {
          reason: "SLO computation not wired (Prometheus histogram_quantile + counter export deferred to v6 §28 M11; see docs/sdlc/08-operations/observability-stack.md)",
        },
      });
      return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
    },
  });
}

// ───── admin.capacity.get ─────

const CAPACITY_OUTPUT = z.object({
  sessions: z.object({
    current: z.number().int().nonnegative(),
    cap: z.number().int().nonnegative(),
    pctUsed: z.number(),
  }),
  jobs: z.object({
    queued: z.number().int().nonnegative(),
    running: z.number().int().nonnegative(),
  }),
  cost: z.null(),
  dataLimited: z.object({ reason: z.string() }),
});

function registerCapacityGet(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.capacity.get",
      description: "Capacity snapshot: live session count vs cap, queue depth. Cost data is not yet computed.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { title: "Admin: capacity (data limited)", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler() {
      const scope = defaultTenantScope();
      const recent = await deps.repositories.provisionJob.recent(scope, 200);
      const queued = recent.filter((r) => r.status === "queued").length;
      const running = recent.filter((r) => r.status === "running").length;
      const current = deps.agentSessionRegistry.size();
      const cap = deps.config.http.maxConcurrentSessions;
      const output = CAPACITY_OUTPUT.parse({
        sessions: { current, cap, pctUsed: cap > 0 ? Math.round((current / cap) * 100) : 0 },
        jobs: { queued, running },
        cost: null,
        dataLimited: {
          reason: "cost model not wired (cost stack-bar deferred to v6 §28 M11+; see docs/sdlc/16-cost/cost-model.md)",
        },
      });
      return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
    },
  });
}

// ───── admin.dr.upcoming.list / admin.dr.drills.list / admin.dr.drills.schedule ─────

const DR_LIST_OUTPUT = z.object({
  items: z.array(z.unknown()).length(0),
  dataLimited: z.object({ reason: z.string() }),
});

function registerDrLists(_deps: AdminToolDeps, registry: ToolRegistry): void {
  for (const [name, doc] of [
    ["admin.dr.upcoming.list", "Upcoming DR drills."],
    ["admin.dr.drills.list", "Past DR drills."],
  ] as const) {
    registry.register({
      definition: {
        name,
        description: `${doc} v1 returns []; the drill scheduler is not yet wired (docs/sdlc/10-dr-bcp/test-schedule.md).`,
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { title: `Admin: ${name}`, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async handler() {
        const output = DR_LIST_OUTPUT.parse({
          items: [],
          dataLimited: { reason: "DR drill scheduler not wired (deferred to v6 §28 M11+; see docs/sdlc/10-dr-bcp/test-schedule.md)" },
        });
        return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
      },
    });
  }
}

const DR_SCHEDULE_INPUT = z.object({
  scenario: z.string().min(1),
  reason: z.string().min(4),
  operatorBadge: z.string().optional(),
}).strict();

const DR_SCHEDULE_OUTPUT = z.object({
  ok: z.boolean(),
  auditEntryId: z.string(),
  dataLimited: z.object({ reason: z.string() }),
});

function registerDrSchedule(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.dr.drills.schedule",
      description: "Schedule a DR drill. v1 records operator intent in the audit chain; the scheduler is post-v1.",
      inputSchema: {
        type: "object",
        properties: {
          scenario: { type: "string" },
          reason: { type: "string", minLength: 4 },
          operatorBadge: { type: "string" },
        },
        required: ["scenario", "reason"],
        additionalProperties: false,
      },
      annotations: { title: "Admin: schedule DR drill", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async handler(params) {
      const input = DR_SCHEDULE_INPUT.parse(params);
      const audit = await appendOperatorAudit(deps, {
        tool: "admin.dr.drills.schedule",
        input,
        ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
      });
      const output = DR_SCHEDULE_OUTPUT.parse({
        ok: true,
        auditEntryId: audit.id,
        dataLimited: { reason: "DR drill scheduler not wired; intent recorded only" },
      });
      return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
    },
  });
}

// ───── admin.config.flags.toggle ─────

const FLAG_TOGGLE_INPUT = z.object({
  flagEnvVar: z.string().min(1),
  to: z.boolean(),
  reason: z.string().min(4),
  operatorBadge: z.string().optional(),
}).strict();

const FLAG_TOGGLE_OUTPUT = z.object({
  ok: z.boolean(),
  auditEntryId: z.string(),
  dataLimited: z.object({ reason: z.string() }),
});

function registerFlagsToggle(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.config.flags.toggle",
      description: "Toggle a milestone feature flag. Records intent in the audit chain; persistence requires editing env and restarting.",
      inputSchema: {
        type: "object",
        properties: {
          flagEnvVar: { type: "string" },
          to: { type: "boolean" },
          reason: { type: "string", minLength: 4 },
          operatorBadge: { type: "string" },
        },
        required: ["flagEnvVar", "to", "reason"],
        additionalProperties: false,
      },
      annotations: { title: "Admin: toggle feature flag", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler(params) {
      const input = FLAG_TOGGLE_INPUT.parse(params);
      const audit = await appendOperatorAudit(deps, {
        tool: "admin.config.flags.toggle",
        input,
        ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
      });
      const output = FLAG_TOGGLE_OUTPUT.parse({
        ok: true,
        auditEntryId: audit.id,
        dataLimited: { reason: "feature flags are env-driven; persistence requires editing the env and restarting the orchestrator" },
      });
      return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
    },
  });
}

// ───── admin.secrets.rotate.token / master.start / audit.start ─────

const SECRETS_ROTATE_TOKEN_INPUT = z.object({
  logicalKey: z.string().min(1),
  reason: z.string().min(4),
  operatorBadge: z.string().optional(),
}).strict();

const SECRETS_ROTATE_TOKEN_OUTPUT = z.object({
  ok: z.boolean(),
  auditEntryId: z.string(),
  dataLimited: z.object({ reason: z.string() }),
});

function registerSecretsRotateToken(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.secrets.rotate.token",
      description: "Rotate a stored token. v1 records the rotation request; the operator must perform the actual rotation manually.",
      inputSchema: {
        type: "object",
        properties: {
          logicalKey: { type: "string" },
          reason: { type: "string", minLength: 4 },
          operatorBadge: { type: "string" },
        },
        required: ["logicalKey", "reason"],
        additionalProperties: false,
      },
      annotations: { title: "Admin: rotate token", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async handler(params) {
      const input = SECRETS_ROTATE_TOKEN_INPUT.parse(params);
      const audit = await appendOperatorAudit(deps, {
        tool: "admin.secrets.rotate.token",
        input,
        ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
      });
      const output = SECRETS_ROTATE_TOKEN_OUTPUT.parse({
        ok: true,
        auditEntryId: audit.id,
        dataLimited: { reason: "token rotation requires the new credential out-of-band; the orchestrator records the request but does not re-encrypt without the new value" },
      });
      return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
    },
  });
}

const KEY_DRILL_INPUT = z.object({
  reason: z.string().min(4),
  operatorBadge: z.string().optional(),
}).strict();

const KEY_DRILL_OUTPUT = z.object({
  drillId: z.string(),
  steps: z.array(z.object({ index: z.number().int(), title: z.string(), action: z.string() })),
  auditEntryId: z.string(),
  dataLimited: z.object({ reason: z.string() }),
});

const MASTER_KEY_STEPS = [
  { index: 1, title: "Generate new master key",      action: "Run `npm run audit:keys:init -- --new-master` and stash output 0600." },
  { index: 2, title: "Decrypt with old master",      action: "Read all encrypted_tokens; decrypt each via the current TOKEN_MASTER_KEY." },
  { index: 3, title: "Re-encrypt under new master",  action: "Re-wrap each per-record data key with the new master via tokenStore.put." },
  { index: 4, title: "Atomically swap env",          action: "Update TOKEN_MASTER_KEY in the secret store; restart orchestrator." },
  { index: 5, title: "Verify",                       action: "Read 5 random tokens; confirm each decrypts cleanly." },
] as const;

const AUDIT_KEY_STEPS = [
  { index: 1, title: "Generate new ed25519 keypair", action: "Run `npm run audit:keys:init` against a new path." },
  { index: 2, title: "Register pubkey to git ref",   action: "createGitRefKeyRegistryRepository.registerPublicKey(keyId, pem)." },
  { index: 3, title: "Update AUDIT_SIGNING_PRIVKEY_PATH", action: "Point env to new path; restart orchestrator." },
  { index: 4, title: "Verify",                       action: "Append a noop audit entry; verify it carries the new keyId." },
  { index: 5, title: "Supersede old key (post-v1)",  action: "Authoring an ADR per ADR 0005 §key rotation." },
] as const;

function registerSecretsRotateDrills(deps: AdminToolDeps, registry: ToolRegistry): void {
  for (const [name, kind, steps, runbook] of [
    ["admin.secrets.rotate.master.start", "master encryption key", MASTER_KEY_STEPS, "ADR 0002"],
    ["admin.secrets.rotate.audit.start",  "audit signing key",     AUDIT_KEY_STEPS,  "ADR 0005"],
  ] as const) {
    registry.register({
      definition: {
        name,
        description: `Start the ${kind} rotation drill. Returns a checklist; operator executes manually. Audit-logged.`,
        inputSchema: {
          type: "object",
          properties: { reason: { type: "string", minLength: 4 }, operatorBadge: { type: "string" } },
          required: ["reason"],
          additionalProperties: false,
        },
        annotations: { title: `Admin: ${kind} drill`, readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      },
      async handler(params) {
        const input = KEY_DRILL_INPUT.parse(params);
        const audit = await appendOperatorAudit(deps, {
          tool: name,
          input,
          ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
        });
        const drillId = audit.id;
        const output = KEY_DRILL_OUTPUT.parse({
          drillId,
          steps: [...steps],
          auditEntryId: audit.id,
          dataLimited: { reason: `automated ${kind} rotation is deferred; operator follows the steps manually per ${runbook}` },
        });
        return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
      },
    });
  }
}

// ───── admin.sessions.terminate ─────

const SESSION_TERMINATE_INPUT = z.object({
  sessionId: z.string().min(1),
  reason: z.string().min(4),
  operatorBadge: z.string().optional(),
}).strict();

const SESSION_TERMINATE_OUTPUT = z.object({
  ok: z.boolean(),
  removedFromRegistry: z.boolean(),
  auditEntryId: z.string(),
  dataLimited: z.object({ reason: z.string() }),
});

function registerSessionsTerminate(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.sessions.terminate",
      description: "Remove an MCP session from the registry. The underlying transport will time out via the reaper; force-close is post-v1.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          reason: { type: "string", minLength: 4 },
          operatorBadge: { type: "string" },
        },
        required: ["sessionId", "reason"],
        additionalProperties: false,
      },
      annotations: { title: "Admin: terminate session", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async handler(params) {
      const input = SESSION_TERMINATE_INPUT.parse(params);
      const wasPresent = deps.agentSessionRegistry.get(input.sessionId) !== undefined;
      deps.agentSessionRegistry.remove(input.sessionId);
      const audit = await appendOperatorAudit(deps, {
        tool: "admin.sessions.terminate",
        input,
        ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
      });
      const output = SESSION_TERMINATE_OUTPUT.parse({
        ok: true,
        removedFromRegistry: wasPresent,
        auditEntryId: audit.id,
        dataLimited: { reason: "transport-level force-close not exposed; the session is removed from the registry, the reaper closes the underlying transport on next tick" },
      });
      return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
    },
  });
}

// ───── admin.jobs.cancel / retry / preflight.refresh — record-only ─────

const JOB_INPUT = z.object({
  jobId: z.string().min(1),
  reason: z.string().min(4),
  operatorBadge: z.string().optional(),
}).strict();

const JOB_RECORD_OUTPUT = z.object({
  ok: z.boolean(),
  auditEntryId: z.string(),
  dataLimited: z.object({ reason: z.string() }),
});

function registerJobRecordOnly(deps: AdminToolDeps, registry: ToolRegistry): void {
  for (const [name, dataLimitedReason] of [
    ["admin.jobs.cancel", "job cancellation requires a BullMQ-side cancel; v1 records the operator intent. The DB row is not mutated to avoid drift."],
    ["admin.jobs.retry",  "job retry requires re-enqueue against an executor that survives the original failure; v1 records the operator intent."],
  ] as const) {
    registry.register({
      definition: {
        name,
        description: `${name} — record operator intent in the audit chain. The underlying side-effect is deferred in v1.`,
        inputSchema: {
          type: "object",
          properties: {
            jobId: { type: "string" },
            reason: { type: "string", minLength: 4 },
            operatorBadge: { type: "string" },
          },
          required: ["jobId", "reason"],
          additionalProperties: false,
        },
        annotations: { title: name, readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async handler(params) {
        const input = JOB_INPUT.parse(params);
        const audit = await appendOperatorAudit(deps, {
          tool: name,
          input,
          ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
        });
        const output = JOB_RECORD_OUTPUT.parse({
          ok: true,
          auditEntryId: audit.id,
          dataLimited: { reason: dataLimitedReason },
        });
        return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
      },
    });
  }
}

const PREFLIGHT_INPUT = z.object({
  key: z.string().min(1),
  reason: z.string().min(4),
  operatorBadge: z.string().optional(),
}).strict();

function registerPreflightRefresh(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.projects.preflight.refresh",
      description: "Trigger a preflight re-run for a project. v1 records the request; the preflight job pipeline is not yet wired here.",
      inputSchema: {
        type: "object",
        properties: {
          key: { type: "string" },
          reason: { type: "string", minLength: 4 },
          operatorBadge: { type: "string" },
        },
        required: ["key", "reason"],
        additionalProperties: false,
      },
      annotations: { title: "Admin: refresh preflight", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler(params) {
      const input = PREFLIGHT_INPUT.parse(params);
      const scope = defaultTenantScope();
      const project = await deps.repositories.project.findByKey(scope, input.key);
      if (!project) throw new Error(`unknown project: ${input.key}`);
      const audit = await appendOperatorAudit(deps, {
        tool: "admin.projects.preflight.refresh",
        input,
        projectId: project.id,
        ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
      });
      const output = JOB_RECORD_OUTPUT.parse({
        ok: true,
        auditEntryId: audit.id,
        dataLimited: { reason: "preflight job pipeline is not wired through the admin transport in v1; intent is recorded" },
      });
      return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
    },
  });
}

export function registerAdminDataLimitedTools(deps: AdminToolDeps, registry: ToolRegistry): void {
  registerAlertsList(deps, registry);
  registerAlertsAck(deps, registry);
  registerSlosList(deps, registry);
  registerCapacityGet(deps, registry);
  registerDrLists(deps, registry);
  registerDrSchedule(deps, registry);
  registerFlagsToggle(deps, registry);
  registerSecretsRotateToken(deps, registry);
  registerSecretsRotateDrills(deps, registry);
  registerSessionsTerminate(deps, registry);
  registerJobRecordOnly(deps, registry);
  registerPreflightRefresh(deps, registry);
}
