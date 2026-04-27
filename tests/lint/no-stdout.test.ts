import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Enforces simple-commands-mcp F-031: stdio MCP servers must NEVER write to
// stdout (or stderr without consideration). All output goes through the pino
// file logger. console.log / console.error / process.stdout.write in src/
// is a hard fail.

const FORBIDDEN = [
  "console.log",
  "console.info",
  "console.warn",
  "console.error",
  "console.debug",
  "process.stdout.write",
];

// Allowlist: server.ts has a last-resort startup-failure path that uses
// require + writeFileSync (NOT stdout). It is allowed to import "node:fs"
// but must not introduce console.* calls.
const ALLOWED_FILES = new Set<string>([]);

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      yield* walk(full);
    } else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      yield full;
    }
  }
}

describe("F-031 invariant: no stdout writes from src/", () => {
  it("contains zero forbidden console.* / process.stdout.write calls", () => {
    const violations: Array<{ file: string; line: number; text: string }> = [];
    for (const file of walk("src")) {
      const relative = file.replace(/\\/g, "/");
      if (ALLOWED_FILES.has(relative)) continue;
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, i) => {
        // Skip line if it's a comment (starts with // or is inside /* ... */ on a single line)
        const trimmed = line.trim();
        if (trimmed.startsWith("//")) return;
        if (trimmed.startsWith("*")) return; // continuation of block comment
        for (const pattern of FORBIDDEN) {
          if (line.includes(pattern)) {
            violations.push({ file: relative, line: i + 1, text: line.trim() });
          }
        }
      });
    }

    if (violations.length > 0) {
      const formatted = violations
        .map((v) => `  ${v.file}:${v.line}: ${v.text}`)
        .join("\n");
      throw new Error(
        `Found ${violations.length} forbidden stdout-writing calls in src/. ` +
          `Use the pino file logger instead (see docs/partners/simple-commands-mcp.md §7 gotcha 1).\n${formatted}`,
      );
    }
    expect(violations).toHaveLength(0);
  });
});
