export const AGENT_MEMORY_KINDS = ["fact", "decision", "preference", "warning", "reflection"] as const;

export type AgentMemoryKind = typeof AGENT_MEMORY_KINDS[number];

export interface AgentMemorySourceRef {
  readonly kind: string;
  readonly id: string;
  readonly uri?: string | undefined;
  readonly title?: string | undefined;
}

export interface AgentMemoryEntry {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly agentKey: string;
  readonly sessionId?: string;
  readonly issueKey?: string;
  readonly kind: AgentMemoryKind;
  readonly text: string;
  readonly tags: readonly string[];
  readonly sourceRefs: readonly AgentMemorySourceRef[];
  readonly contentHash: string;
  readonly embeddingRef?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt?: string;
}

export interface AgentMemoryRecallMatch {
  readonly entry: AgentMemoryEntry;
  readonly score: number;
  readonly reasons: readonly string[];
}

export interface AgentMemoryRecallResult {
  readonly entries: readonly AgentMemoryRecallMatch[];
  readonly deterministicAvailable: true;
  readonly vectorAvailable: boolean;
  readonly vectorAttempted: boolean;
  readonly query?: string;
}

export interface ContextPackMemoryEntry {
  readonly id: string;
  readonly kind: AgentMemoryKind;
  readonly text: string;
  readonly tags: readonly string[];
  readonly score: number;
  readonly createdAt: string;
  readonly issueKey?: string;
}

export interface ContextPackAgentMemory {
  readonly entries: readonly ContextPackMemoryEntry[];
  readonly recall: {
    readonly deterministicAvailable: true;
    readonly vectorAvailable: boolean;
    readonly vectorAttempted: boolean;
    readonly limit: number;
    readonly query?: string;
  };
}
