// Audit chain integrity tests.
// M1 ships the chain mechanics with placeholder signatures; M6a replaces the
// signing pipeline with ed25519 + JCS canonicalization (agentdiff F-117).

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestDb } from "./_testDb.js";
import type { DbHandle } from "../../../src/storage/db.js";
import { createRepositories, type Repositories } from "../../../src/storage/repositories/index.js";
import { defaultTenantScope } from "../../../src/domain/tenantScope.js";
import { PLACEHOLDER_SIGNATURE, type AuditEntry } from "../../../src/domain/auditEntry.js";

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

function makeEntry(seq: number): Omit<AuditEntry, "prevHash"> {
  return {
    id: randomUUID(),
    tenantId: scope.tenantId,
    projectId: "proj-1",
    timestamp: FROZEN,
    actor: {
      mcpPrincipalId: "p",
      mcpPrincipalFingerprint: "0".repeat(16),
      credentialFingerprint: "00000000",
      authMode: "api_token",
    },
    toolName: `tool_${seq}`,
    inputHash: `hash_${seq}`,
    signature: PLACEHOLDER_SIGNATURE,
  };
}

describe("audit chain", () => {
  it("first entry uses prevHash='0'", async () => {
    const e = await repos.audit.append(scope, { entry: makeEntry(1) });
    expect(e.prevHash).toBe("0");
  });

  it("subsequent entries link to the previous payload hash", async () => {
    const a = await repos.audit.append(scope, { entry: makeEntry(1) });
    const b = await repos.audit.append(scope, { entry: makeEntry(2) });
    expect(b.prevHash).not.toBe("0");
    expect(b.prevHash).not.toBe(a.prevHash);
  });

  it("verifyChain reports zero mismatches on a clean chain", async () => {
    for (let i = 1; i <= 5; i++) {
      await repos.audit.append(scope, { entry: makeEntry(i) });
    }
    const result = await repos.audit.verifyChain(scope, "proj-1");
    expect(result.entriesChecked).toBe(5);
    expect(result.mismatches).toEqual([]);
  });

  it("readChainForProject returns entries in sequence order", async () => {
    for (let i = 1; i <= 3; i++) {
      await repos.audit.append(scope, { entry: makeEntry(i) });
    }
    const entries = await repos.audit.readChainForProject(scope, "proj-1");
    expect(entries.map((e) => e.toolName)).toEqual(["tool_1", "tool_2", "tool_3"]);
  });

  it("entries with null projectId are chained separately from project entries", async () => {
    const projEntry = makeEntry(1);
    const sysEntry = { ...makeEntry(2), projectId: undefined };
    await repos.audit.append(scope, { entry: projEntry });
    await repos.audit.append(scope, { entry: sysEntry });
    const sysChain = await repos.audit.readChainForProject(scope, null);
    const projChain = await repos.audit.readChainForProject(scope, "proj-1");
    expect(sysChain).toHaveLength(1);
    expect(projChain).toHaveLength(1);
  });
});
