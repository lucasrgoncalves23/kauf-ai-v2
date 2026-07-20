"use client";

import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Save,
  ChevronDown,
  Settings,
} from "lucide-react";
import { Spinner } from "./ui";

type HeaderBarProps = {
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
  leftCollapsed?: boolean;
  rightCollapsed?: boolean;
  onToggleLeft?: () => void;
  onToggleRight?: () => void;
};

const SAVE_STATUS_UI = {
  saved: { dot: "bg-emerald-500", text: "Salvo", textColor: "text-slate-400 dark:text-slate-500" },
  saving: { dot: "bg-amber-400 animate-pulse", text: "Salvando...", textColor: "text-slate-400 dark:text-slate-500" },
  offline: { dot: "bg-red-500", text: "Offline — não salvo no servidor", textColor: "text-red-500 dark:text-red-400" },
} as const;

export function HeaderBar({
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
  leftCollapsed,
  rightCollapsed,
  onToggleLeft,
  onToggleRight,
}: HeaderBarProps) {
  const statusUi = saveStatus ? SAVE_STATUS_UI[saveStatus] : null;
  return (
    <div className="flex items-center justify-between gap-8 compact:gap-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm print:hidden transition-colors duration-300 px-8 py-7 mb-6 compact:px-5 compact:py-4 compact:mb-3">
      <div className="flex items-center gap-4 compact:gap-3 min-w-0">
        {onToggleLeft && (
          <button
            onClick={onToggleLeft}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
            title={leftCollapsed ? "Mostrar painel do paciente" : "Ocultar painel do paciente"}
          >
            {leftCollapsed ? <PanelLeftOpen className="w-4.5 h-4.5" /> : <PanelLeftClose className="w-4.5 h-4.5" />}
          </button>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ik-logo.png"
          alt="Instituto Kaufmann"
          className="w-auto block dark:hidden h-20 compact:h-14"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ik-logo-white.png"
          alt="Instituto Kaufmann"
          className="w-auto hidden dark:block h-20 compact:h-14"
        />
        {statusUi && (
          <div
            className={`flex items-center gap-1.5 whitespace-nowrap text-2xs font-medium ${statusUi.textColor}`}
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
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              isSavingConsulta
                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-400 cursor-wait"
                : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800"
            }`}
          >
            {isSavingConsulta ? <Spinner /> : <Save className="w-3.5 h-3.5" />}
            Salvar consulta
          </button>
        )}
        <button
          onClick={onClearSession}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 px-4 py-2.5 rounded-lg text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
        >
          Limpar sessão
        </button>
        <div className="relative">
          <button
            onClick={onToggleExportDropdown}
            disabled={isGeneratingPatientPdf}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all shadow-lg shadow-slate-200 dark:shadow-slate-900/30 ${
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
                <span>Exportar PDF</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>
          {showExportDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={onToggleExportDropdown} />
              <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50 animate-scale-in">
                <button
                  onClick={onExportClinical}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="font-medium">Versão Clínica</div>
                  <div className="text-2xs text-slate-400 dark:text-slate-500">Relatório completo técnico</div>
                </button>
                <button
                  onClick={onExportPatient}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="font-medium">Versão Paciente</div>
                  <div className="text-2xs text-slate-400 dark:text-slate-500">Linguagem simplificada</div>
                </button>
                <button
                  onClick={onExportPrescription}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="font-medium">Receita</div>
                  <div className="text-2xs text-slate-400 dark:text-slate-500">Prescrição para farmácia</div>
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
          <Settings className="w-5 h-5" />
        </button>
        {onToggleRight && (
          <button
            onClick={onToggleRight}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
            title={rightCollapsed ? "Mostrar KAUAI" : "Ocultar KAUAI"}
          >
            {rightCollapsed ? <PanelRightOpen className="w-4.5 h-4.5" /> : <PanelRightClose className="w-4.5 h-4.5" />}
          </button>
        )}
      </div>
    </div>
  );
}
