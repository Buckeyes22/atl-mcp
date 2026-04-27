import { describe, expect, it } from "vitest";
import { canTransition, PROJECT_STATES } from "../../../src/domain/projectState.js";

describe("ProjectState transitions", () => {
  it("DRAFT_INTAKE → BLUEPRINT_READY is legal", () => {
    expect(canTransition("DRAFT_INTAKE", "BLUEPRINT_READY")).toBe(true);
  });

  it("DRAFT_INTAKE → PROVISIONED is illegal (skip ahead)", () => {
    expect(canTransition("DRAFT_INTAKE", "PROVISIONED")).toBe(false);
  });

  it("READY_FOR_BUILD has no successor except DRIFT_DETECTED or ARCHIVED", () => {
    for (const next of PROJECT_STATES) {
      const ok = canTransition("READY_FOR_BUILD", next);
      const expected = next === "DRIFT_DETECTED" || next === "ARCHIVED";
      expect(ok).toBe(expected);
    }
  });

  it("ARCHIVED is terminal — no outbound transitions", () => {
    for (const next of PROJECT_STATES) {
      expect(canTransition("ARCHIVED", next)).toBe(false);
    }
  });

  it("VALIDATION_FAILED can recover to BLUEPRINT_READY", () => {
    expect(canTransition("VALIDATION_FAILED", "BLUEPRINT_READY")).toBe(true);
  });

  it("DRIFT_DETECTED can re-enter at BLUEPRINT_READY or PREFLIGHT_PASSED", () => {
    expect(canTransition("DRIFT_DETECTED", "BLUEPRINT_READY")).toBe(true);
    expect(canTransition("DRIFT_DETECTED", "PREFLIGHT_PASSED")).toBe(true);
  });
});
