// CRITICAL: pino with FILE TRANSPORT ONLY.
// Stdio MCP servers send JSON-RPC frames over stdout. Any byte written to stdout
// outside the JSON-RPC frame corrupts the protocol stream and breaks the client.
// (simple-commands-mcp F-031 — see docs/partners/simple-commands-mcp.md §7)
//
// Do NOT add a Console transport. Do NOT use console.log/console.error anywhere.
// All diagnostic output goes through this logger; the logger writes to a file.

import pino, { type Logger } from "pino";
import type { OrchestratorConfig } from "../config.js";

let cached: Logger | undefined;

export function createLogger(config: OrchestratorConfig): Logger {
  if (cached) return cached;

  // Pino's destination(filepath) writes to a file descriptor opened on the path.
  // No Console transport is configured. No pretty-print in production paths.
  const dest = pino.destination({
    dest: config.logging.filePath,
    sync: false,
    mkdir: true,
  });

  cached = pino(
    {
      level: config.logging.level,
      base: {
        service: config.serverInfo.name,
        version: config.serverInfo.version,
        deploymentTier: config.deployment.tier,
        pid: process.pid,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ level: label }),
      },
    },
    dest,
  );

  return cached;
}

/** For testing only — resets the singleton so a fresh logger can be created. */
export function _resetLoggerForTests(): void {
  cached = undefined;
}
