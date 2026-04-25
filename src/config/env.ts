// Defensive env-parsing helpers (from project-foundation F-029).
// Always return defined values when no default; never silently coerce undefined.

export function trimToUndefined(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export function readString(key: string, defaultValue?: string): string {
  const raw = trimToUndefined(process.env[key]);
  if (raw !== undefined) return raw;
  if (defaultValue !== undefined) return defaultValue;
  throw new Error(`Missing required environment variable: ${key}`);
}

export function readOptionalString(key: string): string | undefined {
  return trimToUndefined(process.env[key]);
}

export function readNumber(key: string, defaultValue?: number): number {
  const raw = trimToUndefined(process.env[key]);
  if (raw === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing required numeric environment variable: ${key}`);
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${key} must be numeric, got: ${raw}`);
  }
  return parsed;
}

export function readBoolean(key: string, defaultValue: boolean): boolean {
  const raw = trimToUndefined(process.env[key]);
  if (raw === undefined) return defaultValue;
  const normalized = raw.toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  throw new Error(`Environment variable ${key} must be boolean-like, got: ${raw}`);
}

export function readEnum<T extends string>(key: string, allowed: readonly T[], defaultValue: T): T {
  const raw = trimToUndefined(process.env[key]);
  if (raw === undefined) return defaultValue;
  if ((allowed as readonly string[]).includes(raw)) return raw as T;
  throw new Error(`Environment variable ${key} must be one of [${allowed.join(", ")}], got: ${raw}`);
}
