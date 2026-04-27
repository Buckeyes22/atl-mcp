import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("control plane provisioning UI", () => {
  it("threads known provisioned artifacts into the handoff bundle call", async () => {
    const source = await readFile("docs/control-plane/page-projects.jsx", "utf8");

    expect(source).toContain("setLastJiraProjectKey");
    expect(source).toContain("setLastConfluenceSpaceId");
    expect(source).toContain("setLastRepoUrl");
    expect(source).toMatch(/tool:\s*'admin\.lifecycle\.handoff\.bundle'[\s\S]*baseArgs:\s*\{[\s\S]*jiraProjectKey[\s\S]*confluenceSpaceId[\s\S]*repoUrl/s);
  });

  it("frames primary navigation around pipeline and agent operations", async () => {
    const source = await readFile("docs/control-plane/components.jsx", "utf8");

    expect(source).toMatch(/id:\s*'dashboard'[\s\S]*label:\s*'Pipeline'/);
    expect(source).toMatch(/id:\s*'sessions'[\s\S]*label:\s*'Agents'/);
    expect(source).toMatch(/id:\s*'jobs'[\s\S]*label:\s*'Queue'/);
    expect(source).toContain("PIPELINE_PHASES");
    expect(source).toContain("BuildControlRail");
    expect(source).toContain("ProviderHealthStrip");
    expect(source).toContain("PhaseConveyor");
    expect(source).toContain("ArtifactChainDiagram");
    expect(source).toContain("ReadinessRadar");
    expect(source).toContain("ActivityHeatStrip");
    expect(source).toContain("buildControlMetrics");
    expect(source).toContain("RoleSelect");
    expect(source).toContain("roleLens");
    expect(source).toContain("roleProfiles()");
  });

  it("persists the role lens in operator tweaks", async () => {
    const source = await readFile("docs/control-plane/app-tweaks.jsx", "utf8");

    expect(source).toContain("\"roleLens\": \"developer\"");
    expect(source).toContain("roleProfiles()");
    expect(source).toContain("setTweak('roleLens'");
  });

  it("makes the dashboard the inception-to-build control surface", async () => {
    const source = await readFile("docs/control-plane/page-dashboard.jsx", "utf8");

    expect(source).toContain("admin.projects.list");
    expect(source).toContain("Build pipeline");
    expect(source).toContain("roleCopy(roleLens)");
    expect(source).toContain("RolePortfolioFocus");
    expect(source).toContain("PIPELINE_PHASES");
    expect(source).toContain("ProjectCommandStack");
    expect(source).toContain("ArtifactStrip");
    expect(source).toContain("Agent monitor");
    expect(source).toContain("CatalogStandardsPanel");
    expect(source).toContain("standardsRulesFor");
    expect(source).toContain("ScorecardRuleRow");
    expect(source).toContain("BuildControlRail");
  });

  it("integrates Jira, Confluence, VCS, readiness, and project marks into project pages", async () => {
    const components = await readFile("docs/control-plane/components.jsx", "utf8");
    const projects = await readFile("docs/control-plane/page-projects.jsx", "utf8");

    expect(components).toContain("function Icon");
    expect(components).toContain("function ProjectMark");
    expect(components).toContain("function ArtifactStrip");
    expect(components).toContain("function ProjectProgressRail");
    expect(components).toContain("function ReadinessScorecard");
    expect(projects).toContain("ResourceDock");
    expect(projects).toContain("TraceMapWidget");
    expect(projects).toContain("OrchestrationTimeline");
    expect(projects).toContain("NextBestActionPanel");
    expect(projects).toContain("JiraCardsPanel");
    expect(projects).toContain("ConfluencePagesPanel");
    expect(projects).toContain("AgentHandoffPanel");
    expect(projects).toContain("artifactSummary");
    expect(projects).toContain("summary?.jira?.projectUrl");
    expect(projects).toContain("summary?.confluence?.spaceUrl");
    expect(projects).toContain("card.issueUrl");
    expect(projects).toContain("page.pageUrl");
    expect(projects).toContain("ProjectMilestonePanel");
    expect(projects).toContain("ProjectCommandHeader");
    expect(projects).toContain("ProjectSideRail");
    expect(projects).toContain("PhaseConveyor");
    expect(projects).toContain("ProviderHealthStrip");
    expect(projects).toContain("TraceMatrixPanel");
    expect(projects).toContain("ActivityHeatStrip");
    expect(projects).toContain("DeveloperWorkspacePanel");
    expect(projects).toContain("RoleWorkspacePanel");
    expect(projects).toContain("roleProjectFocus");
    expect(projects).toContain("rolePortfolioFocus");
    expect(projects).toContain("roleLens === 'developer'");
    expect(projects).toContain("DeveloperTraceCards");
    expect(projects).toContain("developer workspace");
    expect(projects).toContain("next developer action");
    expect(projects).toContain("developer launchpad");
    expect(projects).toContain("source of truth");
    expect(projects).toContain("debug surface");
    expect(projects).toContain("operational guardrails");
    expect(projects).toContain("OperatorLaunchpad");
    expect(projects).toContain("projectMilestoneRows");
    expect(projects).toContain("ProjectBreadcrumbTrail");
    expect(projects).toContain("ArtifactMatrixPanel");
    expect(projects).toContain("artifactMatrixRows");
    expect(projects).toContain("BuildControlRail");
    expect(projects).toContain("PortfolioControlSummary");
  });

  it("documents the next frontend refinement catalog with research and InfernoDev status", async () => {
    const catalog = await readFile("docs/control-plane/frontend-refinement-catalog.md", "utf8");

    expect(catalog).toContain("Backstage");
    expect(catalog).toContain("Compass");
    expect(catalog).toContain("Linear");
    expect(catalog).toContain("InfernoDev");
    expect(catalog).toContain("D:\\git\\start-lists\\Design Essentials");
    expect(catalog).toContain("192.168.22.22");
  });

  it("makes the sessions page monitor build agents and queue load", async () => {
    const source = await readFile("docs/control-plane/page-tier23.jsx", "utf8");

    expect(source).toContain("roleCopy(roleLens)");
    expect(source).toContain("RolePortfolioFocus");
    expect(source).toContain("Agent monitor");
    expect(source).toContain("admin.jobs.list");
    expect(source).toContain("admin.projects.list");
    expect(source).toContain("featuresDisabled");
    expect(source).toContain("BuildControlRail");
    expect(source).toContain("ProviderHealthStrip");
    expect(source).toContain("AgentRunwayPanel");
    expect(source).toContain("agentOperationLanes");
  });

  it("reframes queue and approvals as build-control surfaces", async () => {
    const source = await readFile("docs/control-plane/page-jobs-policy.jsx", "utf8");

    expect(source).toContain("roleCopy(roleLens)");
    expect(source).toContain("RolePortfolioFocus");
    expect(source).toContain("BuildControlRail");
    expect(source).toContain("QueueRunwayPanel");
    expect(source).toContain("ApprovalGatePanel");
    expect(source).toContain("ProviderHealthStrip");
    expect(source).toContain("queuePhaseRows");
    expect(source).toContain("admin.projects.list");
    expect(source).toContain("Build queue");
  });

  it("replaces the screen catalog with the project pipeline map", async () => {
    const source = await readFile("docs/control-plane/page-index.jsx", "utf8");

    expect(source).toContain("Inception-to-build pipeline");
    expect(source).toContain("build-agent-handoff");
    expect(source).not.toContain("15 screens");
  });

  it("can reach admin MCP from the served UI or a localhost preview", async () => {
    const source = await readFile("docs/control-plane/mcp-client.js", "utf8");
    const index = await readFile("docs/control-plane/index.html", "utf8");

    expect(source).toContain("127.0.0.1:3001/mcp");
    expect(source).toContain("candidateEndpoints");
    expect(source).toContain("getEndpoint");
    expect(source).toContain("admin MCP endpoint");
    expect(index).toContain("mcp-client.js?v=");
    expect(index).toContain("control-surface-model.js?v=");
  });

  it("wires role-specific workflow pages into the control plane", async () => {
    const index = await readFile("docs/control-plane/index.html", "utf8");
    const roleWorkflows = await readFile("docs/control-plane/page-role-workflows.jsx", "utf8");
    const components = await readFile("docs/control-plane/components.jsx", "utf8");

    expect(index).toContain("page-role-workflows.jsx");
    expect(index).toContain("RequirementsAssistPage");
    expect(index).toContain("AgentAssignmentPage");
    expect(components).toContain("requirements-assist");
    expect(components).toContain("agent-assignment");
    expect(roleWorkflows).toContain("admin.requirements.assist.create_intake");
    expect(roleWorkflows).toContain("admin.requirements.assist.generate_blueprint");
    expect(roleWorkflows).toContain("admin.requirements.assist.provision_preview");
    expect(roleWorkflows).toContain("admin.lifecycle.jira.execute");
    expect(roleWorkflows).toContain("admin.agent.work.recommend");
    expect(roleWorkflows).toContain("admin.agent.work.assign");
    expect(roleWorkflows).toContain("admin.quality.score.project");
    expect(roleWorkflows).toContain("FileReader");
  });

  it("surfaces role workflow components directly on project pages", async () => {
    const projects = await readFile("docs/control-plane/page-projects.jsx", "utf8");

    expect(projects).toContain("ProjectAssistPanel");
    expect(projects).toContain("ProjectAssistComposer");
    expect(projects).toContain("AgentAssignmentPanel");
    expect(projects).toContain("ContentQualityPanel");
    expect(projects).toContain("admin.requirements.assist.preview");
    expect(projects).toContain("admin.requirements.assist.create_intake");
    expect(projects).toContain("admin.requirements.assist.generate_blueprint");
    expect(projects).toContain("admin.requirements.assist.provision_preview");
    expect(projects).toContain("admin.agent.work.recommend");
    expect(projects).toContain("admin.agent.work.assign");
    expect(projects).toContain("admin.agent.work.list");
    expect(projects).toContain("admin.quality.score.project");
    expect(projects).toContain("FileReader");
    expect(projects).toContain("'assist'");
    expect(projects).toContain("'assignments'");
    expect(projects).toContain("'quality'");
  });

  it("surfaces analyzed agent role descriptions on the agents page", async () => {
    const agentsPage = await readFile("docs/control-plane/page-tier23.jsx", "utf8");
    const model = await readFile("docs/control-plane/control-surface-model.js", "utf8");

    expect(agentsPage).toContain("AgentRoleCatalogPanel");
    expect(agentsPage).toContain("agentRoleCatalog");
    expect(agentsPage).toContain("agent-role-catalog");
    expect(model).toContain("velocity-code-engine");
    expect(model).toContain("velocity-ops-engine");
    expect(model).toContain("planned feature implementation");
    expect(model).toContain("release readiness");
    expect(model).toContain("guardrails-sentinel");
  });

  it("packs uneven two-column card layouts without grid row whitespace", async () => {
    const css = await readFile("docs/control-plane/app.css", "utf8");

    expect(css).toMatch(/\.grid-2\s*\{[\s\S]*align-items:\s*start/);
    expect(css).toMatch(/\.project-overview-grid\s*\{[\s\S]*column-count:\s*2/);
    expect(css).toMatch(/\.project-overview-grid\s*>\s*\*\s*\{[\s\S]*break-inside:\s*avoid/);
    expect(css).toMatch(/\.trace-matrix-panel\s*\{[\s\S]*column-span:\s*all/);
    expect(css).toMatch(/\.assignment-board\s*\{[\s\S]*column-count:\s*2/);
    expect(css).toMatch(/\.agent-role-grid\s*\{[\s\S]*column-count:\s*3/);
    expect(css).toMatch(/@media\s*\(max-width:\s*1180px\)[\s\S]*\.agent-role-grid\s*\{[\s\S]*column-count:\s*2/);
    expect(css).toMatch(/@media\s*\(max-width:\s*760px\)[\s\S]*\.project-overview-grid[\s\S]*column-count:\s*1/);
  });
});
