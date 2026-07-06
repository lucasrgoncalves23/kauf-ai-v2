import { describe, it, expect, beforeEach, vi } from "vitest";
import { isSignificantChange, getDiffSummary } from "../corrections";

// =============================================
// isSignificantChange — pure function tests
// =============================================

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
    const modified = "a".repeat(94); // 6% shorter
    expect(isSignificantChange(original, modified)).toBe(true);
  });

  it("returns false when length differs by less than 5% and chars are similar", () => {
    const original = "a".repeat(100);
    const modified = "a".repeat(98); // 2% shorter — under both 5% length and 3% char thresholds
    expect(isSignificantChange(original, modified)).toBe(false);
  });

  it("returns true for substantial character changes (>3%)", () => {
    // 100 chars, change 4 of them
    const original = "aaaa" + "b".repeat(96);
    const modified = "xxxx" + "b".repeat(96);
    expect(isSignificantChange(original, modified)).toBe(true);
  });

  it("returns false for tiny edits (<3% chars) on long text", () => {
    // 200 chars, change 2 (1%)
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

  it("ignores whitespace-only differences (same trimmed content)", () => {
    expect(isSignificantChange("hello world", "hello world")).toBe(false);
  });
});

// =============================================
// getDiffSummary — pure function tests
// =============================================

describe("getDiffSummary", () => {
  it("returns 'Pequenas alterações' for minor edits", () => {
    expect(getDiffSummary("hello", "hallo")).toBe("Pequenas alterações");
  });

  it("reports line count changes", () => {
    const original = "line1\nline2";
    const modified = "line1\nline2\nline3\nline4";
    const summary = getDiffSummary(original, modified);
    expect(summary).toContain("+2 linhas");
  });

  it("reports character changes when > 50 chars difference", () => {
    const original = "short";
    const modified = "short" + "x".repeat(100);
    const summary = getDiffSummary(original, modified);
    expect(summary).toContain("caracteres");
  });

  it("reports negative line diff for deletions", () => {
    const original = "line1\nline2\nline3\nline4";
    const modified = "line1\nline2";
    const summary = getDiffSummary(original, modified);
    expect(summary).toContain("-2 linhas");
  });
});

// =============================================
// Correction CRUD — localStorage mock tests
// =============================================

describe("correction CRUD with localStorage mock", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    // Stub window so typeof window !== "undefined" checks pass
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => { store[key] = val; },
      removeItem: (key: string) => { delete store[key]; },
    });
  });

  // Dynamic imports to pick up the mocked localStorage
  async function importCorrections() {
    // Force fresh module each time
    const mod = await import("../corrections");
    return mod;
  }

  it("saveCorrection creates a correction with ID and timestamp", async () => {
    const { saveCorrection, getCorrections } = await importCorrections();

    const c = saveCorrection({
      field: "analise",
      original: "old text",
      corrected: "new text",
      patientContext: { name: "Test" },
      approved: false,
    });

    expect(c.id).toMatch(/^corr_/);
    expect(c.timestamp).toBeTruthy();
    expect(c.field).toBe("analise");

    const all = getCorrections();
    expect(all).toHaveLength(1);
  });

  it("getCorrections filters by field", async () => {
    const { saveCorrection, getCorrections } = await importCorrections();

    saveCorrection({
      field: "analise",
      original: "a",
      corrected: "b",
      patientContext: {},
      approved: false,
    });
    saveCorrection({
      field: "conduta",
      original: "c",
      corrected: "d",
      patientContext: {},
      approved: false,
    });

    expect(getCorrections("analise")).toHaveLength(1);
    expect(getCorrections("conduta")).toHaveLength(1);
  });

  it("approveCorrection marks a correction as approved", async () => {
    const { saveCorrection, approveCorrection, getCorrections } =
      await importCorrections();

    const c = saveCorrection({
      field: "conduta",
      original: "x",
      corrected: "y",
      patientContext: {},
      approved: false,
    });

    const result = approveCorrection(c.id, "Good fix");
    expect(result).toBe(true);

    const approved = getCorrections("conduta", true);
    expect(approved).toHaveLength(1);
    expect(approved[0].doctorNote).toBe("Good fix");
  });

  it("deleteCorrection removes a correction", async () => {
    const { saveCorrection, deleteCorrection, getCorrections } =
      await importCorrections();

    const c = saveCorrection({
      field: "analise",
      original: "a",
      corrected: "b",
      patientContext: {},
      approved: false,
    });

    deleteCorrection(c.id);
    expect(getCorrections()).toHaveLength(0);
  });

  it("deleteCorrection returns false for unknown ID", async () => {
    const { deleteCorrection } = await importCorrections();
    expect(deleteCorrection("nonexistent")).toBe(false);
  });
});
