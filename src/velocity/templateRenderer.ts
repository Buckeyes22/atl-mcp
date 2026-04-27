// Template renderer for velocity-ops content. Handles the two placeholder
// conventions used in the lifted templates: bracketed (`[Project Name]`)
// and curly (`{PROJECT}` / `{project_name}`). Variables are looked up in
// a flat dict; missing keys leave the placeholder in place so the operator
// can spot what wasn't filled.
//
// Used by:
//  - confluencePagesWorkflow (M6b) — rendering one Confluence page per template instance
//  - vcsRepoScaffoldWorkflow (M6c) — seeding repo files from templates

export type TemplateVariables = Readonly<Record<string, string>>;

const BRACKET_RE = /\[([^\]\n]+)\]/g;          // [Project Name] → key "Project Name"
const CURLY_LOWER_RE = /\{([a-z][a-z0-9_]*)\}/g;  // {project_name} → key "project_name"
const CURLY_UPPER_RE = /\{([A-Z][A-Z0-9_]+)\}/g;  // {PROJECT} → key "PROJECT"

export interface RenderResult {
  readonly text: string;
  readonly substitutionsMade: number;
  /** Placeholders the renderer found but had no value for. */
  readonly unresolvedPlaceholders: readonly string[];
}

/**
 * Render a template body by substituting variables. Tries (in order):
 *  1. Exact-key lookup in `vars` (case-sensitive).
 *  2. Lowercase-with-underscores lookup (e.g. `Project Name` → `project_name`).
 *  3. Uppercase lookup (e.g. `PROJECT` → `PROJECT`).
 *
 * Anything still unresolved is recorded in `unresolvedPlaceholders` and
 * left intact in the rendered text.
 */
export function renderTemplate(body: string, vars: TemplateVariables): RenderResult {
  let made = 0;
  const unresolved: string[] = [];

  const normalize = (raw: string): string | undefined => {
    if (raw in vars) return vars[raw];
    const lower = raw.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (lower in vars) return vars[lower];
    const upper = raw.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (upper in vars) return vars[upper];
    return undefined;
  };

  const sub = (match: string, key: string): string => {
    const value = normalize(key);
    if (value !== undefined) {
      made += 1;
      return value;
    }
    if (!unresolved.includes(key)) unresolved.push(key);
    return match;
  };

  // Apply curly substitutions first (more specific), then bracket. Bracketed
  // placeholders sometimes hold instructional prose ("[One paragraph maximum.
  // What does this system do?…]"); only substitute brackets whose content is
  // a plausible variable name (≤40 chars, no full-stop).
  let out = body.replace(CURLY_LOWER_RE, sub).replace(CURLY_UPPER_RE, sub);
  out = out.replace(BRACKET_RE, (match, key) => {
    const trimmed = key.trim();
    if (trimmed.length > 40 || trimmed.includes(".")) return match;
    return sub(match, trimmed);
  });

  return { text: out, substitutionsMade: made, unresolvedPlaceholders: unresolved };
}

/**
 * Detect every placeholder in a template body without rendering. Used by
 * the catalog inspector to surface what variables a template needs.
 */
export function listPlaceholders(body: string): readonly string[] {
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  const collect = (re: RegExp) => {
    const r = new RegExp(re.source, re.flags);
    while ((m = r.exec(body)) !== null) {
      const raw = (m[1] ?? "").trim();
      if (raw.length === 0) continue;
      if (raw.length > 40 || raw.includes(".")) continue;
      seen.add(raw);
    }
  };
  collect(CURLY_LOWER_RE);
  collect(CURLY_UPPER_RE);
  collect(BRACKET_RE);
  return [...seen];
}
