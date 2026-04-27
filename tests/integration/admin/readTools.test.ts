// Phase 2 integration test (ADR 0006): every read-only admin tool round-trips
// through a loopback /mcp call and returns a typed structuredContent payload.
//
// We initialize one MCP session, send the initialized notification, then
// call tools/list and tools/call for each of the 12 read tools in Phase 2.
// The DB is empty (fresh test fixture) so the tools exercise their
// "no-rows" branches; that's the meaningful first assertion.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildAdminFixture, type AdminTestFixture } from "./_adminFixture.js";

interface JsonRpcResult {
  jsonrpc: "2.0";
  id: number;
  result?: { tools?: Array<{ name: string }>; structuredContent?: unknown; content?: unknown };
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
  // Streamable transport may answer with SSE-framed JSON; pull out the data: line.
  const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
  const json = dataLine ? dataLine.slice(5).trim() : text;
  return JSON.parse(json) as JsonRpcResult;
}

async function openSession(fx: AdminTestFixture): Promise<string> {
  const init = await fetch(`${fx.baseUrl}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "phase2-test", version: "0.0.1" },
      },
    }),
  });
  const sid = init.headers.get("mcp-session-id");
  if (!sid) throw new Error("no session id from initialize");
  // Drain body to release the response.
  await init.text().catch(() => {});
  // Send initialized notification (no id, no response).
  await fetch(`${fx.baseUrl}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "mcp-session-id": sid },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  });
  return sid;
}

describe("admin read tools (Phase 2 — ADR 0006)", () => {
  let fx: AdminTestFixture;
  let sid: string;

  beforeEach(async () => {
    fx = await buildAdminFixture();
    sid = await openSession(fx);
  });

  afterEach(async () => {
    await fx.stop();
  });

  it("tools/list includes every Phase 2 read-only admin tool", async () => {
    const r = await rpc(fx, sid, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    expect(r.error).toBeUndefined();
    const names = new Set((r.result?.tools ?? []).map((t) => t.name));
    for (const expected of [
      "admin.audit.head",
      "admin.audit.list",
      "admin.config.env.get",
      "admin.config.flags.list",
      "admin.health.get",
      "admin.jobs.list",
      "admin.migrations.list",
      "admin.policy.decisions.list",
      "admin.projects.get",
      "admin.projects.list",
      "admin.providers.list",
      "admin.secrets.list",
      "admin.sessions.list",
    ]) {
      expect(names.has(expected), `missing tool ${expected}`).toBe(true);
    }
  });

  it("admin.health.get returns components with real DB + transport status", async () => {
    const r = await rpc(fx, sid, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "admin.health.get", arguments: {} } });
    expect(r.error).toBeUndefined();
    const sc = r.result?.structuredContent as { components: Record<string, { status: string; label: string }> } | undefined;
    expect(sc?.components.db.status).toBe("green");
    expect(sc?.components.jira.status).toBe("grey");
    expect(sc?.components.confluence.status).toBe("grey");
    expect(sc?.components.vcs.status).toBe("grey");
    expect(sc?.components.context.label).toBe("Qdrant / context");
    expect(sc?.components.queue.label).toBe("Queue");
    expect(sc?.components.atlassian.status).toBe("grey");
    expect(sc?.components.bitbucket.status).toBe("grey");
    expect(sc?.components.transport.status).toBe("green");
    expect(sc?.components.webhooks.label).toBe("Webhooks");
  });

  it("admin.projects.list returns an empty array against a fresh DB", async () => {
    const r = await rpc(fx, sid, { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "admin.projects.list", arguments: {} } });
    const sc = r.result?.structuredContent as { projects: unknown[] };
    expect(sc.projects).toEqual([]);
  });

  it("admin.jobs.list returns an empty array against a fresh DB", async () => {
    const r = await rpc(fx, sid, { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "admin.jobs.list", arguments: {} } });
    const sc = r.result?.structuredContent as { jobs: unknown[] };
    expect(sc.jobs).toEqual([]);
  });

  it("admin.audit.head reports zero-length chain on fresh DB", async () => {
    const r = await rpc(fx, sid, { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "admin.audit.head", arguments: {} } });
    const sc = r.result?.structuredContent as { systemChainLength: number; verification: { ok: boolean } };
    expect(sc.systemChainLength).toBe(0);
    expect(sc.verification.ok).toBe(true);
  });

  it("admin.providers.list reports providers as not-configured", async () => {
    const r = await rpc(fx, sid, { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "admin.providers.list", arguments: {} } });
    const sc = r.result?.structuredContent as { providers: Array<{ id: string; configured: boolean; capability: string; providerType: string }>; dataLimited: { rateLimitHeadroom: string } };
    expect(sc.providers.map((p) => p.id).sort()).toEqual(["bitbucket", "confluence", "jira"]);
    expect(sc.providers.every((p) => p.configured === false)).toBe(true);
    expect(sc.providers.find((p) => p.id === "bitbucket")).toMatchObject({ capability: "vcs", providerType: "bitbucket" });
    expect(sc.dataLimited.rateLimitHeadroom).toContain("not wired");
  });

  it("admin.migrations.list reports the bootstrap migrations as applied", async () => {
    const r = await rpc(fx, sid, { jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "admin.migrations.list", arguments: {} } });
    const sc = r.result?.structuredContent as { migrations: Array<{ version: string; applied: boolean }>; appliedCount: number; pendingCount: number };
    expect(sc.migrations.length).toBeGreaterThan(0);
    expect(sc.appliedCount).toBeGreaterThan(0);
    expect(sc.pendingCount).toBe(0);
  });

  it("admin.secrets.list returns no tokens + the audit signing key id", async () => {
    const r = await rpc(fx, sid, { jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "admin.secrets.list", arguments: {} } });
    const sc = r.result?.structuredContent as { tokens: unknown[]; auditSigningKey: { id: string } };
    expect(sc.tokens).toEqual([]);
    expect(sc.auditSigningKey.id).toMatch(/^[0-9a-f]{16}$/);
  });

  it("admin.config.env.get returns non-sensitive transport + tier config", async () => {
    const r = await rpc(fx, sid, { jsonrpc: "2.0", id: 10, method: "tools/call", params: { name: "admin.config.env.get", arguments: {} } });
    const sc = r.result?.structuredContent as { transport: string; deployment: { tier: string } };
    expect(["stdio", "http", "both"]).toContain(sc.transport);
    expect(["dev", "test", "staging", "production"]).toContain(sc.deployment.tier);
  });

  it("admin.config.flags.list returns one entry per feature flag", async () => {
    const r = await rpc(fx, sid, { jsonrpc: "2.0", id: 11, method: "tools/call", params: { name: "admin.config.flags.list", arguments: {} } });
    const sc = r.result?.structuredContent as { flags: Array<{ name: string; enabled: boolean }> };
    expect(sc.flags.length).toBe(12);
    expect(sc.flags.map((f) => f.name)).toContain("milestone6aEnabled");
    expect(sc.flags.map((f) => f.name)).toContain("persistentAgentMemoryEnabled");
  });

  it("admin.policy.decisions.list returns empty against a fresh DB", async () => {
    const r = await rpc(fx, sid, { jsonrpc: "2.0", id: 12, method: "tools/call", params: { name: "admin.policy.decisions.list", arguments: {} } });
    const sc = r.result?.structuredContent as { decisions: unknown[] };
    expect(sc.decisions).toEqual([]);
  });

  it("admin.sessions.list returns the cap and zero active sessions", async () => {
    const r = await rpc(fx, sid, { jsonrpc: "2.0", id: 13, method: "tools/call", params: { name: "admin.sessions.list", arguments: {} } });
    const sc = r.result?.structuredContent as { sessions: unknown[]; totalActive: number; cap: number };
    expect(sc.sessions).toEqual([]);
    expect(sc.totalActive).toBe(0);
    expect(sc.cap).toBeGreaterThan(0);
  });

  it("admin.audit.list returns an empty array against a fresh DB", async () => {
    const r = await rpc(fx, sid, { jsonrpc: "2.0", id: 14, method: "tools/call", params: { name: "admin.audit.list", arguments: {} } });
    const sc = r.result?.structuredContent as { entries: unknown[] };
    expect(sc.entries).toEqual([]);
  });
});
