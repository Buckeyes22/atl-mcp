// HTTP retry per PAE F-014.
// Honors Retry-After header (seconds OR HTTP-date), retries 425/408/429/5xx,
// applies exponential backoff with jitter for non-Retry-After cases.
//
// 425 (Too Early) is the gotcha: per RFC 8470, the request was rejected because
// it was sent in early data; the safe response is to retry once IMMEDIATELY
// (not backed off — the server is asking us to repeat without 0-RTT).
//
// docs/partners/pae.md §7 gotcha 1 documents this.

export interface RetryConfig {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  /** When true (default), the parser respects Retry-After headers from the server. */
  readonly respectRetryAfter: boolean;
  /** Status codes that trigger a retry. */
  readonly retryStatusCodes: readonly number[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  baseDelayMs: 200,
  maxDelayMs: 30_000,
  respectRetryAfter: true,
  retryStatusCodes: [408, 425, 429, 500, 502, 503, 504],
};

export interface HttpResponseLike {
  readonly statusCode: number;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
}

/**
 * Decide whether to retry given the response and the attempt index. Returns
 * the delay in ms (0 for immediate) or null if retry should not happen.
 */
export function decideRetry(
  res: HttpResponseLike,
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  now: () => number = Date.now,
): number | null {
  if (attempt + 1 >= config.maxAttempts) return null;
  if (!config.retryStatusCodes.includes(res.statusCode)) return null;

  // 425 Too Early: retry immediately (no backoff). Only on the first attempt.
  if (res.statusCode === 425 && attempt === 0) return 0;

  if (config.respectRetryAfter) {
    const ra = headerValue(res.headers, "retry-after");
    if (ra) {
      const parsed = parseRetryAfter(ra, now);
      if (parsed !== null) return Math.min(parsed, config.maxDelayMs);
    }
  }

  // Exponential backoff with jitter: base * 2^attempt + (0..base) jitter, capped at max.
  const expo = config.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * config.baseDelayMs);
  return Math.min(expo + jitter, config.maxDelayMs);
}

/**
 * Parse Retry-After per RFC 7231: either delta-seconds OR an HTTP-date.
 * Returns milliseconds to wait, or null on parse failure.
 */
export function parseRetryAfter(value: string, now: () => number = Date.now): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  // Numeric form: seconds (RFC 7231 allows non-negative decimal).
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const seconds = Number(trimmed);
    if (!Number.isFinite(seconds) || seconds < 0) return null;
    return Math.round(seconds * 1000);
  }

  // Reject negative-numeric inputs before falling through to Date.parse,
  // which on some runtimes interprets "-5" as a year and returns a valid date.
  if (/^[+-]?\d+(\.\d+)?$/.test(trimmed)) return null;

  // HTTP-date form. Date.parse handles RFC 7231 IMF-fixdate + RFC 850 + asctime.
  const ts = Date.parse(trimmed);
  if (Number.isNaN(ts)) return null;
  const delta = ts - now();
  return delta > 0 ? delta : 0;
}

function headerValue(
  headers: Readonly<Record<string, string | string[] | undefined>>,
  name: string,
): string | undefined {
  // HTTP header lookup is case-insensitive; do a manual scan rather than
  // assuming the lowercase key exists (some clients normalize, some don't).
  const target = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === target) {
      if (Array.isArray(v)) return v[0];
      return v;
    }
  }
  return undefined;
}

export async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        reject(new Error("aborted"));
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}
