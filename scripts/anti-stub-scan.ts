// F-015 closure: the anti-stub scanner CLI.
// Usage: npm run lint:anti-stub
// Walks src/ + scripts/ and reports stub-shaped patterns. Exits non-zero on
// any violation.

import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { scanAntiStubPatterns } from "../src/security/antiStubScanner.js";

const ROOTS = ["src", "scripts"];

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir)) {
    const path = join(dir, entry);
    const s = await stat(path);
    if (s.isDirectory()) yield* walk(path);
    else if (path.endsWith(".ts")) yield path;
  }
}

async function main(): Promise<void> {
  let failures = 0;
  for (const root of ROOTS) {
    for await (const path of walk(root)) {
      const source = await readFile(path, "utf8");
      const result = scanAntiStubPatterns(source);
      for (const v of result.violations) {
        failures += 1;
        process.stderr.write(`${path}: ${v.code}: ${v.message}\n`);
      }
    }
  }
  if (failures > 0) {
    process.stderr.write(`\nanti-stub scan failed with ${failures} violation(s)\n`);
    process.exit(1);
  }
  process.stdout.write("anti-stub scan OK: 0 violations\n");
}

main().catch((err) => {
  process.stderr.write(`anti-stub scan failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
