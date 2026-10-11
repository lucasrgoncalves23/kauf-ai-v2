import { randomBytes } from "crypto";
import { getDb, jsonb } from "./db";
import type { PortalPayload } from "./portal/payload";

export type PublicationStatus = "active" | "superseded" | "revoked" | "locked";

export type PortalPublicationRow = {
  id: string;
  patientId: string;
  consultaId: string | null;
  status: PublicationStatus;
  tokenEnc: string;
  cpfHmac: string;
  patientFirstName: string;
  payload: PortalPayload | null;
  hasPayload: boolean;
  failedAttempts: number;
  lockedUntil: string | null;
  openCount: number;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  patientAckAt: string | null;
  doctorConfirmedAt: string;
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
  supersededAt: string | null;
  patientActive: boolean;
};

export type PortalAccessEvent = "opened" | "cpf_failed" | "locked" | `denied_${string}`;

// Concurrent cold starts can race on CREATE ... IF NOT EXISTS; these codes mean "already there"
const DUPLICATE_CODES = new Set(["42P07", "42710", "23505"]);

async function ddl(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (!code || !DUPLICATE_CODES.has(code)) throw err;
  }
}

let portalTablesReady: Promise<void> | null = null;

export function ensurePortalTables(): Promise<void> {
  if (!portalTablesReady) {
    portalTablesReady = (async () => {
      const sql = getDb();
      await ddl(
        () => sql`
          CREATE TABLE IF NOT EXISTS portal_publications (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
            consulta_id TEXT REFERENCES consultas(id) ON DELETE SET NULL,
            token_hash TEXT UNIQUE NOT NULL,
            token_enc TEXT NOT NULL,
            cpf_hmac TEXT NOT NULL,
            patient_first_name TEXT NOT NULL,
            payload JSONB,
            status TEXT NOT NULL DEFAULT 'active',
            failed_attempts INT NOT NULL DEFAULT 0,
            locked_until TIMESTAMPTZ,
            open_count INT NOT NULL DEFAULT 0,
            first_opened_at TIMESTAMPTZ,
            last_opened_at TIMESTAMPTZ,
            patient_ack_at TIMESTAMPTZ,
            doctor_confirmed_at TIMESTAMPTZ NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            revoked_at TIMESTAMPTZ,
            superseded_at TIMESTAMPTZ
          )
        `
      );
      await ddl(
        () => sql`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_pub_one_active
          ON portal_publications(patient_id) WHERE status = 'active'
        `
      );
      await ddl(
        () => sql`
          CREATE INDEX IF NOT EXISTS idx_portal_pub_patient
          ON portal_publications(patient_id, created_at DESC)
        `
      );
      await ddl(
        () => sql`
          CREATE TABLE IF NOT EXISTS portal_access_log (
            id TEXT PRIMARY KEY,
            publication_id TEXT NOT NULL REFERENCES portal_publications(id) ON DELETE CASCADE,
            event TEXT NOT NULL,
            ip_hmac TEXT,
            user_agent TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `
      );
      await ddl(
        () => sql`
          CREATE INDEX IF NOT EXISTS idx_portal_access_pub
          ON portal_access_log(publication_id, created_at DESC)
        `
      );
    })().catch((err) => {
      portalTablesReady = null;
      throw err;
    });
  }
  return portalTablesReady;
}

function iso(value: unknown): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
}

function mapRow(row: Record<string, unknown>): PortalPublicationRow {
  return {
    id: String(row.id),
    patientId: String(row.patientId),
    consultaId: row.consultaId ? String(row.consultaId) : null,
    status: row.status as PublicationStatus,
    tokenEnc: String(row.tokenEnc ?? ""),
    cpfHmac: String(row.cpfHmac ?? ""),
    patientFirstName: String(row.patientFirstName ?? ""),
    payload: (row.payload as PortalPayload | null) ?? null,
    hasPayload: Boolean(row.hasPayload ?? row.payload),
    failedAttempts: Number(row.failedAttempts ?? 0),
    lockedUntil: iso(row.lockedUntil),
    openCount: Number(row.openCount ?? 0),
    firstOpenedAt: iso(row.firstOpenedAt),
    lastOpenedAt: iso(row.lastOpenedAt),
    patientAckAt: iso(row.patientAckAt),
    doctorConfirmedAt: iso(row.doctorConfirmedAt) ?? "",
    expiresAt: iso(row.expiresAt) ?? "",
    createdAt: iso(row.createdAt) ?? "",
    revokedAt: iso(row.revokedAt),
    supersededAt: iso(row.supersededAt),
    patientActive: Boolean(row.patientActive),
  };
}

export async function createPublication(input: {
  patientId: string;
  consultaId: string | null;
  tokenHash: string;
  tokenEnc: string;
  cpfHmac: string;
  patientFirstName: string;
  payload: PortalPayload;
  doctorConfirmedAt: string;
  expiresAt: string;
}): Promise<{ id: string }> {
  await ensurePortalTables();
  const sql = getDb();
  const id = newId("pub");
  await sql.transaction([
    sql`
      UPDATE portal_publications
      SET status = 'superseded', superseded_at = NOW()
      WHERE patient_id = ${input.patientId} AND status = 'active'
    `,
    sql`
      INSERT INTO portal_publications
        (id, patient_id, consulta_id, token_hash, token_enc, cpf_hmac, patient_first_name,
         payload, status, doctor_confirmed_at, expires_at)
      VALUES
        (${id}, ${input.patientId}, ${input.consultaId}, ${input.tokenHash}, ${input.tokenEnc},
         ${input.cpfHmac}, ${input.patientFirstName}, ${jsonb(input.payload)}::jsonb, 'active',
         ${input.doctorConfirmedAt}::timestamptz, ${input.expiresAt}::timestamptz)
    `,
  ]);
  return { id };
}

export async function findPublicationByTokenHash(tokenHash: string): Promise<PortalPublicationRow | null> {
  await ensurePortalTables();
  const sql = getDb();
  const rows = await sql`
    SELECT
      p.id, p.patient_id AS "patientId", p.consulta_id AS "consultaId", p.status,
      p.token_enc AS "tokenEnc", p.cpf_hmac AS "cpfHmac", p.patient_first_name AS "patientFirstName",
      p.payload, (p.payload IS NOT NULL) AS "hasPayload",
      p.failed_attempts AS "failedAttempts", p.locked_until AS "lockedUntil", p.open_count AS "openCount",
      p.first_opened_at AS "firstOpenedAt", p.last_opened_at AS "lastOpenedAt", p.patient_ack_at AS "patientAckAt",
      p.doctor_confirmed_at AS "doctorConfirmedAt", p.expires_at AS "expiresAt", p.created_at AS "createdAt",
      p.revoked_at AS "revokedAt", p.superseded_at AS "supersededAt",
      (pat.id IS NOT NULL AND pat.deleted_at IS NULL) AS "patientActive"
    FROM portal_publications p
    LEFT JOIN patients pat ON pat.id = p.patient_id
    WHERE p.token_hash = ${tokenHash}
    LIMIT 1
  `;
  return rows.length ? mapRow(rows[0] as Record<string, unknown>) : null;
}

export async function getPublicationById(id: string): Promise<PortalPublicationRow | null> {
  await ensurePortalTables();
  const sql = getDb();
  const rows = await sql`
    SELECT
      p.id, p.patient_id AS "patientId", p.consulta_id AS "consultaId", p.status,
      p.token_enc AS "tokenEnc", p.cpf_hmac AS "cpfHmac", p.patient_first_name AS "patientFirstName",
      p.payload, (p.payload IS NOT NULL) AS "hasPayload",
      p.failed_attempts AS "failedAttempts", p.locked_until AS "lockedUntil", p.open_count AS "openCount",
      p.first_opened_at AS "firstOpenedAt", p.last_opened_at AS "lastOpenedAt", p.patient_ack_at AS "patientAckAt",
      p.doctor_confirmed_at AS "doctorConfirmedAt", p.expires_at AS "expiresAt", p.created_at AS "createdAt",
      p.revoked_at AS "revokedAt", p.superseded_at AS "supersededAt",
      (pat.id IS NOT NULL AND pat.deleted_at IS NULL) AS "patientActive"
    FROM portal_publications p
    LEFT JOIN patients pat ON pat.id = p.patient_id
    WHERE p.id = ${id}
    LIMIT 1
  `;
  return rows.length ? mapRow(rows[0] as Record<string, unknown>) : null;
}

/** Status rows for the doctor UI; never includes the payload. */
export async function listPublicationsForPatient(patientId: string, limit = 5): Promise<PortalPublicationRow[]> {
  await ensurePortalTables();
  const sql = getDb();
  const rows = await sql`
    SELECT
      p.id, p.patient_id AS "patientId", p.consulta_id AS "consultaId", p.status,
      p.token_enc AS "tokenEnc", '' AS "cpfHmac", p.patient_first_name AS "patientFirstName",
      NULL AS payload, (p.payload IS NOT NULL) AS "hasPayload",
      p.failed_attempts AS "failedAttempts", p.locked_until AS "lockedUntil", p.open_count AS "openCount",
      p.first_opened_at AS "firstOpenedAt", p.last_opened_at AS "lastOpenedAt", p.patient_ack_at AS "patientAckAt",
      p.doctor_confirmed_at AS "doctorConfirmedAt", p.expires_at AS "expiresAt", p.created_at AS "createdAt",
      p.revoked_at AS "revokedAt", p.superseded_at AS "supersededAt",
      TRUE AS "patientActive"
    FROM portal_publications p
    WHERE p.patient_id = ${patientId}
    ORDER BY p.created_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => mapRow(r as Record<string, unknown>));
}

export async function recordFailedAttempt(id: string, lockedUntil: Date | null, permanent: boolean): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE portal_publications
    SET failed_attempts = failed_attempts + 1,
        locked_until = ${lockedUntil ? lockedUntil.toISOString() : null}::timestamptz,
        status = CASE WHEN ${permanent}::boolean THEN 'locked' ELSE status END
    WHERE id = ${id}
  `;
}

export async function recordSuccessfulOpen(id: string): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE portal_publications
    SET failed_attempts = 0,
        locked_until = NULL,
        open_count = open_count + 1,
        first_opened_at = COALESCE(first_opened_at, NOW()),
        last_opened_at = NOW(),
        patient_ack_at = COALESCE(patient_ack_at, NOW())
    WHERE id = ${id}
  `;
}

export async function logPortalAccess(input: {
  publicationId: string;
  event: PortalAccessEvent;
  ipHmac: string | null;
  userAgent: string;
}): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO portal_access_log (id, publication_id, event, ip_hmac, user_agent)
    VALUES (${newId("pal")}, ${input.publicationId}, ${input.event}, ${input.ipHmac}, ${input.userAgent.slice(0, 200)})
  `;
}

/** Revoking erases the snapshot; the row stays as the audit record. */
export async function revokePublication(id: string): Promise<boolean> {
  await ensurePortalTables();
  const sql = getDb();
  const rows = await sql`
    UPDATE portal_publications
    SET status = 'revoked', revoked_at = NOW(), payload = NULL
    WHERE id = ${id} AND status <> 'revoked'
    RETURNING id
  `;
  return rows.length > 0;
}

export async function runPortalRetention(): Promise<void> {
  await ensurePortalTables();
  const sql = getDb();
  await sql`
    UPDATE portal_publications SET payload = NULL
    WHERE payload IS NOT NULL AND expires_at < NOW() - INTERVAL '30 days'
  `;
  await sql`DELETE FROM portal_access_log WHERE created_at < NOW() - INTERVAL '365 days'`;
}
