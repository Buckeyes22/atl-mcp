// admin.providers.list — provider health snapshot (Atlassian Jira, Confluence,
// Bitbucket VCS). Calls each provider's healthCheck() in parallel. Rate-limit
// headroom is not yet tracked in v1 (the providers don't surface
// X-RateLimit-Remaining capture); the field is `null` and the UI shows a
// data-limited badge for it.

import { z } from "zod";
import type { AdminToolDeps } from "../registry.js";
import type { ToolRegistry } from "../../toolRegistry.js";

const PROVIDER = z.object({
  id: z.string(),
  kind: z.string(),
  name: z.string(),
  capability: z.enum(["jira", "confluence", "vcs"]),
  providerType: z.string(),
  configured: z.boolean(),
  reachable: z.boolean().nullable(),
  latencyMs: z.number().nullable(),
  details: z.string().nullable(),
  rateLimitHeadroomPct: z.number().nullable(),
});

const OUTPUT = z.object({
  providers: z.array(PROVIDER),
  dataLimited: z.object({
    rateLimitHeadroom: z.string(),
  }),
});

interface ProbeShape {
  name: string;
  kind: string;
  healthCheck(): Promise<{ reachable: boolean; details?: string; latencyMs?: number }>;
}

async function probe(p: ProbeShape | undefined, id: string, capability: "jira" | "confluence" | "vcs") {
  if (!p) {
    return {
      id,
      kind: id,
      name: id,
      capability,
      providerType: id,
      configured: false,
      reachable: null,
      latencyMs: null,
      details: null,
      rateLimitHeadroomPct: null,
    };
  }
  try {
    const h = await p.healthCheck();
    return {
      id,
      kind: p.kind,
      name: p.name,
      capability,
      providerType: providerTypeFor(p.kind, id),
      configured: true,
      reachable: h.reachable,
      latencyMs: h.latencyMs ?? null,
      details: h.details ?? null,
      rateLimitHeadroomPct: null,
    };
  } catch (err) {
    return {
      id,
      kind: p.kind,
      name: p.name,
      capability,
      providerType: providerTypeFor(p.kind, id),
      configured: true,
      reachable: false,
      latencyMs: null,
      details: err instanceof Error ? err.message : String(err),
      rateLimitHeadroomPct: null,
    };
  }
}

export function registerProvidersAdminTool(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.providers.list",
      description: "Provider health snapshot (Jira, Confluence, Bitbucket). Rate-limit headroom not yet tracked.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { title: "Admin: providers", readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async handler() {
      const [jira, confluence, vcs] = await Promise.all([
        probe(deps.providers.jira as ProbeShape | undefined, "jira", "jira"),
        probe(deps.providers.confluence as ProbeShape | undefined, "confluence", "confluence"),
        probe(deps.providers.vcs as ProbeShape | undefined, "bitbucket", "vcs"),
      ]);
      const output = OUTPUT.parse({
        providers: [jira, confluence, vcs],
        dataLimited: {
          rateLimitHeadroom: "rate-limit headroom tracking not wired (provider clients don't yet capture X-RateLimit-Remaining headers)",
        },
      });
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  });
}

function providerTypeFor(kind: string, fallback: string): string {
  if (kind.startsWith("vcs.bitbucket")) return "bitbucket";
  if (kind.startsWith("vcs.github")) return "github";
  if (kind.startsWith("atlassian.jira")) return "jira";
  if (kind.startsWith("atlassian.confluence")) return "confluence";
  return fallback;
}
