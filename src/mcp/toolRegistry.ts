// Central tool registry.
//
// MCP SDK only supports ONE handler per request schema. To allow multiple
// tool-providing modules (registerTools.ts for health, projectPreflight.ts
// for preflight, M5+ for provisioning, ...) to coexist, each module
// registers into this registry. buildServer.ts installs a single dispatcher
// that consults the registry.

import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export interface ToolEntry {
  readonly definition: Tool;
  readonly handler: ToolHandler;
}

export type ToolHandler = (
  params: unknown,
) => Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: unknown;
  isError?: boolean;
}>;

export interface ToolRegistry {
  register(entry: ToolEntry): void;
  list(): readonly Tool[];
  get(name: string): ToolHandler | undefined;
  /** Test-only — clear all registrations. */
  _reset(): void;
}

export function createToolRegistry(): ToolRegistry {
  const entries = new Map<string, ToolEntry>();
  return {
    register(entry: ToolEntry) {
      if (entries.has(entry.definition.name)) {
        throw new Error(`tool ${entry.definition.name} already registered`);
      }
      entries.set(entry.definition.name, entry);
    },
    list() {
      return [...entries.values()].map((e) => e.definition);
    },
    get(name: string) {
      return entries.get(name)?.handler;
    },
    _reset() {
      entries.clear();
    },
  };
}
