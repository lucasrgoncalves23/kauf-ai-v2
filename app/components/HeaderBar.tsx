"use client";

import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Save,
  ChevronDown,
  Download,
  Eraser,
  FileText,
  Pill,
  Settings,
} from "lucide-react";
import { Spinner } from "./ui";

type HeaderBarProps = {
  showExportDropdown: boolean;
  onToggleExportDropdown: () => void;
  onExportClinical: () => void;
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
  onExportClinical,
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
    <div className="@container flex items-center justify-between gap-8 compact:gap-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm print:hidden transition-colors duration-300 px-8 py-7 mb-6 compact:px-5 compact:py-4 compact:mb-3">
      <div className="flex items-center gap-4 compact:gap-3 min-w-0">
        {onToggleLeft && (
          <button
            onClick={onToggleLeft}
            className="shrink-0 p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
            title={leftCollapsed ? "Mostrar painel do paciente" : "Ocultar painel do paciente"}
          >
            {leftCollapsed ? <PanelLeftOpen className="w-4.5 h-4.5" /> : <PanelLeftClose className="w-4.5 h-4.5" />}
          </button>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ik-logo.png"
          alt="Instituto Kaufmann"
          className="w-auto shrink-0 block dark:hidden h-20 compact:h-14"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ik-logo-white.png"
          alt="Instituto Kaufmann"
          className="w-auto shrink-0 hidden dark:block h-20 compact:h-14"
        />
        {statusUi && (
          <div
            className={`flex items-center gap-1.5 min-w-0 text-2xs font-medium ${statusUi.textColor}`}
            title={`${statusUi.text} — status de sincronização com o servidor`}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusUi.dot}`}></span>
            <span className="truncate">{statusUi.text}</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onSaveConsulta && (
          <button
            onClick={onSaveConsulta}
            disabled={isSavingConsulta}
            title="Salvar consulta"
            aria-label="Salvar consulta"
            className={`flex items-center gap-1.5 px-3 @min-[860px]:px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              isSavingConsulta
                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-400 cursor-wait"
                : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800"
            }`}
          >
            {isSavingConsulta ? <Spinner /> : <Save className="w-3.5 h-3.5" />}
            <span className="hidden @min-[860px]:inline">Salvar consulta</span>
          </button>
        )}
        <button
          onClick={onClearSession}
          title="Limpar sessão"
          aria-label="Limpar sessão"
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 px-3 @min-[860px]:px-4 py-2.5 rounded-lg text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
        >
          <Eraser className="w-3.5 h-3.5 @min-[860px]:hidden" />
          <span className="hidden @min-[860px]:inline">Limpar sessão</span>
        </button>
        <div className="relative">
          <button
            onClick={onToggleExportDropdown}
            title="Exportar PDF"
            aria-label="Exportar PDF"
            className="flex items-center gap-2 px-3 @min-[860px]:px-4 py-2.5 rounded-lg text-xs font-semibold transition-all shadow-lg shadow-slate-200 dark:shadow-slate-900/30 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white"
          >
            <Download className="w-3.5 h-3.5 @min-[860px]:hidden" />
            <span className="hidden @min-[860px]:inline">Exportar PDF</span>
            <ChevronDown className="hidden @min-[860px]:block w-3.5 h-3.5" />
          </button>
          {showExportDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={onToggleExportDropdown} />
              <div
                role="menu"
                className="absolute right-0 mt-1.5 min-w-full w-max bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-1 z-50 animate-scale-in"
              >
                <button
                  role="menuitem"
                  onClick={onExportClinical}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium whitespace-nowrap text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                  Relatório completo
                </button>
                <button
                  role="menuitem"
                  onClick={onExportPrescription}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium whitespace-nowrap text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <Pill className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                  Receita
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
