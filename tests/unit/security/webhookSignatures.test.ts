import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  verifyHubSignature,
  verifyStripeStyleSignature,
} from "../../../src/security/webhookSignatures.js";

const SECRET = "shhh-this-is-the-webhook-secret";
const BODY = '{"event":"test","payload":{"x":1}}';
const expectedSha256 = createHmac("sha256", SECRET).update(BODY, "utf8").digest("hex");

describe("verifyHubSignature", () => {
  it("verifies a valid sha256= header", () => {
    expect(
      verifyHubSignature({ signatureHeader: `sha256=${expectedSha256}`, body: BODY, secret: SECRET }),
    ).toBe(true);
  });

  it("verifies a valid bare-hex header (no scheme prefix)", () => {
    expect(verifyHubSignature({ signatureHeader: expectedSha256, body: BODY, secret: SECRET })).toBe(true);
  });

  it("rejects when the body is altered", () => {
    expect(
      verifyHubSignature({ signatureHeader: `sha256=${expectedSha256}`, body: BODY + "!", secret: SECRET }),
    ).toBe(false);
  });

  it("rejects when the secret is wrong", () => {
    expect(
      verifyHubSignature({ signatureHeader: `sha256=${expectedSha256}`, body: BODY, secret: "wrong" }),
    ).toBe(false);
  });

  it("rejects a length-mismatched signature without throwing", () => {
    expect(verifyHubSignature({ signatureHeader: "sha256=abcd", body: BODY, secret: SECRET })).toBe(false);
  });

  it("rejects a header containing non-hex chars", () => {
    expect(
      verifyHubSignature({ signatureHeader: `sha256=${"z".repeat(64)}`, body: BODY, secret: SECRET }),
    ).toBe(false);
  });

  it("accepts uppercase hex", () => {
    expect(
      verifyHubSignature({ signatureHeader: `sha256=${expectedSha256.toUpperCase()}`, body: BODY, secret: SECRET }),
    ).toBe(true);
  });

  it("works on Uint8Array bodies (binary-safe)", () => {
    const bodyBytes = new TextEncoder().encode(BODY);
    expect(
      verifyHubSignature({ signatureHeader: `sha256=${expectedSha256}`, body: bodyBytes, secret: SECRET }),
    ).toBe(true);
  });
});

describe("verifyStripeStyleSignature", () => {
  function buildStripeHeader(ts: number, body: string, secret: string): string {
    const signed = `${ts}.${body}`;
    const v1 = createHmac("sha256", secret).update(signed, "utf8").digest("hex");
    return `t=${ts},v1=${v1}`;
  }

  it("verifies a fresh signature", () => {
    const ts = 1_777_000_000;
    const header = buildStripeHeader(ts, BODY, SECRET);
    expect(
      verifyStripeStyleSignature({
        signatureHeader: header,
        body: BODY,
        secret: SECRET,
        toleranceSeconds: 300,
        nowSeconds: ts + 30,
      }),
    ).toBe(true);
  });

  it("rejects a signature outside the tolerance window (replay protection)", () => {
    const ts = 1_777_000_000;
    const header = buildStripeHeader(ts, BODY, SECRET);
    expect(
      verifyStripeStyleSignature({
        signatureHeader: header,
        body: BODY,
        secret: SECRET,
        toleranceSeconds: 300,
        nowSeconds: ts + 600,
      }),
    ).toBe(false);
  });

  it("rejects when the body is altered", () => {
    const ts = 1_777_000_000;
    const header = buildStripeHeader(ts, BODY, SECRET);
    expect(
      verifyStripeStyleSignature({
        signatureHeader: header,
        body: BODY + "!",
        secret: SECRET,
        toleranceSeconds: 300,
        nowSeconds: ts,
      }),
    ).toBe(false);
  });

  it("rejects malformed headers", () => {
    expect(
      verifyStripeStyleSignature({
        signatureHeader: "garbage",
        body: BODY,
        secret: SECRET,
        toleranceSeconds: 300,
        nowSeconds: 1_777_000_000,
      }),
    ).toBe(false);
  });
});
