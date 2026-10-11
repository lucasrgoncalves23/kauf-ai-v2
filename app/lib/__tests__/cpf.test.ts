import { describe, it, expect } from "vitest";
import { normalizeCpf, isValidCpf, formatCpf, maskCpf } from "../cpf";

describe("cpf", () => {
  it("accepts valid CPFs with or without punctuation", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
    expect(isValidCpf(" 529 982 247 25 ")).toBe(true);
  });

  it("rejects wrong check digits", () => {
    expect(isValidCpf("529.982.247-26")).toBe(false);
    expect(isValidCpf("529.982.247-15")).toBe(false);
  });

  it("rejects repeated-digit sequences that pass the arithmetic", () => {
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("00000000000")).toBe(false);
  });

  it("rejects wrong lengths and empty input", () => {
    expect(isValidCpf("5299822472")).toBe(false);
    expect(isValidCpf("529982247251")).toBe(false);
    expect(isValidCpf("")).toBe(false);
    expect(isValidCpf(null)).toBe(false);
    expect(isValidCpf(undefined)).toBe(false);
  });

  it("normalizes to digits only", () => {
    expect(normalizeCpf("529.982.247-25")).toBe("52998224725");
    expect(normalizeCpf("abc")).toBe("");
  });

  it("formats progressively while typing", () => {
    expect(formatCpf("5")).toBe("5");
    expect(formatCpf("5299")).toBe("529.9");
    expect(formatCpf("529982247")).toBe("529.982.247");
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(formatCpf("529982247259999")).toBe("529.982.247-25");
  });

  it("masks the first six digits for display", () => {
    expect(maskCpf("52998224725")).toBe("***.***.247-25");
    expect(maskCpf("123")).toBe("");
  });
});
