"use client";

import {
  X,
  BarChart3,
  Palette,
  Moon,
  Rows3,
  Lightbulb,
  ClipboardCheck,
  ChevronRight,
  FileText,
  Download,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import type { Settings } from "../types/clinical";
import { DEFAULT_SETTINGS } from "../types/clinical";

type AuditStats = {
  totalEvents: number;
  generationCount: number;
  editCount: number;
  exportCount: number;
};

type SettingsDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
  onOpenCorrections: () => void;
  correctionStats: { approvedExamples: number };
  auditStats?: AuditStats;
  onExportAuditLog?: () => void;
};

export function SettingsDrawer({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  onOpenCorrections,
  correctionStats,
  auditStats,
  onExportAuditLog,
}: SettingsDrawerProps) {
  return (
    <>
      {/* Drawer */}
      <div
        className={`no-print fixed inset-y-0 right-0 w-[340px] bg-gradient-to-b from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 border-l border-slate-200/80 dark:border-slate-700/80 shadow-2xl shadow-slate-900/10 dark:shadow-black/30 transform transition-all duration-300 ease-out z-50 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Configurações</h2>
                <p className="text-2xs text-slate-400 dark:text-slate-500 mt-0.5">Ajustes do KAUAI Engine</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
            {/* Clinical Thresholds Section */}
            <div>
              <SectionHeader
                icon={BarChart3}
                iconBg="from-brand-500 to-indigo-600"
                title="Limiares Clínicos"
                subtitle="Definem a classificação de fase"
              />

              <div className="space-y-5">
                <ThresholdSlider
                  label="HRV mínimo"
                  unit="ms"
                  value={settings.thresholds.hrv}
                  min={20}
                  max={80}
                  onChange={(value) =>
                    onSettingsChange({ ...settings, thresholds: { ...settings.thresholds, hrv: value } })
                  }
                />
                <ThresholdSlider
                  label="RHR máximo"
                  unit="bpm"
                  value={settings.thresholds.rhr}
                  min={55}
                  max={90}
                  onChange={(value) =>
                    onSettingsChange({ ...settings, thresholds: { ...settings.thresholds, rhr: value } })
                  }
                />
                <ThresholdSlider
                  label="HOMA-IR máximo"
                  value={settings.thresholds.homaIr}
                  min={1}
                  max={5}
                  step={0.1}
                  formatValue={(v) => v.toFixed(1)}
                  onChange={(value) =>
                    onSettingsChange({ ...settings, thresholds: { ...settings.thresholds, homaIr: value } })
                  }
                />
                <ThresholdSlider
                  label="Sono mínimo"
                  unit="horas"
                  value={settings.thresholds.sleep}
                  min={4}
                  max={8}
                  step={0.5}
                  formatMinMax={(v) => `${v}h`}
                  onChange={(value) =>
                    onSettingsChange({ ...settings, thresholds: { ...settings.thresholds, sleep: value } })
                  }
                />
              </div>
            </div>

            {/* UI Preferences Section */}
            <div>
              <SectionHeader
                icon={Palette}
                iconBg="from-violet-500 to-purple-600"
                title="Interface"
                subtitle="Preferências visuais"
              />

              <div className="space-y-3">
                <ToggleOption
                  icon={Moon}
                  label="Modo escuro"
                  description={settings.ui.darkMode ? "Ativado" : "Desativado"}
                  checked={settings.ui.darkMode}
                  onChange={() =>
                    onSettingsChange({ ...settings, ui: { ...settings.ui, darkMode: !settings.ui.darkMode } })
                  }
                />
                <ToggleOption
                  icon={Rows3}
                  label="Visualização compacta"
                  description={settings.ui.compactView ? "Ativado" : "Desativado"}
                  checked={settings.ui.compactView}
                  onChange={() =>
                    onSettingsChange({ ...settings, ui: { ...settings.ui, compactView: !settings.ui.compactView } })
                  }
                />
              </div>
            </div>

            {/* Corrections Section */}
            <div>
              <SectionHeader
                icon={Lightbulb}
                iconBg="from-amber-500 to-orange-600"
                title="Correções (IA Learning)"
                subtitle={`${correctionStats.approvedExamples} exemplos aprovados`}
              />

              <button
                onClick={onOpenCorrections}
                className="w-full bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm cursor-pointer hover:border-amber-300 dark:hover:border-amber-600 transition-all group text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center group-hover:bg-amber-100 dark:group-hover:bg-amber-900/30 transition-colors">
                      <ClipboardCheck className="w-5 h-5 text-slate-600 dark:text-slate-300 group-hover:text-amber-600 dark:group-hover:text-amber-400" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Gerenciar Correções
                      </span>
                      <p className="text-2xs text-slate-400 dark:text-slate-500">Aprovar, revisar ou excluir</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
              </button>
            </div>

            {/* Audit Trail Section */}
            {auditStats && onExportAuditLog && (
              <div>
                <SectionHeader
                  icon={FileText}
                  iconBg="from-emerald-500 to-teal-600"
                  title="Trilha de Auditoria"
                  subtitle={`${auditStats.totalEvents} eventos registrados`}
                />

                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-2">
                      <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{auditStats.generationCount}</div>
                      <div className="text-2xs text-slate-500 dark:text-slate-400 uppercase font-medium">Gerações</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-2">
                      <div className="text-lg font-bold text-brand-600 dark:text-brand-400">{auditStats.editCount}</div>
                      <div className="text-2xs text-slate-500 dark:text-slate-400 uppercase font-medium">Edições</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-2">
                      <div className="text-lg font-bold text-purple-600 dark:text-purple-400">{auditStats.exportCount}</div>
                      <div className="text-2xs text-slate-500 dark:text-slate-400 uppercase font-medium">Exports</div>
                    </div>
                  </div>

                  <button
                    onClick={onExportAuditLog}
                    className="w-full py-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Exportar log de auditoria
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <button
              onClick={() => onSettingsChange(DEFAULT_SETTINGS)}
              className="w-full py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Restaurar padrões
            </button>
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="no-print fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}
    </>
  );
}

// --- Sub-components ---

function SectionHeader({
  icon: Icon,
  iconBg,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  iconBg: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${iconBg} flex items-center justify-center`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
        <p className="text-2xs text-slate-400 dark:text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

type ThresholdSliderProps = {
  label: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  formatValue?: (v: number) => string;
  formatMinMax?: (v: number) => string;
  onChange: (value: number) => void;
};

function ThresholdSlider({
  label,
  unit,
  value,
  min,
  max,
  step = 1,
  formatValue,
  formatMinMax,
  onChange,
}: ThresholdSliderProps) {
  const displayValue = formatValue ? formatValue(value) : value;
  const minLabel = formatMinMax ? formatMinMax(min) : unit ? `${min}${unit === "ms" || unit === "bpm" ? unit : ""}` : min;
  const maxLabel = formatMinMax ? formatMinMax(max) : unit ? `${max}${unit === "ms" || unit === "bpm" ? unit : ""}` : max;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</span>
          {unit && <span className="text-2xs text-slate-400 dark:text-slate-500 ml-1">({unit})</span>}
        </div>
        <div className="px-3 py-1.5 bg-slate-900 dark:bg-slate-600 rounded-lg">
          <span className="text-sm font-bold text-white font-mono">{displayValue}</span>
        </div>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-brand-500 [&::-webkit-slider-thumb]:to-indigo-600 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-brand-500/30 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
        />
      </div>
      <div className="flex justify-between text-2xs text-slate-400 dark:text-slate-500 mt-2 font-medium">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

type ToggleOptionProps = {
  icon: LucideIcon;
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
};

function ToggleOption({ icon: Icon, label, description, checked, onChange }: ToggleOptionProps) {
  return (
    <div
      onClick={onChange}
      className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm cursor-pointer hover:border-slate-200 dark:hover:border-slate-600 transition-all group"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center group-hover:bg-slate-200 dark:group-hover:bg-slate-600 transition-colors">
            <Icon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
            <p className="text-2xs text-slate-400 dark:text-slate-500">{description}</p>
          </div>
        </div>
        {/* Custom Toggle Switch */}
        <div
          className={`w-11 h-6 rounded-full p-0.5 transition-colors ${
            checked ? "bg-gradient-to-r from-brand-500 to-indigo-600" : "bg-slate-200 dark:bg-slate-600"
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
              checked ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </div>
      </div>
    </div>
  );
}
