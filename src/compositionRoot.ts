// Composition root — wires storage + security + providers from env.
//
// Used by both the running server (eventually, when M3+ wire it into server.ts)
// and the preflight CLI in scripts/preflight-cli.ts. The root is shaped so that
// callers can reach into individual subsystems (e.g., just providers, or just
// repositories) without instantiating the whole graph.

import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { dirname } from "node:path";
import { loadConfig, type OrchestratorConfig } from "./config.js";
import { readBoolean, readOptionalString, readString } from "./config/env.js";
import { createLogger } from "./observability/logger.js";
import { createDbHandle, type DbHandle } from "./storage/db.js";
import { createRepositories, type Repositories } from "./storage/repositories/index.js";
import { createTokenEncryption, type TokenEncryption } from "./security/tokenEncryption.js";
import { createTokenStore, type TokenStore } from "./security/tokenStore.js";
import {
  createAuditSigner,
  generateAuditKeypair,
  loadAuditKeypair,
  type AuditKeyMaterial,
  type AuditSigner,
} from "./security/auditChain.js";
import { createGitRefKeyRegistryRepository } from "./storage/repositories/keyRegistryRepository.js";
import { createApiTokenAuth } from "./providers/atlassian/auth/apiToken.js";
import { createOAuth3loAuth } from "./providers/atlassian/auth/oauth3lo.js";
import {
  ATLASSIAN_OAUTH_ACCESS_TOKEN_KEY,
  ATLASSIAN_OAUTH_REFRESH_TOKEN_KEY,
} from "./providers/atlassian/auth/oauthCallback.js";
import { createJiraRestProvider } from "./providers/atlassian/jiraRestProvider.js";
import { createConfluenceRestProvider } from "./providers/atlassian/confluenceRestProvider.js";
import { createBitbucketAppPasswordAuth } from "./providers/vcs/bitbucket/auth/appPassword.js";
import { createBitbucketRestProvider } from "./providers/vcs/bitbucket/bitbucketRestProvider.js";
import { createGithubRestProvider } from "./providers/vcs/github/githubRestProvider.js";
import { createWorktreeManager, type WorktreeManager } from "./providers/vcs/worktreeManager.js";
import { createUioAdapter } from "./providers/uio/uioMcpAdapter.js";
import { createBullMqProvisionQueue, type ProvisionQueue } from "./queue/provisionQueue.js";
import { createVelocityContentRegistry, type VelocityContentRegistry } from "./velocity/contentRegistry.js";
import { createProvisionJobExecutor } from "./queue/jobs/provisionJob.js";
import { createCodePolicyAdapter } from "./security/policyAdapters/codePolicyAdapter.js";
import {
  createDisabledAgentMemoryVectorIndex,
  createQdrantAgentMemoryVectorIndex,
  type AgentMemoryVectorIndex,
} from "./workflows/agentMemoryVectorIndex.js";
import type { AtlassianAuthProvider } from "./providers/atlassian/auth/types.js";
import type { JiraProvider } from "./providers/atlassian/jiraProvider.js";
import type { ConfluenceProvider } from "./providers/atlassian/confluenceProvider.js";
import type { VcsProvider } from "./providers/vcs/VcsProvider.js";
import type { UioAdapter } from "./providers/uio/uioMcpAdapter.js";
import type { Logger } from "pino";
import { defaultTenantScope } from "./domain/tenantScope.js";

export interface CompositionRoot {
  readonly config: OrchestratorConfig;
  readonly logger: Logger;
  readonly db: DbHandle;
  readonly repositories: Repositories;
  readonly encryption: TokenEncryption;
  readonly tokenStore: TokenStore;
  readonly providers: {
    readonly jira: JiraProvider | undefined;
    readonly confluence: ConfluenceProvider | undefined;
    readonly vcs: VcsProvider | undefined;
    readonly uio: UioAdapter;
  };
  readonly worktrees: WorktreeManager | undefined;
  readonly auth: {
    readonly atlassian: AtlassianAuthProvider | undefined;
  };
  /** Audit signer with persistent key when AUDIT_SIGNING_PRIVKEY_PATH is set; ephemeral otherwise. */
  readonly auditSigner: AuditSigner;
  readonly provisionQueue: ProvisionQueue | undefined;
  readonly webhookSecrets: Readonly<Record<string, string>>;
  /** Velocity-ops content registry — feeds the M4 blueprint synthesis prompt and (later) the M6b/c executors. */
  readonly velocityRegistry: VelocityContentRegistry;
  readonly agentMemoryVectorIndex: AgentMemoryVectorIndex;
  close(): Promise<void>;
}

export interface CompositionRootOptions {
  /** When true, skip running pending migrations (caller has already migrated). */
  readonly skipMigrations?: boolean;
}

export async function buildCompositionRoot(opts: CompositionRootOptions = {}): Promise<CompositionRoot> {
  const config = loadConfig();
  const logger = createLogger(config);

  // --- Storage ---
  const devMode = readBoolean("DATABASE_DEV_MODE", true);
  const dbUrl = readOptionalString("DATABASE_URL");
  const db = await createDbHandle({ devMode, ...(dbUrl !== undefined ? { url: dbUrl } : {}), logger });
  if (!opts.skipMigrations) {
    await db.migrate();
  }
  const repositories = createRepositories(db.db);

  // --- Security: token encryption + token store ---
  const masterKeyB64 = readString("TOKEN_MASTER_KEY");
  const masterKey = new Uint8Array(Buffer.from(masterKeyB64, "base64"));
  const encryption = createTokenEncryption(masterKey);
  const tokenStore = createTokenStore({ repositories, encryption });

  // --- Atlassian auth + providers ---
  let atlassianAuth: AtlassianAuthProvider | undefined;
  let jira: JiraProvider | undefined;
  let confluence: ConfluenceProvider | undefined;

  const authMode = readOptionalString("ATLASSIAN_AUTH_MODE");
  if (authMode === "api_token") {
    const email = readString("ATLASSIAN_EMAIL");
    const apiToken = readString("ATLASSIAN_API_TOKEN");
    atlassianAuth = createApiTokenAuth({ email, apiToken });

    const jiraBaseUrl = readOptionalString("JIRA_BASE_URL");
    if (jiraBaseUrl) {
      jira = createJiraRestProvider({
        baseUrl: jiraBaseUrl,
        auth: atlassianAuth,
        logger,
        userAgent: `${config.serverInfo.name}/${config.serverInfo.version}`,
      });
    }

    const confluenceBaseUrl = readOptionalString("CONFLUENCE_BASE_URL");
    if (confluenceBaseUrl) {
      confluence = createConfluenceRestProvider({
        baseUrl: confluenceBaseUrl,
        auth: atlassianAuth,
        logger,
        userAgent: `${config.serverInfo.name}/${config.serverInfo.version}`,
      });
    }
  } else if (authMode === "oauth3lo") {
    const clientId = readOptionalString("ATLASSIAN_OAUTH_CLIENT_ID");
    const clientSecret = readOptionalString("ATLASSIAN_OAUTH_CLIENT_SECRET");
    const tokenEndpoint = readOptionalString("ATLASSIAN_OAUTH_TOKEN_ENDPOINT") ?? "https://auth.atlassian.com/oauth/token";
    const scope = defaultTenantScope();
    const refreshToken = await tokenStore.get(scope, ATLASSIAN_OAUTH_REFRESH_TOKEN_KEY);
    if (!clientId || !clientSecret || !refreshToken) {
      logger.warn(
        {
          missingClientId: !clientId,
          missingClientSecret: !clientSecret,
          missingRefreshToken: !refreshToken,
        },
        "ATLASSIAN_AUTH_MODE=oauth3lo is selected but OAuth credentials are incomplete; run the callback bootstrap first",
      );
    } else {
      const initialAccess = await readStoredOAuthAccess(tokenStore, scope);
      atlassianAuth = createOAuth3loAuth({
        clientId,
        clientSecret,
        tokenEndpoint,
        initialRefreshToken: refreshToken,
        persistRotatedRefreshToken: (nextRefreshToken) =>
          tokenStore.put(scope, ATLASSIAN_OAUTH_REFRESH_TOKEN_KEY, nextRefreshToken),
        logger,
        ...(initialAccess ? { initialAccess } : {}),
      });

      const jiraBaseUrl = readOptionalString("JIRA_BASE_URL");
      if (jiraBaseUrl) {
        jira = createJiraRestProvider({
          baseUrl: jiraBaseUrl,
          auth: atlassianAuth,
          logger,
          userAgent: `${config.serverInfo.name}/${config.serverInfo.version}`,
        });
      }

      const confluenceBaseUrl = readOptionalString("CONFLUENCE_BASE_URL");
      if (confluenceBaseUrl) {
        confluence = createConfluenceRestProvider({
          baseUrl: confluenceBaseUrl,
          auth: atlassianAuth,
          logger,
          userAgent: `${config.serverInfo.name}/${config.serverInfo.version}`,
        });
      }
    }
  }

  // --- VCS provider (Bitbucket Cloud or GitHub) ---
  let vcs: VcsProvider | undefined;
  let worktrees: WorktreeManager | undefined;
  const vcsProvider = readOptionalString("VCS_PROVIDER") ?? "bitbucket";
  const bbUsername = readOptionalString("BITBUCKET_USERNAME");
  const bbAppPassword = readOptionalString("BITBUCKET_APP_PASSWORD");
  const githubToken = readOptionalString("GITHUB_TOKEN");
  if (vcsProvider === "github" && githubToken) {
    vcs = createGithubRestProvider({
      token: githubToken,
      logger,
      userAgent: `${config.serverInfo.name}/${config.serverInfo.version}`,
    });
  } else if (vcsProvider === "bitbucket" && bbUsername && bbAppPassword) {
    const bbAuth = createBitbucketAppPasswordAuth({ username: bbUsername, appPassword: bbAppPassword });
    vcs = createBitbucketRestProvider({
      auth: bbAuth,
      logger,
      userAgent: `${config.serverInfo.name}/${config.serverInfo.version}`,
    });
  } else if (vcsProvider !== "bitbucket" && vcsProvider !== "github") {
    logger.warn({ vcsProvider }, "unsupported VCS_PROVIDER; expected bitbucket or github");
  }

  // Worktree manager — usable independently of a VCS provider; only needs a
  // local source repo path. Configured separately so operators can use
  // worktrees against their actual git repo (any provider).
  const worktreeRepo = readOptionalString("WORKTREE_SOURCE_REPO_PATH");
  const worktreeRoot = readOptionalString("WORKTREE_ROOT");
  if (worktreeRepo && worktreeRoot) {
    worktrees = createWorktreeManager({
      sourceRepoPath: worktreeRepo,
      worktreesRoot: worktreeRoot,
      logger,
    });
  }

  const webhookSecrets = readWebhookSecrets();

  // --- Audit signing key bootstrap (F-003) ---
  // Persistent path: read AUDIT_SIGNING_PRIVKEY_PATH if set.
  //   - File present → load. Register the public key into the git-ref registry
  //     idempotently (the registry shells out to git update-ref; safe to re-run).
  //   - File absent → generate, write 0600, register.
  // Ephemeral path: when no path is configured (dev / tests), generate a fresh
  // keypair per process. The generated public key is NOT registered to a ref —
  // signatures are still verifiable against the in-process signer.
  const auditKeyPath = readOptionalString("AUDIT_SIGNING_PRIVKEY_PATH");
  const auditKeyRegistryRef = readOptionalString("AUDIT_SIGNING_KEY_REGISTRY_REF") ?? "refs/orchestrator/keys";
  const auditKeyRepoPath = readOptionalString("AUDIT_SIGNING_REPO_PATH") ?? process.cwd();
  let auditMaterial: AuditKeyMaterial;
  if (auditKeyPath) {
    auditMaterial = await bootstrapPersistentAuditKey({
      privKeyPath: auditKeyPath,
      repoPath: auditKeyRepoPath,
      refPrefix: auditKeyRegistryRef,
      logger,
    });
  } else {
    auditMaterial = generateAuditKeypair();
    logger.warn(
      { keyId: auditMaterial.keyId },
      "audit signer using ephemeral key — set AUDIT_SIGNING_PRIVKEY_PATH for persistent signing",
    );
  }
  const auditSigner = createAuditSigner(auditMaterial);

  let provisionQueue: ProvisionQueue | undefined;
  if (config.flags.milestone6aEnabled) {
    const redisUrl = readOptionalString("REDIS_URL");
    if (!redisUrl || !jira) {
      logger.warn(
        {
          missingRedis: !redisUrl,
          missingJira: !jira,
        },
        "project_provision_execute is visible but execution queue is data-limited until REDIS_URL and Jira provider are configured",
      );
    } else {
      const executor = createProvisionJobExecutor({
        jira,
        policy: createCodePolicyAdapter(),
        traceLink: repositories.traceLink,
        audit: repositories.audit,
        projectProfile: repositories.projectProfile,
        policyDecision: repositories.policyDecision,
        signer: auditSigner,
      });
      provisionQueue = createBullMqProvisionQueue({
        redisUrl,
        provisionJobs: repositories.provisionJob,
        execute: (scope, input) => executor.execute(scope, input),
      });
    }
  }

  // --- UIO partner adapter (optional) ---
  const uioEnabled = readBoolean("UIO_ENABLED", false);
  const uioBaseUrl = readOptionalString("UIO_BASE_URL");
  const uioApiKey = readOptionalString("UIO_API_KEY");
  const uioQdrantUrl = readOptionalString("UIO_QDRANT_URL");
  const uioQdrantApiKey = readOptionalString("UIO_QDRANT_API_KEY");
  const uioDefaultCollection = readOptionalString("UIO_DEFAULT_COLLECTION");
  const uio = createUioAdapter({
    enabled: uioEnabled,
    ...(uioBaseUrl !== undefined ? { baseUrl: uioBaseUrl } : {}),
    ...(uioApiKey !== undefined ? { apiKey: uioApiKey } : {}),
    ...(uioQdrantUrl !== undefined ? { qdrantUrl: uioQdrantUrl } : {}),
    ...(uioQdrantApiKey !== undefined ? { qdrantApiKey: uioQdrantApiKey } : {}),
    ...(uioDefaultCollection !== undefined ? { defaultCollection: uioDefaultCollection } : {}),
    logger,
  });

  const velocityRegistry = createVelocityContentRegistry();
  const agentMemoryVectorIndex = createAgentMemoryVector(config);

  return {
    config,
    logger,
    db,
    repositories,
    encryption,
    tokenStore,
    providers: { jira, confluence, vcs, uio },
    worktrees,
    auth: { atlassian: atlassianAuth },
    auditSigner,
    provisionQueue,
    webhookSecrets,
    velocityRegistry,
    agentMemoryVectorIndex,
    async close() {
      if (provisionQueue) await provisionQueue.close();
      await db.close();
    },
  };
}

function createAgentMemoryVector(config: OrchestratorConfig): AgentMemoryVectorIndex {
  if (!config.flags.agentMemoryVectorEnabled) {
    return createDisabledAgentMemoryVectorIndex("AGENT_MEMORY_VECTOR_ENABLED=false");
  }
  const qdrantUrl = readOptionalString("AGENT_MEMORY_QDRANT_URL");
  if (!qdrantUrl) {
    return createDisabledAgentMemoryVectorIndex("AGENT_MEMORY_QDRANT_URL is unset");
  }
  const qdrantApiKey = readOptionalString("AGENT_MEMORY_QDRANT_API_KEY");
  const collection = readOptionalString("AGENT_MEMORY_QDRANT_COLLECTION") ?? "atl_mcp_agent_memory";
  return createQdrantAgentMemoryVectorIndex({
    url: qdrantUrl,
    ...(qdrantApiKey !== undefined ? { apiKey: qdrantApiKey } : {}),
    collection,
    dimensions: 64,
  });
}

function readWebhookSecrets(): Readonly<Record<string, string>> {
  const secrets: Record<string, string> = {};
  const jira = readOptionalString("JIRA_WEBHOOK_SECRET");
  const confluence = readOptionalString("CONFLUENCE_WEBHOOK_SECRET");
  const bitbucket = readOptionalString("BITBUCKET_WEBHOOK_SECRET");
  const github = readOptionalString("GITHUB_WEBHOOK_SECRET");
  if (jira) secrets["jira"] = jira;
  if (confluence) secrets["confluence"] = confluence;
  if (bitbucket) secrets["bitbucket"] = bitbucket;
  if (github) secrets["github"] = github;
  return secrets;
}

async function bootstrapPersistentAuditKey(input: {
  readonly privKeyPath: string;
  readonly repoPath: string;
  readonly refPrefix: string;
  readonly logger: Logger;
}): Promise<AuditKeyMaterial> {
  const expanded = input.privKeyPath.replace(/^~(?=$|\/|\\)/, process.env["HOME"] ?? process.env["USERPROFILE"] ?? "~");
  let material: AuditKeyMaterial;
  try {
    const raw = await readFile(expanded);
    // Stored format: 32 raw bytes (we control read+write so no PEM parsing needed).
    if (raw.length !== 32) {
      throw new Error(`audit private key file must be 32 raw bytes, got ${raw.length}`);
    }
    material = loadAuditKeypair(new Uint8Array(raw));
    input.logger.info({ keyId: material.keyId, path: expanded }, "loaded persistent audit signing key");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      material = generateAuditKeypair();
      await mkdir(dirname(expanded), { recursive: true });
      await writeFile(expanded, Buffer.from(material.privateKey), { mode: 0o600 });
      try { await chmod(expanded, 0o600); } catch { /* Windows */ }
      input.logger.info({ keyId: material.keyId, path: expanded }, "generated and persisted new audit signing key");
    } else {
      throw err;
    }
  }
  // Register public key in git-ref registry (idempotent: same hash → same ref → no-op).
  try {
    const registry = createGitRefKeyRegistryRepository({ repoPath: input.repoPath, refPrefix: input.refPrefix });
    await registry.registerPublicKey({ keyId: material.keyId, publicKeyPem: material.publicKeyPem });
    input.logger.info({ keyId: material.keyId, ref: `${input.refPrefix}/${material.keyId}` }, "audit public key registered to git-ref registry");
  } catch (err) {
    input.logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "audit public key registration failed; signing still works locally but verification against the registry will fail",
    );
  }
  return material;
}

async function readStoredOAuthAccess(
  tokenStore: TokenStore,
  scope: ReturnType<typeof defaultTenantScope>,
): Promise<{ readonly token: string; readonly expiresAt: number } | undefined> {
  const raw = await tokenStore.get(scope, ATLASSIAN_OAUTH_ACCESS_TOKEN_KEY);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as { accessToken?: unknown; expiresAt?: unknown };
    if (typeof parsed.accessToken !== "string" || typeof parsed.expiresAt !== "string") return undefined;
    const expiresAt = Date.parse(parsed.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return undefined;
    return { token: parsed.accessToken, expiresAt };
  } catch {
    return undefined;
  }
}
