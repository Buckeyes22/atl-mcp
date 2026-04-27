// CLI: run project_preflight_check against real Atlassian + (optional) Bitbucket + UIO.
//
// Usage:
//   node --env-file=.env --import tsx scripts/preflight-cli.ts
//   (or: npm run preflight)
//
// Reads JIRA_PROJECT_KEY + CONFLUENCE_SPACE_KEY from env. Prints the resulting
// ProjectProfile JSON to stdout; warnings + diagnostics to stderr.
//
// Stdout is the profile JSON only — pipe through `jq` if you want to inspect.
// Exit code: 0 on success even with warnings; 1 if any error-severity warning.

import { buildCompositionRoot } from "../src/compositionRoot.js";
import { runPreflight, type PreflightDeps } from "../src/preflight/preflightWorkflow.js";
import { readString } from "../src/config/env.js";
import { defaultTenantScope } from "../src/domain/tenantScope.js";

async function main(): Promise<void> {
  const root = await buildCompositionRoot();

  const projectId = process.env["PROJECT_ID"] ?? `smoke-${Date.now()}`;
  const jiraProjectKey = readString("JIRA_PROJECT_KEY");
  const confluenceSpaceKey = readString("CONFLUENCE_SPACE_KEY");
  const bbWorkspace = process.env["BITBUCKET_WORKSPACE"];
  const bbRepoSlug = process.env["BITBUCKET_REPO_SLUG"];

  process.stderr.write(`preflight smoke against:\n`);
  process.stderr.write(`  jiraProjectKey:      ${jiraProjectKey}\n`);
  process.stderr.write(`  confluenceSpaceKey:  ${confluenceSpaceKey}\n`);
  process.stderr.write(`  bitbucket:           ${root.providers.vcs ? `${bbWorkspace ?? "?"}/${bbRepoSlug ?? "?"}` : "absent"}\n`);
  process.stderr.write(`  uioEnabled:          ${root.providers.uio.enabled}\n`);
  process.stderr.write(`  jiraProvider:        ${root.providers.jira ? "configured" : "absent"}\n`);
  process.stderr.write(`  confluenceProvider:  ${root.providers.confluence ? "configured" : "absent"}\n\n`);

  const deps: PreflightDeps = {
    ...(root.providers.jira ? { jira: root.providers.jira } : {}),
    ...(root.providers.confluence ? { confluence: root.providers.confluence } : {}),
    ...(root.providers.vcs ? { vcs: root.providers.vcs } : {}),
    uio: root.providers.uio,
    authMode: "api_token",
    logger: root.logger,
  };

  let exitCode = 0;
  try {
    const profile = await runPreflight(
      {
        tenantId: defaultTenantScope().tenantId,
        projectId,
        jiraProjectKeyOrId: jiraProjectKey,
        confluenceSpaceKeyOrId: confluenceSpaceKey,
        ...(bbWorkspace ? { vcsWorkspace: bbWorkspace } : {}),
        ...(bbRepoSlug ? { vcsRepoSlug: bbRepoSlug } : {}),
      },
      deps,
    );

    process.stdout.write(JSON.stringify(profile, null, 2) + "\n");

    // Persist to projectProfiles table so the orchestrator's
    // project_profile_get tool can return this profile later.
    await root.repositories.projectProfile.insert(defaultTenantScope(), profile);
    process.stderr.write(`\npersisted profileId=${profile.id} for projectId=${profile.projectId}\n`);

    if (profile.warnings.length > 0) {
      process.stderr.write(`\n=== Warnings (${profile.warnings.length}) ===\n`);
      for (const w of profile.warnings) {
        process.stderr.write(`  [${w.severity.padEnd(5)}] ${w.target.padEnd(11)} ${w.code}: ${w.message}\n`);
      }
    }
    const errors = profile.warnings.filter((w) => w.severity === "error");
    if (errors.length > 0) {
      process.stderr.write(`\n${errors.length} error-severity warning(s) — exiting 1\n`);
      exitCode = 1;
    } else {
      process.stderr.write(`\npreflight ok\n`);
    }
  } catch (err) {
    process.stderr.write(`\npreflight threw: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    exitCode = 1;
  } finally {
    await root.close();
  }
  process.exit(exitCode);
}

main();
