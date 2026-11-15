/**
 * Pure helpers for exams received through the CRM (safe for client and server).
 */

/** Header + text appended to the Laboratoriais layer when an exam is imported. */
export function formatImportedExam(text: string, receivedAt: string, caption?: string | null): string {
  const date = new Date(receivedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const header = `EXAME RECEBIDO PELO WHATSAPP EM ${date}${caption?.trim() ? ` — "${caption.trim()}"` : ""}`;
  return `${header}\n${text.trim()}`;
}

/** Appends a block to an existing layer, separated by a blank line. */
export function appendToLayer(existing: string, addition: string): string {
  const base = (existing ?? "").trim();
  return base ? `${base}\n\n${addition.trim()}` : addition.trim();
}
