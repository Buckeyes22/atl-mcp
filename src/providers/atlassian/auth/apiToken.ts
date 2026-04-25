// API-token auth — Atlassian Basic auth with `email:apiToken`.
// Token loaded once at construction (already plaintext from token store).
// Fingerprint = sha256(token).slice(0, 8) for actor attribution.

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import type { AtlassianAuthProvider, AuthDescriptor } from "./types.js";

export interface ApiTokenAuthInput {
  readonly email: string;
  readonly apiToken: string;
}

export function createApiTokenAuth(input: ApiTokenAuthInput): AtlassianAuthProvider {
  if (input.email.length === 0) throw new Error("api token auth: email required");
  if (input.apiToken.length === 0) throw new Error("api token auth: apiToken required");
  const credentialFingerprint = bytesToHex(sha256(utf8ToBytes(input.apiToken))).slice(0, 8);
  const headerValue = `Basic ${Buffer.from(`${input.email}:${input.apiToken}`).toString("base64")}`;

  return {
    mode: "api_token",
    async getAuthHeader() {
      return headerValue;
    },
    describe(): AuthDescriptor {
      return {
        mode: "api_token",
        credentialFingerprint,
        principalId: input.email,
        autoRotates: false,
      };
    },
  };
}
