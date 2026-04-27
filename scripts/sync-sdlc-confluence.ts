import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { buildSdlcMirrorPages, type SdlcMarkdownDoc, type SdlcMirrorAttachment, type SdlcMirrorPage } from "../src/workflows/sdlcConfluenceMirror.js";

const PROPERTY_KEY = "atl-mcp.sdlc-source";

interface ExistingPage {
  readonly id: string;
  readonly title: string;
  readonly version: number;
}

interface SourcePropertyValue {
  readonly sourcePath: string;
  readonly sourceHash: string;
  readonly generatedBy: "atl-mcp:sdlc-confluence-sync";
  readonly jiraProjectKey?: string;
}

interface SyncCounts {
  readonly created: number;
  readonly updated: number;
  readonly skipped: number;
}

async function main(): Promise<void> {
  const execute = hasFlag("--execute");
  const offline = hasFlag("--offline");
  const docsRoot = normalizePath(arg("--docs-dir") ?? "docs/sdlc");
  const jiraProjectKey = arg("--jira-project-key") ?? process.env["JIRA_PROJECT_KEY"];
  const rootTitle = arg("--root-title") ?? `atl-mcp SDLC Documentation${jiraProjectKey ? ` (${jiraProjectKey})` : ""}`;
  const parentTitle = arg("--parent-title") ?? "Project Overview";
  const docs = await readMarkdownDocs(docsRoot);
  const pages = buildSdlcMirrorPages({
    docsRoot,
    docs,
    rootTitle,
    ...(jiraProjectKey ? { jiraProjectKey } : {}),
  });

  if (offline) {
    process.stdout.write(JSON.stringify({
      mode: execute ? "execute" : "dry-run",
      offline: true,
      docsRoot,
      rootTitle,
      totalPages: pages.length,
      totalAttachments: pages.reduce((sum, page) => sum + page.attachments.length, 0),
      firstPages: pages.slice(0, 8).map((page) => ({ title: page.title, sourcePath: page.sourcePath, parentSourcePath: page.parentSourcePath })),
    }, null, 2) + "\n");
    return;
  }

  const client = confluenceClientFromEnv();
  const spaceId = await client.spaceId();
  const existing = await client.listPages(spaceId);
  const parent = parentTitle ? existing.find((page) => page.title === parentTitle) : undefined;
  const counts = execute
    ? await syncPages({ client, pages, spaceId, existing, rootParentId: parent?.id, jiraProjectKey })
    : await dryRunPages({ client, pages, existing });

  process.stdout.write(JSON.stringify({
    mode: execute ? "execute" : "dry-run",
    spaceKey: client.spaceKey,
    spaceId,
    parentTitle,
    parentId: parent?.id ?? null,
    totalPages: pages.length,
    totalAttachments: pages.reduce((sum, page) => sum + page.attachments.length, 0),
    ...counts,
  }, null, 2) + "\n");
}

async function syncPages(input: {
  readonly client: ConfluenceClient;
  readonly pages: readonly SdlcMirrorPage[];
  readonly spaceId: string;
  readonly existing: readonly ExistingPage[];
  readonly rootParentId: string | undefined;
  readonly jiraProjectKey: string | undefined;
}): Promise<SyncCounts> {
  const existingByTitle = new Map(input.existing.map((page) => [page.title, page]));
  const pageIdBySource = new Map<string, string>();
  const createdOrExisting: ExistingPage[] = [...input.existing];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const page of input.pages) {
    const parentId = page.parentSourcePath ? pageIdBySource.get(page.parentSourcePath) : input.rootParentId;
    const found = existingByTitle.get(page.title);
    const propertyValue: SourcePropertyValue = {
      sourcePath: page.sourcePath,
      sourceHash: page.sourceHash,
      generatedBy: "atl-mcp:sdlc-confluence-sync",
      ...(input.jiraProjectKey ? { jiraProjectKey: input.jiraProjectKey } : {}),
    };

    if (!found) {
      const createdPage = await input.client.createPage({
        spaceId: input.spaceId,
        title: page.title,
        bodyStorage: page.bodyStorage,
        parentId,
      });
      await input.client.setProperty(createdPage.id, PROPERTY_KEY, propertyValue);
      await syncAttachments(input.client, createdPage.id, page.attachments);
      existingByTitle.set(page.title, createdPage);
      pageIdBySource.set(page.sourcePath, createdPage.id);
      createdOrExisting.push(createdPage);
      created += 1;
      continue;
    }

    const property = await input.client.getProperty(found.id, PROPERTY_KEY);
    const value = parseSourceProperty(property?.value);
    pageIdBySource.set(page.sourcePath, found.id);
    if (value?.sourceHash === page.sourceHash) {
      await syncAttachments(input.client, found.id, page.attachments);
      skipped += 1;
      continue;
    }

    const updatedPage = await input.client.updatePage(found.id, {
      title: page.title,
      bodyStorage: page.bodyStorage,
      version: found.version + 1,
    });
    await input.client.setProperty(updatedPage.id, PROPERTY_KEY, propertyValue);
    await syncAttachments(input.client, updatedPage.id, page.attachments);
    existingByTitle.set(page.title, updatedPage);
    updated += 1;
  }

  void createdOrExisting;
  return { created, updated, skipped };
}

async function syncAttachments(
  client: ConfluenceClient,
  pageId: string,
  attachments: readonly SdlcMirrorAttachment[],
): Promise<void> {
  for (const attachment of attachments) {
    await client.upsertAttachment(pageId, attachment);
  }
}

async function dryRunPages(input: {
  readonly client: ConfluenceClient;
  readonly pages: readonly SdlcMirrorPage[];
  readonly existing: readonly ExistingPage[];
}): Promise<SyncCounts> {
  const existingByTitle = new Map(input.existing.map((page) => [page.title, page]));
  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (const page of input.pages) {
    const found = existingByTitle.get(page.title);
    if (!found) {
      created += 1;
      continue;
    }
    const property = await input.client.getProperty(found.id, PROPERTY_KEY);
    const value = parseSourceProperty(property?.value);
    if (value?.sourceHash === page.sourceHash) skipped += 1;
    else updated += 1;
  }
  return { created, updated, skipped };
}

interface CreatePageArgs {
  readonly spaceId: string;
  readonly title: string;
  readonly bodyStorage: string;
  readonly parentId?: string;
}

interface UpdatePageArgs {
  readonly title: string;
  readonly bodyStorage: string;
  readonly version: number;
}

interface ContentProperty {
  readonly id: string;
  readonly key: string;
  readonly value: unknown;
  readonly version: number;
}

interface ConfluenceClient {
  readonly spaceKey: string;
  spaceId(): Promise<string>;
  listPages(spaceId: string): Promise<readonly ExistingPage[]>;
  createPage(args: CreatePageArgs): Promise<ExistingPage>;
  updatePage(pageId: string, args: UpdatePageArgs): Promise<ExistingPage>;
  getProperty(pageId: string, key: string): Promise<ContentProperty | undefined>;
  setProperty(pageId: string, key: string, value: unknown): Promise<ContentProperty>;
  upsertAttachment(pageId: string, attachment: SdlcMirrorAttachment): Promise<void>;
}

function confluenceClientFromEnv(): ConfluenceClient {
  const email = requiredEnv("ATLASSIAN_EMAIL");
  const token = requiredEnv("ATLASSIAN_API_TOKEN");
  const site = (process.env["CONFLUENCE_BASE_URL"] ?? `${requiredEnv("ATLASSIAN_SITE_URL").replace(/\/$/, "")}/wiki`).replace(/\/$/, "");
  const spaceKey = arg("--space-key") ?? requiredEnv("CONFLUENCE_SPACE_KEY");
  const auth = `Basic ${Buffer.from(`${email}:${token}`, "utf8").toString("base64")}`;

  async function request<T>(method: string, apiPath: string, body?: unknown): Promise<T> {
    const res = await fetch(`${site}${apiPath}`, {
      method,
      headers: {
        Authorization: auth,
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const raw = await res.text();
    if (!res.ok) {
      throw new Error(`Confluence ${method} ${apiPath} failed: HTTP ${res.status} ${raw.slice(0, 500)}`);
    }
    return raw ? JSON.parse(raw) as T : {} as T;
  }

  async function requestMultipart<T>(method: string, apiPath: string, form: FormData): Promise<T> {
    const res = await fetch(`${site}${apiPath}`, {
      method,
      headers: {
        Authorization: auth,
        Accept: "application/json",
        "X-Atlassian-Token": "no-check",
      },
      body: form,
    });
    const raw = await res.text();
    if (!res.ok) {
      throw new Error(`Confluence ${method} ${apiPath} failed: HTTP ${res.status} ${raw.slice(0, 500)}`);
    }
    return raw ? JSON.parse(raw) as T : {} as T;
  }

  return {
    spaceKey,
    async spaceId() {
      const body = await request<{ readonly results: readonly { readonly id: string }[] }>("GET", `/api/v2/spaces?keys=${encodeURIComponent(spaceKey)}&limit=1`);
      const found = body.results[0];
      if (!found) throw new Error(`Confluence space not found for key ${spaceKey}`);
      return found.id;
    },
    async listPages(spaceId) {
      const pages: ExistingPage[] = [];
      let cursor: string | undefined;
      do {
        const suffix = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
        const body = await request<{
          readonly results: readonly { readonly id: string; readonly title: string; readonly version?: { readonly number?: number } }[];
          readonly _links?: { readonly next?: string };
        }>("GET", `/api/v2/spaces/${encodeURIComponent(spaceId)}/pages?limit=250${suffix}`);
        pages.push(...body.results.map((page) => ({
          id: page.id,
          title: page.title,
          version: page.version?.number ?? 1,
        })));
        cursor = cursorFromNext(body._links?.next);
      } while (cursor);
      return pages;
    },
    async createPage(args) {
      const body = await request<{ readonly id: string; readonly title: string; readonly version?: { readonly number?: number } }>("POST", "/api/v2/pages", {
        spaceId: args.spaceId,
        status: "current",
        title: args.title,
        ...(args.parentId ? { parentId: args.parentId } : {}),
        body: { representation: "storage", value: args.bodyStorage },
      });
      return { id: body.id, title: body.title, version: body.version?.number ?? 1 };
    },
    async updatePage(pageId, args) {
      const body = await request<{ readonly id: string; readonly title: string; readonly version?: { readonly number?: number } }>("PUT", `/api/v2/pages/${encodeURIComponent(pageId)}`, {
        id: pageId,
        status: "current",
        title: args.title,
        version: { number: args.version },
        body: { representation: "storage", value: args.bodyStorage },
      });
      return { id: body.id, title: body.title, version: body.version?.number ?? args.version };
    },
    async getProperty(pageId, key) {
      const body = await request<{ readonly results: readonly { readonly id: string; readonly key: string; readonly value: unknown; readonly version?: { readonly number?: number } }[] }>(
        "GET",
        `/api/v2/pages/${encodeURIComponent(pageId)}/properties?key=${encodeURIComponent(key)}`,
      );
      const found = body.results.find((property) => property.key === key);
      return found ? { id: found.id, key: found.key, value: found.value, version: found.version?.number ?? 1 } : undefined;
    },
    async setProperty(pageId, key, value) {
      const existing = await this.getProperty(pageId, key);
      if (existing) {
        const body = await request<{ readonly id: string; readonly key: string; readonly value: unknown; readonly version?: { readonly number?: number } }>(
          "PUT",
          `/api/v2/pages/${encodeURIComponent(pageId)}/properties/${encodeURIComponent(existing.id)}`,
          { key, value, version: { number: existing.version + 1 } },
        );
        return { id: body.id, key: body.key, value: body.value, version: body.version?.number ?? existing.version + 1 };
      }
      const body = await request<{ readonly id: string; readonly key: string; readonly value: unknown; readonly version?: { readonly number?: number } }>(
        "POST",
        `/api/v2/pages/${encodeURIComponent(pageId)}/properties`,
        { key, value },
      );
      return { id: body.id, key: body.key, value: body.value, version: body.version?.number ?? 1 };
    },
    async upsertAttachment(pageId, attachment) {
      const filename = encodeURIComponent(attachment.filename);
      const existing = await request<{ readonly results: readonly { readonly id: string; readonly title: string }[] }>(
        "GET",
        `/rest/api/content/${encodeURIComponent(pageId)}/child/attachment?filename=${filename}`,
      );
      const form = new FormData();
      form.append("file", new Blob([attachment.content], { type: attachment.contentType }), attachment.filename);
      form.append("minorEdit", "true");
      const found = existing.results.find((candidate) => candidate.title === attachment.filename);
      if (found) {
        await requestMultipart<unknown>(
          "POST",
          `/rest/api/content/${encodeURIComponent(pageId)}/child/attachment/${encodeURIComponent(found.id)}/data`,
          form,
        );
        return;
      }
      await requestMultipart<unknown>(
        "POST",
        `/rest/api/content/${encodeURIComponent(pageId)}/child/attachment`,
        form,
      );
    },
  };
}

function parseSourceProperty(value: unknown): SourcePropertyValue | undefined {
  if (!isRecord(value)) return undefined;
  if (value["generatedBy"] !== "atl-mcp:sdlc-confluence-sync") return undefined;
  const sourcePath = value["sourcePath"];
  const sourceHash = value["sourceHash"];
  if (typeof sourcePath !== "string" || typeof sourceHash !== "string") return undefined;
  const jiraProjectKey = value["jiraProjectKey"];
  return {
    sourcePath,
    sourceHash,
    generatedBy: "atl-mcp:sdlc-confluence-sync",
    ...(typeof jiraProjectKey === "string" ? { jiraProjectKey } : {}),
  };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

async function readMarkdownDocs(root: string): Promise<readonly SdlcMarkdownDoc[]> {
  const docs: SdlcMarkdownDoc[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        docs.push({ sourcePath: normalizePath(fullPath), content: await readFile(fullPath, "utf8") });
      }
    }
  }
  await walk(root);
  return docs.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
}

function cursorFromNext(next: string | undefined): string | undefined {
  if (!next) return undefined;
  const marker = "cursor=";
  const index = next.indexOf(marker);
  if (index < 0) return undefined;
  return next.slice(index + marker.length).split("&")[0];
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function arg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function normalizePath(value: string): string {
  return value.split(path.sep).join("/");
}

main().catch((err) => {
  process.stderr.write(`sync SDLC Confluence failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
