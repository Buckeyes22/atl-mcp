// Markdown → Confluence storage representation (XHTML).
//
// Storage representation is XHTML-like: <p>, <h1..h6>, <ul>/<ol>/<li>,
// <code>/<pre>, <strong>/<em>, <a>, <ac:structured-macro> for Confluence
// macros. M2 supports the markdown subset the orchestrator actually emits in
// M2/M5/M6b prose: headings, paragraphs, lists, code blocks, links, emphasis,
// inline code. Tables + macros land when M5 needs them.
//
// CRITICAL: HTML-escape every user-provided string (titles, body content,
// link text). Storage representation is XHTML and the Confluence API will
// reject unescaped angle brackets or ampersands as schema-invalid.

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const FENCE_OPEN_RE = /^```(\w+)?\s*$/;
const FENCE_CLOSE_RE = /^```\s*$/;
const UNORDERED_RE = /^[-*]\s+(.*)$/;
const ORDERED_RE = /^\d+\.\s+(.*)$/;

export interface RenderOptions {
  /** When true, normalize Windows CRLF to LF before rendering. Default true. */
  readonly normalizeNewlines?: boolean;
}

/** Render a Markdown subset into Confluence storage XHTML. */
export function markdownToStorage(markdown: string, opts: RenderOptions = {}): string {
  const normalize = opts.normalizeNewlines !== false;
  const src = normalize ? markdown.replace(/\r\n/g, "\n") : markdown;
  const lines = src.split("\n");

  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";

    // Code fence
    const fenceOpen = FENCE_OPEN_RE.exec(line);
    if (fenceOpen) {
      const language = fenceOpen[1] ?? "";
      const code: string[] = [];
      i++;
      while (i < lines.length) {
        const inner = lines[i] ?? "";
        if (FENCE_CLOSE_RE.test(inner)) {
          i++;
          break;
        }
        code.push(inner);
        i++;
      }
      out.push(renderCodeBlock(code.join("\n"), language));
      continue;
    }

    // Heading
    const heading = HEADING_RE.exec(line);
    if (heading) {
      const level = (heading[1] ?? "#").length;
      const text = heading[2] ?? "";
      out.push(`<h${level}>${renderInline(text)}</h${level}>`);
      i++;
      continue;
    }

    // Bullet list
    if (UNORDERED_RE.test(line)) {
      const { items, consumed } = consumeListItems(lines, i, UNORDERED_RE);
      out.push(`<ul>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`);
      i += consumed;
      continue;
    }

    // Ordered list
    if (ORDERED_RE.test(line)) {
      const { items, consumed } = consumeListItems(lines, i, ORDERED_RE);
      out.push(`<ol>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ol>`);
      i += consumed;
      continue;
    }

    // Blank line — paragraph separator
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph: consume contiguous non-blank, non-special lines
    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const l = lines[i] ?? "";
      if (l.trim() === "") break;
      if (HEADING_RE.test(l) || UNORDERED_RE.test(l) || ORDERED_RE.test(l) || FENCE_OPEN_RE.test(l)) break;
      paragraphLines.push(l);
      i++;
    }
    const joined = paragraphLines.join(" ");
    out.push(`<p>${renderInline(joined)}</p>`);
  }

  return out.join("");
}

function consumeListItems(
  lines: readonly string[],
  start: number,
  re: RegExp,
): { items: string[]; consumed: number } {
  const items: string[] = [];
  let i = start;
  while (i < lines.length) {
    const l = lines[i] ?? "";
    const match = re.exec(l);
    if (!match) break;
    items.push(match[1] ?? "");
    i++;
  }
  return { items, consumed: i - start };
}

function renderCodeBlock(code: string, language: string): string {
  // Confluence code macro produces a syntax-highlighted block.
  const langAttr = language
    ? `<ac:parameter ac:name="language">${escapeXml(language)}</ac:parameter>`
    : "";
  return (
    `<ac:structured-macro ac:name="code" ac:schema-version="1">` +
    langAttr +
    `<ac:plain-text-body><![CDATA[${code}]]></ac:plain-text-body>` +
    `</ac:structured-macro>`
  );
}

const INLINE_CODE_RE = /`([^`]+)`/g;
const STRONG_RE = /\*\*([^*]+)\*\*/g;
const EM_RE = /(?<!\*)\*([^*]+)\*(?!\*)/g;
const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;

/** Render inline markdown (emphasis, code, links) inside an already-block element. */
function renderInline(s: string): string {
  // Escape first, then apply markdown transformations using HTML-safe placeholders.
  // Simpler approach: do replacements in order, using XML-safe escape on each captured group.
  let result = escapeXml(s);

  // Inline code first (so emphasis inside backticks is preserved as literal).
  result = result.replace(INLINE_CODE_RE, (_, code: string) => `<code>${code}</code>`);
  result = result.replace(STRONG_RE, (_, content: string) => `<strong>${content}</strong>`);
  result = result.replace(EM_RE, (_, content: string) => `<em>${content}</em>`);
  result = result.replace(LINK_RE, (_, label: string, href: string, title?: string) => {
    const titleAttr = title ? ` title="${title}"` : "";
    return `<a href="${href}"${titleAttr}>${label}</a>`;
  });
  return result;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
