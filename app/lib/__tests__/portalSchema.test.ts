import { describe, it, expect } from "vitest";
import { portalContentSchema, portalContentJsonSchema, flattenContentText, parsePortalContent } from "../portal/schema";

export const GOLDEN_CONTENT = {
  resumo: {
    texto: "Seu açúcar no sangue melhorou bastante desde a última consulta. A vitamina D continua baixa e merece atenção nos próximos meses.",
    prioridades: ["Tomar a vitamina D todos os dias", "Dormir pelo menos 7 horas"],
  },
  modulos: [
    { id: "sono", titulo: "Sono", ativo: true, acoes: ["Deitar antes das 23h", "Sem telas 1 hora antes de dormir"], porque: "Dormir bem ajuda o corpo a regular o açúcar." },
    { id: "hormonal", titulo: "Hormônios", ativo: false, acoes: [], maisAdiante: "Vamos conversar sobre isso quando o sono estiver mais estável." },
  ],
  medicamentos: [
    { nome: "Vitamina D3", dose: "10.000 UI", slot: "cafe_da_manha", observacao: "Com a primeira refeição." },
  ],
  exames: [
    { marcador: "glicose", nomePopular: "Açúcar no sangue", explicacao: "Mostra quanto açúcar circula em jejum; o seu voltou ao normal.", situacao: "bem" },
  ],
  proximosPassos: {
    examesAntes: ["Vitamina D", "Açúcar no sangue"],
    sinaisDeAlerta: ["Tontura forte ao levantar"],
  },
  dieta: { introducao: "Um exemplo de cardápio para os próximos 30 dias." },
} as const;

describe("portal content schema", () => {
  it("accepts the golden content", () => {
    const parsed = portalContentSchema.safeParse(GOLDEN_CONTENT);
    expect(parsed.success).toBe(true);
  });

  it("rejects unknown module ids, slots and markers", () => {
    expect(portalContentSchema.safeParse({ ...GOLDEN_CONTENT, modulos: [{ id: "cirurgia", titulo: "X", ativo: true, acoes: [] }] }).success).toBe(false);
    expect(portalContentSchema.safeParse({ ...GOLDEN_CONTENT, medicamentos: [{ nome: "A", dose: "1", slot: "madrugada" }] }).success).toBe(false);
    expect(portalContentSchema.safeParse({ ...GOLDEN_CONTENT, exames: [{ marcador: "cortisol", nomePopular: "Cortisol", explicacao: "Hormônio do estresse.", situacao: "bem" }] }).success).toBe(false);
  });

  it("rejects missing sections and oversized text", () => {
    const { proximosPassos: _p, ...noNext } = GOLDEN_CONTENT;
    void _p;
    expect(portalContentSchema.safeParse(noNext).success).toBe(false);
    expect(portalContentSchema.safeParse({ ...GOLDEN_CONTENT, resumo: { texto: "x".repeat(1300), prioridades: ["a"] } }).success).toBe(false);
    expect(portalContentSchema.safeParse({ ...GOLDEN_CONTENT, resumo: { texto: GOLDEN_CONTENT.resumo.texto, prioridades: [] } }).success).toBe(false);
  });

  it("strips unknown keys instead of failing", () => {
    const parsed = portalContentSchema.parse({ ...GOLDEN_CONTENT, extra: "ignored" });
    expect("extra" in parsed).toBe(false);
  });

  it("produces a JSON schema usable as a tool input_schema", () => {
    const schema = portalContentJsonSchema();
    expect(schema.type).toBe("object");
    expect(schema).not.toHaveProperty("$schema");
    const props = schema.properties as Record<string, unknown>;
    expect(Object.keys(props)).toEqual(expect.arrayContaining(["resumo", "modulos", "medicamentos", "exames", "proximosPassos"]));
  });

  it("flattens every free-text field for rule checking", () => {
    const text = flattenContentText(portalContentSchema.parse(GOLDEN_CONTENT));
    expect(text).toContain("Deitar antes das 23h");
    expect(text).toContain("Com a primeira refeição.");
    expect(text).toContain("Tontura forte ao levantar");
    expect(text).toContain("Vamos conversar sobre isso");
  });
});

describe("parsePortalContent", () => {
  it("repairs the shape slips seen in real output: omitted acoes on waiting modules", () => {
    const raw = {
      ...GOLDEN_CONTENT,
      modulos: [
        GOLDEN_CONTENT.modulos[0],
        { id: "hormonal", titulo: "Hormônios", ativo: false, maisAdiante: "Mais adiante." },
        { id: "peptideos", titulo: "Peptídeos", maisAdiante: "Depois." },
      ],
    };
    const parsed = parsePortalContent(raw);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.modulos[1].acoes).toEqual([]);
    expect(parsed.data.modulos[2]).toMatchObject({ ativo: false, acoes: [] });
  });

  it("trims over-long text, caps lists, turns nulls into omissions and drops unknown enum items", () => {
    const parsed = parsePortalContent({
      ...GOLDEN_CONTENT,
      resumo: { texto: "x".repeat(2000), prioridades: ["a1", "b2", "c3", "d4", "e5", null] },
      modulos: [
        { id: "sono", titulo: "Sono", ativo: true, acoes: ["1a", "2a", "3a", "4a", "5a", "6a", "7a"], porque: null },
        { id: "cirurgia", titulo: "X", ativo: true, acoes: [] },
      ],
      medicamentos: [{ nome: "Vitamina D3", dose: "10.000 UI", slot: "madrugada", observacao: null }],
      exames: [
        { marcador: "glicose", nomePopular: "Açúcar", explicacao: "Mostra o açúcar em jejum.", situacao: "ok" },
        { marcador: "cortisol", nomePopular: "Cortisol", explicacao: "Hormônio do estresse.", situacao: "bem" },
      ],
      dieta: null,
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.resumo.texto).toHaveLength(1200);
    expect(parsed.data.resumo.prioridades).toHaveLength(4);
    expect(parsed.data.modulos).toHaveLength(1);
    expect(parsed.data.modulos[0].acoes).toHaveLength(6);
    expect(parsed.data.modulos[0].porque).toBeUndefined();
    expect(parsed.data.medicamentos[0]).toEqual({ nome: "Vitamina D3", dose: "10.000 UI", slot: "outro" });
    expect(parsed.data.exames).toEqual([{ marcador: "glicose", nomePopular: "Açúcar", explicacao: "Mostra o açúcar em jejum.", situacao: "atencao" }]);
    expect(parsed.data.dieta).toBeUndefined();
  });

  it("still rejects output with no usable summary", () => {
    expect(parsePortalContent({ ...GOLDEN_CONTENT, resumo: { texto: "", prioridades: [] } }).success).toBe(false);
    expect(parsePortalContent(null).success).toBe(false);
  });
});
