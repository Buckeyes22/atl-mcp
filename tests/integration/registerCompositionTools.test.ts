// F-001 closure: when MILESTONE_N_ENABLED flags are off (default), only the
// production-quality M0–M3 tools are registered. M4–M11 stubs do NOT leak into
// the live tool registry under v6 spec names.

import { describe, expect, it, vi } from "vitest";
import { pino } from "pino";
import { Server as McpServer } from "@modelcontextprotocol/sdk/server/index.js";
import { registerCompositionTools } from "../../src/mcp/registerCompositionTools.js";
import { createToolRegistry } from "../../src/mcp/toolRegistry.js";
import { SessionRegistry } from "../../src/mcp/sessionCapabilities.js";
import type { CompositionRoot } from "../../src/compositionRoot.js";
import type { OrchestratorConfig, MilestoneFlags } from "../../src/config.js";
import { createAuditSigner } from "../../src/security/auditChain.js";
import { createDisabledAgentMemoryVectorIndex } from "../../src/workflows/agentMemoryVectorIndex.js";

function silentLogger() {
  return pino({ level: "silent" });
}

function fakeRoot(overrides: Partial<MilestoneFlags> = {}): CompositionRoot {
  const flags: MilestoneFlags = {
    milestone4Enabled: false,
    milestone5Enabled: false,
    milestone6aEnabled: false,
    milestone6bEnabled: false,
    milestone6cEnabled: false,
    milestone7Enabled: false,
    milestone8Enabled: false,
    milestone9Enabled: false,
    milestone10Enabled: false,
    milestone11Enabled: false,
    persistentAgentMemoryEnabled: false,
    agentMemoryVectorEnabled: false,
    ...overrides,
  };
  const config: OrchestratorConfig = {
    transport: "stdio",
    http: { port: 3000, host: "0.0.0.0", sessionTtlSeconds: 3600, sseKeepAliveMs: 25_000, maxConcurrentSessions: 1000 },
    mgmt: { port: 3001, host: "127.0.0.1" },
    logging: { level: "silent" as never, filePath: "./orchestrator.log" },
    deployment: { nodeEnv: "test", tier: "test" },
    serverInfo: { name: "atl-mcp-orchestrator", version: "0.1.0" },
    flags,
  };
  return {
    config,
    logger: silentLogger(),
    db: { db: {} as never, async migrate() {}, async close() {} } as never,
    repositories: {
      project: {} as never,
      projectProfile: { async findLatestForProject() { return undefined; }, async insert() {} } as never,
      traceLink: {} as never,
      readiness: {} as never,
      contextPack: {} as never,
      audit: {} as never,
      acl: {} as never,
      mcpSessionProfile: {} as never,
      policyDecision: {} as never,
      provisionJob: {} as never,
      webhookDelivery: {} as never,
      encryptedToken: {} as never,
    } as never,
    encryption: {} as never,
    tokenStore: {} as never,
    providers: { jira: undefined, confluence: undefined, vcs: undefined, uio: { enabled: false } as never },
    worktrees: undefined,
    auth: { atlassian: undefined },
    auditSigner: createAuditSigner(),
    provisionQueue: undefined,
    webhookSecrets: {},
    agentMemoryVectorIndex: createDisabledAgentMemoryVectorIndex("test"),
    async close() {},
  };
}

describe("registerCompositionTools — F-001 flag-gating", () => {
  it("with all milestone flags off: registers only preflight tools (M2 production-quality)", () => {
    const registry = createToolRegistry();
    const server = new McpServer({ name: "test", version: "0.0.0" }, { capabilities: { tools: {} } });
    const root = fakeRoot();
    const sessionRegistry = new SessionRegistry();

    registerCompositionTools({
      registry,
      server,
      root,
      sessionRegistry,
      resolveCurrentSessionId: () => undefined,
    });

    const names = registry.list().map((t) => t.name).sort();
    expect(names).toEqual(["project_preflight_check", "project_profile_get"]);
  });

  it("with MILESTONE_4_ENABLED on: adds intake + blueprint tools", () => {
    const registry = createToolRegistry();
    const server = new McpServer({ name: "test", version: "0.0.0" }, { capabilities: { tools: {} } });
    const root = fakeRoot({ milestone4Enabled: true });
    const sessionRegistry = new SessionRegistry();

    registerCompositionTools({
      registry,
      server,
      root,
      sessionRegistry,
      resolveCurrentSessionId: () => undefined,
    });

    const names = registry.list().map((t) => t.name);
    expect(names).toContain("project_intake_create");
    expect(names).toContain("project_blueprint_generate");
    expect(names).toContain("project_blueprint_update");
    expect(names).not.toContain("project_provision_preview");
    expect(names).not.toContain("project_provision_execute");
  });

  it("with MILESTONE_5_ENABLED on, MILESTONE_6A_ENABLED off: only preview registers, not execute", () => {
    const registry = createToolRegistry();
    const server = new McpServer({ name: "test", version: "0.0.0" }, { capabilities: { tools: {} } });
    const root = fakeRoot({ milestone5Enabled: true });
    const sessionRegistry = new SessionRegistry();

    registerCompositionTools({
      registry,
      server,
      root,
      sessionRegistry,
      resolveCurrentSessionId: () => undefined,
    });

    const names = registry.list().map((t) => t.name);
    expect(names).toContain("project_provision_preview");
    expect(names).not.toContain("project_provision_execute");
  });

  it("with MILESTONE_7-10 on independently: only the matching tool registers", () => {
    const registry = createToolRegistry();
    const server = new McpServer({ name: "test", version: "0.0.0" }, { capabilities: { tools: {} } });
    const root = fakeRoot({ milestone8Enabled: true });
    const sessionRegistry = new SessionRegistry();

    registerCompositionTools({
      registry,
      server,
      root,
      sessionRegistry,
      resolveCurrentSessionId: () => undefined,
    });

    const names = registry.list().map((t) => t.name);
    expect(names).toContain("readiness_validate");
    expect(names).not.toContain("context_pack_generate");
    expect(names).not.toContain("handoff_generate");
    expect(names).not.toContain("webhook_ingest");
  });

  it("with persistent agent memory on: registers memory tools without enabling M7 context tools", () => {
    const registry = createToolRegistry();
    const server = new McpServer({ name: "test", version: "0.0.0" }, { capabilities: { tools: {} } });
    const root = fakeRoot({ persistentAgentMemoryEnabled: true });
    const sessionRegistry = new SessionRegistry();

    registerCompositionTools({
      registry,
      server,
      root,
      sessionRegistry,
      resolveCurrentSessionId: () => undefined,
    });

    const names = registry.list().map((t) => t.name);
    expect(names).toContain("memory_retain");
    expect(names).toContain("memory_recall");
    expect(names).toContain("memory_reflect");
    expect(names).toContain("memory_forget");
    expect(names).not.toContain("context_pack_generate");
  });
});
