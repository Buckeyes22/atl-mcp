// F-006 closure: real adversarial verification triplet (v6 §18.1).
//
// Three critic LLM calls run in parallel via host-delegated sampling, then a
// synthesizer call summarizes their findings into PASS/FAIL. When sampling is
// unavailable, falls back to deterministic checks; in deployed/staging tiers
// the fallback verdict defaults to FAIL (fail-closed) so a missing sampling
// adapter cannot rubber-stamp destructive writes.
//
// Pattern reference: docs/partners/claude-workflow-v2.md F-083/F-084
// (three critics in parallel + synthesis).

import type { ArtifactPlan, AdversarialTripletResult, TripletCriticResult } from "../planning/artifactPlan.js";
import type { SamplingAdapter } from "../mcp/sampling.js";
import type { DeploymentTier } from "../config.js";

export interface AdversarialTripletDeps {
  readonly sampling: SamplingAdapter;
  readonly tier: DeploymentTier;
  readonly now?: () => string;
  readonly maxTokens?: number;
  readonly temperature?: number;
}

const CRITIC_NAMES = ["false_positive_filter", "missing_issues_finder", "context_validator"] as const;
type CriticName = (typeof CRITIC_NAMES)[number];

export async function runAdversarialTriplet(plan: ArtifactPlan, deps: AdversarialTripletDeps): Promise<AdversarialTripletResult> {
  const now = deps.now ?? (() => new Date().toISOString());
  const synthesizedAt = now();
  const maxTokens = deps.maxTokens ?? 1024;
  const temperature = deps.temperature ?? 0;

  const samples = await Promise.all(
    CRITIC_NAMES.map((name) =>
      deps.sampling.sample({
        prompt: criticPrompt(name, plan),
        maxTokens,
        temperature,
        trace: { projectId: plan.projectId, blueprintVersion: plan.blueprintVersion, promptVersion: `triplet-${name}.v1` },
      }),
    ),
  );

  const allUsed = samples.every((s) => s.used);
  if (!allUsed) {
    // Fallback: deterministic critics. Fail-closed when sampling unavailable in
    // non-dev tiers — F-006 explicitly forbids rubber-stamping destructive writes
    // when the sampling adapter cannot run real critics.
    const deterministic = deterministicCritics(plan);
    const verdict = deps.tier === "dev" ? deterministicVerdict(deterministic) : "FAIL";
    return {
      verdict,
      critics: deterministic,
      synthesizedAt,
    };
  }

  const critics: TripletCriticResult[] = CRITIC_NAMES.map((name, i) => parseCriticResponse(name, samples[i]!));
  // Synthesizer pass: summarizes the three critic outputs and returns PASS/FAIL.
  const synthesizer = await deps.sampling.sample({
    prompt: synthesizerPrompt(plan, critics),
    maxTokens,
    temperature,
    trace: { projectId: plan.projectId, blueprintVersion: plan.blueprintVersion, promptVersion: "triplet-synthesizer.v1" },
  });
  if (!synthesizer.used) {
    // Synthesizer call failed; fall back to "all critics passed" rule.
    const verdict: "PASS" | "FAIL" = critics.every((c) => c.pass) ? "PASS" : "FAIL";
    return { verdict, critics, synthesizedAt };
  }
  const verdict = parseSynthesizerVerdict(synthesizer.text, critics);
  return { verdict, critics, synthesizedAt };
}

function criticPrompt(name: CriticName, plan: ArtifactPlan): string {
  const planJson = JSON.stringify(
    {
      id: plan.id,
      projectId: plan.projectId,
      blueprintVersion: plan.blueprintVersion,
      jiraProjectKey: plan.jiraProjectKey,
      actions: plan.actions.map((a) => ({
        id: a.id,
        action: a.action,
        target: a.target,
        summary: actionSummary(a),
        labels: actionLabels(a),
        blueprintRef: a.blueprintRef,
        idempotencyKey: a.idempotencyKey,
      })),
    },
    null,
    2,
  );
  switch (name) {
    case "false_positive_filter":
      return [
        "You are a false-positive filter for a provisioning plan.",
        "Reject actions that should not be created (duplicates, malformed summaries, ambiguous scope).",
        "Output a JSON object: { pass: boolean, findings: string[] }.",
        "<plan>",
        planJson,
        "</plan>",
      ].join("\n");
    case "missing_issues_finder":
      return [
        "You are a missing-issues finder for a provisioning plan.",
        "Identify acceptance criteria, stories, or required artifacts that are absent from the plan.",
        "Output a JSON object: { pass: boolean, findings: string[] }.",
        "<plan>",
        planJson,
        "</plan>",
      ].join("\n");
    case "context_validator":
      return [
        "You are a context validator for a provisioning plan.",
        "Verify each action references a valid blueprint section and carries actor attribution + idempotency key.",
        "Output a JSON object: { pass: boolean, findings: string[] }.",
        "<plan>",
        planJson,
        "</plan>",
      ].join("\n");
  }
}

function synthesizerPrompt(plan: ArtifactPlan, critics: readonly TripletCriticResult[]): string {
  const criticsJson = JSON.stringify(critics, null, 2);
  return [
    "You are an adversarial-triplet synthesizer.",
    "Three critics have evaluated a provisioning plan. Produce a final verdict.",
    "Return PASS only when no critic surfaced a blocking finding. Return FAIL otherwise.",
    "Output ONLY one of these tokens on the final line: PASS or FAIL.",
    "<plan-id>",
    plan.id,
    "</plan-id>",
    "<critics>",
    criticsJson,
    "</critics>",
  ].join("\n");
}

function parseCriticResponse(name: CriticName, sample: { used: true; text: string } | { used: false }): TripletCriticResult {
  if (!sample.used) return { name, pass: false, findings: ["sampling failed"] };
  const text = sample.text.trim();
  // Best-effort JSON parse. Falls back to "did the response say pass?" when malformed.
  try {
    const json = JSON.parse(extractJsonBlock(text)) as { pass?: boolean; findings?: string[] };
    return {
      name,
      pass: Boolean(json.pass),
      findings: Array.isArray(json.findings) ? json.findings.filter((f): f is string => typeof f === "string") : [],
    };
  } catch {
    const passLine = /\bPASS\b/.test(text) && !/\bFAIL\b/.test(text);
    return { name, pass: passLine, findings: passLine ? [] : ["unparseable critic response"] };
  }
}

function parseSynthesizerVerdict(text: string, critics: readonly TripletCriticResult[]): "PASS" | "FAIL" {
  const lines = text.trim().split("\n");
  const last = (lines[lines.length - 1] ?? "").trim().toUpperCase();
  if (last === "PASS") return critics.every((c) => c.pass) ? "PASS" : "FAIL"; // Synthesizer cannot override a failing critic.
  return "FAIL";
}

function extractJsonBlock(text: string): string {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
  // Find the first { and last } to handle wrapped responses.
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}

function deterministicCritics(plan: ArtifactPlan): TripletCriticResult[] {
  return [
    {
      name: "false_positive_filter",
      pass: plan.actions.every((a) => actionSummary(a).trim().length > 0),
      findings: plan.actions.some((a) => actionSummary(a).trim().length === 0) ? ["one or more actions lack a summary"] : [],
    },
    {
      name: "missing_issues_finder",
      pass: plan.actions.length > 0,
      findings: plan.actions.length === 0 ? ["plan contains no actions"] : [],
    },
    {
      name: "context_validator",
      pass: plan.actions.every((a) => a.blueprintRef.id.length > 0 && a.idempotencyKey.length > 0),
      findings: plan.actions.some((a) => a.blueprintRef.id.length === 0 || a.idempotencyKey.length === 0)
        ? ["an action lacks blueprint traceability or idempotency key"]
        : [],
    },
  ];
}

function deterministicVerdict(critics: readonly TripletCriticResult[]): "PASS" | "FAIL" {
  return critics.every((c) => c.pass) ? "PASS" : "FAIL";
}

function actionSummary(action: ArtifactPlan["actions"][number]): string {
  switch (action.target) {
    case "jira_issue":
      return action.summary;
    case "confluence_page":
      return action.title;
    case "vcs_file":
      return action.path;
    case "vcs_pull_request":
      return action.title;
  }
}

function actionLabels(action: ArtifactPlan["actions"][number]): readonly string[] {
  return action.target === "jira_issue" ? action.labels : [];
}
