import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  readBoolean,
  readEnum,
  readNumber,
  readOptionalString,
  readString,
  trimToUndefined,
} from "../../src/config/env.js";

const KEY = "ATL_MCP_TEST_VAR";

describe("env helpers (project-foundation F-029)", () => {
  beforeEach(() => {
    delete process.env[KEY];
  });
  afterEach(() => {
    delete process.env[KEY];
  });

  describe("trimToUndefined", () => {
    it("returns undefined for undefined", () => {
      expect(trimToUndefined(undefined)).toBeUndefined();
    });
    it("returns undefined for empty + whitespace-only", () => {
      expect(trimToUndefined("")).toBeUndefined();
      expect(trimToUndefined("   ")).toBeUndefined();
    });
    it("trims and returns non-empty", () => {
      expect(trimToUndefined("  hi  ")).toBe("hi");
    });
  });

  describe("readString", () => {
    it("returns env value when set", () => {
      process.env[KEY] = "world";
      expect(readString(KEY)).toBe("world");
    });
    it("returns default when env is absent", () => {
      expect(readString(KEY, "fallback")).toBe("fallback");
    });
    it("throws when neither env nor default is provided", () => {
      expect(() => readString(KEY)).toThrow(/Missing required/);
    });
    it("treats whitespace-only env as missing", () => {
      process.env[KEY] = "   ";
      expect(readString(KEY, "fallback")).toBe("fallback");
    });
  });

  describe("readOptionalString", () => {
    it("returns undefined when missing", () => {
      expect(readOptionalString(KEY)).toBeUndefined();
    });
    it("returns trimmed value when present", () => {
      process.env[KEY] = " foo ";
      expect(readOptionalString(KEY)).toBe("foo");
    });
  });

  describe("readNumber", () => {
    it("parses integers", () => {
      process.env[KEY] = "42";
      expect(readNumber(KEY)).toBe(42);
    });
    it("parses floats", () => {
      process.env[KEY] = "3.14";
      expect(readNumber(KEY)).toBe(3.14);
    });
    it("uses default when absent", () => {
      expect(readNumber(KEY, 99)).toBe(99);
    });
    it("throws on non-numeric", () => {
      process.env[KEY] = "not-a-number";
      expect(() => readNumber(KEY, 0)).toThrow(/must be numeric/);
    });
  });

  describe("readBoolean", () => {
    it.each([
      ["true", true],
      ["TRUE", true],
      ["1", true],
      ["yes", true],
      ["false", false],
      ["FALSE", false],
      ["0", false],
      ["no", false],
    ])("parses %s as %s", (raw, expected) => {
      process.env[KEY] = raw;
      expect(readBoolean(KEY, !expected)).toBe(expected);
    });
    it("uses default when absent", () => {
      expect(readBoolean(KEY, true)).toBe(true);
      expect(readBoolean(KEY, false)).toBe(false);
    });
    it("throws on garbage", () => {
      process.env[KEY] = "maybe";
      expect(() => readBoolean(KEY, true)).toThrow(/boolean-like/);
    });
  });

  describe("readEnum", () => {
    const ALLOWED = ["a", "b", "c"] as const;
    it("returns env value when in allowlist", () => {
      process.env[KEY] = "b";
      expect(readEnum(KEY, ALLOWED, "a")).toBe("b");
    });
    it("uses default when absent", () => {
      expect(readEnum(KEY, ALLOWED, "c")).toBe("c");
    });
    it("throws when env not in allowlist", () => {
      process.env[KEY] = "z";
      expect(() => readEnum(KEY, ALLOWED, "a")).toThrow(/must be one of/);
    });
  });
});
