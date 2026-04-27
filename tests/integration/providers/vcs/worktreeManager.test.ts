// Real-git tests for the worktree manager.
// Spins up a tmp git repo, exercises acquire/release on it.

import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pino } from "pino";
import {
  createWorktreeManager,
  InvalidSessionIdError,
  WorktreeExistsError,
} from "../../../../src/providers/vcs/worktreeManager.js";

const execFileP = promisify(execFile);
const silentLogger = pino({ level: "silent" });

async function setupRepo(): Promise<{ repoPath: string; worktreesRoot: string; cleanup: () => Promise<void> }> {
  const root = await mkdtemp(join(tmpdir(), "atl-mcp-wt-"));
  const repoPath = join(root, "src-repo");
  const worktreesRoot = join(root, "worktrees");
  await execFileP("git", ["init", "--initial-branch=main", repoPath]);
  // Configure user so commits succeed in CI (no global config required).
  await execFileP("git", ["-C", repoPath, "config", "user.email", "test@example.com"]);
  await execFileP("git", ["-C", repoPath, "config", "user.name", "Test"]);
  // Seed one commit so HEAD resolves.
  await execFileP("git", ["-C", repoPath, "commit", "--allow-empty", "-m", "init"]);
  return {
    repoPath,
    worktreesRoot,
    cleanup: async () => {
      await rm(root, { recursive: true, force: true });
    },
  };
}

describe("worktreeManager", () => {
  let repo: Awaited<ReturnType<typeof setupRepo>>;
  beforeEach(async () => {
    repo = await setupRepo();
  });
  afterEach(async () => {
    await repo.cleanup();
  });

  it("acquires a worktree on orchestrator/<sessionId> branch", async () => {
    const mgr = createWorktreeManager({
      sourceRepoPath: repo.repoPath,
      worktreesRoot: repo.worktreesRoot,
      logger: silentLogger,
    });
    const handle = await mgr.acquire("session-abc");
    expect(handle.sessionId).toBe("session-abc");
    expect(handle.branch).toBe("orchestrator/session-abc");
    expect(handle.path).toContain("session-abc");

    // Verify the worktree dir + branch actually exist.
    const { stdout } = await execFileP("git", ["-C", repo.repoPath, "branch", "--list", "orchestrator/session-abc"]);
    expect(stdout.trim()).toContain("orchestrator/session-abc");
  });

  it("acquire is idempotent — repeat returns the same handle", async () => {
    const mgr = createWorktreeManager({
      sourceRepoPath: repo.repoPath,
      worktreesRoot: repo.worktreesRoot,
      logger: silentLogger,
    });
    const a = await mgr.acquire("idem");
    const b = await mgr.acquire("idem");
    expect(b.path).toBe(a.path);
    expect(b.branch).toBe(a.branch);
  });

  it("release removes the worktree dir and prunes git state", async () => {
    const mgr = createWorktreeManager({
      sourceRepoPath: repo.repoPath,
      worktreesRoot: repo.worktreesRoot,
      logger: silentLogger,
    });
    const handle = await mgr.acquire("rel-1");
    await mgr.release("rel-1");

    // Worktree dir should be gone.
    await expect(
      execFileP("git", ["-C", repo.repoPath, "worktree", "list", "--porcelain"]),
    ).resolves.toMatchObject({});
    const { stdout } = await execFileP("git", [
      "-C",
      repo.repoPath,
      "worktree",
      "list",
      "--porcelain",
    ]);
    expect(stdout).not.toContain(handle.path);
  });

  it("multiple sessions are independent", async () => {
    const mgr = createWorktreeManager({
      sourceRepoPath: repo.repoPath,
      worktreesRoot: repo.worktreesRoot,
      logger: silentLogger,
    });
    const a = await mgr.acquire("s-a");
    const b = await mgr.acquire("s-b");
    expect(a.path).not.toBe(b.path);
    expect(a.branch).not.toBe(b.branch);
    const list = await mgr.list();
    expect(list.length).toBe(2);
  });

  it("rejects unsafe session ids", async () => {
    const mgr = createWorktreeManager({
      sourceRepoPath: repo.repoPath,
      worktreesRoot: repo.worktreesRoot,
      logger: silentLogger,
    });
    await expect(mgr.acquire("../escape")).rejects.toThrow(InvalidSessionIdError);
    await expect(mgr.acquire("with space")).rejects.toThrow(InvalidSessionIdError);
    await expect(mgr.acquire("")).rejects.toThrow(InvalidSessionIdError);
  });

  it("custom branchPrefix works", async () => {
    const mgr = createWorktreeManager({
      sourceRepoPath: repo.repoPath,
      worktreesRoot: repo.worktreesRoot,
      branchPrefix: "agent/",
      logger: silentLogger,
    });
    const h = await mgr.acquire("p1");
    expect(h.branch).toBe("agent/p1");
  });

  it("acquire fails cleanly when worktree dir already exists with content", async () => {
    const mgr = createWorktreeManager({
      sourceRepoPath: repo.repoPath,
      worktreesRoot: repo.worktreesRoot,
      logger: silentLogger,
    });
    // Pre-create the dir externally with a stray file.
    const { mkdir, writeFile } = await import("node:fs/promises");
    const collidePath = join(repo.worktreesRoot, "collide");
    await mkdir(collidePath, { recursive: true });
    await writeFile(join(collidePath, "stray.txt"), "x");

    await expect(mgr.acquire("collide")).rejects.toThrow(WorktreeExistsError);
  });
});
