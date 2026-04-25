// Atlassian Document Format (ADF) types + minimal builder.
//
// ADF is the JSON document model used for rich text in Jira (issue
// description, comments) and Confluence (when atlas_doc_format is enabled).
//
// M2 ships the type shapes + builder for the small subset the orchestrator
// actually emits in M2 prose (preflight result summaries, audit metadata
// blocks). M5/M6a expand the builder when blueprint→Jira translation needs
// richer formatting.
//
// Reference: https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/

export interface AdfDocument {
  readonly version: 1;
  readonly type: "doc";
  readonly content: readonly AdfBlockNode[];
}

export type AdfBlockNode =
  | AdfParagraph
  | AdfHeading
  | AdfBulletList
  | AdfOrderedList
  | AdfCodeBlock
  | AdfBlockquote
  | AdfRule;

export interface AdfParagraph {
  readonly type: "paragraph";
  readonly content?: readonly AdfInlineNode[];
}

export interface AdfHeading {
  readonly type: "heading";
  readonly attrs: { level: 1 | 2 | 3 | 4 | 5 | 6 };
  readonly content?: readonly AdfInlineNode[];
}

export interface AdfBulletList {
  readonly type: "bulletList";
  readonly content: readonly AdfListItem[];
}

export interface AdfOrderedList {
  readonly type: "orderedList";
  readonly content: readonly AdfListItem[];
}

export interface AdfListItem {
  readonly type: "listItem";
  readonly content: readonly AdfBlockNode[];
}

export interface AdfCodeBlock {
  readonly type: "codeBlock";
  readonly attrs?: { language?: string };
  readonly content?: readonly AdfText[];
}

export interface AdfBlockquote {
  readonly type: "blockquote";
  readonly content: readonly AdfBlockNode[];
}

export interface AdfRule {
  readonly type: "rule";
}

export type AdfInlineNode = AdfText | AdfHardBreak;

export interface AdfText {
  readonly type: "text";
  readonly text: string;
  readonly marks?: readonly AdfMark[];
}

export interface AdfHardBreak {
  readonly type: "hardBreak";
}

export type AdfMark =
  | { type: "strong" }
  | { type: "em" }
  | { type: "code" }
  | { type: "link"; attrs: { href: string; title?: string } };

// ----- Builders -----

export function doc(...content: readonly AdfBlockNode[]): AdfDocument {
  return { version: 1, type: "doc", content };
}

export function paragraph(...content: readonly AdfInlineNode[]): AdfParagraph {
  return content.length > 0 ? { type: "paragraph", content } : { type: "paragraph" };
}

export function heading(level: 1 | 2 | 3 | 4 | 5 | 6, ...content: readonly AdfInlineNode[]): AdfHeading {
  return content.length > 0
    ? { type: "heading", attrs: { level }, content }
    : { type: "heading", attrs: { level } };
}

export function text(value: string, ...marks: readonly AdfMark[]): AdfText {
  return marks.length > 0 ? { type: "text", text: value, marks } : { type: "text", text: value };
}

export function strong(value: string): AdfText {
  return text(value, { type: "strong" });
}

export function em(value: string): AdfText {
  return text(value, { type: "em" });
}

export function code(value: string): AdfText {
  return text(value, { type: "code" });
}

export function link(value: string, href: string, title?: string): AdfText {
  return text(value, { type: "link", attrs: title ? { href, title } : { href } });
}

export function bulletList(...items: readonly AdfListItem[]): AdfBulletList {
  return { type: "bulletList", content: items };
}

export function orderedList(...items: readonly AdfListItem[]): AdfOrderedList {
  return { type: "orderedList", content: items };
}

export function listItem(...content: readonly AdfBlockNode[]): AdfListItem {
  return { type: "listItem", content };
}

export function codeBlock(value: string, language?: string): AdfCodeBlock {
  const t = text(value);
  return language
    ? { type: "codeBlock", attrs: { language }, content: [t] }
    : { type: "codeBlock", content: [t] };
}

export function blockquote(...content: readonly AdfBlockNode[]): AdfBlockquote {
  return { type: "blockquote", content };
}

export function rule(): AdfRule {
  return { type: "rule" };
}
