// End-to-end preflight: composes Jira + Confluence + UIO providers (fixture-driven)
// and verifies the resulting ProjectProfile shape + warnings.

import { describe, expect, it } from "vitest";
import { pino } from "pino";
import { runPreflight } from "../../src/preflight/preflightWorkflow.js";
import { createUioAdapter } from "../../src/providers/uio/uioMcpAdapter.js";
import { createApiTokenAuth } from "../../src/providers/atlassian/auth/apiToken.js";
import { createJiraRestProvider } from "../../src/providers/atlassian/jiraRestProvider.js";
import { createConfluenceRestProvider } from "../../src/providers/atlassian/confluenceRestProvider.js";
import { createRestClient, type FetchLike } from "../../src/providers/http/restClient.js";

const silentLogger = pino({ level: "silent" });

const jiraFetch: FetchLike = async (url, init) => {
  const u = new URL(url);
  if (u.pathname === "/rest/api/3/project/PCO") return ok({ id: "10001", key: "PCO", name: "n", style: "classic" });
  if (u.pathname === "/rest/api/3/issue/createmeta/PCO/issuetypes")
    return ok({
      issueTypes: [
        {
          id: "10001",
          name: "Story",
          fields: [{ fieldId: "summary", name: "Summary", required: true, hasDefaultValue: false }],
        },
      ],
    });
  if (u.pathname === "/rest/api/3/field") return ok([{ id: "summary", name: "Summary", custom: false }]);
  return ok({});
};

const confluenceFetch: FetchLike = async (url) => {
  const u = new URL(url);
  const path = u.pathname.startsWith("/wiki") ? u.pathname.slice(5) : u.pathname;
  if (path === "/api/v2/spaces/PCO") return ok({ id: "9999", key: "PCO", name: "n" });
  return ok({});
};

const uioFetch: typeof fetch = async (url) => {
  const u = new URL(typeof url === "string" ? url : url.toString());
  if (u.pathname === "/api/v1/healthz") return new Response("{}", { status: 200 });
  if (u.pathname.startsWith("/healthz")) return new Response("{}", { status: 200 });
  if (u.pathname.startsWith("/collections/")) return new Response("{}", { status: 200 });
  return new Response("not-found", { status: 404 });
};

const uioFetchAllDown: typeof fetch = async () => new Response("err", { status: 503 });

function ok(body: unknown): ReturnType<FetchLike> {
  return Promise.resolve({
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: { text: async () => JSON.stringify(body), json: async () => body },
  });
}

function makeJira(fetchImpl: FetchLike) {
  const auth = createApiTokenAuth({ email: "u@x.com", apiToken: "tok" });
  const restClient = createRestClient({
    baseUrl: "https://x.atlassian.net",
    userAgent: "test",
    getAuthHeader: () => auth.getAuthHeader(),
    logger: silentLogger,
    fetchOverride: fetchImpl,
  });
  return createJiraRestProvider({ baseUrl: "https://x.atlassian.net", auth, logger: silentLogger, restClient });
}
function makeConfluence(fetchImpl: FetchLike) {
  const auth = createApiTokenAuth({ email: "u@x.com", apiToken: "tok" });
  const restClient = createRestClient({
    baseUrl: "https://x.atlassian.net/wiki",
    userAgent: "test",
    getAuthHeader: () => auth.getAuthHeader(),
    logger: silentLogger,
    fetchOverride: fetchImpl,
  });
  return createConfluenceRestProvider({
    baseUrl: "https://x.atlassian.net/wiki",
    auth,
    logger: silentLogger,
    restClient,
  });
}

describe("runPreflight (M2 acceptance)", () => {
  it("happy path: produces a fully-populated ProjectProfile", async () => {
    const profile = await runPreflight(
      {
        tenantId: "default",
        projectId: "proj-1",
        jiraProjectKeyOrId: "PCO",
        confluenceSpaceKeyOrId: "PCO",
      },
      {
        jira: makeJira(jiraFetch),
        confluence: makeConfluence(confluenceFetch),
        uio: createUioAdapter({
          enabled: true,
          baseUrl: "https://uio.example.com",
          apiKey: "k",
          qdrantUrl: "https://qdrant.example.com",
          qdrantApiKey: "q",
          defaultCollection: "uio_books_raw_v1",
          logger: silentLogger,
          fetchImpl: uioFetch,
        }),
        authMode: "api_token",
        logger: silentLogger,
      },
    );

    expect(profile.tenantId).toBe("default");
    expect(profile.projectId).toBe("proj-1");
    expect(profile.jira.projectKey).toBe("PCO");
    expect(profile.confluence.spaceKey).toBe("PCO");
    expect(profile.uio).toBeDefined();
    expect(profile.uio?.baseUrlReachable).toBe(true);
    expect(profile.uio?.qdrantReachable).toBe(true);
    expect(profile.uio?.defaultCollectionExists).toBe(true);
    expect(profile.auth.modes).toContain("api_token");
    // VCS not configured → info warning
    expect(profile.warnings.find((w) => w.target === "vcs")?.severity).toBe("info");
    // Vector store stub → info warning
    expect(profile.warnings.find((w) => w.target === "vector")?.severity).toBe("info");
  });

  it("partial failure: Jira down → error warning, profile still returned", async () => {
    const downFetch: FetchLike = async () =>
      Promise.resolve({
        statusCode: 503,
        headers: {},
        body: { text: async () => "down", json: async () => ({}) },
      });
    const profile = await runPreflight(
      {
        tenantId: "default",
        projectId: "proj-1",
        jiraProjectKeyOrId: "PCO",
        confluenceSpaceKeyOrId: "PCO",
      },
      {
        jira: makeJira(downFetch),
        confluence: makeConfluence(confluenceFetch),
        authMode: "api_token",
        logger: silentLogger,
      },
    );
    expect(profile.warnings.find((w) => w.target === "jira" && w.severity === "error")).toBeDefined();
    // Confluence still succeeds
    expect(profile.confluence.spaceKey).toBe("PCO");
  });

  it("UIO partial reach: emits warn", async () => {
    const profile = await runPreflight(
      {
        tenantId: "default",
        projectId: "proj-1",
        jiraProjectKeyOrId: "PCO",
        confluenceSpaceKeyOrId: "PCO",
      },
      {
        jira: makeJira(jiraFetch),
        confluence: makeConfluence(confluenceFetch),
        uio: createUioAdapter({
          enabled: true,
          baseUrl: "https://uio.example.com",
          apiKey: "k",
          qdrantUrl: "https://qdrant.example.com",
          logger: silentLogger,
          fetchImpl: uioFetchAllDown,
        }),
        authMode: "api_token",
        logger: silentLogger,
      },
    );
    expect(profile.uio?.baseUrlReachable).toBe(false);
    expect(profile.warnings.find((w) => w.target === "uio")).toBeDefined();
  });

  it("UIO disabled: profile.uio is undefined and no UIO warning", async () => {
    const profile = await runPreflight(
      {
        tenantId: "default",
        projectId: "proj-1",
        jiraProjectKeyOrId: "PCO",
        confluenceSpaceKeyOrId: "PCO",
      },
      {
        jira: makeJira(jiraFetch),
        confluence: makeConfluence(confluenceFetch),
        uio: createUioAdapter({ enabled: false, logger: silentLogger }),
        authMode: "api_token",
        logger: silentLogger,
      },
    );
    expect(profile.uio).toBeUndefined();
    expect(profile.warnings.find((w) => w.target === "uio")).toBeUndefined();
  });
});
