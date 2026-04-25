// confluenceRestProvider — Confluence v2 REST implementation.
//
// M2 surface:
//   - discoverSpaceCapabilities() via GET /api/v2/spaces/{id}
//   - getPage / createPage / updatePage / contentProperty CRUD
//   - storage representation by default; atlas_doc_format gated by feature flag
//
// M6b uses these for actual page provisioning + idempotent upsert.

import type { Logger } from "pino";
import type {
  ConfluenceProvider,
  ConfluencePage,
  CreatePageInput,
  UpdatePagePatch,
  ContentProperty,
} from "./confluenceProvider.js";
import type { ConfluenceSpaceProfile } from "../../domain/projectProfile.js";
import type { AtlassianAuthProvider } from "./auth/types.js";
import type { ProviderHealth } from "../Provider.js";
import { createRestClient, type RestClient, type RestClientConfig } from "../http/restClient.js";

export interface ConfluenceRestProviderConfig {
  readonly baseUrl: string;       // e.g. https://your-site.atlassian.net/wiki
  readonly auth: AtlassianAuthProvider;
  readonly logger: Logger;
  readonly userAgent?: string;
  /** Feature flag — when false, atlas_doc_format requests are rejected. */
  readonly atlasDocFormatEnabled?: boolean;
  readonly restClient?: RestClient;
}

export function createConfluenceRestProvider(config: ConfluenceRestProviderConfig): ConfluenceProvider {
  const client =
    config.restClient ??
    createRestClient({
      baseUrl: config.baseUrl,
      userAgent: config.userAgent ?? "atl-mcp-orchestrator/0.1.0",
      getAuthHeader: () => config.auth.getAuthHeader(),
      logger: config.logger,
    } satisfies RestClientConfig);

  const adfEnabled = config.atlasDocFormatEnabled === true;

  function assertBodyAllowed(rep: string): void {
    if (rep === "atlas_doc_format" && !adfEnabled) {
      throw new Error(
        "atlas_doc_format requested but feature flag is disabled — see ADR 0003 + v6 §11",
      );
    }
  }

  async function discoverSpaceCapabilities(spaceKeyOrId: string): Promise<ConfluenceSpaceProfile> {
    // Confluence v2 quirk:
    //   /api/v2/spaces/{id}     — REQUIRES a numeric id; 400s on a key.
    //   /api/v2/spaces?keys=K   — lookup by key, returns paged results.
    // We accept either: numeric → id path, otherwise → keys query.
    const isNumericId = /^\d+$/.test(spaceKeyOrId);
    let space: ConfluenceSpaceResponse;
    if (isNumericId) {
      const res = await client.request<ConfluenceSpaceResponse>({
        method: "GET",
        path: `/api/v2/spaces/${encodeURIComponent(spaceKeyOrId)}`,
      });
      space = res.body;
    } else {
      const res = await client.request<{ readonly results: readonly ConfluenceSpaceResponse[] }>({
        method: "GET",
        path: "/api/v2/spaces",
        query: { keys: spaceKeyOrId, limit: 1 },
      });
      const found = res.body.results[0];
      if (!found) {
        throw new Error(`confluence space not found: keys=${spaceKeyOrId}`);
      }
      space = found;
    }
    return {
      spaceKey: space.key,
      spaceId: space.id,
      bodyRepresentations: adfEnabled ? ["storage", "atlas_doc_format"] : ["storage"],
    };
  }

  return {
    name: "confluence-rest",
    kind: "atlassian.confluence",

    async healthCheck(): Promise<ProviderHealth> {
      const start = Date.now();
      try {
        await client.request({ method: "GET", path: "/api/v2/spaces", query: { limit: 1 } });
        return { reachable: true, checkedAt: new Date().toISOString(), latencyMs: Date.now() - start };
      } catch (err) {
        return {
          reachable: false,
          checkedAt: new Date().toISOString(),
          details: err instanceof Error ? err.message : String(err),
        };
      }
    },

    discoverSpaceCapabilities,

    async getPage(pageId: string): Promise<ConfluencePage> {
      const res = await client.request<ConfluencePageResponse>({
        method: "GET",
        path: `/api/v2/pages/${encodeURIComponent(pageId)}`,
        query: { "body-format": "storage" },
      });
      return toConfluencePage(res.body);
    },

    async createPage(input: CreatePageInput): Promise<ConfluencePage> {
      assertBodyAllowed(input.body.representation);
      const body: Record<string, unknown> = {
        spaceId: input.spaceId,
        status: "current",
        title: input.title,
        body: { representation: input.body.representation, value: input.body.value },
        ...(input.parentId ? { parentId: input.parentId } : {}),
      };
      const res = await client.request<ConfluencePageResponse>({
        method: "POST",
        path: "/api/v2/pages",
        body,
        ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
      });
      return toConfluencePage(res.body);
    },

    async updatePage(pageId: string, patch: UpdatePagePatch): Promise<ConfluencePage> {
      if (patch.body) assertBodyAllowed(patch.body.representation);
      const body: Record<string, unknown> = {
        id: pageId,
        status: "current",
        version: { number: patch.version },
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.body
          ? { body: { representation: patch.body.representation, value: patch.body.value } }
          : {}),
      };
      const res = await client.request<ConfluencePageResponse>({
        method: "PUT",
        path: `/api/v2/pages/${encodeURIComponent(pageId)}`,
        body,
      });
      return toConfluencePage(res.body);
    },

    async getContentProperty(pageId: string, key: string): Promise<ContentProperty | undefined> {
      try {
        const res = await client.request<ConfluenceContentPropertyResponse>({
          method: "GET",
          path: `/api/v2/pages/${encodeURIComponent(pageId)}/properties`,
          query: { key },
        });
        const found = res.body.results.find((p) => p.key === key);
        return found ? toProperty(found) : undefined;
      } catch (err) {
        if (err instanceof Error && err.message.includes("404")) return undefined;
        throw err;
      }
    },

    async setContentProperty(pageId: string, key: string, value: unknown): Promise<ContentProperty> {
      const existing = await this.getContentProperty(pageId, key);
      if (existing) {
        const res = await client.request<ConfluenceContentPropertyResponse["results"][number]>({
          method: "PUT",
          path: `/api/v2/pages/${encodeURIComponent(pageId)}/properties/${encodeURIComponent(existing.key)}`,
          body: { key, value, version: { number: existing.version + 1 } },
        });
        return toProperty(res.body);
      }
      const res = await client.request<ConfluenceContentPropertyResponse["results"][number]>({
        method: "POST",
        path: `/api/v2/pages/${encodeURIComponent(pageId)}/properties`,
        body: { key, value },
      });
      return toProperty(res.body);
    },
  };
}

function toConfluencePage(raw: ConfluencePageResponse): ConfluencePage {
  // body may be {} on responses that didn't request a body-format; treat that
  // as "no body present" so callers don't see ConfluenceBody with empty fields.
  const hasBody = raw.body && raw.body.representation && raw.body.value !== undefined;
  return {
    id: raw.id,
    spaceId: raw.spaceId,
    title: raw.title,
    version: raw.version?.number ?? 1,
    body: hasBody
      ? {
          representation: raw.body!.representation as "storage" | "atlas_doc_format",
          value: raw.body!.value!,
        }
      : undefined,
  };
}

function toProperty(raw: { key: string; value: unknown; version?: { number: number } }): ContentProperty {
  return { key: raw.key, value: raw.value, version: raw.version?.number ?? 1 };
}

// ----- Wire types (subset) -----

interface ConfluenceSpaceResponse {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly type?: string;
  readonly status?: string;
}

interface ConfluencePageResponse {
  readonly id: string;
  readonly spaceId: string;
  readonly title: string;
  // version has more fields than just `number` (authorId, createdAt, message,
  // minorEdit, ncsStepVersion); we only consume `number`. Optional because
  // some endpoints return the page without expanding version.
  readonly version?: { readonly number: number; readonly [k: string]: unknown };
  // body may be `{}` (empty object) when no body-format is requested in the
  // query; we treat empty as "no body fetched".
  readonly body?: { readonly representation?: string; readonly value?: string };
}

interface ConfluenceContentPropertyResponse {
  readonly results: ReadonlyArray<{ key: string; value: unknown; version?: { number: number } }>;
}
