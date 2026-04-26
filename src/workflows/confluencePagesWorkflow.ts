// confluencePagesWorkflow — M6b. Walks the velocity template catalog and
// emits a Confluence page tree per blueprint. Each entry is rendered with
// blueprint-derived variables and POSTed via the configured ConfluenceProvider.
//
// Templates with bracketed instructional placeholders (e.g.,
// "[One paragraph maximum…]") leave those instructions intact so the
// operator can spot what still needs human input. The audit-chain entry
// records every page id created.

import type { ProjectBlueprint } from "../domain/projectBlueprint.js";
import type {
  ConfluenceProvider,
  ConfluencePage,
} from "../providers/atlassian/confluenceProvider.js";
import type {
  VelocityContentRegistry,
  VelocityTemplateSlug,
} from "../velocity/contentRegistry.js";
import { renderTemplate, type TemplateVariables } from "../velocity/templateRenderer.js";

export interface PageGenerationEntry {
  readonly templateSlug: VelocityTemplateSlug;
  readonly title: string;
  /** Optional parent page id (null = root of the space). */
  readonly parentId?: string;
}

export interface ConfluenceGenerateInput {
  readonly spaceId: string;
  readonly entries: readonly PageGenerationEntry[];
  readonly variables: TemplateVariables;
}

export interface RenderedPage {
  readonly templateSlug: VelocityTemplateSlug;
  readonly title: string;
  readonly bodyStorage: string;
  readonly substitutionsMade: number;
  readonly unresolvedPlaceholders: readonly string[];
}

export interface ConfluencePreviewResult {
  readonly pages: readonly RenderedPage[];
}

export interface ConfluenceExecuteResult {
  readonly pages: ReadonlyArray<{
    readonly templateSlug: VelocityTemplateSlug;
    readonly title: string;
    readonly pageId: string;
    readonly version: number;
  }>;
}

export interface ConfluencePagesWorkflow {
  preview(input: ConfluenceGenerateInput): Promise<ConfluencePreviewResult>;
  execute(input: ConfluenceGenerateInput): Promise<ConfluenceExecuteResult>;
}

/**
 * Default page list for a new project. Operators can override by passing
 * their own `entries` to the workflow; this is the conservative starter set
 * that maps to atl-mcp's M6b spec.
 */
export function defaultPageEntries(blueprint: ProjectBlueprint): readonly PageGenerationEntry[] {
  const projectName = blueprint.name;
  const entries: PageGenerationEntry[] = [
    { templateSlug: "project-brief", title: `${projectName} — Charter` },
    { templateSlug: "prd", title: `${projectName} — PRD` },
    { templateSlug: "architecture-decision", title: `${projectName} — ADR Template` },
    { templateSlug: "slo-definition", title: `${projectName} — SLOs and Error Budgets` },
    { templateSlug: "threat-model", title: `${projectName} — Threat Model` },
    { templateSlug: "runbook", title: `${projectName} — Operations Runbook` },
    { templateSlug: "common-tasks-runbook", title: `${projectName} — Common Tasks` },
    { templateSlug: "incident-response", title: `${projectName} — Incident Response` },
    { templateSlug: "requirements-catalog", title: `${projectName} — Requirements Catalog` },
    { templateSlug: "api-standards", title: `${projectName} — API Standards` },
  ];
  return entries;
}

/**
 * Build the variable dict used to render every template. Pulls fields from
 * the blueprint and provides sensible defaults so unresolved placeholders
 * are limited to genuinely-unknown values.
 */
export function defaultVariables(blueprint: ProjectBlueprint): TemplateVariables {
  return {
    project_name: blueprint.name,
    PROJECT: blueprint.key,
    project_key: blueprint.key,
    "Project Name": blueprint.name,
    "Project Key": blueprint.key,
    blueprint_version: String(blueprint.blueprintVersion),
    schema_version: String(blueprint.schemaVersion),
  };
}

export function createConfluencePagesWorkflow(deps: {
  readonly registry: VelocityContentRegistry;
  readonly confluence: ConfluenceProvider;
}): ConfluencePagesWorkflow {
  async function renderEntries(input: ConfluenceGenerateInput): Promise<readonly RenderedPage[]> {
    return Promise.all(
      input.entries.map(async (entry) => {
        const body = await deps.registry.readTemplate(entry.templateSlug);
        const result = renderTemplate(body, input.variables);
        return {
          templateSlug: entry.templateSlug,
          title: entry.title,
          bodyStorage: markdownToConfluenceStorage(result.text),
          substitutionsMade: result.substitutionsMade,
          unresolvedPlaceholders: result.unresolvedPlaceholders,
        };
      }),
    );
  }

  return {
    async preview(input) {
      return { pages: await renderEntries(input) };
    },
    async execute(input) {
      const rendered = await renderEntries(input);
      const created: Array<{ templateSlug: VelocityTemplateSlug; title: string; pageId: string; version: number }> = [];
      for (const page of rendered) {
        const matchingEntry = input.entries.find((e) => e.templateSlug === page.templateSlug && e.title === page.title);
        const result: ConfluencePage = await deps.confluence.createPage({
          spaceId: input.spaceId,
          title: page.title,
          body: { representation: "storage", value: page.bodyStorage },
          ...(matchingEntry?.parentId ? { parentId: matchingEntry.parentId } : {}),
          idempotencyKey: `${input.spaceId}:${page.templateSlug}:${page.title}`,
        });
        created.push({
          templateSlug: page.templateSlug,
          title: page.title,
          pageId: result.id,
          version: result.version,
        });
      }
      return { pages: created };
    },
  };
}

/**
 * Convert markdown to a Confluence storage-format XHTML wrapper. Confluence
 * accepts arbitrary HTML inside `<ac:layout>` containers; for v1 we wrap
 * the markdown in `<pre>` so it round-trips. M6b can promote this to a real
 * markdown→storage converter once the operator validates the shape.
 */
function markdownToConfluenceStorage(markdown: string): string {
  // Confluence storage is XHTML. Escape minimal special chars to keep it valid.
  const escaped = markdown
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return `<ac:structured-macro ac:name="markdown" ac:schema-version="1"><ac:plain-text-body><![CDATA[${markdown.replace(/]]>/g, "]]]]><![CDATA[>")}]]></ac:plain-text-body></ac:structured-macro><pre>${escaped}</pre>`;
}
