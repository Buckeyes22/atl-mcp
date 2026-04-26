import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";

export interface Claim {
  readonly id: string;
  readonly scope: string;
  readonly owner: string;
  readonly createdAt: string;
}

export interface ClaimsManager {
  acquire(input: { readonly scope: string; readonly owner: string }): Promise<Claim>;
  release(claim: Claim): Promise<void>;
}

export function createClaimsManager(root = ".planning/coordination/claims"): ClaimsManager {
  return {
    async acquire(input) {
      const claim = {
        id: `${safe(input.scope)}-${Date.now()}`,
        scope: input.scope,
        owner: input.owner,
        createdAt: new Date().toISOString(),
      };
      await mkdir(root, { recursive: true });
      await writeFile(join(root, `${claim.id}.json`), JSON.stringify(claim, null, 2), { flag: "wx" });
      return claim;
    },
    async release(claim) {
      await rm(join(root, `${claim.id}.json`), { force: true });
    },
  };
}

function safe(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]/g, "-").slice(0, 80);
}
