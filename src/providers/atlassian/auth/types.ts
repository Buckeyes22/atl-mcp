// Atlassian auth — common types.
//
// FM-4 (v6 §34): never forward MCP-client tokens to downstream APIs. The
// orchestrator owns its own server-side credentials (API token, OAuth refresh
// token, or service account) and presents those upstream. This file defines
// the typed surface; implementations live alongside.

import type { AuthMode } from "../../../domain/auditEntry.js";

export interface AtlassianAuthProvider {
  readonly mode: AuthMode;
  /** Returns a ready-to-use Authorization header value (e.g., "Basic ..." or "Bearer ..."). */
  getAuthHeader(): Promise<string>;
  /**
   * Returns identifying info about the credential for actor attribution.
   * Never returns the credential itself.
   */
  describe(): AuthDescriptor;
}

export interface AuthDescriptor {
  readonly mode: AuthMode;
  /** Truncated fingerprint of the credential (first 8 hex of sha256). Audit-safe. */
  readonly credentialFingerprint: string;
  /** When known, the principal id (Atlassian account id, OAuth client id, etc.). */
  readonly principalId?: string;
  /** True when the underlying credential auto-rotates (OAuth refresh). */
  readonly autoRotates: boolean;
}
