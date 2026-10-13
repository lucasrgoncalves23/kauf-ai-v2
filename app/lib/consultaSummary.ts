import type { Consulta, ConsultaEntry } from "../types/clinical";

export function isFullConsulta(c: ConsultaEntry): c is Consulta {
  return !("summary" in c && c.summary === true);
}

/** Whether the consulta has the given output, for full records and summaries alike. */
export function consultaHas(c: ConsultaEntry, key: "analise" | "conduta" | "receita"): boolean {
  if (isFullConsulta(c)) return !!c.outputs?.[key];
  if (key === "analise") return c.hasAnalise;
  if (key === "conduta") return c.hasConduta;
  return c.hasReceita;
}
