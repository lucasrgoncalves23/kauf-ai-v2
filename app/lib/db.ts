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
  ConsultaSummary,
  ClinicalData,
  ClinicalOutputs,
  PatientProfile,
  ChatMessage,
  EngineStatus,
} from "../types/clinical";
import type { AuditEvent } from "./audit";

/** jsonb that strips \u0000 null bytes Postgres JSONB rejects. */
export function jsonb(value: unknown): string {
  return JSON.stringify(value).replace(/\\u0000/g, "");
}

// Get database URL from environment
export function getDb() {
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

  await ensureCrmTables();
}

// --- CRM BRIDGE TABLES (agenda + alerts pushed by the Clinic OS CRM) ---

let crmTablesReady: Promise<void> | null = null;

/** Creates the CRM bridge tables on first use (idempotent, cached). */
function ensureCrmTables(): Promise<void> {
  if (!crmTablesReady) {
    crmTablesReady = (async () => {
      const sql = getDb();
      await sql`
        CREATE TABLE IF NOT EXISTS crm_agenda (
          date TEXT PRIMARY KEY,
          appointments JSONB NOT NULL DEFAULT '[]',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS crm_alerts (
          id TEXT PRIMARY KEY,
          patient_id TEXT,
          patient_name TEXT,
          message TEXT NOT NULL,
          severity TEXT NOT NULL DEFAULT 'media',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          dismissed_at TIMESTAMPTZ
        )
      `;
      // relato pré-consulta: o que o paciente disse no WhatsApp (resumido pelo CRM)
      await sql`
        CREATE TABLE IF NOT EXISTS crm_briefings (
          id TEXT PRIMARY KEY,
          patient_id TEXT NOT NULL,
          consulta_em TIMESTAMPTZ,
          periodo_de TIMESTAMPTZ,
          periodo_ate TIMESTAMPTZ,
          texto TEXT NOT NULL,
          fontes JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          used_at TIMESTAMPTZ
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_crm_briefings_patient ON crm_briefings(patient_id, created_at DESC)`;
      // exames que o paciente mandou no WhatsApp (texto extraído; o arquivo não fica aqui)
      await sql`
        CREATE TABLE IF NOT EXISTS crm_exams (
          id TEXT PRIMARY KEY,
          patient_id TEXT NOT NULL,
          filename TEXT,
          mime TEXT,
          size_bytes INTEGER,
          caption TEXT,
          texto TEXT NOT NULL,
          method TEXT,
          recebido_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          imported_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_crm_exams_patient ON crm_exams(patient_id, created_at DESC)`;
    })().catch((err) => {
      crmTablesReady = null; // allow retry on next call
      throw err;
    });
  }
  return crmTablesReady;
}

export interface CrmAgendaAppointment {
  kauf_id: string | null;
  cpf: string | null;
  patient_name: string;
  starts_at: string;
  status: string;
  service_name: string | null;
  practitioner_name: string | null;
  fase: string | null;
}

export interface CrmAlert {
  id: string;
  patientId: string | null;
  patientName: string | null;
  message: string;
  severity: string;
  createdAt: string;
  dismissedAt: string | null;
}

export async function upsertCrmAgenda(
  date: string,
  appointments: CrmAgendaAppointment[]
): Promise<void> {
  await ensureCrmTables();
  const sql = getDb();
  await sql`
    INSERT INTO crm_agenda (date, appointments, updated_at)
    VALUES (${date}, ${jsonb(appointments)}, NOW())
    ON CONFLICT (date) DO UPDATE SET
      appointments = EXCLUDED.appointments,
      updated_at = NOW()
  `;
}

export async function getCrmAgenda(
  date: string
): Promise<{ appointments: CrmAgendaAppointment[]; updatedAt: string } | null> {
  await ensureCrmTables();
  const sql = getDb();
  const rows = await sql`
    SELECT appointments, updated_at as "updatedAt" FROM crm_agenda WHERE date = ${date}
  `;
  if (rows.length === 0) return null;
  return {
    appointments: rows[0].appointments as CrmAgendaAppointment[],
    updatedAt:
      rows[0].updatedAt instanceof Date
        ? rows[0].updatedAt.toISOString()
        : rows[0].updatedAt,
  };
}

export async function insertCrmAlert(alert: {
  id: string;
  patientId: string | null;
  patientName: string | null;
  message: string;
  severity: string;
}): Promise<void> {
  await ensureCrmTables();
  const sql = getDb();
  await sql`
    INSERT INTO crm_alerts (id, patient_id, patient_name, message, severity)
    VALUES (${alert.id}, ${alert.patientId}, ${alert.patientName}, ${alert.message}, ${alert.severity})
    ON CONFLICT (id) DO NOTHING
  `;
}

export async function getActiveCrmAlerts(): Promise<CrmAlert[]> {
  await ensureCrmTables();
  const sql = getDb();
  const rows = await sql`
    SELECT
      id, patient_id as "patientId", patient_name as "patientName",
      message, severity,
      created_at as "createdAt", dismissed_at as "dismissedAt"
    FROM crm_alerts
    WHERE dismissed_at IS NULL
    ORDER BY created_at DESC
    LIMIT 20
  `;
  return rows.map((row) => ({
    id: row.id,
    patientId: row.patientId,
    patientName: row.patientName,
    message: row.message,
    severity: row.severity,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    dismissedAt:
      row.dismissedAt instanceof Date
        ? row.dismissedAt.toISOString()
        : row.dismissedAt,
  }));
}

export interface CrmBriefing {
  id: string;
  patientId: string;
  consultaEm: string | null;
  periodoDe: string | null;
  periodoAte: string | null;
  texto: string;
  fontes: { mensagens?: number; checkins?: number; intake?: boolean };
  createdAt: string;
  usedAt: string | null;
}

export interface CrmExam {
  id: string;
  patientId: string;
  filename: string | null;
  mime: string | null;
  sizeBytes: number | null;
  caption: string | null;
  texto: string;
  method: string | null;
  recebidoEm: string;
  importedAt: string | null;
  createdAt: string;
}

function iso(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString();
  return (v as string | null) ?? null;
}

export async function insertCrmBriefing(b: {
  id: string;
  patientId: string;
  consultaEm: string | null;
  periodoDe: string | null;
  periodoAte: string | null;
  texto: string;
  fontes: CrmBriefing["fontes"];
}): Promise<void> {
  await ensureCrmTables();
  const sql = getDb();
  await sql`
    INSERT INTO crm_briefings (id, patient_id, consulta_em, periodo_de, periodo_ate, texto, fontes)
    VALUES (${b.id}, ${b.patientId}, ${b.consultaEm}, ${b.periodoDe}, ${b.periodoAte}, ${b.texto}, ${jsonb(b.fontes)})
    ON CONFLICT (id) DO NOTHING
  `;
}

/** Latest briefings for a patient (newest first). */
export async function getCrmBriefings(patientId: string, limit = 3): Promise<CrmBriefing[]> {
  await ensureCrmTables();
  const sql = getDb();
  const rows = await sql`
    SELECT id, patient_id as "patientId", consulta_em as "consultaEm",
           periodo_de as "periodoDe", periodo_ate as "periodoAte",
           texto, fontes, created_at as "createdAt", used_at as "usedAt"
    FROM crm_briefings WHERE patient_id = ${patientId}
    ORDER BY created_at DESC LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patientId,
    consultaEm: iso(r.consultaEm),
    periodoDe: iso(r.periodoDe),
    periodoAte: iso(r.periodoAte),
    texto: r.texto,
    fontes: (r.fontes ?? {}) as CrmBriefing["fontes"],
    createdAt: iso(r.createdAt) ?? "",
    usedAt: iso(r.usedAt),
  }));
}

export async function markCrmBriefingUsed(id: string): Promise<boolean> {
  await ensureCrmTables();
  const sql = getDb();
  const result = await sql`UPDATE crm_briefings SET used_at = NOW() WHERE id = ${id} RETURNING id`;
  return result.length > 0;
}

export async function insertCrmExam(e: {
  id: string;
  patientId: string;
  filename: string | null;
  mime: string | null;
  sizeBytes: number | null;
  caption: string | null;
  texto: string;
  method: string | null;
  recebidoEm: string;
  importedAt: string | null;
}): Promise<void> {
  await ensureCrmTables();
  const sql = getDb();
  await sql`
    INSERT INTO crm_exams (id, patient_id, filename, mime, size_bytes, caption, texto, method, recebido_em, imported_at)
    VALUES (${e.id}, ${e.patientId}, ${e.filename}, ${e.mime}, ${e.sizeBytes}, ${e.caption}, ${e.texto}, ${e.method}, ${e.recebidoEm}, ${e.importedAt})
    ON CONFLICT (id) DO NOTHING
  `;
}

export async function getCrmExams(patientId: string, limit = 10): Promise<CrmExam[]> {
  await ensureCrmTables();
  const sql = getDb();
  const rows = await sql`
    SELECT id, patient_id as "patientId", filename, mime, size_bytes as "sizeBytes", caption,
           texto, method, recebido_em as "recebidoEm", imported_at as "importedAt", created_at as "createdAt"
    FROM crm_exams WHERE patient_id = ${patientId}
    ORDER BY created_at DESC LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patientId,
    filename: r.filename,
    mime: r.mime,
    sizeBytes: r.sizeBytes,
    caption: r.caption,
    texto: r.texto,
    method: r.method,
    recebidoEm: iso(r.recebidoEm) ?? "",
    importedAt: iso(r.importedAt),
    createdAt: iso(r.createdAt) ?? "",
  }));
}

export async function getCrmExam(id: string): Promise<CrmExam | null> {
  await ensureCrmTables();
  const sql = getDb();
  const rows = await sql`
    SELECT id, patient_id as "patientId", filename, mime, size_bytes as "sizeBytes", caption,
           texto, method, recebido_em as "recebidoEm", imported_at as "importedAt", created_at as "createdAt"
    FROM crm_exams WHERE id = ${id}
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    patientId: r.patientId,
    filename: r.filename,
    mime: r.mime,
    sizeBytes: r.sizeBytes,
    caption: r.caption,
    texto: r.texto,
    method: r.method,
    recebidoEm: iso(r.recebidoEm) ?? "",
    importedAt: iso(r.importedAt),
    createdAt: iso(r.createdAt) ?? "",
  };
}

export async function markCrmExamImported(id: string): Promise<boolean> {
  await ensureCrmTables();
  const sql = getDb();
  const result = await sql`UPDATE crm_exams SET imported_at = NOW() WHERE id = ${id} RETURNING id`;
  return result.length > 0;
}

export async function dismissCrmAlert(id: string): Promise<boolean> {
  await ensureCrmTables();
  const sql = getDb();
  const result = await sql`
    UPDATE crm_alerts SET dismissed_at = NOW() WHERE id = ${id} RETURNING id
  `;
  return result.length > 0;
}

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

/**
 * Canonical form for Brazilian phone matching: strips formatting and the
 * +55 country code, then reduces the local number to DDD + last 8 digits
 * so the mobile ninth-digit variance matches in both directions.
 */
export function normalizeBrPhone(phone: string): string {
  let d = phone.replace(/\D/g, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) {
    d = d.slice(2);
  }
  if (d.length === 10 || d.length === 11) {
    return d.slice(0, 2) + d.slice(-8);
  }
  return d;
}

/** Find a non-deleted patient by profile phone (normalized Brazilian match). */
export async function findPatientByPhone(phone: string): Promise<PatientRecord | null> {
  const target = normalizeBrPhone(phone);
  if (!target) return null;
  const sql = getDb();

  const rows = await sql`
    SELECT id, profile->>'phone' AS phone FROM patients
    WHERE deleted_at IS NULL
      AND COALESCE(profile->>'phone', '') <> ''
  `;
  const match = rows.find(
    (r) => normalizeBrPhone(r.phone as string) === target
  );
  return match ? getPatient(match.id as string) : null;
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
      ${jsonb(patient.inputs)},
      ${jsonb(patient.outputs)},
      ${jsonb(patient.profile)},
      ${jsonb(patient.chatMessages)},
      ${patient.engineStatus ? jsonb(patient.engineStatus) : null},
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
    values.push(jsonb(data.inputs));
  }
  if (data.outputs !== undefined) {
    updates.push("outputs = $" + (values.length + 1));
    values.push(jsonb(data.outputs));
  }
  if (data.profile !== undefined) {
    updates.push("profile = $" + (values.length + 1));
    values.push(jsonb(data.profile));
  }
  if (data.chatMessages !== undefined) {
    updates.push("chat_messages = $" + (values.length + 1));
    values.push(jsonb(data.chatMessages));
  }
  if (data.engineStatus !== undefined) {
    updates.push("engine_status = $" + (values.length + 1));
    values.push(data.engineStatus ? jsonb(data.engineStatus) : null);
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
      inputs = COALESCE(${data.inputs ? jsonb(data.inputs) : null}::jsonb, inputs),
      outputs = COALESCE(${data.outputs ? jsonb(data.outputs) : null}::jsonb, outputs),
      profile = COALESCE(${data.profile ? jsonb(data.profile) : null}::jsonb, profile),
      chat_messages = COALESCE(${data.chatMessages ? jsonb(data.chatMessages) : null}::jsonb, chat_messages),
      engine_status = COALESCE(${data.engineStatus ? jsonb(data.engineStatus) : null}::jsonb, engine_status),
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

/** Every consulta across all patients, without the inputs/outputs snapshots (sidebar listing). */
export async function getAllConsultaSummaries(): Promise<ConsultaSummary[]> {
  const sql = getDb();

  const rows = await sql`
    SELECT
      id, patient_id as "patientId", timestamp,
      engine_status as "engineStatus", notes,
      coalesce(outputs->>'analise', '') <> '' as "hasAnalise",
      coalesce(outputs->>'conduta', '') <> '' as "hasConduta",
      coalesce(outputs->>'receita', '') <> '' as "hasReceita"
    FROM consultas
    ORDER BY timestamp DESC
  `;

  return rows.map((row) => ({
    summary: true,
    id: row.id,
    patientId: row.patientId,
    timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : row.timestamp,
    engineStatus: row.engineStatus as EngineStatus,
    notes: row.notes || "",
    hasAnalise: !!row.hasAnalise,
    hasConduta: !!row.hasConduta,
    hasReceita: !!row.hasReceita,
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
      ${jsonb(consulta.inputs)},
      ${jsonb(consulta.outputs)},
      ${consulta.engineStatus ? jsonb(consulta.engineStatus) : null},
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
      ${jsonb(rest)}
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
