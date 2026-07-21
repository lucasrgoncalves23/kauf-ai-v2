import { getPinHeaders } from "./api-client";
import { logger } from "./logger";
import type { ClinicalData } from "../types/clinical";

/**
 * Invisible pre-generation step: input fields above this size (huge pasted
 * exam PDFs) are condensed server-side into a structured summary before
 * being sent to the generation routes. Typed inputs never reach this size,
 * and the doctor's input boxes are never modified — only the payload sent
 * to the AI changes.
 */
const CONDENSE_THRESHOLD = 15_000;

// Session-lived: regenerating (or generating conduta after analise) with the
// same inputs reuses the summary instead of paying another extraction pass.
const cache = new Map<string, string>();

function hashText(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  }
  return `${text.length}:${h}`;
}

async function condenseField(
  section: string,
  text: string,
  signal?: AbortSignal
): Promise<string> {
  const cacheKey = `${section}:${hashText(text)}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const response = await fetch("/api/condense-exam", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getPinHeaders() },
    body: JSON.stringify({ section, text }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`condense-exam ${response.status}`);
  }

  const data = await response.json();
  if (!data.text || typeof data.text !== "string" || !data.text.trim()) {
    throw new Error("condense-exam returned empty text");
  }

  cache.set(cacheKey, data.text);
  return data.text;
}

/**
 * Returns a copy of the inputs where oversized fields are replaced by their
 * condensed summaries. Fields that fail to condense keep their raw text —
 * generation must never be blocked by this optimization.
 */
export async function condenseInputs(
  inputs: ClinicalData,
  signal?: AbortSignal
): Promise<ClinicalData> {
  const result = { ...inputs };
  const fields = Object.keys(inputs) as (keyof ClinicalData)[];

  await Promise.all(
    fields.map(async (field) => {
      const value = inputs[field];
      if (typeof value !== "string" || value.length <= CONDENSE_THRESHOLD) return;

      try {
        result[field] = await condenseField(field, value, signal);
      } catch (err: any) {
        if (err?.name === "AbortError") throw err;
        logger.warn("Exam condensation failed, sending raw text", {
          field,
          error: String(err),
        });
      }
    })
  );

  return result;
}
