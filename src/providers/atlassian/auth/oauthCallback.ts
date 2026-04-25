import type { TenantScope } from "../../../domain/tenantScope.js";
import type { TokenStore } from "../../../security/tokenStore.js";

export const ATLASSIAN_OAUTH_REFRESH_TOKEN_KEY = "atlassian.oauth3lo.refresh_token";
export const ATLASSIAN_OAUTH_ACCESS_TOKEN_KEY = "atlassian.oauth3lo.access";

export interface AtlassianOAuthCallbackInput {
  readonly scope: TenantScope;
  readonly code: string;
  readonly state: string;
  readonly expectedState: string;
  readonly pkceVerifier: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly tokenEndpoint: string;
  readonly tokenStore: TokenStore;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => number;
}

export interface AtlassianOAuthCallbackResult {
  readonly ok: true;
  readonly tokenType: string;
  readonly expiresAt: string;
  readonly scope?: string;
}

interface AtlassianTokenExchangeResponse {
  readonly access_token?: string;
  readonly refresh_token?: string;
  readonly expires_in?: number;
  readonly token_type?: string;
  readonly scope?: string;
}

export async function handleAtlassianOAuthCallback(
  input: AtlassianOAuthCallbackInput,
): Promise<AtlassianOAuthCallbackResult> {
  if (input.state !== input.expectedState) {
    throw new Error("invalid OAuth state");
  }
  if (!input.code) {
    throw new Error("missing OAuth code");
  }
  if (!input.pkceVerifier) {
    throw new Error("missing PKCE verifier");
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: input.clientId,
    client_secret: input.clientSecret,
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.pkceVerifier,
  });

  const response = await fetchImpl(input.tokenEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: body.toString(),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OAuth token exchange failed: ${response.status} ${text}`);
  }

  const token = (await response.json()) as AtlassianTokenExchangeResponse;
  if (!token.access_token || !token.refresh_token || typeof token.expires_in !== "number") {
    throw new Error("OAuth token exchange response missing required token fields");
  }

  const expiresAtMs = (input.now ?? Date.now)() + token.expires_in * 1000;
  const expiresAt = new Date(expiresAtMs).toISOString();
  await input.tokenStore.put(input.scope, ATLASSIAN_OAUTH_REFRESH_TOKEN_KEY, token.refresh_token);
  await input.tokenStore.put(
    input.scope,
    ATLASSIAN_OAUTH_ACCESS_TOKEN_KEY,
    JSON.stringify({
      accessToken: token.access_token,
      tokenType: token.token_type ?? "Bearer",
      expiresAt,
      ...(token.scope !== undefined ? { scope: token.scope } : {}),
    }),
  );

  return {
    ok: true,
    tokenType: token.token_type ?? "Bearer",
    expiresAt,
    ...(token.scope !== undefined ? { scope: token.scope } : {}),
  };
}
