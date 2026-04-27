import { describe, expect, it, vi } from "vitest";
import { defaultTenantScope } from "../../../../src/domain/tenantScope.js";
import { handleAtlassianOAuthCallback } from "../../../../src/providers/atlassian/auth/oauthCallback.js";
import type { TokenStore } from "../../../../src/security/tokenStore.js";

const scope = defaultTenantScope();

describe("Atlassian OAuth callback", () => {
  it("validates state before token exchange", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const store = tokenStoreDouble();

    await expect(handleAtlassianOAuthCallback({
      scope,
      code: "code-1",
      state: "wrong",
      expectedState: "expected",
      pkceVerifier: "verifier",
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "http://127.0.0.1:3001/oauth/atlassian/callback",
      tokenEndpoint: "https://auth.atlassian.com/oauth/token",
      tokenStore: store,
      fetchImpl,
    })).rejects.toThrow(/invalid oauth state/i);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("exchanges an auth code and persists rotated token material without returning secrets", async () => {
    const stored = new Map<string, string>();
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
      const body = String(init?.body ?? "");
      expect(body).toContain("grant_type=authorization_code");
      expect(body).toContain("code_verifier=verifier");
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 3600,
          token_type: "Bearer",
          scope: "read%3Ajira-work",
        }),
        text: async () => "",
      } as unknown as Response;
    });

    const result = await handleAtlassianOAuthCallback({
      scope,
      code: "code-1",
      state: "expected",
      expectedState: "expected",
      pkceVerifier: "verifier",
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "http://127.0.0.1:3001/oauth/atlassian/callback",
      tokenEndpoint: "https://auth.atlassian.com/oauth/token",
      tokenStore: tokenStoreDouble(stored),
      fetchImpl,
      now: () => 1_777_000_000_000,
    });

    expect(result).toEqual({
      ok: true,
      tokenType: "Bearer",
      expiresAt: "2026-04-24T04:06:40.000Z",
      scope: "read%3Ajira-work",
    });
    expect(stored.get("atlassian.oauth3lo.refresh_token")).toBe("refresh-token");
    expect(stored.get("atlassian.oauth3lo.access")).toContain("access-token");
  });
});

function tokenStoreDouble(values = new Map<string, string>()): TokenStore {
  return {
    async put(_, key, plaintext) {
      values.set(key, plaintext);
    },
    async get(_, key) {
      return values.get(key);
    },
    async delete(_, key) {
      values.delete(key);
    },
  };
}
