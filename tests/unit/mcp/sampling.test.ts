import { describe, expect, it } from "vitest";
import { createHostDelegatedSamplingAdapter } from "../../../src/mcp/sampling.js";
import { buildSessionProfile, SessionRegistry } from "../../../src/mcp/sessionCapabilities.js";

describe("createHostDelegatedSamplingAdapter", () => {
  it("does not call sampling when the current session did not advertise it", async () => {
    const sessions = new SessionRegistry();
    sessions.register(
      buildSessionProfile({
        sessionId: "s1",
        negotiatedProtocolVersion: "2025-11-25",
        clientInfo: undefined,
        clientCapabilities: {},
        serverCapabilities: { tools: {} },
      }),
    );
    const adapter = createHostDelegatedSamplingAdapter({
      sessionRegistry: sessions,
      resolveCurrentSessionId: () => "s1",
      createMessage: async () => {
        throw new Error("not expected");
      },
    });

    const result = await adapter.sample({
      prompt: "Generate a blueprint",
      maxTokens: 256,
      temperature: 0,
      trace: { projectId: "proj-1", promptVersion: "blueprint-generation.v1" },
    });

    expect(result.used).toBe(false);
    expect(result.reason).toBe("client did not advertise sampling capability");
  });

  it("delegates to sampling/createMessage when sampling is enabled", async () => {
    const sessions = new SessionRegistry();
    sessions.register(
      buildSessionProfile({
        sessionId: "s2",
        negotiatedProtocolVersion: "2025-11-25",
        clientInfo: undefined,
        clientCapabilities: { sampling: {} },
        serverCapabilities: { tools: {} },
      }),
    );
    const adapter = createHostDelegatedSamplingAdapter({
      sessionRegistry: sessions,
      resolveCurrentSessionId: () => "s2",
      createMessage: async (params) => {
        expect(params.temperature).toBe(0);
        return {
          role: "assistant",
          model: "host-model",
          stopReason: "endTurn",
          content: { type: "text", text: "{\"ok\":true}" },
        };
      },
    });

    const result = await adapter.sample({
      prompt: "Generate a blueprint",
      maxTokens: 256,
      temperature: 0,
      trace: { projectId: "proj-1", promptVersion: "blueprint-generation.v1" },
    });

    expect(result).toEqual({
      used: true,
      provider: "mcp_host",
      model: "host-model",
      text: "{\"ok\":true}",
    });
  });
});
