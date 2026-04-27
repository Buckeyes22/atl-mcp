// F-012 closure: per-host emitter that composes AGENTS.md + a host addendum,
// rather than overwriting hand-authored CLAUDE.md / Cursor / Codex / Copilot
// configs verbatim.
//
// Refusal guard: if the destination file exists and does NOT carry the
// auto-generated marker as its first content line, the emitter refuses to
// overwrite. Operators move the hand-authored content into
// docs/host-addenda/<host>.md, then re-run.

import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { dirname, join } from "node:path";

export const MARKER = "<!-- AUTO-GENERATED FROM AGENTS.md + docs/host-addenda — DO NOT EDIT BY HAND -->";

export interface HostTarget {
  readonly host: "claude" | "codex" | "cursor" | "copilot";
  readonly addendumPath: string;
  readonly outputPath: string;
}

export const DEFAULT_TARGETS: readonly HostTarget[] = [
  { host: "claude", addendumPath: "docs/host-addenda/claude.md", outputPath: "CLAUDE.md" },
  { host: "codex", addendumPath: "docs/host-addenda/codex.md", outputPath: ".agents/codex.md" },
  { host: "cursor", addendumPath: "docs/host-addenda/cursor.md", outputPath: ".agents/cursor.md" },
  { host: "copilot", addendumPath: "docs/host-addenda/copilot.md", outputPath: ".agents/copilot.md" },
];

export async function syncAgentConfigs(repoDir: string, targets: readonly HostTarget[] = DEFAULT_TARGETS): Promise<void> {
  const agents = await readFile(join(repoDir, "AGENTS.md"), "utf8");
  for (const target of targets) {
    const addendum = await readAddendum(join(repoDir, target.addendumPath));
    const composed = compose(agents, addendum);
    await assertSafeToWrite(join(repoDir, target.outputPath));
    await mkdir(dirname(join(repoDir, target.outputPath)), { recursive: true });
    await writeFile(join(repoDir, target.outputPath), composed, "utf8");
  }
}

async function readAddendum(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw err;
  }
}

function compose(agents: string, addendum: string): string {
  const trimmedAddendum = addendum.trim();
  const sections = [MARKER, "", agents.trim()];
  if (trimmedAddendum.length > 0) {
    sections.push("", "---", "", trimmedAddendum);
  }
  return sections.join("\n") + "\n";
}

async function assertSafeToWrite(path: string): Promise<void> {
  try {
    await access(path);
  } catch {
    return; // File doesn't exist — safe to write.
  }
  const existing = await readFile(path, "utf8");
  const firstNonEmptyLine = existing.split("\n").find((l) => l.trim().length > 0)?.trim() ?? "";
  if (firstNonEmptyLine !== MARKER) {
    throw new Error(
      `${path} appears hand-authored (first non-empty line: "${firstNonEmptyLine.slice(0, 80)}").\n` +
      `Move its content into the corresponding docs/host-addenda/<host>.md file, then re-run.\n` +
      `See F-012 in docs/audit-findings-2026-04-25.md.`,
    );
  }
}

async function main(): Promise<void> {
  await syncAgentConfigs(process.cwd());
  for (const target of DEFAULT_TARGETS) {
    process.stdout.write(`wrote ${target.outputPath}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}` || import.meta.url.endsWith(process.argv[1] ?? "")) {
  main().catch((err) => {
    process.stderr.write(`sync agent configs failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exit(1);
  });
}
