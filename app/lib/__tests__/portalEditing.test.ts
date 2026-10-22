import { afterEach, describe, expect, it } from "vitest";
import { alignMedicationNotes, applyContent, mergeMedications, type PortalPayload } from "../portal/payload";
import { contentIssues } from "../portal/assemble";
import {
  canonicalJson,
  isValidSignatureImage,
  payloadHash,
  signPayload,
  verificationCode,
  verifySigningPin,
} from "../portal/signature";
import { clipText, parsePortalContent, type PortalContent } from "../portal/schema";

const content: PortalContent = {
  resumo: { texto: "Sua vitamina D está baixa e vamos repor com cuidado.", prioridades: ["Tomar a vitamina D conforme a lista"] },
  modulos: [],
  medicamentos: [{ nome: "Vitamina D3", observacao: "Com a primeira refeição." }],
  exames: [],
  proximosPassos: { examesAntes: [], sinaisDeAlerta: [] },
  dieta: { introducao: "Siga o exemplo abaixo." },
};

const payload: PortalPayload = {
  version: 1,
  publishedAt: "2026-10-22T12:00:00.000Z",
  expiresAt: "2027-01-20T12:00:00.000Z",
  patientFirstName: "Maria",
  consultaDate: "2026-10-20T12:00:00.000Z",
  clinic: { doctor: "Dr. Oskar Kaufmann", crm: "CRM-SP 104.028", name: "Instituto Kaufmann", contactLine: "(11) 0000-0000" },
  content,
  medicamentos: [
    { slot: "cafe_da_manha", nome: "Vitamina D3", dose: "10.000 UI", observacao: "Com a primeira refeição." },
    { slot: "ao_deitar", nome: "Magnésio", dose: "1 cápsula" },
  ],
  schedules: { dieta: { introducao: "Siga o exemplo abaixo.", texto: "DIA 1 ...", dias: null } },
  receitaOriginal: "1) Vitamina D3 10.000 UI",
  labSeries: [],
  nextVisit: { date: null, label: "3 meses", reason: "" },
};

const PNG = "data:image/png;base64,iVBORw0KGgo=";

describe("signature hash", () => {
  it("is independent of key order (JSONB reorders keys)", () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: null } })).toBe(canonicalJson({ a: { c: null, d: [1, { x: 1, y: 2 }] }, b: 1 }));
  });

  it("ignores the link expiry and the signature itself, so a reissued link keeps a valid signature", () => {
    const signed = signPayload(payload, PNG, "2026-10-22T12:00:00.000Z");
    const reissued = { ...signed, expiresAt: "2027-03-01T00:00:00.000Z" };
    expect(payloadHash(reissued)).toBe(signed.signature!.hash);
  });

  it("changes when any patient-visible text changes", () => {
    const edited = { ...payload, content: { ...content, resumo: { ...content.resumo, texto: content.resumo.texto + " " } } };
    expect(payloadHash(edited)).not.toBe(payloadHash(payload));
  });

  it("formats a short verification code from the hash", () => {
    expect(verificationCode("a7f39c2b41de08f5ffff")).toBe("A7F3-9C2B-41DE-08F5");
  });

  it("only accepts PNG data URLs within the size cap", () => {
    expect(isValidSignatureImage(PNG)).toBe(true);
    expect(isValidSignatureImage("data:image/svg+xml;base64,PHN2Zz4=")).toBe(false);
    expect(isValidSignatureImage(`data:image/png;base64,${"A".repeat(200_000)}`)).toBe(false);
    expect(isValidSignatureImage(null)).toBe(false);
  });
});

describe("signing code", () => {
  afterEach(() => {
    delete process.env.DOCTOR_SIGNING_PIN;
  });

  it("is not required when unset", () => {
    expect(verifySigningPin(undefined)).toBe(true);
  });

  it("must match when configured", () => {
    process.env.DOCTOR_SIGNING_PIN = "4321";
    expect(verifySigningPin("4321")).toBe(true);
    expect(verifySigningPin("1234")).toBe(false);
    expect(verifySigningPin(undefined)).toBe(false);
  });
});

describe("edited medication notes", () => {
  const parsed = [{ slot: "outro" as const, nome: "Ondansetrona 4mg", dose: "1 comprimido", observacao: "se náusea" }];

  it("model output without a note falls back to the receita's note", () => {
    expect(mergeMedications(parsed, [{ nome: "Ondansetrona 4mg" }])[0].observacao).toBe("se náusea");
  });

  it("a note the doctor deleted stays deleted", () => {
    expect(mergeMedications(parsed, [{ nome: "Ondansetrona 4mg" }], { edited: true })[0].observacao).toBeUndefined();
  });

  it("items added to the receita after editing still get the receita's note", () => {
    expect(mergeMedications(parsed, [], { edited: true })[0].observacao).toBe("se náusea");
  });

  it("aligns one note entry per patient-visible item, by receita name", () => {
    const aligned = alignMedicationNotes({ ...content, medicamentos: [{ nome: "vitamina d3 (colecalciferol)", observacao: "x" }] }, payload.medicamentos);
    expect(aligned.medicamentos).toEqual([{ nome: "Vitamina D3", observacao: "Com a primeira refeição." }, { nome: "Magnésio" }]);
  });
});

describe("applyContent (live preview)", () => {
  it("reflects edited notes and plan introductions without touching names or doses", () => {
    const edited: PortalContent = {
      ...content,
      medicamentos: [{ nome: "Vitamina D3" }, { nome: "Magnésio", observacao: "Antes de dormir." }],
      dieta: { introducao: "Nova introdução." },
    };
    const out = applyContent(payload, edited);
    expect(out.medicamentos).toEqual([
      { slot: "cafe_da_manha", nome: "Vitamina D3", dose: "10.000 UI" },
      { slot: "ao_deitar", nome: "Magnésio", dose: "1 cápsula", observacao: "Antes de dormir." },
    ]);
    expect(out.schedules.dieta?.introducao).toBe("Nova introdução.");
    expect(out.schedules.dieta?.texto).toBe("DIA 1 ...");
  });
});

describe("contentIssues", () => {
  const parts = {
    analise: "",
    condutaSemPlanos: "",
    receita: "1) Vitamina D3 10.000 UI",
    parsedMedications: [],
  };

  it("lists problems instead of throwing, so the editor can show them", () => {
    expect(contentIssues(content, parts, "Feminino")).toEqual([]);
    const bad = { ...content, resumo: { ...content.resumo, prioridades: ["Tomar 50.000 UI por semana"] } };
    const issues = contentIssues(bad, parts, "Feminino");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(/50\.000 UI/);
  });
});

describe("clipText (over-long model text)", () => {
  it("leaves text within the limit alone", () => {
    expect(clipText("  Curto.  ", 400)).toBe("Curto.");
  });

  it("ends at the last complete sentence instead of mid-word", () => {
    const text =
      "Seu plano alimentar foi desenhado para reduzir a gordura abdominal. Você vai comer quatro refeições por dia. Evite açúcar refinado e frituras. Beba bastante água ao longo do dia, principalmente pela manhã.";
    const out = clipText(text, 150);
    expect(out).toBe("Seu plano alimentar foi desenhado para reduzir a gordura abdominal. Você vai comer quatro refeições por dia. Evite açúcar refinado e frituras.");
    expect(out.length).toBeLessThanOrEqual(150);
  });

  it("falls back to a whole word plus ellipsis when there is no sentence end", () => {
    const out = clipText("Beba bastante água ao longo do dia principalmente pela manhã e antes dos treinos", 40);
    expect(out).toBe("Beba bastante água ao longo do dia…");
    expect(out.length).toBeLessThanOrEqual(40);
  });

  it("is applied when normalizing model output", () => {
    const long = "Frase um bem explicada. ".repeat(30);
    const parsed = parsePortalContent({ ...content, dieta: { introducao: long } });
    expect(parsed.success).toBe(true);
    const intro = parsed.success ? parsed.data.dieta!.introducao : "";
    expect(intro.length).toBeLessThanOrEqual(400);
    expect(intro.endsWith("explicada.")).toBe(true);
  });
});
