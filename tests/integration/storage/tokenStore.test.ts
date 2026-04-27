// Encrypted token round-trip — M1 acceptance: "Encrypted token round-trip passes."

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "./_testDb.js";
import type { DbHandle } from "../../../src/storage/db.js";
import { createRepositories } from "../../../src/storage/repositories/index.js";
import { createTokenStore } from "../../../src/security/tokenStore.js";
import {
  createTokenEncryption,
  generateMasterKey,
} from "../../../src/security/tokenEncryption.js";
import { createTestDoubleTokenEncryption } from "../../../src/security/tokenEncryption.testDouble.js";
import { defaultTenantScope } from "../../../src/domain/tenantScope.js";

const scope = defaultTenantScope();
let handle: DbHandle;

beforeEach(async () => {
  handle = await createTestDb();
});
afterEach(async () => {
  await handle.close();
});

describe("tokenStore with real encryption", () => {
  it("put → get round-trips a token through actual xchacha20poly1305", async () => {
    const repos = createRepositories(handle.db);
    const enc = createTokenEncryption(generateMasterKey());
    const store = createTokenStore({ repositories: repos, encryption: enc });

    const plaintext = "ATATT3xFf-API-TOKEN-vKj4-real-secret";
    await store.put(scope, "atlassian:test@example.com", plaintext);
    const got = await store.get(scope, "atlassian:test@example.com");
    expect(got).toBe(plaintext);
  });

  it("get on missing key returns undefined", async () => {
    const repos = createRepositories(handle.db);
    const enc = createTokenEncryption(generateMasterKey());
    const store = createTokenStore({ repositories: repos, encryption: enc });
    const got = await store.get(scope, "nonexistent");
    expect(got).toBeUndefined();
  });

  it("put then put with new value updates the ciphertext (upsert)", async () => {
    const repos = createRepositories(handle.db);
    const enc = createTokenEncryption(generateMasterKey());
    const store = createTokenStore({ repositories: repos, encryption: enc });

    await store.put(scope, "k1", "first");
    await store.put(scope, "k1", "second");
    const got = await store.get(scope, "k1");
    expect(got).toBe("second");
  });

  it("delete removes the record", async () => {
    const repos = createRepositories(handle.db);
    const enc = createTokenEncryption(generateMasterKey());
    const store = createTokenStore({ repositories: repos, encryption: enc });
    await store.put(scope, "k1", "value");
    await store.delete(scope, "k1");
    expect(await store.get(scope, "k1")).toBeUndefined();
  });

  it("ciphertext at rest is not the plaintext", async () => {
    const repos = createRepositories(handle.db);
    const enc = createTokenEncryption(generateMasterKey());
    const store = createTokenStore({ repositories: repos, encryption: enc });

    const plaintext = "VERY-SECRET-TOKEN-ABC123";
    await store.put(scope, "kk", plaintext);
    const row = await repos.encryptedToken.findByLogicalKey(scope, "kk");
    expect(row).toBeDefined();
    expect(row?.ciphertext).not.toContain(plaintext);
    expect(row?.algo).toBe("xchacha20poly1305");
  });
});

describe("tokenStore with test double", () => {
  it("round-trips with the no-op double (smoke for code paths that don't care about crypto)", async () => {
    const repos = createRepositories(handle.db);
    const store = createTokenStore({
      repositories: repos,
      encryption: createTestDoubleTokenEncryption(),
    });
    await store.put(scope, "k1", "value");
    expect(await store.get(scope, "k1")).toBe("value");
  });
});
