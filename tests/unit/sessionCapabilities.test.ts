import { describe, expect, it } from "vitest";
import {
  SessionRegistry,
  buildSessionProfile,
} from "../../src/mcp/sessionCapabilities.js";

describe("SessionRegistry", () => {
  it("registers + retrieves + removes profiles", () => {
    const reg = new SessionRegistry();
    expect(reg.size()).toBe(0);
    const profile = buildSessionProfile({
      sessionId: "s-1",
      negotiatedProtocolVersion: "2025-11-25",
      clientInfo: { name: "test", version: "0.0.0" },
      clientCapabilities: { sampling: {}, elicitation: {} },
      serverCapabilities: { tools: {}, resources: { subscribe: true, listChanged: true } },
    });
    reg.register(profile);
    expect(reg.size()).toBe(1);
    expect(reg.get("s-1")?.sessionId).toBe("s-1");
    reg.remove("s-1");
    expect(reg.size()).toBe(0);
    expect(reg.get("s-1")).toBeUndefined();
  });

  it("list() returns all registered profiles", () => {
    const reg = new SessionRegistry();
    for (let i = 0; i < 3; i++) {
      reg.register(
        buildSessionProfile({
          sessionId: `s-${i}`,
          negotiatedProtocolVersion: "2025-11-25",
          clientInfo: undefined,
          clientCapabilities: {},
          serverCapabilities: { tools: {} },
        }),
      );
    }
    expect(reg.list()).toHaveLength(3);
  });
});

describe("buildSessionProfile (v6 §2 capability gating)", () => {
  it("enables sampling when client advertises it", () => {
    const profile = buildSessionProfile({
      sessionId: "s",
      negotiatedProtocolVersion: "2025-11-25",
      clientInfo: undefined,
      clientCapabilities: { sampling: {} },
      serverCapabilities: { tools: {} },
    });
    expect(profile.featuresEnabled).toContain("sampling");
    expect(profile.featuresDisabled.find((f) => f.feature === "sampling")).toBeUndefined();
  });

  it("disables sampling with reason when client lacks it", () => {
    const profile = buildSessionProfile({
      sessionId: "s",
      negotiatedProtocolVersion: "2025-11-25",
      clientInfo: undefined,
      clientCapabilities: {},
      serverCapabilities: { tools: {} },
    });
    expect(profile.featuresEnabled).not.toContain("sampling");
    const disabled = profile.featuresDisabled.find((f) => f.feature === "sampling");
    expect(disabled).toBeDefined();
    expect(disabled?.reason).toMatch(/did not advertise/);
  });

  it("enables resources.subscribe only when server declares AND client has roots", () => {
    const both = buildSessionProfile({
      sessionId: "s",
      negotiatedProtocolVersion: "2025-11-25",
      clientInfo: undefined,
      clientCapabilities: { roots: {} },
      serverCapabilities: { resources: { subscribe: true, listChanged: true } },
    });
    expect(both.featuresEnabled).toContain("resources.subscribe");

    const serverOnly = buildSessionProfile({
      sessionId: "s",
      negotiatedProtocolVersion: "2025-11-25",
      clientInfo: undefined,
      clientCapabilities: {},
      serverCapabilities: { resources: { subscribe: true, listChanged: true } },
    });
    expect(serverOnly.featuresEnabled).not.toContain("resources.subscribe");

    const neither = buildSessionProfile({
      sessionId: "s",
      negotiatedProtocolVersion: "2025-11-25",
      clientInfo: undefined,
      clientCapabilities: {},
      serverCapabilities: { tools: {} },
    });
    expect(neither.featuresEnabled).not.toContain("resources.subscribe");
    expect(neither.featuresDisabled.find((f) => f.feature === "resources.subscribe")).toBeDefined();
  });

  it("captures negotiatedAt as an ISO timestamp", () => {
    const profile = buildSessionProfile({
      sessionId: "s",
      negotiatedProtocolVersion: "2025-11-25",
      clientInfo: undefined,
      clientCapabilities: {},
      serverCapabilities: { tools: {} },
    });
    expect(() => new Date(profile.negotiatedAt).toISOString()).not.toThrow();
  });
});
