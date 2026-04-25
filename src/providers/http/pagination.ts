// Common pagination helpers. Atlassian APIs use a few patterns:
//   - Jira REST v3: { startAt, maxResults, total, values }
//   - Confluence v2: { results, _links: { next: "..." } }
//   - Bitbucket: { values, next: "..." }
// Each provider exposes a small wrapper that yields one page at a time.

export interface CursorPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | undefined;
}

export async function* paginate<T>(
  fetchPage: (cursor: string | undefined) => Promise<CursorPage<T>>,
): AsyncGenerator<T, void, void> {
  let cursor: string | undefined = undefined;
  while (true) {
    const page = await fetchPage(cursor);
    for (const item of page.items) yield item;
    if (!page.nextCursor) return;
    cursor = page.nextCursor;
  }
}

/** Collect all pages into a single array. Bounded by `maxItems` for safety. */
export async function collectAll<T>(
  fetchPage: (cursor: string | undefined) => Promise<CursorPage<T>>,
  maxItems = 10_000,
): Promise<T[]> {
  const out: T[] = [];
  for await (const item of paginate(fetchPage)) {
    out.push(item);
    if (out.length >= maxItems) break;
  }
  return out;
}
