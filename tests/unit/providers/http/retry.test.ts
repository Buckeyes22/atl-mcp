import { describe, expect, it } from "vitest";
import {
  decideRetry,
  DEFAULT_RETRY_CONFIG,
  parseRetryAfter,
} from "../../../../src/providers/http/retry.js";

describe("parseRetryAfter (RFC 7231)", () => {
  it("parses integer seconds", () => {
    expect(parseRetryAfter("120")).toBe(120_000);
  });

  it("parses decimal seconds", () => {
    expect(parseRetryAfter("1.5")).toBe(1500);
  });

  it("parses HTTP-date format", () => {
    const future = new Date(Date.now() + 30_000).toUTCString();
    const result = parseRetryAfter(future);
    expect(result).toBeGreaterThan(28_000);
    expect(result).toBeLessThan(32_000);
  });

  it("returns 0 for past dates", () => {
    const past = new Date(Date.now() - 60_000).toUTCString();
    expect(parseRetryAfter(past)).toBe(0);
  });

  it("returns null for garbage", () => {
    expect(parseRetryAfter("not a date")).toBe(null);
    expect(parseRetryAfter("")).toBe(null);
  });

  it("rejects negative numbers", () => {
    expect(parseRetryAfter("-5")).toBe(null);
  });
});

describe("decideRetry (PAE F-014)", () => {
  it("does not retry on 200", () => {
    expect(decideRetry({ statusCode: 200, headers: {} }, 0)).toBe(null);
  });

  it("retries on 429 with Retry-After honored", () => {
    const delay = decideRetry({ statusCode: 429, headers: { "retry-after": "5" } }, 0);
    expect(delay).toBe(5000);
  });

  it("425 (Too Early) retries IMMEDIATELY on first attempt", () => {
    expect(decideRetry({ statusCode: 425, headers: {} }, 0)).toBe(0);
  });

  it("425 falls back to backoff on subsequent attempts", () => {
    const delay = decideRetry({ statusCode: 425, headers: {} }, 1);
    expect(delay).toBeGreaterThan(0);
  });

  it("retries on 408 + 500/502/503/504", () => {
    for (const code of [408, 500, 502, 503, 504]) {
      expect(decideRetry({ statusCode: code, headers: {} }, 0)).not.toBe(null);
    }
  });

  it("does not retry past maxAttempts", () => {
    const delay = decideRetry({ statusCode: 503, headers: {} }, DEFAULT_RETRY_CONFIG.maxAttempts - 1);
    expect(delay).toBe(null);
  });

  it("clamps Retry-After to maxDelayMs", () => {
    const delay = decideRetry(
      { statusCode: 429, headers: { "retry-after": "999999" } },
      0,
    );
    expect(delay).toBeLessThanOrEqual(DEFAULT_RETRY_CONFIG.maxDelayMs);
  });

  it("looks up Retry-After case-insensitively", () => {
    const delay = decideRetry({ statusCode: 429, headers: { "Retry-After": "3" } }, 0);
    expect(delay).toBe(3000);
  });

  it("does not retry 4xx other than 408/425/429", () => {
    expect(decideRetry({ statusCode: 400, headers: {} }, 0)).toBe(null);
    expect(decideRetry({ statusCode: 401, headers: {} }, 0)).toBe(null);
    expect(decideRetry({ statusCode: 404, headers: {} }, 0)).toBe(null);
  });
});
