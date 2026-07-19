/**
 * Database Layer for Patient Data
 *
 * Uses Neon serverless Postgres for secure, server-side storage.
 * Designed with SaaS expansion in mind.
 */

import { neon } from "@neondatabase/serverless";
import type {
  PatientRecord,
  Consulta,
  ClinicalData,
  ClinicalOutputs,
  PatientProfile,
  ChatMessage,
  EngineStatus,
} from "../types/clinical";
import type { AuditEvent } from "./audit";

// Get database URL from environment
function getDb() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return neon(dbUrl);
}

// --- INITIALIZATION ---

export async function initDatabase(): Promise<void> {
  const sql = getDb();

  // Create patients table
  await sql`
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      inputs JSONB NOT NULL DEFAULT '{}',
      outputs JSONB NOT NULL DEFAULT '{}',
      profile JSONB NOT NULL DEFAULT '{}',
      chat_messages JSONB NOT NULL DEFAULT '[]',
      engine_status JSONB,
      deleted_at TIMESTAMPTZ,
      folder TEXT,
      previous_folder TEXT
    )
  `;

  // Create audit_events table
  await sql`
    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      timestamp TIMESTAMPTZ NOT NULL,
      type TEXT NOT NULL,
      patient_id TEXT,
      patient_name TEXT,
      data JSONB NOT NULL DEFAULT '{}'
    )
  `;

  // Create corrections table
  await sql`
    CREATE TABLE IF NOT EXISTS corrections (
      id TEXT PRIMARY KEY,
      timestamp TIMESTAMPTZ NOT NULL,
      field TEXT NOT NULL,
      original TEXT NOT NULL,
      corrected TEXT NOT NULL,
      patient_context JSONB NOT NULL DEFAULT '{}',
      doctor_note TEXT,
      approved BOOLEAN DEFAULT FALSE
    )
  `;

  // Add trash and folder columns (safe to run if already exist)
  await sql`
    ALTER TABLE patients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ
  `;
  await sql`
    ALTER TABLE patients ADD COLUMN IF NOT EXISTS folder TEXT
  `;
  await sql`
    ALTER TABLE patients ADD COLUMN IF NOT EXISTS previous_folder TEXT
  `;

  // Create index for faster patient lookups
  await sql`
    CREATE INDEX IF NOT EXISTS idx_patients_updated_at ON patients(updated_at DESC)
  `;

  // Create consultas table
  await sql`
    CREATE TABLE IF NOT EXISTS consultas (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      inputs JSONB NOT NULL DEFAULT '{}',
      outputs JSONB NOT NULL DEFAULT '{}',
      engine_status JSONB,
      notes TEXT NOT NULL DEFAULT ''
    )
  `;

  // Create index for audit events by patient
  await sql`
    CREATE INDEX IF NOT EXISTS idx_audit_patient_id ON audit_events(patient_id)
  `;

  // Create index for consultas by patient
  await sql`
    CREATE INDEX IF NOT EXISTS idx_consultas_patient_id ON consultas(patient_id, timestamp DESC)
  `;
}

// --- PATIENT CRUD ---

export async function getAllPatients(): Promise<PatientRecord[]> {
  const sql = getDb();

  const rows = await sql`
    SELECT
      id, name,
      created_at as "createdAt",
      updated_at as "updatedAt",
      inputs, outputs, profile,
      chat_messages as "chatMessages",
      engine_status as "engineStatus",
      deleted_at as "deletedAt",
      folder,
      previous_folder as "previousFolder"
    FROM patients
    ORDER BY updated_at DESC
  `;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
    inputs: row.inputs as ClinicalData,
    outputs: row.outputs as ClinicalOutputs,
    profile: row.profile as PatientProfile,
    chatMessages: row.chatMessages as ChatMessage[],
    engineStatus: row.engineStatus as EngineStatus,
    deletedAt: row.deletedAt instanceof Date ? row.deletedAt.toISOString() : row.deletedAt ?? undefined,
    folder: row.folder ?? undefined,
    previousFolder: row.previousFolder ?? undefined,
  }));
}

export async function getPatient(id: string): Promise<PatientRecord | null> {
  const sql = getDb();

  const rows = await sql`
    SELECT
      id, name,
      created_at as "createdAt",
      updated_at as "updatedAt",
      inputs, outputs, profile,
      chat_messages as "chatMessages",
      engine_status as "engineStatus",
      deleted_at as "deletedAt",
      folder,
      previous_folder as "previousFolder"
    FROM patients
    WHERE id = ${id}
  `;

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
    inputs: row.inputs as ClinicalData,
    outputs: row.outputs as ClinicalOutputs,
    profile: row.profile as PatientProfile,
    chatMessages: row.chatMessages as ChatMessage[],
    engineStatus: row.engineStatus as EngineStatus,
    deletedAt: row.deletedAt instanceof Date ? row.deletedAt.toISOString() : row.deletedAt ?? undefined,
    folder: row.folder ?? undefined,
    previousFolder: row.previousFolder ?? undefined,
  };
}

/** Find a non-deleted patient by CPF stored in the profile (digits-only match). */
export async function findPatientByCpf(cpf: string): Promise<PatientRecord | null> {
  const digits = cpf.replace(/\D/g, "");
  if (!digits) return null;
  const sql = getDb();

  const rows = await sql`
    SELECT id FROM patients
    WHERE deleted_at IS NULL
      AND regexp_replace(COALESCE(profile->>'cpf', ''), '[^0-9]', '', 'g') = ${digits}
    LIMIT 1
  `;
  return rows.length > 0 ? getPatient(rows[0].id) : null;
}

/** Find a non-deleted patient by phone stored in the profile (digits-only match). */
export async function findPatientByPhone(phone: string): Promise<PatientRecord | null> {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const sql = getDb();

  const rows = await sql`
    SELECT id FROM patients
    WHERE deleted_at IS NULL
      AND regexp_replace(COALESCE(profile->>'phone', ''), '[^0-9]', '', 'g') = ${digits}
    LIMIT 1
  `;
  return rows.length > 0 ? getPatient(rows[0].id) : null;
}

export async function createPatient(patient: PatientRecord): Promise<PatientRecord> {
  const sql = getDb();

  await sql`
    INSERT INTO patients (id, name, created_at, updated_at, inputs, outputs, profile, chat_messages, engine_status, deleted_at, folder, previous_folder)
    VALUES (
      ${patient.id},
      ${patient.name},
      ${patient.createdAt},
      ${patient.updatedAt},
      ${JSON.stringify(patient.inputs)},
      ${JSON.stringify(patient.outputs)},
      ${JSON.stringify(patient.profile)},
      ${JSON.stringify(patient.chatMessages)},
      ${patient.engineStatus ? JSON.stringify(patient.engineStatus) : null},
      ${patient.deletedAt ?? null},
      ${patient.folder ?? null},
      ${patient.previousFolder ?? null}
    )
  `;

  return patient;
}

export async function updatePatient(id: string, data: Partial<PatientRecord>): Promise<PatientRecord | null> {
  const sql = getDb();

  // Build dynamic update - only include provided fields
  const updates: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined) {
    updates.push("name = $" + (values.length + 1));
    values.push(data.name);
  }
  if (data.inputs !== undefined) {
    updates.push("inputs = $" + (values.length + 1));
    values.push(JSON.stringify(data.inputs));
  }
  if (data.outputs !== undefined) {
    updates.push("outputs = $" + (values.length + 1));
    values.push(JSON.stringify(data.outputs));
  }
  if (data.profile !== undefined) {
    updates.push("profile = $" + (values.length + 1));
    values.push(JSON.stringify(data.profile));
  }
  if (data.chatMessages !== undefined) {
    updates.push("chat_messages = $" + (values.length + 1));
    values.push(JSON.stringify(data.chatMessages));
  }
  if (data.engineStatus !== undefined) {
    updates.push("engine_status = $" + (values.length + 1));
    values.push(data.engineStatus ? JSON.stringify(data.engineStatus) : null);
  }

  // Always update updated_at
  updates.push("updated_at = NOW()");

  if (updates.length === 1) {
    // Only updated_at, nothing to do
    return getPatient(id);
  }

  // Use tagged template for the update
  // For deletedAt: explicit null means "clear it" (restore), undefined means "don't change"
  const deletedAtValue = data.deletedAt === undefined ? undefined : (data.deletedAt ?? null);
  const folderValue = data.folder === undefined ? undefined : (data.folder ?? null);
  const previousFolderValue = data.previousFolder === undefined ? undefined : (data.previousFolder ?? null);

  await sql`
    UPDATE patients SET
      name = COALESCE(${data.name ?? null}, name),
      inputs = COALESCE(${data.inputs ? JSON.stringify(data.inputs) : null}::jsonb, inputs),
      outputs = COALESCE(${data.outputs ? JSON.stringify(data.outputs) : null}::jsonb, outputs),
      profile = COALESCE(${data.profile ? JSON.stringify(data.profile) : null}::jsonb, profile),
      chat_messages = COALESCE(${data.chatMessages ? JSON.stringify(data.chatMessages) : null}::jsonb, chat_messages),
      engine_status = COALESCE(${data.engineStatus ? JSON.stringify(data.engineStatus) : null}::jsonb, engine_status),
      deleted_at = CASE WHEN ${deletedAtValue !== undefined} THEN ${deletedAtValue ?? null}::timestamptz ELSE deleted_at END,
      folder = CASE WHEN ${folderValue !== undefined} THEN ${folderValue ?? null} ELSE folder END,
      previous_folder = CASE WHEN ${previousFolderValue !== undefined} THEN ${previousFolderValue ?? null} ELSE previous_folder END,
      updated_at = NOW()
    WHERE id = ${id}
  `;

  return getPatient(id);
}

export async function deletePatient(id: string): Promise<boolean> {
  const sql = getDb();

  // Use RETURNING to check if a row was deleted
  const result = await sql`
    DELETE FROM patients WHERE id = ${id} RETURNING id
  `;

  return result.length > 0;
}

// --- CONSULTAS (VISITS) ---

export async function getConsultas(patientId: string): Promise<Consulta[]> {
  const sql = getDb();

  const rows = await sql`
    SELECT
      id, patient_id as "patientId", timestamp,
      inputs, outputs, engine_status as "engineStatus", notes
    FROM consultas
    WHERE patient_id = ${patientId}
    ORDER BY timestamp DESC
  `;

  return rows.map((row) => ({
    id: row.id,
    patientId: row.patientId,
    timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : row.timestamp,
    inputs: row.inputs as ClinicalData,
    outputs: row.outputs as ClinicalOutputs,
    engineStatus: row.engineStatus as EngineStatus,
    notes: row.notes || "",
  }));
}

export async function getAllConsultas(): Promise<Consulta[]> {
  const sql = getDb();

  const rows = await sql`
    SELECT
      id, patient_id as "patientId", timestamp,
      inputs, outputs, engine_status as "engineStatus", notes
    FROM consultas
    ORDER BY timestamp DESC
  `;

  return rows.map((row) => ({
    id: row.id,
    patientId: row.patientId,
    timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : row.timestamp,
    inputs: row.inputs as ClinicalData,
    outputs: row.outputs as ClinicalOutputs,
    engineStatus: row.engineStatus as EngineStatus,
    notes: row.notes || "",
  }));
}

export async function createConsulta(consulta: Consulta): Promise<Consulta> {
  const sql = getDb();

  await sql`
    INSERT INTO consultas (id, patient_id, timestamp, inputs, outputs, engine_status, notes)
    VALUES (
      ${consulta.id},
      ${consulta.patientId},
      ${consulta.timestamp},
      ${JSON.stringify(consulta.inputs)},
      ${JSON.stringify(consulta.outputs)},
      ${consulta.engineStatus ? JSON.stringify(consulta.engineStatus) : null},
      ${consulta.notes}
    )
  `;

  return consulta;
}

export async function deleteConsulta(id: string): Promise<boolean> {
  const sql = getDb();
  const result = await sql`DELETE FROM consultas WHERE id = ${id} RETURNING id`;
  return result.length > 0;
}

// --- AUDIT EVENTS ---

export async function saveAuditEvent(event: AuditEvent): Promise<void> {
  const sql = getDb();

  // Extract common fields and put the rest in data
  const { id, timestamp, type, patientId, patientName, ...rest } = event;

  await sql`
    INSERT INTO audit_events (id, timestamp, type, patient_id, patient_name, data)
    VALUES (
      ${id},
      ${timestamp},
      ${type},
      ${patientId},
      ${patientName ?? null},
      ${JSON.stringify(rest)}
    )
  `;
}

export async function getAuditEvents(filters?: {
  patientId?: string;
  type?: string;
  limit?: number;
}): Promise<AuditEvent[]> {
  const sql = getDb();

  let query;

  if (filters?.patientId && filters?.type) {
    query = sql`
      SELECT id, timestamp, type, patient_id as "patientId", patient_name as "patientName", data
      FROM audit_events
      WHERE patient_id = ${filters.patientId} AND type = ${filters.type}
      ORDER BY timestamp DESC
      LIMIT ${filters.limit ?? 100}
    `;
  } else if (filters?.patientId) {
    query = sql`
      SELECT id, timestamp, type, patient_id as "patientId", patient_name as "patientName", data
      FROM audit_events
      WHERE patient_id = ${filters.patientId}
      ORDER BY timestamp DESC
      LIMIT ${filters.limit ?? 100}
    `;
  } else if (filters?.type) {
    query = sql`
      SELECT id, timestamp, type, patient_id as "patientId", patient_name as "patientName", data
      FROM audit_events
      WHERE type = ${filters.type}
      ORDER BY timestamp DESC
      LIMIT ${filters.limit ?? 100}
    `;
  } else {
    query = sql`
      SELECT id, timestamp, type, patient_id as "patientId", patient_name as "patientName", data
      FROM audit_events
      ORDER BY timestamp DESC
      LIMIT ${filters?.limit ?? 100}
    `;
  }

  const rows = await query;

  return rows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : row.timestamp,
    type: row.type,
    patientId: row.patientId,
    patientName: row.patientName,
    ...row.data,
  })) as AuditEvent[];
}

// --- HEALTH CHECK ---

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const sql = getDb();
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
