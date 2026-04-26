const INJECTION_PATTERNS = [
  /SYSTEM:/gi,
  /<IMPORTANT>/gi,
  /ignore previous instructions/gi,
  /\[INST\]|\[\/INST\]/gi,
];

const SECRET_PATTERNS = [
  /(?:api[_-]?key|token|secret)\s*[:=]\s*[A-Za-z0-9._-]+/gi,
];

export function redactUnsafeContent(input: string): string {
  let out = input;
  for (const pattern of INJECTION_PATTERNS) out = out.replace(pattern, "[REDACTED_INJECTION]");
  for (const pattern of SECRET_PATTERNS) out = out.replace(pattern, "[REDACTED_SECRET]");
  return out.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}
