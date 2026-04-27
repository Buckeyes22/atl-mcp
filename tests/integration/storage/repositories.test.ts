// Smoke CRUD for every repository on a fresh PGlite database.
// Exercises the M1 acceptance bar:
//   "Trace links, readiness results, policy decisions, session profiles,
//    ACL entries, and audit entries persist."

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestDb } from "./_testDb.js";
import type { DbHandle } from "../../../src/storage/db.js";
import { createRepositories, type Repositories } from "../../../src/storage/repositories/index.js";
import { defaultTenantScope } from "../../../src/domain/tenantScope.js";
import { emptyBlueprint } from "../../../src/domain/projectBlueprint.js";

const scope = defaultTenantScope();
const FROZEN = "2026-04-25T00:00:00.000Z";

let handle: DbHandle;
let repos: Repositories;

beforeEach(async () => {
  handle = await createTestDb();
  repos = createRepositories(handle.db);
});
afterEach(async () => {
  await handle.close();
});

describe("project repository", () => {
  it("create → findById round-trips", async () => {
    const blueprint = emptyBlueprint(
      { id: randomUUID(), tenantId: scope.tenantId, name: "Smoke", key: "SMK" },
      FROZEN,
    );
    await repos.project.create(scope, blueprint);
    const fetched = await repos.project.findById(scope, blueprint.id);
    expect(fetched).toEqual(blueprint);
  });

  it("findByKey returns the project", async () => {
    const blueprint = emptyBlueprint(
      { id: randomUUID(), tenantId: scope.tenantId, name: "ByKey", key: "BYK" },
      FROZEN,
    );
    await repos.project.create(scope, blueprint);
    const fetched = await repos.project.findByKey(scope, "BYK");
    expect(fetched?.id).toBe(blueprint.id);
  });

  it("update bumps blueprintVersion + state", async () => {
    const blueprint = emptyBlueprint(
      { id: randomUUID(), tenantId: scope.tenantId, name: "Updatable", key: "UPD" },
      FROZEN,
    );
    await repos.project.create(scope, blueprint);
    const updated = { ...blueprint, blueprintVersion: 2, state: "BLUEPRINT_READY" as const, updatedAt: "2026-04-25T01:00:00.000Z" };
    await repos.project.update(scope, updated);
    const fetched = await repos.project.findById(scope, blueprint.id);
    expect(fetched?.state).toBe("BLUEPRINT_READY");
    expect(fetched?.blueprintVersion).toBe(2);
  });

  it("rejects tenantId mismatch", async () => {
    const blueprint = emptyBlueprint(
      { id: randomUUID(), tenantId: "other-tenant", name: "X", key: "X" },
      FROZEN,
    );
    await expect(repos.project.create(scope, blueprint)).rejects.toThrow();
  });
});

describe("trace link repository", () => {
  it("creates and lists by project", async () => {
    await repos.traceLink.create(scope, {
      id: randomUUID(),
      tenantId: scope.tenantId,
      projectId: "proj-1",
      source: { kind: "jira_issue", id: "PCO-1" },
      target: { kind: "confluence_page", id: "page-42" },
      relation: "documents",
      createdAt: FROZEN,
    });
    const all = await repos.traceLink.findByProject(scope, "proj-1");
    expect(all).toHaveLength(1);
    expect(all[0]?.relation).toBe("documents");
  });
});

describe("policy decision repository", () => {
  it("inserts and retrieves a policy decision", async () => {
    const id = randomUUID();
    await repos.policyDecision.insert(scope, {
      id,
      tenantId: scope.tenantId,
      projectId: "proj-1",
      toolName: "test_tool",
      effect: "allow",
      reasons: ["smoke"],
      obligations: [],
      evaluatedAt: FROZEN,
      confidenceCategorical: "high",
      confidenceScore: 0.95,
      checks: [{ name: "ok", checked: true, confidence: 100 }],
    });
    const fetched = await repos.policyDecision.findById(scope, id);
    expect(fetched?.effect).toBe("allow");
  });
});

describe("mcp session profile repository", () => {
  it("upserts twice and reads the latest values", async () => {
    const id = randomUUID();
    await repos.mcpSessionProfile.upsert(scope, {
      id,
      tenantId: scope.tenantId,
      protocolVersion: "2025-11-25",
      clientInfo: { name: "test" },
      clientCapabilities: { roots: false, sampling: true, elicitation: false, tasks: false },
      enabledServerFeatures: [],
      disabledFeatureReasons: {},
      createdAt: FROZEN,
      lastSeenAt: FROZEN,
    });
    await repos.mcpSessionProfile.upsert(scope, {
      id,
      tenantId: scope.tenantId,
      protocolVersion: "2025-11-25",
      clientInfo: { name: "test", version: "0.1.0" },
      clientCapabilities: { roots: true, sampling: true, elicitation: true, tasks: false },
      enabledServerFeatures: ["sampling"],
      disabledFeatureReasons: {},
      agentMode: "worker",
      createdAt: FROZEN,
      lastSeenAt: "2026-04-25T01:00:00.000Z",
    });
    const fetched = await repos.mcpSessionProfile.findById(scope, id);
    expect(fetched?.agentMode).toBe("worker");
    expect(fetched?.enabledServerFeatures).toEqual(["sampling"]);
  });
});

describe("acl repository", () => {
  it("upserts and finds by composite key", async () => {
    await repos.acl.upsert(scope, {
      tenantId: scope.tenantId,
      projectId: "proj-1",
      artifactRef: { kind: "jira_issue", id: "PCO-1" },
      principalId: "user@example.com",
      decision: "allowed",
      observedAt: FROZEN,
      source: "jira_permission_check",
      classification: "PRIVATE",
    });
    const fetched = await repos.acl.find(scope, {
      projectId: "proj-1",
      artifactKind: "jira_issue",
      artifactId: "PCO-1",
      principalId: "user@example.com",
    });
    expect(fetched?.decision).toBe("allowed");
    expect(fetched?.classification).toBe("PRIVATE");
  });
});

describe("readiness repository", () => {
  it("inserts and reads latest", async () => {
    const id = randomUUID();
    await repos.readiness.insert(scope, {
      id,
      tenantId: scope.tenantId,
      projectId: "proj-1",
      grade: "B",
      verdict: "SHIP_WITH_QUARANTINE",
      generatedAt: FROZEN,
      details: { score: 0.78 },
    });
    const fetched = await repos.readiness.findLatestForProject(scope, "proj-1");
    expect(fetched?.grade).toBe("B");
  });
});

describe("context pack repository", () => {
  it("inserts and retrieves by regenerationKey", async () => {
    const id = randomUUID();
    await repos.contextPack.insert(scope, {
      id,
      tenantId: scope.tenantId,
      projectId: "proj-1",
      title: "T",
      summary: "S",
      goals: [],
      nonGoals: [],
      acceptanceCriteria: [],
      implementationPlan: [],
      testPlan: [],
      linkedArtifacts: [],
      relevantFiles: [],
      risks: [],
      openQuestions: [],
      tokenBudget: {
        targetModel: "claude-sonnet-4-6",
        budgetTokens: 8000,
        usedTokens: 0,
        byCategory: {
          claudeMd: 0,
          mentionedFile: 0,
          toolOutput: 0,
          thinkingText: 0,
          teamCoordination: 0,
          userMessage: 0,
        },
        sections: [],
      },
      sourcePins: [],
      generatedAt: FROZEN,
      regenerationKey: "rk-001",
      freshness: "current",
      accessDecision: "allowed",
    });
    const fetched = await repos.contextPack.findByRegenerationKey(scope, "rk-001");
    expect(fetched?.id).toBe(id);
  });
});

describe("agent memory repository", () => {
  it("persists, recalls, dedupes, and soft-deletes project-scoped memory", async () => {
    const entry = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      projectId: "proj-memory",
      agentKey: "codex@1.0",
      sessionId: "session-1",
      issueKey: "MEM-1",
      kind: "decision" as const,
      text: "Use Bitbucket repository scaffolding for the handoff.",
      tags: ["vcs", "handoff"],
      sourceRefs: [{ kind: "jira_issue", id: "MEM-1" }],
      contentHash: "hash-001",
      createdAt: FROZEN,
      updatedAt: FROZEN,
    };

    await repos.agentMemory.insert(scope, entry);

    const fetched = await repos.agentMemory.findById(scope, entry.id);
    expect(fetched).toEqual(entry);
    const duplicate = await repos.agentMemory.findActiveDuplicate(scope, {
      projectId: "proj-memory",
      agentKey: "codex@1.0",
      contentHash: "hash-001",
    });
    expect(duplicate?.id).toBe(entry.id);
    const candidates = await repos.agentMemory.recallCandidates(scope, {
      projectId: "proj-memory",
      agentKey: "codex@1.0",
      issueKey: "MEM-1",
      kinds: ["decision"],
    });
    expect(candidates.map((c) => c.id)).toEqual([entry.id]);

    const deleted = await repos.agentMemory.softDelete(scope, {
      id: entry.id,
      projectId: "proj-memory",
      agentKey: "codex@1.0",
      deletedAt: "2026-04-25T01:00:00.000Z",
    });
    expect(deleted?.deletedAt).toBe("2026-04-25T01:00:00.000Z");
    const afterDelete = await repos.agentMemory.recallCandidates(scope, {
      projectId: "proj-memory",
      agentKey: "codex@1.0",
    });
    expect(afterDelete).toEqual([]);
  });
});

describe("work assignment repository", () => {
  it("persists recommendations and confirmed assignments by project", async () => {
    const created = await repos.workAssignment.create(scope, {
      id: randomUUID(),
      tenantId: scope.tenantId,
      projectId: "proj-assign",
      workRef: { kind: "blueprint_story", id: "STORY-1", title: "Build API" },
      classification: {
        workType: "backend",
        skillTags: ["typescript", "api"],
        riskLevel: "medium",
        confidence: 0.82,
        explanation: "backend keywords matched",
      },
      recommendedAgents: [
        { agentId: "agent-1", label: "Backend Agent", score: 88, matchedTags: ["api"], reasons: ["skill match"], source: "live" },
      ],
      status: "suggested",
      createdAt: FROZEN,
      updatedAt: FROZEN,
    });

    const assigned = await repos.workAssignment.assign(scope, {
      id: created.id,
      assignedAgentId: "agent-1",
      assignedBy: "dev@example.com",
      updatedAt: "2026-04-25T01:00:00.000Z",
    });
    const listed = await repos.workAssignment.listByProject(scope, "proj-assign");

    expect(assigned.status).toBe("assigned");
    expect(assigned.assignedAgentId).toBe("agent-1");
    expect(listed.map((row) => row.id)).toEqual([created.id]);
  });
});

describe("content quality report repository", () => {
  it("inserts and lists quality reports by project", async () => {
    const report = await repos.contentQualityReport.insert(scope, {
      id: randomUUID(),
      tenantId: scope.tenantId,
      projectId: "proj-quality",
      artifactRef: { kind: "blueprint_section", id: "proj-quality" },
      score: 82,
      grade: "A",
      findings: [{ id: "completeness", label: "Completeness", score: 18, maxScore: 20, status: "pass", detail: "complete" }],
      recommendations: [],
      deterministic: true,
      generatedAt: FROZEN,
    });

    const latest = await repos.contentQualityReport.findLatestForProject(scope, "proj-quality");
    const listed = await repos.contentQualityReport.listByProject(scope, "proj-quality");

    expect(latest?.id).toBe(report.id);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.grade).toBe("A");
  });
});
