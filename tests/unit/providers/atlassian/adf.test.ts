import { describe, expect, it } from "vitest";
import {
  blockquote,
  bulletList,
  code,
  codeBlock,
  doc,
  em,
  heading,
  link,
  listItem,
  paragraph,
  rule,
  strong,
  text,
} from "../../../../src/providers/atlassian/adf.js";

describe("ADF builders", () => {
  it("doc with paragraph + text", () => {
    const d = doc(paragraph(text("hello")));
    expect(d).toMatchSnapshot();
  });

  it("heading levels 1..6", () => {
    for (const level of [1, 2, 3, 4, 5, 6] as const) {
      const h = heading(level, text(`h${level}`));
      expect(h.attrs.level).toBe(level);
    }
  });

  it("text marks: strong, em, code, link", () => {
    expect(strong("bold").marks?.[0]?.type).toBe("strong");
    expect(em("italic").marks?.[0]?.type).toBe("em");
    expect(code("monospace").marks?.[0]?.type).toBe("code");
    const linked = link("click", "https://example.com");
    expect(linked.marks?.[0]?.type).toBe("link");
  });

  it("bulletList + listItem nest correctly", () => {
    const list = bulletList(listItem(paragraph(text("one"))), listItem(paragraph(text("two"))));
    expect(list.content).toHaveLength(2);
    expect(list.content[0]?.content[0]?.type).toBe("paragraph");
  });

  it("codeBlock with language attribute", () => {
    const cb = codeBlock("const x = 1;", "ts");
    expect(cb.attrs?.language).toBe("ts");
    expect(cb.content?.[0]?.text).toBe("const x = 1;");
  });

  it("blockquote + rule", () => {
    expect(blockquote(paragraph(text("quote"))).type).toBe("blockquote");
    expect(rule().type).toBe("rule");
  });

  it("a complex document round-trips JSON-stringify", () => {
    const d = doc(
      heading(1, text("Title")),
      paragraph(strong("Bold"), text(" then "), em("italic")),
      bulletList(
        listItem(paragraph(text("first"))),
        listItem(paragraph(text("second")), codeBlock("code()", "ts")),
      ),
    );
    const round = JSON.parse(JSON.stringify(d));
    expect(round).toEqual(d);
    expect(d).toMatchSnapshot();
  });
});
