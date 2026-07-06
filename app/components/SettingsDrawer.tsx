"use client";

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
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Ajustes do KAUAI Engine</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
            {/* Clinical Thresholds Section */}
            <div>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Limiares Clínicos</h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">Definem a classificação de fase</p>
                </div>
              </div>

              <div className="space-y-5">
                {/* HRV Slider */}
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

                {/* RHR Slider */}
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

                {/* HOMA-IR Slider */}
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

                {/* Sleep Slider */}
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
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Interface</h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">Preferências visuais</p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Dark Mode Toggle */}
                <ToggleOption
                  icon={
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                    />
                  }
                  label="Modo escuro"
                  description={settings.ui.darkMode ? "Ativado" : "Desativado"}
                  checked={settings.ui.darkMode}
                  onChange={() =>
                    onSettingsChange({ ...settings, ui: { ...settings.ui, darkMode: !settings.ui.darkMode } })
                  }
                />

                {/* Compact View Toggle */}
                <ToggleOption
                  icon={
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" />
                  }
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
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Correções (IA Learning)</h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    {correctionStats.approvedExamples} exemplos aprovados
                  </p>
                </div>
              </div>

              <button
                onClick={onOpenCorrections}
                className="w-full bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm cursor-pointer hover:border-amber-300 dark:hover:border-amber-600 transition-all group text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center group-hover:bg-amber-100 dark:group-hover:bg-amber-900/30 transition-colors">
                      <svg
                        className="w-5 h-5 text-slate-600 dark:text-slate-300 group-hover:text-amber-600 dark:group-hover:text-amber-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                        />
                      </svg>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Gerenciar Correções
                      </span>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">Aprovar, revisar ou excluir</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            </div>

            {/* Audit Trail Section */}
            {auditStats && onExportAuditLog && (
              <div>
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Trilha de Auditoria</h3>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                      {auditStats.totalEvents} eventos registrados
                    </p>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-2">
                      <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{auditStats.generationCount}</div>
                      <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-medium">Gerações</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-2">
                      <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{auditStats.editCount}</div>
                      <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-medium">Edições</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-2">
                      <div className="text-lg font-bold text-purple-600 dark:text-purple-400">{auditStats.exportCount}</div>
                      <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-medium">Exports</div>
                    </div>
                  </div>

                  <button
                    onClick={onExportAuditLog}
                    className="w-full py-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Exportar Log de Auditoria
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
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Restaurar Padrões
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
          {unit && <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1">({unit})</span>}
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
          className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-blue-500 [&::-webkit-slider-thumb]:to-indigo-600 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-blue-500/30 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

type ToggleOptionProps = {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
};

function ToggleOption({ icon, label, description, checked, onChange }: ToggleOptionProps) {
  return (
    <div
      onClick={onChange}
      className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm cursor-pointer hover:border-slate-200 dark:hover:border-slate-600 transition-all group"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center group-hover:bg-slate-200 dark:group-hover:bg-slate-600 transition-colors">
            <svg className="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {icon}
            </svg>
          </div>
          <div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">{description}</p>
          </div>
        </div>
        {/* Custom Toggle Switch */}
        <div
          className={`w-11 h-6 rounded-full p-0.5 transition-colors ${
            checked ? "bg-gradient-to-r from-blue-500 to-indigo-600" : "bg-slate-200 dark:bg-slate-600"
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
