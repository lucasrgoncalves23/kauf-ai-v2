/**
 * Patient Utilities
 *
 * Functions for creating and managing patient records.
 */

import type { PatientRecord } from "../types/clinical";

/**
 * Generate a unique patient ID
 */
export function generatePatientId(): string {
  return "p-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

/**
 * Create a blank patient record with default values
 */
export function createBlankPatient(name?: string): PatientRecord {
  const id = generatePatientId();
  const now = new Date().toISOString();
  return {
    id,
    name: name || "Novo Paciente",
    createdAt: now,
    updatedAt: now,
    inputs: { anamnese: "", bioimpedancia: "", laboratoriais: "", genetica: "", wearable: "" },
    outputs: { analise: "", conduta: "", receita: "" },
    profile: { name: "", age: "", sex: "", cpf: "", birthDate: "" },
    chatMessages: [],
    engineStatus: null,
  };
}
