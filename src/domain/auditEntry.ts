// AuditEntry: tamper-evident record per v6 §30.1 + §38.7.
// M1 ships the persisted shape + repository (write + read); M6a wires up the
// hash chain + ed25519 signing pipeline (agentdiff F-117). The signature
// field is non-optional in the type but tolerates the M1 placeholder
// signature shape until M6a replaces it.

export type AuthMode = "api_token" | "oauth3lo" | "service_account";

export interface AuditActor {
  readonly mcpPrincipalId: string;
  /** sha256 of principal id, first 16 hex. */
  readonly mcpPrincipalFingerprint: string;
  /** Truncated token fingerprint (never the raw token). */
  readonly credentialFingerprint: string;
  readonly authMode: AuthMode;
}

export interface AuditSignature {
  readonly alg: "ed25519";
  /** First 16 hex of sha256(pubkey). Empty string while M6a is pending. */
  readonly keyId: string;
  readonly value: string;     // base64
}

export interface AuditEntry {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId?: string;
  readonly timestamp: string;
  readonly actor: AuditActor;
  readonly toolName: string;
  /** sha256 of input; never the raw input. */
  readonly inputHash: string;
  readonly outputArtifactIds?: readonly string[];
  readonly errorState?: string;
  /** Hash-chain link to previous entry (per project, or per tenant for system entries). */
  readonly prevHash: string;
  readonly signature: AuditSignature;
}

/** Empty signature placeholder used in M1; M6a replaces with real ed25519. */
export const PLACEHOLDER_SIGNATURE: AuditSignature = {
  alg: "ed25519",
  keyId: "",
  value: "",
};
