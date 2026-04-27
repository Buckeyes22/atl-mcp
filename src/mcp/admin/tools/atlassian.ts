// admin.atlassian.projects.list / admin.projects.adopt — surface the operator's
// Atlassian Cloud project inventory and let them ADOPT an existing Cloud
// project into atl-mcp's lifecycle (writing a ProjectBlueprint with
// state=PROVISIONED + atlassianProjectKey set).

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { defaultTenantScope } from "../../../domain/tenantScope.js";
import { emptyBlueprint, type AdoptedJiraCard, type ProjectBlueprint } from "../../../domain/projectBlueprint.js";
import type { JiraIssue, JiraProvider } from "../../../providers/atlassian/jiraProvider.js";
import { sha256Text } from "../../../security/auditChain.js";
import { appendOperatorAudit } from "../auditedWrite.js";
import type { AdminToolDeps } from "../registry.js";
import type { ToolRegistry } from "../../toolRegistry.js";

// ───── admin.atlassian.projects.list ─────

const ATL_LIST_INPUT = z.object({
  maxResults: z.number().int().min(1).max(100).optional(),
}).strict();

const ATL_LIST_OUTPUT = z.object({
  projects: z.array(z.object({
    id: z.string(),
    key: z.string(),
    name: z.string(),
    projectTypeKey: z.string().optional(),
    style: z.string().optional(),
    leadDisplayName: z.string().optional(),
    adoptedBlueprintId: z.string().optional(),
  })),
  source: z.string(),
  dataLimited: z.object({ reason: z.string() }).optional(),
});

function registerAtlassianProjectsList(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.atlassian.projects.list",
      description: "List Jira projects in the connected Atlassian Cloud (separate from atl-mcp's internal project lifecycle).",
      inputSchema: {
        type: "object",
        properties: { maxResults: { type: "number", minimum: 1, maximum: 100 } },
        additionalProperties: false,
      },
      annotations: { title: "Admin: Atlassian projects", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async handler(params) {
      const { maxResults } = ATL_LIST_INPUT.parse(params ?? {});
      if (!deps.providers.jira) {
        const output = ATL_LIST_OUTPUT.parse({
          projects: [],
          source: "jira not configured",
          dataLimited: { reason: "Jira provider is not configured (set ATLASSIAN_AUTH_MODE + JIRA_BASE_URL)" },
        });
        return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
      }
      const cloudProjects = await deps.providers.jira.listProjects(
        maxResults !== undefined ? { maxResults } : undefined,
      );

      // Cross-reference with adopted blueprints so the UI can show "already adopted" badges.
      const scope = defaultTenantScope();
      const blueprints = await deps.repositories.project.list(scope);
      const adoptedByKey = new Map<string, string>();
      for (const b of blueprints) {
        if (b.atlassianProjectKey) adoptedByKey.set(b.atlassianProjectKey, b.id);
      }

      const output = ATL_LIST_OUTPUT.parse({
        projects: cloudProjects.map((p) => ({
          id: p.id,
          key: p.key,
          name: p.name,
          ...(p.projectTypeKey ? { projectTypeKey: p.projectTypeKey } : {}),
          ...(p.style ? { style: p.style } : {}),
          ...(p.leadDisplayName ? { leadDisplayName: p.leadDisplayName } : {}),
          ...(adoptedByKey.has(p.key) ? { adoptedBlueprintId: adoptedByKey.get(p.key) } : {}),
        })),
        source: "jira /rest/api/3/project/search",
      });
      return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
    },
  });
}

// ───── admin.projects.adopt ─────

const ADOPT_INPUT = z.object({
  atlassianProjectKey: z.string().min(1),
  reason: z.string().min(4),
  operatorBadge: z.string().optional(),
}).strict();

const ADOPT_OUTPUT = z.object({
  ok: z.boolean(),
  blueprintId: z.string(),
  blueprintKey: z.string(),
  state: z.string(),
  auditEntryId: z.string(),
  alreadyAdopted: z.boolean(),
  importedIssueCount: z.number().int().nonnegative(),
  dataLimited: z.object({ reason: z.string() }).optional(),
});

function registerProjectsAdopt(deps: AdminToolDeps, registry: ToolRegistry): void {
  registry.register({
    definition: {
      name: "admin.projects.adopt",
      description: "Adopt an existing Atlassian Cloud project into atl-mcp by creating a ProjectBlueprint with state=PROVISIONED and atlassianProjectKey set. Audit-logged.",
      inputSchema: {
        type: "object",
        properties: {
          atlassianProjectKey: { type: "string" },
          reason: { type: "string", minLength: 4 },
          operatorBadge: { type: "string" },
        },
        required: ["atlassianProjectKey", "reason"],
        additionalProperties: false,
      },
      annotations: { title: "Admin: adopt Atlassian project", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async handler(params) {
      const input = ADOPT_INPUT.parse(params);
      if (!deps.providers.jira) {
        throw new Error("Jira provider is not configured; cannot adopt");
      }
      const scope = defaultTenantScope();

      const existing = await deps.repositories.project.list(scope);
      const already = existing.find((b) => b.atlassianProjectKey === input.atlassianProjectKey);

      // Fetch the Cloud project name via listProjects. (discoverProjectCapabilities doesn't surface
      // the human-readable name today; using the search endpoint avoids extending that surface.)
      const cloud = await deps.providers.jira.listProjects({ maxResults: 100 });
      const match = cloud.find((p) => p.key === input.atlassianProjectKey);
      const displayName = match?.name ?? input.atlassianProjectKey;
      const imported = await importProjectIssues(deps.providers.jira, input.atlassianProjectKey);

      const now = new Date().toISOString();
      const seed = buildAdoptedProjectBlueprint({
        existing: already,
        tenantId: scope.tenantId,
        key: input.atlassianProjectKey,
        name: displayName,
        issues: imported.issues,
        now,
      });
      if (already) {
        await deps.repositories.project.update(scope, seed);
      } else {
        await deps.repositories.project.create(scope, seed);
      }

      const audit = await appendOperatorAudit(deps, {
        tool: "admin.projects.adopt",
        input,
        projectId: seed.id,
        ...(input.operatorBadge ? { operatorBadge: input.operatorBadge } : {}),
        outputArtifactIds: [
          `jira_project:${input.atlassianProjectKey}`,
          ...imported.issues.map((issue) => `jira:${issue.key}`),
        ],
      });

      const output = ADOPT_OUTPUT.parse({
        ok: true,
        blueprintId: seed.id,
        blueprintKey: seed.key,
        state: seed.state,
        auditEntryId: audit.id,
        alreadyAdopted: Boolean(already),
        importedIssueCount: imported.issues.length,
        ...(imported.dataLimited ? { dataLimited: imported.dataLimited } : {}),
      });
      return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
    },
  });
}

interface ImportedJiraIssue {
  readonly id: string;
  readonly key: string;
  readonly kind: AdoptedJiraCard["kind"];
  readonly title: string;
  readonly description: string;
  readonly typeName: string;
  readonly parentKey?: string;
  readonly updated?: string;
}

async function importProjectIssues(
  jira: JiraProvider,
  projectKey: string,
): Promise<{
  readonly issues: readonly ImportedJiraIssue[];
  readonly dataLimited?: { readonly reason: string };
}> {
  try {
    const issues = await jira.searchByJql(`project = "${escapeJqlString(projectKey)}" ORDER BY created ASC`, { maxResults: 50 });
    const hydrated = await Promise.all(issues.map((issue) => hydrateIssue(jira, issue)));
    return { issues: hydrated.map(toImportedIssue) };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return {
      issues: [],
      dataLimited: { reason: `Jira issue import failed during adoption; project was adopted without cards (${reason})` },
    };
  }
}

async function hydrateIssue(jira: JiraProvider, issue: JiraIssue): Promise<JiraIssue> {
  if (stringField(issue.key) && stringField(issue.fields["summary"])) return issue;
  const lookup = stringField(issue.key) ?? stringField(issue.id);
  if (!lookup) return issue;
  try {
    return await jira.getIssue(lookup);
  } catch {
    return issue;
  }
}

function buildAdoptedProjectBlueprint(input: {
  readonly existing: ProjectBlueprint | undefined;
  readonly tenantId: string;
  readonly key: string;
  readonly name: string;
  readonly issues: readonly ImportedJiraIssue[];
  readonly now: string;
}): ProjectBlueprint {
  const base = input.existing ?? emptyBlueprint({
    id: randomUUID(),
    tenantId: input.tenantId,
    name: input.name,
    key: input.key,
  }, input.now);
  const cards = input.issues.map(toAdoptedCard);
  const issuePins = input.issues.map((issue) => ({
    artifactRef: { kind: "jira_issue" as const, id: issue.key },
    version: issue.updated ?? input.now,
    contentChecksum: sha256Text(`${issue.key}:${issue.title}:${issue.description}`),
    pinnedAt: input.now,
  }));
  const sourcePins = mergeSourcePins(base.sourcePins, [
    {
      artifactRef: { kind: "jira_project" as const, id: input.key },
      version: input.now,
      contentChecksum: sha256Text(`${input.key}:${input.name}:${input.issues.length}`),
      pinnedAt: input.now,
    },
    ...issuePins,
  ]);
  return {
    ...base,
    name: input.name,
    key: input.key,
    state: input.existing?.state ?? "PROVISIONED",
    blueprintVersion: input.existing ? input.existing.blueprintVersion + 1 : 2,
    goals: base.goals.length > 0 ? base.goals : [
      `Adopt Jira project ${input.key} into the atl-mcp lifecycle.`,
      `Expose ${input.issues.length} Jira card(s) for planning, assignment, and handoff.`,
      "Keep Jira as the delivery source of truth while storing an auditable import snapshot.",
    ],
    requirements: base.requirements.length > 0 ? base.requirements : buildImportedRequirements(input.key, input.issues),
    features: base.features.length > 0 ? base.features : buildImportedFeatures(input.issues),
    epics: base.epics.length > 0 ? base.epics : buildImportedEpics(input.issues),
    sourcePins,
    atlassianProjectKey: input.key,
    ...(cards.length > 0
      ? { adoptedJiraCards: cards }
      : input.existing?.adoptedJiraCards
        ? { adoptedJiraCards: input.existing.adoptedJiraCards }
        : {}),
    updatedAt: input.now,
  };
}

function buildImportedRequirements(projectKey: string, issues: readonly ImportedJiraIssue[]): ProjectBlueprint["requirements"] {
  const seedIssues = issues.length > 0
    ? issues.slice(0, 12)
    : [{ key: projectKey, title: `Adopt ${projectKey}`, description: "Imported Jira project has no visible issues yet.", typeName: "Project", kind: "task" as const, id: projectKey }];
  return seedIssues.map((issue, index) => ({
    id: `REQ-${index + 1}`,
    title: issue.title,
    description: issue.description || `${issue.typeName} ${issue.key} imported from Jira.`,
    type: "functional",
    priority: "should",
    acceptanceSignals: [`Jira card ${issue.key} is visible in the atl-mcp project detail view.`],
    sourceRefs: [{ kind: "jira_issue", id: issue.key, excerpt: issue.title }],
  }));
}

function buildImportedFeatures(issues: readonly ImportedJiraIssue[]): ProjectBlueprint["features"] {
  const requirements = issues.length > 0 ? issues.slice(0, 12) : [];
  return requirements.map((issue, index) => ({
    id: `FEAT-${index + 1}`,
    title: issue.title,
    description: issue.description || `${issue.typeName} ${issue.key} imported from Jira.`,
    requirementIds: [`REQ-${index + 1}`],
    priority: issue.kind === "epic" ? "must" : "should",
  }));
}

function buildImportedEpics(issues: readonly ImportedJiraIssue[]): ProjectBlueprint["epics"] {
  const epicIssues = issues.filter((issue) => issue.kind === "epic");
  const workIssues = issues.filter((issue) => issue.kind !== "epic");
  if (epicIssues.length === 0) {
    return [{
      id: "JIRA-IMPORT",
      title: "Imported Jira work",
      outcome: "Existing Jira cards are visible for assignment and handoff.",
      stories: workIssues.map(toImportedStory),
      confluenceRefs: [],
      dependencies: [],
    }];
  }

  const unparented = workIssues.filter((issue) => !issue.parentKey || !epicIssues.some((epic) => epic.key === issue.parentKey));
  return epicIssues.map((epic, index) => {
    const children = workIssues.filter((issue) => issue.parentKey === epic.key);
    const stories = index === 0 ? [...children, ...unparented] : children;
    return {
      id: epic.key,
      title: epic.title,
      outcome: epic.description || `${epic.key} imported from Jira.`,
      stories: stories.map(toImportedStory),
      confluenceRefs: [],
      dependencies: [],
    };
  });
}

function toImportedStory(issue: ImportedJiraIssue): ProjectBlueprint["epics"][number]["stories"][number] {
  return {
    id: issue.key,
    title: issue.title,
    userStory: issue.description || `${issue.typeName} ${issue.key} imported from Jira.`,
    acceptanceCriteria: [`Imported Jira card ${issue.key} remains visible and traceable.`],
    implementationNotes: [`Source Jira issue: ${issue.key}`],
    testNotes: ["Verify the adopted Jira card appears in the project detail Jira panel."],
    contextRefs: [`jira_issue:${issue.key}`],
    dependencies: issue.parentKey ? [issue.parentKey] : [],
    estimatedComplexity: "M",
  };
}

function toAdoptedCard(issue: ImportedJiraIssue): AdoptedJiraCard {
  return {
    kind: issue.kind,
    nodeId: issue.key,
    title: issue.title,
    issueKey: issue.key,
  };
}

function toImportedIssue(issue: JiraIssue): ImportedJiraIssue {
  const key = stringField(issue.key) ?? stringField(issue.id) ?? "UNKNOWN-JIRA-ISSUE";
  const typeName = stringFromRecord(issue.fields["issuetype"], "name") ?? "Task";
  const title = stringField(issue.fields["summary"]) ?? key;
  const description = plainText(issue.fields["description"]);
  const parentKey = stringFromRecord(issue.fields["parent"], "key");
  const updated = stringField(issue.fields["updated"]);
  return {
    id: stringField(issue.id) ?? key,
    key,
    kind: cardKind(typeName),
    title,
    description,
    typeName,
    ...(parentKey ? { parentKey } : {}),
    ...(updated ? { updated } : {}),
  };
}

function cardKind(typeName: string): AdoptedJiraCard["kind"] {
  const normalized = typeName.toLowerCase();
  if (normalized.includes("epic")) return "epic";
  if (normalized.includes("story")) return "story";
  return "task";
}

function mergeSourcePins(
  existing: ProjectBlueprint["sourcePins"],
  next: ProjectBlueprint["sourcePins"],
): ProjectBlueprint["sourcePins"] {
  const byKey = new Map<string, ProjectBlueprint["sourcePins"][number]>();
  for (const pin of existing) byKey.set(`${pin.artifactRef.kind}:${pin.artifactRef.id}`, pin);
  for (const pin of next) byKey.set(`${pin.artifactRef.kind}:${pin.artifactRef.id}`, pin);
  return [...byKey.values()];
}

function escapeJqlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function stringFromRecord(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined;
  return stringField(value[key]);
}

function plainText(value: unknown): string {
  const parts: string[] = [];
  collectText(value, parts);
  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 700);
}

function collectText(value: unknown, parts: string[]): void {
  if (typeof value === "string") {
    parts.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, parts);
    return;
  }
  if (!isRecord(value)) return;
  if (typeof value["text"] === "string") parts.push(value["text"]);
  for (const child of Object.values(value)) collectText(child, parts);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function registerAtlassianAdminTools(deps: AdminToolDeps, registry: ToolRegistry): void {
  registerAtlassianProjectsList(deps, registry);
  registerProjectsAdopt(deps, registry);
}
