"use client";

/**
 * CRM Panel — today's agenda and clinical alerts pushed by the Clinic OS
 * CRM (agenda_hoje / alerta_clinico webhook events). Lives in the left
 * sidebar so the doctor opens KAUAI and sees the day at a glance.
 */

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, TriangleAlert, X } from "lucide-react";
import { getPinHeaders } from "../lib/api-client";

type AgendaAppointment = {
  kauf_id: string | null;
  patient_name: string;
  starts_at: string;
  status: string;
  service_name: string | null;
  practitioner_name: string | null;
  fase: string | null;
};

type CrmAlert = {
  id: string;
  patientId: string | null;
  patientName: string | null;
  message: string;
  severity: string;
};

const PHASE_COLORS: Record<string, string> = {
  A: "bg-amber-400",
  B: "bg-blue-400",
  C: "bg-emerald-400",
};

export function CrmPanel({
  onSelectPatient,
}: {
  onSelectPatient: (kaufId: string) => void;
}) {
  const [agenda, setAgenda] = useState<AgendaAppointment[] | null>(null);
  const [alerts, setAlerts] = useState<CrmAlert[]>([]);

  const load = useCallback(() => {
    fetch("/api/crm/agenda", { headers: getPinHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setAgenda(data?.appointments ?? []))
      .catch(() => setAgenda([]));
    fetch("/api/crm/alerts", { headers: getPinHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setAlerts(data?.alerts ?? []))
      .catch(() => setAlerts([]));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  async function dismissAlert(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    fetch("/api/crm/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getPinHeaders() },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }

  const hasAgenda = agenda !== null && agenda.length > 0;
  const hasAlerts = alerts.length > 0;
  if (!hasAgenda && !hasAlerts) return null;

  return (
    <div className="space-y-3 mb-4 compact:mb-3">
      {hasAgenda && (
        <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-4 compact:p-3">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Hoje na clínica
            </span>
          </div>
          <ul className="space-y-1.5">
            {agenda!.map((appt, i) => {
              const time = new Date(appt.starts_at).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              });
              const clickable = !!appt.kauf_id;
              return (
                <li key={i}>
                  <button
                    onClick={() => appt.kauf_id && onSelectPatient(appt.kauf_id)}
                    disabled={!clickable}
                    className={`w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${
                      clickable
                        ? "hover:bg-brand-50 dark:hover:bg-brand-900/30 cursor-pointer"
                        : "cursor-default"
                    }`}
                  >
                    <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                      {time}
                    </span>
                    <span className="flex-1 min-w-0 truncate text-xs font-medium text-slate-700 dark:text-slate-300">
                      {appt.patient_name}
                    </span>
                    {appt.fase && (
                      <span
                        title={`Fase ${appt.fase}`}
                        className={`w-1.5 h-1.5 rounded-full ${PHASE_COLORS[appt.fase] ?? "bg-slate-300"}`}
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {hasAlerts && (
        <div className="rounded-xl bg-amber-50/70 dark:bg-amber-900/20 border border-amber-200/70 dark:border-amber-800/50 p-4 compact:p-3">
          <div className="flex items-center gap-2 mb-2.5">
            <TriangleAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-2xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Alertas do CRM
            </span>
          </div>
          <ul className="space-y-2">
            {alerts.map((alert) => (
              <li key={alert.id} className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  {alert.patientName && (
                    <button
                      onClick={() =>
                        alert.patientId && onSelectPatient(alert.patientId)
                      }
                      disabled={!alert.patientId}
                      className={`text-xs font-semibold text-amber-800 dark:text-amber-200 ${
                        alert.patientId ? "hover:underline" : "cursor-default"
                      }`}
                    >
                      {alert.patientName}
                    </button>
                  )}
                  <p className="text-xs leading-snug text-amber-700 dark:text-amber-300">
                    {alert.message}
                  </p>
                </div>
                <button
                  onClick={() => dismissAlert(alert.id)}
                  title="Dispensar"
                  className="shrink-0 p-0.5 rounded text-amber-400 hover:text-amber-700 dark:hover:text-amber-200 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
