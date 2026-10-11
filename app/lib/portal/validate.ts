import { stripAccents } from "./extract";

export function normalizeForMatch(s: string): string {
  return stripAccents(s).toLowerCase().replace(/\s+/g, "");
}

// Number + dosage unit, e.g. "2,5mg", "10.000 UI", "200 mcg", "2 cápsulas"
const DOSE_TOKEN =
  /(\d+(?:[.,]\d+)*)\s*(mcg|µg|ug|mg|ui|iu|ml|g|c[aá]psulas?|comprimidos?|gotas?|ampolas?|unidades?)(?![a-zà-ú])/gi;

/** Dose-like mentions in AI-written text that do not appear verbatim in the doctor's documents. */
export function unverifiedDoseMentions(aiText: string, sourceText: string): string[] {
  const haystack = normalizeForMatch(sourceText);
  const found = new Set<string>();
  for (const m of aiText.matchAll(DOSE_TOKEN)) {
    const token = `${m[1]}${m[2]}`;
    if (!haystack.includes(normalizeForMatch(token))) found.add(m[0].trim());
  }
  return [...found];
}

// Lockout ladder on wrong-CPF attempts
export const LOCKOUT_THRESHOLDS = { short: 5, long: 10, permanent: 20 } as const;
const SHORT_LOCK_MS = 15 * 60 * 1000;
const LONG_LOCK_MS = 24 * 60 * 60 * 1000;

export function lockoutAfter(failedAttempts: number, now: Date): { lockedUntil: Date | null; permanent: boolean } {
  if (failedAttempts >= LOCKOUT_THRESHOLDS.permanent) return { lockedUntil: null, permanent: true };
  if (failedAttempts >= LOCKOUT_THRESHOLDS.long) return { lockedUntil: new Date(now.getTime() + LONG_LOCK_MS), permanent: false };
  if (failedAttempts >= LOCKOUT_THRESHOLDS.short) return { lockedUntil: new Date(now.getTime() + SHORT_LOCK_MS), permanent: false };
  return { lockedUntil: null, permanent: false };
}

export type OpenRow = {
  status: string;
  expiresAt: string;
  lockedUntil: string | null;
  failedAttempts: number;
  hasPayload: boolean;
  patientActive: boolean;
};

export type OpenDecision = {
  kind: "not_found" | "revoked" | "superseded" | "locked" | "expired" | "locked_temp" | "cpf_mismatch" | "ok";
  http: 200 | 401 | 410;
  message: string;
  mutation: "increment" | "reset" | null;
  lockedUntil?: Date | null;
  permanentLock?: boolean;
};

export const GENERIC_DENIED = "Não foi possível acessar. Verifique o CPF ou peça um novo link à clínica.";

function formatWait(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  if (minutes < 60) return `${minutes} minuto${minutes === 1 ? "" : "s"}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} hora${hours === 1 ? "" : "s"}`;
}

export function decideOpen(row: OpenRow | null, now: Date, cpfMatches: boolean): OpenDecision {
  if (!row || !row.patientActive) {
    return { kind: "not_found", http: 401, message: GENERIC_DENIED, mutation: null };
  }
  if (row.status === "revoked" || !row.hasPayload) {
    return { kind: "revoked", http: 410, message: "Este link foi desativado pela clínica. Peça um novo link.", mutation: null };
  }
  if (row.status === "superseded") {
    return {
      kind: "superseded",
      http: 410,
      message: "Este link foi substituído por um mais recente. Use o link mais novo ou peça outro à clínica.",
      mutation: null,
    };
  }
  if (row.status === "locked") {
    return {
      kind: "locked",
      http: 410,
      message: "Este link foi bloqueado por segurança após muitas tentativas. Entre em contato com a clínica para receber um novo link.",
      mutation: null,
    };
  }
  if (new Date(row.expiresAt).getTime() <= now.getTime()) {
    return { kind: "expired", http: 410, message: "Este link expirou. Peça um novo link à clínica.", mutation: null };
  }
  if (row.lockedUntil && new Date(row.lockedUntil).getTime() > now.getTime()) {
    const wait = new Date(row.lockedUntil).getTime() - now.getTime();
    return { kind: "locked_temp", http: 410, message: `Muitas tentativas. Tente novamente em ${formatWait(wait)}.`, mutation: null };
  }
  if (!cpfMatches) {
    const lock = lockoutAfter(row.failedAttempts + 1, now);
    return {
      kind: "cpf_mismatch",
      http: 401,
      message: GENERIC_DENIED,
      mutation: "increment",
      lockedUntil: lock.lockedUntil,
      permanentLock: lock.permanent,
    };
  }
  return { kind: "ok", http: 200, message: "", mutation: "reset" };
}
