import { describe, it, expect } from "vitest";
import { diffLines, diffStats } from "../textDiff";

describe("diffLines", () => {
  it("marks identical texts as all same", () => {
    const diff = diffLines("a\nb\nc", "a\nb\nc");
    expect(diff.left.every((l) => l.type === "same")).toBe(true);
    expect(diff.right.every((l) => l.type === "same")).toBe(true);
  });

  it("detects an added line", () => {
    const diff = diffLines("1. SONO\nMelatonina: 3mg", "1. SONO\nMelatonina: 3mg\nMagnésio: 400mg");
    const stats = diffStats(diff);
    expect(stats.added).toBe(1);
    expect(stats.removed).toBe(0);
    expect(diff.right.find((l) => l.type === "added")?.text).toBe("Magnésio: 400mg");
  });

  it("detects a removed line", () => {
    const diff = diffLines("a\nb\nc", "a\nc");
    const stats = diffStats(diff);
    expect(stats.removed).toBe(1);
    expect(diff.left.find((l) => l.type === "removed")?.text).toBe("b");
  });

  it("detects a modified line as remove + add", () => {
    const diff = diffLines("Melatonina: 3mg", "Melatonina: 5mg");
    const stats = diffStats(diff);
    expect(stats.added).toBe(1);
    expect(stats.removed).toBe(1);
  });

  it("ignores whitespace-only differences on matching lines", () => {
    const diff = diffLines("a  \nb", "a\nb");
    expect(diffStats(diff)).toEqual({ added: 0, removed: 0 });
  });

  it("never marks blank lines as changes", () => {
    const diff = diffLines("a\n\nb", "a\nb\n\nc");
    expect(diff.left.every((l) => l.type !== "removed" || l.text.trim() !== "")).toBe(true);
    expect(diff.right.every((l) => l.type !== "added" || l.text.trim() !== "")).toBe(true);
  });

  it("handles empty inputs", () => {
    const diff = diffLines("", "novo texto");
    expect(diffStats(diff).added).toBe(1);
    expect(diffLines("", "").left).toHaveLength(1);
  });

  it("falls back to no highlighting on very large inputs", () => {
    const big = Array.from({ length: 600 }, (_, i) => `linha ${i}`).join("\n");
    const diff = diffLines(big, big + "\nextra");
    // 600*601 > 250k cells → no marking, but content preserved
    expect(diff.left).toHaveLength(600);
    expect(diff.right).toHaveLength(601);
    expect(diffStats(diff)).toEqual({ added: 0, removed: 0 });
  });
});
