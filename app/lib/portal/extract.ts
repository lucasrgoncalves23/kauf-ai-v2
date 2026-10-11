import { splitCronograma } from "../cronogramaSync";
import type { Slot } from "./schema";

export type ParsedMedication = { slot: Slot; nome: string; dose: string; observacao?: string };
export type ScheduleDay = { dia: number; texto: string };

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const DIET_HEADING = /EXEMPLO\s+DE\s+DIETA\s+(?:POR|PARA|DE)\s+30\s+DIAS[^\n]*/i;
const TRAINING_HEADING = /EXEMPLO\s+DE\s+TREINO\s+(?:POR|PARA|DE)\s+30\s+DIAS[^\n]*/i;
// "3. EXERCÍCIO - ..." style top-level section titles of the conduta
const SECTION_HEADING = /^\s*\d{1,2}[.)]\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ/\s-]{2,}/m;

type Range = { start: number; end: number };

function findBlock(text: string, heading: RegExp, otherHeading: RegExp): Range | null {
  const match = heading.exec(text);
  if (!match) return null;
  const bodyStart = match.index + match[0].length;
  const rest = text.slice(bodyStart);
  const stops = [SECTION_HEADING.exec(rest)?.index, otherHeading.exec(rest)?.index].filter(
    (i): i is number => i !== undefined
  );
  const end = bodyStart + (stops.length ? Math.min(...stops) : rest.length);
  return { start: match.index, end };
}

const PLACEHOLDER = "(plano de 30 dias apresentado em seção própria)";

export function extractThirtyDayBlocks(conduta: string): {
  dieta?: string;
  treino?: string;
  condutaSemPlanos: string;
} {
  const diet = findBlock(conduta, DIET_HEADING, TRAINING_HEADING);
  const training = findBlock(conduta, TRAINING_HEADING, DIET_HEADING);
  const ranges = [diet, training].filter((r): r is Range => r !== null).sort((a, b) => a.start - b.start);

  let out = "";
  let cursor = 0;
  for (const r of ranges) {
    out += conduta.slice(cursor, r.start) + PLACEHOLDER;
    cursor = r.end;
  }
  out += conduta.slice(cursor);

  return {
    dieta: diet ? conduta.slice(diet.start, diet.end).trim() : undefined,
    treino: training ? conduta.slice(training.start, training.end).trim() : undefined,
    condutaSemPlanos: out,
  };
}

const DAY_LINE = /^\s*(?:dia|day)\s*(\d{1,2})\b\s*[:.\-–—)]?\s*(.*)$/i;

/** Splits a 30-day block into days; null when fewer than two "Dia N" entries are found. */
export function parseDays(block: string): ScheduleDay[] | null {
  const days: ScheduleDay[] = [];
  for (const raw of block.split("\n").slice(1)) {
    const match = DAY_LINE.exec(raw);
    if (match) {
      days.push({ dia: Number(match[1]), texto: match[2].trim() });
    } else if (days.length && raw.trim()) {
      const current = days[days.length - 1];
      current.texto = current.texto ? `${current.texto}\n${raw.trim()}` : raw.trim();
    }
  }
  return days.length >= 2 ? days : null;
}

const SLOT_MATCHERS: [RegExp, Slot][] = [
  [/^AO ACORDAR/, "ao_acordar"],
  [/^CAFE DA MANHA/, "cafe_da_manha"],
  [/^ALMOCO/, "almoco"],
  [/^PRE[\s-]*TREINO/, "pre_treino"],
  [/^JANTAR/, "jantar"],
  [/^AO DEITAR/, "ao_deitar"],
];

function cleanLine(raw: string): string {
  return raw.trim().replace(/^[-•*]\s*/, "");
}

/** Deterministic read of the receita's CRONOGRAMA DIÁRIO; null when the section is absent. */
export function parseCronograma(receita: string): ParsedMedication[] | null {
  const split = splitCronograma(receita || "");
  if (!split) return null;

  const items: ParsedMedication[] = [];
  let slot: Slot = "outro";
  for (const raw of split.heading.split("\n").slice(1)) {
    const line = cleanLine(raw);
    if (!line) continue;
    const key = stripAccents(line).toUpperCase();
    const slotHit = SLOT_MATCHERS.find(([re]) => re.test(key));
    if (slotHit) {
      slot = slotHit[1];
      continue;
    }
    const isHeading = /^[A-Z0-9\s\-/()]+:?$/.test(key) && !/:\s*\S/.test(line);
    if (isHeading) {
      slot = "outro";
      continue;
    }
    const idx = line.indexOf(":");
    if (idx > 0) {
      items.push({ slot, nome: line.slice(0, idx).trim(), dose: line.slice(idx + 1).trim() });
    } else {
      items.push({ slot, nome: line.replace(/^[\d.)\s]+/, "").trim(), dose: "" });
    }
  }
  return items.length ? items : null;
}

/** Fallback when there is no cronograma: numbered receita items with their "Uso:" line. */
export function parseReceitaItems(receita: string): ParsedMedication[] {
  const body = splitCronograma(receita || "")?.itemsText ?? receita ?? "";
  const items: ParsedMedication[] = [];
  let current: ParsedMedication | null = null;

  for (const raw of body.split("\n")) {
    const line = cleanLine(raw);
    if (!line) continue;

    const numbered = /^\d{1,2}\)\s*(.+)$/.exec(line);
    if (numbered) {
      current = { slot: "outro", nome: numbered[1].trim(), dose: "" };
      items.push(current);
      continue;
    }
    const formula = /^f[óo]rmula\s*\d+\s*:?\s*(.*)$/i.exec(line);
    if (formula) {
      current = { slot: "outro", nome: line.replace(/:\s*$/, ""), dose: "" };
      items.push(current);
      continue;
    }
    if (!current) continue;

    const uso = /^uso:\s*(.+)$/i.exec(line);
    if (uso) {
      current.observacao = current.observacao ? `${current.observacao} · ${uso[1].trim()}` : uso[1].trim();
      continue;
    }
    if (/^f[óo]rmula/i.test(current.nome) && /^[^:]+:\s*\S/.test(line) && !/^qtd/i.test(line)) {
      current.observacao = current.observacao ? `${current.observacao}; ${line}` : line;
    }
  }
  return items;
}
