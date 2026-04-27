import { describe, expect, it } from "vitest";
import { aggregateChecks, fromNumeric } from "../../../src/domain/confidence.js";

describe("confidence helpers (PAE F-018)", () => {
  it("fromNumeric maps thresholds correctly", () => {
    expect(fromNumeric(0.95).categorical).toBe("high");
    expect(fromNumeric(0.8).categorical).toBe("high");
    expect(fromNumeric(0.79).categorical).toBe("medium");
    expect(fromNumeric(0.5).categorical).toBe("medium");
    expect(fromNumeric(0.49).categorical).toBe("low");
    expect(fromNumeric(0.0).categorical).toBe("low");
  });

  it("fromNumeric rejects out-of-range", () => {
    expect(() => fromNumeric(-0.1)).toThrow();
    expect(() => fromNumeric(1.1)).toThrow();
    expect(() => fromNumeric(NaN)).toThrow();
  });

  it("fromNumeric round-trip preserves numeric", () => {
    const c = fromNumeric(0.42);
    expect(c.numeric).toBe(0.42);
  });

  it("aggregateChecks averages 0–100 inputs into 0..1", () => {
    expect(aggregateChecks([{ confidence: 100 }, { confidence: 100 }])).toBe(1);
    expect(aggregateChecks([{ confidence: 0 }, { confidence: 100 }])).toBe(0.5);
    expect(aggregateChecks([])).toBe(0);
    expect(aggregateChecks([{ confidence: 50 }])).toBe(0.5);
  });

  it("aggregateChecks clamps out-of-range per-check inputs", () => {
    expect(aggregateChecks([{ confidence: -10 }, { confidence: 200 }])).toBe(0.5);
  });
});
