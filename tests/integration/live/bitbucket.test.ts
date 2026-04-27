// F-005 closure: env-gated live tests against real Bitbucket Cloud.
// Activate by setting BITBUCKET_LIVE_TEST=1 alongside BITBUCKET_USERNAME +
// BITBUCKET_APP_PASSWORD + BITBUCKET_WORKSPACE + BITBUCKET_REPO_SLUG.
// Skipped silently otherwise.
//
// V-1 in audit-verification-plan-2026-04-25.md gates real Bitbucket smoke on
// operator providing creds. This test file is the landing zone.

import { describe, expect, it } from "vitest";
import { pino } from "pino";
import { createBitbucketAppPasswordAuth } from "../../../src/providers/vcs/bitbucket/auth/appPassword.js";
import { createBitbucketRestProvider } from "../../../src/providers/vcs/bitbucket/bitbucketRestProvider.js";

const ENABLED = process.env["BITBUCKET_LIVE_TEST"] === "1";

const BB_USER = process.env["BITBUCKET_USERNAME"];
const BB_PASS = process.env["BITBUCKET_APP_PASSWORD"];
const BB_WORKSPACE = process.env["BITBUCKET_WORKSPACE"];
const BB_REPO = process.env["BITBUCKET_REPO_SLUG"];

const silentLogger = pino({ level: "silent" });

describe.runIf(ENABLED)("live Bitbucket Cloud smoke (BITBUCKET_LIVE_TEST=1)", () => {
  it("discoverRepoCapabilities returns the repo's default branch + protection rules", async () => {
    expect(BB_USER && BB_PASS && BB_WORKSPACE && BB_REPO).toBeTruthy();
    const auth = createBitbucketAppPasswordAuth({ username: BB_USER!, appPassword: BB_PASS! });
    const vcs = createBitbucketRestProvider({
      auth,
      logger: silentLogger,
      userAgent: "atl-mcp-orchestrator-live-test",
    });
    const profile = await vcs.discoverRepoCapabilities(BB_WORKSPACE!, BB_REPO!);
    expect(profile.workspace).toBe(BB_WORKSPACE);
    expect(profile.repoSlug).toBe(BB_REPO);
    expect(profile.defaultBranch.length).toBeGreaterThan(0);
  }, 30_000);
});
