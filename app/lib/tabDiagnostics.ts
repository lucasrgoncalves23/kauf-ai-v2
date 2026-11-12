/**
 * Tab-loss diagnostics (client).
 *
 * A doctor's Safari tab for KAUAI disappears from the tab bar the moment he clicks
 * away from it. Nothing in the app closes tabs, so this records what the page sees
 * (focus, visibility, pagehide/beforeunload, close attempts) and ships it to
 * /api/diag/tab. The log is kept in localStorage first, so a session that was killed
 * mid-flight is delivered on the next open. No patient data is recorded.
 *
 * It also blocks page-level window.close(): Safari lets any script close a tab
 * that has a single history entry, and KAUAI itself never needs to.
 */
import { getPinHeaders } from "./api-client";

const CURRENT_KEY = "kai-tab-diag";
const PENDING_KEY = "kai-tab-diag-pending";
const MAX_EVENTS = 40;
const MAX_PENDING = 5;

type DiagEvent = {
  t: number; // ms since page start
  type: string;
  vis: string;
  focus: boolean;
  detail?: string;
};

export type DiagSession = {
  id: string;
  startedAt: string;
  ua: string;
  historyLength: number;
  referrer: string;
  hasOpener: boolean;
  standalone: boolean;
  navType: string;
  events: DiagEvent[];
};

let installed = false;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — diagnostics are best-effort */
  }
}

function send(sessions: DiagSession[]): Promise<boolean> {
  const pin = getPinHeaders();
  if (!pin["X-Clinic-Pin"] || sessions.length === 0) return Promise.resolve(false);
  return fetch("/api/diag/tab", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...pin },
    body: JSON.stringify({ sessions }),
    keepalive: true,
  })
    .then((r) => r.ok)
    .catch(() => false);
}

export function installTabDiagnostics(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // The previous session never got a chance to report how it ended: queue it
  const previous = readJson<DiagSession | null>(CURRENT_KEY, null);
  const pending = readJson<DiagSession[]>(PENDING_KEY, []);
  if (previous?.id && !pending.some((s) => s.id === previous.id)) pending.push(previous);
  writeJson(PENDING_KEY, pending.slice(-MAX_PENDING));

  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const session: DiagSession = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    startedAt: new Date().toISOString(),
    ua: navigator.userAgent,
    historyLength: history.length,
    referrer: document.referrer,
    hasOpener: !!window.opener,
    standalone: window.matchMedia?.("(display-mode: standalone)").matches ?? false,
    navType: nav?.type ?? "unknown",
    events: [],
  };

  const record = (type: string, detail?: string) => {
    session.events.push({
      t: Math.round(performance.now()),
      type,
      vis: document.visibilityState,
      focus: document.hasFocus(),
      ...(detail ? { detail } : {}),
    });
    if (session.events.length > MAX_EVENTS) session.events.splice(0, session.events.length - MAX_EVENTS);
    writeJson(CURRENT_KEY, session);
  };

  const flushCurrent = () => {
    void send([session]);
  };

  // Block and log page-level close attempts
  window.close = function blockedClose() {
    record("window.close-blocked", (new Error().stack || "").slice(0, 1500));
    flushCurrent();
  };

  record("boot", `history=${history.length}`);

  window.addEventListener("blur", () => record("blur"));
  window.addEventListener("focus", () => record("focus"));
  window.addEventListener("pageshow", (e) => record("pageshow", `persisted=${e.persisted}`));
  window.addEventListener("pagehide", (e) => {
    record("pagehide", `persisted=${e.persisted}`);
    flushCurrent();
  });
  window.addEventListener("beforeunload", () => {
    record("beforeunload");
    flushCurrent();
  });
  document.addEventListener("visibilitychange", () => {
    record("visibilitychange");
    if (document.visibilityState === "hidden") flushCurrent();
  });
  document.addEventListener("freeze", () => record("freeze"));
  document.addEventListener("resume", () => record("resume"));

  // Deliver earlier sessions (including one that vanished) once we can authenticate
  const queued = readJson<DiagSession[]>(PENDING_KEY, []);
  if (queued.length > 0) {
    void send(queued).then((ok) => {
      if (ok) writeJson(PENDING_KEY, []);
    });
  }
}
