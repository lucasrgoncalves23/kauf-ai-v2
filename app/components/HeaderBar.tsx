"use client";

import { Spinner } from "./ui";

type HeaderBarProps = {
  compact: boolean;
  showExportDropdown: boolean;
  onToggleExportDropdown: () => void;
  isGeneratingPatientPdf: boolean;
  onExportClinical: () => void;
  onExportPatient: () => void;
  onExportPrescription: () => void;
  onClearSession: () => void;
  onOpenSettings: () => void;
  onSaveConsulta?: () => void;
  isSavingConsulta?: boolean;
  saveStatus?: "saved" | "saving" | "offline";
};

const SAVE_STATUS_UI = {
  saved: { dot: "bg-emerald-500", text: "Salvo", textColor: "text-slate-400 dark:text-slate-500" },
  saving: { dot: "bg-amber-400 animate-pulse", text: "Salvando...", textColor: "text-slate-400 dark:text-slate-500" },
  offline: { dot: "bg-red-500", text: "Offline — não salvo no servidor", textColor: "text-red-500 dark:text-red-400" },
} as const;

export function HeaderBar({
  compact,
  showExportDropdown,
  onToggleExportDropdown,
  isGeneratingPatientPdf,
  onExportClinical,
  onExportPatient,
  onExportPrescription,
  onClearSession,
  onOpenSettings,
  onSaveConsulta,
  isSavingConsulta,
  saveStatus,
}: HeaderBarProps) {
  const statusUi = saveStatus ? SAVE_STATUS_UI[saveStatus] : null;
  return (
    <div
      className={`flex items-center justify-between gap-8 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm print:hidden transition-colors duration-300 ${
        compact ? "px-5 py-4 mb-3" : "px-8 py-7 mb-6"
      }`}
    >
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ik-logo.png"
          alt="Instituto Kaufmann"
          className={`w-auto block dark:hidden ${compact ? "h-14" : "h-20"}`}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ik-logo-white.png"
          alt="Instituto Kaufmann"
          className={`w-auto hidden dark:block ${compact ? "h-14" : "h-20"}`}
        />
        {statusUi && (
          <div
            className={`flex items-center gap-1.5 whitespace-nowrap text-[10px] font-medium ${statusUi.textColor}`}
            title="Status de sincronização com o servidor"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusUi.dot}`}></span>
            {statusUi.text}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {onSaveConsulta && (
          <button
            onClick={onSaveConsulta}
            disabled={isSavingConsulta}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
              isSavingConsulta
                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-400 cursor-wait"
                : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800"
            }`}
          >
            {isSavingConsulta ? (
              <Spinner />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            )}
            SALVAR CONSULTA
          </button>
        )}
        <button
          onClick={onClearSession}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 px-4 py-2.5 rounded-lg text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
        >
          Limpar Sessão
        </button>
        <div className="relative">
          <button
            onClick={onToggleExportDropdown}
            disabled={isGeneratingPatientPdf}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all shadow-lg shadow-slate-200 dark:shadow-slate-900/30 ${
              isGeneratingPatientPdf
                ? "bg-slate-300 text-slate-500 cursor-wait"
                : "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white"
            }`}
          >
            {isGeneratingPatientPdf ? (
              <>
                <Spinner />
                <span>Gerando...</span>
              </>
            ) : (
              <>
                <span>EXPORTAR PDF</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
          </button>
          {showExportDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={onToggleExportDropdown} />
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50">
                <button
                  onClick={onExportClinical}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="font-medium">Versão Clínica</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">Relatório completo técnico</div>
                </button>
                <button
                  onClick={onExportPatient}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="font-medium">Versão Paciente</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">Linguagem simplificada</div>
                </button>
                <button
                  onClick={onExportPrescription}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="font-medium">Receita</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">Prescrição para farmácia</div>
                </button>
              </div>
            </>
          )}
        </div>
        <button
          onClick={onOpenSettings}
          className="p-2.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
          title="Configurações"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
