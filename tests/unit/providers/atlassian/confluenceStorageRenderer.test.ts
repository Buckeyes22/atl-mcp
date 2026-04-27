import { describe, expect, it } from "vitest";
import { markdownToStorage } from "../../../../src/providers/atlassian/confluenceStorageRenderer.js";

describe("markdownToStorage", () => {
  it("renders a heading", () => {
    expect(markdownToStorage("# Hello")).toBe("<h1>Hello</h1>");
  });

  it("renders a paragraph + bold + italic", () => {
    const out = markdownToStorage("This is **bold** and *italic*.");
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain("<em>italic</em>");
  });

  it("renders inline code", () => {
    const out = markdownToStorage("Use `npm test` to run tests.");
    expect(out).toContain("<code>npm test</code>");
  });

  it("renders a fenced code block with language", () => {
    const out = markdownToStorage("```ts\nconst x = 1;\n```");
    expect(out).toContain('<ac:structured-macro ac:name="code"');
    expect(out).toContain("<![CDATA[const x = 1;]]>");
    expect(out).toContain('<ac:parameter ac:name="language">ts</ac:parameter>');
  });

  it("renders an unordered list", () => {
    const out = markdownToStorage("- one\n- two\n- three");
    expect(out).toBe("<ul><li>one</li><li>two</li><li>three</li></ul>");
  });

  it("renders an ordered list", () => {
    const out = markdownToStorage("1. one\n2. two");
    expect(out).toBe("<ol><li>one</li><li>two</li></ol>");
  });

  it("renders a link", () => {
    const out = markdownToStorage("See [docs](https://example.com).");
    expect(out).toContain('<a href="https://example.com">docs</a>');
  });

  it("escapes XML-special characters in plain text", () => {
    const out = markdownToStorage("This has <angle> & ampersand.");
    expect(out).toContain("&lt;angle&gt;");
    expect(out).toContain("&amp;");
  });

  it("does not double-escape inside a code block (CDATA)", () => {
    const out = markdownToStorage("```\nconst x = `<a>`;\n```");
    expect(out).toContain("<![CDATA[const x = `<a>`;]]>");
  });

  it("normalizes Windows newlines", () => {
    const out = markdownToStorage("# Hello\r\n\r\nWorld\r\n");
    expect(out).toContain("<h1>Hello</h1>");
    expect(out).toContain("<p>World</p>");
  });
});
