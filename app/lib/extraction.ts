/**
 * Clinical Data Extraction Module
 *
 * Robust extraction of patient metrics and demographics from unstructured text.
 * Handles OCR errors, multiple formats, and provides confidence scoring.
 */

// --- TYPES ---

export type ExtractedMetric<T> = {
  value: T;
  confidence: "high" | "medium" | "low";
  source: string; // The matched text
  pattern: string; // Which pattern matched
};

export type ParsedMetrics = {
  hrv?: number;
  rhr?: number;
  homaIr?: number;
  hba1c?: number;
  sleepHours?: number;
  weight?: number;
  fatPercent?: number;
  muscleMass?: number;
  glucose?: number;
  insulin?: number;
};

export type ExtractedMetrics = {
  [K in keyof ParsedMetrics]?: ExtractedMetric<number>;
};

export type PatientDemographics = {
  name?: ExtractedMetric<string>;
  age?: ExtractedMetric<number>;
  sex?: ExtractedMetric<"M" | "F">;
  birthDate?: ExtractedMetric<string>;
  cpf?: ExtractedMetric<string>;
};

// --- VALIDATION RANGES ---
// Plausible clinical ranges for adult patients

const VALID_RANGES: Record<string, { min: number; max: number; typical?: { min: number; max: number } }> = {
  hrv: { min: 5, max: 200, typical: { min: 20, max: 100 } },
  rhr: { min: 30, max: 150, typical: { min: 50, max: 90 } },
  homaIr: { min: 0, max: 20, typical: { min: 0.5, max: 5 } },
  hba1c: { min: 3, max: 15, typical: { min: 4, max: 8 } },
  sleepHours: { min: 0, max: 24, typical: { min: 4, max: 12 } },
  weight: { min: 20, max: 300, typical: { min: 40, max: 150 } },
  fatPercent: { min: 3, max: 60, typical: { min: 10, max: 40 } },
  muscleMass: { min: 10, max: 100, typical: { min: 20, max: 60 } },
  glucose: { min: 30, max: 500, typical: { min: 60, max: 200 } },
  insulin: { min: 0, max: 300, typical: { min: 2, max: 50 } },
  age: { min: 0, max: 120, typical: { min: 18, max: 90 } },
};

// --- OCR ERROR CORRECTION ---

function correctOcrErrors(text: string): string {
  return text
    // Common OCR confusions
    .replace(/[oO](?=\d)/g, "0") // O before digit → 0
    .replace(/(?<=\d)[oO]/g, "0") // O after digit → 0
    .replace(/[lI](?=\d)/g, "1") // l/I before digit → 1
    .replace(/(?<=\d)[lI]/g, "1") // l/I after digit → 1
    .replace(/(?<=\d),(?=\d{1,2}(?!\d))/g, ".") // European decimal comma → dot
    .replace(/\s+/g, " "); // Normalize whitespace
}

// --- METRIC EXTRACTION ---

type MetricPattern = {
  regex: RegExp;
  name: string;
  transform?: (match: string) => number;
};

const METRIC_PATTERNS: Record<keyof ParsedMetrics, MetricPattern[]> = {
  hrv: [
    { regex: /hrv\s*(?:médio|medio|mean|avg|7d|7dias)?[:\s]*(\d+(?:[.,]\d+)?)\s*(?:ms)?/i, name: "hrv-standard" },
    { regex: /variabilidade\s*(?:da\s*)?(?:frequência|freq\.?)\s*cardíaca[:\s]*(\d+(?:[.,]\d+)?)/i, name: "hrv-full-pt" },
    { regex: /heart\s*rate\s*variability[:\s]*(\d+(?:[.,]\d+)?)/i, name: "hrv-full-en" },
    { regex: /rmssd[:\s]*(\d+(?:[.,]\d+)?)\s*(?:ms)?/i, name: "hrv-rmssd" },
    { regex: /sdnn[:\s]*(\d+(?:[.,]\d+)?)\s*(?:ms)?/i, name: "hrv-sdnn" },
  ],
  rhr: [
    { regex: /rhr[:\s]*(\d+(?:[.,]\d+)?)\s*(?:bpm)?/i, name: "rhr-abbrev" },
    { regex: /fc\s*(?:de\s*)?repouso[:\s]*(\d+(?:[.,]\d+)?)/i, name: "rhr-fc-repouso" },
    { regex: /frequência\s*cardíaca\s*(?:de\s*)?repouso[:\s]*(\d+(?:[.,]\d+)?)/i, name: "rhr-full-pt" },
    { regex: /resting\s*(?:heart\s*rate|hr)[:\s]*(\d+(?:[.,]\d+)?)/i, name: "rhr-en" },
    { regex: /fc\s*basal[:\s]*(\d+(?:[.,]\d+)?)/i, name: "rhr-basal" },
    { regex: /pulso\s*(?:de\s*)?repouso[:\s]*(\d+(?:[.,]\d+)?)/i, name: "rhr-pulso" },
  ],
  homaIr: [
    { regex: /homa[\s-]*ir[:\s]*(\d+(?:[.,]\d+)?)/i, name: "homa-ir-full" },
    { regex: /homa[:\s]*(\d+(?:[.,]\d+)?)/i, name: "homa-short" },
    { regex: /índice\s*homa[:\s]*(\d+(?:[.,]\d+)?)/i, name: "homa-indice" },
    { regex: /resistência\s*(?:à\s*)?insulina[:\s]*(\d+(?:[.,]\d+)?)/i, name: "homa-resistencia" },
  ],
  hba1c: [
    { regex: /hba1c[:\s]*(\d+(?:[.,]\d+)?)\s*%?/i, name: "hba1c-standard" },
    { regex: /hemoglobina\s*glicada[:\s]*(\d+(?:[.,]\d+)?)/i, name: "hba1c-full-pt" },
    { regex: /a1c[:\s]*(\d+(?:[.,]\d+)?)/i, name: "hba1c-short" },
    { regex: /glycated\s*hemoglobin[:\s]*(\d+(?:[.,]\d+)?)/i, name: "hba1c-en" },
  ],
  sleepHours: [
    { regex: /(?:sono|sleep|dorme|dormindo)[:\s]*(\d+(?:[.,]\d+)?)\s*h(?:oras?)?/i, name: "sleep-hours" },
    { regex: /(\d+(?:[.,]\d+)?)\s*h(?:oras?)?\s*(?:de\s*)?sono/i, name: "sleep-hours-suffix" },
    { regex: /duração\s*(?:do\s*)?sono[:\s]*(\d+(?:[.,]\d+)?)/i, name: "sleep-duration" },
    { regex: /sleep\s*duration[:\s]*(\d+(?:[.,]\d+)?)/i, name: "sleep-duration-en" },
    { regex: /tempo\s*(?:de\s*)?sono[:\s]*(\d+(?:[.,]\d+)?)/i, name: "sleep-tempo" },
  ],
  weight: [
    { regex: /peso[:\s]*(\d+(?:[.,]\d+)?)\s*(?:kg)?/i, name: "weight-peso" },
    { regex: /weight[:\s]*(\d+(?:[.,]\d+)?)\s*(?:kg)?/i, name: "weight-en" },
    { regex: /(\d+(?:[.,]\d+)?)\s*kg(?:\s|$|[,;.])/i, name: "weight-kg-suffix" },
    { regex: /massa\s*(?:corporal|total)[:\s]*(\d+(?:[.,]\d+)?)/i, name: "weight-massa" },
  ],
  fatPercent: [
    { regex: /(?:%\s*)?gordura[:\s]*(\d+(?:[.,]\d+)?)\s*%?/i, name: "fat-gordura" },
    { regex: /body\s*fat[:\s]*(\d+(?:[.,]\d+)?)\s*%?/i, name: "fat-en" },
    { regex: /bf[:\s]*(\d+(?:[.,]\d+)?)\s*%?/i, name: "fat-bf" },
    { regex: /percentual\s*(?:de\s*)?gordura[:\s]*(\d+(?:[.,]\d+)?)/i, name: "fat-percentual" },
    { regex: /gordura\s*corporal[:\s]*(\d+(?:[.,]\d+)?)/i, name: "fat-corporal" },
    { regex: /massa\s*gorda[:\s]*(\d+(?:[.,]\d+)?)\s*%/i, name: "fat-massa-gorda-pct" },
  ],
  muscleMass: [
    { regex: /massa\s*(?:muscular|magra)[:\s]*(\d+(?:[.,]\d+)?)\s*(?:kg|%)?/i, name: "muscle-massa" },
    { regex: /muscle\s*mass[:\s]*(\d+(?:[.,]\d+)?)/i, name: "muscle-en" },
    { regex: /lean\s*(?:body\s*)?mass[:\s]*(\d+(?:[.,]\d+)?)/i, name: "muscle-lean" },
    { regex: /mm[:\s]*(\d+(?:[.,]\d+)?)\s*kg/i, name: "muscle-mm-abbrev" },
  ],
  glucose: [
    { regex: /glicose\s*(?:jejum|em\s*jejum)?[:\s]*(\d+(?:[.,]\d+)?)\s*(?:mg\/dl)?/i, name: "glucose-pt" },
    { regex: /glucose\s*(?:fasting)?[:\s]*(\d+(?:[.,]\d+)?)/i, name: "glucose-en" },
    { regex: /glicemia[:\s]*(\d+(?:[.,]\d+)?)/i, name: "glucose-glicemia" },
    { regex: /fasting\s*glucose[:\s]*(\d+(?:[.,]\d+)?)/i, name: "glucose-fasting" },
  ],
  insulin: [
    { regex: /insulina\s*(?:jejum|basal)?[:\s]*(\d+(?:[.,]\d+)?)\s*(?:μu\/ml|uu\/ml|miu\/l)?/i, name: "insulin-pt" },
    { regex: /insulin\s*(?:fasting)?[:\s]*(\d+(?:[.,]\d+)?)/i, name: "insulin-en" },
    { regex: /fasting\s*insulin[:\s]*(\d+(?:[.,]\d+)?)/i, name: "insulin-fasting" },
  ],
};

function parseNumber(str: string): number {
  // Handle both . and , as decimal separators
  return parseFloat(str.replace(",", "."));
}

function isInRange(value: number, metric: keyof ParsedMetrics): boolean {
  const range = VALID_RANGES[metric];
  if (!range) return true;
  return value >= range.min && value <= range.max;
}

function getConfidence(value: number, metric: keyof ParsedMetrics, patternName: string): "high" | "medium" | "low" {
  const range = VALID_RANGES[metric];
  if (!range) return "medium";

  // Out of valid range = low confidence
  if (value < range.min || value > range.max) return "low";

  // In typical range = high confidence
  if (range.typical && value >= range.typical.min && value <= range.typical.max) {
    // Specific patterns get higher confidence
    if (patternName.includes("standard") || patternName.includes("full")) return "high";
    return "high";
  }

  // In valid but not typical range = medium confidence
  return "medium";
}

export function extractMetrics(inputs: { [key: string]: string }): ExtractedMetrics {
  const allText = correctOcrErrors(Object.values(inputs).join("\n"));
  const results: ExtractedMetrics = {};

  for (const [metric, patterns] of Object.entries(METRIC_PATTERNS) as [keyof ParsedMetrics, MetricPattern[]][]) {
    for (const pattern of patterns) {
      const match = allText.match(pattern.regex);
      if (match && match[1]) {
        const value = pattern.transform
          ? pattern.transform(match[1])
          : parseNumber(match[1]);

        // Skip invalid values
        if (isNaN(value) || !isInRange(value, metric)) continue;

        results[metric] = {
          value,
          confidence: getConfidence(value, metric, pattern.name),
          source: match[0].trim(),
          pattern: pattern.name,
        };
        break; // Use first valid match
      }
    }
  }

  return results;
}

// Simplified version for backward compatibility
export function parseMetricsFromInputs(inputs: { [key: string]: string }): ParsedMetrics {
  const extracted = extractMetrics(inputs);
  const result: ParsedMetrics = {};

  for (const [key, data] of Object.entries(extracted)) {
    if (data && data.confidence !== "low") {
      result[key as keyof ParsedMetrics] = data.value;
    }
  }

  return result;
}

// --- PATIENT DEMOGRAPHICS EXTRACTION ---

const NAME_PATTERNS = [
  // "Nome:" or "Paciente:" followed by name
  { regex: /(?:nome|paciente)\s*(?:completo|do\s*paciente)?[:\s]+([A-Za-zÀ-ÿ'\-\s]{3,60})(?=[,;|\n]|\s+\d|\s*$)/i, name: "labeled-name" },
  // Name in identification blocks
  { regex: /(?:identificação|dados\s*pessoais)[\s\S]{0,50}?nome[:\s]+([A-Za-zÀ-ÿ'\-\s]{3,60})(?=[,;|\n]|\s+\d)/i, name: "id-block-name" },
  // "Name, Age anos" format
  { regex: /^([A-Za-zÀ-ÿ'\-\s]{3,60})\s*,\s*\d+\s*anos/im, name: "name-age-format" },
  // Title case full name at line start (2-4 words)
  { regex: /^([A-ZÀ-Ú][a-zà-ÿ']+(?:\s+(?:de|da|do|dos|das|e)\s+)?[A-ZÀ-Ú][a-zà-ÿ']+(?:\s+[A-ZÀ-Ú][a-zà-ÿ']+){0,2})\s*(?:[,\n]|$)/m, name: "title-case-name" },
  // ALL CAPS name (2-4 words)
  { regex: /^([A-ZÀ-Ú][A-ZÀ-Ú'\-]+(?:\s+(?:DE|DA|DO|DOS|DAS|E)\s+)?[A-ZÀ-Ú][A-ZÀ-Ú'\-]+(?:\s+[A-ZÀ-Ú][A-ZÀ-Ú'\-]+){0,2})\s*(?:[,\n]|$)/m, name: "uppercase-name" },
];

const AGE_PATTERNS = [
  { regex: /idade[:\s]*(\d{1,3})\s*(?:anos)?/i, name: "age-labeled" },
  { regex: /(\d{1,3})\s*anos\s*(?:de\s*idade)?/i, name: "age-anos" },
  { regex: /(\d{1,3})\s*(?:years?\s*old|yo|y\.o\.)/i, name: "age-en" },
];

const SEX_PATTERNS = [
  { regex: /\b(masculino|masc\.?|homem|male)\b/i, name: "sex-male", value: "M" as const },
  { regex: /\b(feminino|fem\.?|mulher|female)\b/i, name: "sex-female", value: "F" as const },
  { regex: /sexo[:\s]*(m|f)\b/i, name: "sex-abbrev" },
];

const CPF_PATTERNS = [
  { regex: /cpf[:\s]*(\d{3}[.\s]?\d{3}[.\s]?\d{3}[-.\s]?\d{2})/i, name: "cpf-formatted" },
  { regex: /cpf[:\s]*(\d{11})/i, name: "cpf-raw" },
];

const BIRTHDATE_PATTERNS = [
  { regex: /(?:data\s*(?:de\s*)?nascimento|nasc\.?|dn)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i, name: "birthdate-pt" },
  { regex: /(?:birth\s*date|dob)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i, name: "birthdate-en" },
];

function normalizeName(name: string): string {
  let normalized = name.trim();

  // Remove trailing prepositions
  normalized = normalized.replace(/\s+(de|da|do|dos|das|e)\s*$/i, "").trim();

  // If all caps, convert to title case
  if (normalized === normalized.toUpperCase() && normalized.length > 3) {
    normalized = normalized.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase());
    // Fix Portuguese prepositions to lowercase
    normalized = normalized.replace(/\s(De|Da|Do|Dos|Das|E)\s/g, (_, p) => ` ${p.toLowerCase()} `);
  }

  return normalized;
}

function isValidName(name: string): boolean {
  // At least 3 chars, has a space (first + last name), not just numbers/symbols
  return name.length >= 3 &&
         /\s/.test(name) &&
         /[A-Za-zÀ-ÿ]{2,}/.test(name) &&
         !/^\d+$/.test(name.replace(/\s/g, ""));
}

export function extractDemographics(text: string): PatientDemographics {
  const correctedText = correctOcrErrors(text);
  const results: PatientDemographics = {};

  // Extract name
  for (const pattern of NAME_PATTERNS) {
    const match = correctedText.match(pattern.regex);
    if (match && match[1]) {
      const normalized = normalizeName(match[1]);
      if (isValidName(normalized)) {
        results.name = {
          value: normalized,
          confidence: pattern.name.includes("labeled") ? "high" : "medium",
          source: match[0].trim(),
          pattern: pattern.name,
        };
        break;
      }
    }
  }

  // Extract age
  for (const pattern of AGE_PATTERNS) {
    const match = correctedText.match(pattern.regex);
    if (match && match[1]) {
      const age = parseInt(match[1], 10);
      if (age >= 0 && age <= 120) {
        results.age = {
          value: age,
          confidence: age >= 18 && age <= 90 ? "high" : "medium",
          source: match[0].trim(),
          pattern: pattern.name,
        };
        break;
      }
    }
  }

  // Extract sex
  for (const pattern of SEX_PATTERNS) {
    const match = correctedText.match(pattern.regex);
    if (match) {
      let sex: "M" | "F";
      if ("value" in pattern && pattern.value) {
        sex = pattern.value as "M" | "F";
      } else {
        sex = match[1].toUpperCase() === "M" ? "M" : "F";
      }
      results.sex = {
        value: sex,
        confidence: "high",
        source: match[0].trim(),
        pattern: pattern.name,
      };
      break;
    }
  }

  // Extract CPF
  for (const pattern of CPF_PATTERNS) {
    const match = correctedText.match(pattern.regex);
    if (match && match[1]) {
      const cpf = match[1].replace(/[.\-\s]/g, "");
      if (cpf.length === 11) {
        results.cpf = {
          value: cpf,
          confidence: "high",
          source: match[0].trim(),
          pattern: pattern.name,
        };
        break;
      }
    }
  }

  // Extract birth date
  for (const pattern of BIRTHDATE_PATTERNS) {
    const match = correctedText.match(pattern.regex);
    if (match && match[1]) {
      results.birthDate = {
        value: match[1],
        confidence: "medium",
        source: match[0].trim(),
        pattern: pattern.name,
      };
      break;
    }
  }

  return results;
}

// --- INPUT VALIDATION ---

export type InputStatus = {
  status: "ready" | "incomplete" | "empty";
  missing: string[];
  found: string[];
};

export function validateInput(key: string, value: string): InputStatus {
  if (!value.trim()) {
    return { status: "empty", missing: [], found: [] };
  }

  const text = value.toLowerCase();
  const missing: string[] = [];
  const found: string[] = [];

  switch (key) {
    case "anamnese": {
      const demographics = extractDemographics(value);

      if (demographics.name) found.push("Nome");
      else missing.push("Nome");

      if (demographics.age) found.push("Idade");
      else if (/\d+\s*anos/i.test(value)) found.push("Idade");
      else missing.push("Idade");

      if (text.includes("queixa") || text.includes("motivo") || value.length > 100) {
        found.push("Queixa");
      } else {
        missing.push("Queixa");
      }
      break;
    }
    case "bioimpedancia": {
      const metrics = extractMetrics({ bioimpedancia: value });

      if (metrics.weight) found.push("Peso");
      if (metrics.fatPercent) found.push("Gordura");
      if (metrics.muscleMass) found.push("Massa muscular");

      if (!metrics.weight && !metrics.fatPercent && !metrics.muscleMass) {
        // Fallback to simple regex
        if (/peso|weight|\d+\s*kg/i.test(value)) found.push("Peso");
        if (/gordura|body\s*fat|bf/i.test(value)) found.push("Composição");

        if (found.length === 0) missing.push("Peso ou composição");
      }
      break;
    }
    case "wearable": {
      const metrics = extractMetrics({ wearable: value });

      if (metrics.hrv) found.push("HRV");
      if (metrics.rhr) found.push("RHR");
      if (metrics.sleepHours) found.push("Sono");

      if (!metrics.hrv && !metrics.rhr && !metrics.sleepHours) {
        // Fallback to simple detection
        if (/hrv/i.test(value)) found.push("HRV");
        if (/rhr|fc\s*repouso|heart\s*rate/i.test(value)) found.push("RHR");
        if (/sono|sleep/i.test(value)) found.push("Sono");

        if (found.length === 0) missing.push("HRV, RHR ou Sono");
      }
      break;
    }
    case "laboratoriais": {
      const labMetrics = extractMetrics({ laboratoriais: value });

      if (labMetrics.homaIr) found.push("HOMA-IR");
      if (labMetrics.hba1c) found.push("HbA1c");
      if (labMetrics.glucose) found.push("Glicose");
      if (labMetrics.insulin) found.push("Insulina");

      if (!labMetrics.homaIr && !labMetrics.hba1c && !labMetrics.glucose && !labMetrics.insulin) {
        // Fallback to simple detection
        if (/homa/i.test(value)) found.push("HOMA-IR");
        if (/hba1c|hemoglobina\s*glicada/i.test(value)) found.push("HbA1c");
        if (/glic|glucose/i.test(value)) found.push("Glicose");
        if (/insulin/i.test(value)) found.push("Insulina");

        if (found.length === 0 && value.trim().length > 10) found.push("Dados laboratoriais");
        if (found.length === 0) missing.push("Dados laboratoriais");
      }
      break;
    }
    case "genetica": {
      // Optional field - if has content, it's ready
      if (value.trim().length > 10) found.push("Dados genéticos");
      break;
    }
  }

  return {
    status: missing.length > 0 ? "incomplete" : "ready",
    missing,
    found,
  };
}

// --- UTILITY: Get extraction summary ---

export function getExtractionSummary(inputs: { [key: string]: string }): {
  metrics: ExtractedMetrics;
  demographics: PatientDemographics;
  validation: { [key: string]: InputStatus };
} {
  const allText = Object.values(inputs).join("\n");

  return {
    metrics: extractMetrics(inputs),
    demographics: extractDemographics(allText),
    validation: {
      anamnese: validateInput("anamnese", inputs.anamnese || ""),
      bioimpedancia: validateInput("bioimpedancia", inputs.bioimpedancia || ""),
      laboratoriais: validateInput("laboratoriais", inputs.laboratoriais || ""),
      wearable: validateInput("wearable", inputs.wearable || ""),
      genetica: validateInput("genetica", inputs.genetica || ""),
    },
  };
}
