// EpicPlan + StoryPlan are the decomposed work-tree the planner emits
// (v6 §28 M5). Stored on the blueprint; provisioning translates them to Jira
// epics/stories in M6a.

export type StoryComplexity = "S" | "M" | "L" | "XL";

export interface StoryPlan {
  readonly id: string;
  readonly title: string;
  readonly userStory: string;
  readonly acceptanceCriteria: readonly string[];
  readonly implementationNotes: readonly string[];
  readonly testNotes: readonly string[];
  readonly contextRefs: readonly string[];
  readonly dependencies: readonly string[];
  readonly estimatedComplexity: StoryComplexity;
}

export interface EpicPlan {
  readonly id: string;
  readonly title: string;
  readonly outcome: string;
  readonly stories: readonly StoryPlan[];
  readonly confluenceRefs: readonly string[];
  readonly dependencies: readonly string[];
}
