import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { buildCompositionRoot } from "../src/compositionRoot.js";
import { seedControlPlaneDemo, type DemoSeedMode } from "../src/demo/controlPlaneDemoSeed.js";

interface CliArgs {
  readonly mode: DemoSeedMode;
  readonly maxProjects: number;
  readonly operatorBadge: string;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  await ensureLocalDevDatabase();

  const root = await buildCompositionRoot();
  try {
    const result = await seedControlPlaneDemo(root, {
      mode: args.mode,
      maxProjects: args.maxProjects,
      operatorBadge: args.operatorBadge,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await root.close();
  }
}

function parseArgs(argv: readonly string[]): CliArgs {
  let mode: DemoSeedMode = "auto";
  let maxProjects = 6;
  let operatorBadge = "demo-seed";

  for (const arg of argv) {
    if (arg === "--sample") mode = "sample";
    else if (arg === "--jira") mode = "jira";
    else if (arg.startsWith("--max=")) maxProjects = Number(arg.slice("--max=".length));
    else if (arg.startsWith("--operator=")) operatorBadge = arg.slice("--operator=".length);
    else if (arg === "--help") {
      process.stdout.write([
        "Usage: npm run seed:demo -- [--sample|--jira] [--max=N] [--operator=badge]",
        "",
        "Default mode is auto: use live Jira projects when configured, otherwise seed sample integrated projects.",
      ].join("\n") + "\n");
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  if (!Number.isInteger(maxProjects) || maxProjects < 1 || maxProjects > 25) {
    throw new Error("--max must be an integer from 1 to 25");
  }
  return { mode, maxProjects, operatorBadge };
}

async function ensureLocalDevDatabase(): Promise<void> {
  process.env["DATABASE_DEV_MODE"] ??= "true";
  process.env["DATABASE_URL"] ??= ".orchestrator/dev.pglite";

  if (process.env["DATABASE_DEV_MODE"] !== "true") return;
  const url = process.env["DATABASE_URL"];
  if (!url || url === "memory://" || url === ":memory:" || /^[a-z]+:\/\//i.test(url)) return;
  await mkdir(dirname(url), { recursive: true });
}

main().catch((err) => {
  process.stderr.write(`seed-control-plane-demo failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
