export const CRONOGRAMA_HEADING = "CRONOGRAMA DIÁRIO";

/**
 * Splits a receita string into the item list (RECEITUÁRIO + SUPLEMENTAÇÃO,
 * everything before the heading) and the CRONOGRAMA DIÁRIO section itself
 * (heading through the end of the string). Returns null if the doctor
 * removed the section entirely — callers must not resurrect it.
 */
export function splitCronograma(receita: string): { itemsText: string; heading: string } | null {
  const idx = receita.indexOf(CRONOGRAMA_HEADING);
  if (idx === -1) return null;
  return { itemsText: receita.slice(0, idx).trimEnd(), heading: receita.slice(idx) };
}

export function mergeCronograma(itemsText: string, newSection: string): string {
  return `${itemsText}\n\n\n${newSection.trim()}`;
}
