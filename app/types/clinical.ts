/**
 * Clinical Types
 *
 * Shared type definitions for the Kaufmann AI clinical dashboard.
 */

import type { ParsedMetrics } from "../lib/extraction";

// --- ENGINE TYPES (existing) ---

export type Phase = "A" | "B" | "C";

export type AnamneseBase = {
  chiefComplaint: string;
  age?: number;
  sex?: "M" | "F";
  conditions?: string[];
  meds?: string[];
};

export type WearableSnapshot = {
  hrvTrend?: "down" | "stable" | "up";
  rhrTrend?: "down" | "stable" | "up";
  hrv7d?: number;
  rhr7d?: number;
  sleepHours7d?: number;
};

export type Labs = {
  homaIr?: number;
  hba1c?: number;
  fastingGlucose?: number;
  fastingInsulin?: number;
};

export type ClinicalInput = {
  phaseAssumption?: Phase;
  base: AnamneseBase;
  wearable?: WearableSnapshot;
  labs?: Labs;
};

// --- UI DATA TYPES ---

export type ClinicalData = {
  anamnese: string;
  bioimpedancia: string;
  laboratoriais: string;
  genetica: string;
  wearable: string;
};

export type ClinicalOutputs = {
  analise: string;
  conduta: string;
  receita: string;
};

// --- CHAT TYPES ---

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

// --- ENGINE STATUS (UI) ---

export type EngineStatus = {
  phase: Phase;
  priority: string;
  priorityColor: "amber" | "emerald" | "blue";
  reason: string;
  focus: string[];
  enabled: string[];
  waiting: { module: string; criteria: string }[];
  metrics?: ParsedMetrics;
} | null;

// --- SETTINGS TYPES ---

export type Settings = {
  thresholds: {
    hrv: number;
    rhr: number;
    homaIr: number;
    sleep: number;
  };
  ui: {
    darkMode: boolean;
    compactView: boolean;
  };
};

export const DEFAULT_SETTINGS: Settings = {
  thresholds: { hrv: 50, rhr: 70, homaIr: 2.5, sleep: 6 },
  ui: { darkMode: false, compactView: false },
};

// --- PATIENT TYPES ---

export type PatientProfile = {
  name: string;
  age: string;
  sex: string;
  cpf: string;
  birthDate: string;
};

export type PatientRecord = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  inputs: ClinicalData;
  outputs: ClinicalOutputs;
  profile: PatientProfile;
  chatMessages: ChatMessage[];
  engineStatus: EngineStatus;
  folder?: string;
  deletedAt?: string;
  previousFolder?: string;
};

// --- CONSULTA (VISIT) TYPES ---

export type Consulta = {
  id: string;
  patientId: string;
  timestamp: string;
  inputs: ClinicalData;
  outputs: ClinicalOutputs;
  engineStatus: EngineStatus;
  notes: string;
};

// --- TOAST TYPES ---

export type ToastType = "success" | "error" | "info";

export type ToastState = {
  message: string;
  type: ToastType;
} | null;
