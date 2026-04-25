import { createHash, randomUUID } from "node:crypto";
import { emptyBlueprint, type ProjectBlueprint } from "../domain/projectBlueprint.js";
import type { IntakeSource, ProjectIntake } from "../domain/projectIntake.js";
import type { SourcePin } from "../domain/sourcePin.js";
import type { TenantScope } from "../domain/tenantScope.js";
import type { UioAdapter } from "../providers/uio/uioMcpAdapter.js";
import type { ProjectRepository } from "../storage/repositories/projectRepository.js";

export interface IntakeCreateInput {
  readonly projectId?: string;
  readonly name: string;
  readonly key: string;
  readonly source: IntakeSource;
}

export interface IntakeCreateResult {
  readonly blueprint: ProjectBlueprint;
}

export interface IntakeWorkflow {
  create(scope: TenantScope, input: IntakeCreateInput): Promise<IntakeCreateResult>;
}

export function createIntakeWorkflow(deps: {
  readonly projectRepository: ProjectRepository;
  readonly uio?: UioAdapter;
  readonly now?: () => string;
}): IntakeWorkflow {
  const now = deps.now ?? (() => new Date().toISOString());
  return {
    async create(scope, input) {
      const capturedAt = now();
      const projectId = input.projectId ?? randomUUID();
      const intakeSource = await enrichSource(input.source, deps.uio);
      const intake: ProjectIntake = { source: intakeSource, capturedAt, promptVersion: "intake-interview.v1" };
      const pin = sourcePinFor(projectId, intakeSource, capturedAt);
      const blueprint = {
        ...emptyBlueprint({ id: projectId, tenantId: scope.tenantId, name: input.name, key: input.key }, capturedAt),
        sourcePins: [pin],
        intake,
      };
      await deps.projectRepository.create(scope, blueprint);
      return { blueprint };
    },
  };
}

async function enrichSource(source: IntakeSource, uio: UioAdapter | undefined): Promise<IntakeSource> {
  if (source.kind === "raw_markdown") return source;
  if (!uio?.enabled) throw new Error("UIO source provided but UIO is disabled");
  if (source.kind === "uio_document") {
    const catalog = await uio.getCatalogEntry(source.uioSourceId);
    return {
      ...source,
      ...(catalog.title !== undefined ? { title: catalog.title } : {}),
      ...(catalog.version !== undefined ? { version: catalog.version } : {}),
    };
  }
  const envelope = await uio.ingest({
    sourceType: "file_drop",
    rawContent: { garageKey: source.garageKey },
    metadata: { mimeType: source.mimeType },
  });
  const completed = envelope.status === "completed" ? envelope : await uio.status(envelope.envelopeId);
  if (completed.status !== "completed" || !completed.sourceId) {
    throw new Error(`UIO ingestion did not complete for envelope ${completed.envelopeId}`);
  }
  const catalog = await uio.getCatalogEntry(completed.sourceId);
  return {
    ...source,
    envelopeId: completed.envelopeId,
    uioSourceId: completed.sourceId,
    ...(catalog.title !== undefined ? { title: catalog.title } : {}),
    ...(catalog.version !== undefined ? { version: catalog.version } : {}),
  };
}

function sourcePinFor(projectId: string, source: IntakeSource, pinnedAt: string): SourcePin {
  if (source.kind === "raw_markdown") {
    const checksum = sha256(source.markdown);
    return {
      artifactRef: { kind: "blueprint_section", id: `${projectId}:raw-intake` },
      version: `sha256:${checksum}`,
      contentChecksum: checksum,
      pinnedAt,
    };
  }
  const sourceId = source.kind === "uio_document" ? source.uioSourceId : source.uioSourceId;
  if (!sourceId) throw new Error("UIO source id missing after intake enrichment");
  const checksum = sha256(`${sourceId}:${source.uioChunkIndices?.join(",") ?? ""}`);
  return {
    artifactRef: { kind: "uio_source", id: sourceId },
    version: source.version ?? "uio",
    contentChecksum: checksum,
    pinnedAt,
    uioSourceId: sourceId,
    ...(source.uioChunkIndices !== undefined ? { uioChunkIndices: source.uioChunkIndices } : {}),
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
