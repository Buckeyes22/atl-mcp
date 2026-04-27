// F-011 closure: persistent provision job state survives across reads
// and is tenant-scoped.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "./_testDb.js";
import type { DbHandle } from "../../../src/storage/db.js";
import { createProvisionJobRepository, type ProvisionJobRepository } from "../../../src/storage/repositories/provisionJobRepository.js";
import { defaultTenantScope, makeTenantScope } from "../../../src/domain/tenantScope.js";

describe("provisionJobRepository", () => {
  let handle: DbHandle;
  let repo: ProvisionJobRepository;

  beforeEach(async () => {
    handle = await createTestDb();
    repo = createProvisionJobRepository(handle.db);
  });
  afterEach(async () => {
    await handle.close();
  });

  it("create → get round-trips a job", async () => {
    const scope = defaultTenantScope();
    const created = await repo.create(scope, { id: "job-1", projectId: "proj-1" });
    expect(created.id).toBe("job-1");
    expect(created.status).toBe("queued");
    const fetched = await repo.get(scope, "job-1");
    expect(fetched?.projectId).toBe("proj-1");
    expect(fetched?.status).toBe("queued");
  });

  it("update transitions status and persists result/error", async () => {
    const scope = defaultTenantScope();
    await repo.create(scope, { id: "job-2", projectId: "proj-1" });
    await repo.update(scope, "job-2", { status: "running" });
    await repo.update(scope, "job-2", { status: "completed", result: { ok: true } });
    const final = await repo.get(scope, "job-2");
    expect(final?.status).toBe("completed");
    expect(final?.result).toEqual({ ok: true });
  });

  it("recent returns jobs in updatedAt-desc order, scoped by tenant", async () => {
    const scope = defaultTenantScope();
    await repo.create(scope, { id: "job-a", projectId: "proj-1" });
    await new Promise((r) => setTimeout(r, 20));
    await repo.create(scope, { id: "job-b", projectId: "proj-1" });
    const recent = await repo.recent(scope, 5);
    expect(recent.map((j) => j.id)).toEqual(["job-b", "job-a"]);
  });

  it("does not leak jobs across tenants", async () => {
    const tenantA = defaultTenantScope();
    const tenantB = makeTenantScope("other-tenant");
    await repo.create(tenantA, { id: "job-a", projectId: "proj-1" });
    expect(await repo.get(tenantB, "job-a")).toBeUndefined();
    expect(await repo.recent(tenantB)).toEqual([]);
  });
});
