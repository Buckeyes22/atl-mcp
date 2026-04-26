// jiraIssueTreeWorkflow — M6a executor that walks a blueprint's epics →
// stories → tasks tree and creates one Jira issue per node. Each create
// call uses an idempotency key derived from the blueprint id + node id so
// re-running the executor against the same blueprint version is a no-op.
//
// The agent-facing provisioningWorkflow uses BullMQ for async dispatch;
// this workflow is the synchronous admin-side fast-path called by the
// admin.lifecycle.jira.execute tool.

import type { ProjectBlueprint } from "../domain/projectBlueprint.js";
import type { JiraProvider, JiraIssue } from "../providers/atlassian/jiraProvider.js";

export interface JiraTreeInput {
  readonly jiraProjectKey: string;
}

export interface CreatedIssue {
  readonly nodeKind: "epic" | "story" | "task";
  readonly nodeId: string;
  readonly title: string;
  readonly issueKey: string;
  readonly issueId: string;
}

export interface JiraTreeResult {
  readonly created: readonly CreatedIssue[];
  readonly skippedReason?: string;
}

export interface JiraIssueTreeWorkflow {
  preview(blueprint: ProjectBlueprint, input: JiraTreeInput): Promise<{
    readonly plannedNodes: ReadonlyArray<{ kind: "epic" | "story" | "task"; nodeId: string; title: string }>;
  }>;
  execute(blueprint: ProjectBlueprint, input: JiraTreeInput): Promise<JiraTreeResult>;
}

export function createJiraIssueTreeWorkflow(deps: {
  readonly jira: JiraProvider;
}): JiraIssueTreeWorkflow {
  function planNodes(blueprint: ProjectBlueprint): Array<{ kind: "epic" | "story" | "task"; nodeId: string; title: string; description: readonly string[] }> {
    const nodes: Array<{ kind: "epic" | "story" | "task"; nodeId: string; title: string; description: readonly string[] }> = [];
    for (const epic of blueprint.epics) {
      nodes.push({
        kind: "epic",
        nodeId: epic.id,
        title: epic.title,
        description: [epic.outcome ?? ""],
      });
      for (const story of epic.stories) {
        nodes.push({
          kind: "story",
          nodeId: story.id,
          title: story.title,
          description: [story.userStory, ...story.acceptanceCriteria.map((c) => `Acceptance: ${c}`)],
        });
      }
    }
    return nodes;
  }

  return {
    async preview(blueprint, _input) {
      const nodes = planNodes(blueprint);
      return {
        plannedNodes: nodes.map((n) => ({ kind: n.kind, nodeId: n.nodeId, title: n.title })),
      };
    },

    async execute(blueprint, input) {
      const nodes = planNodes(blueprint);
      if (nodes.length === 0) {
        return {
          created: [],
          skippedReason: `blueprint ${blueprint.key} has no epics or stories yet — populate the blueprint first`,
        };
      }
      const created: CreatedIssue[] = [];
      // Map nodeId → created Jira issue, so child stories can link to parent epics if Jira surface supports it.
      const epicByNodeId = new Map<string, JiraIssue>();
      for (const node of nodes) {
        const issueType = node.kind === "epic" ? "Epic" : node.kind === "story" ? "Story" : "Task";
        const result = await deps.jira.createIssue({
          projectKey: input.jiraProjectKey,
          issueType,
          summary: node.title,
          description: node.description.length > 0
            ? { type: "doc", version: 1, content: node.description.filter((s) => s.length > 0).map((s) => ({ type: "paragraph", content: [{ type: "text", text: s }] })) }
            : null,
          labels: [`atl-mcp-blueprint-v${blueprint.blueprintVersion}`, `atl-mcp-${blueprint.key}`],
          idempotencyKey: `${blueprint.id}:${node.nodeId}:${blueprint.blueprintVersion}`,
        });
        if (node.kind === "epic") epicByNodeId.set(node.nodeId, result);
        created.push({
          nodeKind: node.kind,
          nodeId: node.nodeId,
          title: node.title,
          issueKey: result.key,
          issueId: result.id,
        });
      }
      return { created };
    },
  };
}
