export type EvalVerdict = "SAFE_TO_SHIP" | "SHIP_WITH_QUARANTINE" | "INVESTIGATE" | "BLOCK_RELEASE";

export function runEvalGate(input: { readonly verdict: EvalVerdict; readonly score: number }): {
  readonly allowed: boolean;
  readonly reason: string;
} {
  if (input.verdict === "SAFE_TO_SHIP" || input.verdict === "SHIP_WITH_QUARANTINE") {
    return { allowed: true, reason: input.verdict };
  }
  return { allowed: false, reason: `${input.verdict}:${input.score}` };
}
