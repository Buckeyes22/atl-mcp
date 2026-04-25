// Helper used by every Phase 3+ write tool: build a signed audit chain entry
// for the operator action and append it through auditRepository.
//
// Convention:
//   - actor.mcpPrincipalId = `operator:<badge>` (single-tenant loopback)
//   - actor.authMode       = "service_account" (no operator OAuth in v1)
//   - toolName             = the admin tool name (e.g., "admin.policy.approve")
//   - inputHash            = sha256(JCS(input)); never the raw input
//   - errorState           = optional; populated when the call records a failure
//
// Audit entries persist regardless of the tool's downstream success — operator
// intent is always visible in the chain.

import { randomUUID, createHash } from "node:crypto";
import { auditPayloadHash } from "../../security/auditChain.js";
import { PLACEHOLDER_SIGNATURE, type AuditEntry } from "../../domain/auditEntry.js";
import { defaultTenantScope, type TenantScope } from "../../domain/tenantScope.js";
import type { AdminToolDeps } from "./registry.js";

type AuditDeps = Pick<AdminToolDeps, "auditSigner" | "repositories">;

export interface AuditedWriteArgs {
  readonly tool: string;
  readonly input: unknown;
  readonly projectId?: string;
  readonly operatorBadge?: string;
  readonly outputArtifactIds?: readonly string[];
  readonly errorState?: string;
  readonly scope?: TenantScope;
}

export async function appendOperatorAudit(deps: AuditDeps, args: AuditedWriteArgs): Promise<AuditEntry> {
  const scope = args.scope ?? defaultTenantScope();
  const operator = args.operatorBadge ?? "operator:loopback";
  const principalId = operator.startsWith("operator:") ? operator : `operator:${operator}`;
  const fingerprint = sha256Hex(principalId).slice(0, 16);
  const credentialFp = sha256Hex("loopback-no-credential").slice(0, 16);

  const inputHash = auditPayloadHash(args.input ?? {});
  const unsigned: AuditEntry = {
    id: randomUUID(),
    tenantId: scope.tenantId,
    ...(args.projectId ? { projectId: args.projectId } : {}),
    timestamp: new Date().toISOString(),
    actor: {
      mcpPrincipalId: principalId,
      mcpPrincipalFingerprint: fingerprint,
      credentialFingerprint: credentialFp,
      authMode: "service_account",
    },
    toolName: args.tool,
    inputHash,
    ...(args.outputArtifactIds ? { outputArtifactIds: args.outputArtifactIds } : {}),
    ...(args.errorState ? { errorState: args.errorState } : {}),
    prevHash: "",
    signature: PLACEHOLDER_SIGNATURE,
  };

  const signed = deps.auditSigner.sign(unsigned);
  return await deps.repositories.audit.append(scope, { entry: signed });
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
