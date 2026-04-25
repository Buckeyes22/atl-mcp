// admin.health.get — system health snapshot for the operator dashboard.
// Reads the same liveness signals as the mgmt /healthz response plus
// per-component status (DB, audit chain, providers, MCP transport).

import { z } from "zod";
import { defaultTenantScope } from "../../../domain/tenantScope.js";
import type { AdminToolDeps } from "../registry.js";
import type { ToolRegistry } from "../../toolRegistry.js";

const COMPONENT = z.object({
  status: z.enum(["green", "amber", "red", "grey"]),
  label: z.string(),
  sub: z.string(),
});

const OUTPUT = z.object({
  service: z.string(),
  version: z.string(),
  uptimeSeconds: z.number(),
  deploymentTier: z.string(),
  components: z.object({
    service: COMPONENT,
    db: COMPONENT,
    audit: COMPONENT,
    jira: COMPONENT,
    confluence: COMPONENT,
    vcs: COMPONENT,
    context: COMPONENT,
    queue: COMPONENT,
    atlassian: COMPONENT,
    bitbucket: COMPONENT,
    transport: COMPONENT,
    webhooks: COMPONENT,
  }),
  serverTimeIso: z.string(),
});

export type AdminHealthOutput = z.infer<typeof OUTPUT>;

export function registerHealthAdminTool(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.health.get",
      description: "Operator dashboard health snapshot: service, db, audit chain, provider, transport status.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: {
        title: "Admin: system health",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async handler() {
      const scope = defaultTenantScope();
      const uptimeSeconds = Math.round((Date.now() - deps.startedAt.getTime()) / 1000);

      // DB: probe with a trivial query (read at most one project; tolerate empty).
      let dbStatus: "green" | "red" = "green";
      let dbSub = `${deps.config.deployment.tier} · uptime ${uptimeSeconds}s`;
      try {
        await deps.repositories.project.list(scope);
      } catch (err) {
        dbStatus = "red";
        dbSub = `unreachable: ${err instanceof Error ? err.message : String(err)}`;
      }

      // Audit chain: chain length + last verify result for the system-scope chain (projectId = null).
      let auditStatus: "green" | "amber" | "red" = "green";
      let auditSub = "verified";
      try {
        const verification = await deps.repositories.audit.verifyChain(scope, null);
        if (verification.mismatches.length > 0) {
          auditStatus = "red";
          auditSub = `${verification.mismatches.length} mismatch(es) in ${verification.entriesChecked} entries`;
        } else {
          auditSub = `${verification.entriesChecked} entries · ${deps.auditSigner.keyId}`;
        }
      } catch (err) {
        auditStatus = "amber";
        auditSub = `verify failed: ${err instanceof Error ? err.message : String(err)}`;
      }

      const [jira, confluence, vcs] = await Promise.all([
        probeProvider(deps.providers.jira),
        probeProvider(deps.providers.confluence),
        probeProvider(deps.providers.vcs),
      ]);

      let queueStatus: "green" | "amber" | "red" | "grey" = deps.provisionQueue ? "green" : "grey";
      let queueSub = deps.provisionQueue ? "queue adapter configured" : "queue adapter not configured; DB snapshot only";
      try {
        const recentJobs = await deps.repositories.provisionJob.recent(scope, 100);
        const queued = recentJobs.filter((job) => job.status === "queued").length;
        const running = recentJobs.filter((job) => job.status === "running").length;
        const failed = recentJobs.filter((job) => job.status === "failed").length;
        queueStatus = failed > 0 ? "red" : queued + running > 0 ? "amber" : queueStatus;
        queueSub = `${running} running · ${queued} queued · ${failed} failed`;
      } catch (err) {
        queueStatus = "red";
        queueSub = `job repository failed: ${err instanceof Error ? err.message : String(err)}`;
      }

      const contextStatus: "green" | "grey" = deps.config.flags.persistentAgentMemoryEnabled ? "green" : "grey";
      const contextSub = deps.config.flags.persistentAgentMemoryEnabled
        ? "context and agent memory enabled"
        : "context vector index disabled by feature flag";

      const transportSub = `${deps.agentSessionRegistry.size()} sessions · ${deps.config.http.maxConcurrentSessions} cap`;
      const atlassian = summarizeComposite("Atlassian", [jira, confluence]);

      const output: AdminHealthOutput = OUTPUT.parse({
        service: deps.config.serverInfo.name,
        version: deps.config.serverInfo.version,
        uptimeSeconds,
        deploymentTier: deps.config.deployment.tier,
        components: {
          service: { status: "green", label: "Service", sub: `${deps.config.serverInfo.name} · v${deps.config.serverInfo.version} · uptime ${uptimeSeconds}s` },
          db: { status: dbStatus, label: "Database", sub: dbSub },
          audit: { status: auditStatus, label: "Audit chain", sub: auditSub },
          jira: { ...jira, label: "Jira" },
          confluence: { ...confluence, label: "Confluence" },
          vcs: { ...vcs, label: deps.providers.vcs ? providerLabel(deps.providers.vcs.kind) : "VCS" },
          context: { status: contextStatus, label: "Qdrant / context", sub: contextSub },
          queue: { status: queueStatus, label: "Queue", sub: queueSub },
          atlassian,
          bitbucket: { ...vcs, label: "Bitbucket" },
          transport: { status: "green", label: "MCP transport", sub: transportSub },
          webhooks: { status: "grey", label: "Webhooks", sub: "no recent webhook liveness signal" },
        },
        serverTimeIso: new Date().toISOString(),
      });

      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  });
}

type ComponentShape = z.infer<typeof COMPONENT>;

async function probeProvider(p: { name: string; kind: string; healthCheck(): Promise<{ reachable: boolean; details?: string; latencyMs?: number }> } | undefined): Promise<ComponentShape> {
  if (!p) {
    return { status: "grey" as const, label: providerLabel(undefined), sub: "not configured" };
  }
  try {
    const h = await p.healthCheck();
    const status = h.reachable ? "green" : "red";
    const sub = `${p.kind} · ${h.reachable ? "reachable" : "unreachable"}${h.latencyMs !== undefined ? ` · ${h.latencyMs}ms` : ""}${h.details ? ` · ${h.details}` : ""}`;
    return { status: status as "green" | "red", label: providerLabel(p.kind), sub };
  } catch (err) {
    return { status: "red" as const, label: providerLabel(p.kind), sub: `error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

function summarizeComposite(label: string, components: readonly ComponentShape[]): ComponentShape {
  if (components.some((component) => component.status === "red")) {
    return { status: "red", label, sub: components.map((component) => `${component.label}: ${component.status}`).join(" · ") };
  }
  if (components.some((component) => component.status === "amber")) {
    return { status: "amber", label, sub: components.map((component) => `${component.label}: ${component.status}`).join(" · ") };
  }
  if (components.every((component) => component.status === "grey")) {
    return { status: "grey", label, sub: "not configured" };
  }
  return { status: "green", label, sub: components.map((component) => `${component.label}: ${component.status}`).join(" · ") };
}

function providerLabel(kind: string | undefined): string {
  if (!kind) return "Provider";
  if (kind.startsWith("atlassian")) return "Atlassian";
  if (kind.startsWith("vcs.bitbucket")) return "Bitbucket";
  if (kind.startsWith("vcs.")) return "VCS";
  return kind;
}

export const _internals = { OUTPUT };
