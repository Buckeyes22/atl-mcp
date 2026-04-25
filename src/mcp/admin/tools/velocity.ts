// admin.velocity.manifest.get / admin.velocity.content.read — operator UI
// access to the lifted velocity-ops content (phases, templates, agents,
// workflows). The Confluence executor (M6b) and VCS scaffolder (M6c) will
// consume the same registry; these admin tools let the operator browse
// the catalog from the control plane.

import { z } from "zod";
import {
  createVelocityContentRegistry,
  VELOCITY_AGENTS,
  VELOCITY_MODULES,
  VELOCITY_PHASES,
  VELOCITY_TEMPLATES,
  VELOCITY_WORKFLOWS,
  type VelocityAgentSlug,
  type VelocityModuleSlug,
  type VelocityPhaseSlug,
  type VelocityTemplateSlug,
  type VelocityWorkflowSlug,
} from "../../../velocity/contentRegistry.js";
import type { AdminToolDeps } from "../registry.js";
import type { ToolRegistry } from "../../toolRegistry.js";

const MANIFEST_OUTPUT = z.object({
  phases: z.array(z.string()),
  templates: z.array(z.string()),
  agents: z.array(z.string()),
  workflows: z.array(z.string()),
  modules: z.array(z.string()),
  contentRoot: z.string(),
  totalEntries: z.number().int().nonnegative(),
});

const READ_INPUT = z.object({
  category: z.enum(["phase", "template", "agent", "workflow", "module"]),
  slug: z.string().min(1),
}).strict();

const READ_OUTPUT = z.object({
  category: z.string(),
  slug: z.string(),
  content: z.string(),
  bytes: z.number().int().nonnegative(),
});

// Lazy singleton — the registry caches reads internally.
const registry = createVelocityContentRegistry();

export function registerVelocityAdminTools(_deps: AdminToolDeps, registryAddTo: ToolRegistry): void {
  registryAddTo.register({
    definition: {
      name: "admin.velocity.manifest.get",
      description: "List the lifted velocity-ops content (phase, template, agent, and workflow slugs available to M4-M9 tools).",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { title: "Admin: velocity content manifest", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler() {
      const m = registry.manifest();
      const total = m.phases.length + m.templates.length + m.agents.length + m.workflows.length + m.modules.length;
      const output = MANIFEST_OUTPUT.parse({
        phases: [...m.phases],
        templates: [...m.templates],
        agents: [...m.agents],
        workflows: [...m.workflows],
        modules: [...m.modules],
        contentRoot: m.contentRoot,
        totalEntries: total,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  });

  registryAddTo.register({
    definition: {
      name: "admin.velocity.content.read",
      description: "Read a single piece of velocity-ops content by category (phase|template|agent|workflow|module) + slug.",
      inputSchema: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["phase", "template", "agent", "workflow", "module"] },
          slug: { type: "string" },
        },
        required: ["category", "slug"],
        additionalProperties: false,
      },
      annotations: { title: "Admin: read velocity content", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler(params) {
      const { category, slug } = READ_INPUT.parse(params);
      let content: string;
      if (category === "phase") {
        if (!(VELOCITY_PHASES as readonly string[]).includes(slug)) throw new Error(`unknown phase slug: ${slug}`);
        content = await registry.readPhase(slug as VelocityPhaseSlug);
      } else if (category === "template") {
        if (!(VELOCITY_TEMPLATES as readonly string[]).includes(slug)) throw new Error(`unknown template slug: ${slug}`);
        content = await registry.readTemplate(slug as VelocityTemplateSlug);
      } else if (category === "agent") {
        if (!(VELOCITY_AGENTS as readonly string[]).includes(slug)) throw new Error(`unknown agent slug: ${slug}`);
        content = await registry.readAgent(slug as VelocityAgentSlug);
      } else if (category === "workflow") {
        if (!(VELOCITY_WORKFLOWS as readonly string[]).includes(slug)) throw new Error(`unknown workflow slug: ${slug}`);
        content = await registry.readWorkflow(slug as VelocityWorkflowSlug);
      } else {
        if (!(VELOCITY_MODULES as readonly string[]).includes(slug)) throw new Error(`unknown module slug: ${slug}`);
        content = await registry.readModule(slug as VelocityModuleSlug);
      }
      const output = READ_OUTPUT.parse({
        category,
        slug,
        content,
        bytes: Buffer.byteLength(content, "utf8"),
      });
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  });
}
