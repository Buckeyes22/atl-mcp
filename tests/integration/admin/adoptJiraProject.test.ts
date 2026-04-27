import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { JiraIssue, JiraProvider } from "../../../src/providers/atlassian/jiraProvider.js";
import { buildAdminFixture, type AdminTestFixture } from "./_adminFixture.js";

interface JsonRpcResult {
  jsonrpc: "2.0";
  id: number;
  result?: { structuredContent?: unknown };
  error?: { code: number; message: string };
}

async function initialize(fx: AdminTestFixture): Promise<string> {
  const res = await fetch(`${fx.baseUrl}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "adopt-jira-project-test", version: "0.0.1" },
      },
    }),
  });
  const sid = res.headers.get("mcp-session-id");
  expect(sid).toBeTruthy();
  await res.text();
  await fetch(`${fx.baseUrl}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "mcp-session-id": sid! },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  });
  return sid!;
}

async function rpc(fx: AdminTestFixture, sid: string, id: number, name: string, args: unknown): Promise<JsonRpcResult> {
  const res = await fetch(`${fx.baseUrl}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "mcp-session-id": sid,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  expect(res.status).toBe(200);
  const text = await res.text();
  const dataLine = text.split("\n").find((line) => line.startsWith("data:"));
  return JSON.parse(dataLine ? dataLine.slice(5).trim() : text) as JsonRpcResult;
}

describe("admin.projects.adopt", () => {
  let fx: AdminTestFixture;
  let sid: string;
  let previousJiraBaseUrl: string | undefined;
  let issues: JiraIssue[];

  beforeEach(async () => {
    previousJiraBaseUrl = process.env["JIRA_BASE_URL"];
    process.env["JIRA_BASE_URL"] = "https://example.atlassian.net";
    issues = [
      jiraIssue("ACME-1", "Epic", "Customer onboarding", "Coordinate the onboarding release."),
      jiraIssue("ACME-2", "Story", "Capture profile details", "Users can save onboarding profile details.", "ACME-1"),
      jiraIssue("ACME-3", "Task", "Wire onboarding audit", "Operators can see adoption evidence."),
    ];
    fx = await buildAdminFixture({ providers: { jira: jiraProvider(() => issues) } });
    sid = await initialize(fx);
  });

  afterEach(async () => {
    await fx.stop();
    if (previousJiraBaseUrl === undefined) {
      delete process.env["JIRA_BASE_URL"];
    } else {
      process.env["JIRA_BASE_URL"] = previousJiraBaseUrl;
    }
  });

  it("imports Jira issues as durable project detail cards when adopting a Cloud project", async () => {
    const adopted = await rpc(fx, sid, 2, "admin.projects.adopt", {
      atlassianProjectKey: "ACME",
      reason: "load jira project into control plane",
      operatorBadge: "tester",
    });
    const adoptContent = adopted.result?.structuredContent as { alreadyAdopted: boolean; importedIssueCount: number };
    expect(adoptContent).toMatchObject({ alreadyAdopted: false, importedIssueCount: 3 });

    const detail = await rpc(fx, sid, 3, "admin.projects.get", { key: "ACME" });
    const detailContent = detail.result?.structuredContent as {
      artifactSummary: {
        jira: {
          issueCount: number;
          plannedCount: number;
          cards: Array<{ issueKey?: string; issueUrl?: string; kind: string; title: string }>;
        };
      };
      blueprint: { adoptedJiraCards?: Array<{ issueKey: string }> };
      recentAudit: Array<{ outputArtifactIds?: string[] }>;
    };
    expect(detailContent.artifactSummary.jira.issueCount).toBe(3);
    expect(detailContent.artifactSummary.jira.plannedCount).toBe(3);
    expect(detailContent.artifactSummary.jira.cards.map((card) => card.issueKey)).toEqual(["ACME-1", "ACME-2", "ACME-3"]);
    expect(detailContent.artifactSummary.jira.cards[0]?.issueUrl).toBe("https://example.atlassian.net/browse/ACME-1");
    expect(detailContent.blueprint.adoptedJiraCards?.map((card) => card.issueKey)).toEqual(["ACME-1", "ACME-2", "ACME-3"]);
    expect(detailContent.recentAudit.some((entry) => (entry.outputArtifactIds ?? []).includes("jira:ACME-2"))).toBe(true);

    issues = [
      ...issues,
      jiraIssue("ACME-4", "Story", "Send welcome checklist", "Users receive a launch checklist.", "ACME-1"),
    ];
    const refreshed = await rpc(fx, sid, 4, "admin.projects.adopt", {
      atlassianProjectKey: "ACME",
      reason: "refresh adopted jira cards",
      operatorBadge: "tester",
    });
    const refreshContent = refreshed.result?.structuredContent as { alreadyAdopted: boolean; importedIssueCount: number };
    expect(refreshContent).toMatchObject({ alreadyAdopted: true, importedIssueCount: 4 });

    const refreshedDetail = await rpc(fx, sid, 5, "admin.projects.get", { key: "ACME" });
    const refreshedContent = refreshedDetail.result?.structuredContent as {
      artifactSummary: { jira: { cards: Array<{ issueKey?: string }> } };
    };
    expect(refreshedContent.artifactSummary.jira.cards.map((card) => card.issueKey)).toEqual([
      "ACME-1",
      "ACME-2",
      "ACME-3",
      "ACME-4",
    ]);
  });
});

function jiraProvider(resolveIssues: () => readonly JiraIssue[]): JiraProvider {
  return {
    name: "jira-test",
    kind: "atlassian.jira",
    async healthCheck() {
      return { reachable: true, checkedAt: new Date().toISOString() };
    },
    async discoverProjectCapabilities(projectKeyOrId) {
      return {
        projectKey: projectKeyOrId,
        projectId: "10000",
        projectType: "company-managed",
        issueTypes: ["Epic", "Story", "Task"],
        requiredFields: {},
        customFieldMap: {},
      };
    },
    async listProjects() {
      return [{ id: "10000", key: "ACME", name: "Acme Launch", projectTypeKey: "software", style: "classic" }];
    },
    async searchByJql() {
      return resolveIssues();
    },
    async getIssue(keyOrId) {
      const issue = resolveIssues().find((candidate) => candidate.key === keyOrId || candidate.id === keyOrId);
      if (!issue) throw new Error(`missing issue ${keyOrId}`);
      return issue;
    },
    async createIssue() {
      throw new Error("not implemented in test provider");
    },
    async updateIssue() {
      throw new Error("not implemented in test provider");
    },
  };
}

function jiraIssue(key: string, issueType: string, summary: string, description: string, parentKey?: string): JiraIssue {
  return {
    id: key.replace(/[^0-9]/g, "") || key,
    key,
    fields: {
      summary,
      issuetype: { name: issueType },
      description: {
        type: "doc",
        version: 1,
        content: [{ type: "paragraph", content: [{ type: "text", text: description }] }],
      },
      updated: "2026-04-27T12:00:00.000Z",
      ...(parentKey ? { parent: { key: parentKey } } : {}),
    },
  };
}
