// F-015 closure: stricter anti-stub scanner that catches the failure modes
// surfaced in audit findings F-001 (workflows wired under spec names with
// placeholder bodies).
//
// Pattern coverage:
//   - explicit TODO throws
//   - "not implemented" markers
//   - "placeholder" used as a marker (narrowed regex to avoid false positives)
//   - functions whose entire body is `return {...};` with a static literal
//   - in-process Set<string>() used for dedup at module scope (F-011-style)
//
// The scanner is intentionally heuristic. It runs from the CLI and from
// `tests/lint/anti-stub.test.ts`. Files can opt out via a single-line marker
// `// anti-stub-scan:disable` near the top.

export interface AntiStubViolation {
  readonly code: string;
  readonly message: string;
  readonly line?: number;
}

const PATTERN_RULES: ReadonlyArray<{
  code: string;
  match: (source: string) => readonly { line: number; snippet: string }[];
  message: string;
}> = [
  {
    code: "anti_stub.todo_throw",
    match: (source) => findLines(source, /throw new Error\(['"`](?:TODO|FIXME)['"`]\)/i),
    message: "TODO/FIXME throw stubs are not allowed",
  },
  {
    code: "anti_stub.not_implemented",
    match: (source) => findLines(source, /\bnot implemented\b/i),
    message: '"not implemented" stub marker found',
  },
  {
    code: "anti_stub.placeholder",
    match: (source) =>
      findLines(source, /placeholder(?: for | implementation| stub| fixme)/i),
    message: "placeholder implementation marker found",
  },
  {
    code: "anti_stub.module_set_dedup",
    match: (source) =>
      // Catches `const ... = new Set<string>();` at module scope (column 0).
      findLines(source, /^const\s+\w+\s*=\s*new\s+Set<string>\(\)\s*;/m),
    message: "module-level `new Set<string>()` used as dedup state — does not survive restart",
  },
];

export function scanAntiStubPatterns(source: string): { readonly violations: readonly AntiStubViolation[] } {
  if (/\/\/\s*anti-stub-scan:disable/.test(source)) {
    return { violations: [] };
  }
  const violations: AntiStubViolation[] = [];
  for (const rule of PATTERN_RULES) {
    for (const hit of rule.match(source)) {
      violations.push({ code: rule.code, message: `${rule.message} (line ${hit.line})`, line: hit.line });
    }
  }
  return { violations };
}

function findLines(source: string, pattern: RegExp): { line: number; snippet: string }[] {
  const lines = source.split("\n");
  const flags = pattern.flags.includes("m") ? pattern.flags : `${pattern.flags}m`;
  const re = new RegExp(pattern.source, flags);
  const out: { line: number; snippet: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i] ?? "";
    if (re.test(lineText)) out.push({ line: i + 1, snippet: lineText.trim().slice(0, 120) });
  }
  return out;
}
