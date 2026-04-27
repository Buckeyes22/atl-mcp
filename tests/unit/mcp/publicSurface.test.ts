import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../../../src/config.js";
import {
  CANONICAL_PROMPT_NAMES,
  getCanonicalPrompt,
  listCanonicalPrompts,
} from "../../../src/mcp/registerPrompts.js";
import { PUBLIC_RESOURCE_TEMPLATE_URIS, listPublicResourceTemplates } from "../../../src/mcp/registerResources.js";

const FLAG_NAMES = [
  "MILESTONE_4_ENABLED",
  "MILESTONE_5_ENABLED",
  "MILESTONE_6A_ENABLED",
  "MILESTONE_6B_ENABLED",
  "MILESTONE_6C_ENABLED",
  "MILESTONE_7_ENABLED",
  "MILESTONE_8_ENABLED",
  "MILESTONE_9_ENABLED",
  "MILESTONE_10_ENABLED",
  "MILESTONE_11_ENABLED",
  "PERSISTENT_AGENT_MEMORY_ENABLED",
] as const;

const originalEnv = new Map<string, string | undefined>();

for (const name of FLAG_NAMES) {
  originalEnv.set(name, process.env[name]);
}

afterEach(() => {
  for (const name of FLAG_NAMES) {
    const original = originalEnv.get(name);
    if (original === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = original;
    }
  }
});

describe("public MCP surface", () => {
  it("defaults completed v1 milestone flags on while preserving env rollback overrides", () => {
    for (const name of FLAG_NAMES) delete process.env[name];
    const config = loadConfig();

    expect(config.flags).toMatchObject({
      milestone4Enabled: true,
      milestone5Enabled: true,
      milestone6aEnabled: true,
      milestone6bEnabled: true,
      milestone6cEnabled: true,
      milestone7Enabled: true,
      milestone8Enabled: true,
      milestone9Enabled: true,
      milestone10Enabled: true,
      milestone11Enabled: true,
      persistentAgentMemoryEnabled: true,
    });

    process.env["MILESTONE_10_ENABLED"] = "false";
    expect(loadConfig().flags.milestone10Enabled).toBe(false);
  });

  it("lists the eight canonical v1 prompts with version metadata", () => {
    const prompts = listCanonicalPrompts();

    expect(prompts.map((prompt) => prompt.name)).toEqual([...CANONICAL_PROMPT_NAMES]);
    for (const prompt of prompts) {
      expect(prompt._meta).toMatchObject({ "orchestrator/version": "v1" });
      expect(prompt.description).toBeTruthy();
    }
  });

  it("renders canonical prompts as user messages with supplied variables", () => {
    const prompt = getCanonicalPrompt("project-intake-interview", {
      projectName: "Billing",
      projectId: "BILL",
    });

    expect(prompt.description).toContain("intake");
    expect(prompt.messages).toHaveLength(1);
    expect(prompt.messages[0]?.role).toBe("user");
    expect(prompt.messages[0]?.content.type).toBe("text");
    if (prompt.messages[0]?.content.type === "text") {
      expect(prompt.messages[0].content.text).toContain("Billing");
      expect(prompt.messages[0].content.text).toContain("BILL");
    }
  });

  it("publishes project, issue, and job resource templates", () => {
    const templates = listPublicResourceTemplates();

    expect(templates.map((template) => template.uriTemplate)).toEqual(PUBLIC_RESOURCE_TEMPLATE_URIS);
    expect(PUBLIC_RESOURCE_TEMPLATE_URIS).toContain("orchestrator://project/{projectId}/context");
    expect(PUBLIC_RESOURCE_TEMPLATE_URIS).toContain("orchestrator://issue/{issueKey}/handoff");
    expect(PUBLIC_RESOURCE_TEMPLATE_URIS).toContain("orchestrator://job/{jobId}");
  });
});
