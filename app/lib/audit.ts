/**
 * Audit Trail System for Clinical Decision Support
 *
 * Provides immutable, append-only logging of:
 * - AI generation events (what the AI recommended)
 * - User edit events (how the clinician modified it)
 * - Export events (what was finalized and delivered)
 * - Session events (patient management actions)
 *
 * Critical for medical compliance and liability tracking.
 */

import { logger } from "./logger";

export type AuditEventType =
  | "generation"  // AI generated content
  | "edit"        // User modified AI output
  | "export"      // Content exported/printed
  | "session";    // Patient management action

export type GenerationSource = "analise" | "conduta" | "receita" | "patient-pdf" | "chat";

export type ExportFormat = "clinical" | "patient" | "prescription";

export type SessionAction = "patient_created" | "patient_switched" | "patient_deleted" | "session_cleared";

// Base event structure
type BaseAuditEvent = {
  id: string;
  timestamp: string;
  patientId: string | null;
  patientName?: string;
};

// AI Generation Event
export type GenerationEvent = BaseAuditEvent & {
  type: "generation";
  source: GenerationSource;
  model: string;
  inputSummary: string;      // Truncated input context
  outputLength: number;      // Character count of output
  outputHash: string;        // Hash for integrity verification
  durationMs?: number;       // How long generation took
};

// User Edit Event
export type EditEvent = BaseAuditEvent & {
  type: "edit";
  field: GenerationSource;
  originalHash: string;      // Hash of AI output
  editedHash: string;        // Hash of user-edited version
  changePercentage: number;  // How much was changed (0-100)
  changeSummary: string;     // e.g., "+12 lines, -3 lines"
};

// Export Event
export type ExportEvent = BaseAuditEvent & {
  type: "export";
  format: ExportFormat;
  contentHashes: {           // Hashes of exported content
    analise?: string;
    conduta?: string;
    receita?: string;
  };
  exportedBy?: string;       // Future: clinician ID
};

// Session Event
export type SessionEvent = BaseAuditEvent & {
  type: "session";
  action: SessionAction;
  details?: string;
};

export type AuditEvent = GenerationEvent | EditEvent | ExportEvent | SessionEvent;

type AuditStore = {
  version: number;
  events: AuditEvent[];
  metadata: {
    createdAt: string;
    lastEventAt: string;
    totalEvents: number;
  };
};

const STORAGE_KEY = "kai-audit-log";
const CURRENT_VERSION = 1;

// Generate unique audit event ID
function generateAuditId(type: AuditEventType): string {
  const prefix = {
    generation: "gen",
    edit: "edt",
    export: "exp",
    session: "ses",
  }[type];
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// Simple hash for content integrity (not cryptographic, just for change detection)
export function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// Get or initialize audit store
function getStore(): AuditStore {
  if (typeof window === "undefined") {
    return createEmptyStore();
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      // Version migration if needed
      if (data.version === CURRENT_VERSION) {
        return data;
      }
      // Future: handle version migrations
    }
  } catch {
    logger.error("Failed to load audit store, creating new one");
  }

  return createEmptyStore();
}

function createEmptyStore(): AuditStore {
  return {
    version: CURRENT_VERSION,
    events: [],
    metadata: {
      createdAt: new Date().toISOString(),
      lastEventAt: new Date().toISOString(),
      totalEvents: 0,
    },
  };
}

// Save store (append-only - events are never modified or deleted)
function saveStore(store: AuditStore): void {
  if (typeof window === "undefined") return;

  store.metadata.lastEventAt = new Date().toISOString();
  store.metadata.totalEvents = store.events.length;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    // localStorage full - rotate old events
    logger.warn("Audit log storage full, rotating old events");
    store.events = store.events.slice(-500); // Keep last 500 events
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
}

// Log AI generation event
export function logGeneration(params: {
  patientId: string | null;
  patientName?: string;
  source: GenerationSource;
  model: string;
  inputContext: string;
  output: string;
  durationMs?: number;
}): GenerationEvent {
  const event: GenerationEvent = {
    id: generateAuditId("generation"),
    timestamp: new Date().toISOString(),
    type: "generation",
    patientId: params.patientId,
    patientName: params.patientName,
    source: params.source,
    model: params.model,
    inputSummary: truncate(params.inputContext, 200),
    outputLength: params.output.length,
    outputHash: hashContent(params.output),
    durationMs: params.durationMs,
  };

  const store = getStore();
  store.events.push(event);
  saveStore(store);

  return event;
}

// Log user edit event
export function logEdit(params: {
  patientId: string | null;
  patientName?: string;
  field: GenerationSource;
  original: string;
  edited: string;
}): EditEvent {
  const changePercentage = calculateChangePercentage(params.original, params.edited);

  const event: EditEvent = {
    id: generateAuditId("edit"),
    timestamp: new Date().toISOString(),
    type: "edit",
    patientId: params.patientId,
    patientName: params.patientName,
    field: params.field,
    originalHash: hashContent(params.original),
    editedHash: hashContent(params.edited),
    changePercentage,
    changeSummary: generateChangeSummary(params.original, params.edited),
  };

  const store = getStore();
  store.events.push(event);
  saveStore(store);

  return event;
}

// Log export event
export function logExport(params: {
  patientId: string | null;
  patientName?: string;
  format: ExportFormat;
  content: {
    analise?: string;
    conduta?: string;
    receita?: string;
  };
}): ExportEvent {
  const contentHashes: ExportEvent["contentHashes"] = {};
  if (params.content.analise) contentHashes.analise = hashContent(params.content.analise);
  if (params.content.conduta) contentHashes.conduta = hashContent(params.content.conduta);
  if (params.content.receita) contentHashes.receita = hashContent(params.content.receita);

  const event: ExportEvent = {
    id: generateAuditId("export"),
    timestamp: new Date().toISOString(),
    type: "export",
    patientId: params.patientId,
    patientName: params.patientName,
    format: params.format,
    contentHashes,
  };

  const store = getStore();
  store.events.push(event);
  saveStore(store);

  return event;
}

// Log session event
export function logSession(params: {
  patientId: string | null;
  patientName?: string;
  action: SessionAction;
  details?: string;
}): SessionEvent {
  const event: SessionEvent = {
    id: generateAuditId("session"),
    timestamp: new Date().toISOString(),
    type: "session",
    patientId: params.patientId,
    patientName: params.patientName,
    action: params.action,
    details: params.details,
  };

  const store = getStore();
  store.events.push(event);
  saveStore(store);

  return event;
}

// Get audit events with optional filters
export function getAuditEvents(filters?: {
  patientId?: string;
  type?: AuditEventType;
  since?: Date;
  limit?: number;
}): AuditEvent[] {
  const store = getStore();
  let events = [...store.events];

  if (filters?.patientId) {
    events = events.filter(e => e.patientId === filters.patientId);
  }

  if (filters?.type) {
    events = events.filter(e => e.type === filters.type);
  }

  if (filters?.since) {
    const sinceTime = filters.since.getTime();
    events = events.filter(e => new Date(e.timestamp).getTime() >= sinceTime);
  }

  // Sort by timestamp descending (newest first)
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (filters?.limit) {
    events = events.slice(0, filters.limit);
  }

  return events;
}

// Get audit statistics
export function getAuditStats(): {
  totalEvents: number;
  generationCount: number;
  editCount: number;
  exportCount: number;
  sessionCount: number;
  firstEventAt: string | null;
  lastEventAt: string | null;
} {
  const store = getStore();
  const events = store.events;

  return {
    totalEvents: events.length,
    generationCount: events.filter(e => e.type === "generation").length,
    editCount: events.filter(e => e.type === "edit").length,
    exportCount: events.filter(e => e.type === "export").length,
    sessionCount: events.filter(e => e.type === "session").length,
    firstEventAt: events.length > 0 ? events[0].timestamp : null,
    lastEventAt: events.length > 0 ? events[events.length - 1].timestamp : null,
  };
}

// Export audit log as JSON for compliance
export function exportAuditLog(patientId?: string): string {
  const events = patientId
    ? getAuditEvents({ patientId })
    : getAuditEvents();

  const exportData = {
    exportedAt: new Date().toISOString(),
    exportedFor: patientId || "all_patients",
    eventCount: events.length,
    events,
  };

  return JSON.stringify(exportData, null, 2);
}

// Generate human-readable audit report
export function generateAuditReport(patientId: string): string {
  const events = getAuditEvents({ patientId });

  if (events.length === 0) {
    return "Nenhum evento de auditoria encontrado para este paciente.";
  }

  const lines: string[] = [
    "RELATÓRIO DE AUDITORIA CLÍNICA",
    "==============================",
    `Paciente ID: ${patientId}`,
    `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
    `Total de eventos: ${events.length}`,
    "",
    "CRONOLOGIA DE EVENTOS:",
    "----------------------",
  ];

  for (const event of events.reverse()) { // Chronological order
    const time = new Date(event.timestamp).toLocaleString("pt-BR");

    switch (event.type) {
      case "generation":
        lines.push(`[${time}] IA GERAÇÃO: ${event.source} (modelo: ${event.model}, ${event.outputLength} caracteres)`);
        break;
      case "edit":
        lines.push(`[${time}] EDIÇÃO: ${event.field} alterado em ${event.changePercentage.toFixed(1)}% (${event.changeSummary})`);
        break;
      case "export":
        lines.push(`[${time}] EXPORTAÇÃO: formato ${event.format}`);
        break;
      case "session":
        lines.push(`[${time}] SESSÃO: ${event.action}${event.details ? ` - ${event.details}` : ""}`);
        break;
    }
  }

  return lines.join("\n");
}

// Helper: Calculate percentage of content changed
function calculateChangePercentage(original: string, edited: string): number {
  const maxLen = Math.max(original.length, edited.length);
  if (maxLen === 0) return 0;

  let differences = 0;
  const minLen = Math.min(original.length, edited.length);

  for (let i = 0; i < minLen; i++) {
    if (original[i] !== edited[i]) differences++;
  }
  differences += Math.abs(original.length - edited.length);

  return (differences / maxLen) * 100;
}

// Helper: Generate change summary
function generateChangeSummary(original: string, edited: string): string {
  const originalLines = original.split("\n").length;
  const editedLines = edited.split("\n").length;
  const lineDiff = editedLines - originalLines;

  const charDiff = edited.length - original.length;

  const parts: string[] = [];

  if (lineDiff !== 0) {
    parts.push(`${lineDiff > 0 ? "+" : ""}${lineDiff} linhas`);
  }

  if (Math.abs(charDiff) > 10) {
    parts.push(`${charDiff > 0 ? "+" : ""}${charDiff} chars`);
  }

  return parts.length > 0 ? parts.join(", ") : "edições menores";
}

// Helper: Truncate text
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}
