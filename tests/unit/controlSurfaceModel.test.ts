import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

interface ControlSurfaceModel {
  toneForStatus(status: unknown): string;
  artifactChainRows(project: Record<string, unknown>, summary: Record<string, unknown>): Array<Record<string, unknown>>;
  phaseConveyorRows(project: Record<string, unknown>, summary: Record<string, unknown>): Array<Record<string, unknown>>;
  providerHealthRows(health: Record<string, unknown>, providers: Record<string, unknown>): Array<Record<string, unknown>>;
  commandActions(project: Record<string, unknown>, summary: Record<string, unknown>): Array<Record<string, unknown>>;
  developerNextAction(project: Record<string, unknown>, summary: Record<string, unknown>, jobs: Array<Record<string, unknown>>): Record<string, unknown>;
  developerCommandRows(project: Record<string, unknown>, summary: Record<string, unknown>, jobs: Array<Record<string, unknown>>): Array<Record<string, unknown>>;
  developerLensRows(project: Record<string, unknown>, summary: Record<string, unknown>, jobs: Array<Record<string, unknown>>, sessions: Record<string, unknown>): Array<Record<string, unknown>>;
  roleProfiles(): Array<Record<string, unknown>>;
  roleCopy(role: string): Record<string, unknown>;
  roleProjectFocus(role: string, project: Record<string, unknown>, summary: Record<string, unknown>, jobs: Array<Record<string, unknown>>, sessions: Record<string, unknown>): Record<string, unknown>;
  rolePortfolioFocus(role: string, projects: Array<Record<string, unknown>>, jobs: Array<Record<string, unknown>>, sessions: Record<string, unknown>, approvals: Array<Record<string, unknown>>): Record<string, unknown>;
  agentRoleCatalog(): Array<Record<string, unknown>>;
  fetchPanelState(fetchState: Record<string, unknown>, label: string): Record<string, unknown>;
}

async function loadModel(): Promise<ControlSurfaceModel> {
  const source = await readFile("docs/control-plane/control-surface-model.js", "utf8");
  const context: { window: Record<string, unknown>; URL: typeof URL } = { window: {}, URL };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window["ControlSurfaceModel"] as ControlSurfaceModel;
}

describe("control surface model", () => {
  it("maps artifact status to stable display tones and chain rows", async () => {
    const model = await loadModel();
    expect(model.toneForStatus("linked")).toBe("green");
    expect(model.toneForStatus("planned")).toBe("amber");
    expect(model.toneForStatus("blocked")).toBe("red");

    const rows = model.artifactChainRows(
      { key: "PCO", state: "READY_FOR_BUILD" },
      {
        jira: { status: "linked", issueCount: 18, plannedCount: 6, projectUrl: "https://example.test/browse/PCO" },
        confluence: { status: "planned", plannedCount: 10 },
        vcs: { status: "missing" },
        handoff: { status: "ready", bundleCount: 1, uri: "mcp://handoff/PCO" },
      },
    );

    expect(rows.map((row) => row["id"])).toEqual(["jira", "confluence", "vcs", "context", "readiness", "handoff", "audit", "queue"]);
    expect(rows.find((row) => row["id"] === "jira")?.["tone"]).toBe("green");
    expect(rows.find((row) => row["id"] === "confluence")?.["tone"]).toBe("amber");
    expect(rows.find((row) => row["id"] === "handoff")?.["href"]).toBe("mcp://handoff/PCO");
  });

  it("builds a nine-step phase conveyor with blocked exception state", async () => {
    const model = await loadModel();
    const rows = model.phaseConveyorRows(
      { state: "DRIFT_DETECTED" },
      { readiness: { blockingReason: "Repository default branch drift detected" } },
    );

    expect(rows).toHaveLength(9);
    expect(rows.map((row) => row["id"])).toContain("requirements");
    expect(rows.map((row) => row["id"])).toContain("build");
    const blocked = rows.find((row) => row["status"] === "blocked");
    expect(blocked?.["id"]).toBe("provisioning");
    expect(blocked?.["blockingReason"]).toBe("Repository default branch drift detected");
  });

  it("normalizes provider health across health and provider payloads", async () => {
    const model = await loadModel();
    const rows = model.providerHealthRows(
      {
        components: {
          jira: { status: "green", label: "Jira", sub: "reachable" },
          confluence: { status: "red", label: "Confluence", sub: "token expired" },
          transport: { status: "green", label: "MCP transport", sub: "1 sessions" },
        },
      },
      { providers: [{ id: "bitbucket", name: "Bitbucket", configured: false, reachable: null }] },
    );

    expect(rows.find((row) => row["id"] === "jira")?.["tone"]).toBe("green");
    expect(rows.find((row) => row["id"] === "confluence")?.["tone"]).toBe("red");
    expect(rows.find((row) => row["id"] === "vcs")?.["provenance"]).toBe("admin.providers.list");
    expect(rows.find((row) => row["id"] === "transport")?.["sub"]).toBe("1 sessions");
  });

  it("derives command action availability from artifact links", async () => {
    const model = await loadModel();
    const actions = model.commandActions(
      { state: "READY_FOR_BUILD" },
      {
        jira: { projectUrl: "https://example.test/jira" },
        confluence: {},
        vcs: { repoUrl: "https://bitbucket.org/demo/pco" },
        handoff: { latestBundleId: "PCO" },
        queue: { failedJobs: 1 },
      },
    );

    expect(actions.find((action) => action["id"] === "open-jira")?.["enabled"]).toBe(true);
    expect(actions.find((action) => action["id"] === "open-confluence")?.["enabled"]).toBe(false);
    expect(actions.find((action) => action["id"] === "copy-handoff-uri")?.["copyValue"]).toBe("PCO");
    expect(actions.find((action) => action["id"] === "retry-provision")?.["enabled"]).toBe(true);
  });

  it("keeps degraded fetch states contextual", async () => {
    const model = await loadModel();
    const state = model.fetchPanelState({ error: new Error("offline") }, "Provider health");

    expect(state["status"]).toBe("degraded");
    expect(state["tone"]).toBe("amber");
    expect(String(state["message"])).toContain("Provider health data is degraded");
  });

  it("evaluates project detail through developer-focused lenses", async () => {
    const model = await loadModel();
    const summary = {
      jira: { status: "linked", projectUrl: "https://example.test/jira", issueCount: 2, plannedCount: 2 },
      confluence: { status: "linked", spaceUrl: "https://example.test/wiki", pageCount: 3, plannedCount: 3 },
      vcs: { status: "linked", repoUrl: "https://bitbucket.org/demo/pco", fileCount: 10 },
      context: { status: "linked", uri: "mcp://context-packs/PCO" },
      handoff: { status: "ready", uri: "mcp://handoff/PCO", bundleCount: 1 },
      queue: { openJobs: 0, failedJobs: 0 },
      traceRows: [{ id: "r1", repoPath: "docs/features/FEAT-1.md" }],
    };

    expect(model.developerNextAction({ key: "PCO", state: "READY_FOR_BUILD" }, summary, [])["id"]).toBe("open-handoff");

    const commands = model.developerCommandRows({ key: "PCO" }, summary, []);
    expect(commands.find((row) => row["id"] === "checkout")?.["value"]).toContain("git clone");
    expect(commands.find((row) => row["id"] === "context")?.["value"]).toBe("mcp://context-packs/PCO");

    const lenses = model.developerLensRows({ key: "PCO", state: "READY_FOR_BUILD" }, summary, [], { totalActive: 0 });
    expect(lenses.map((row) => row["id"])).toEqual([
      "actionability",
      "code-proximity",
      "debuggability",
      "context-quality",
      "trace-usefulness",
      "handoff-clarity",
      "noise-control",
    ]);
    expect(lenses.find((row) => row["id"] === "code-proximity")?.["tone"]).toBe("green");
    expect(lenses.find((row) => row["id"] === "noise-control")?.["detail"]).toContain("provider health");
  });

  it("exposes the six supported role profiles", async () => {
    const model = await loadModel();
    expect(model.roleProfiles().map((role) => role["id"])).toEqual([
      "customer",
      "product",
      "scrum",
      "developer",
      "devops",
      "operator",
    ]);
  });

  it("keeps the developer role focused on repo, context, handoff, and debug work", async () => {
    const model = await loadModel();
    const focus = model.roleProjectFocus(
      "developer",
      { key: "PCO", state: "READY_FOR_BUILD" },
      {
        vcs: { status: "linked", repoUrl: "https://bitbucket.org/demo/pco", fileCount: 10 },
        context: { status: "linked", uri: "mcp://context-packs/PCO" },
        handoff: { status: "ready", uri: "mcp://handoff/PCO" },
        queue: { failedJobs: 1 },
        traceRows: [{ id: "r1", repoPath: "src/feature.ts" }],
      },
      [{ id: "job-1", status: "failed", error: "boom" }],
      { totalActive: 1 },
    );

    expect((focus["cards"] as Array<Record<string, unknown>>).map((card) => card["id"])).toEqual([
      "repo",
      "context",
      "handoff",
      "debug",
      "trace",
    ]);
    expect((focus["primaryAction"] as Record<string, unknown>)["id"]).toBe("inspect-failure");
    expect(focus["emphasizedPanels"]).toEqual(["developer-workspace", "trace", "jobs", "handoff"]);
  });

  it("shapes customer project focus around status, outcomes, readiness, and blockers", async () => {
    const model = await loadModel();
    const focus = model.roleProjectFocus(
      "customer",
      { key: "PCO", state: "VALIDATION_FAILED" },
      {
        readiness: { score: 52, verdict: "blocked", blockingReason: "Repository branch drift" },
        handoff: { status: "not_ready" },
        jira: { status: "linked", issueCount: 8, projectUrl: "https://example.test/jira" },
        confluence: { status: "linked", pageCount: 4, spaceUrl: "https://example.test/wiki" },
      },
      [],
      {},
    );

    expect((focus["cards"] as Array<Record<string, unknown>>).map((card) => card["id"])).toEqual([
      "delivery-status",
      "readiness",
      "blockers",
      "recent-progress",
      "project-links",
    ]);
    expect((focus["primaryAction"] as Record<string, unknown>)["id"]).toBe("review-blocker");
    expect(focus["emphasizedPanels"]).toEqual(["milestones", "readiness", "resources", "timeline"]);
  });

  it("prioritizes product planning signals from Jira, Confluence, requirements, and trace", async () => {
    const model = await loadModel();
    const focus = model.roleProjectFocus(
      "product",
      { key: "PCO", state: "LINKED" },
      {
        jira: { status: "linked", issueCount: 12, plannedCount: 12 },
        confluence: { status: "linked", pageCount: 5, plannedCount: 5 },
        traceRows: [{ id: "r1" }, { id: "r2" }],
        readiness: { score: 78, verdict: "review" },
      },
      [],
      {},
    );

    expect((focus["cards"] as Array<Record<string, unknown>>).map((card) => card["id"])).toEqual([
      "requirements",
      "jira",
      "confluence",
      "trace",
      "scope-gaps",
    ]);
    expect(focus["emphasizedPanels"]).toEqual(["jira", "confluence", "trace", "readiness"]);
  });

  it("prioritizes scrum flow signals from blockers, queue, approvals, and phase state", async () => {
    const model = await loadModel();
    const focus = model.rolePortfolioFocus(
      "scrum",
      [{ key: "PCO", state: "DRIFT_DETECTED", openJobs: 1 }],
      [{ id: "job-1", status: "queued" }, { id: "job-2", status: "running" }],
      { totalActive: 1 },
      [{ id: "approval-1" }],
    );

    expect((focus["metrics"] as Array<Record<string, unknown>>).map((metric) => metric["id"])).toEqual([
      "blocked",
      "queued",
      "running",
      "approvals",
    ]);
    expect((focus["lanes"] as Array<Record<string, unknown>>).map((lane) => lane["id"])).toContain("phase-flow");
  });

  it("prioritizes devops provider health, queue, agents, webhooks, and transport", async () => {
    const model = await loadModel();
    const focus = model.rolePortfolioFocus(
      "devops",
      [{ key: "PCO", state: "READY_FOR_BUILD" }],
      [{ id: "job-1", status: "failed" }],
      { totalActive: 2 },
      [],
    );

    expect((focus["metrics"] as Array<Record<string, unknown>>).map((metric) => metric["id"])).toEqual([
      "provider-health",
      "queue-runway",
      "agents",
      "transport",
    ]);
    expect((focus["lanes"] as Array<Record<string, unknown>>).map((lane) => lane["id"])).toContain("webhooks");
  });

  it("keeps the operator role broad across health, queue, approvals, audit, providers, and lifecycle", async () => {
    const model = await loadModel();
    const focus = model.rolePortfolioFocus(
      "operator",
      [{ key: "PCO", state: "READY_FOR_BUILD" }],
      [{ id: "job-1", status: "queued" }],
      { totalActive: 1 },
      [{ id: "approval-1" }],
    );

    expect((focus["metrics"] as Array<Record<string, unknown>>).map((metric) => metric["id"])).toEqual([
      "health",
      "queue",
      "approvals",
      "audit",
    ]);
    expect(focus["emphasizedPanels"]).toEqual(["health", "queue", "approvals", "audit", "providers", "lifecycle"]);
  });

  it("exposes the analyzed ops/code engine agent role catalog for assignment decisions", async () => {
    const model = await loadModel();
    const catalog = model.agentRoleCatalog();

    expect(catalog.map((agent) => agent["id"])).toEqual([
      "architect",
      "implementer",
      "tdd-coach",
      "tester",
      "reviewer",
      "critic",
      "judge",
      "researcher",
      "docs",
      "ops",
      "guardrails-sentinel",
      "post-incident",
      "thinking-partner",
    ]);
    expect(catalog.every((agent) => String(agent["description"]).length > 40)).toBe(true);
    expect(catalog.find((agent) => agent["id"] === "implementer")?.["bestFor"]).toEqual(
      expect.arrayContaining(["planned feature implementation", "TDD execution"]),
    );
    expect(catalog.find((agent) => agent["id"] === "reviewer")?.["sourceRepos"]).toEqual([
      "velocity-code-engine",
      "velocity-ops-engine",
    ]);
    expect(catalog.find((agent) => agent["id"] === "ops")?.["workClasses"]).toEqual(
      expect.arrayContaining(["deployment", "incident-response"]),
    );
  });
});
