import { afterEach, describe, expect, it, vi } from "vitest";
import { pino } from "pino";
import { createApiTokenAuth } from "../../../../src/providers/atlassian/auth/apiToken.js";
import { createOAuth3loAuth } from "../../../../src/providers/atlassian/auth/oauth3lo.js";
import {
  buildActorAttribution,
  commitTrailers,
  jiraActorLabel,
  metadataBlock,
} from "../../../../src/providers/atlassian/auth/actorAttribution.js";

const silentLogger = pino({ level: "silent" });

describe("apiToken auth", () => {
  it("emits a Basic auth header with email:apiToken base64", async () => {
    const auth = createApiTokenAuth({ email: "user@example.com", apiToken: "ATATT3xFFGN0EXAMPLE" });
    const header = await auth.getAuthHeader();
    expect(header).toMatch(/^Basic /);
    const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
    expect(decoded).toBe("user@example.com:ATATT3xFFGN0EXAMPLE");
  });

  it("describes credential safely (fingerprint, not raw token)", () => {
    const auth = createApiTokenAuth({ email: "u@x.com", apiToken: "secret-abc" });
    const desc = auth.describe();
    expect(desc.mode).toBe("api_token");
    expect(desc.principalId).toBe("u@x.com");
    expect(desc.credentialFingerprint).toMatch(/^[0-9a-f]{8}$/);
    expect(desc.credentialFingerprint).not.toContain("secret");
    expect(desc.autoRotates).toBe(false);
  });

  it("rejects empty email/token", () => {
    expect(() => createApiTokenAuth({ email: "", apiToken: "x" })).toThrow();
    expect(() => createApiTokenAuth({ email: "u", apiToken: "" })).toThrow();
  });
});

describe("oauth3lo auth — refresh-token rotation", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses initialAccess until skew window, then refreshes", async () => {
    const persistSpy = vi.fn(async () => {});
    const fetchSpy = vi.fn<typeof fetch>(async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ access_token: "new-access", expires_in: 3600, token_type: "Bearer" }),
        text: async () => "",
      }) as unknown as Response,
    );

    const auth = createOAuth3loAuth({
      clientId: "client-1",
      clientSecret: "secret",
      tokenEndpoint: "https://auth.atlassian.com/oauth/token",
      persistRotatedRefreshToken: persistSpy,
      initialRefreshToken: "refresh-1",
      initialAccess: { token: "still-fresh", expiresAt: Date.now() + 600_000 },
      refreshSkewMs: 60_000,
      logger: silentLogger,
      fetchImpl: fetchSpy,
    });

    const header1 = await auth.getAuthHeader();
    expect(header1).toBe("Bearer still-fresh");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refreshes when access token is within skew of expiry", async () => {
    const persistSpy = vi.fn(async () => {});
    const fetchSpy = vi.fn<typeof fetch>(async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "new-access",
          refresh_token: "refresh-2",
          expires_in: 3600,
          token_type: "Bearer",
        }),
        text: async () => "",
      }) as unknown as Response,
    );

    const auth = createOAuth3loAuth({
      clientId: "c",
      clientSecret: "s",
      tokenEndpoint: "https://auth.atlassian.com/oauth/token",
      persistRotatedRefreshToken: persistSpy,
      initialRefreshToken: "refresh-1",
      initialAccess: { token: "expiring", expiresAt: Date.now() + 100 }, // < skew
      refreshSkewMs: 60_000,
      logger: silentLogger,
      fetchImpl: fetchSpy,
    });

    const header = await auth.getAuthHeader();
    expect(header).toBe("Bearer new-access");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(persistSpy).toHaveBeenCalledWith("refresh-2");
  });

  it("dedupes concurrent refreshes (only one in-flight call)", async () => {
    let resolveRefresh!: () => void;
    const refreshGate = new Promise<void>((r) => (resolveRefresh = r));
    const fetchSpy = vi.fn<typeof fetch>(async () => {
      await refreshGate;
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: "concurrent-access", expires_in: 3600, token_type: "Bearer" }),
        text: async () => "",
      } as unknown as Response;
    });

    const auth = createOAuth3loAuth({
      clientId: "c",
      clientSecret: "s",
      tokenEndpoint: "https://auth.atlassian.com/oauth/token",
      persistRotatedRefreshToken: async () => {},
      initialRefreshToken: "r",
      logger: silentLogger,
      fetchImpl: fetchSpy,
    });

    const promises = [auth.getAuthHeader(), auth.getAuthHeader(), auth.getAuthHeader()];
    resolveRefresh();
    const results = await Promise.all(promises);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(results.every((h) => h === "Bearer concurrent-access")).toBe(true);
  });

  it("throws on token-endpoint failure", async () => {
    const fetchSpy = vi.fn<typeof fetch>(async () =>
      ({ ok: false, status: 401, text: async () => '{"error":"invalid_grant"}' }) as unknown as Response,
    );
    const auth = createOAuth3loAuth({
      clientId: "c",
      clientSecret: "s",
      tokenEndpoint: "https://auth.atlassian.com/oauth/token",
      persistRotatedRefreshToken: async () => {},
      initialRefreshToken: "r",
      logger: silentLogger,
      fetchImpl: fetchSpy,
    });
    await expect(auth.getAuthHeader()).rejects.toThrow(/refresh failed/);
  });
});

describe("actor attribution helpers (FM-5)", () => {
  it("buildActorAttribution produces a stable 16-hex fingerprint", () => {
    const a = buildActorAttribution({ principalId: "u@x.com", authMode: "api_token" });
    const b = buildActorAttribution({ principalId: "u@x.com", authMode: "api_token" });
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.fingerprint).toMatch(/^[0-9a-f]{16}$/);
  });

  it("jiraActorLabel is sortable + safe", () => {
    const attr = buildActorAttribution({ principalId: "u@x.com", authMode: "api_token" });
    expect(jiraActorLabel(attr)).toMatch(/^orchestrator-actor-[0-9a-f]{16}$/);
  });

  it("metadataBlock includes auditEntryId when supplied", () => {
    const attr = buildActorAttribution({ principalId: "u@x.com", authMode: "oauth3lo" });
    const block = metadataBlock({ attribution: attr, auditEntryId: "audit-1" });
    expect(block).toMatch(/^<!-- orchestrator-attribution: /);
    expect(block).toContain("auditEntryId");
    expect(block).toContain("oauth3lo");
  });

  it("commitTrailers emits both fingerprint + audit id when present", () => {
    const attr = buildActorAttribution({ principalId: "u@x.com", authMode: "api_token" });
    const trailers = commitTrailers({ attribution: attr, auditEntryId: "audit-1" });
    expect(trailers).toContain("Orchestrator-Actor-Fingerprint:");
    expect(trailers).toContain("Orchestrator-Audit-Id: audit-1");
  });
});
