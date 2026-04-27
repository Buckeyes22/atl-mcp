// Test fixture for the admin MCP transport + static UI host (ADR 0006).
// Builds an in-process Hono app via createMgmtApiRunner with real (in-memory)
// repositories so admin tools have an actual DB to read/write against.

import { pino, type Logger } from "pino";
import { createMgmtApiRunner } from "../../../src/server/mgmtApi.js";
import { SessionRegistry } from "../../../src/mcp/sessionCapabilities.js";
import { loadConfig } from "../../../src/config.js";
import { createTestDb } from "../storage/_testDb.js";
import { createRepositories, type Repositories } from "../../../src/storage/repositories/index.js";
import { createAuditSigner } from "../../../src/security/auditChain.js";
import { createVelocityContentRegistry } from "../../../src/velocity/contentRegistry.js";
import type { DbHandle } from "../../../src/storage/db.js";

export function silentLogger(): Logger {
  return pino({ level: "silent" });
}

export interface AdminTestFixture {
  /** Hono app — useful for static-asset tests via app.fetch(). */
  app: import("hono").Hono;
  /** Base URL of the started loopback listener — use for /mcp tests via global fetch. */
  baseUrl: string;
  stop: () => Promise<void>;
  repositories: Repositories;
  db: DbHandle;
}

export async function buildAdminFixture(): Promise<AdminTestFixture> {
  // Random high port to avoid collisions across parallel test files.
  const port = 40000 + Math.floor(Math.random() * 5000);
  process.env["MGMT_API_PORT"] = String(port);
  process.env["MGMT_API_HOST"] = "127.0.0.1";

  const db = await createTestDb();
  const repositories = createRepositories(db.db);
  const sessionRegistry = new SessionRegistry();
  const config = loadConfig();
  const logger = silentLogger();

  const runner = createMgmtApiRunner({
    config,
    logger,
    sessionRegistry,
    startedAt: new Date(),
    adminDeps: {
      config,
      logger,
      db,
      repositories,
      auditSigner: createAuditSigner(),
      providers: { jira: undefined, confluence: undefined, vcs: undefined },
      agentSessionRegistry: sessionRegistry,
      provisionQueue: undefined,
      velocityRegistry: createVelocityContentRegistry(),
      startedAt: new Date(),
    },
  });

  await runner.start();

  return {
    app: runner.app,
    baseUrl: `http://127.0.0.1:${port}`,
    repositories,
    db,
    async stop() {
      await runner.stop();
      await db.close();
    },
  };
}
