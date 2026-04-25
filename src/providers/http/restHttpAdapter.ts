// Default fetch + URL builder split out from restClient.ts (F-007 closure).
// No behavior change; pure helpers extracted to drop restClient.ts under the
// 200-line cap.

import { request as undiciRequest, type Dispatcher } from "undici";
import type { FetchLike } from "./restClient.js";

export const defaultFetch: FetchLike = async (url, init) => {
  const undiciOpts: Parameters<typeof undiciRequest>[1] = {
    method: init.method as Dispatcher.HttpMethod,
    headers: init.headers,
    ...(init.body !== undefined ? { body: init.body } : {}),
  };
  const res = await undiciRequest(url, undiciOpts);
  return {
    statusCode: res.statusCode,
    headers: res.headers,
    body: {
      text: () => res.body.text(),
      json: () => res.body.json(),
    },
  };
};

export function buildUrl(
  base: string,
  path: string,
  query?: Readonly<Record<string, string | number | boolean | undefined>>,
): string {
  const baseTrim = base.endsWith("/") ? base.slice(0, -1) : base;
  const pathPrefixed = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(baseTrim + pathPrefixed);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export function normalizeHeaders(
  raw: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined) continue;
    out[k.toLowerCase()] = Array.isArray(v) ? (v[0] ?? "") : v;
  }
  return out;
}

export function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function generateIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}
