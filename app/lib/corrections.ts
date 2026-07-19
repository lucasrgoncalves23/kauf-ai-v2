// Correction feedback system for continuous learning
//
// localStorage is the fast synchronous cache (generation reads from it);
// every mutation is also pushed to the server so corrections follow the
// doctor across devices. syncCorrectionsFromServer() reconciles on load.

import { getPinHeaders } from "./api-client";
import { logger } from "./logger";

export type CorrectionField = "analise" | "conduta" | "receita";

export type Correction = {
  id: string;
  timestamp: string;
  field: CorrectionField;
  original: string;
  corrected: string;
  patientContext: {
    name?: string;
    age?: string;
    sex?: string;
  };
  doctorNote?: string;
  approved: boolean;
};

type CorrectionStore = {
  corrections: Correction[];
  stats: {
    totalEdits: number;
    approvedExamples: number;
    lastUpdated: string;
  };
};

const STORAGE_KEY = "kai-corrections";

// Generate unique ID
function generateId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// --- Server sync (best-effort; localStorage keeps working offline) ---

function pushCorrectionToServer(correction: Correction): void {
  if (typeof window === "undefined") return;
  fetch("/api/corrections", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getPinHeaders() },
    body: JSON.stringify(correction),
  }).catch((e) => logger.warn("Failed to push correction to server", { error: String(e) }));
}

function deleteCorrectionOnServer(id: string): void {
  if (typeof window === "undefined") return;
  fetch(`/api/corrections/${id}`, {
    method: "DELETE",
    headers: getPinHeaders(),
  }).catch((e) => logger.warn("Failed to delete correction on server", { error: String(e) }));
}

/**
 * Reconcile with the server: pull the server list, push any local-only
 * corrections up, and store the union locally. Returns true if it ran.
 */
export async function syncCorrectionsFromServer(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    const res = await fetch("/api/corrections", { headers: getPinHeaders() });
    if (!res.ok) return false;
    const data = await res.json();
    const serverCorrections: Correction[] = data.corrections || [];

    const store = getStore();
    const serverIds = new Set(serverCorrections.map((c) => c.id));
    const localOnly = store.corrections.filter((c) => !serverIds.has(c.id));

    // Push corrections created while offline / on this device only
    for (const c of localOnly) {
      pushCorrectionToServer(c);
    }

    const merged = [...serverCorrections, ...localOnly];
    store.corrections = merged;
    store.stats.approvedExamples = merged.filter((c) => c.approved).length;
    store.stats.totalEdits = Math.max(store.stats.totalEdits, merged.length);
    store.stats.lastUpdated = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

    return true;
  } catch (e) {
    logger.warn("Corrections sync failed", { error: String(e) });
    return false;
  }
}

// Get all corrections from localStorage
export function getCorrections(
  field?: CorrectionField,
  approvedOnly?: boolean
): Correction[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const data: CorrectionStore = JSON.parse(stored);
    let corrections = data.corrections || [];

    if (field) {
      corrections = corrections.filter((c) => c.field === field);
    }

    if (approvedOnly) {
      corrections = corrections.filter((c) => c.approved);
    }

    // Sort by timestamp descending (newest first)
    return corrections.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch {
    return [];
  }
}

// Save a new correction
export function saveCorrection(
  data: Omit<Correction, "id" | "timestamp">
): Correction {
  if (typeof window === "undefined") {
    throw new Error("Cannot save correction on server");
  }

  const correction: Correction = {
    ...data,
    id: generateId(),
    timestamp: new Date().toISOString(),
  };

  const store = getStore();
  store.corrections.push(correction);
  store.stats.totalEdits++;
  store.stats.lastUpdated = new Date().toISOString();

  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  pushCorrectionToServer(correction);

  return correction;
}

// Approve a correction (mark as training example)
export function approveCorrection(id: string, note?: string): boolean {
  if (typeof window === "undefined") return false;

  const store = getStore();
  const correction = store.corrections.find((c) => c.id === id);

  if (!correction) return false;

  const wasApproved = correction.approved;
  correction.approved = true;
  if (note !== undefined) correction.doctorNote = note;

  if (!wasApproved) store.stats.approvedExamples++;
  store.stats.lastUpdated = new Date().toISOString();

  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  pushCorrectionToServer(correction);
  return true;
}

// Unapprove a correction
export function unapproveCorrection(id: string): boolean {
  if (typeof window === "undefined") return false;

  const store = getStore();
  const correction = store.corrections.find((c) => c.id === id);

  if (!correction) return false;

  if (correction.approved) {
    correction.approved = false;
    store.stats.approvedExamples = Math.max(0, store.stats.approvedExamples - 1);
  }

  store.stats.lastUpdated = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  pushCorrectionToServer(correction);
  return true;
}

// Delete a correction
export function deleteCorrection(id: string): boolean {
  if (typeof window === "undefined") return false;

  const store = getStore();
  const index = store.corrections.findIndex((c) => c.id === id);

  if (index === -1) return false;

  const correction = store.corrections[index];
  if (correction.approved) {
    store.stats.approvedExamples = Math.max(0, store.stats.approvedExamples - 1);
  }

  store.corrections.splice(index, 1);
  store.stats.lastUpdated = new Date().toISOString();

  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  deleteCorrectionOnServer(id);
  return true;
}

// Update doctor note on a correction
export function updateCorrectionNote(id: string, note: string): boolean {
  if (typeof window === "undefined") return false;

  const store = getStore();
  const correction = store.corrections.find((c) => c.id === id);

  if (!correction) return false;

  correction.doctorNote = note;
  store.stats.lastUpdated = new Date().toISOString();

  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  pushCorrectionToServer(correction);
  return true;
}

// Check if a change is significant enough to capture
export function isSignificantChange(original: string, current: string): boolean {
  if (!original || !current) return false;

  const originalClean = original.trim();
  const currentClean = current.trim();

  // No change
  if (originalClean === currentClean) return false;

  // Calculate difference percentage
  const longerLength = Math.max(originalClean.length, currentClean.length);
  const shorterLength = Math.min(originalClean.length, currentClean.length);

  // If length differs by more than 5%, it's significant
  const lengthDiff = (longerLength - shorterLength) / longerLength;
  if (lengthDiff > 0.05) return true;

  // Count character differences (simple diff)
  let differences = 0;
  const minLen = Math.min(originalClean.length, currentClean.length);

  for (let i = 0; i < minLen; i++) {
    if (originalClean[i] !== currentClean[i]) differences++;
  }

  // Add the length difference
  differences += Math.abs(originalClean.length - currentClean.length);

  // If more than 3% of characters changed, it's significant
  const diffPercentage = differences / longerLength;
  return diffPercentage > 0.03;
}

// Get correction stats
export function getCorrectionStats(): CorrectionStore["stats"] {
  const store = getStore();
  return store.stats;
}

// Clear all corrections (use with caution)
export function clearAllCorrections(): void {
  if (typeof window === "undefined") return;

  // Also remove from the server so they don't come back on next sync
  for (const c of getStore().corrections) {
    deleteCorrectionOnServer(c.id);
  }

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      corrections: [],
      stats: {
        totalEdits: 0,
        approvedExamples: 0,
        lastUpdated: new Date().toISOString(),
      },
    })
  );
}

// Helper: Get or initialize store
function getStore(): CorrectionStore {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // Corrupted data, reset
  }

  return {
    corrections: [],
    stats: {
      totalEdits: 0,
      approvedExamples: 0,
      lastUpdated: new Date().toISOString(),
    },
  };
}

// Helper: Generate a short diff summary for display
export function getDiffSummary(original: string, corrected: string): string {
  const originalLines = original.split("\n").length;
  const correctedLines = corrected.split("\n").length;
  const lineDiff = correctedLines - originalLines;

  const originalLen = original.length;
  const correctedLen = corrected.length;
  const charDiff = correctedLen - originalLen;

  const parts: string[] = [];

  if (lineDiff !== 0) {
    parts.push(`${lineDiff > 0 ? "+" : ""}${lineDiff} linhas`);
  }

  if (Math.abs(charDiff) > 50) {
    parts.push(`${charDiff > 0 ? "+" : ""}${charDiff} caracteres`);
  }

  if (parts.length === 0) {
    return "Pequenas alterações";
  }

  return parts.join(", ");
}
