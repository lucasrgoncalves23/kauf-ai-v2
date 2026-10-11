import { describe, it, expect } from "vitest";
import { extractThirtyDayBlocks, parseDays, parseCronograma, parseReceitaItems } from "../portal/extract";

export const SAMPLE_CONDUTA = `1. SONO - Higiene e suplementos noturnos
Magnésio bisglicinato: 400mg, oral, 1h antes de dormir
Deitar até 23h

2. NUTRIÇÃO - Macros e dieta semanal
Proteína 1,8 g/kg/dia
Reduzir ultraprocessados

EXEMPLO DE DIETA POR 30 DIAS
Dia 1: Café: ovos mexidos e mamão. Almoço: frango grelhado, arroz integral e salada. Jantar: sopa de legumes.
Dia 2: Café: iogurte natural com chia. Almoço: peixe assado com batata-doce. Jantar: omelete de espinafre.
Dia 3: Café: tapioca com queijo. Almoço: carne moída com abóbora. Jantar: salada com atum.

3. EXERCÍCIO - Força, HIIT, mobilidade
Treino de força 3x/semana

EXEMPLO DE TREINO POR 30 DIAS
Dia 1 - Agachamento 3x10, supino 3x10, remada 3x10
Dia 2 - Caminhada 40 min
Dia 3 - Descanso ativo: mobilidade 20 min

4. SUPLEMENTAÇÃO - Por eixos
Vitamina D3: 10.000 UI, oral, 1x/dia com a primeira refeição
Ômega-3: 2g, oral, no almoço

8. HORMONAL
AGUARDANDO: HRV > 50ms estável
Módulo aguarda estabilização autonômica.`;

export const SAMPLE_RECEITA = `RECEITUÁRIO
Paciente: Teste Portal
Data: 11/10/2026

1) Testosterona cipionato 200mg/mL ampola
   Uso: 0,5 mL IM a cada 7 dias
   Qtd: 2 ampolas

Fórmula 1:
Magnésio bisglicinato: 400mg
Glicina: 2g
Uso: 1 dose 1h antes de dormir
Qtd: 30 doses

Dr. Oskar Kaufmann
CRM-SP: 104028

SUPLEMENTAÇÃO (sem necessidade de receita)
1) Vitamina D3 10.000 UI cápsula
   Uso: 1 cápsula ao dia com a primeira refeição
   Qtd: 30 cápsulas
2) Ômega-3 1000mg cápsula
   Uso: 2 cápsulas no almoço
   Qtd: 60 cápsulas

CRONOGRAMA DIÁRIO
AO ACORDAR (6h-7h)
- Água com limão: 300 mL
CAFÉ DA MANHÃ (7h-8h)
- Vitamina D3: 10.000 UI
ALMOÇO (12h-13h)
- Ômega-3: 2g
PRÉ-TREINO
- Creatina: 5g
AO DEITAR (22h-23h)
- Fórmula 1 (Magnésio + Glicina): 1 dose`;

describe("extractThirtyDayBlocks", () => {
  it("pulls diet and training blocks out of the conduta and leaves a placeholder", () => {
    const { dieta, treino, condutaSemPlanos } = extractThirtyDayBlocks(SAMPLE_CONDUTA);
    expect(dieta).toMatch(/^EXEMPLO DE DIETA POR 30 DIAS/);
    expect(dieta).toContain("Dia 3: Café: tapioca");
    expect(dieta).not.toContain("3. EXERCÍCIO");
    expect(treino).toMatch(/^EXEMPLO DE TREINO POR 30 DIAS/);
    expect(treino).toContain("Dia 2 - Caminhada 40 min");
    expect(treino).not.toContain("4. SUPLEMENTAÇÃO");
    expect(condutaSemPlanos).not.toContain("Dia 1: Café");
    expect(condutaSemPlanos).not.toContain("Agachamento");
    expect(condutaSemPlanos).toContain("4. SUPLEMENTAÇÃO");
    expect(condutaSemPlanos).toContain("AGUARDANDO: HRV > 50ms");
    expect(condutaSemPlanos.match(/plano de 30 dias apresentado/g)).toHaveLength(2);
  });

  it("handles condutas without the blocks and accent variants", () => {
    const plain = extractThirtyDayBlocks("1. SONO\nDormir cedo\n\n2. NUTRIÇÃO\nComer bem");
    expect(plain.dieta).toBeUndefined();
    expect(plain.treino).toBeUndefined();
    expect(plain.condutaSemPlanos).toBe("1. SONO\nDormir cedo\n\n2. NUTRIÇÃO\nComer bem");

    const variant = extractThirtyDayBlocks("2. NUTRICAO\nexemplo de dieta para 30 dias\nDia 1: x\nDia 2: y");
    expect(variant.dieta).toContain("Dia 2: y");
  });
});

describe("parseDays", () => {
  it("splits Dia N entries with mixed separators and keeps continuation lines", () => {
    const days = parseDays("EXEMPLO DE TREINO POR 30 DIAS\nDia 1 - Agachamento 3x10\nmais uma série leve\nDia 2: Caminhada\nDia 3) Descanso");
    expect(days).toEqual([
      { dia: 1, texto: "Agachamento 3x10\nmais uma série leve" },
      { dia: 2, texto: "Caminhada" },
      { dia: 3, texto: "Descanso" },
    ]);
  });

  it("returns null when there is no day structure", () => {
    expect(parseDays("EXEMPLO DE DIETA POR 30 DIAS\nComa bem todos os dias.")).toBeNull();
    expect(parseDays("EXEMPLO DE DIETA POR 30 DIAS\nDia 1: só um dia")).toBeNull();
  });
});

describe("parseCronograma", () => {
  it("reads items per time slot with doses verbatim", () => {
    const items = parseCronograma(SAMPLE_RECEITA);
    expect(items).toEqual([
      { slot: "ao_acordar", nome: "Água com limão", dose: "300 mL" },
      { slot: "cafe_da_manha", nome: "Vitamina D3", dose: "10.000 UI" },
      { slot: "almoco", nome: "Ômega-3", dose: "2g" },
      { slot: "pre_treino", nome: "Creatina", dose: "5g" },
      { slot: "ao_deitar", nome: "Fórmula 1 (Magnésio + Glicina)", dose: "1 dose" },
    ]);
  });

  it("returns null when the receita has no cronograma", () => {
    expect(parseCronograma("1) Vitamina D3\n   Uso: 1 ao dia")).toBeNull();
    expect(parseCronograma("")).toBeNull();
  });
});

describe("parseReceitaItems", () => {
  it("falls back to numbered items with their Uso line and formula components", () => {
    const items = parseReceitaItems(SAMPLE_RECEITA);
    expect(items.map((i) => i.nome)).toEqual([
      "Testosterona cipionato 200mg/mL ampola",
      "Fórmula 1",
      "Vitamina D3 10.000 UI cápsula",
      "Ômega-3 1000mg cápsula",
    ]);
    expect(items[0].observacao).toBe("0,5 mL IM a cada 7 dias");
    expect(items[1].observacao).toContain("Magnésio bisglicinato: 400mg");
    expect(items[1].observacao).toContain("1 dose 1h antes de dormir");
    expect(items[2].observacao).toBe("1 cápsula ao dia com a primeira refeição");
    expect(items.every((i) => i.slot === "outro")).toBe(true);
  });

  it("returns an empty list for an empty receita", () => {
    expect(parseReceitaItems("")).toEqual([]);
  });
});
