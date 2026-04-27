// F-012 closure: syncAgentConfigs refuses to overwrite hand-authored content
// and composes AGENTS.md + per-host addenda correctly.

import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, writeFile, mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { syncAgentConfigs, MARKER } from "../../../scripts/syncAgentConfigs.js";

async function setupRepo(handAuthoredClaude: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "atl-mcp-sync-"));
  await writeFile(join(dir, "AGENTS.md"), "# AGENTS\n\nCanonical contract.\n");
  await mkdir(join(dir, "docs/host-addenda"), { recursive: true });
  await writeFile(join(dir, "docs/host-addenda/claude.md"), "# Claude addendum\n\nClaude-specific bits.\n");
  await writeFile(join(dir, "docs/host-addenda/codex.md"), "# Codex addendum\n");
  await writeFile(join(dir, "docs/host-addenda/cursor.md"), "# Cursor addendum\n");
  await writeFile(join(dir, "docs/host-addenda/copilot.md"), "# Copilot addendum\n");
  if (handAuthoredClaude) {
    await writeFile(join(dir, "CLAUDE.md"), handAuthoredClaude);
  }
  return dir;
}

describe("syncAgentConfigs (F-012)", () => {
  let dir: string | undefined;
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("refuses to overwrite a hand-authored CLAUDE.md", async () => {
    dir = await setupRepo("# Claude Code: orchestrator project guidance\n\nHand-authored.\n");
    await expect(syncAgentConfigs(dir)).rejects.toThrow(/appears hand-authored/i);
  });

  it("writes when destination has the auto-generated marker", async () => {
    dir = await setupRepo(`${MARKER}\n\n# stale content\n`);
    await syncAgentConfigs(dir);
    const out = await readFile(join(dir, "CLAUDE.md"), "utf8");
    expect(out.startsWith(MARKER)).toBe(true);
    expect(out).toContain("Canonical contract.");
    expect(out).toContain("Claude-specific bits.");
  });

  it("creates the file fresh when destination does not exist", async () => {
    dir = await setupRepo("");
    await syncAgentConfigs(dir);
    const out = await readFile(join(dir, "CLAUDE.md"), "utf8");
    expect(out.startsWith(MARKER)).toBe(true);
  });
});
