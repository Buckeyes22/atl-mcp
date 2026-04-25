import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface KeyRegistryRepository {
  registerPublicKey(input: { readonly keyId: string; readonly publicKeyPem: string }): Promise<void>;
}

export function createGitRefKeyRegistryRepository(input: {
  readonly repoPath: string;
  readonly mirrorDir?: string;
  readonly refPrefix?: string;
}): KeyRegistryRepository {
  const refPrefix = input.refPrefix ?? "refs/orchestrator/keys";
  return {
    async registerPublicKey(key) {
      const mirrorDir = input.mirrorDir ?? join(input.repoPath, ".orchestrator", "keys");
      const filePath = join(mirrorDir, `${key.keyId}.pub.key`);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, key.publicKeyPem, "utf8");
      const blob = await execFileAsync("git", ["hash-object", "-w", filePath], { cwd: input.repoPath });
      await execFileAsync("git", ["update-ref", `${refPrefix}/${key.keyId}`, blob.stdout.trim()], { cwd: input.repoPath });
    },
  };
}
