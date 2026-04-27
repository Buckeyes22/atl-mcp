// REST client behavior tests using a fake fetch (no network).

import { describe, expect, it, vi } from "vitest";
import { pino } from "pino";
import {
  createRestClient,
  ProviderClientError,
  ProviderServerError,
  type FetchLike,
} from "../../../../src/providers/http/restClient.js";

const silentLogger = pino({ level: "silent" });

function makeFetch(responses: Array<{ status: number; body?: unknown; headers?: Record<string, string> }>): FetchLike {
  let i = 0;
  return async (_url: string, _init) => {
    const r = responses[i] ?? responses[responses.length - 1]!;
    i++;
    return {
      statusCode: r.status,
      headers: r.headers ?? {},
      body: {
        text: async () => (r.body !== undefined ? JSON.stringify(r.body) : ""),
        json: async () => r.body,
      },
    };
  };
}

describe("RestClient", () => {
  it("GET returns parsed JSON body on 200", async () => {
    const fetchMock = makeFetch([{ status: 200, body: { hello: "world" } }]);
    const client = createRestClient({
      baseUrl: "https://example.com",
      userAgent: "test",
      getAuthHeader: async () => "Basic xyz",
      logger: silentLogger,
      fetchOverride: fetchMock,
    });
    const res = await client.request<{ hello: string }>({ method: "GET", path: "/x" });
    expect(res.status).toBe(200);
    expect(res.body.hello).toBe("world");
  });

  it("injects auth header when getAuthHeader returns a value", async () => {
    const captured: Array<Record<string, string>> = [];
    const fetchMock: FetchLike = async (_url, init) => {
      captured.push(init.headers);
      return {
        statusCode: 200,
        headers: {},
        body: { text: async () => "{}", json: async () => ({}) },
      };
    };
    const client = createRestClient({
      baseUrl: "https://example.com",
      userAgent: "test-ua",
      getAuthHeader: async () => "Bearer TOKEN",
      logger: silentLogger,
      fetchOverride: fetchMock,
    });
    await client.request({ method: "GET", path: "/" });
    expect(captured[0]?.["authorization"]).toBe("Bearer TOKEN");
    expect(captured[0]?.["user-agent"]).toBe("test-ua");
  });

  it("auto-generates idempotency-key for write methods", async () => {
    const captured: Array<Record<string, string>> = [];
    const fetchMock: FetchLike = async (_url, init) => {
      captured.push(init.headers);
      return {
        statusCode: 201,
        headers: {},
        body: { text: async () => "{}", json: async () => ({}) },
      };
    };
    const client = createRestClient({
      baseUrl: "https://example.com",
      userAgent: "test",
      getAuthHeader: async () => undefined,
      logger: silentLogger,
      fetchOverride: fetchMock,
    });
    await client.request({ method: "POST", path: "/things", body: { name: "x" } });
    expect(captured[0]?.["x-idempotency-key"]).toBeDefined();
    expect(captured[0]?.["x-idempotency-key"]?.length ?? 0).toBeGreaterThan(0);
  });

  it("retries on 503 and succeeds on 200", async () => {
    const fetchMock = makeFetch([
      { status: 503, body: { error: "down" } },
      { status: 200, body: { ok: true } },
    ]);
    const spy = vi.fn(fetchMock);
    const client = createRestClient({
      baseUrl: "https://example.com",
      userAgent: "test",
      getAuthHeader: async () => undefined,
      logger: silentLogger,
      fetchOverride: spy,
      retry: {
        maxAttempts: 5,
        baseDelayMs: 1,           // fast for tests
        maxDelayMs: 10,
        respectRetryAfter: true,
        retryStatusCodes: [503],
      },
    });
    const res = await client.request<{ ok: boolean }>({ method: "GET", path: "/" });
    expect(res.body.ok).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("throws ProviderClientError on 4xx", async () => {
    const fetchMock = makeFetch([{ status: 400, body: { error: "bad" } }]);
    const client = createRestClient({
      baseUrl: "https://example.com",
      userAgent: "test",
      getAuthHeader: async () => undefined,
      logger: silentLogger,
      fetchOverride: fetchMock,
    });
    await expect(client.request({ method: "GET", path: "/" })).rejects.toThrow(ProviderClientError);
  });

  it("throws ProviderServerError on 5xx after retries exhausted", async () => {
    const fetchMock = makeFetch(Array.from({ length: 10 }, () => ({ status: 500, body: { error: "x" } })));
    const client = createRestClient({
      baseUrl: "https://example.com",
      userAgent: "test",
      getAuthHeader: async () => undefined,
      logger: silentLogger,
      fetchOverride: fetchMock,
      retry: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 5, respectRetryAfter: true, retryStatusCodes: [500] },
    });
    await expect(client.request({ method: "GET", path: "/" })).rejects.toThrow(ProviderServerError);
  });

  it("encodes query parameters", async () => {
    let capturedUrl = "";
    const fetchMock: FetchLike = async (url) => {
      capturedUrl = url;
      return { statusCode: 200, headers: {}, body: { text: async () => "{}", json: async () => ({}) } };
    };
    const client = createRestClient({
      baseUrl: "https://example.com",
      userAgent: "test",
      getAuthHeader: async () => undefined,
      logger: silentLogger,
      fetchOverride: fetchMock,
    });
    await client.request({ method: "GET", path: "/search", query: { q: "hello world", limit: 10 } });
    expect(capturedUrl).toContain("q=hello+world");
    expect(capturedUrl).toContain("limit=10");
  });
});
