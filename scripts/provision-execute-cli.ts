import { readFile } from "node:fs/promises";
import { buildCompositionRoot } from "../src/compositionRoot.js";
import { defaultTenantScope } from "../src/domain/tenantScope.js";
import type { ArtifactPlan } from "../src/planning/artifactPlan.js";
import { createProvisionJobExecutor } from "../src/queue/jobs/provisionJob.js";
import { createCodePolicyAdapter } from "../src/security/policyAdapters/codePolicyAdapter.js";

async function main(): Promise<void> {
  const planPath = arg("--plan");
  const approved = process.argv.includes("--approved");
  const profileId = arg("--profile-id");
  const approvedBy = arg("--approved-by") ?? process.env["ATLASSIAN_EMAIL"];
  const approvedAt = arg("--approved-at") ?? new Date().toISOString();
  if (!planPath || !profileId || !approvedBy) {
    throw new Error("Usage: npm run provision:execute -- --plan plan.json --profile-id profile-id --approved --approved-by user@example.com");
  }
  const root = await buildCompositionRoot();
  try {
    if (!root.providers.jira) throw new Error("Jira provider is not configured");
    const plan = loadPlan(await readFile(planPath, "utf8"));
    const executor = createProvisionJobExecutor({
      jira: root.providers.jira,
      policy: createCodePolicyAdapter(),
      traceLink: root.repositories.traceLink,
      audit: root.repositories.audit,
      projectProfile: root.repositories.projectProfile,
      policyDecision: root.repositories.policyDecision,
      signer: root.auditSigner,
    });
    const result = await executor.execute(defaultTenantScope(), {
      plan,
      approved,
      approvalEvidence: {
        approvedBy,
        approvedAt,
        previewPlanId: plan.id,
        projectProfileId: profileId,
      },
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

function loadPlan(raw: string): ArtifactPlan {
  const parsed = JSON.parse(raw) as { plan?: ArtifactPlan } | ArtifactPlan;
  return "plan" in parsed && parsed.plan ? parsed.plan : parsed as ArtifactPlan;
}

main().catch((err) => {
  process.stderr.write(`provision execute failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
