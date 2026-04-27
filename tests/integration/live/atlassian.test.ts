// F-005 closure: env-gated live tests against real Atlassian.
// Activate by setting ATLASSIAN_LIVE_TEST=1 alongside the standard
// ATLASSIAN_* env block. Skipped silently otherwise so default `npm test`
// stays self-contained.
//
// What this covers (v6 §28 M2 acceptance):
//   - Jira /project/{key} returns the expected shape.
//   - Jira /createmeta/{key}/issuetypes returns the expected shape.
//   - Per-issue-type drill-down (F-010) populates required fields.
//   - Confluence v2 /spaces?keys=... returns the expected shape.
//   - End-to-end discoverProjectCapabilities + discoverSpaceCapabilities work.

import { describe, expect, it } from "vitest";
import { pino } from "pino";
import { createApiTokenAuth } from "../../../src/providers/atlassian/auth/apiToken.js";
import { createJiraRestProvider } from "../../../src/providers/atlassian/jiraRestProvider.js";
import { createConfluenceRestProvider } from "../../../src/providers/atlassian/confluenceRestProvider.js";

const ENABLED = process.env["ATLASSIAN_LIVE_TEST"] === "1";

const ATL_EMAIL = process.env["ATLASSIAN_EMAIL"];
const ATL_TOKEN = process.env["ATLASSIAN_API_TOKEN"];
const JIRA_BASE = process.env["JIRA_BASE_URL"];
const CONF_BASE = process.env["CONFLUENCE_BASE_URL"];
const PROJECT_KEY = process.env["JIRA_PROJECT_KEY"];
const SPACE_KEY = process.env["CONFLUENCE_SPACE_KEY"];

const silentLogger = pino({ level: "silent" });

describe.runIf(ENABLED)("live Atlassian smoke (ATLASSIAN_LIVE_TEST=1)", () => {
  it("Jira: discoverProjectCapabilities returns a populated profile (F-010 closure)", async () => {
    expect(ATL_EMAIL && ATL_TOKEN && JIRA_BASE && PROJECT_KEY).toBeTruthy();
    const auth = createApiTokenAuth({ email: ATL_EMAIL!, apiToken: ATL_TOKEN! });
    const jira = createJiraRestProvider({
      baseUrl: JIRA_BASE!,
      auth,
      logger: silentLogger,
      userAgent: "atl-mcp-orchestrator-live-test",
    });
    const profile = await jira.discoverProjectCapabilities(PROJECT_KEY!);
    expect(profile.projectKey).toBe(PROJECT_KEY);
    expect(profile.issueTypes.length).toBeGreaterThan(0);
    // F-010: per-issue-type drill-down populates requiredFields.
    const requiredCounts = Object.values(profile.requiredFields).map((arr) => arr.length);
    const totalRequired = requiredCounts.reduce((sum, n) => sum + n, 0);
    expect(totalRequired).toBeGreaterThan(0);
  }, 30_000);

  it("Confluence: discoverSpaceCapabilities by key resolves the space (M2)", async () => {
    expect(ATL_EMAIL && ATL_TOKEN && CONF_BASE && SPACE_KEY).toBeTruthy();
    const auth = createApiTokenAuth({ email: ATL_EMAIL!, apiToken: ATL_TOKEN! });
    const conf = createConfluenceRestProvider({
      baseUrl: CONF_BASE!,
      auth,
      logger: silentLogger,
      userAgent: "atl-mcp-orchestrator-live-test",
    });
    const profile = await conf.discoverSpaceCapabilities(SPACE_KEY!);
    expect(profile.spaceKey).toBe(SPACE_KEY);
    expect(profile.spaceId).toMatch(/^\d+$/);
    expect(profile.bodyRepresentations).toContain("storage");
  }, 30_000);
});
