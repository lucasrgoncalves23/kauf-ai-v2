import { describe, it, expect } from "vitest";
import { isSignificantChange } from "../audit";

describe("isSignificantChange", () => {
  it("returns false for identical strings", () => {
    expect(isSignificantChange("hello world", "hello world")).toBe(false);
  });

  it("returns false for identical with different whitespace (trim)", () => {
    expect(isSignificantChange("  hello  ", "  hello  ")).toBe(false);
  });

  it("returns false when either input is empty", () => {
    expect(isSignificantChange("", "something")).toBe(false);
    expect(isSignificantChange("something", "")).toBe(false);
  });

  it("returns true when length differs by more than 5%", () => {
    const original = "a".repeat(100);
    const modified = "a".repeat(94);
    expect(isSignificantChange(original, modified)).toBe(true);
  });

  it("returns false when length differs by less than 5% and chars are similar", () => {
    const original = "a".repeat(100);
    const modified = "a".repeat(98);
    expect(isSignificantChange(original, modified)).toBe(false);
  });

  it("returns true for substantial character changes (>3%)", () => {
    const original = "aaaa" + "b".repeat(96);
    const modified = "xxxx" + "b".repeat(96);
    expect(isSignificantChange(original, modified)).toBe(true);
  });

  it("returns false for tiny edits (<3% chars) on long text", () => {
    const original = "ab" + "c".repeat(198);
    const modified = "xy" + "c".repeat(198);
    expect(isSignificantChange(original, modified)).toBe(false);
  });

  it("detects real clinical edit: drug dose change", () => {
    const original =
      "1. SONO\nMelatonina: 3mg, VO, 21h\n\n2. NUTRIÇÃO\nProteína: 1.8g/kg/dia";
    const modified =
      "1. SONO\nMelatonina: 5mg, VO, 21h\nTrazodona: 50mg, VO, 21h\n\n2. NUTRIÇÃO\nProteína: 1.8g/kg/dia";
    expect(isSignificantChange(original, modified)).toBe(true);
  });
});
