import { createHash, randomUUID } from "node:crypto";
import type { Implementation } from "@modelcontextprotocol/sdk/types.js";
import {
  AGENT_MEMORY_KINDS,
  type AgentMemoryEntry,
  type AgentMemoryKind,
  type AgentMemoryRecallMatch,
  type AgentMemoryRecallResult,
  type AgentMemorySourceRef,
} from "../domain/agentMemory.js";
import { PLACEHOLDER_SIGNATURE, type AuditEntry } from "../domain/auditEntry.js";
import type { McpSessionProfile } from "../mcp/sessionCapabilities.js";
import type { TenantScope } from "../domain/tenantScope.js";
import { redactUnsafeContent } from "../context/redaction.js";
import type { ProjectRepository } from "../storage/repositories/projectRepository.js";
import type { AgentMemoryRepository } from "../storage/repositories/agentMemoryRepository.js";
import type { AuditRepository } from "../storage/repositories/auditRepository.js";
import { auditPayloadHash, type AuditSigner } from "../security/auditChain.js";
import { createDisabledAgentMemoryVectorIndex, type AgentMemoryVectorIndex } from "./agentMemoryVectorIndex.js";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const MAX_CANDIDATES = 200;

export interface AgentMemorySessionContext {
  readonly sessionId?: string | undefined;
  readonly clientInfo?: Implementation | undefined;
}

export interface AgentMemoryRetainInput extends AgentMemorySessionContext {
  readonly projectId: string;
  readonly kind: AgentMemoryKind;
  readonly text: string;
  readonly tags?: readonly string[] | undefined;
  readonly issueKey?: string | undefined;
  readonly sourceRefs?: readonly AgentMemorySourceRef[] | undefined;
  readonly agentKey?: string | undefined;
  readonly auditToolName?: "memory_retain" | "memory_reflect" | undefined;
}

export interface AgentMemoryRetainResult {
  readonly entry: AgentMemoryEntry;
  readonly deduped: boolean;
  readonly vectorIndexed: boolean;
  readonly auditEntryId: string;
}

export interface AgentMemoryRecallInput extends AgentMemorySessionContext {
  readonly projectId: string;
  readonly query?: string | undefined;
  readonly tags?: readonly string[] | undefined;
  readonly kinds?: readonly AgentMemoryKind[] | undefined;
  readonly kind?: AgentMemoryKind | undefined;
  readonly issueKey?: string | undefined;
  readonly limit?: number | undefined;
  readonly agentKey?: string | undefined;
  readonly includeVector?: boolean | undefined;
}

export interface AgentMemoryReflectInput extends AgentMemorySessionContext {
  readonly projectId: string;
  readonly summary: string;
  readonly sourceMemoryIds: readonly string[];
  readonly tags?: readonly string[] | undefined;
  readonly issueKey?: string | undefined;
  readonly agentKey?: string | undefined;
}

export interface AgentMemoryForgetInput extends AgentMemorySessionContext {
  readonly projectId: string;
  readonly memoryId: string;
  readonly reason: string;
  readonly agentKey?: string | undefined;
}

export interface AgentMemoryForgetResult {
  readonly forgotten: boolean;
  readonly memoryId: string;
  readonly auditEntryId: string;
}

export function createAgentMemoryWorkflow(deps: {
  readonly projectRepository: ProjectRepository;
  readonly memoryRepository: AgentMemoryRepository;
  readonly auditRepository: AuditRepository;
  readonly auditSigner: AuditSigner;
  readonly vectorIndex?: AgentMemoryVectorIndex;
  readonly now?: () => string;
}) {
  const now = deps.now ?? (() => new Date().toISOString());
  const vectorIndex = deps.vectorIndex ?? createDisabledAgentMemoryVectorIndex("AGENT_MEMORY_VECTOR_ENABLED=false");

  const workflow = {
    async retain(scope: TenantScope, input: AgentMemoryRetainInput): Promise<AgentMemoryRetainResult> {
      await assertProjectExists(deps.projectRepository, scope, input.projectId);
      const auditToolName = input.auditToolName ?? "memory_retain";
      const agentKey = deriveAgentMemoryAgentKey(input);
      const tags = normalizeTags(input.tags);
      const text = normalizeMemoryText(input.text);
      const sourceRefs = normalizeSourceRefs(input.sourceRefs);
      const contentHash = hashMemoryContent({
        projectId: input.projectId,
        agentKey,
        ...(input.issueKey !== undefined ? { issueKey: input.issueKey } : {}),
        kind: input.kind,
        text,
        tags,
      });

      const duplicate = await deps.memoryRepository.findActiveDuplicate(scope, {
        projectId: input.projectId,
        agentKey,
        contentHash,
      });
      if (duplicate) {
        const audit = await appendAgentAudit(deps, scope, {
          toolName: auditToolName,
          agentKey,
          ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
          projectId: input.projectId,
          input,
          outputArtifactIds: [duplicate.id],
        });
        return { entry: duplicate, deduped: true, vectorIndexed: Boolean(duplicate.embeddingRef), auditEntryId: audit.id };
      }

      const timestamp = now();
      const baseEntry: AgentMemoryEntry = {
        id: randomUUID(),
        tenantId: scope.tenantId,
        projectId: input.projectId,
        agentKey,
        ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
        ...(input.issueKey !== undefined ? { issueKey: input.issueKey } : {}),
        kind: input.kind,
        text,
        tags,
        sourceRefs,
        contentHash,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const vectorResult = await tryVectorUpsert(vectorIndex, baseEntry);
      const entry: AgentMemoryEntry = vectorResult.embeddingRef
        ? { ...baseEntry, embeddingRef: vectorResult.embeddingRef }
        : baseEntry;
      await deps.memoryRepository.insert(scope, entry);
      const audit = await appendAgentAudit(deps, scope, {
        toolName: auditToolName,
        agentKey,
        ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
        projectId: input.projectId,
        input,
        outputArtifactIds: [entry.id],
      });
      return { entry, deduped: false, vectorIndexed: vectorResult.indexed, auditEntryId: audit.id };
    },

    async recall(scope: TenantScope, input: AgentMemoryRecallInput): Promise<AgentMemoryRecallResult> {
      await assertProjectExists(deps.projectRepository, scope, input.projectId);
      const agentKey = deriveAgentMemoryAgentKey(input);
      const limit = clampLimit(input.limit);
      const query = normalizeOptional(input.query);
      const tagFilter = normalizeTags(input.tags);
      const kinds = normalizeKinds(input.kinds, input.kind);
      const candidates = await deps.memoryRepository.recallCandidates(scope, {
        projectId: input.projectId,
        agentKey,
        ...(input.issueKey !== undefined ? { issueKey: input.issueKey } : {}),
        ...(kinds.length > 0 ? { kinds } : {}),
        limit: MAX_CANDIDATES,
      });

      const vectorMatches = await recallVectorMatches({
        vectorIndex,
        scope,
        projectId: input.projectId,
        agentKey,
        query,
        limit,
        includeVector: input.includeVector ?? true,
      });
      const vectorById = new Map(vectorMatches.matches.map((m) => [m.memoryId, m.score]));
      const vectorOnly = vectorMatches.matches.length > 0
        ? await deps.memoryRepository.findManyByIds(scope, {
            projectId: input.projectId,
            agentKey,
            ids: vectorMatches.matches.map((m) => m.memoryId),
          })
        : [];
      const byId = new Map<string, AgentMemoryEntry>();
      for (const entry of candidates) byId.set(entry.id, entry);
      for (const entry of vectorOnly) byId.set(entry.id, entry);

      const matches = [...byId.values()]
        .map((entry) => scoreEntry(entry, { query, tagFilter, vectorScore: vectorById.get(entry.id) }))
        .filter((match) => shouldInclude(match, { query, tagFilter }))
        .sort((a, b) => b.score - a.score || b.entry.updatedAt.localeCompare(a.entry.updatedAt))
        .slice(0, limit);

      return {
        entries: matches,
        deterministicAvailable: true,
        vectorAvailable: vectorMatches.available,
        vectorAttempted: vectorMatches.attempted,
        ...(query !== undefined ? { query } : {}),
      };
    },

    async reflect(scope: TenantScope, input: AgentMemoryReflectInput): Promise<AgentMemoryRetainResult> {
      if (input.sourceMemoryIds.length === 0) {
        throw new Error("sourceMemoryIds must include at least one memory id");
      }
      const agentKey = deriveAgentMemoryAgentKey(input);
      const sources = await deps.memoryRepository.findManyByIds(scope, {
        projectId: input.projectId,
        agentKey,
        ids: input.sourceMemoryIds,
      });
      if (sources.length !== input.sourceMemoryIds.length) {
        throw new Error("all sourceMemoryIds must belong to the same project and agent");
      }
      return workflow.retain(scope, {
        projectId: input.projectId,
        kind: "reflection",
        text: input.summary,
        tags: normalizeTags([...(input.tags ?? []), "reflection"]),
        ...(input.issueKey !== undefined ? { issueKey: input.issueKey } : {}),
        agentKey,
        ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
        ...(input.clientInfo !== undefined ? { clientInfo: input.clientInfo } : {}),
        auditToolName: "memory_reflect",
        sourceRefs: sources.map((entry) => ({ kind: "agent_memory", id: entry.id })),
      });
    },

    async forget(scope: TenantScope, input: AgentMemoryForgetInput): Promise<AgentMemoryForgetResult> {
      await assertProjectExists(deps.projectRepository, scope, input.projectId);
      const agentKey = deriveAgentMemoryAgentKey(input);
      const deleted = await deps.memoryRepository.softDelete(scope, {
        id: input.memoryId,
        projectId: input.projectId,
        agentKey,
        deletedAt: now(),
      });
      const audit = await appendAgentAudit(deps, scope, {
        toolName: "memory_forget",
        agentKey,
        ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
        projectId: input.projectId,
        input: { projectId: input.projectId, memoryId: input.memoryId, reason: input.reason, agentKey },
        outputArtifactIds: [input.memoryId],
        ...(deleted ? {} : { errorState: "memory_not_found" }),
      });
      return { forgotten: Boolean(deleted), memoryId: input.memoryId, auditEntryId: audit.id };
    },
  };
  return workflow;
}

export function agentMemorySessionContext(profile: McpSessionProfile | undefined): AgentMemorySessionContext {
  if (!profile) return {};
  return {
    sessionId: profile.sessionId,
    ...(profile.clientInfo !== undefined ? { clientInfo: profile.clientInfo } : {}),
  };
}

export function deriveAgentMemoryAgentKey(input: {
  readonly agentKey?: string | undefined;
  readonly clientInfo?: Implementation | undefined;
}): string {
  const explicit = normalizeOptional(input.agentKey);
  if (explicit !== undefined) return explicit;
  const name = normalizeOptional(input.clientInfo?.name);
  const version = normalizeOptional(input.clientInfo?.version);
  if (name && version) return `${name}@${version}`;
  if (name) return name;
  return "unknown-agent";
}

function normalizeMemoryText(text: string): string {
  const redacted = redactUnsafeContent(text).trim();
  if (!redacted) throw new Error("memory text must be non-empty after redaction");
  return redacted;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeTags(tags: readonly string[] | undefined): readonly string[] {
  const unique = new Set<string>();
  for (const raw of tags ?? []) {
    const tag = raw.trim().toLowerCase();
    if (tag) unique.add(tag);
  }
  return [...unique].sort();
}

function normalizeKinds(kinds: readonly AgentMemoryKind[] | undefined, kind: AgentMemoryKind | undefined): readonly AgentMemoryKind[] {
  const values = new Set<AgentMemoryKind>();
  if (kind) values.add(kind);
  for (const value of kinds ?? []) {
    if (AGENT_MEMORY_KINDS.includes(value)) values.add(value);
  }
  return [...values].sort();
}

function normalizeSourceRefs(sourceRefs: readonly AgentMemorySourceRef[] | undefined): readonly AgentMemorySourceRef[] {
  return (sourceRefs ?? []).map((ref) => {
    const uri = normalizeOptional(ref.uri);
    const title = normalizeOptional(ref.title);
    return {
      kind: ref.kind.trim(),
      id: ref.id.trim(),
      ...(uri !== undefined ? { uri } : {}),
      ...(title !== undefined ? { title } : {}),
    };
  }).filter((ref) => ref.kind && ref.id);
}

function hashMemoryContent(input: {
  readonly projectId: string;
  readonly agentKey: string;
  readonly issueKey?: string | undefined;
  readonly kind: AgentMemoryKind;
  readonly text: string;
  readonly tags: readonly string[];
}): string {
  return auditPayloadHash(input);
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit)));
}

async function assertProjectExists(projectRepository: ProjectRepository, scope: TenantScope, projectId: string): Promise<void> {
  const project = await projectRepository.findById(scope, projectId);
  if (!project) throw new Error(`project not found: ${projectId}`);
}

async function tryVectorUpsert(vectorIndex: AgentMemoryVectorIndex, entry: AgentMemoryEntry): Promise<{
  readonly indexed: boolean;
  readonly embeddingRef?: string;
}> {
  if (!vectorIndex.enabled) return { indexed: false };
  try {
    const result = await vectorIndex.upsert(entry);
    return {
      indexed: result.indexed,
      ...(result.embeddingRef !== undefined ? { embeddingRef: result.embeddingRef } : {}),
    };
  } catch {
    return { indexed: false };
  }
}

async function recallVectorMatches(input: {
  readonly vectorIndex: AgentMemoryVectorIndex;
  readonly scope: TenantScope;
  readonly projectId: string;
  readonly agentKey: string;
  readonly query: string | undefined;
  readonly limit: number;
  readonly includeVector: boolean;
}): Promise<{ readonly attempted: boolean; readonly available: boolean; readonly matches: readonly { memoryId: string; score: number }[] }> {
  if (!input.includeVector || !input.query) {
    return { attempted: false, available: false, matches: [] };
  }
  if (!input.vectorIndex.enabled) {
    return { attempted: true, available: false, matches: [] };
  }
  try {
    const result = await input.vectorIndex.search({
      tenantId: input.scope.tenantId,
      projectId: input.projectId,
      agentKey: input.agentKey,
      query: input.query,
      limit: input.limit,
    });
    return { attempted: true, available: result.available, matches: result.matches };
  } catch {
    return { attempted: true, available: false, matches: [] };
  }
}

function scoreEntry(entry: AgentMemoryEntry, input: {
  readonly query: string | undefined;
  readonly tagFilter: readonly string[];
  readonly vectorScore: number | undefined;
}): AgentMemoryRecallMatch {
  const reasons: string[] = [];
  let score = recencyScore(entry.updatedAt);
  if (input.query) {
    const haystack = `${entry.kind} ${entry.text} ${entry.tags.join(" ")} ${entry.issueKey ?? ""}`.toLowerCase();
    const tokens = tokenize(input.query);
    let hits = 0;
    for (const token of tokens) {
      if (haystack.includes(token)) hits += 1;
    }
    if (hits > 0) reasons.push(`keyword:${hits}`);
    score += hits * 10;
  } else {
    reasons.push("recent");
  }
  if (input.tagFilter.length > 0) {
    const tagHits = input.tagFilter.filter((tag) => entry.tags.includes(tag)).length;
    if (tagHits > 0) reasons.push(`tag:${tagHits}`);
    score += tagHits * 8;
  }
  if (input.vectorScore !== undefined) {
    reasons.push("vector");
    score += input.vectorScore * 20;
  }
  return { entry, score, reasons };
}

function shouldInclude(match: AgentMemoryRecallMatch, input: {
  readonly query: string | undefined;
  readonly tagFilter: readonly string[];
}): boolean {
  const hasQuery = input.query !== undefined;
  const hasTags = input.tagFilter.length > 0;
  if (!hasQuery && !hasTags) return true;
  return match.reasons.some((reason) => reason.startsWith("keyword:") || reason.startsWith("tag:") || reason === "vector");
}

function tokenize(query: string): readonly string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function recencyScore(updatedAt: string): number {
  const time = Date.parse(updatedAt);
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, Math.min(5, time / 8.64e13));
}

async function appendAgentAudit(deps: {
  readonly auditRepository: AuditRepository;
  readonly auditSigner: AuditSigner;
}, scope: TenantScope, input: {
  readonly toolName: string;
  readonly agentKey: string;
  readonly sessionId?: string;
  readonly projectId: string;
  readonly input: unknown;
  readonly outputArtifactIds?: readonly string[];
  readonly errorState?: string;
}): Promise<AuditEntry> {
  const principalId = `agent:${input.agentKey}`;
  const unsigned: AuditEntry = {
    id: randomUUID(),
    tenantId: scope.tenantId,
    projectId: input.projectId,
    timestamp: new Date().toISOString(),
    actor: {
      mcpPrincipalId: principalId,
      mcpPrincipalFingerprint: sha256Hex(principalId).slice(0, 16),
      credentialFingerprint: sha256Hex(input.sessionId ?? "no-session").slice(0, 16),
      authMode: "service_account",
    },
    toolName: input.toolName,
    inputHash: auditPayloadHash(input.input ?? {}),
    ...(input.outputArtifactIds ? { outputArtifactIds: input.outputArtifactIds } : {}),
    ...(input.errorState ? { errorState: input.errorState } : {}),
    prevHash: "",
    signature: PLACEHOLDER_SIGNATURE,
  };
  const signed = deps.auditSigner.sign(unsigned);
  return deps.auditRepository.append(scope, { entry: signed });
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
