import { describe, it, expect } from "vitest";
import { flexFind } from "../useCopilotChat";

const CONDUTA = `1. SONO

Melatonina: 3mg via oral 30min antes de dormir
Magnésio glicinato: 400mg à noite

2. NUTRIÇÃO

Dieta low-carb com 120g de proteína/dia

9. PEPTÍDEOS

BPC-157: 250mcg SC 1x/dia`;

describe("flexFind", () => {
  it("finds an exact substring", () => {
    const pos = flexFind(CONDUTA, "Magnésio glicinato: 400mg à noite");
    expect(pos).not.toBeNull();
    expect(CONDUTA.slice(pos!.start, pos!.end)).toBe("Magnésio glicinato: 400mg à noite");
  });

  it("finds a multi-line excerpt exactly", () => {
    const pos = flexFind(CONDUTA, "2. NUTRIÇÃO\n\nDieta low-carb");
    expect(pos).not.toBeNull();
    expect(CONDUTA.slice(pos!.start, pos!.end)).toBe("2. NUTRIÇÃO\n\nDieta low-carb");
  });

  it("matches when the model normalizes line breaks to spaces", () => {
    const pos = flexFind(CONDUTA, "2. NUTRIÇÃO Dieta low-carb");
    expect(pos).not.toBeNull();
    expect(CONDUTA.slice(pos!.start, pos!.end)).toBe("2. NUTRIÇÃO\n\nDieta low-carb");
  });

  it("matches when the model collapses double newlines to single", () => {
    const pos = flexFind(CONDUTA, "1. SONO\nMelatonina: 3mg");
    expect(pos).not.toBeNull();
    expect(CONDUTA.slice(pos!.start, pos!.end)).toBe("1. SONO\n\nMelatonina: 3mg");
  });

  it("escapes regex metacharacters in the needle", () => {
    const doc = "Dose (ajustada): 2.5mg [titular]";
    const pos = flexFind(doc, "(ajustada): 2.5mg [titular]");
    expect(pos).not.toBeNull();
    expect(doc.slice(pos!.start, pos!.end)).toBe("(ajustada): 2.5mg [titular]");
  });

  it("returns null when the excerpt does not exist", () => {
    expect(flexFind(CONDUTA, "Ipamorelin 200mcg")).toBeNull();
  });

  it("returns null for an empty or whitespace-only needle", () => {
    expect(flexFind(CONDUTA, "")).toBeNull();
    expect(flexFind(CONDUTA, "  \n ")).toBeNull();
  });

  it("supports deletion of a full line including its line break", () => {
    const pos = flexFind(CONDUTA, "Melatonina: 3mg via oral 30min antes de dormir\n");
    expect(pos).not.toBeNull();
    const after = CONDUTA.slice(0, pos!.start) + CONDUTA.slice(pos!.end);
    expect(after).not.toContain("Melatonina");
    expect(after).toContain("Magnésio glicinato");
  });
});
