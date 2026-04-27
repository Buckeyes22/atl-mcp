import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "./_testDb.js";
import type { DbHandle } from "../../../src/storage/db.js";
import { createRepositories, type Repositories } from "../../../src/storage/repositories/index.js";
import { defaultTenantScope } from "../../../src/domain/tenantScope.js";

const scope = defaultTenantScope();

let handle: DbHandle;
let repos: Repositories;

beforeEach(async () => {
  handle = await createTestDb();
  repos = createRepositories(handle.db);
});

afterEach(async () => {
  await handle.close();
});

describe("webhook delivery repository", () => {
  it("records a delivery once and persists the duplicate decision", async () => {
    const first = await repos.webhookDelivery.recordOnce(scope, {
      id: "delivery-1",
      source: "jira",
      observedAt: "2026-04-25T00:00:00.000Z",
    });
    const second = await repos.webhookDelivery.recordOnce(scope, {
      id: "delivery-1",
      source: "jira",
      observedAt: "2026-04-25T00:00:00.000Z",
    });

    expect(first).toBe(true);
    expect(second).toBe(false);
    await expect(repos.webhookDelivery.exists(scope, "delivery-1")).resolves.toBe(true);
  });
});
