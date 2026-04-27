import { readFile } from "node:fs/promises";
import { buildCompositionRoot } from "../src/compositionRoot.js";
import { defaultTenantScope } from "../src/domain/tenantScope.js";
import type { ProjectBlueprint } from "../src/domain/projectBlueprint.js";
import { createCodePolicyAdapter } from "../src/security/policyAdapters/codePolicyAdapter.js";
import { createProvisioningWorkflow } from "../src/workflows/provisioningWorkflow.js";

async function main(): Promise<void> {
  const blueprintPath = arg("--blueprint");
  const jiraProjectKey = arg("--jira-project-key") ?? process.env["JIRA_PROJECT_KEY"];
  const actor = arg("--actor") ?? process.env["ATLASSIAN_EMAIL"] ?? "operator";
  if (!blueprintPath || !jiraProjectKey) throw new Error("Usage: npm run provision:preview -- --blueprint blueprint.json --jira-project-key KEY [--actor principal]");
  const root = await buildCompositionRoot();
  try {
    const scope = defaultTenantScope();
    const blueprint = loadBlueprint(await readFile(blueprintPath, "utf8"));
    const existing = await root.repositories.project.findById(scope, blueprint.id);
    if (existing) await root.repositories.project.update(scope, blueprint);
    else await root.repositories.project.create(scope, blueprint);
    const workflow = createProvisioningWorkflow({
      projectRepository: root.repositories.project,
      policy: createCodePolicyAdapter(),
    });
    const result = await workflow.preview(scope, {
      projectId: blueprint.id,
      jiraProjectKey,
      actorPrincipalId: actor,
    });
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } finally {
    await root.close();
  }
}

function arg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function loadBlueprint(raw: string): ProjectBlueprint {
  const parsed = JSON.parse(raw) as { blueprint?: ProjectBlueprint } | ProjectBlueprint;
  return "blueprint" in parsed && parsed.blueprint ? parsed.blueprint : parsed as ProjectBlueprint;
}

main().catch((err) => {
  process.stderr.write(`provision preview failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
