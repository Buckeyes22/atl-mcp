// Builds the LLM prompt for `project_blueprint_revise`. The persona is
// `agents/critic.md` from the lifted velocity content; the operator's
// revision request is treated as untrusted input and isolated in a tag.
// Returns a string prompt + which slugs were embedded (for trace logging).

import type { ProjectBlueprint } from "../domain/projectBlueprint.js";
import type { VelocityAgentSlug, VelocityContentRegistry } from "./contentRegistry.js";

export interface CritiquePromptDeps {
  readonly registry: VelocityContentRegistry;
  /** Agent personas to layer; defaults to `critic` + `thinking-partner`. */
  readonly agents?: readonly VelocityAgentSlug[];
}

const DEFAULT_AGENTS: readonly VelocityAgentSlug[] = ["critic", "thinking-partner"];

export interface CritiquePrompt {
  readonly text: string;
  readonly agentsIncluded: readonly VelocityAgentSlug[];
}

export async function buildBlueprintCritiquePrompt(
  deps: CritiquePromptDeps,
  blueprint: ProjectBlueprint,
  revisionRequest: string,
): Promise<CritiquePrompt> {
  const agents = deps.agents ?? DEFAULT_AGENTS;
  const personaTexts = await Promise.all(
    agents.map(async (slug) => `<persona id="${slug}">\n${await deps.registry.readAgent(slug)}\n</persona>`),
  );

  const text = [
    "# Blueprint revision",
    "",
    "You are revising a `ProjectBlueprint` against an operator request. Adopt the personas below as analytical lenses (critic: surface inconsistencies, scope creep, missing falsification; thinking-partner: tradeoffs, downstream effects).",
    "",
    "## Personas",
    "",
    ...personaTexts,
    "",
    "## Current blueprint",
    "",
    "<current-blueprint>",
    JSON.stringify(blueprint, null, 2),
    "</current-blueprint>",
    "",
    "## Operator revision request",
    "",
    "<revision-request>",
    revisionRequest,
    "</revision-request>",
    "",
    "## Output contract",
    "",
    "Return ONLY a JSON object with these top-level fields:",
    "- `patch`: a partial `ProjectBlueprint` with only the fields you propose to change. Allowed: `name`, `goals`, `nonGoals`, `requirements`, `features`, `epics`, `risks`, `openQuestions`.",
    "- `critiqueNotes`: an array of short strings — your critic-persona observations on the existing blueprint and how the patch addresses them.",
    "",
    "Do NOT include prose, commentary, or markdown fencing — only the JSON object.",
  ].join("\n");

  return { text, agentsIncluded: agents };
}
