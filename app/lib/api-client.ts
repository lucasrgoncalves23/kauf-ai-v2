/**
 * API Client for Patient Data
 *
 * Client-side functions to interact with the patients API.
 * Includes localStorage fallback for offline mode or when database is not configured.
 */

import type { PatientRecord, Consulta } from "../types/clinical";
import { logger } from "./logger";

// Get PIN from localStorage (set by user in settings)
function getClinicPin(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("kai-clinic-pin");
}

// Check if database is available
async function isDatabaseAvailable(): Promise<boolean> {
  try {
    const response = await fetch("/api/db/init", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();
    return data.connected === true;
  } catch {
    return false;
  }
}

// Default headers for API requests
function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  const pin = getClinicPin();
  if (pin) {
    headers["X-Clinic-Pin"] = pin;
  }
  return headers;
}

// PIN-only headers, for callers that set their own Content-Type (or none, e.g. FormData)
export function getPinHeaders(): Record<string, string> {
  const pin = getClinicPin();
  return pin ? { "X-Clinic-Pin": pin } : {};
}

// --- API Functions ---

export async function fetchAllPatients(): Promise<{
  patients: Record<string, PatientRecord>;
  fromDatabase: boolean;
}> {
  // Check if database is available
  const dbAvailable = await isDatabaseAvailable();

  if (dbAvailable) {
    try {
      const response = await fetch("/api/patients", {
        method: "GET",
        headers: getHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        // Convert array to record
        const patientsRecord: Record<string, PatientRecord> = {};
        for (const patient of data.patients) {
          patientsRecord[patient.id] = patient;
        }
        return { patients: patientsRecord, fromDatabase: true };
      }

      // If unauthorized, fall back to localStorage
      if (response.status === 401) {
        logger.warn("Database access denied, using localStorage fallback");
      }
    } catch (error) {
      logger.warn("Failed to fetch from database, using localStorage fallback", { error: String(error) });
    }
  }

  // Fallback to localStorage
  const stored = localStorage.getItem("kai-patients");
  if (stored) {
    return { patients: JSON.parse(stored), fromDatabase: false };
  }

  return { patients: {}, fromDatabase: false };
}

export async function savePatient(patient: PatientRecord): Promise<{
  success: boolean;
  savedToDatabase: boolean;
}> {
  const dbAvailable = await isDatabaseAvailable();

  if (dbAvailable) {
    try {
      // Try to update first
      const updateResponse = await fetch(`/api/patients/${patient.id}`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(patient),
      });

      if (updateResponse.ok) {
        return { success: true, savedToDatabase: true };
      }

      // If not found, create new
      if (updateResponse.status === 404) {
        const createResponse = await fetch("/api/patients", {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(patient),
        });

        if (createResponse.ok) {
          return { success: true, savedToDatabase: true };
        }
      }

      // Unauthorized or other error - fall through to localStorage
      if (updateResponse.status !== 401) {
        logger.warn("Failed to save to database", { status: updateResponse.status });
      }
    } catch (error) {
      logger.warn("Failed to save to database, using localStorage fallback", { error: String(error) });
    }
  }

  // Fallback: save to localStorage
  try {
    const stored = localStorage.getItem("kai-patients");
    const patients: Record<string, PatientRecord> = stored ? JSON.parse(stored) : {};
    patients[patient.id] = patient;
    localStorage.setItem("kai-patients", JSON.stringify(patients));
    return { success: true, savedToDatabase: false };
  } catch (error) {
    logger.error("Failed to save to localStorage", { error: String(error) });
    return { success: false, savedToDatabase: false };
  }
}

export async function deletePatientFromStorage(id: string): Promise<{
  success: boolean;
  deletedFromDatabase: boolean;
}> {
  const dbAvailable = await isDatabaseAvailable();

  if (dbAvailable) {
    try {
      const response = await fetch(`/api/patients/${id}`, {
        method: "DELETE",
        headers: getHeaders(),
      });

      if (response.ok) {
        return { success: true, deletedFromDatabase: true };
      }

      if (response.status !== 401) {
        logger.warn("Failed to delete from database", { status: response.status });
      }
    } catch (error) {
      logger.warn("Failed to delete from database, using localStorage fallback", { error: String(error) });
    }
  }

  // Fallback: delete from localStorage
  try {
    const stored = localStorage.getItem("kai-patients");
    if (stored) {
      const patients: Record<string, PatientRecord> = JSON.parse(stored);
      delete patients[id];
      localStorage.setItem("kai-patients", JSON.stringify(patients));
    }
    return { success: true, deletedFromDatabase: false };
  } catch (error) {
    logger.error("Failed to delete from localStorage", { error: String(error) });
    return { success: false, deletedFromDatabase: false };
  }
}

// --- CONSULTA Functions ---

export async function fetchAllConsultas(): Promise<Record<string, Consulta[]>> {
  try {
    const response = await fetch("/api/consultas", {
      method: "GET",
      headers: getHeaders(),
    });

    if (response.ok) {
      const data = await response.json();
      const consultas: Consulta[] = data.consultas || [];
      // Group by patientId
      const grouped: Record<string, Consulta[]> = {};
      for (const c of consultas) {
        if (!grouped[c.patientId]) grouped[c.patientId] = [];
        grouped[c.patientId].push(c);
      }
      return grouped;
    }

    logger.warn("Failed to fetch all consultas", { status: response.status });
    return {};
  } catch (error) {
    logger.warn("Failed to fetch all consultas", { error: String(error) });
    return {};
  }
}

export async function fetchConsultas(patientId: string): Promise<Consulta[]> {
  try {
    const response = await fetch(`/api/patients/${patientId}/consultas`, {
      method: "GET",
      headers: getHeaders(),
    });

    if (response.ok) {
      const data = await response.json();
      return data.consultas || [];
    }

    logger.warn("Failed to fetch consultas", { status: response.status });
    return [];
  } catch (error) {
    logger.warn("Failed to fetch consultas", { error: String(error) });
    return [];
  }
}

export async function saveConsulta(
  patientId: string,
  consulta: Omit<Consulta, "id" | "patientId" | "timestamp">
): Promise<{ success: boolean; consulta?: Consulta; error?: string }> {
  try {
    const response = await fetch(`/api/patients/${patientId}/consultas`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(consulta),
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, consulta: data.consulta };
    }

    const data = await response.json().catch(() => null);
    const reason = data?.error || `Servidor retornou erro ${response.status}`;
    logger.warn("Failed to save consulta", { status: response.status, reason });
    return { success: false, error: reason };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn("Failed to save consulta", { error: message });
    return { success: false, error: `Sem conexao com o servidor: ${message}` };
  }
}

// --- PIN Management ---

export function setClinicPin(pin: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("kai-clinic-pin", pin);
}

export function clearClinicPin(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("kai-clinic-pin");
}

export function hasClinicPin(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("kai-clinic-pin");
}

// --- Database Status ---

export async function getDatabaseStatus(): Promise<{
  configured: boolean;
  connected: boolean;
}> {
  try {
    const response = await fetch("/api/db/init", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();
    return {
      configured: data.databaseConfigured ?? false,
      connected: data.connected ?? false,
    };
  } catch {
    return { configured: false, connected: false };
  }
}
