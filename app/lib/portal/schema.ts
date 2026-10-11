import { z } from "zod";
import { LAB_MARKERS, type LabMarkerKey } from "../labTrends";

export const MODULE_IDS = [
  "sono",
  "nutricao",
  "exercicio",
  "suplementacao",
  "manipulados",
  "soroterapia",
  "glp1",
  "hormonal",
  "peptideos",
] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

export const MODULE_LABELS: Record<ModuleId, string> = {
  sono: "Sono",
  nutricao: "Alimentação",
  exercicio: "Exercício",
  suplementacao: "Suplementos",
  manipulados: "Fórmulas manipuladas",
  soroterapia: "Soroterapia",
  glp1: "Medicação para o metabolismo",
  hormonal: "Hormônios",
  peptideos: "Peptídeos",
};

export const SLOTS = [
  "ao_acordar",
  "cafe_da_manha",
  "almoco",
  "pre_treino",
  "jantar",
  "ao_deitar",
  "outro",
] as const;
export type Slot = (typeof SLOTS)[number];

export const SLOT_LABELS: Record<Slot, string> = {
  ao_acordar: "Ao acordar",
  cafe_da_manha: "Café da manhã",
  almoco: "Almoço",
  pre_treino: "Antes do treino",
  jantar: "Jantar",
  ao_deitar: "Ao deitar",
  outro: "Outros horários",
};

const MARKER_KEYS = LAB_MARKERS.map((m) => m.key) as [LabMarkerKey, ...LabMarkerKey[]];

export const portalContentSchema = z.object({
  resumo: z.object({
    texto: z
      .string()
      .min(20)
      .max(1200)
      .describe("3 a 6 frases em linguagem simples: o que está indo bem e o que precisa de atenção. Sem números de exame."),
    prioridades: z
      .array(z.string().min(2).max(120))
      .min(1)
      .max(4)
      .describe("2 a 4 prioridades curtas para o período, em frases de ação."),
  }),
  modulos: z
    .array(
      z.object({
        id: z.enum(MODULE_IDS),
        titulo: z.string().min(2).max(60).describe("Nome simples da área, sem jargão."),
        ativo: z.boolean().describe("false quando a conduta diz que o módulo aguarda estabilização."),
        acoes: z
          .array(z.string().min(2).max(200))
          .max(6)
          .describe("O que o paciente faz no dia a dia nesta área. Vazio se o módulo não está ativo."),
        porque: z.string().max(240).optional().describe("Uma frase sobre por que isso importa para este paciente."),
        maisAdiante: z
          .string()
          .max(240)
          .optional()
          .describe("Se não está ativo: o que precisa melhorar antes, em linguagem simples."),
      })
    )
    .max(9),
  medicamentos: z
    .array(
      z.object({
        nome: z.string().min(1).max(120),
        dose: z.string().max(200),
        slot: z.enum(SLOTS),
        observacao: z
          .string()
          .max(200)
          .optional()
          .describe("Como tomar, só com informação que já está na receita (ex.: com a primeira refeição)."),
      })
    )
    .max(60),
  exames: z
    .array(
      z.object({
        marcador: z.enum(MARKER_KEYS),
        nomePopular: z.string().min(2).max(60).describe("Nome que o paciente reconhece, ex.: 'Açúcar no sangue'."),
        explicacao: z.string().min(5).max(300).describe("Uma frase: o que este exame mostra para este paciente."),
        situacao: z.enum(["bem", "atencao", "cuidado"]),
      })
    )
    .max(30),
  proximosPassos: z.object({
    examesAntes: z.array(z.string().max(120)).max(12).describe("Exames a fazer antes do próximo retorno, com nomes populares."),
    sinaisDeAlerta: z
      .array(z.string().max(160))
      .max(8)
      .describe("Sinais que justificam contato com a clínica antes do retorno."),
    observacoes: z.string().max(400).optional(),
  }),
  dieta: z.object({ introducao: z.string().max(400) }).optional(),
  treino: z.object({ introducao: z.string().max(400) }).optional(),
});

export type PortalContent = z.infer<typeof portalContentSchema>;

export function portalContentJsonSchema(): Record<string, unknown> {
  const { $schema: _omit, ...schema } = z.toJSONSchema(portalContentSchema) as Record<string, unknown>;
  void _omit;
  return schema;
}

// ---------- Normalization of model output ----------
// Length caps and list shapes are presentation limits, not safety checks, so small
// slips (an omitted empty list, a long sentence, an unknown enum value) are repaired
// here instead of failing the whole generation. Dose/marker/rule checks run afterwards.

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const arr = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const optStr = (v: unknown, max: number): string | undefined => str(v, max) || undefined;
const strList = (v: unknown, maxItems: number, maxLen: number, minLen = 1): string[] =>
  arr(v, maxItems)
    .map((s) => str(s, maxLen))
    .filter((s) => s.length >= minLen);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | null =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null;

export function normalizePortalContent(raw: unknown): unknown {
  const r = obj(raw);
  const resumo = obj(r.resumo);
  const proximos = obj(r.proximosPassos);
  const intro = (v: unknown) => {
    const text = optStr(obj(v).introducao, 400);
    return text ? { introducao: text } : undefined;
  };

  return {
    resumo: { texto: str(resumo.texto, 1200), prioridades: strList(resumo.prioridades, 4, 120, 2) },
    modulos: arr(r.modulos, 9).flatMap((m) => {
      const mod = obj(m);
      const id = oneOf(mod.id, MODULE_IDS);
      if (!id) return [];
      const acoes = strList(mod.acoes, 6, 200, 2);
      const titulo = str(mod.titulo, 60);
      return [
        {
          id,
          titulo: titulo.length >= 2 ? titulo : MODULE_LABELS[id],
          ativo: typeof mod.ativo === "boolean" ? mod.ativo : acoes.length > 0,
          acoes,
          porque: optStr(mod.porque, 240),
          maisAdiante: optStr(mod.maisAdiante, 240),
        },
      ];
    }),
    medicamentos: arr(r.medicamentos, 60).flatMap((m) => {
      const med = obj(m);
      const nome = str(med.nome, 120);
      if (!nome) return [];
      return [{ nome, dose: str(med.dose, 200), slot: oneOf(med.slot, SLOTS) ?? "outro", observacao: optStr(med.observacao, 200) }];
    }),
    exames: arr(r.exames, 30).flatMap((e) => {
      const ex = obj(e);
      const marcador = oneOf(ex.marcador, MARKER_KEYS);
      const nomePopular = str(ex.nomePopular, 60);
      const explicacao = str(ex.explicacao, 300);
      if (!marcador || nomePopular.length < 2 || explicacao.length < 5) return [];
      return [{ marcador, nomePopular, explicacao, situacao: oneOf(ex.situacao, ["bem", "atencao", "cuidado"] as const) ?? "atencao" }];
    }),
    proximosPassos: {
      examesAntes: strList(proximos.examesAntes, 12, 120),
      sinaisDeAlerta: strList(proximos.sinaisDeAlerta, 8, 160),
      observacoes: optStr(proximos.observacoes, 400),
    },
    dieta: intro(r.dieta),
    treino: intro(r.treino),
  };
}

export function parsePortalContent(raw: unknown) {
  return portalContentSchema.safeParse(normalizePortalContent(raw));
}

export function flattenContentText(content: PortalContent): string {
  const parts: string[] = [content.resumo.texto, ...content.resumo.prioridades];
  for (const m of content.modulos) parts.push(m.titulo, ...m.acoes, m.porque ?? "", m.maisAdiante ?? "");
  for (const m of content.medicamentos) parts.push(m.nome, m.dose, m.observacao ?? "");
  for (const e of content.exames) parts.push(e.nomePopular, e.explicacao);
  parts.push(
    ...content.proximosPassos.examesAntes,
    ...content.proximosPassos.sinaisDeAlerta,
    content.proximosPassos.observacoes ?? "",
    content.dieta?.introducao ?? "",
    content.treino?.introducao ?? ""
  );
  return parts.filter(Boolean).join("\n");
}
