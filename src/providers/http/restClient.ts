// REST client used by all Atlassian providers (and the UIO adapter).
// Built on undici for HTTP/2 + connection pooling + native fetch semantics.
//
// Responsibilities:
//   - Authentication header injection (provided per-request via getAuthHeader).
//   - Idempotency-key tagging on writes (see note on X-Idempotency-Key below).
//   - Retry per retry.ts.
//   - Error normalization: 4xx → ProviderClientError, 5xx → ProviderServerError.
//
// X-Idempotency-Key is the orchestrator's INTERNAL tracking header for retried
// writes. Atlassian REST v3 does not act on it — Atlassian has no documented
// idempotency-key support for issue/page creation. End-to-end idempotency
// instead comes from app-level upsert logic in M5/M6a (project-foundation F-027:
// check-before-write keyed on stable artifact IDs). The header here is fine
// for our own audit trail + log correlation, just not load-bearing for dedupe.
//
// Test seam: createRestClient accepts a `fetch`-like injection so tests can
// drive recorded fixtures without mocking undici directly.

import type { Logger } from "pino";
import { decideRetry, DEFAULT_RETRY_CONFIG, type RetryConfig, sleep } from "./retry.js";
import { defaultFetch, buildUrl, normalizeHeaders, safeJsonParse, generateIdempotencyKey } from "./restHttpAdapter.js";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";

export interface RestRequest {
  readonly method: HttpMethod;
  readonly path: string;            // relative to baseUrl, e.g. "/rest/api/3/issue"
  readonly query?: Readonly<Record<string, string | number | boolean | undefined>>;
  readonly body?: unknown;          // JSON-serialized if present
  readonly headers?: Readonly<Record<string, string>>;
  /** Optional override of the idempotency key; otherwise generated for write methods. */
  readonly idempotencyKey?: string;
}

export interface RestResponse<T = unknown> {
  readonly status: number;
  readonly body: T;
  readonly headers: Readonly<Record<string, string>>;
}

export interface RestClientConfig {
  readonly baseUrl: string;
  readonly userAgent: string;
  /** Returns the Authorization header value(s) to inject per-request. */
  readonly getAuthHeader: () => Promise<string | undefined>;
  readonly retry?: RetryConfig;
  readonly logger: Logger;
  /**
   * Test injection point. When provided, used instead of undici. Useful for
   * recorded-fixture tests that don't want a real network stack.
   */
  readonly fetchOverride?: FetchLike;
}

export interface FetchLike {
  (
    url: string,
    init: { method: string; headers: Record<string, string>; body?: string },
  ): Promise<{
    statusCode: number;
    headers: Record<string, string | string[] | undefined>;
    body: { text(): Promise<string>; json(): Promise<unknown> };
  }>;
}

export interface RestClient {
  request<T = unknown>(req: RestRequest): Promise<RestResponse<T>>;
}

const WRITE_METHODS: ReadonlySet<HttpMethod> = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export class ProviderClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly responseBody: unknown,
  ) {
    super(message);
    this.name = "ProviderClientError";
  }
}
export class ProviderServerError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly responseBody: unknown,
  ) {
    super(message);
    this.name = "ProviderServerError";
  }
}
export class ProviderTransportError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ProviderTransportError";
  }
}

export function createRestClient(config: RestClientConfig): RestClient {
  const retry = config.retry ?? DEFAULT_RETRY_CONFIG;
  const fetchFn = config.fetchOverride ?? defaultFetch;

  return {
    async request<T = unknown>(req: RestRequest): Promise<RestResponse<T>> {
      const url = buildUrl(config.baseUrl, req.path, req.query);
      const auth = await config.getAuthHeader();

      const baseHeaders: Record<string, string> = {
        "user-agent": config.userAgent,
        accept: "application/json",
      };
      if (auth) baseHeaders["authorization"] = auth;
      if (req.body !== undefined) baseHeaders["content-type"] = "application/json";
      if (WRITE_METHODS.has(req.method)) {
        baseHeaders["x-idempotency-key"] = req.idempotencyKey ?? generateIdempotencyKey();
      }
      for (const [k, v] of Object.entries(req.headers ?? {})) baseHeaders[k.toLowerCase()] = v;

      const bodyStr = req.body !== undefined ? JSON.stringify(req.body) : undefined;

      let attempt = 0;
      while (true) {
        let res: Awaited<ReturnType<FetchLike>>;
        try {
          const init: { method: string; headers: Record<string, string>; body?: string } = {
            method: req.method,
            headers: baseHeaders,
            ...(bodyStr !== undefined ? { body: bodyStr } : {}),
          };
          res = await fetchFn(url, init);
        } catch (err) {
          throw new ProviderTransportError(`transport error during ${req.method} ${req.path}`, { cause: err });
        }

        const headersMap = normalizeHeaders(res.headers);

        // Decide retry before reading the body — saves an unneeded body read on retry.
        const delay = decideRetry({ statusCode: res.statusCode, headers: res.headers }, attempt, retry);
        if (delay !== null) {
          // Drain body to free the connection.
          await res.body.text().catch(() => undefined);
          config.logger.debug(
            { url, method: req.method, status: res.statusCode, attempt, delay },
            "retrying http request",
          );
          await sleep(delay);
          attempt++;
          continue;
        }

        const text = await res.body.text();
        const parsed = text.length > 0 ? safeJsonParse(text) : undefined;

        if (res.statusCode >= 200 && res.statusCode < 300) {
          return { status: res.statusCode, body: parsed as T, headers: headersMap };
        }
        if (res.statusCode >= 400 && res.statusCode < 500) {
          throw new ProviderClientError(
            `${req.method} ${req.path} → ${res.statusCode}`,
            res.statusCode,
            parsed,
          );
        }
        throw new ProviderServerError(
          `${req.method} ${req.path} → ${res.statusCode}`,
          res.statusCode,
          parsed,
        );
      }
    },
  };
}

