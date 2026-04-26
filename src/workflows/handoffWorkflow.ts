export interface ManifestSpawn {
  readonly projectId: string;
  readonly issueKey: string;
  readonly objective: string;
  readonly acceptanceCriteria: readonly string[];
  readonly contextPackUri: string;
  readonly agentMode: "worker" | "coordinator" | "coordinated-worker" | "coordinated-coordinator";
  readonly phaseGuidance: readonly ["context-scan", "discovery", "research", "architecture", "build", "verify"];
  readonly pattern: "mcp-powered";
  readonly generatedConfigs: {
    readonly agentsMd: string;
    readonly codex: string;
    readonly cursor: string;
    readonly copilot: string;
  };
}

export function createHandoffWorkflow() {
  return {
    generate(input: {
      readonly projectId: string;
      readonly issueKey: string;
      readonly objective: string;
      readonly acceptanceCriteria: readonly string[];
    }): ManifestSpawn {
      const agentsMd = `# AGENTS\n\nProject: ${input.projectId}\nIssue: ${input.issueKey}\nObjective: ${input.objective}\n`;
      return {
        ...input,
        contextPackUri: `orchestrator://issue/${encodeURIComponent(input.issueKey)}/context`,
        agentMode: "worker",
        phaseGuidance: ["context-scan", "discovery", "research", "architecture", "build", "verify"],
        pattern: "mcp-powered",
        generatedConfigs: {
          agentsMd,
          codex: `AGENTS parity\n${agentsMd}`,
          cursor: `Cursor parity\n${agentsMd}`,
          copilot: `Copilot parity\n${agentsMd}`,
        },
      };
    },
  };
}
