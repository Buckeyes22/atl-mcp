// Phase 1 integration test (ADR 0006): the mgmt API mounts an admin /mcp
// transport and serves the operator control plane UI from /ui/.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildAdminFixture, type AdminTestFixture } from "./_adminFixture.js";

describe("admin MCP transport + UI host (ADR 0006)", () => {
  let fx: AdminTestFixture;

  beforeEach(async () => {
    fx = await buildAdminFixture();
  });

  afterEach(async () => {
    await fx.stop();
  });

  it("/ui/ serves the operator control plane index.html", async () => {
    const res = await fx.app.fetch(new Request("http://localhost/ui/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("atl-mcp · operator control plane");
  });

  it("/ui (no trailing slash) redirects to /ui/", async () => {
    const res = await fx.app.fetch(new Request("http://localhost/ui"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/ui/");
  });

  it("management root redirects to the operator control plane", async () => {
    const res = await fx.app.fetch(new Request("http://localhost/"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/ui/");
  });

  it("/ui/<asset> serves bundled JSX/CSS files with correct MIME", async () => {
    const css = await fx.app.fetch(new Request("http://localhost/ui/app.css"));
    expect(css.status).toBe(200);
    expect(css.headers.get("content-type")).toContain("text/css");

    const jsx = await fx.app.fetch(new Request("http://localhost/ui/components.jsx"));
    expect(jsx.status).toBe(200);
    expect(jsx.headers.get("content-type")).toContain("text/babel");
  });

  it("/ui/ rejects path traversal attempts", async () => {
    const res = await fx.app.fetch(new Request("http://localhost/ui/../package.json"));
    expect(res.status).toBe(404);
  });

  it("/mcp accepts a JSON-RPC initialize and returns a session id", async () => {
    const res = await fetch(`${fx.baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "admin-fixture-test", version: "0.0.1" },
        },
      }),
    });
    expect([200, 202]).toContain(res.status);
    expect(res.headers.get("mcp-session-id")).toBeTruthy();
  });

  it("/mcp allows loopback browser preview origins to preflight admin MCP", async () => {
    const res = await fetch(`${fx.baseUrl}/mcp`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:4173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,mcp-session-id",
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:4173");
    expect(res.headers.get("access-control-allow-headers")).toContain("mcp-session-id");
    expect(res.headers.get("access-control-expose-headers")).toContain("mcp-session-id");
  });

  it("/mcp includes loopback CORS headers on admin MCP POST responses", async () => {
    const res = await fetch(`${fx.baseUrl}/mcp`, {
      method: "POST",
      headers: {
        Origin: "http://127.0.0.1:4173",
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 10,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "admin-fixture-test", version: "0.0.1" },
        },
      }),
    });

    expect([200, 202]).toContain(res.status);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:4173");
    expect(res.headers.get("access-control-expose-headers")).toContain("mcp-session-id");
    expect(res.headers.get("mcp-session-id")).toBeTruthy();
  });

  it("/mcp rejects stale session ids instead of creating an implicit replacement", async () => {
    const res = await fetch(`${fx.baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "mcp-session-id": "missing-session",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
      }),
    });
    expect(res.status).toBe(404);
  });

  it("/mcp does not double-write Hono responses", async () => {
    const stderr: string[] = [];
    const originalWrite = process.stderr.write;
    process.stderr.write = ((chunk: string | Uint8Array, ...args: unknown[]) => {
      stderr.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      return originalWrite.call(process.stderr, chunk as never, ...(args as never[]));
    }) as typeof process.stderr.write;
    try {
      const init = await fetch(`${fx.baseUrl}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "admin-fixture-test", version: "0.0.1" },
          },
        }),
      });
      const sid = init.headers.get("mcp-session-id");
      expect(sid).toBeTruthy();
      await init.text();

      const list = await fetch(`${fx.baseUrl}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "mcp-session-id": sid! },
        body: JSON.stringify({ jsonrpc: "2.0", id: 4, method: "tools/list" }),
      });
      expect([200, 202]).toContain(list.status);
      await list.text();
      await new Promise((resolve) => setTimeout(resolve, 25));
    } finally {
      process.stderr.write = originalWrite;
    }
    expect(stderr.join("")).not.toContain("ERR_HTTP_HEADERS_SENT");
  });
});
