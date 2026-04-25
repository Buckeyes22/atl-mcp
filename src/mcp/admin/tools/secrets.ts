// admin.secrets.list — token metadata + key info for the operator secrets
// screen. NEVER returns plaintext or ciphertext bytes; only the bookkeeping
// fields (logical key, algo, master key id, timestamps).

import { z } from "zod";
import { defaultTenantScope } from "../../../domain/tenantScope.js";
import type { AdminToolDeps } from "../registry.js";
import type { ToolRegistry } from "../../toolRegistry.js";

const TOKEN = z.object({
  id: z.string(),
  logicalKey: z.string(),
  algo: z.string(),
  masterKeyId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  ageDays: z.number().nonnegative(),
});

const OUTPUT = z.object({
  tokens: z.array(TOKEN),
  masterKeyId: z.string(),
  auditSigningKey: z.object({
    id: z.string(),
    publicKeyPem: z.string(),
  }),
});

export function registerSecretsAdminTool(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.secrets.list",
      description: "Token metadata and key fingerprints for the operator secrets screen. Plaintext is never returned.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { title: "Admin: secrets metadata", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler() {
      const scope = defaultTenantScope();
      const metas = await deps.repositories.encryptedToken.listMetadata(scope);
      const now = Date.now();
      const tokens = metas.map((m) => ({
        id: m.id,
        logicalKey: m.logicalKey,
        algo: m.algo,
        masterKeyId: m.masterKeyId,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        ageDays: Math.max(0, Math.round((now - new Date(m.createdAt).getTime()) / 86_400_000)),
      }));
      // Master key id: in v1 it's derived from sha256(masterKey).slice(0,16) by tokenEncryption.
      // We don't have a direct getter on TokenEncryption today, so we infer from the most-recent
      // record's masterKeyId or fall back to the first token. If none exist, we report "n/a".
      const masterKeyId = tokens[0]?.masterKeyId ?? "n/a";
      const output = OUTPUT.parse({
        tokens,
        masterKeyId,
        auditSigningKey: {
          id: deps.auditSigner.keyId,
          publicKeyPem: deps.auditSigner.publicKeyPem,
        },
      });
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  });
}
