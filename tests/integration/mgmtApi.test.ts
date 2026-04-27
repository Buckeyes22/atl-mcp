import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pino } from "pino";
import { createMgmtApiRunner } from "../../src/server/mgmtApi.js";
import { SessionRegistry } from "../../src/mcp/sessionCapabilities.js";
import { loadConfig } from "../../src/config.js";

function silentLogger() {
  return pino({ level: "silent" });
}

describe("mgmt API (open-edison F-130 dual-port pattern)", () => {
  let runner: Awaited<ReturnType<typeof createMgmtApiRunner>>;

  beforeEach(() => {
    // Use a high random port to avoid collisions in CI.
    process.env["MGMT_API_PORT"] = String(40000 + Math.floor(Math.random() * 1000));
    process.env["MGMT_API_HOST"] = "127.0.0.1";
    runner = createMgmtApiRunner({
      config: loadConfig(),
      logger: silentLogger(),
      sessionRegistry: new SessionRegistry(),
      startedAt: new Date(),
    });
  });

  afterEach(async () => {
    await runner.stop();
  });

  it("/healthz returns 200 with status ok via Hono app.fetch", async () => {
    const res = await runner.app.fetch(new Request("http://localhost/healthz"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; service: string };
    expect(body.status).toBe("ok");
    expect(body.service).toBeTruthy();
  });

  it("/readyz returns ready", async () => {
    const res = await runner.app.fetch(new Request("http://localhost/readyz"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ready");
  });

  it("serves /health/live and /health/ready aliases for orchestrator probes", async () => {
    const live = await runner.app.fetch(new Request("http://localhost/health/live"));
    const ready = await runner.app.fetch(new Request("http://localhost/health/ready"));

    expect(live.status).toBe(200);
    expect(ready.status).toBe(200);
    await expect(live.json()).resolves.toMatchObject({ status: "ok" });
    await expect(ready.json()).resolves.toMatchObject({ status: "ready" });
  });

  it("/metrics returns Prometheus exposition with required gauges", async () => {
    const res = await runner.app.fetch(new Request("http://localhost/metrics"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    const body = await res.text();
    expect(body).toContain("orchestrator_up");
    expect(body).toContain("orchestrator_uptime_seconds");
    expect(body).toContain("orchestrator_sessions_active");
  });
});
