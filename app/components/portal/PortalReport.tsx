"use client";

import { useEffect, useState } from "react";
import { LogOut, Printer, ShieldCheck } from "lucide-react";
import type { PortalPayload } from "../../lib/portal/payload";
import { useChecklist } from "./useChecklist";
import {
  DiaADiaSection,
  ExamesSection,
  MedicamentosSection,
  ProximosPassosSection,
  ResumoSection,
  ScheduleSection,
  formatLongDate,
} from "./sections";

type PortalReportProps = {
  payload: PortalPayload;
  onExit?: () => void;
  preview?: boolean;
};

export function PortalReport({ payload, onExit, preview = false }: PortalReportProps) {
  const checklist = useChecklist(preview ? null : `kai-portal-check:${payload.publishedAt}`);
  const [expandAll, setExpandAll] = useState(false);

  useEffect(() => {
    const reset = () => setExpandAll(false);
    window.addEventListener("afterprint", reset);
    return () => window.removeEventListener("afterprint", reset);
  }, []);

  const print = () => {
    setExpandAll(true);
    setTimeout(() => window.print(), 80);
  };

  const { content, schedules } = payload;
  const hasDiaADia = content.modulos.length > 0;
  const hasMeds = payload.medicamentos.length > 0 || Boolean(payload.receitaOriginal.trim());
  const nav = [
    { id: "resumo", label: "Resumo", show: true },
    { id: "dia-a-dia", label: "Dia a dia", show: hasDiaADia },
    { id: "o-que-tomar", label: "O que tomar", show: hasMeds },
    { id: "alimentacao", label: "Alimentação", show: Boolean(schedules.dieta) },
    { id: "treino", label: "Treino", show: Boolean(schedules.treino) },
    { id: "exames", label: "Exames", show: payload.labSeries.length > 0 },
    { id: "proximos-passos", label: "Próximos passos", show: true },
  ].filter((n) => n.show);

  return (
    <div className="min-h-screen bg-slate-50 pb-16 print:bg-white print:pb-0">
      <header className="bg-white px-5 pb-6 pt-8 print:pt-0">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ik-logo.png" alt={payload.clinic.name} className="h-8 w-auto" />
            {onExit && (
              <button onClick={onExit} className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600 print:hidden">
                <LogOut className="h-3.5 w-3.5" /> Sair
              </button>
            )}
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-brand-600">Seu plano de saúde</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Olá, {payload.patientFirstName}</h1>
          <p className="mt-2 text-sm text-slate-500">
            Consulta de {formatLongDate(payload.consultaDate)} · {payload.clinic.doctor}
          </p>
        </div>
      </header>

      <nav className="sticky top-0 z-10 border-y border-slate-100 bg-white/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-2xl gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none]">
          {nav.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              {n.label}
            </a>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-2xl space-y-8 px-4 pt-6">
        <ResumoSection resumo={content.resumo} />
        {hasDiaADia && <DiaADiaSection modulos={content.modulos} checklist={checklist} />}
        {hasMeds && <MedicamentosSection medicamentos={payload.medicamentos} receitaOriginal={payload.receitaOriginal} expandAll={expandAll} />}
        {schedules.dieta && <ScheduleSection id="alimentacao" title="Alimentação · exemplo para 30 dias" schedule={schedules.dieta} expandAll={expandAll} />}
        {schedules.treino && <ScheduleSection id="treino" title="Treino · exemplo para 30 dias" schedule={schedules.treino} expandAll={expandAll} />}
        <ExamesSection labSeries={payload.labSeries} exames={content.exames} />
        <ProximosPassosSection proximos={content.proximosPassos} nextVisit={payload.nextVisit} contactLine={payload.clinic.contactLine} />

        <footer className="border-t border-slate-200 pt-6 text-xs leading-relaxed text-slate-400">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
            <p>
              Plano preparado por <span className="font-semibold text-slate-500">{payload.clinic.doctor}</span> ({payload.clinic.crm}),{" "}
              {payload.clinic.name}, com apoio de inteligência artificial e revisado pelo médico. Ele complementa, mas não substitui, as orientações
              dadas na consulta. Em caso de dúvida, fale com a clínica antes de mudar qualquer medicação.
            </p>
          </div>
          <p className="mt-3">
            Publicado em {formatLongDate(payload.publishedAt)} · Link válido até {formatLongDate(payload.expiresAt)}. Os seus dados são protegidos
            conforme a LGPD; o acesso a este plano é registrado e pode ser desativado pela clínica a qualquer momento.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 print:hidden">
            <button
              onClick={print}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" /> Imprimir ou salvar em PDF
            </button>
            {onExit && (
              <button onClick={onExit} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-100">
                <LogOut className="h-4 w-4" /> Sair
              </button>
            )}
          </div>
        </footer>
      </main>
    </div>
  );
}
