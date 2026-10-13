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
  await ensureWhatsAppTables();
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

export async function dismissCrmAlert(id: string): Promise<boolean> {
  await ensureCrmTables();
  const sql = getDb();
  const result = await sql`
    UPDATE crm_alerts SET dismissed_at = NOW() WHERE id = ${id} RETURNING id
  `;
  return result.length > 0;
}

// --- WHATSAPP TABLES (messages, conversations, opt-in) ---

let waTablesReady: Promise<void> | null = null;

function ensureWhatsAppTables(): Promise<void> {
  if (!waTablesReady) {
    waTablesReady = (async () => {
      const sql = getDb();
      await sql`
        CREATE TABLE IF NOT EXISTS wa_messages (
          id TEXT PRIMARY KEY,
          patient_id TEXT REFERENCES patients(id) ON DELETE SET NULL,
          wa_message_id TEXT,
          direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
          type TEXT NOT NULL DEFAULT 'text',
          template_name TEXT,
          body TEXT,
          media_url TEXT,
          media_id TEXT,
          status TEXT NOT NULL DEFAULT 'queued',
          error_code INTEGER,
          error_message TEXT,
          phone TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        ALTER TABLE wa_messages ADD COLUMN IF NOT EXISTS media_id TEXT
      `;
      await sql`
        ALTER TABLE wa_messages ADD COLUMN IF NOT EXISTS error_code INTEGER
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_wa_messages_patient
        ON wa_messages(patient_id, created_at DESC)
      `;
      // Meta redelivers webhooks for up to 7 days; wa_message_id must be
      // unique so retries can't duplicate rows. Dedupe (keep earliest) any
      // rows inserted before the unique index existed, then swap the old
      // non-unique index for a unique partial one.
      await sql`
        DELETE FROM wa_messages a
        USING wa_messages b
        WHERE a.wa_message_id = b.wa_message_id
          AND a.wa_message_id IS NOT NULL AND a.wa_message_id <> ''
          AND (b.created_at < a.created_at
               OR (b.created_at = a.created_at AND b.id < a.id))
      `;
      await sql`DROP INDEX IF EXISTS idx_wa_messages_wa_id`;
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_messages_wa_id_unique
        ON wa_messages(wa_message_id)
        WHERE wa_message_id IS NOT NULL AND wa_message_id <> ''
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_wa_messages_phone
        ON wa_messages(phone, created_at DESC)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS wa_conversations (
          id TEXT PRIMARY KEY,
          patient_id TEXT REFERENCES patients(id) ON DELETE SET NULL,
          phone TEXT NOT NULL,
          opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMPTZ NOT NULL,
          last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          status TEXT NOT NULL DEFAULT 'active'
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_wa_conversations_phone
        ON wa_conversations(phone)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS wa_opt_in (
          patient_id TEXT PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
          phone TEXT NOT NULL,
          consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          revoked_at TIMESTAMPTZ,
          consent_method TEXT NOT NULL DEFAULT 'dashboard'
        )
      `;
    })().catch((err) => {
      waTablesReady = null;
      throw err;
    });
  }
  return waTablesReady;
}

export interface WaMessageRecord {
  id: string;
  patientId: string | null;
  waMessageId: string | null;
  direction: "inbound" | "outbound";
  type: string;
  templateName: string | null;
  body: string | null;
  mediaUrl: string | null;
  mediaId: string | null;
  status: string;
  errorCode: number | null;
  errorMessage: string | null;
  phone: string;
  createdAt: string;
  updatedAt: string;
}

export interface WaConversationRecord {
  id: string;
  patientId: string | null;
  phone: string;
  openedAt: string;
  expiresAt: string;
  lastMessageAt: string;
  status: string;
}

export interface WaOptInRecord {
  patientId: string;
  phone: string;
  consentedAt: string;
  revokedAt: string | null;
  consentMethod: string;
}

export async function insertWaMessage(msg: {
  id: string;
  patientId: string | null;
  waMessageId: string | null;
  direction: "inbound" | "outbound";
  type: string;
  templateName?: string;
  body?: string;
  mediaUrl?: string;
  mediaId?: string;
  status: string;
  phone: string;
}): Promise<void> {
  await ensureWhatsAppTables();
  const sql = getDb();
  await sql`
    INSERT INTO wa_messages (id, patient_id, wa_message_id, direction, type, template_name, body, media_url, media_id, status, phone)
    VALUES (
      ${msg.id}, ${msg.patientId}, ${msg.waMessageId},
      ${msg.direction}, ${msg.type}, ${msg.templateName ?? null},
      ${msg.body ?? null}, ${msg.mediaUrl ?? null}, ${msg.mediaId ?? null},
      ${msg.status}, ${msg.phone}
    )
    ON CONFLICT (wa_message_id)
    WHERE wa_message_id IS NOT NULL AND wa_message_id <> ''
    DO NOTHING
  `;
}

export async function updateWaMessageStatus(
  waMessageId: string,
  status: string,
  errorMessage?: string,
  errorCode?: number
): Promise<void> {
  await ensureWhatsAppTables();
  const sql = getDb();
  await sql`
    UPDATE wa_messages
    SET status = ${status},
        error_code = COALESCE(${errorCode ?? null}, error_code),
        error_message = COALESCE(${errorMessage ?? null}, error_message),
        updated_at = NOW()
    WHERE wa_message_id = ${waMessageId}
  `;
}

export async function getWaMessages(
  patientId: string,
  limit = 50,
  before?: string
): Promise<WaMessageRecord[]> {
  await ensureWhatsAppTables();
  const sql = getDb();

  const rows = before
    ? await sql`
        SELECT id, patient_id as "patientId", wa_message_id as "waMessageId",
               direction, type, template_name as "templateName",
               body, media_url as "mediaUrl", media_id as "mediaId",
               status, error_code as "errorCode", error_message as "errorMessage",
               phone, created_at as "createdAt", updated_at as "updatedAt"
        FROM wa_messages
        WHERE patient_id = ${patientId} AND created_at < ${before}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    : await sql`
        SELECT id, patient_id as "patientId", wa_message_id as "waMessageId",
               direction, type, template_name as "templateName",
               body, media_url as "mediaUrl", media_id as "mediaId",
               status, error_code as "errorCode", error_message as "errorMessage",
               phone, created_at as "createdAt", updated_at as "updatedAt"
        FROM wa_messages
        WHERE patient_id = ${patientId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;

  return rows.map(toWaMessageRecord);
}

export async function getWaMessagesByPhone(
  phone: string,
  limit = 50
): Promise<WaMessageRecord[]> {
  await ensureWhatsAppTables();
  const sql = getDb();
  const digits = phone.replace(/\D/g, "");
  const rows = await sql`
    SELECT id, patient_id as "patientId", wa_message_id as "waMessageId",
           direction, type, template_name as "templateName",
           body, media_url as "mediaUrl", media_id as "mediaId",
           status, error_code as "errorCode", error_message as "errorMessage",
           phone, created_at as "createdAt", updated_at as "updatedAt"
    FROM wa_messages
    WHERE regexp_replace(phone, '[^0-9]', '', 'g') = ${digits}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(toWaMessageRecord);
}

function toWaMessageRecord(row: Record<string, unknown>): WaMessageRecord {
  return {
    id: row.id as string,
    patientId: row.patientId as string | null,
    waMessageId: row.waMessageId as string | null,
    direction: row.direction as "inbound" | "outbound",
    type: row.type as string,
    templateName: row.templateName as string | null,
    body: row.body as string | null,
    mediaUrl: row.mediaUrl as string | null,
    mediaId: row.mediaId as string | null,
    status: row.status as string,
    errorCode: row.errorCode as number | null,
    errorMessage: row.errorMessage as string | null,
    phone: row.phone as string,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : (row.createdAt as string),
    updatedAt:
      row.updatedAt instanceof Date
        ? row.updatedAt.toISOString()
        : (row.updatedAt as string),
  };
}

export async function upsertWaConversation(conv: {
  id: string;
  patientId: string | null;
  phone: string;
  expiresAt: string;
}): Promise<void> {
  await ensureWhatsAppTables();
  const sql = getDb();
  await sql`
    INSERT INTO wa_conversations (id, patient_id, phone, expires_at)
    VALUES (${conv.id}, ${conv.patientId}, ${conv.phone}, ${conv.expiresAt})
    ON CONFLICT (id) DO UPDATE SET
      last_message_at = NOW(),
      expires_at = GREATEST(wa_conversations.expires_at, EXCLUDED.expires_at),
      status = 'active'
  `;
}

export async function getActiveWaConversation(
  phone: string
): Promise<WaConversationRecord | null> {
  await ensureWhatsAppTables();
  const sql = getDb();
  const digits = phone.replace(/\D/g, "");
  const rows = await sql`
    SELECT id, patient_id as "patientId", phone,
           opened_at as "openedAt", expires_at as "expiresAt",
           last_message_at as "lastMessageAt", status
    FROM wa_conversations
    WHERE regexp_replace(phone, '[^0-9]', '', 'g') = ${digits}
      AND expires_at > NOW()
      AND status = 'active'
    ORDER BY opened_at DESC
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id as string,
    patientId: r.patientId as string | null,
    phone: r.phone as string,
    openedAt:
      r.openedAt instanceof Date ? r.openedAt.toISOString() : (r.openedAt as string),
    expiresAt:
      r.expiresAt instanceof Date ? r.expiresAt.toISOString() : (r.expiresAt as string),
    lastMessageAt:
      r.lastMessageAt instanceof Date
        ? r.lastMessageAt.toISOString()
        : (r.lastMessageAt as string),
    status: r.status as string,
  };
}

export interface WaConversationSummary {
  phone: string;
  patientId: string | null;
  patientName: string | null;
  lastBody: string | null;
  lastType: string;
  lastDirection: "inbound" | "outbound";
  lastMessageAt: string;
  /** ISO timestamp while the 24h window is open; null when closed. */
  windowExpiresAt: string | null;
}

/** One row per phone that ever exchanged a message, most recent first. */
export async function getWaConversationSummaries(): Promise<WaConversationSummary[]> {
  await ensureWhatsAppTables();
  const sql = getDb();
  const rows = await sql`
    WITH latest AS (
      SELECT DISTINCT ON (phone) phone, body, type, direction, created_at
      FROM wa_messages
      ORDER BY phone, created_at DESC
    ),
    pat AS (
      SELECT phone, MAX(patient_id) AS patient_id
      FROM wa_messages
      WHERE patient_id IS NOT NULL
      GROUP BY phone
    ),
    win AS (
      SELECT phone, MAX(expires_at) AS expires_at
      FROM wa_conversations
      WHERE status = 'active'
      GROUP BY phone
    )
    SELECT l.phone,
           pat.patient_id AS "patientId",
           p.name AS "patientName",
           l.body AS "lastBody",
           l.type AS "lastType",
           l.direction AS "lastDirection",
           l.created_at AS "lastMessageAt",
           CASE WHEN win.expires_at > NOW() THEN win.expires_at END AS "windowExpiresAt"
    FROM latest l
    LEFT JOIN pat ON pat.phone = l.phone
    LEFT JOIN win ON win.phone = l.phone
    LEFT JOIN patients p ON p.id = pat.patient_id AND p.deleted_at IS NULL
    ORDER BY l.created_at DESC
  `;
  return rows.map((r) => ({
    phone: r.phone as string,
    patientId: r.patientId as string | null,
    patientName: (r.patientName as string | null) ?? null,
    lastBody: r.lastBody as string | null,
    lastType: r.lastType as string,
    lastDirection: r.lastDirection as "inbound" | "outbound",
    lastMessageAt:
      r.lastMessageAt instanceof Date
        ? r.lastMessageAt.toISOString()
        : (r.lastMessageAt as string),
    windowExpiresAt:
      r.windowExpiresAt instanceof Date
        ? r.windowExpiresAt.toISOString()
        : (r.windowExpiresAt as string | null),
  }));
}

export async function setWaOptIn(
  patientId: string,
  phone: string,
  method = "dashboard"
): Promise<void> {
  await ensureWhatsAppTables();
  const sql = getDb();
  await sql`
    INSERT INTO wa_opt_in (patient_id, phone, consent_method)
    VALUES (${patientId}, ${phone}, ${method})
    ON CONFLICT (patient_id) DO UPDATE SET
      phone = EXCLUDED.phone,
      consented_at = NOW(),
      revoked_at = NULL,
      consent_method = EXCLUDED.consent_method
  `;
}

export async function revokeWaOptIn(patientId: string): Promise<void> {
  await ensureWhatsAppTables();
  const sql = getDb();
  await sql`
    UPDATE wa_opt_in SET revoked_at = NOW() WHERE patient_id = ${patientId}
  `;
}

export async function getWaOptIn(
  patientId: string
): Promise<WaOptInRecord | null> {
  await ensureWhatsAppTables();
  const sql = getDb();
  const rows = await sql`
    SELECT patient_id as "patientId", phone,
           consented_at as "consentedAt", revoked_at as "revokedAt",
           consent_method as "consentMethod"
    FROM wa_opt_in
    WHERE patient_id = ${patientId}
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    patientId: r.patientId as string,
    phone: r.phone as string,
    consentedAt:
      r.consentedAt instanceof Date
        ? r.consentedAt.toISOString()
        : (r.consentedAt as string),
    revokedAt:
      r.revokedAt instanceof Date
        ? r.revokedAt.toISOString()
        : r.revokedAt
        ? (r.revokedAt as string)
        : null,
    consentMethod: r.consentMethod as string,
  };
}

export async function hasActiveWaConsent(patientId: string): Promise<boolean> {
  const opt = await getWaOptIn(patientId);
  return !!opt && !opt.revokedAt;
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
