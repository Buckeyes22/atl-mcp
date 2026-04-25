// Per-session git worktree manager (agent-maestro F-064).
//
// For each session, acquires a fresh worktree at:
//   <worktreesRoot>/<sessionId>
// on a new branch:
//   orchestrator/<sessionId>
// based on a configurable base ref (default: the repo's HEAD).
//
// release() removes the worktree directory AND prunes the git worktree entry.
// The branch is left intact (M6c may push it; cleanup of merged/abandoned
// branches is post-v1).
//
// Implementation: shells out to `git` via child_process.execFile. No shell
// interpolation — all args passed array-style.
//
// POSIX + Windows: git worktrees work identically on both. The path uses
// node:path so separators are platform-correct.

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { join, resolve as resolvePath, sep as pathSep } from "node:path";
import { promisify } from "node:util";
import type { Logger } from "pino";

const execFileP = promisify(execFile);

export interface WorktreeManagerConfig {
  /** Path to the source repo (i.e., the repo we're creating worktrees of). */
  readonly sourceRepoPath: string;
  /** Where to create worktree directories (one subdir per session). */
  readonly worktreesRoot: string;
  /** Branch namespace prefix; final branch = `${branchPrefix}${sessionId}`. */
  readonly branchPrefix?: string;
  readonly logger: Logger;
  /** Optional override for the git executable. */
  readonly gitBin?: string;
}

export interface WorktreeHandle {
  readonly sessionId: string;
  readonly path: string;       // absolute path to the worktree dir
  readonly branch: string;
  readonly baseRef: string;
  readonly createdAt: string;
}

export interface WorktreeManager {
  /**
   * Create a new worktree for the session. If a worktree already exists for
   * this sessionId, returns the existing handle (idempotent acquire).
   */
  acquire(sessionId: string, baseRef?: string): Promise<WorktreeHandle>;
  /** Remove the worktree directory + prune the git worktree entry. */
  release(sessionId: string): Promise<void>;
  /** List all currently-acquired worktrees. */
  list(): Promise<readonly WorktreeHandle[]>;
}

export function createWorktreeManager(config: WorktreeManagerConfig): WorktreeManager {
  const sourceRepo = resolvePath(config.sourceRepoPath);
  const root = resolvePath(config.worktreesRoot);
  const prefix = config.branchPrefix ?? "orchestrator/";
  const git = config.gitBin ?? "git";
  const logger = config.logger;

  // In-memory tracker. Survives the process; on restart we reconcile from
  // `git worktree list` to rebuild the tracker.
  const handles = new Map<string, WorktreeHandle>();

  async function reconcileFromGit(): Promise<void> {
    if (handles.size > 0) return;
    try {
      const { stdout } = await execFileP(git, ["-C", sourceRepo, "worktree", "list", "--porcelain"]);
      const blocks = stdout.split(/\r?\n\r?\n/);
      for (const block of blocks) {
        const wt = parseWorktreePorcelain(block);
        if (!wt) continue;
        const sessionId = sessionIdFromBranch(wt.branch, prefix);
        if (!sessionId) continue;
        handles.set(sessionId, {
          sessionId,
          path: wt.worktree,
          branch: wt.branch,
          baseRef: wt.head,
          createdAt: new Date().toISOString(), // unknown; approximate
        });
      }
    } catch (err) {
      logger.debug({ err }, "worktree reconcile skipped (git list failed)");
    }
  }

  return {
    async acquire(sessionId, baseRef): Promise<WorktreeHandle> {
      assertSafeSessionId(sessionId);
      await reconcileFromGit();

      const existing = handles.get(sessionId);
      if (existing) return existing;

      // Resolve baseRef. When omitted, use repo HEAD.
      const resolvedBase = baseRef ?? (await getCurrentHeadSha(git, sourceRepo));
      const branch = `${prefix}${sessionId}`;
      const wtPath = join(root, sessionId);

      await mkdir(root, { recursive: true });
      // Refuse to overwrite a non-empty pre-existing dir.
      try {
        const s = await stat(wtPath);
        if (s.isDirectory()) {
          throw new WorktreeExistsError(`worktree dir already exists at ${wtPath}; release() it first`);
        }
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      }

      // git worktree add -b <branch> <path> <base-ref>
      try {
        await execFileP(git, [
          "-C",
          sourceRepo,
          "worktree",
          "add",
          "-b",
          branch,
          wtPath,
          resolvedBase,
        ]);
      } catch (err) {
        // If the branch already exists (re-acquire after partial failure), retry without -b.
        const stderr = (err as { stderr?: string }).stderr ?? "";
        if (stderr.includes("already exists")) {
          await execFileP(git, ["-C", sourceRepo, "worktree", "add", wtPath, branch]);
        } else {
          throw new WorktreeError(`git worktree add failed: ${stderr || (err as Error).message}`, { cause: err });
        }
      }

      const handle: WorktreeHandle = {
        sessionId,
        path: wtPath,
        branch,
        baseRef: resolvedBase,
        createdAt: new Date().toISOString(),
      };
      handles.set(sessionId, handle);
      logger.info({ sessionId, branch, path: wtPath, baseRef: resolvedBase }, "worktree acquired");
      return handle;
    },

    async release(sessionId: string): Promise<void> {
      assertSafeSessionId(sessionId);
      const handle = handles.get(sessionId);
      const wtPath = handle?.path ?? join(root, sessionId);

      // git worktree remove --force <path>
      try {
        await execFileP(git, ["-C", sourceRepo, "worktree", "remove", "--force", wtPath]);
      } catch (err) {
        // If the entry is already gone, fall through to manual cleanup.
        logger.debug({ err, sessionId }, "git worktree remove non-fatal failure; cleaning up directory directly");
      }
      // Defensive cleanup in case `git worktree remove` left the dir behind.
      try {
        await rm(wtPath, { recursive: true, force: true });
      } catch (err) {
        logger.warn({ err, wtPath }, "worktree directory cleanup failed");
      }
      // Prune dangling worktree metadata.
      try {
        await execFileP(git, ["-C", sourceRepo, "worktree", "prune"]);
      } catch (err) {
        logger.debug({ err }, "git worktree prune non-fatal failure");
      }
      handles.delete(sessionId);
      logger.info({ sessionId }, "worktree released");
    },

    async list(): Promise<readonly WorktreeHandle[]> {
      await reconcileFromGit();
      return [...handles.values()];
    },
  };
}

// ----- Helpers -----

async function getCurrentHeadSha(git: string, repo: string): Promise<string> {
  const { stdout } = await execFileP(git, ["-C", repo, "rev-parse", "HEAD"]);
  return stdout.trim();
}

interface ParsedWorktree {
  readonly worktree: string;
  readonly head: string;
  readonly branch: string;
}

function parseWorktreePorcelain(block: string): ParsedWorktree | undefined {
  let worktree = "";
  let head = "";
  let branch = "";
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("worktree ")) worktree = line.slice("worktree ".length).trim();
    else if (line.startsWith("HEAD ")) head = line.slice("HEAD ".length).trim();
    else if (line.startsWith("branch ")) branch = line.slice("branch ".length).trim();
  }
  if (!worktree || !branch) return undefined;
  // `branch` is in form `refs/heads/<name>`; strip the prefix.
  const name = branch.startsWith("refs/heads/") ? branch.slice("refs/heads/".length) : branch;
  return { worktree, head, branch: name };
}

function sessionIdFromBranch(branch: string, prefix: string): string | undefined {
  if (!branch.startsWith(prefix)) return undefined;
  return branch.slice(prefix.length);
}

/**
 * Refuse session ids that contain anything that could escape the worktree
 * directory, branch name, or shell. We allow [A-Za-z0-9._-]; UUIDs and
 * timestamps fit easily.
 */
function assertSafeSessionId(sessionId: string): void {
  if (sessionId.length === 0 || sessionId.length > 128) {
    throw new InvalidSessionIdError(`sessionId must be 1..128 chars, got len=${sessionId.length}`);
  }
  if (!/^[A-Za-z0-9._-]+$/.test(sessionId)) {
    throw new InvalidSessionIdError(`sessionId must match [A-Za-z0-9._-]+; got: ${sessionId}`);
  }
  if (sessionId.includes("..") || sessionId.includes(pathSep)) {
    throw new InvalidSessionIdError(`sessionId must not contain '..' or path separators`);
  }
}

export class WorktreeError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "WorktreeError";
  }
}
export class WorktreeExistsError extends WorktreeError {
  constructor(message: string) {
    super(message);
    this.name = "WorktreeExistsError";
  }
}
export class InvalidSessionIdError extends WorktreeError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSessionIdError";
  }
}

// `fs.promises.access` exists; explicit re-export to keep this file's imports tidy.
void fs;
