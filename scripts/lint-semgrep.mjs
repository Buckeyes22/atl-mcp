#!/usr/bin/env node
// lint:semgrep — runs semgrep against atl-mcp's stub-detection ruleset.
//
// If semgrep isn't installed, prints install instructions and exits 0
// (warn-only) so this script doesn't block local dev for engineers who
// haven't installed it. CI installs semgrep explicitly via the official
// GitHub Action (returntocorp/semgrep-action).
//
// The ruleset lives at semgrep/stub-detection.yml and was lifted from
// velocity-ops-engine per docs/velocity-ops-port-plan.md (Phase 0.2).

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const RULESET = join(ROOT, "semgrep", "stub-detection.yml");
const SCAN_DIRS = ["src", "scripts"];

function which(cmd) {
  const probe = spawnSync(process.platform === "win32" ? "where" : "which", [cmd], { encoding: "utf8" });
  return probe.status === 0 && probe.stdout.trim().length > 0;
}

function main() {
  if (!existsSync(RULESET)) {
    process.stderr.write(`semgrep ruleset missing at ${RULESET}\n`);
    process.exit(1);
  }

  if (!which("semgrep")) {
    process.stdout.write(
      [
        "lint:semgrep — semgrep binary not found on PATH; skipping local scan.",
        "",
        "Install:",
        "  pip install semgrep         # easiest on Windows + Linux",
        "  brew install semgrep        # macOS",
        "  uv tool install semgrep     # if uv is on the path (it is here)",
        "",
        "CI runs semgrep via the official GitHub Action; this is a local convenience.",
        "",
      ].join("\n"),
    );
    process.exit(0);
  }

  const args = ["--config", RULESET, "--error", "--quiet", ...SCAN_DIRS];
  const result = spawnSync("semgrep", args, { stdio: "inherit" });
  process.exit(result.status ?? 1);
}

main();
