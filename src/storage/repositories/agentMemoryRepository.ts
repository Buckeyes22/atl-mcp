import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { Database } from "../db.js";
import { agentMemoryEntries, type AgentMemoryEntryRow, type NewAgentMemoryEntryRow } from "../schema/agentMemoryEntries.js";
import type { AgentMemoryEntry, AgentMemoryKind, AgentMemorySourceRef } from "../../domain/agentMemory.js";
import type { TenantScope } from "../../domain/tenantScope.js";

export interface AgentMemoryRecallQuery {
  readonly projectId: string;
  readonly agentKey: string;
  readonly issueKey?: string;
  readonly kinds?: readonly AgentMemoryKind[];
  readonly limit?: number;
}

export interface AgentMemoryRepository {
  insert(scope: TenantScope, entry: AgentMemoryEntry): Promise<AgentMemoryEntry>;
  findById(scope: TenantScope, id: string): Promise<AgentMemoryEntry | undefined>;
  findActiveDuplicate(scope: TenantScope, input: {
    readonly projectId: string;
    readonly agentKey: string;
    readonly contentHash: string;
  }): Promise<AgentMemoryEntry | undefined>;
  findManyByIds(scope: TenantScope, input: {
    readonly projectId: string;
    readonly agentKey: string;
    readonly ids: readonly string[];
  }): Promise<readonly AgentMemoryEntry[]>;
  recallCandidates(scope: TenantScope, query: AgentMemoryRecallQuery): Promise<readonly AgentMemoryEntry[]>;
  softDelete(scope: TenantScope, input: {
    readonly id: string;
    readonly projectId: string;
    readonly agentKey: string;
    readonly deletedAt: string;
  }): Promise<AgentMemoryEntry | undefined>;
}

export function createAgentMemoryRepository(db: Database): AgentMemoryRepository {
  return {
    async insert(scope, entry) {
      assertScope(scope, entry);
      const row: NewAgentMemoryEntryRow = {
        id: entry.id,
        tenantId: entry.tenantId,
        projectId: entry.projectId,
        agentKey: entry.agentKey,
        sessionId: entry.sessionId ?? null,
        issueKey: entry.issueKey ?? null,
        kind: entry.kind,
        text: entry.text,
        tags: [...entry.tags],
        sourceRefs: entry.sourceRefs,
        contentHash: entry.contentHash,
        embeddingRef: entry.embeddingRef ?? null,
        createdAt: new Date(entry.createdAt),
        updatedAt: new Date(entry.updatedAt),
        deletedAt: entry.deletedAt ? new Date(entry.deletedAt) : null,
      };
      await db.insert(agentMemoryEntries).values(row);
      return entry;
    },

    async findById(scope, id) {
      const rows = await db
        .select()
        .from(agentMemoryEntries)
        .where(and(eq(agentMemoryEntries.tenantId, scope.tenantId), eq(agentMemoryEntries.id, id)))
        .limit(1);
      return rows[0] ? rowToEntry(rows[0]) : undefined;
    },

    async findActiveDuplicate(scope, input) {
      const rows = await db
        .select()
        .from(agentMemoryEntries)
        .where(and(
          eq(agentMemoryEntries.tenantId, scope.tenantId),
          eq(agentMemoryEntries.projectId, input.projectId),
          eq(agentMemoryEntries.agentKey, input.agentKey),
          eq(agentMemoryEntries.contentHash, input.contentHash),
          isNull(agentMemoryEntries.deletedAt),
        ))
        .limit(1);
      return rows[0] ? rowToEntry(rows[0]) : undefined;
    },

    async findManyByIds(scope, input) {
      if (input.ids.length === 0) return [];
      const rows = await db
        .select()
        .from(agentMemoryEntries)
        .where(and(
          eq(agentMemoryEntries.tenantId, scope.tenantId),
          eq(agentMemoryEntries.projectId, input.projectId),
          eq(agentMemoryEntries.agentKey, input.agentKey),
          isNull(agentMemoryEntries.deletedAt),
          inArray(agentMemoryEntries.id, [...input.ids]),
        ));
      return rows.map(rowToEntry);
    },

    async recallCandidates(scope, query) {
      const clauses = [
        eq(agentMemoryEntries.tenantId, scope.tenantId),
        eq(agentMemoryEntries.projectId, query.projectId),
        eq(agentMemoryEntries.agentKey, query.agentKey),
        isNull(agentMemoryEntries.deletedAt),
      ];
      if (query.issueKey !== undefined) clauses.push(eq(agentMemoryEntries.issueKey, query.issueKey));
      if (query.kinds && query.kinds.length === 1) clauses.push(eq(agentMemoryEntries.kind, query.kinds[0] ?? ""));
      if (query.kinds && query.kinds.length > 1) clauses.push(inArray(agentMemoryEntries.kind, [...query.kinds]));

      const rows = await db
        .select()
        .from(agentMemoryEntries)
        .where(and(...clauses))
        .orderBy(desc(agentMemoryEntries.updatedAt))
        .limit(query.limit ?? 200);
      return rows.map(rowToEntry);
    },

    async softDelete(scope, input) {
      const rows = await db
        .update(agentMemoryEntries)
        .set({ deletedAt: new Date(input.deletedAt), updatedAt: new Date(input.deletedAt) })
        .where(and(
          eq(agentMemoryEntries.tenantId, scope.tenantId),
          eq(agentMemoryEntries.projectId, input.projectId),
          eq(agentMemoryEntries.agentKey, input.agentKey),
          eq(agentMemoryEntries.id, input.id),
          isNull(agentMemoryEntries.deletedAt),
        ))
        .returning();
      return rows[0] ? rowToEntry(rows[0]) : undefined;
    },
  };
}

function assertScope(scope: TenantScope, entry: AgentMemoryEntry): void {
  if (entry.tenantId !== scope.tenantId) {
    throw new Error(`agentMemoryEntry.tenantId must match scope`);
  }
}

function rowToEntry(row: AgentMemoryEntryRow): AgentMemoryEntry {
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId,
    agentKey: row.agentKey,
    ...(row.sessionId !== null ? { sessionId: row.sessionId } : {}),
    ...(row.issueKey !== null ? { issueKey: row.issueKey } : {}),
    kind: row.kind as AgentMemoryKind,
    text: row.text,
    tags: toStringArray(row.tags),
    sourceRefs: toSourceRefs(row.sourceRefs),
    contentHash: row.contentHash,
    ...(row.embeddingRef !== null ? { embeddingRef: row.embeddingRef } : {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(row.deletedAt !== null ? { deletedAt: row.deletedAt.toISOString() } : {}),
  };
}

function toStringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function toSourceRefs(value: unknown): readonly AgentMemorySourceRef[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw): AgentMemorySourceRef[] => {
    if (!raw || typeof raw !== "object") return [];
    const obj = raw as Record<string, unknown>;
    if (typeof obj["kind"] !== "string" || typeof obj["id"] !== "string") return [];
    return [{
      kind: obj["kind"],
      id: obj["id"],
      ...(typeof obj["uri"] === "string" ? { uri: obj["uri"] } : {}),
      ...(typeof obj["title"] === "string" ? { title: obj["title"] } : {}),
    }];
  });
}
