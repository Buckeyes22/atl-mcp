// F-005 closure: env-gated live tests against real UIO partner.
// Activate by setting UIO_LIVE_TEST=1 alongside UIO_BASE_URL + UIO_API_KEY +
// (optional) UIO_QDRANT_URL + UIO_QDRANT_API_KEY. Skipped silently otherwise.
//
// v6 §3 keeps UIO disabled for v1 by default; this file is the landing zone
// for when UIO is deployed.

import { describe, expect, it } from "vitest";
import { pino } from "pino";
import { createUioAdapter } from "../../../src/providers/uio/uioMcpAdapter.js";

const ENABLED = process.env["UIO_LIVE_TEST"] === "1";

const UIO_BASE = process.env["UIO_BASE_URL"];
const UIO_KEY = process.env["UIO_API_KEY"];
const UIO_QDRANT_URL = process.env["UIO_QDRANT_URL"];
const UIO_QDRANT_KEY = process.env["UIO_QDRANT_API_KEY"];
const UIO_COLLECTION = process.env["UIO_DEFAULT_COLLECTION"];

const silentLogger = pino({ level: "silent" });

describe.runIf(ENABLED)("live UIO smoke (UIO_LIVE_TEST=1)", () => {
  it("probe returns reachability flags for baseUrl + Qdrant", async () => {
    expect(UIO_BASE && UIO_KEY).toBeTruthy();
    const uio = createUioAdapter({
      enabled: true,
      baseUrl: UIO_BASE!,
      apiKey: UIO_KEY!,
      ...(UIO_QDRANT_URL ? { qdrantUrl: UIO_QDRANT_URL } : {}),
      ...(UIO_QDRANT_KEY ? { qdrantApiKey: UIO_QDRANT_KEY } : {}),
      ...(UIO_COLLECTION ? { defaultCollection: UIO_COLLECTION } : {}),
      logger: silentLogger,
    });
    const profile = await uio.probe();
    expect(profile).toBeDefined();
    expect(typeof profile?.baseUrlReachable).toBe("boolean");
  }, 30_000);
});
