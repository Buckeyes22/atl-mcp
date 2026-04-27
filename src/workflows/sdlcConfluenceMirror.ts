import { createHash } from "node:crypto";
import path from "node:path";

export interface SdlcMarkdownDoc {
  readonly sourcePath: string;
  readonly content: string;
}

export interface SdlcMirrorPage {
  readonly sourcePath: string;
  readonly title: string;
  readonly parentSourcePath: string | null;
  readonly bodyStorage: string;
  readonly sourceHash: string;
  readonly synthetic: boolean;
  readonly attachments: readonly SdlcMirrorAttachment[];
}

export interface SdlcMirrorAttachment {
  readonly filename: string;
  readonly contentType: string;
  readonly content: string;
}

export interface BuildSdlcMirrorInput {
  readonly docsRoot: string;
  readonly docs: readonly SdlcMarkdownDoc[];
  readonly rootTitle: string;
  readonly jiraProjectKey?: string;
}

interface Frontmatter {
  readonly title?: string;
}

interface PageDraft {
  readonly sourcePath: string;
  readonly titleBase: string;
  readonly parentSourcePath: string | null;
  readonly markdown: string;
  readonly sourceHash: string;
  readonly synthetic: boolean;
  readonly categoryLabel?: string;
}

const RENDERER_VERSION = "sdlc-confluence-renderer-v2";

export function buildSdlcMirrorPages(input: BuildSdlcMirrorInput): readonly SdlcMirrorPage[] {
  const docsRoot = normalizePath(input.docsRoot).replace(/\/$/, "");
  const docsByPath = new Map(input.docs.map((doc) => [normalizePath(doc.sourcePath), doc]));
  const rootReadmePath = `${docsRoot}/README.md`;
  const rootDoc = docsByPath.get(rootReadmePath);
  const folderPaths = collectFolderPaths(docsRoot, [...docsByPath.keys()]);
  const folderPagePath = new Map<string, string>();

  folderPagePath.set("", rootReadmePath);
  for (const folder of folderPaths) {
    const readmePath = `${docsRoot}/${folder}/README.md`;
    folderPagePath.set(folder, docsByPath.has(readmePath) ? readmePath : `${docsRoot}/${folder}/`);
  }

  const drafts: PageDraft[] = [];
  drafts.push({
    sourcePath: rootReadmePath,
    titleBase: input.rootTitle,
    parentSourcePath: null,
    markdown: buildMarkdownBody({
      doc: rootDoc,
      sourcePath: rootReadmePath,
      syntheticTitle: input.rootTitle,
      syntheticIntro: "This page is the Confluence root for the atl-mcp SDLC documentation mirror.",
      ...(input.jiraProjectKey ? { jiraProjectKey: input.jiraProjectKey } : {}),
    }),
    sourceHash: sourceHash(rootDoc?.content ?? input.rootTitle),
    synthetic: rootDoc === undefined,
  });

  for (const folder of folderPaths) {
    const sourcePath = folderPagePath.get(folder);
    if (!sourcePath) continue;
    const readmeDoc = sourcePath.endsWith("README.md") ? docsByPath.get(sourcePath) : undefined;
    const parts = folder.split("/");
    const categoryLabel = formatDirectoryName(parts[0] ?? folder);
    drafts.push({
      sourcePath,
      titleBase: folderTitle(folder),
      parentSourcePath: parentFolderSourcePath(folder, folderPagePath),
      markdown: buildMarkdownBody({
        doc: readmeDoc,
        sourcePath,
        syntheticTitle: folderTitle(folder),
        syntheticIntro: `This page groups SDLC documents from ${sourcePath}.`,
        ...(input.jiraProjectKey ? { jiraProjectKey: input.jiraProjectKey } : {}),
      }),
      sourceHash: sourceHash(readmeDoc?.content ?? sourcePath),
      synthetic: readmeDoc === undefined,
      categoryLabel,
    });
  }

  for (const doc of input.docs) {
    const sourcePath = normalizePath(doc.sourcePath);
    if (sourcePath === rootReadmePath || sourcePath.endsWith("/README.md")) continue;
    const relativePath = trimRoot(docsRoot, sourcePath);
    const folder = relativePath.includes("/") ? relativePath.slice(0, relativePath.lastIndexOf("/")) : "";
    const parent = folderPagePath.get(folder) ?? rootReadmePath;
    const category = folder.split("/")[0] ?? "";
    const parsed = parseFrontmatter(doc.content);
    drafts.push({
      sourcePath,
      titleBase: parsed.frontmatter.title ?? formatFileTitle(relativePath),
      parentSourcePath: parent,
      markdown: buildMarkdownBody({
        doc,
        sourcePath,
        syntheticTitle: parsed.frontmatter.title ?? formatFileTitle(relativePath),
        syntheticIntro: "",
        ...(input.jiraProjectKey ? { jiraProjectKey: input.jiraProjectKey } : {}),
      }),
      sourceHash: sourceHash(doc.content),
      synthetic: false,
      ...(category ? { categoryLabel: formatDirectoryName(category) } : {}),
    });
  }

  return disambiguateTitles(drafts).map((draft) => {
    const rendered = renderMarkdownToConfluenceStorage(draft.markdown, draft.sourcePath);
    return {
      sourcePath: draft.sourcePath,
      title: draft.title,
      parentSourcePath: draft.parentSourcePath,
      bodyStorage: rendered.bodyStorage,
      sourceHash: draft.sourceHash,
      synthetic: draft.synthetic,
      attachments: rendered.attachments,
    };
  });
}

export function markdownToConfluenceStorage(markdown: string): string {
  return renderMarkdownToConfluenceStorage(markdown, "inline").bodyStorage;
}

export function renderMarkdownToConfluenceStorage(
  markdown: string,
  sourcePath: string,
): { readonly bodyStorage: string; readonly attachments: readonly SdlcMirrorAttachment[] } {
  const attachments: SdlcMirrorAttachment[] = [];
  const chunks: string[] = [];
  const figureRegex = /<figure>[\s\S]*?<\/figure>/gi;
  let lastIndex = 0;
  let figureIndex = 1;
  for (const match of markdown.matchAll(figureRegex)) {
    const index = match.index ?? 0;
    const before = markdown.slice(lastIndex, index).trim();
    if (before) chunks.push(renderMarkdownMacro(before));
    chunks.push(renderFigure(match[0], sourcePath, figureIndex, attachments));
    figureIndex += 1;
    lastIndex = index + match[0].length;
  }
  const tail = markdown.slice(lastIndex).trim();
  if (tail) chunks.push(renderMarkdownMacro(tail));
  if (chunks.length === 0) chunks.push(renderMarkdownMacro(markdown));
  return { bodyStorage: chunks.join("\n"), attachments };
}

export function parseFrontmatter(content: string): { readonly frontmatter: Frontmatter; readonly body: string } {
  if (!content.startsWith("---\n")) return { frontmatter: {}, body: content };
  const end = content.indexOf("\n---", 4);
  if (end < 0) return { frontmatter: {}, body: content };
  const raw = content.slice(4, end);
  const bodyStart = content.indexOf("\n", end + 4);
  const body = bodyStart >= 0 ? content.slice(bodyStart + 1) : "";
  const titleLine = raw.split(/\r?\n/).find((line) => line.trim().startsWith("title:"));
  if (!titleLine) return { frontmatter: {}, body };
  const title = titleLine.slice(titleLine.indexOf(":") + 1).trim().replace(/^["']|["']$/g, "");
  return { frontmatter: title ? { title } : {}, body };
}

function buildMarkdownBody(input: {
  readonly doc: SdlcMarkdownDoc | undefined;
  readonly sourcePath: string;
  readonly syntheticTitle: string;
  readonly syntheticIntro: string;
  readonly jiraProjectKey?: string;
}): string {
  const body = input.doc ? parseFrontmatter(input.doc.content).body.trim() : `# ${input.syntheticTitle}\n\n${input.syntheticIntro}`;
  const jiraLine = input.jiraProjectKey ? `\nJira project: \`${input.jiraProjectKey}\`` : "";
  return [
    `> Mirrored from \`${input.sourcePath}\`. The repo copy remains canonical.${jiraLine}`,
    "",
    body,
  ].join("\n");
}

function collectFolderPaths(docsRoot: string, sourcePaths: readonly string[]): readonly string[] {
  const folders = new Set<string>();
  for (const sourcePath of sourcePaths) {
    const relativePath = trimRoot(docsRoot, sourcePath);
    const parts = relativePath.split("/");
    parts.pop();
    for (let i = 1; i <= parts.length; i += 1) {
      folders.add(parts.slice(0, i).join("/"));
    }
  }
  return [...folders].filter((folder) => folder.length > 0).sort((a, b) => a.localeCompare(b));
}

function parentFolderSourcePath(folder: string, folderPagePath: ReadonlyMap<string, string>): string | null {
  if (!folder.includes("/")) return folderPagePath.get("") ?? null;
  const parent = folder.slice(0, folder.lastIndexOf("/"));
  return folderPagePath.get(parent) ?? folderPagePath.get("") ?? null;
}

function folderTitle(folder: string): string {
  const parts = folder.split("/");
  if (parts.length === 1) return `SDLC ${formatDirectoryName(parts[0] ?? folder)}`;
  const category = formatDirectoryName(parts[0] ?? "");
  const leaf = formatDirectoryName(parts[parts.length - 1] ?? folder);
  return `SDLC ${category} - ${leaf}`;
}

function disambiguateTitles(drafts: readonly PageDraft[]): ReadonlyArray<PageDraft & { readonly title: string }> {
  const counts = new Map<string, number>();
  for (const draft of drafts) counts.set(draft.titleBase, (counts.get(draft.titleBase) ?? 0) + 1);
  const seen = new Map<string, number>();
  return drafts.map((draft) => {
    let title = draft.titleBase;
    if ((counts.get(title) ?? 0) > 1 && draft.categoryLabel) title = `${draft.categoryLabel} - ${title}`;
    const occurrence = seen.get(title) ?? 0;
    seen.set(title, occurrence + 1);
    if (occurrence > 0) title = `${title} (${draft.sourcePath})`;
    return { ...draft, title };
  });
}

function renderMarkdownMacro(markdown: string): string {
  const cdata = markdown.replaceAll("]]>", "]]]]><![CDATA[>");
  return `<ac:structured-macro ac:name="markdown" ac:schema-version="1"><ac:plain-text-body><![CDATA[${cdata}]]></ac:plain-text-body></ac:structured-macro>`;
}

function renderFigure(
  figure: string,
  sourcePath: string,
  figureIndex: number,
  attachments: SdlcMirrorAttachment[],
): string {
  const caption = captionText(figure);
  const captionStorage = caption ? `<p><em>${escapeXml(caption)}</em></p>` : "";
  const svg = figure.match(/<svg[\s\S]*?<\/svg>/i)?.[0];
  if (svg) {
    const filename = `atl-mcp-viz-${shortHash(`${sourcePath}:${figureIndex}`)}-${String(figureIndex).padStart(2, "0")}.svg`;
    attachments.push({ filename, contentType: "image/svg+xml", content: svg });
    return [
      `<ac:image ac:align="center" ac:layout="center" ac:width="760"><ri:attachment ri:filename="${escapeXml(filename)}" /></ac:image>`,
      captionStorage,
    ].filter(Boolean).join("\n");
  }
  const table = figure.match(/<table[\s\S]*?<\/table>/i)?.[0];
  if (table) {
    return [sanitizeTableStorage(table), captionStorage].filter(Boolean).join("\n");
  }
  return captionStorage || renderMarkdownMacro(stripTags(figure));
}

function sanitizeTableStorage(table: string): string {
  return table
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\s(?:class|style)="[^"]*"/gi, "")
    .replace(/\s(?:class|style)='[^']*'/gi, "")
    .replace(/<br>/gi, "<br />")
    .replace(/<\/?span[^>]*>/gi, "");
}

function captionText(figure: string): string {
  const raw = figure.match(/<figcaption>([\s\S]*?)<\/figcaption>/i)?.[1];
  if (!raw) return "";
  return stripTags(
    raw.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
      return `${stripTags(label)} (${href})`;
    }),
  ).replace(/\s+/g, " ").trim();
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function sourceHash(content: string): string {
  return createHash("sha256").update(`${RENDERER_VERSION}\n${content}`, "utf8").digest("hex");
}

function shortHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex").slice(0, 12);
}

function trimRoot(docsRoot: string, sourcePath: string): string {
  const normalized = normalizePath(sourcePath);
  const prefix = docsRoot.endsWith("/") ? docsRoot : `${docsRoot}/`;
  return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized;
}

function normalizePath(value: string): string {
  return value.split(path.sep).join("/");
}

function formatFileTitle(relativePath: string): string {
  const withoutExtension = relativePath.replace(/\.md$/i, "");
  const leaf = withoutExtension.includes("/") ? withoutExtension.slice(withoutExtension.lastIndexOf("/") + 1) : withoutExtension;
  return titleCase(leaf.replace(/^\d+-/, "").replaceAll("-", " "));
}

function formatDirectoryName(value: string): string {
  const match = /^(\d+)-(.+)$/.exec(value);
  if (match && match[1] && match[2]) return `${match[1]} - ${titleCase(match[2].replaceAll("-", " "))}`;
  return titleCase(value.replaceAll("-", " "));
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
      if (["ui", "ux", "api", "mcp", "slo", "dr", "bcp", "ci", "cd", "adr"].includes(lower)) return lower.toUpperCase();
      return lower[0] ? `${lower[0].toUpperCase()}${lower.slice(1)}` : lower;
    })
    .join(" ");
}
