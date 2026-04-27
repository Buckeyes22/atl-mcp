// Unit test for the velocity-ops content registry. Confirms the catalog
// resolves on disk and reads each category's first slug cleanly.

import { describe, expect, it } from "vitest";
import {
  createVelocityContentRegistry,
  VELOCITY_AGENTS,
  VELOCITY_MODULES,
  VELOCITY_PHASES,
  VELOCITY_TEMPLATES,
  VELOCITY_WORKFLOWS,
} from "../../../src/velocity/contentRegistry.js";

describe("velocity content registry", () => {
  const registry = createVelocityContentRegistry();

  it("manifest enumerates the five content categories", () => {
    const m = registry.manifest();
    expect(m.phases).toEqual(VELOCITY_PHASES);
    expect(m.templates).toEqual(VELOCITY_TEMPLATES);
    expect(m.agents).toEqual(VELOCITY_AGENTS);
    expect(m.workflows).toEqual(VELOCITY_WORKFLOWS);
    expect(m.modules).toEqual(VELOCITY_MODULES);
    expect(m.contentRoot).toMatch(/velocity-ops-content[\\/]?$/);
  });

  it("reads every phase file", async () => {
    for (const slug of VELOCITY_PHASES) {
      const text = await registry.readPhase(slug);
      expect(text.length).toBeGreaterThan(100);
    }
  });

  it("reads every template file", async () => {
    for (const slug of VELOCITY_TEMPLATES) {
      const text = await registry.readTemplate(slug);
      expect(text.length).toBeGreaterThan(50);
    }
  });

  it("reads every agent role card", async () => {
    for (const slug of VELOCITY_AGENTS) {
      const text = await registry.readAgent(slug);
      expect(text.length).toBeGreaterThan(100);
    }
  });

  it("reads every in-scope workflow", async () => {
    for (const slug of VELOCITY_WORKFLOWS) {
      const text = await registry.readWorkflow(slug);
      expect(text.length).toBeGreaterThan(100);
    }
  });

  it("reads every stack module file", async () => {
    expect(VELOCITY_MODULES.length).toBe(38);
    for (const slug of VELOCITY_MODULES) {
      const text = await registry.readModule(slug);
      expect(text.length).toBeGreaterThan(50);
    }
  });

  it("caches reads — same slug returns the same string instance", async () => {
    const a = await registry.readAgent("architect");
    const b = await registry.readAgent("architect");
    expect(a).toBe(b);
  });
});
