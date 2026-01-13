// app/types/clinical.ts

export type Phase = "A" | "B" | "C";

export type AnamneseBase = {
  chiefComplaint: string; // required
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

