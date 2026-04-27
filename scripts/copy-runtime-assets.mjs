#!/usr/bin/env node
import { cp, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

async function main() {
  // SQL migrations live next to the storage runner.
  await copyTree(
    join(ROOT, "src", "storage", "migrations"),
    join(ROOT, "dist", "storage", "migrations"),
  );

  // Operator control plane assets (ADR 0006). The runtime resolves the UI
  // directory relative to src/server/uiAssets.{ts,js}: in dev that's
  // <repo>/docs/control-plane/, in prod that's <pkg>/dist/docs/control-plane/.
  await copyTree(
    join(ROOT, "docs", "control-plane"),
    join(ROOT, "dist", "docs", "control-plane"),
  );

  // Velocity-ops content (phases, templates, agents, workflows) consumed
  // by M4–M9 tools at runtime. Resolved relative to
  // src/velocity/contentRegistry.{ts,js}.
  await copyTree(
    join(ROOT, "docs", "velocity-ops-content"),
    join(ROOT, "dist", "docs", "velocity-ops-content"),
  );
}

async function copyTree(from, to) {
  await mkdir(to, { recursive: true });
  await cp(from, to, { recursive: true, force: true });
}

main().catch((err) => {
  process.stderr.write(`copy-runtime-assets failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
