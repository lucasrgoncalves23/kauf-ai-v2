/**
 * CRM Bridge — patient payload helpers (pure, shared by server and UI).
 *
 * The CRM identifies patients by WhatsApp phone, so a patient is only sent
 * once it has a name and a complete Brazilian mobile number. Folders are
 * autosaved while the doctor types, so partial numbers must never pass:
 * only DDD + 9 + 8 digits (optionally prefixed by 55) are accepted.
 */

import { isValidCpf, normalizeCpf } from "./cpf";
import type { PatientRecord } from "../types/clinical";

/** "+55 11 99999-8888" → "+5511999998888"; null if not a complete mobile. */
export function crmPhone(raw: string | null | undefined): string | null {
  let d = (raw ?? "").replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("55")) d = d.slice(2);
  if (d.length !== 11 || d[2] !== "9") return null;
  return `+55${d}`;
}

/** "15/03/1980" → "1980-03-15"; null if not a real date. */
export function crmBirthDate(raw: string | null | undefined): string | null {
  const m = (raw ?? "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  if (
    date.getUTCFullYear() !== Number(yyyy) ||
    date.getUTCMonth() !== Number(mm) - 1 ||
    date.getUTCDate() !== Number(dd)
  ) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
}

export type CrmPatientPayload = {
  kauf_id: string;
  nome: string;
  telefone: string;
  cpf?: string;
  nascimento?: string;
};

/** Payload for the CRM "paciente_upsert" event, or null if not syncable yet. */
export function buildCrmPatientPayload(patient: PatientRecord): CrmPatientPayload | null {
  const nome = (patient.profile?.name || patient.name || "").trim();
  const telefone = crmPhone(patient.profile?.phone);
  if (!nome || !telefone) return null;

  const cpf = patient.profile?.cpf;
  const nascimento = crmBirthDate(patient.profile?.birthDate);
  return {
    kauf_id: patient.id,
    nome,
    telefone,
    ...(cpf && isValidCpf(cpf) ? { cpf: normalizeCpf(cpf) } : {}),
    ...(nascimento ? { nascimento } : {}),
  };
}

/** True when a save changed what the CRM knows about the patient. */
export function crmIdentityChanged(
  before: PatientRecord | null,
  after: PatientRecord
): boolean {
  const next = buildCrmPatientPayload(after);
  if (!next) return false;
  if (!before) return true;
  return JSON.stringify(buildCrmPatientPayload(before)) !== JSON.stringify(next);
}
