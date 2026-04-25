import type { ProjectBlueprint } from "../domain/projectBlueprint.js";
import type { EpicPlan, StoryPlan } from "../domain/epicPlan.js";
import type { Requirement, RequirementPriority, Risk, Stakeholder } from "../domain/requirement.js";

export interface ParsedBlueprintFields {
  readonly goals: readonly string[];
  readonly nonGoals: readonly string[];
  readonly stakeholders: readonly Stakeholder[];
  readonly requirements: readonly Requirement[];
  readonly features: ProjectBlueprint["features"];
  readonly epics: readonly EpicPlan[];
  readonly architecture: ProjectBlueprint["architecture"];
  readonly risks: readonly Risk[];
  readonly testingStrategy: ProjectBlueprint["testingStrategy"];
  readonly releasePlan: ProjectBlueprint["releasePlan"];
}

export function parseMarkdownBlueprint(markdown: string, projectId: string): ParsedBlueprintFields {
  const sections = splitSections(markdown);
  const requirements = parseRequirements(sections.get("requirements") ?? [], projectId);
  const features = requirements.map((r, index) => ({
    id: id("FEAT", index),
    title: r.title,
    description: r.description,
    requirementIds: [r.id],
    priority: r.priority,
  }));
  const stories: StoryPlan[] = requirements.map((r, index) => ({
    id: id("STORY", index),
    title: r.title,
    userStory: `As a project stakeholder, I need ${lowerFirst(r.title)}.`,
    acceptanceCriteria: r.acceptanceSignals,
    implementationNotes: [],
    testNotes: r.acceptanceSignals,
    contextRefs: r.sourceRefs.map((s) => s.id),
    dependencies: [],
    estimatedComplexity: index > 4 ? "L" : "M",
  }));

  return {
    goals: bullets(sections.get("goals") ?? []),
    nonGoals: bullets(sections.get("non-goals") ?? sections.get("non goals") ?? []),
    stakeholders: parseStakeholders(sections.get("stakeholders") ?? []),
    requirements,
    features,
    epics: stories.length > 0 ? [{ id: "EPIC-001", title: "Project delivery", outcome: "Deliver the accepted requirements.", stories, confluenceRefs: [], dependencies: [] }] : [],
    architecture: { summary: paragraph(sections.get("architecture") ?? []), components: [], decisions: [] },
    risks: parseRisks(sections.get("risks") ?? []),
    testingStrategy: { categories: parseTesting(sections.get("testing") ?? []) },
    releasePlan: { milestones: [], rolloutStrategy: paragraph(sections.get("release") ?? []) },
  };
}

function splitSections(markdown: string): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  let current = "overview";
  sections.set(current, []);
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      current = normalize(heading[2] ?? "overview");
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    sections.get(current)?.push(line);
  }
  return sections;
}

function parseRequirements(lines: readonly string[], projectId: string): Requirement[] {
  return bullets(lines).map((raw, index) => {
    const priorityMatch = /^(must|should|could|wont):\s*(.+)$/i.exec(raw);
    const priority = toPriority(priorityMatch?.[1]);
    const body = priorityMatch?.[2] ?? raw;
    const [description, acceptance] = body.split(/\bAcceptance:\s*/i);
    const cleanDescription = (description ?? body).trim();
    return {
      id: id("REQ", index),
      title: firstSentence(cleanDescription),
      description: cleanDescription,
      type: "functional",
      priority,
      acceptanceSignals: acceptance ? [acceptance.trim()] : [],
      sourceRefs: [{ kind: "blueprint_section", id: `${projectId}:raw-intake`, excerpt: raw }],
    };
  });
}

function parseStakeholders(lines: readonly string[]): Stakeholder[] {
  return bullets(lines).map((raw, index) => {
    const [name, role, interests] = raw.split(/\s+-\s+/);
    return {
      id: id("STK", index),
      name: (name ?? raw).trim(),
      role: (role ?? "stakeholder").trim(),
      interests: interests ? [interests.trim()] : [],
    };
  });
}

function parseRisks(lines: readonly string[]): Risk[] {
  return bullets(lines).map((raw, index) => {
    const match = /^(low|medium|high|critical):\s*(.+?)(?:\s+Mitigation:\s*(.+))?$/i.exec(raw);
    return {
      id: id("RISK", index),
      description: (match?.[2] ?? raw).trim(),
      severity: toSeverity(match?.[1]),
      likelihood: "possible",
      mitigation: (match?.[3] ?? "").trim(),
    };
  });
}

function parseTesting(lines: readonly string[]): ProjectBlueprint["testingStrategy"]["categories"] {
  return bullets(lines).map((raw) => {
    const [category, toolingNotes] = raw.split(/:\s*/);
    return { category: toTestCategory(category), applicable: true, ...(toolingNotes ? { toolingNotes: toolingNotes.trim() } : {}) };
  });
}

function bullets(lines: readonly string[]): string[] {
  return lines.map((l) => /^[-*]\s+(.+)$/.exec(l.trim())?.[1]?.trim()).filter((v): v is string => Boolean(v));
}

function paragraph(lines: readonly string[]): string {
  return lines.map((l) => l.trim()).filter(Boolean).join("\n");
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function id(prefix: string, index: number): string {
  return `${prefix}-${String(index + 1).padStart(3, "0")}`;
}

function toPriority(value: string | undefined): RequirementPriority {
  return value?.toLowerCase() === "should" || value?.toLowerCase() === "could" || value?.toLowerCase() === "wont"
    ? value.toLowerCase() as RequirementPriority
    : "must";
}

function toSeverity(value: string | undefined): Risk["severity"] {
  return value === "low" || value === "medium" || value === "high" || value === "critical" ? value : "medium";
}

function toTestCategory(value: string | undefined): "UT" | "IT" | "ST" | "PT" | "E2E" {
  const normalized = value?.trim().toUpperCase();
  return normalized === "IT" || normalized === "ST" || normalized === "PT" || normalized === "E2E" ? normalized : "UT";
}

function firstSentence(value: string): string {
  return value.split(/[.!?]/)[0]?.trim() || value;
}

function lowerFirst(value: string): string {
  return value.length === 0 ? value : value[0]?.toLowerCase() + value.slice(1);
}
