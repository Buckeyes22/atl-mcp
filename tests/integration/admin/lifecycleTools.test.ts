// Integration test for the lifecycle admin tools (M5 preview, M6a/b/c
// preview + execute, M9 handoff bundle). Exercises the tools via the
// loopback /mcp transport with a minimal blueprint seeded directly into
// the test DB. Provider-backed executes return dataLimited (no real
// Confluence/Jira/VCS configured in the fixture) — the assertion is that
// the tool round-trips cleanly and emits an audit entry.

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

async function rpc(fx: AdminTestFixture, sid: string, body: unknown): Promise<JsonRpcResult> {
  const res = await fetch(`${fx.baseUrl}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "mcp-session-id": sid,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
  return JSON.parse(dataLine ? dataLine.slice(5).trim() : text) as JsonRpcResult;
}

async function openSession(fx: AdminTestFixture): Promise<string> {
  const init = await fetch(`${fx.baseUrl}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "lifecycle-test", version: "0.0.1" } },
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

async function seedBlueprint(fx: AdminTestFixture, key: string, name: string): Promise<string> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const blueprint = {
    ...emptyBlueprint({ id, tenantId: "default", name, key }, now),
    state: "BLUEPRINT_READY" as const,
    epics: [
      {
        id: "EPIC-1",
        title: "Foundation",
        outcome: "Set up core infrastructure",
        stories: [
          {
            id: "STORY-1",
            title: "Initialize repo",
            userStory: "As an operator I want a repo seeded with conventions.",
            acceptanceCriteria: ["repo exists", "CONTEXT.md present"],
            implementationNotes: [],
            testNotes: [],
            contextRefs: [],
            dependencies: [],
            estimatedComplexity: "S" as const,
          },
        ],
        confluenceRefs: [],
        dependencies: [],
      },
    ],
  };
  await fx.repositories.project.create(defaultTenantScope(), blueprint);
  return key;
}

describe("admin lifecycle tools (M5 + M6a/b/c + M9)", () => {
  let fx: AdminTestFixture;
  let sid: string;

  beforeEach(async () => {
    fx = await buildAdminFixture();
    sid = await openSession(fx);
  });

  afterEach(async () => {
    await fx.stop();
  });

  it("admin.lifecycle.jira.preview lists planned epics + stories", async () => {
    await seedBlueprint(fx, "LCT", "Lifecycle Test Project");
    const r = await rpc(fx, sid, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "admin.lifecycle.jira.preview", arguments: { projectKey: "LCT" } } });
    const sc = r.result?.structuredContent as { plannedNodes: Array<{ kind: string; title: string }>; totalNodes: number };
    expect(sc.totalNodes).toBe(2);
    expect(sc.plannedNodes.map((n) => n.kind).sort()).toEqual(["epic", "story"]);
  });

  it("admin.lifecycle.jira.execute reports dataLimited when Jira isn't configured", async () => {
    await seedBlueprint(fx, "LCT2", "Test 2");
    const r = await rpc(fx, sid, {
      jsonrpc: "2.0", id: 3, method: "tools/call",
      params: { name: "admin.lifecycle.jira.execute", arguments: { projectKey: "LCT2", jiraProjectKey: "LCT2", reason: "test execute without jira" } },
    });
    const sc = r.result?.structuredContent as { ok: boolean; dataLimited?: { reason: string }; auditEntryId: string };
    expect(sc.ok).toBe(false);
    expect(sc.dataLimited?.reason).toMatch(/jira/i);
    expect(sc.auditEntryId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("admin.lifecycle.confluence.preview renders the default page tree with substitutions", async () => {
    await seedBlueprint(fx, "LCT3", "Confluence Preview");
    const r = await rpc(fx, sid, { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "admin.lifecycle.confluence.preview", arguments: { projectKey: "LCT3" } } });
    const sc = r.result?.structuredContent as { totalPages: number; pages: Array<{ templateSlug: string; title: string; substitutionsMade: number }> };
    expect(sc.totalPages).toBeGreaterThan(0);
    // At least the project-brief page should have made some substitutions for project_name.
    const charter = sc.pages.find((p) => p.templateSlug === "project-brief");
    expect(charter).toBeDefined();
    expect(charter?.title).toBe("Confluence Preview — Charter");
    expect(charter?.substitutionsMade).toBeGreaterThan(0);
  });

  it("admin.lifecycle.confluence.execute reports dataLimited when Confluence isn't configured", async () => {
    await seedBlueprint(fx, "LCT4", "No Conf");
    const r = await rpc(fx, sid, {
      jsonrpc: "2.0", id: 5, method: "tools/call",
      params: { name: "admin.lifecycle.confluence.execute", arguments: { projectKey: "LCT4", spaceId: "LCT4-SPACE", reason: "test execute without confluence" } },
    });
    const sc = r.result?.structuredContent as { ok: boolean; dataLimited?: { reason: string }; auditEntryId: string };
    expect(sc.ok).toBe(false);
    expect(sc.dataLimited?.reason).toMatch(/confluence/i);
    expect(sc.auditEntryId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("admin.lifecycle.vcs.preview renders the default scaffold file set", async () => {
    await seedBlueprint(fx, "LCT5", "VCS Preview");
    const r = await rpc(fx, sid, {
      jsonrpc: "2.0", id: 6, method: "tools/call",
      params: { name: "admin.lifecycle.vcs.preview", arguments: { projectKey: "LCT5", workspace: "ws", repoSlug: "lct5" } },
    });
    const sc = r.result?.structuredContent as { totalFiles: number; files: Array<{ path: string }>; totalBytes: number };
    expect(sc.totalFiles).toBeGreaterThan(5);
    const paths = sc.files.map((f) => f.path);
    expect(paths).toContain("CONTEXT.md");
    expect(paths).toContain("AGENTS.md");
    expect(paths).toContain("CLAUDE.md");
    expect(sc.totalBytes).toBeGreaterThan(1000);
  });

  it("admin.lifecycle.vcs.preview with stackChoices inflates CLAUDE.md by appending stack sections", async () => {
    await seedBlueprint(fx, "LCT5B", "VCS Preview Stack");
    const baseline = await rpc(fx, sid, {
      jsonrpc: "2.0", id: 65, method: "tools/call",
      params: { name: "admin.lifecycle.vcs.preview", arguments: { projectKey: "LCT5B", workspace: "ws", repoSlug: "lct5b" } },
    });
    const baselineSc = baseline.result?.structuredContent as { files: Array<{ path: string; bytes: number }> };
    const baselineClaude = baselineSc.files.find((f) => f.path === "CLAUDE.md");
    expect(baselineClaude).toBeDefined();

    const withStacks = await rpc(fx, sid, {
      jsonrpc: "2.0", id: 66, method: "tools/call",
      params: {
        name: "admin.lifecycle.vcs.preview",
        arguments: { projectKey: "LCT5B", workspace: "ws", repoSlug: "lct5b", stackChoices: ["nextjs-15", "drizzle-orm"] },
      },
    });
    const withStacksSc = withStacks.result?.structuredContent as { files: Array<{ path: string; bytes: number }> };
    const withStacksClaude = withStacksSc.files.find((f) => f.path === "CLAUDE.md");
    expect(withStacksClaude).toBeDefined();
    // Two appended stack module sections should add several KB of prose.
    expect(withStacksClaude!.bytes).toBeGreaterThan(baselineClaude!.bytes + 2000);
  });

  it("admin.lifecycle.vcs.preview rejects unknown stackChoices before reading content", async () => {
    await seedBlueprint(fx, "LCT5C", "VCS Preview Bad Stack");
    const r = await rpc(fx, sid, {
      jsonrpc: "2.0", id: 67, method: "tools/call",
      params: { name: "admin.lifecycle.vcs.preview", arguments: { projectKey: "LCT5C", workspace: "ws", repoSlug: "lct5c", stackChoices: ["../secrets"] } },
    });
    expect(r.error?.message).toMatch(/unknown module slug/i);
  });

  it("admin.lifecycle.vcs.execute reports dataLimited when VCS provider isn't configured", async () => {
    await seedBlueprint(fx, "LCT6", "No VCS");
    const r = await rpc(fx, sid, {
      jsonrpc: "2.0", id: 7, method: "tools/call",
      params: { name: "admin.lifecycle.vcs.execute", arguments: { projectKey: "LCT6", workspace: "ws", repoSlug: "lct6", reason: "test execute without vcs" } },
    });
    const sc = r.result?.structuredContent as { ok: boolean; dataLimited?: { reason: string }; auditEntryId: string };
    expect(sc.ok).toBe(false);
    expect(sc.dataLimited?.reason).toMatch(/vcs|bitbucket/i);
    expect(sc.auditEntryId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("admin.lifecycle.handoff.bundle composes a packet with the audit-chain head", async () => {
    await seedBlueprint(fx, "LCT7", "Handoff Test");
    const r = await rpc(fx, sid, {
      jsonrpc: "2.0", id: 8, method: "tools/call",
      params: { name: "admin.lifecycle.handoff.bundle", arguments: { projectKey: "LCT7", reason: "compose handoff bundle for test" } },
    });
    const sc = r.result?.structuredContent as { ok: boolean; bundleId: string; packet: { project: { key: string; name: string }; auditChainHead: { signingKeyId: string }; rolesIncluded: string[] } };
    expect(sc.ok).toBe(true);
    expect(sc.packet.project.key).toBe("LCT7");
    expect(sc.packet.project.name).toBe("Handoff Test");
    expect(sc.packet.auditChainHead.signingKeyId).toMatch(/^[0-9a-f]+$/);
    expect(sc.packet.rolesIncluded).toContain("architect");
  });

  it("admin.lifecycle.handoff.bundle carries explicit provisioned artifact references", async () => {
    await seedBlueprint(fx, "LCT7B", "Handoff Artifact Test");
    const r = await rpc(fx, sid, {
      jsonrpc: "2.0", id: 81, method: "tools/call",
      params: {
        name: "admin.lifecycle.handoff.bundle",
        arguments: {
          projectKey: "LCT7B",
          jiraProjectKey: "JIRA7",
          confluenceSpaceId: "SPACE7",
          repoUrl: "https://bitbucket.org/ws/lct7b",
          reason: "compose handoff bundle with artifacts",
        },
      },
    });
    const sc = r.result?.structuredContent as { packet: { artifacts: { jiraProjectKey: string | null; confluenceSpaceId: string | null; repoUrl: string | null } } };
    expect(sc.packet.artifacts).toEqual({
      jiraProjectKey: "JIRA7",
      confluenceSpaceId: "SPACE7",
      repoUrl: "https://bitbucket.org/ws/lct7b",
    });
  });

  it("admin.velocity.manifest.get exposes all five content categories", async () => {
    const r = await rpc(fx, sid, { jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "admin.velocity.manifest.get", arguments: {} } });
    const sc = r.result?.structuredContent as { totalEntries: number; phases: string[]; templates: string[]; agents: string[]; workflows: string[]; modules: string[] };
    expect(sc.totalEntries).toBe(sc.phases.length + sc.templates.length + sc.agents.length + sc.workflows.length + sc.modules.length);
    expect(sc.phases.length).toBeGreaterThan(0);
    expect(sc.templates.length).toBeGreaterThan(0);
    expect(sc.agents).toContain("architect");
    expect(sc.workflows).toContain("multi-agent-flow");
    expect(sc.modules).toContain("nextjs-15");
  });

  it("admin.velocity.content.read returns a known template body", async () => {
    const r = await rpc(fx, sid, { jsonrpc: "2.0", id: 10, method: "tools/call", params: { name: "admin.velocity.content.read", arguments: { category: "template", slug: "project-brief" } } });
    const sc = r.result?.structuredContent as { content: string; bytes: number };
    expect(sc.content.length).toBeGreaterThan(100);
    expect(sc.bytes).toBe(Buffer.byteLength(sc.content, "utf8"));
    expect(sc.content).toMatch(/Project Brief/i);
  });
});
