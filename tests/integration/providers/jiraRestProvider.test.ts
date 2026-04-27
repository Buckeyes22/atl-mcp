// Recorded-fixture tests for the Jira REST provider.
// Uses a fake fetch that returns canned JSON for each known URL pattern.

import { describe, expect, it } from "vitest";
import { pino } from "pino";
import { createJiraRestProvider } from "../../../src/providers/atlassian/jiraRestProvider.js";
import { createApiTokenAuth } from "../../../src/providers/atlassian/auth/apiToken.js";
import { createRestClient, type FetchLike } from "../../../src/providers/http/restClient.js";

const silentLogger = pino({ level: "silent" });

const FIXTURE_PROJECT_PCO = {
  id: "10001",
  key: "PCO",
  name: "Project Context Orchestrator",
  style: "classic",
};

// Real-API responses on /createmeta/{key}/issuetypes do NOT include `fields`
// per issue type — that's why F-010 surfaced. Fixture matches real shape.
const FIXTURE_CREATEMETA = {
  issueTypes: [
    { id: "10001", name: "Story" },
    { id: "10002", name: "Bug" },
  ],
};

// F-010 closure: per-issue-type drill-down endpoints carry the field metadata.
const FIXTURE_CREATEMETA_FIELDS_STORY = {
  fields: [
    { fieldId: "summary", name: "Summary", required: true, hasDefaultValue: false },
    { fieldId: "components", name: "Components", required: false, hasDefaultValue: false },
  ],
};
const FIXTURE_CREATEMETA_FIELDS_BUG = {
  fields: [
    { fieldId: "summary", name: "Summary", required: true, hasDefaultValue: false },
    { fieldId: "priority", name: "Priority", required: true, hasDefaultValue: true },
  ],
};

const FIXTURE_FIELDS = [
  { id: "summary", name: "Summary", custom: false },
  { id: "customfield_10001", name: "Story Points", custom: true },
  { id: "customfield_10002", name: "Acceptance Criteria", custom: true },
];

function makeFetch(): FetchLike {
  return async (url, init) => {
    const u = new URL(url);
    if (u.pathname === "/rest/api/3/project/PCO" && init.method === "GET") {
      return jsonRes(200, FIXTURE_PROJECT_PCO);
    }
    if (u.pathname === "/rest/api/3/issue/createmeta/PCO/issuetypes" && init.method === "GET") {
      return jsonRes(200, FIXTURE_CREATEMETA);
    }
    if (u.pathname === "/rest/api/3/issue/createmeta/PCO/issuetypes/10001" && init.method === "GET") {
      return jsonRes(200, FIXTURE_CREATEMETA_FIELDS_STORY);
    }
    if (u.pathname === "/rest/api/3/issue/createmeta/PCO/issuetypes/10002" && init.method === "GET") {
      return jsonRes(200, FIXTURE_CREATEMETA_FIELDS_BUG);
    }
    if (u.pathname === "/rest/api/3/field" && init.method === "GET") {
      return jsonRes(200, FIXTURE_FIELDS);
    }
    if (u.pathname === "/rest/api/3/issue" && init.method === "POST") {
      return jsonRes(201, { id: "12345", key: "PCO-99", fields: { summary: "Smoke" } });
    }
    if (u.pathname === "/rest/api/3/issue/PCO-99" && init.method === "GET") {
      return jsonRes(200, { id: "12345", key: "PCO-99", fields: { summary: "Smoke" } });
    }
    if (u.pathname === "/rest/api/3/myself" && init.method === "GET") {
      return jsonRes(200, { accountId: "test-acct" });
    }
    return jsonRes(404, { error: `unexpected ${init.method} ${u.pathname}` });
  };
}

function jsonRes(status: number, body: unknown): ReturnType<FetchLike> {
  return Promise.resolve({
    statusCode: status,
    headers: { "content-type": "application/json" },
    body: { text: async () => JSON.stringify(body), json: async () => body },
  });
}

function makeProvider(fetchImpl: FetchLike) {
  const auth = createApiTokenAuth({ email: "u@x.com", apiToken: "tok" });
  const restClient = createRestClient({
    baseUrl: "https://your-site.atlassian.net",
    userAgent: "test",
    getAuthHeader: () => auth.getAuthHeader(),
    logger: silentLogger,
    fetchOverride: fetchImpl,
  });
  return createJiraRestProvider({
    baseUrl: "https://your-site.atlassian.net",
    auth,
    logger: silentLogger,
    restClient,
  });
}

describe("jiraRestProvider", () => {
  it("healthCheck returns reachable=true on 200 from /myself", async () => {
    const provider = makeProvider(makeFetch());
    const health = await provider.healthCheck();
    expect(health.reachable).toBe(true);
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("discoverProjectCapabilities returns structured profile", async () => {
    const provider = makeProvider(makeFetch());
    const profile = await provider.discoverProjectCapabilities("PCO");
    expect(profile.projectKey).toBe("PCO");
    expect(profile.projectId).toBe("10001");
    expect(profile.projectType).toBe("company-managed");
    expect(profile.issueTypes).toEqual(["Story", "Bug"]);
    expect(profile.requiredFields["Story"]).toEqual(["Summary"]);
    // hasDefaultValue=true → not in required list (Bug.priority)
    expect(profile.requiredFields["Bug"]).toEqual(["Summary"]);
    expect(profile.customFieldMap["Story Points"]).toBe("customfield_10001");
  });

  it("createIssue posts to /issue and returns the created issue", async () => {
    const provider = makeProvider(makeFetch());
    const issue = await provider.createIssue({
      projectKey: "PCO",
      issueType: "Story",
      summary: "Smoke",
    });
    expect(issue.key).toBe("PCO-99");
    expect(issue.id).toBe("12345");
  });

  it("getIssue retrieves the issue by key", async () => {
    const provider = makeProvider(makeFetch());
    const issue = await provider.getIssue("PCO-99");
    expect(issue.key).toBe("PCO-99");
  });
});
