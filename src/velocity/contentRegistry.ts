// Velocity-ops content registry.
//
// Exposes the lifted velocity-ops prose (phases, templates, agents,
// workflows) as a typed catalog atl-mcp's M4–M9 tools consume at runtime.
// Source of truth lives at docs/velocity-ops-content/ — see that
// directory's README for the layout.
//
// Files are read on demand (small enough to read per request; ~200 KB
// total). A lazy in-memory cache keeps repeated lookups fast.

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

// Resolves to <repo>/docs/velocity-ops-content in dev and
// <pkg>/dist/docs/velocity-ops-content in prod after copy-runtime-assets runs.
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const CONTENT_ROOT = firstExistingPath([
  resolve(MODULE_DIR, "../docs/velocity-ops-content"),
  resolve(MODULE_DIR, "../../docs/velocity-ops-content"),
]);

export type VelocityPhaseSlug =
  | "01-intake"
  | "02-discovery"
  | "03-scoping"
  | "05-setup"
  | "06-architecture"
  | "09-handoff";

export type VelocityTemplateSlug =
  | "api-standards"
  | "architecture-decision"
  | "common-tasks-runbook"
  | "contributing"
  | "feature-spec"
  | "framework-waivers"
  | "git-branching"
  | "incident-response"
  | "prd"
  | "project-brief"
  | "requirements-catalog"
  | "runbook"
  | "session-handoff"
  | "slo-definition"
  | "task-spec"
  | "threat-model";

export type VelocityAgentSlug =
  | "architect"
  | "critic"
  | "docs"
  | "guardrails-sentinel"
  | "implementer"
  | "judge"
  | "ops"
  | "post-incident"
  | "researcher"
  | "reviewer"
  | "tdd-coach"
  | "tester"
  | "thinking-partner";

export type VelocityWorkflowSlug =
  | "decision-flow"
  | "deploy-flow"
  | "feature-flow"
  | "incident-flow"
  | "multi-agent-flow"
  | "session-handoff"
  | "tdd-flow";

export type VelocityModuleSlug =
  | "assumption-check"
  | "astro-5"
  | "conversation-guardrails"
  | "drizzle-orm"
  | "fast-check"
  | "fastapi"
  | "firebase"
  | "flutter"
  | "guardrails"
  | "hono-cloudflare-workers"
  | "kafka"
  | "kong-gateway"
  | "layercake-uplot"
  | "lessons-learned"
  | "lstm-gru"
  | "maplibre-gl"
  | "mcp-development"
  | "mcp-governance"
  | "nextjs-15"
  | "nodejs-runtime"
  | "postgis"
  | "postgresql"
  | "prettier"
  | "production-hardening"
  | "python"
  | "react-web"
  | "runtime-contracts"
  | "stripe-billing"
  | "sveltekit"
  | "tailwind-shadcn"
  | "tailwind-v4"
  | "thinking-partner"
  | "timescaledb"
  | "trpc-v11"
  | "typescript-strict"
  | "vitest"
  | "xgboost-lightgbm"
  | "zod";

export const VELOCITY_PHASES: readonly VelocityPhaseSlug[] = [
  "01-intake", "02-discovery", "03-scoping", "05-setup", "06-architecture", "09-handoff",
] as const;

export const VELOCITY_TEMPLATES: readonly VelocityTemplateSlug[] = [
  "api-standards", "architecture-decision", "common-tasks-runbook", "contributing",
  "feature-spec", "framework-waivers", "git-branching", "incident-response",
  "prd", "project-brief", "requirements-catalog", "runbook", "session-handoff",
  "slo-definition", "task-spec", "threat-model",
] as const;

export const VELOCITY_AGENTS: readonly VelocityAgentSlug[] = [
  "architect", "critic", "docs", "guardrails-sentinel", "implementer", "judge",
  "ops", "post-incident", "researcher", "reviewer", "tdd-coach", "tester",
  "thinking-partner",
] as const;

export const VELOCITY_WORKFLOWS: readonly VelocityWorkflowSlug[] = [
  "decision-flow", "deploy-flow", "feature-flow", "incident-flow",
  "multi-agent-flow", "session-handoff", "tdd-flow",
] as const;

export const VELOCITY_MODULES: readonly VelocityModuleSlug[] = [
  "assumption-check", "astro-5", "conversation-guardrails", "drizzle-orm",
  "fast-check", "fastapi", "firebase", "flutter", "guardrails",
  "hono-cloudflare-workers", "kafka", "kong-gateway", "layercake-uplot",
  "lessons-learned", "lstm-gru", "maplibre-gl", "mcp-development",
  "mcp-governance", "nextjs-15", "nodejs-runtime", "postgis", "postgresql",
  "prettier", "production-hardening", "python", "react-web",
  "runtime-contracts", "stripe-billing", "sveltekit", "tailwind-shadcn",
  "tailwind-v4", "thinking-partner", "timescaledb", "trpc-v11",
  "typescript-strict", "vitest", "xgboost-lightgbm", "zod",
] as const;

export interface VelocityContentRegistry {
  readPhase(slug: VelocityPhaseSlug): Promise<string>;
  readTemplate(slug: VelocityTemplateSlug): Promise<string>;
  readAgent(slug: VelocityAgentSlug): Promise<string>;
  readWorkflow(slug: VelocityWorkflowSlug): Promise<string>;
  readModule(slug: VelocityModuleSlug): Promise<string>;
  /** All slugs by category, useful for catalog views and tests. */
  manifest(): VelocityContentManifest;
}

export interface VelocityContentManifest {
  readonly phases: readonly VelocityPhaseSlug[];
  readonly templates: readonly VelocityTemplateSlug[];
  readonly agents: readonly VelocityAgentSlug[];
  readonly workflows: readonly VelocityWorkflowSlug[];
  readonly modules: readonly VelocityModuleSlug[];
  readonly contentRoot: string;
}

type ContentCategory = "phases" | "templates" | "agents" | "workflows" | "modules";

export function createVelocityContentRegistry(): VelocityContentRegistry {
  const cache = new Map<string, string>();

  async function read(category: ContentCategory, slug: string): Promise<string> {
    assertKnownSlug(category, slug);
    const key = `${category}/${slug}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const path = join(CONTENT_ROOT, category, `${slug}.md`);
    const content = await readFile(path, "utf8");
    cache.set(key, content);
    return content;
  }

  return {
    async readPhase(slug) { return read("phases", slug); },
    async readTemplate(slug) { return read("templates", slug); },
    async readAgent(slug) { return read("agents", slug); },
    async readWorkflow(slug) { return read("workflows", slug); },
    async readModule(slug) { return read("modules", slug); },
    manifest() {
      return {
        phases: VELOCITY_PHASES,
        templates: VELOCITY_TEMPLATES,
        agents: VELOCITY_AGENTS,
        workflows: VELOCITY_WORKFLOWS,
        modules: VELOCITY_MODULES,
        contentRoot: CONTENT_ROOT,
      };
    },
  };
}

function assertKnownSlug(category: ContentCategory, slug: string): void {
  if (!knownSlugs(category).includes(slug)) {
    throw new Error(`unknown ${categoryLabel(category)} slug: ${slug}`);
  }
}

function knownSlugs(category: ContentCategory): readonly string[] {
  switch (category) {
    case "phases": return VELOCITY_PHASES;
    case "templates": return VELOCITY_TEMPLATES;
    case "agents": return VELOCITY_AGENTS;
    case "workflows": return VELOCITY_WORKFLOWS;
    case "modules": return VELOCITY_MODULES;
  }
}

function categoryLabel(category: ContentCategory): string {
  switch (category) {
    case "phases": return "phase";
    case "templates": return "template";
    case "agents": return "agent";
    case "workflows": return "workflow";
    case "modules": return "module";
  }
}

function firstExistingPath(candidates: readonly string[]): string {
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0] ?? "";
}
