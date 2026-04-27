import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { buildCompositionRoot } from "../src/compositionRoot.js";
import { defaultTenantScope } from "../src/domain/tenantScope.js";
import { createIntakeWorkflow } from "../src/workflows/intakeWorkflow.js";
import { createBlueprintWorkflow } from "../src/workflows/blueprintWorkflow.js";

interface CliArgs {
  readonly input: string;
  readonly projectId: string;
  readonly name: string;
  readonly key: string;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const root = await buildCompositionRoot();
  try {
    const markdown = await readFile(args.input, "utf8");
    const scope = defaultTenantScope();
    const intake = createIntakeWorkflow({
      projectRepository: root.repositories.project,
      uio: root.providers.uio,
    });
    const blueprint = createBlueprintWorkflow({ projectRepository: root.repositories.project });
    await intake.create(scope, {
      projectId: args.projectId,
      name: args.name,
      key: args.key,
      source: { kind: "raw_markdown", markdown },
    });
    const result = await blueprint.generate(scope, {
      projectId: args.projectId,
      useSampling: false,
      temperature: 0,
    });
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } finally {
    await root.close();
  }
}

function parseArgs(argv: readonly string[]): CliArgs {
  const input = valueAfter(argv, "--input");
  if (!input) throw new Error("Usage: npm run blueprint -- --input requirements.md [--project-id id] [--name name] [--key KEY]");
  const name = valueAfter(argv, "--name") ?? basename(input).replace(/\.[^.]+$/, "");
  const key = valueAfter(argv, "--key") ?? deriveKey(name);
  return {
    input,
    projectId: valueAfter(argv, "--project-id") ?? `blueprint-${Date.now()}`,
    name,
    key,
  };
}

function valueAfter(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

function deriveKey(name: string): string {
  const letters = name.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).map((part) => part[0]).join("");
  return (letters || "PRJ").slice(0, 8).toUpperCase();
}

main().catch((err) => {
  process.stderr.write(`blueprint failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
