// UIO partner adapter — M2 ships REACHABILITY ONLY.
//
// Full ingest path (uio_ingest, uio_status, uio_catalog, vector reuse) lands
// with M4 (blueprint workflow). M2 only needs to answer "is UIO reachable
// when configured?" so project_preflight_check can populate UioPartnerProfile.
//
// See docs/partners/uio.md for the full integration contract.

import type { Logger } from "pino";
import { z } from "zod";
import type { UioPartnerProfile } from "../../domain/projectProfile.js";

export interface UioAdapterConfig {
  readonly enabled: boolean;
  readonly baseUrl?: string;
  readonly apiKey?: string;
  readonly qdrantUrl?: string;
  readonly qdrantApiKey?: string;
  readonly defaultCollection?: string;
  readonly logger: Logger;
  readonly fetchImpl?: typeof fetch;
}

export interface UioAdapter {
  readonly enabled: boolean;
  /** Probe UIO base URL + Qdrant + default collection. Returns a populated profile. */
  probe(): Promise<UioPartnerProfile | undefined>;
  ingest(input: UioIngestInput): Promise<UioEnvelope>;
  status(envelopeId: string): Promise<UioEnvelope>;
  getCatalogEntry(sourceId: string): Promise<UioCatalogEntry>;
}

export interface UioIngestInput {
  readonly sourceType: "file_drop";
  readonly rawContent: { readonly garageKey: string };
  readonly metadata: Readonly<Record<string, string>>;
}

export interface UioEnvelope {
  readonly envelopeId: string;
  readonly status: "queued" | "processing" | "completed" | "failed";
  readonly sourceId?: string;
  readonly error?: string;
}

export interface UioCatalogEntry {
  readonly sourceId: string;
  readonly title?: string;
  readonly version?: string;
}

const envelopeSchema = z.object({
  envelope_id: z.string().optional(),
  envelopeId: z.string().optional(),
  status: z.enum(["queued", "processing", "completed", "failed"]),
  source_id: z.string().optional(),
  sourceId: z.string().optional(),
  error: z.string().optional(),
}).passthrough();

const catalogSchema = z.object({
  source_id: z.string().optional(),
  sourceId: z.string().optional(),
  title: z.string().optional(),
  version: z.string().optional(),
  version_hash: z.string().optional(),
}).passthrough();

export function createUioAdapter(config: UioAdapterConfig): UioAdapter {
  const fetchImpl = config.fetchImpl ?? fetch;

  if (!config.enabled) {
    return {
      enabled: false,
      async probe() {
        return undefined;
      },
      async ingest() {
        throw new Error("UIO is disabled");
      },
      async status() {
        throw new Error("UIO is disabled");
      },
      async getCatalogEntry() {
        throw new Error("UIO is disabled");
      },
    };
  }

  if (!config.baseUrl) {
    config.logger.warn(
      "UIO_ENABLED=true but UIO_BASE_URL is unset; preflight will report uio as unreachable",
    );
  }

  return {
    enabled: true,
    async probe(): Promise<UioPartnerProfile | undefined> {
      const baseUrlReachable = config.baseUrl ? await ping(config.baseUrl + "/api/v1/healthz", config) : false;
      const qdrantReachable = config.qdrantUrl
        ? await ping(config.qdrantUrl + "/healthz", config)
        : false;
      const defaultCollectionExists = config.qdrantUrl && config.defaultCollection
        ? await ping(`${config.qdrantUrl}/collections/${encodeURIComponent(config.defaultCollection)}`, config)
        : false;
      const apiKeyValid = baseUrlReachable && Boolean(config.apiKey);

      return { baseUrlReachable, qdrantReachable, defaultCollectionExists, apiKeyValid };
    },
    async ingest(input) {
      const body = {
        source_type: input.sourceType,
        raw_content: { garage_key: input.rawContent.garageKey },
        metadata: input.metadata,
      };
      const raw = await requestJson("/api/v1/intake", { method: "POST", body: JSON.stringify(body) });
      return toEnvelope(raw);
    },
    async status(envelopeId) {
      const raw = await requestJson(`/api/v1/intake/${encodeURIComponent(envelopeId)}`, { method: "GET" });
      return toEnvelope(raw);
    },
    async getCatalogEntry(sourceId) {
      const raw = await requestJson(`/api/v1/catalog/${encodeURIComponent(sourceId)}`, { method: "GET" });
      return toCatalogEntry(raw, sourceId);
    },
  };

  async function requestJson(path: string, init: RequestInit): Promise<unknown> {
    if (!config.baseUrl) throw new Error("UIO_BASE_URL is required for UIO API calls");
    const res = await fetchImpl(config.baseUrl + path, {
      ...init,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        ...(config.apiKey ? { "x-api-key": config.apiKey } : {}),
        ...headersToRecord(init.headers),
      },
    });
    if (!res.ok) throw new Error(`UIO request failed: ${res.status} ${res.statusText}`);
    return res.json() as Promise<unknown>;
  }

  async function ping(url: string, c: UioAdapterConfig): Promise<boolean> {
    try {
      const headers: Record<string, string> = { accept: "application/json" };
      if (c.apiKey && url.startsWith(c.baseUrl ?? "")) headers["x-api-key"] = c.apiKey;
      if (c.qdrantApiKey && c.qdrantUrl && url.startsWith(c.qdrantUrl)) headers["api-key"] = c.qdrantApiKey;
      const res = await fetchImpl(url, { method: "GET", headers });
      return res.ok;
    } catch (err) {
      c.logger.debug({ err, url }, "uio probe failed");
      return false;
    }
  }
}

function toEnvelope(raw: unknown): UioEnvelope {
  const parsed = envelopeSchema.parse(raw);
  const envelopeId = parsed.envelopeId ?? parsed.envelope_id;
  if (!envelopeId) throw new Error("UIO envelope missing envelope id");
  const sourceId = parsed.sourceId ?? parsed.source_id;
  return {
    envelopeId,
    status: parsed.status,
    ...(sourceId !== undefined ? { sourceId } : {}),
    ...(parsed.error !== undefined ? { error: parsed.error } : {}),
  };
}

function toCatalogEntry(raw: unknown, fallbackSourceId: string): UioCatalogEntry {
  const parsed = catalogSchema.parse(raw);
  const sourceId = parsed.sourceId ?? parsed.source_id ?? fallbackSourceId;
  const version = parsed.version ?? parsed.version_hash;
  return {
    sourceId,
    ...(parsed.title !== undefined ? { title: parsed.title } : {}),
    ...(version !== undefined ? { version } : {}),
  };
}

type HeaderInput = RequestInit["headers"];

function headersToRecord(headers: HeaderInput | undefined): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) {
    const record: Record<string, string> = {};
    for (const [key, value] of headers) {
      if (key !== undefined && value !== undefined) record[key] = value;
    }
    return record;
  }
  const record: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    record[key] = typeof value === "string" ? value : value.join(", ");
  }
  return record;
}
