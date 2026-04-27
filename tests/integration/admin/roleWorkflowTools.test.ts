import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { buildAdminFixture, type AdminTestFixture } from "./_adminFixture.js";
import { defaultTenantScope } from "../../../src/domain/tenantScope.js";
import { emptyBlueprint } from "../../../src/domain/projectBlueprint.js";

interface JsonRpcResult {
  jsonrpc: "2.0";
  id: number;
  result?: { structuredContent?: unknown };
  error?: { code: number; message: string };
}

async function rpc(fx: AdminTestFixture, sid: string, id: number, name: string, args: unknown): Promise<JsonRpcResult> {
  const res = await fetch(`${fx.baseUrl}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "mcp-session-id": sid,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } }),
  });
  const text = await res.text();
  const dataLine = text.split("\n").find((line) => line.startsWith("data:"));
  return JSON.parse(dataLine ? dataLine.slice(5).trim() : text) as JsonRpcResult;
}

async function openSession(fx: AdminTestFixture): Promise<string> {
  const init = await fetch(`${fx.baseUrl}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "role-workflow-test", version: "0.0.1" } },
    }),
  });
  const sid = init.headers.get("mcp-session-id");
  if (!sid) throw new Error("no session id");
  await init.text().catch(() => {});
  await fetch(`${fx.baseUrl}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "mcp-session-id": sid },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  });
  return sid;
}

async function seedBlueprint(fx: AdminTestFixture): Promise<string> {
  const id = randomUUID();
  const now = "2026-04-27T00:00:00.000Z";
  await fx.repositories.project.create(defaultTenantScope(), {
    ...emptyBlueprint({ id, tenantId: "default", name: "Role Workflow", key: "RWF" }, now),
    state: "BLUEPRINT_READY",
    goals: ["Route stories to specialized build agents"],
    requirements: [
      {
        id: "REQ-1",
        title: "Agent routing",
        description: "Classify work and recommend agents.",
        type: "functional",
        priority: "must",
        acceptanceSignals: ["Recommendations include a confidence score"],
        sourceRefs: [{ kind: "blueprint_section", id: "RWF:raw-intake" }],
      },
    ],
    epics: [
      {
        id: "EPIC-1",
        title: "Developer routing",
        outcome: "Developers can assign work",
        stories: [
          {
            id: "STORY-API",
            title: "Add backend admin API",
            userStory: "As a developer I can assign backend stories to agents.",
            acceptanceCriteria: ["classification is backend", "assignment is audited"],
            implementationNotes: [],
            testNotes: [],
            contextRefs: [],
            dependencies: [],
            estimatedComplexity: "M",
          },
        ],
        confluenceRefs: [],
        dependencies: [],
      },
    ],
    sourcePins: [
      {
        artifactRef: { kind: "blueprint_section", id: "RWF:raw-intake" },
        version: "sha256:test",
        contentChecksum: "test",
        pinnedAt: now,
      },
    ],
  });
  return id;
}

describe("role workflow admin tools", () => {
  let fx: AdminTestFixture;
  let sid: string;

  beforeEach(async () => {
    fx = await buildAdminFixture();
    sid = await openSession(fx);
  });

  afterEach(async () => {
    await fx.stop();
  });

  it("requirements assist creates intake, generates a blueprint, and previews Jira nodes", async () => {
    const create = await rpc(fx, sid, 2, "admin.requirements.assist.create_intake", {
      name: "Requirements Assist Demo",
      key: "RAD",
      description: "must: PM can submit a project description. Acceptance: Jira preview is generated.",
      briefs: [{ name: "brief.md", text: "should: Upload briefs can contribute requirements." }],
      operatorBadge: "pm@example.com",
    });
    const intake = create.result?.structuredContent as { projectId: string; state: string; auditEntryId: string };
    expect(intake.state).toBe("DRAFT_INTAKE");
    expect(intake.auditEntryId).toMatch(/^[0-9a-f-]{36}$/);

    const generate = await rpc(fx, sid, 3, "admin.requirements.assist.generate_blueprint", { projectId: intake.projectId, useSampling: false, operatorBadge: "pm@example.com" });
    const generated = generate.result?.structuredContent as { state: string; blueprintVersion: number; requirements: unknown[] };
    expect(generated.state).toBe("BLUEPRINT_READY");
    expect(generated.blueprintVersion).toBeGreaterThan(1);
    expect(generated.requirements.length).toBeGreaterThan(0);

    const preview = await rpc(fx, sid, 4, "admin.requirements.assist.provision_preview", { projectKey: "RAD", jiraProjectKey: "RAD" });
    const jira = preview.result?.structuredContent as { totalNodes: number; quality: { score: number } };
    expect(jira.totalNodes).toBeGreaterThan(0);
    expect(jira.quality.score).toBeGreaterThan(0);
  });

  it("classifies, recommends, assigns, and lists developer work", async () => {
    await seedBlueprint(fx);

    const recommend = await rpc(fx, sid, 5, "admin.agent.work.recommend", { projectKey: "RWF", workRef: { kind: "blueprint_story", id: "STORY-API" } });
    const recommendations = recommend.result?.structuredContent as { classification: { workType: string }; recommendations: unknown[] };
    expect(recommendations.classification.workType).toBe("backend");

    const assign = await rpc(fx, sid, 6, "admin.agent.work.assign", {
      projectKey: "RWF",
      workRef: { kind: "blueprint_story", id: "STORY-API" },
      assignedAgentId: "manual-agent",
      assignedBy: "dev@example.com",
      reason: "assign backend API story",
    });
    const assigned = assign.result?.structuredContent as { assignment: { status: string; assignedAgentId?: string }; auditEntryId: string };
    expect(assigned.assignment.status).toBe("assigned");
    expect(assigned.assignment.assignedAgentId).toBe("manual-agent");
    expect(assigned.auditEntryId).toMatch(/^[0-9a-f-]{36}$/);

    const listed = await rpc(fx, sid, 7, "admin.agent.work.list", { projectKey: "RWF" });
    const list = listed.result?.structuredContent as { assignments: Array<{ assignedAgentId?: string }> };
    expect(list.assignments.map((row) => row.assignedAgentId)).toContain("manual-agent");
  });

  it("scores project content quality and persists reports", async () => {
    await seedBlueprint(fx);

    const score = await rpc(fx, sid, 8, "admin.quality.score.project", { projectKey: "RWF", operatorBadge: "operator@example.com" });
    const scored = score.result?.structuredContent as { report: { score: number; grade: string; llmCritique: { status: string } }; auditEntryId: string };
    expect(scored.report.score).toBeGreaterThan(70);
    expect(scored.report.grade).toMatch(/A|B/);
    expect(scored.report.llmCritique.status).toBe("unavailable");
    expect(scored.auditEntryId).toMatch(/^[0-9a-f-]{36}$/);

    const reports = await rpc(fx, sid, 9, "admin.quality.reports.list", { projectKey: "RWF" });
    const listed = reports.result?.structuredContent as { reports: Array<{ grade: string }> };
    expect(listed.reports).toHaveLength(1);
  });
});
