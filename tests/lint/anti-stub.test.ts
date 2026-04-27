// F-015 closure: anti-stub scanner runs as part of `npm test`.

import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

const execFileAsync = promisify(execFile);

describe("anti-stub invariant", () => {
  it("no new stub-shaped patterns in src/ or scripts/", async () => {
    const script = resolve(process.cwd(), "scripts/anti-stub-scan.ts");
    const result = await execFileAsync("npx", ["tsx", script], { cwd: process.cwd(), shell: true }).catch(
      (err: unknown) => {
        const stderr = (err as { stderr?: string }).stderr ?? "";
        const stdout = (err as { stdout?: string }).stdout ?? "";
        throw new Error(`anti-stub scan failed:\n${stdout}${stderr}`);
      },
    );
    expect(result.stdout).toMatch(/anti-stub scan OK/);
  }, 30_000);
});
