#!/usr/bin/env node
// CLI entrypoint for the F-031 invariant check (also enforced as a vitest test).
// Usage: pnpm lint:no-stdout
// Exits non-zero with a printable diff if any src/ file writes to stdout.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN = [
  "console.log",
  "console.info",
  "console.warn",
  "console.error",
  "console.debug",
  "process.stdout.write",
];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) yield full;
  }
}

const violations = [];
for (const file of walk("src")) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
    for (const pattern of FORBIDDEN) {
      if (line.includes(pattern)) {
        violations.push(`${file.replace(/\\/g, "/")}:${i + 1}: ${trimmed}`);
      }
    }
  });
}

if (violations.length > 0) {
  // We're a CLI lint tool — writing to stderr here is acceptable (we are
  // protecting *runtime* code, not lint code).
  process.stderr.write(
    `F-031 violation: ${violations.length} forbidden stdout-writing call(s) in src/:\n` +
      violations.map((v) => `  ${v}`).join("\n") +
      "\nUse the pino file logger (see docs/partners/simple-commands-mcp.md §7).\n",
  );
  process.exit(1);
}
process.stderr.write("F-031 invariant OK: 0 forbidden stdout-writing calls in src/.\n");
process.exit(0);
