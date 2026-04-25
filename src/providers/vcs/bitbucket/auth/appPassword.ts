// Bitbucket Cloud app-password auth.
//
// Bitbucket app passwords use Basic auth with the format:
//   Authorization: Basic base64(username:app_password)
//
// The "username" here is the Atlassian username, NOT the workspace slug.
// (Bitbucket's "workspace" is a tenant; the user that owns the app password
// authenticates with their personal username and the password is scoped to
// that user's grants.)
//
// Bitbucket also supports OAuth 2.0 (3LO) and repository access tokens. We
// ship app-password first because it's the simplest and works for personal +
// service-account flows; OAuth lands when first deployment needs it (per ADR
// 0004 — same approach as Atlassian auth).

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

export interface BitbucketAuth {
  readonly mode: "app_password";
  getAuthHeader(): Promise<string>;
  describe(): {
    readonly mode: "app_password";
    readonly username: string;
    readonly credentialFingerprint: string;
    readonly autoRotates: false;
  };
}

export interface BitbucketAppPasswordInput {
  readonly username: string;
  readonly appPassword: string;
}

export function createBitbucketAppPasswordAuth(input: BitbucketAppPasswordInput): BitbucketAuth {
  if (input.username.length === 0) throw new Error("bitbucket app password auth: username required");
  if (input.appPassword.length === 0) throw new Error("bitbucket app password auth: appPassword required");

  const credentialFingerprint = bytesToHex(sha256(utf8ToBytes(input.appPassword))).slice(0, 8);
  const headerValue = `Basic ${Buffer.from(`${input.username}:${input.appPassword}`).toString("base64")}`;

  return {
    mode: "app_password",
    async getAuthHeader() {
      return headerValue;
    },
    describe() {
      return {
        mode: "app_password",
        username: input.username,
        credentialFingerprint,
        autoRotates: false,
      };
    },
  };
}
