import { describe, it, expect } from "vitest";
import { splitCronograma, mergeCronograma, CRONOGRAMA_HEADING } from "../cronogramaSync";

describe("splitCronograma", () => {
  it("splits items text from the cronograma section", () => {
    const receita = `RECEITUÁRIO\n\n1) Melatonina 3mg\n\n\n${CRONOGRAMA_HEADING}\n\nAO DEITAR (22h-23h)\nMelatonina 3mg: 1 comprimido`;
    const result = splitCronograma(receita);
    expect(result).not.toBeNull();
    expect(result!.itemsText).toBe("RECEITUÁRIO\n\n1) Melatonina 3mg");
    expect(result!.heading.startsWith(CRONOGRAMA_HEADING)).toBe(true);
  });

  it("trims trailing whitespace/blank lines off itemsText", () => {
    const receita = `RECEITUÁRIO\n\n1) Item\n\n\n\n${CRONOGRAMA_HEADING}\n\nresto`;
    const result = splitCronograma(receita);
    expect(result!.itemsText).toBe("RECEITUÁRIO\n\n1) Item");
  });

  it("returns null when the heading is absent (doctor deleted the section)", () => {
    expect(splitCronograma("RECEITUÁRIO\n\n1) Melatonina 3mg")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(splitCronograma("")).toBeNull();
  });
});

describe("mergeCronograma", () => {
  it("joins itemsText and the new section with a blank-line separator", () => {
    const merged = mergeCronograma("RECEITUÁRIO\n\n1) Item", `${CRONOGRAMA_HEADING}\n\nAO DEITAR\nItem: dose`);
    expect(merged).toBe(`RECEITUÁRIO\n\n1) Item\n\n\n${CRONOGRAMA_HEADING}\n\nAO DEITAR\nItem: dose`);
  });

  it("trims the new section before merging", () => {
    const merged = mergeCronograma("itens", `  \n${CRONOGRAMA_HEADING}\n\ncorpo  \n\n`);
    expect(merged).toBe(`itens\n\n\n${CRONOGRAMA_HEADING}\n\ncorpo`);
  });

  it("round-trips: splitting a merged string recovers the same itemsText", () => {
    const itemsText = "RECEITUÁRIO\n\n1) Item A\n2) Item B";
    const newSection = `${CRONOGRAMA_HEADING}\n\nAO ACORDAR (6h-7h)\nItem A: dose`;
    const merged = mergeCronograma(itemsText, newSection);
    const resplit = splitCronograma(merged);
    expect(resplit!.itemsText).toBe(itemsText);
  });
});
