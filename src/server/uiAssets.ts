// Static-asset host for the operator control plane UI (docs/control-plane/).
// Mounted on the mgmt API Hono app at /ui/* per ADR 0006.
//
// Resolves the asset directory relative to this module's source location so
// the same code works in dev (tsx watching src/) and prod (built dist/) once
// scripts/copy-runtime-assets.mjs mirrors docs/control-plane/ into the
// matching dist path.

import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, sep } from "node:path";
import type { Hono } from "hono";
import type { Logger } from "pino";

// In dev, assets live at <repo>/docs/control-plane.
// In prod, copy-runtime-assets.mjs mirrors them to <pkg>/dist/docs/control-plane.
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const CONTROL_PLANE_DIR = firstExistingPath([
  resolve(MODULE_DIR, "../docs/control-plane"),
  resolve(MODULE_DIR, "../../docs/control-plane"),
]);

const MIME_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jsx": "text/babel; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function mimeFor(path: string): string {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return "application/octet-stream";
  return MIME_TYPES[path.slice(dot).toLowerCase()] ?? "application/octet-stream";
}

function safeJoin(base: string, requested: string): string | undefined {
  const cleaned = decodeURIComponent((requested.split("?")[0] ?? "").replace(/[\\]/g, "/"));
  if (cleaned.includes("\0") || cleaned.includes("..")) return undefined;
  const trimmed = cleaned.startsWith("/") ? cleaned.slice(1) : cleaned;
  const joined = resolve(base, trimmed);
  if (!joined.startsWith(base)) return undefined;
  return joined;
}

async function serveFile(baseDir: string, requestedPath: string, c: import("hono").Context): Promise<Response> {
  const fullPath = safeJoin(baseDir, requestedPath);
  if (!fullPath) return c.text("not found", 404);
  try {
    const s = await stat(fullPath);
    if (s.isDirectory()) {
      const idx = safeJoin(fullPath, "index.html");
      if (!idx) return c.text("not found", 404);
      const buf = await readFile(idx);
      return c.body(new Uint8Array(buf), 200, { "Content-Type": "text/html; charset=utf-8" });
    }
    const buf = await readFile(fullPath);
    return c.body(new Uint8Array(buf), 200, { "Content-Type": mimeFor(fullPath) });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return c.text("not found", 404);
    throw err;
  }
}

export function mountControlPlaneUI(app: Hono, logger: Logger): void {
  const baseDir = CONTROL_PLANE_DIR.endsWith(sep) ? CONTROL_PLANE_DIR : CONTROL_PLANE_DIR + sep;

  app.get("/ui", (c) => c.redirect("/ui/", 302));
  app.get("/ui/", (c) => serveFile(baseDir, "/index.html", c));
  app.get("/ui/*", (c) => {
    const requested = c.req.path.slice("/ui".length);
    return serveFile(baseDir, requested === "" ? "/index.html" : requested, c);
  });

  logger.info({ uiDir: baseDir }, "operator control plane UI mounted at /ui/");
}

function firstExistingPath(candidates: readonly string[]): string {
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0] ?? "";
}
