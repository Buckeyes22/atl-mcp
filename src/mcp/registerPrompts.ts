import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  type GetPromptResult,
  type Prompt,
} from "@modelcontextprotocol/sdk/types.js";

export const CANONICAL_PROMPT_NAMES = [
  "project-intake-interview",
  "requirements-decomposer",
  "architecture-review",
  "provisioning-reviewer",
  "jira-story-writer",
  "confluence-page-writer",
  "readiness-reviewer",
  "build-agent-handoff",
] as const;

export type CanonicalPromptName = (typeof CANONICAL_PROMPT_NAMES)[number];

interface CanonicalPromptSpec {
  readonly name: CanonicalPromptName;
  readonly title: string;
  readonly description: string;
  readonly arguments: readonly PromptArgumentSpec[];
  readonly body: string;
}

interface PromptArgumentSpec {
  readonly name: string;
  readonly description: string;
  readonly required?: boolean;
}

const PROMPT_VERSION = "v1";

const PROMPTS: readonly CanonicalPromptSpec[] = [
  {
    name: "project-intake-interview",
    title: "Project Intake Interview",
    description: "Interview an operator for missing project intake facts before blueprint generation.",
    arguments: [
      { name: "projectName", description: "Human-readable project name.", required: true },
      { name: "projectId", description: "Existing orchestrator project id or desired key." },
    ],
    body: [
      "You are conducting an intake interview for {{projectName}}.",
      "Ask only for information needed to turn raw requirements into an actionable orchestrator blueprint.",
      "Cover goals, non-goals, users, integrations, compliance constraints, rollout expectations, and test evidence.",
      "When an answer is ambiguous, ask a concrete follow-up instead of guessing.",
      "Project reference: {{projectId}}",
    ].join("\n"),
  },
  {
    name: "requirements-decomposer",
    title: "Requirements Decomposer",
    description: "Decompose raw requirements into epics, stories, acceptance criteria, risks, and tests.",
    arguments: [
      { name: "projectId", description: "Orchestrator project id.", required: true },
      { name: "requirements", description: "Raw or summarized requirements text.", required: true },
    ],
    body: [
      "Decompose requirements for project {{projectId}} into implementation-ready work.",
      "Produce epics, stories, acceptance criteria, test notes, dependencies, risks, and open questions.",
      "Keep acceptance criteria observable and avoid implementation claims that are not backed by the requirements.",
      "",
      "{{requirements}}",
    ].join("\n"),
  },
  {
    name: "architecture-review",
    title: "Architecture Review",
    description: "Review a generated blueprint for architectural consistency and missing decisions.",
    arguments: [
      { name: "projectId", description: "Orchestrator project id.", required: true },
      { name: "blueprint", description: "Blueprint JSON or summary.", required: true },
    ],
    body: [
      "Review the architecture implied by blueprint {{projectId}}.",
      "Identify missing ADRs, incompatible module boundaries, data-flow risks, security constraints, and operational gaps.",
      "Separate blocking issues from follow-up improvements.",
      "",
      "{{blueprint}}",
    ].join("\n"),
  },
  {
    name: "provisioning-reviewer",
    title: "Provisioning Reviewer",
    description: "Review a dry-run artifact plan before external Jira, Confluence, or VCS writes.",
    arguments: [
      { name: "plan", description: "ArtifactPlan JSON.", required: true },
      { name: "actor", description: "Principal or operator reviewing the plan." },
    ],
    body: [
      "Review this orchestrator provisioning plan before approval.",
      "Check idempotency keys, actor attribution, policy decisions, trace links, external write order, and rollback implications.",
      "Return PASS only if the plan is specific, non-duplicative, attributable, and safe to execute.",
      "Reviewer: {{actor}}",
      "",
      "{{plan}}",
    ].join("\n"),
  },
  {
    name: "jira-story-writer",
    title: "Jira Story Writer",
    description: "Draft Jira story content from a blueprint story while preserving orchestrator metadata.",
    arguments: [
      { name: "story", description: "Blueprint story JSON.", required: true },
      { name: "metadataBlock", description: "Orchestrator attribution metadata block." },
    ],
    body: [
      "Write a Jira story from this blueprint story.",
      "Use concise summary, user story, acceptance criteria, implementation notes, test notes, dependencies, and orchestrator metadata.",
      "Do not invent scope outside the story.",
      "",
      "{{story}}",
      "",
      "{{metadataBlock}}",
    ].join("\n"),
  },
  {
    name: "confluence-page-writer",
    title: "Confluence Page Writer",
    description: "Draft Confluence page content from blueprint and velocity-ops template context.",
    arguments: [
      { name: "pageTitle", description: "Target page title.", required: true },
      { name: "context", description: "Blueprint and template context.", required: true },
    ],
    body: [
      "Draft a Confluence page titled {{pageTitle}}.",
      "Use direct operational language, preserve source links, and include explicit assumptions and open questions.",
      "Keep the output suitable for storage-format conversion.",
      "",
      "{{context}}",
    ].join("\n"),
  },
  {
    name: "readiness-reviewer",
    title: "Readiness Reviewer",
    description: "Review deterministic readiness output and identify build blockers.",
    arguments: [
      { name: "readinessReport", description: "Readiness report JSON.", required: true },
      { name: "contextPack", description: "Related context pack JSON." },
    ],
    body: [
      "Review the readiness report for build promotion.",
      "Promote only when deterministic score and verdict support READY_FOR_BUILD.",
      "List blockers, missing evidence, stale source pins, and concrete remediation steps.",
      "",
      "{{readinessReport}}",
      "",
      "{{contextPack}}",
    ].join("\n"),
  },
  {
    name: "build-agent-handoff",
    title: "Build Agent Handoff",
    description: "Prepare a build-agent handoff from a ManifestSpawn and context pack URI.",
    arguments: [
      { name: "manifest", description: "ManifestSpawn JSON.", required: true },
      { name: "contextPackUri", description: "MCP resource URI for the context pack.", required: true },
    ],
    body: [
      "Prepare the build-agent handoff.",
      "Ground all instructions in the manifest and context pack URI.",
      "Call out objective, acceptance criteria, required resources, verification commands, and handback expectations.",
      "Context pack: {{contextPackUri}}",
      "",
      "{{manifest}}",
    ].join("\n"),
  },
];

const PROMPT_BY_NAME = new Map<CanonicalPromptName, CanonicalPromptSpec>(
  PROMPTS.map((prompt) => [prompt.name, prompt]),
);

export function listCanonicalPrompts(): readonly Prompt[] {
  return PROMPTS.map((prompt) => ({
    name: prompt.name,
    title: prompt.title,
    description: prompt.description,
    arguments: prompt.arguments.map((arg) => ({
      name: arg.name,
      description: arg.description,
      ...(arg.required !== undefined ? { required: arg.required } : {}),
    })),
    _meta: {
      "orchestrator/version": PROMPT_VERSION,
    },
  }));
}

export function getCanonicalPrompt(
  name: string,
  args: Readonly<Record<string, string>> = {},
): GetPromptResult {
  if (!isCanonicalPromptName(name)) {
    throw new Error(`unknown prompt: ${name}`);
  }
  const prompt = PROMPT_BY_NAME.get(name);
  if (!prompt) {
    throw new Error(`unknown prompt: ${name}`);
  }
  return {
    description: prompt.description,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: renderTemplate(prompt.body, args),
        },
      },
    ],
    _meta: {
      "orchestrator/version": PROMPT_VERSION,
      "orchestrator/prompt": prompt.name,
    },
  };
}

export function registerPrompts(server: Server): void {
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [...listCanonicalPrompts()],
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) =>
    getCanonicalPrompt(request.params.name, request.params.arguments ?? {}),
  );
}

function renderTemplate(template: string, args: Readonly<Record<string, string>>): string {
  return template.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_match, rawKey: string) => args[rawKey] ?? "");
}

function isCanonicalPromptName(name: string): name is CanonicalPromptName {
  return (CANONICAL_PROMPT_NAMES as readonly string[]).includes(name);
}
