// 6-category token tracking per Caliber + claude_agent_teams_ui (F-093).
// Persisted on every ContextPack; surfaces in §17 readiness reports too.

export type TokenCategory =
  | "claudeMd"
  | "mentionedFile"
  | "toolOutput"
  | "thinkingText"
  | "teamCoordination"
  | "userMessage";

export const TOKEN_CATEGORIES: readonly TokenCategory[] = [
  "claudeMd",
  "mentionedFile",
  "toolOutput",
  "thinkingText",
  "teamCoordination",
  "userMessage",
] as const;

export type TruncationStep = 1 | 2 | 3 | 4 | 5;

export interface TokenSection {
  readonly name: string;
  readonly tokens: number;
  readonly truncated: boolean;
}

export interface TokenBudgetReport {
  readonly targetModel: string;
  readonly budgetTokens: number;
  readonly usedTokens: number;
  readonly byCategory: Readonly<Record<TokenCategory, number>>;
  readonly sections: readonly TokenSection[];
  /** Which of the 5 progressive truncation steps fired (indxr F-052 + v6 §16.2). */
  readonly truncationStep?: TruncationStep;
}

export function emptyBudget(targetModel: string, budgetTokens: number): TokenBudgetReport {
  return {
    targetModel,
    budgetTokens,
    usedTokens: 0,
    byCategory: {
      claudeMd: 0,
      mentionedFile: 0,
      toolOutput: 0,
      thinkingText: 0,
      teamCoordination: 0,
      userMessage: 0,
    },
    sections: [],
  };
}
