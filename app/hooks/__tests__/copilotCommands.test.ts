import { describe, it, expect } from "vitest";
import { applyChatCommands, visibleStreamText } from "../useCopilotChat";
import type { ClinicalOutputs } from "../../types/clinical";

const OUTPUTS: ClinicalOutputs = {
  analise: "HOMA-IR: 3.2 indica resistência insulínica",
  conduta: "1. SONO\n\nMelatonina: 3mg via oral\n\n2. NUTRIÇÃO\n\nDieta low-carb",
  receita: "",
};

const cmd = (obj: object) => `:::COMMAND:::${JSON.stringify(obj)}:::END:::`;

describe("visibleStreamText", () => {
  it("passes plain text through", () => {
    expect(visibleStreamText("Olá, doutor.")).toBe("Olá, doutor.");
  });

  it("strips a completed command block", () => {
    const raw = `Ajustei a dose. ${cmd({ field: "conduta", action: "append", text: "x" })} Pronto.`;
    expect(visibleStreamText(raw)).toBe("Ajustei a dose.  Pronto.");
  });

  it("holds back an unterminated command block", () => {
    const raw = 'Vou editar. :::COMMAND:::{"field":"conduta","action":"edit","find":"Melato';
    expect(visibleStreamText(raw)).toBe("Vou editar.");
  });

  it("holds back a partial marker at the tail", () => {
    expect(visibleStreamText("Vou editar. :::COMM")).toBe("Vou editar.");
    expect(visibleStreamText("Vou editar. :")).toBe("Vou editar.");
  });
});

describe("applyChatCommands", () => {
  it("applies an edit command and records the change", () => {
    const raw = `Troquei a dose. ${cmd({
      field: "conduta",
      action: "edit",
      find: "Melatonina: 3mg",
      replace: "Melatonina: 5mg",
    })}`;
    const result = applyChatCommands(raw, OUTPUTS);
    expect(result.changes.conduta).toContain("Melatonina: 5mg");
    expect(result.text).toBe("Troquei a dose.");
    expect(result.edits).toEqual([
      { field: "conduta", action: "edit", before: "Melatonina: 3mg", after: "Melatonina: 5mg" },
    ]);
    expect(result.failures).toEqual([]);
  });

  it("applies append and set commands", () => {
    const raw =
      cmd({ field: "conduta", action: "append", text: "3. EXERCÍCIO\n\nZona 2" }) +
      cmd({ field: "receita", action: "set", text: "Melatonina 5mg — 30 caps" });
    const result = applyChatCommands(raw, OUTPUTS);
    expect(result.changes.conduta).toContain("3. EXERCÍCIO");
    expect(result.changes.conduta!.startsWith(OUTPUTS.conduta)).toBe(true);
    expect(result.changes.receita).toBe("Melatonina 5mg — 30 caps");
    expect(result.edits.map((e) => e.action)).toEqual(["append", "set"]);
  });

  it("reports failures without dropping successful commands", () => {
    const raw =
      cmd({ field: "conduta", action: "edit", find: "NÃO EXISTE", replace: "x" }) +
      cmd({ field: "analise", action: "append", text: "Nota adicional." });
    const result = applyChatCommands(raw, OUTPUTS);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toContain("Conduta");
    expect(result.changes.analise).toContain("Nota adicional.");
    expect(result.changes.conduta).toBeUndefined();
  });

  it("rejects unknown fields and invalid JSON", () => {
    const raw = cmd({ field: "prontuario", action: "set", text: "x" }) + ":::COMMAND:::{oops:::END:::";
    const result = applyChatCommands(raw, OUTPUTS);
    expect(result.failures).toHaveLength(2);
    expect(Object.keys(result.changes)).toHaveLength(0);
    expect(result.edits).toEqual([]);
  });

  it("chains sequential edits on the same field", () => {
    const raw =
      cmd({ field: "conduta", action: "edit", find: "3mg", replace: "5mg" }) +
      cmd({ field: "conduta", action: "edit", find: "5mg", replace: "10mg" });
    const result = applyChatCommands(raw, OUTPUTS);
    expect(result.changes.conduta).toContain("Melatonina: 10mg");
  });
});
