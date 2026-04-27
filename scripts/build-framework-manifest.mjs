#!/usr/bin/env node
// build-framework-manifest.mjs — emits .framework-manifest.json.
//
// The manifest is a machine-readable file catalog with SHA256, size, and
// category per file. Categories let later tooling distinguish files that
// are operator-authored (manual-merge — never overwrite without review)
// from files that are emitted by atl-mcp itself (auto-update — fine to
// regenerate). Pattern lifted from velocity-ops-engine per
// docs/velocity-ops-port-plan.md (Phase 0.4).
//
// Categories:
//   manual-merge  — operator-authored prose / config; never auto-overwrite.
//   auto-update   — emitted by atl-mcp tools (build artifacts, generated docs);
//                   safe to regenerate.
//   seed-only     — written once and rarely touched (LICENSE, .gitignore, env templates).
//
// Run: npm run manifest:build

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, sep } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// Skip these directories entirely.
const SKIP_DIRS = new Set([
  "node_modules", "dist", ".git", ".husky/_", "orchestrator.log",
  ".claude/projects", "tmp", "coverage",
]);

// File-extension → category. The default for unmatched files is "seed-only".
function categorize(relPath) {
  const lower = relPath.toLowerCase();

  // auto-update: emitted by atl-mcp's build / scripts.
  if (lower.startsWith("dist" + sep)) return "auto-update";
  if (lower === ".framework-manifest.json") return "auto-update";

  // manual-merge: operator-authored prose, configs, source.
  if (lower.endsWith(".ts") || lower.endsWith(".tsx") || lower.endsWith(".jsx")) return "manual-merge";
  if (lower.endsWith(".md")) return "manual-merge";
  if (lower.endsWith(".html") || lower.endsWith(".css")) return "manual-merge";
  if (lower.endsWith(".sql")) return "manual-merge";
  if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) return "manual-merge";
  if (lower.endsWith(".sh")) return "manual-merge";
  if (lower === "package.json" || lower === "tsconfig.json" || lower === "vitest.config.ts") return "manual-merge";

  // seed-only: write-once support files.
  if (lower === ".env.example" || lower === ".gitignore" || lower === ".dockerignore" || lower === ".editorconfig") return "seed-only";
  if (lower.endsWith(".lock") || lower === "package-lock.json") return "seed-only";
  if (lower.endsWith(".json")) return "seed-only";
  if (lower.endsWith(".yml") || lower.endsWith(".yaml")) return "seed-only";

  return "seed-only";
}

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    const rel = relative(ROOT, full).replaceAll("\\", "/");
    if (SKIP_DIRS.has(entry.name) || rel.split("/").some((part) => SKIP_DIRS.has(part))) continue;
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield { full, rel };
  }
}

async function sha256OfFile(path) {
  const buf = await readFile(path);
  const hash = createHash("sha256");
  hash.update(buf);
  return hash.digest("hex");
}

async function main() {
  const files = {};
  const counts = { "manual-merge": 0, "auto-update": 0, "seed-only": 0 };
  let total = 0;
  for await (const { full, rel } of walk(ROOT)) {
    const s = await stat(full);
    const sha = await sha256OfFile(full);
    const cat = categorize(rel);
    files[rel] = { sha256: sha, category: cat, size: s.size };
    counts[cat] += 1;
    total += 1;
  }
  // Stable sort by path for deterministic output.
  const sorted = Object.fromEntries(
    Object.entries(files).sort(([a], [b]) => a.localeCompare(b)),
  );
  const manifest = {
    version: "1.0.0",
    generated: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
    file_count: total,
    categories: counts,
    files: sorted,
  };
  const out = join(ROOT, ".framework-manifest.json");
  await writeFile(out, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  // Use stderr for the status line so this script can be piped silently if needed.
  process.stderr.write(
    `[manifest] wrote ${total} files (${counts["manual-merge"]} manual-merge, ${counts["auto-update"]} auto-update, ${counts["seed-only"]} seed-only) to ${relative(ROOT, out)}\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`build-framework-manifest failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
