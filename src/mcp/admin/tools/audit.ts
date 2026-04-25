// admin.audit.list / admin.audit.head — audit chain reads for the operator UI.
// Reads from auditRepository.readChainForProject + verifyChain. The read API
// today scopes by (tenant, project) — for the system-wide list we read the
// system chain (projectId=null) plus iterate per-project chains.

import { z } from "zod";
import { defaultTenantScope } from "../../../domain/tenantScope.js";
import type { AdminToolDeps } from "../registry.js";
import type { ToolRegistry } from "../../toolRegistry.js";
import type { AuditEntry } from "../../../domain/auditEntry.js";

const LIST_INPUT = z.object({
  limit: z.number().int().min(1).max(500).optional(),
  projectId: z.string().optional(),
  outcome: z.string().optional(),
  since: z.string().optional(),
}).strict();

const ENTRY = z.object({
  id: z.string(),
  timestamp: z.string(),
  actor: z.string(),
  toolName: z.string(),
  outcome: z.string(),
  projectId: z.string().optional(),
  prevHash: z.string(),
  signatureKeyId: z.string(),
  signatureValue: z.string(),
});

const LIST_OUTPUT = z.object({
  entries: z.array(ENTRY),
  totalReturned: z.number().int().nonnegative(),
});

const HEAD_OUTPUT = z.object({
  systemChainLength: z.number().int().nonnegative(),
  perProjectChains: z.array(z.object({
    projectId: z.string(),
    length: z.number().int().nonnegative(),
  })),
  lastVerifiedAt: z.string(),
  verification: z.object({
    entriesChecked: z.number().int().nonnegative(),
    mismatchCount: z.number().int().nonnegative(),
    ok: z.boolean(),
  }),
  signingKeyId: z.string(),
});

function entryToReturned(e: AuditEntry) {
  return {
    id: e.id,
    timestamp: e.timestamp,
    actor: e.actor.mcpPrincipalId,
    toolName: e.toolName,
    outcome: e.errorState ?? "ok",
    ...(e.projectId ? { projectId: e.projectId } : {}),
    prevHash: e.prevHash,
    signatureKeyId: e.signature.keyId,
    signatureValue: e.signature.value,
  };
}

export function registerAuditAdminTools(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.audit.list",
      description: "List recent audit chain entries with optional filters (project, outcome, since-timestamp).",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", minimum: 1, maximum: 500 },
          projectId: { type: "string" },
          outcome: { type: "string" },
          since: { type: "string" },
        },
        additionalProperties: false,
      },
      annotations: { title: "Admin: audit entries", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler(params) {
      const { limit, projectId, outcome, since } = LIST_INPUT.parse(params ?? {});
      const scope = defaultTenantScope();
      const cap = limit ?? 50;

      const entries: AuditEntry[] = [];
      if (projectId) {
        entries.push(...(await deps.repositories.audit.readChainForProject(scope, projectId)));
      } else {
        // system chain + every project chain
        entries.push(...(await deps.repositories.audit.readChainForProject(scope, null)));
        const projects = await deps.repositories.project.list(scope);
        for (const p of projects) {
          entries.push(...(await deps.repositories.audit.readChainForProject(scope, p.id)));
        }
      }

      let filtered = entries;
      if (outcome) filtered = filtered.filter((e) => (e.errorState ?? "ok") === outcome);
      if (since) {
        const cutoff = new Date(since).getTime();
        if (Number.isFinite(cutoff)) filtered = filtered.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
      }

      // Newest first.
      filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      const slice = filtered.slice(0, cap);
      const output = LIST_OUTPUT.parse({ entries: slice.map(entryToReturned), totalReturned: slice.length });
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  });

  registry.register({
    definition: {
      name: "admin.audit.head",
      description: "Audit chain head: total length, per-project lengths, last integrity verification result, signing key id.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { title: "Admin: audit head", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler() {
      const scope = defaultTenantScope();
      const systemChain = await deps.repositories.audit.readChainForProject(scope, null);
      const projects = await deps.repositories.project.list(scope);
      const perProject: Array<{ projectId: string; length: number }> = [];
      for (const p of projects) {
        const chain = await deps.repositories.audit.readChainForProject(scope, p.id);
        perProject.push({ projectId: p.id, length: chain.length });
      }
      const verification = await deps.repositories.audit.verifyChain(scope, null);
      const output = HEAD_OUTPUT.parse({
        systemChainLength: systemChain.length,
        perProjectChains: perProject,
        lastVerifiedAt: new Date().toISOString(),
        verification: {
          entriesChecked: verification.entriesChecked,
          mismatchCount: verification.mismatches.length,
          ok: verification.mismatches.length === 0,
        },
        signingKeyId: deps.auditSigner.keyId,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  });
}
