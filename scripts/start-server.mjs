#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const mode = process.argv[2] ?? "both";
const allowed = new Set(["stdio", "http", "both"]);

if (!allowed.has(mode)) {
  process.stderr.write(`Usage: node scripts/start-server.mjs [stdio|http|both]\n`);
  process.exit(2);
}

const args = [];
if (existsSync(join(ROOT, ".env"))) {
  args.push("--env-file=.env");
}
args.push("dist/server.js");

const child = spawn(process.execPath, args, {
  cwd: ROOT,
  env: { ...process.env, MCP_TRANSPORT: mode },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on("error", (err) => {
  process.stderr.write(`start-server failed: ${err.stack ?? err.message}\n`);
  process.exit(1);
});
