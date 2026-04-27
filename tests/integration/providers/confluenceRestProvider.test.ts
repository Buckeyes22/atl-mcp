// Recorded-fixture tests for the Confluence REST provider.

import { describe, expect, it } from "vitest";
import { pino } from "pino";
import { createConfluenceRestProvider } from "../../../src/providers/atlassian/confluenceRestProvider.js";
import { createApiTokenAuth } from "../../../src/providers/atlassian/auth/apiToken.js";
import { createRestClient, type FetchLike } from "../../../src/providers/http/restClient.js";

const silentLogger = pino({ level: "silent" });

function makeFetch(opts?: { adfEnabled?: boolean }): FetchLike {
  void opts;
  return async (url, init) => {
    const u = new URL(url);
    // Confluence base URL is https://x.atlassian.net/wiki — strip the /wiki prefix
    // for cleaner pathname matching.
    const path = u.pathname.startsWith("/wiki") ? u.pathname.slice(5) : u.pathname;
    if (path === "/api/v2/spaces/98765" && init.method === "GET") {
      return jsonRes(200, { id: "98765", key: "PCO", name: "Project Context", type: "global", status: "current" });
    }
    if (path === "/api/v2/spaces" && init.method === "GET") {
      const keys = u.searchParams.get("keys");
      if (keys === "PCO") {
        return jsonRes(200, {
          results: [{ id: "98765", key: "PCO", name: "Project Context", type: "global", status: "current" }],
          _links: {},
        });
      }
      return jsonRes(200, { results: [], _links: {} });
    }
    if (path ==="/api/v2/pages" && init.method === "POST") {
      const body = init.body ? JSON.parse(init.body) : {};
      return jsonRes(201, {
        id: "11111",
        spaceId: body.spaceId ?? "98765",
        title: body.title ?? "Untitled",
        version: { number: 1 },
        body: body.body,
      });
    }
    if (path.match(/^\/api\/v2\/pages\/[^/]+$/) && init.method === "GET") {
      const id = path.split("/").pop()!;
      return jsonRes(200, {
        id,
        spaceId: "98765",
        title: "Test page",
        version: { number: 1 },
        body: { representation: "storage", value: "<p>hi</p>" },
      });
    }
    if (path.match(/^\/api\/v2\/pages\/[^/]+$/) && init.method === "PUT") {
      const body = init.body ? JSON.parse(init.body) : {};
      return jsonRes(200, {
        id: path.split("/").pop(),
        spaceId: "98765",
        title: body.title ?? "Test page",
        version: { number: body.version?.number ?? 2 },
        body: body.body,
      });
    }
    if (path.match(/^\/api\/v2\/pages\/[^/]+\/properties$/) && init.method === "GET") {
      return jsonRes(200, { results: [] });
    }
    if (path.match(/^\/api\/v2\/pages\/[^/]+\/properties$/) && init.method === "POST") {
      const body = init.body ? JSON.parse(init.body) : {};
      return jsonRes(201, { key: body.key, value: body.value, version: { number: 1 } });
    }
    return jsonRes(404, { error: `unexpected ${init.method} ${path}` });
  };
}

function jsonRes(status: number, body: unknown): ReturnType<FetchLike> {
  return Promise.resolve({
    statusCode: status,
    headers: { "content-type": "application/json" },
    body: { text: async () => JSON.stringify(body), json: async () => body },
  });
}

function makeProvider(fetchImpl: FetchLike, opts: { adfEnabled?: boolean } = {}) {
  const auth = createApiTokenAuth({ email: "u@x.com", apiToken: "tok" });
  const restClient = createRestClient({
    baseUrl: "https://your-site.atlassian.net/wiki",
    userAgent: "test",
    getAuthHeader: () => auth.getAuthHeader(),
    logger: silentLogger,
    fetchOverride: fetchImpl,
  });
  return createConfluenceRestProvider({
    baseUrl: "https://your-site.atlassian.net/wiki",
    auth,
    logger: silentLogger,
    restClient,
    ...(opts.adfEnabled !== undefined ? { atlasDocFormatEnabled: opts.adfEnabled } : {}),
  });
}

describe("confluenceRestProvider", () => {
  it("healthCheck reachable on 200", async () => {
    const provider = makeProvider(makeFetch());
    const health = await provider.healthCheck();
    if (!health.reachable) {
      throw new Error(`unexpectedly unreachable: ${health.details}`);
    }
    expect(health.reachable).toBe(true);
  });

  it("discoverSpaceCapabilities resolves by key via ?keys= query", async () => {
    const provider = makeProvider(makeFetch());
    const profile = await provider.discoverSpaceCapabilities("PCO");
    expect(profile.spaceKey).toBe("PCO");
    expect(profile.spaceId).toBe("98765");
    expect(profile.bodyRepresentations).toEqual(["storage"]);
  });

  it("discoverSpaceCapabilities resolves by numeric id via /api/v2/spaces/{id}", async () => {
    const provider = makeProvider(makeFetch());
    const profile = await provider.discoverSpaceCapabilities("98765");
    expect(profile.spaceKey).toBe("PCO");
    expect(profile.spaceId).toBe("98765");
  });

  it("discoverSpaceCapabilities exposes atlas_doc_format when feature flag on", async () => {
    const provider = makeProvider(makeFetch(), { adfEnabled: true });
    const profile = await provider.discoverSpaceCapabilities("PCO");
    expect(profile.bodyRepresentations).toEqual(["storage", "atlas_doc_format"]);
  });

  it("createPage with storage representation succeeds", async () => {
    const provider = makeProvider(makeFetch());
    const page = await provider.createPage({
      spaceId: "98765",
      title: "Smoke",
      body: { representation: "storage", value: "<p>hi</p>" },
    });
    expect(page.id).toBe("11111");
    expect(page.title).toBe("Smoke");
  });

  it("createPage with atlas_doc_format is rejected when flag is off", async () => {
    const provider = makeProvider(makeFetch());
    await expect(
      provider.createPage({
        spaceId: "98765",
        title: "ADF",
        body: { representation: "atlas_doc_format", value: '{"version":1,"type":"doc","content":[]}' },
      }),
    ).rejects.toThrow(/feature flag/i);
  });

  it("setContentProperty inserts when none exists", async () => {
    const provider = makeProvider(makeFetch());
    const prop = await provider.setContentProperty("11111", "orchestrator-meta", { actorFingerprint: "abc" });
    expect(prop.key).toBe("orchestrator-meta");
    expect(prop.version).toBe(1);
  });
});
