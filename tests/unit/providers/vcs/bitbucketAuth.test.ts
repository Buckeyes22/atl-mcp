import { describe, expect, it } from "vitest";
import { createBitbucketAppPasswordAuth } from "../../../../src/providers/vcs/bitbucket/auth/appPassword.js";

describe("bitbucket app-password auth", () => {
  it("emits a Basic auth header with username:appPassword base64", async () => {
    const auth = createBitbucketAppPasswordAuth({
      username: "chris",
      appPassword: "ATBB-EXAMPLE-app-password-XYZ",
    });
    const header = await auth.getAuthHeader();
    expect(header).toMatch(/^Basic /);
    const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
    expect(decoded).toBe("chris:ATBB-EXAMPLE-app-password-XYZ");
  });

  it("describes credential safely (fingerprint, not raw secret)", () => {
    const auth = createBitbucketAppPasswordAuth({ username: "chris", appPassword: "secret-ABC" });
    const desc = auth.describe();
    expect(desc.mode).toBe("app_password");
    expect(desc.username).toBe("chris");
    expect(desc.credentialFingerprint).toMatch(/^[0-9a-f]{8}$/);
    expect(desc.credentialFingerprint).not.toContain("secret");
    expect(desc.autoRotates).toBe(false);
  });

  it("rejects empty username or appPassword", () => {
    expect(() => createBitbucketAppPasswordAuth({ username: "", appPassword: "x" })).toThrow();
    expect(() => createBitbucketAppPasswordAuth({ username: "u", appPassword: "" })).toThrow();
  });
});
