import type { AgentMemoryEntry } from "../domain/agentMemory.js";
import { z } from "zod";

export interface AgentMemoryVectorMatch {
  readonly memoryId: string;
  readonly score: number;
}

export interface AgentMemoryVectorSearchResult {
  readonly available: boolean;
  readonly matches: readonly AgentMemoryVectorMatch[];
  readonly reason?: string;
}

export interface AgentMemoryVectorUpsertResult {
  readonly indexed: boolean;
  readonly embeddingRef?: string;
  readonly reason?: string;
}

export interface AgentMemoryVectorIndex {
  readonly enabled: boolean;
  readonly name: string;
  upsert(entry: AgentMemoryEntry): Promise<AgentMemoryVectorUpsertResult>;
  search(input: {
    readonly tenantId: string;
    readonly projectId: string;
    readonly agentKey: string;
    readonly query: string;
    readonly limit: number;
  }): Promise<AgentMemoryVectorSearchResult>;
}

export interface QdrantAgentMemoryVectorIndexConfig {
  readonly url: string;
  readonly apiKey?: string;
  readonly collection: string;
  readonly dimensions: number;
  readonly fetchImpl?: typeof fetch;
}

export function createDisabledAgentMemoryVectorIndex(reason: string): AgentMemoryVectorIndex {
  return {
    enabled: false,
    name: "disabled",
    async upsert() {
      return { indexed: false, reason };
    },
    async search() {
      return { available: false, matches: [], reason };
    },
  };
}

export function createQdrantAgentMemoryVectorIndex(config: QdrantAgentMemoryVectorIndexConfig): AgentMemoryVectorIndex {
  const baseUrl = config.url.replace(/\/+$/, "");
  const fetchImpl = config.fetchImpl ?? fetch;
  let collectionReady = false;

  return {
    enabled: true,
    name: "qdrant",
    async upsert(entry) {
      await ensureCollection();
      const res = await requestJson(
        `/collections/${encodeURIComponent(config.collection)}/points?wait=true`,
        {
          method: "PUT",
          body: JSON.stringify({
            points: [{
              id: entry.id,
              vector: embedText(entry.text, config.dimensions),
              payload: {
                tenantId: entry.tenantId,
                projectId: entry.projectId,
                agentKey: entry.agentKey,
                kind: entry.kind,
                tags: entry.tags,
              },
            }],
          }),
        },
      );
      upsertResponse.parse(res);
      return { indexed: true, embeddingRef: `qdrant:${config.collection}:${entry.id}` };
    },
    async search(input) {
      await ensureCollection();
      const raw = await requestJson(
        `/collections/${encodeURIComponent(config.collection)}/points/search`,
        {
          method: "POST",
          body: JSON.stringify({
            vector: embedText(input.query, config.dimensions),
            limit: input.limit,
            with_payload: false,
            filter: {
              must: [
                { key: "tenantId", match: { value: input.tenantId } },
                { key: "projectId", match: { value: input.projectId } },
                { key: "agentKey", match: { value: input.agentKey } },
              ],
            },
          }),
        },
      );
      const parsed = searchResponse.parse(raw);
      return {
        available: true,
        matches: parsed.result.map((point) => ({ memoryId: String(point.id), score: point.score })),
      };
    },
  };

  async function ensureCollection(): Promise<void> {
    if (collectionReady) return;
    const get = await fetchImpl(`${baseUrl}/collections/${encodeURIComponent(config.collection)}`, {
      method: "GET",
      headers: requestHeaders(),
    });
    if (get.ok) {
      collectionReady = true;
      return;
    }
    const create = await fetchImpl(`${baseUrl}/collections/${encodeURIComponent(config.collection)}`, {
      method: "PUT",
      headers: requestHeaders(),
      body: JSON.stringify({
        vectors: {
          size: config.dimensions,
          distance: "Cosine",
        },
      }),
    });
    if (!create.ok) {
      throw new Error(`Qdrant collection create failed: ${create.status} ${create.statusText}`);
    }
    collectionReady = true;
  }

  async function requestJson(path: string, init: RequestInit): Promise<unknown> {
    const res = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      headers: {
        ...requestHeaders(),
        ...headersToRecord(init.headers),
      },
    });
    if (!res.ok) {
      throw new Error(`Qdrant request failed: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<unknown>;
  }

  function requestHeaders(): Record<string, string> {
    return {
      accept: "application/json",
      "content-type": "application/json",
      ...(config.apiKey ? { "api-key": config.apiKey } : {}),
    };
  }
}

const upsertResponse = z.object({ status: z.string().optional() }).passthrough();
const searchResponse = z.object({
  result: z.array(z.object({
    id: z.union([z.string(), z.number()]),
    score: z.number(),
  }).passthrough()),
}).passthrough();

function embedText(text: string, dimensions: number): readonly number[] {
  if (!Number.isInteger(dimensions) || dimensions < 8) {
    throw new Error("agent memory vector dimensions must be an integer >= 8");
  }
  const vector = Array.from({ length: dimensions }, () => 0);
  for (const token of tokenize(text)) {
    const h = hashToken(token);
    const index = h % dimensions;
    const sign = (h & 1) === 0 ? 1 : -1;
    vector[index] = (vector[index] ?? 0) + sign;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) return vector;
  return vector.map((value) => value / norm);
}

function tokenize(text: string): readonly string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function hashToken(token: string): number {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function headersToRecord(headers: RequestInit["headers"] | undefined): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) {
    const out: Record<string, string> = {};
    for (const [key, value] of headers) {
      if (key !== undefined && value !== undefined) out[key] = value;
    }
    return out;
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key] = typeof value === "string" ? value : value.join(", ");
  }
  return out;
}
