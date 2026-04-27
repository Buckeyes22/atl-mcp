// Phase 3 integration test (ADR 0006): every write tool round-trips
// through /mcp, performs the side-effect, and appends a signed audit entry.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { buildAdminFixture, type AdminTestFixture } from "./_adminFixture.js";
import { defaultTenantScope } from "../../../src/domain/tenantScope.js";
import type { ProjectBlueprint } from "../../../src/domain/projectBlueprint.js";
import type { PolicyDecision } from "../../../src/domain/policyDecision.js";

interface JsonRpcResult {
  jsonrpc: "2.0";
  id: number;
  result?: { content?: unknown; structuredContent?: unknown };
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
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "phase3-test", version: "0.0.1" } },
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

function makeProject(): ProjectBlueprint {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    tenantId: "default",
    name: "Phase 3 Test Project",
    key: "P3T",
    state: "DRAFT_INTAKE",
    schemaVersion: 1,
    blueprintVersion: 1,
    goals: [],
    nonGoals: [],
    stakeholders: [],
    requirements: [],
    features: [],
    epics: [],
    architecture: { systemContext: "", containers: [], dataflows: [], trustBoundaries: [] } as ProjectBlueprint["architecture"],
    risks: [],
    openQuestions: [],
    testingStrategy: { unit: "", integration: "", e2e: "", evalLoops: "" } as ProjectBlueprint["testingStrategy"],
    securityPrivacy: { dataClassification: [], threats: [], controls: [], retention: [] } as ProjectBlueprint["securityPrivacy"],
    releasePlan: { milestones: [], rolloutStrategy: "", featureFlags: [] } as ProjectBlueprint["releasePlan"],
    sourcePins: [],
    createdAt: now,
    updatedAt: now,
  };
}

describe("admin write tools (Phase 3 — ADR 0006)", () => {
  let fx: AdminTestFixture;
  let sid: string;

  beforeEach(async () => {
    fx = await buildAdminFixture();
    sid = await openSession(fx);
  });

  afterEach(async () => {
    await fx.stop();
  });

  it("admin.audit.verify on empty chain succeeds and appends an audit entry", async () => {
    const r = await rpc(fx, sid, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "admin.audit.verify", arguments: {} } });
    expect(r.error).toBeUndefined();
    const sc = r.result?.structuredContent as { ok: boolean; entriesChecked: number; auditEntryId: string };
    expect(sc.ok).toBe(true);
    // The verify call itself appended one entry, but that entry is the FIRST one
    // (entriesChecked counts entries that existed BEFORE the verify ran).
    expect(sc.entriesChecked).toBe(0);
    expect(sc.auditEntryId).toMatch(/^[0-9a-f-]{36}$/);

    // Confirm the audit entry actually landed.
    const list = await rpc(fx, sid, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "admin.audit.list", arguments: {} } });
    const entries = (list.result?.structuredContent as { entries: Array<{ toolName: string }> }).entries;
    expect(entries.some((e) => e.toolName === "admin.audit.verify")).toBe(true);
  });

  it("admin.projects.transition validates legal transitions and updates state", async () => {
    const project = makeProject();
    await fx.repositories.project.create(defaultTenantScope(), project);

    // Legal: DRAFT_INTAKE → BLUEPRINT_READY
    const ok = await rpc(fx, sid, { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "admin.projects.transition", arguments: { key: "P3T", toState: "BLUEPRINT_READY", reason: "operator override during test" } } });
    const okSc = ok.result?.structuredContent as { ok: boolean; previousState: string; newState: string };
    expect(okSc.ok).toBe(true);
    expect(okSc.previousState).toBe("DRAFT_INTAKE");
    expect(okSc.newState).toBe("BLUEPRINT_READY");

    // Confirm DB updated
    const updated = await fx.repositories.project.findByKey(defaultTenantScope(), "P3T");
    expect(updated?.state).toBe("BLUEPRINT_READY");

    // Illegal transition is rejected
    const bad = await rpc(fx, sid, { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "admin.projects.transition", arguments: { key: "P3T", toState: "READY_FOR_BUILD", reason: "intentionally illegal" } } });
    expect(bad.error || ((bad.result as unknown) as { isError?: boolean }).isError).toBeTruthy();
  });

  it("admin.policy.approve writes a follow-up decision and an audit entry", async () => {
    const project = makeProject();
    await fx.repositories.project.create(defaultTenantScope(), project);

    const original: PolicyDecision = {
      id: randomUUID(),
      tenantId: "default",
      projectId: project.id,
      toolName: "vcs.repo.create",
      effect: "require_approval",
      confidenceCategorical: "medium",
      confidenceScore: 0.6,
      reasons: [],
      evaluatedAt: new Date().toISOString(),
    } as PolicyDecision;
    await fx.repositories.policyDecision.insert(defaultTenantScope(), original);

    const r = await rpc(fx, sid, { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "admin.policy.approve", arguments: { decisionId: original.id, reason: "confirmed in slack #provisioning T-1" } } });
    const sc = r.result?.structuredContent as { ok: boolean; followUpDecisionId: string; auditEntryId: string };
    expect(sc.ok).toBe(true);
    expect(sc.followUpDecisionId).not.toBe(original.id);

    // The follow-up decision exists with effect=allow
    const followUp = await fx.repositories.policyDecision.findById(defaultTenantScope(), sc.followUpDecisionId);
    expect(followUp?.effect).toBe("allow");
  });

  it("admin.providers.probe records an audit entry even when provider is not configured", async () => {
    const r = await rpc(fx, sid, { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "admin.providers.probe", arguments: { id: "jira" } } });
    const sc = r.result?.structuredContent as { reachable: boolean; auditEntryId: string; details: string | null };
    expect(sc.reachable).toBe(false);
    expect(sc.details).toBe("provider not configured");
    expect(sc.auditEntryId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("admin.migrations.apply is idempotent and appends an audit entry", async () => {
    const r = await rpc(fx, sid, { jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "admin.migrations.apply", arguments: { reason: "operator triggered apply during test" } } });
    const sc = r.result?.structuredContent as { applied: string[]; skipped: string[]; auditEntryId: string };
    // Test fixture already migrated in createTestDb; re-running is a full skip.
    expect(sc.applied).toEqual([]);
    expect(sc.skipped.length).toBeGreaterThan(0);
    expect(sc.auditEntryId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("admin.jobs.queue.pause errors gracefully when no queue is configured", async () => {
    const r = await rpc(fx, sid, { jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "admin.jobs.queue.pause", arguments: { reason: "test pause without queue" } } });
    // Either the error envelope or an isError flag indicates the failure.
    expect(r.error || ((r.result as unknown) as { isError?: boolean }).isError).toBeTruthy();
  });
});
