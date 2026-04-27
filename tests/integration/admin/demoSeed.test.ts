import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
        clientInfo: { name: "demo-seed-test", version: "0.0.1" },
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

describe("admin.demo.seed", () => {
  let fx: AdminTestFixture;
  let sid: string;
  let previousJiraBaseUrl: string | undefined;
  let previousConfluenceBaseUrl: string | undefined;

  beforeEach(async () => {
    previousJiraBaseUrl = process.env["JIRA_BASE_URL"];
    previousConfluenceBaseUrl = process.env["CONFLUENCE_BASE_URL"];
    process.env["JIRA_BASE_URL"] = "https://example.atlassian.net";
    process.env["CONFLUENCE_BASE_URL"] = "https://example.atlassian.net/wiki";
    fx = await buildAdminFixture();
    sid = await initialize(fx);
  });

  afterEach(async () => {
    await fx.stop();
    if (previousJiraBaseUrl === undefined) {
      delete process.env["JIRA_BASE_URL"];
    } else {
      process.env["JIRA_BASE_URL"] = previousJiraBaseUrl;
    }
    if (previousConfluenceBaseUrl === undefined) {
      delete process.env["CONFLUENCE_BASE_URL"];
    } else {
      process.env["CONFLUENCE_BASE_URL"] = previousConfluenceBaseUrl;
    }
  });

  it("loads integrated Jira-style projects into the control plane data model", async () => {
    const seeded = await rpc(fx, sid, 2, "admin.demo.seed", { mode: "sample", maxProjects: 3, operatorBadge: "tester" });
    const seedContent = seeded.result?.structuredContent as {
      source: string;
      projectsCreated: number;
      jobsUpserted: number;
      auditEntriesAppended: number;
      projectKeys: string[];
    };

    expect(seedContent.source).toBe("sample");
    expect(seedContent.projectsCreated).toBe(3);
    expect(seedContent.jobsUpserted).toBe(9);
    expect(seedContent.auditEntriesAppended).toBe(15);
    expect(seedContent.projectKeys).toEqual(["PCO", "CX", "DATA"]);

    const listed = await rpc(fx, sid, 3, "admin.projects.list", {});
    const listContent = listed.result?.structuredContent as {
      projects: Array<{
        key: string;
        atlassianProjectKey?: string;
        openJobs: number;
        artifactSummary: {
          jira: { projectKey: string | null; projectUrl: string | null; issueCount: number; plannedCount: number; status: string };
          confluence: { spaceId: string | null; spaceUrl: string | null; pageCount: number; plannedCount: number; status: string };
          vcs: { repoUrl: string | null; fileCount: number; status: string };
          handoff: { bundleCount: number; status: string; uri?: string };
          context?: { packCount: number; status: string; uri?: string };
          readiness?: { verdict: string; score: number; blockedCount: number };
          traceRows?: Array<{ requirementId: string; jiraIssueKey: string | null; contextPackUri: string | null }>;
        };
        phaseSummary?: { phaseId: string; readinessPercent: number };
        agentLaneSummary?: { readyHandoffs: number; failedJobs: number };
        latestEvent?: { toolName: string };
      }>;
    };
    expect(listContent.projects.map((project) => project.key).sort()).toEqual(["CX", "DATA", "PCO"]);
    expect(listContent.projects.every((project) => project.atlassianProjectKey === project.key)).toBe(true);
    const pcoSummary = listContent.projects.find((project) => project.key === "PCO")?.artifactSummary;
    expect(pcoSummary).toMatchObject({
      jira: {
        projectKey: "PCO",
        projectUrl: "https://example.atlassian.net/jira/software/projects/PCO/summary",
        issueCount: 18,
        plannedCount: 6,
        status: "linked",
      },
      confluence: {
        spaceId: "PCO",
        spaceUrl: "https://example.atlassian.net/wiki/spaces/PCO",
        pageCount: 7,
        plannedCount: 10,
        status: "linked",
      },
      vcs: { repoUrl: "https://bitbucket.org/demo/platform-control-orchestrator", fileCount: 10, status: "linked" },
      handoff: { bundleCount: 1, status: "ready" },
    });
    expect(pcoSummary?.handoff.uri).toBe("mcp://handoff/PCO");
    expect(pcoSummary?.context).toMatchObject({ packCount: 1, status: "linked", uri: "mcp://context-packs/PCO" });
    expect(pcoSummary?.readiness).toMatchObject({ verdict: "ready", score: 100, blockedCount: 0 });
    expect(pcoSummary?.traceRows?.[0]).toMatchObject({ requirementId: "REQ-1", contextPackUri: "mcp://context-packs/PCO" });
    const pcoProject = listContent.projects.find((project) => project.key === "PCO");
    expect(pcoProject?.phaseSummary).toMatchObject({ phaseId: "handoff", readinessPercent: 100 });
    expect(pcoProject?.agentLaneSummary).toMatchObject({ readyHandoffs: 1, failedJobs: 0 });
    expect(pcoProject?.latestEvent?.toolName).toBe("admin.lifecycle.handoff.bundle");

    const detail = await rpc(fx, sid, 4, "admin.projects.get", { key: "PCO" });
    const detailContent = detail.result?.structuredContent as {
      project: { key: string; state: string; atlassianProjectKey?: string };
      artifactSummary: {
        jira: { projectUrl: string | null; cards: Array<{ title: string; kind: string; issueUrl?: string }> };
        confluence: { spaceUrl: string | null; pages: Array<{ title: string; templateSlug: string; pageUrl?: string }> };
        context?: { uri?: string };
        readiness?: { verdict: string; score: number };
        traceRows?: Array<{ featureTitle: string; confluenceTitle: string | null; handoffBundleId: string | null }>;
      };
      latestEvent?: { toolName: string; outcome: string };
      phaseSummary?: { phaseId: string };
      agentLaneSummary?: { readyHandoffs: number };
      recentAudit: Array<{ toolName: string; outputArtifactIds?: string[] }>;
      recentJobs: Array<{ status: string; result?: unknown }>;
    };
    expect(detailContent.project).toMatchObject({ key: "PCO", state: "READY_FOR_BUILD", atlassianProjectKey: "PCO" });
    expect(detailContent.artifactSummary.jira.projectUrl).toBe("https://example.atlassian.net/jira/software/projects/PCO/summary");
    expect(detailContent.artifactSummary.confluence.spaceUrl).toBe("https://example.atlassian.net/wiki/spaces/PCO");
    expect(detailContent.artifactSummary.jira.cards.length).toBe(6);
    expect(detailContent.artifactSummary.jira.cards[0]?.issueUrl).toBe("https://example.atlassian.net/browse/PCO-EPIC-1");
    expect(detailContent.artifactSummary.confluence.pages.length).toBe(10);
    expect(detailContent.artifactSummary.context?.uri).toBe("mcp://context-packs/PCO");
    expect(detailContent.artifactSummary.readiness).toMatchObject({ verdict: "ready", score: 100 });
    expect(detailContent.artifactSummary.traceRows?.length).toBeGreaterThan(0);
    expect(detailContent.latestEvent).toMatchObject({ toolName: "admin.lifecycle.handoff.bundle", outcome: "ok" });
    expect(detailContent.phaseSummary).toMatchObject({ phaseId: "handoff" });
    expect(detailContent.agentLaneSummary).toMatchObject({ readyHandoffs: 1 });
    expect(detailContent.recentAudit.map((entry) => entry.toolName)).toContain("admin.lifecycle.handoff.bundle");
    expect(detailContent.recentAudit.some((entry) => (entry.outputArtifactIds ?? []).includes("handoff:PCO"))).toBe(true);
    expect(detailContent.recentJobs.length).toBe(3);
    expect(detailContent.recentJobs.some((job) => job.result !== undefined)).toBe(true);
  });
});
