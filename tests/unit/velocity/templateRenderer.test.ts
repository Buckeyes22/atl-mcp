import { describe, expect, it } from "vitest";
import { renderTemplate, listPlaceholders } from "../../../src/velocity/templateRenderer.js";

describe("template renderer", () => {
  it("substitutes curly lowercase variables", () => {
    const out = renderTemplate("Hello {project_name}!", { project_name: "PCO" });
    expect(out.text).toBe("Hello PCO!");
    expect(out.substitutionsMade).toBe(1);
    expect(out.unresolvedPlaceholders).toEqual([]);
  });

  it("substitutes curly uppercase variables", () => {
    const out = renderTemplate("ID: BRIEF-{PROJECT}", { PROJECT: "DriverForge" });
    expect(out.text).toBe("ID: BRIEF-DriverForge");
  });

  it("substitutes bracketed placeholders that look like keys", () => {
    const out = renderTemplate("# Project Brief: [Project Name]", { project_name: "Atlas" });
    expect(out.text).toBe("# Project Brief: Atlas");
  });

  it("normalizes spaced keys to snake_case", () => {
    const out = renderTemplate("Author: [Operator Name]", { operator_name: "Chris" });
    expect(out.text).toBe("Author: Chris");
  });

  it("leaves long bracketed instructions untouched", () => {
    const body = "[One paragraph maximum. What does this system do? What problem does it solve?]";
    const out = renderTemplate(body, { project_name: "X" });
    expect(out.text).toBe(body);
    expect(out.substitutionsMade).toBe(0);
  });

  it("records unresolved placeholders", () => {
    const out = renderTemplate("Owner: {owner}, Stack: {stack}", { owner: "ops" });
    expect(out.text).toBe("Owner: ops, Stack: {stack}");
    expect(out.unresolvedPlaceholders).toEqual(["stack"]);
  });

  it("listPlaceholders enumerates all detectable keys", () => {
    const body = "Project [Project Name] · {project_name} · BRIEF-{PROJECT}";
    const keys = listPlaceholders(body).sort();
    expect(keys).toEqual(["PROJECT", "Project Name", "project_name"]);
  });
});
