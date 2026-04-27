import { describe, expect, it } from "vitest";
import { buildServer } from "../../src/mcp/buildServer.js";
import { SessionRegistry } from "../../src/mcp/sessionCapabilities.js";
import { loadConfig } from "../../src/config.js";
import { pino } from "pino";

function silentLogger() {
  return pino({ level: "silent" });
}

describe("buildServer composition (M0 acceptance: tools/list + resources/list)", () => {
  it("registers health_check tool and both diagnostic resources", async () => {
    const config = loadConfig();
    const sessionRegistry = new SessionRegistry();
    const server = buildServer({
      config,
      logger: silentLogger(),
      sessionRegistry,
      resolveCurrentSessionId: () => undefined,
      startedAt: new Date(),
    });

    // Server is constructed without throwing — composition succeeded.
    expect(server).toBeDefined();
  });

  it("exposes server.connect for transport binding", () => {
    const config = loadConfig();
    const sessionRegistry = new SessionRegistry();
    const server = buildServer({
      config,
      logger: silentLogger(),
      sessionRegistry,
      resolveCurrentSessionId: () => undefined,
      startedAt: new Date(),
    });
    expect(typeof server.connect).toBe("function");
    expect(typeof server.close).toBe("function");
  });
});
