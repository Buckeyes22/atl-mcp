// Builds the LLM prompt scaffold for M4 blueprint synthesis using the
// velocity-ops phase protocols and agent role cards. Consumed by
// src/workflows/blueprintWorkflow.ts when its caller opts into the
// scaffolded prompt.
//
// Why a separate module: blueprintWorkflow's existing `buildPrompt` is
// a 5-line one-liner. Velocity's protocols are substantial prose and
// shouldn't be inlined; loading them via the registry keeps the workflow
// focused on plumbing, not template content.

import type { ProjectBlueprint } from "../domain/projectBlueprint.js";
import type {
  VelocityAgentSlug,
  VelocityContentRegistry,
  VelocityPhaseSlug,
} from "./contentRegistry.js";

export interface BlueprintPromptScaffoldDeps {
  readonly registry: VelocityContentRegistry;
  /** Phases to include in the prompt; defaults to the M4-relevant subset. */
  readonly phases?: readonly VelocityPhaseSlug[];
  /** Agent role cards to include as personas; defaults to the synthesis triad. */
  readonly agents?: readonly VelocityAgentSlug[];
}

const DEFAULT_PHASES: readonly VelocityPhaseSlug[] = [
  "01-intake", "02-discovery", "03-scoping", "06-architecture",
];

const DEFAULT_AGENTS: readonly VelocityAgentSlug[] = [
  "researcher", "architect", "thinking-partner",
];

export interface ScaffoldedPrompt {
  readonly text: string;
  readonly phasesIncluded: readonly VelocityPhaseSlug[];
  readonly agentsIncluded: readonly VelocityAgentSlug[];
}

/**
 * Build a prompt that includes:
 *  1. The lifecycle phase protocols (intake, discovery, scoping, architecture).
 *  2. The agent personas (researcher → architect → thinking-partner).
 *  3. The user's intake content (raw markdown or the intake source object).
 *  4. The output contract (JSON patch shape for ProjectBlueprint).
 */
export async function buildScaffoldedBlueprintPrompt(
  deps: BlueprintPromptScaffoldDeps,
  blueprint: ProjectBlueprint,
): Promise<ScaffoldedPrompt> {
  const phases = deps.phases ?? DEFAULT_PHASES;
  const agents = deps.agents ?? DEFAULT_AGENTS;

  const phaseTexts = await Promise.all(phases.map(async (slug) => `<phase id="${slug}">\n${await deps.registry.readPhase(slug)}\n</phase>`));
  const agentTexts = await Promise.all(agents.map(async (slug) => `<persona id="${slug}">\n${await deps.registry.readAgent(slug)}\n</persona>`));

  const intakeBody = blueprint.intake?.source.kind === "raw_markdown"
    ? blueprint.intake.source.markdown
    : JSON.stringify(blueprint.intake?.source ?? {}, null, 2);

  const text = [
    "# Blueprint synthesis",
    "",
    "You are synthesizing a `ProjectBlueprint` from a research brief. Walk the phase protocols below in order. Adopt the personas as analytical lenses (researcher: extract claims and verify against the brief; architect: shape requirements into epics + stories + an architecture sketch; thinking-partner: surface tradeoffs and open questions).",
    "",
    "## Phase protocols",
    "",
    ...phaseTexts,
    "",
    "## Personas",
    "",
    ...agentTexts,
    "",
    "## Intake",
    "",
    "<untrusted-intake>",
    intakeBody,
    "</untrusted-intake>",
    "",
    "## Output contract",
    "",
    "Return ONLY a JSON object that patches `ProjectBlueprint`. Allowed top-level fields: `name`, `goals`, `nonGoals`, `requirements`, `features`, `epics`, `risks`, `openQuestions`. Each requirement / feature / epic must include `id`, `title`, `summary`. Open questions surface anywhere the brief is ambiguous; do not invent answers.",
    "",
    "Do NOT include prose, commentary, or markdown fencing — only the JSON patch.",
  ].join("\n");

  return { text, phasesIncluded: phases, agentsIncluded: agents };
}
