import { describe, expect, it } from "vitest";
import {
  buildSdlcMirrorPages,
  markdownToConfluenceStorage,
  parseFrontmatter,
} from "../../../src/workflows/sdlcConfluenceMirror.js";

describe("sdlcConfluenceMirror", () => {
  it("builds a nested page tree for SDLC markdown", () => {
    const pages = buildSdlcMirrorPages({
      docsRoot: "docs/sdlc",
      rootTitle: "atl-mcp SDLC Documentation (PCO)",
      jiraProjectKey: "PCO",
      docs: [
        {
          sourcePath: "docs/sdlc/README.md",
          content: "---\ntitle: SDLC Documentation Index\n---\n\n# Documentation Index\n",
        },
        {
          sourcePath: "docs/sdlc/04-design/README.md",
          content: "---\ntitle: Design Documentation Index\n---\n\n# Design Documentation\n",
        },
        {
          sourcePath: "docs/sdlc/04-design/control-plane-ui/pages-core.md",
          content: "---\ntitle: Operator Control Plane Core Pages\n---\n\n# Core Pages\n",
        },
      ],
    });

    expect(pages.map((page) => page.sourcePath)).toEqual([
      "docs/sdlc/README.md",
      "docs/sdlc/04-design/README.md",
      "docs/sdlc/04-design/control-plane-ui/",
      "docs/sdlc/04-design/control-plane-ui/pages-core.md",
    ]);
    const core = pages.find((page) => page.sourcePath.endsWith("pages-core.md"));
    expect(core?.parentSourcePath).toBe("docs/sdlc/04-design/control-plane-ui/");
    expect(core?.title).toBe("Operator Control Plane Core Pages");
    expect(core?.bodyStorage).toContain("Jira project: `PCO`");
  });

  it("uses frontmatter title and strips frontmatter from mirrored body", () => {
    const parsed = parseFrontmatter("---\ntitle: Runbook\nowner: Chris\n---\n\n# Body\n");
    expect(parsed.frontmatter.title).toBe("Runbook");
    expect(parsed.body.trim()).toBe("# Body");
  });

  it("escapes storage HTML while preserving markdown in the macro CDATA", () => {
    const storage = markdownToConfluenceStorage("# A < B & C\n\n```ts\nconst x = 1;\n```");
    expect(storage).toContain("<![CDATA[# A < B & C");
    expect(storage).not.toContain("<pre>");
  });

  it("turns embedded SVG figures into Confluence image attachments", () => {
    const pages = buildSdlcMirrorPages({
      docsRoot: "docs/sdlc",
      rootTitle: "atl-mcp SDLC Documentation (PCO)",
      docs: [
        {
          sourcePath: "docs/sdlc/README.md",
          content: "# Index\n",
        },
        {
          sourcePath: "docs/sdlc/06-security/audit-chain-threat-model.md",
          content: [
            "---",
            "title: Audit Chain Threat Model",
            "---",
            "",
            "# Audit Chain Threat Model",
            "",
            "<figure>",
            "<svg viewBox=\"0 0 10 10\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"5\" cy=\"5\" r=\"4\" /></svg>",
            "<figcaption><strong>V1.</strong> Audit chain figure.</figcaption>",
            "</figure>",
          ].join("\n"),
        },
      ],
    });
    const page = pages.find((candidate) => candidate.sourcePath.endsWith("audit-chain-threat-model.md"));
    expect(page?.attachments).toHaveLength(1);
    expect(page?.attachments[0]?.filename).toMatch(/^atl-mcp-viz-.*-01\.svg$/);
    expect(page?.bodyStorage).toContain("<ac:image");
    expect(page?.bodyStorage).toContain("ri:attachment");
  });
});
