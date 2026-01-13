"use client";

import { useMemo, useRef, useState, useEffect } from "react";

type ProgramKey =
  | "Sono"
  | "Nutrição"
  | "Exercício"
  | "Suplementação"
  | "Manipulados"
  | "Soroterapia"
  | "Metabolismo / GLP-1"
  | "Hormonal"
  | "Peptídeos";

const PROGRAMS: ProgramKey[] = [
  "Sono",
  "Nutrição",
  "Exercício",
  "Suplementação",
  "Manipulados",
  "Soroterapia",
  "Metabolismo / GLP-1",
  "Hormonal",
  "Peptídeos",
];

// Toast notification component
function Toast({
  message,
  type,
  onClose
}: {
  message: string;
  type: "success" | "error" | "info";
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === "success"
    ? "bg-emerald-50 border-emerald-200"
    : type === "error"
    ? "bg-red-50 border-red-200"
    : "bg-blue-50 border-blue-200";

  const textColor = type === "success"
    ? "text-emerald-800"
    : type === "error"
    ? "text-red-800"
    : "text-blue-800";

  const icon = type === "success" ? "✓" : type === "error" ? "✕" : "i";

  return (
    <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg ${bgColor} animate-slide-in`}>
      <span className={`font-bold ${textColor}`}>{icon}</span>
      <span className={`text-sm ${textColor}`}>{message}</span>
      <button
        type="button"
        onClick={onClose}
        className={`ml-2 ${textColor} hover:opacity-70 transition-opacity`}
        aria-label="Fechar notificação"
      >
        ✕
      </button>
    </div>
  );
}

// Loading spinner component
function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="text-[11px] tracking-[0.14em] uppercase text-slate-500 font-medium">
      {children}
    </div>
  );
}

function FieldRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <div className="text-[11px] tracking-[0.14em] uppercase text-slate-400">
        {k}
      </div>
      <div className="text-[13px] text-slate-800 text-right font-medium">{v}</div>
    </div>
  );
}

function StatusRow({
  label,
  status,
  note,
}: {
  label: string;
  status: "ok" | "warn" | "none";
  note?: string;
}) {
  const icon = status === "ok" ? "✓" : status === "warn" ? "!" : "—";
  const color =
    status === "ok"
      ? "text-emerald-500 bg-emerald-50"
      : status === "warn"
      ? "text-amber-500 bg-amber-50"
      : "text-slate-400 bg-slate-100";

  return (
    <div className="flex items-center justify-between py-2">
      <div className="text-[12px] text-slate-700">{label}</div>
      <div className="flex items-center gap-2">
        {note && (
          <div className="text-[10px] text-slate-400 whitespace-nowrap">
            {note}
          </div>
        )}
        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function EditableBlock({
  title,
  value,
  onChange,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <section className="pb-6">
      <div className="flex items-end justify-between gap-4 mb-3">
        <h2 className="text-[14px] font-semibold text-slate-800">{title}</h2>
        <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
        <textarea
          className="w-full resize-none bg-transparent p-4 text-[13px] leading-6 text-slate-700 outline-none placeholder:text-slate-300"
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Digite aqui..."
        />
      </div>
    </section>
  );
}

function ProgramAccordion({
  name,
  open,
  onToggle,
  value,
  onChange,
}: {
  name: ProgramKey;
  open: boolean;
  onToggle: () => void;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-slate-50 transition-colors duration-150"
      >
        <div className="text-[13px] font-medium text-slate-700">{name}</div>
        <div className={`text-[10px] text-slate-400 transition-transform duration-200 ${open ? "rotate-90" : ""}`}>
          ▶
        </div>
      </button>

      <div className={`overflow-hidden transition-all duration-200 ${open ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="px-4 pb-4">
          <textarea
            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-[13px] leading-5 text-slate-700 outline-none focus:border-slate-300 focus:bg-white transition-colors duration-150"
            rows={4}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Conteúdo do programa ${name}...`}
          />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [importedData, setImportedData] = useState<{ filename: string; textLength: number; pages: number } | null>(null);

  function exportPDF() {
    window.print();
  }

  async function handlePdfImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/import-pdf", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setToast({ message: data.error || "Falha ao importar PDF", type: "error" });
        return;
      }

      setImportedData({
        filename: data.filename,
        textLength: data.text?.length || 0,
        pages: data.numPages || 1,
      });

      setToast({
        message: `PDF importado: ${data.numPages} página(s), ${data.text?.length || 0} caracteres`,
        type: "success"
      });

      console.log("Extracted text:", data.text);
    } catch (err) {
      console.error("IMPORT-PDF client error:", err);
      setToast({ message: "Erro de conexão ao importar", type: "error" });
    } finally {
      setIsLoading(false);
      e.target.value = "";
    }
  }

  const snapshot = useMemo(
    () => ({
      age: "47",
      sex: "M",
      height: "178 cm",
      weight: "91 kg",
      objective: "Fat loss + energy restoration",
      primaryRisk: "Metabolic rigidity",
      discipline: "7 / 10",
      phase: "B",
    }),
    []
  );

  const [integrativeDx, setIntegrativeDx] = useState("");
  const [primaryBottleneck, setPrimaryBottleneck] = useState("");
  const [activeLayers, setActiveLayers] = useState(
    "Base\nPerformance\nHormonal\nLongevidade"
  );
  const [kpis, setKpis] = useState("30 dias:\n60 dias:\n90 dias:");

  const [openProgram, setOpenProgram] = useState<ProgramKey | null>(null);
  const [programText, setProgramText] = useState<Record<ProgramKey, string>>(
    () =>
      PROGRAMS.reduce((acc, k) => {
        acc[k] = "";
        return acc;
      }, {} as Record<ProgramKey, string>)
  );

  const [engineAlerts, setEngineAlerts] = useState<string[]>([]);
  const [enginePhase, setEnginePhase] = useState<string>("—");
  const [engineBlocked, setEngineBlocked] = useState<
    { module: string; reason: string }[]
  >([]);

  // API Key state with localStorage persistence
  const [apiKey, setApiKey] = useState<string>("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<"none" | "saved" | "invalid">("none");

  // Load API key from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem("kauf-ai-api-key");
    if (savedKey) {
      setApiKey(savedKey);
      setApiKeyStatus("saved");
    }
  }, []);

  function handleSaveApiKey() {
    if (apiKey.trim().length < 10) {
      setToast({ message: "API key inválida (muito curta)", type: "error" });
      setApiKeyStatus("invalid");
      return;
    }
    localStorage.setItem("kauf-ai-api-key", apiKey.trim());
    setApiKeyStatus("saved");
    setToast({ message: "API key salva com sucesso", type: "success" });
  }

  function handleClearApiKey() {
    localStorage.removeItem("kauf-ai-api-key");
    setApiKey("");
    setApiKeyStatus("none");
    setToast({ message: "API key removida", type: "info" });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="mx-auto max-w-[1440px] px-6 py-6">
        <div className="grid grid-cols-[280px_1fr_300px] gap-6">

          {/* LEFT: Patient Snapshot */}
          <aside className="no-print sticky top-6 h-[calc(100vh-48px)] rounded-xl border border-slate-200/60 bg-white/80 backdrop-blur-sm p-5 shadow-sm">
            <SectionLabel>Patient Snapshot</SectionLabel>

            <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <FieldRow k="Age" v={snapshot.age} />
              <FieldRow k="Sex" v={snapshot.sex} />
              <FieldRow k="Height" v={snapshot.height} />
              <FieldRow k="Weight" v={snapshot.weight} />

              <div className="my-3 border-t border-slate-200/60" />

              <div className="text-[10px] tracking-[0.14em] uppercase text-slate-400 mb-1">
                Objective
              </div>
              <div className="text-[13px] text-slate-700 font-medium">
                {snapshot.objective}
              </div>

              <div className="mt-4 text-[10px] tracking-[0.14em] uppercase text-slate-400 mb-1">
                Primary Biological Risk
              </div>
              <div className="text-[13px] text-slate-700 font-medium">
                {snapshot.primaryRisk}
              </div>

              <div className="my-3 border-t border-slate-200/60" />
              <FieldRow k="Discipline" v={snapshot.discipline} />
              <FieldRow k="Active Phase" v={snapshot.phase} />
            </div>

            <div className="mt-6">
              <SectionLabel>Data Status</SectionLabel>
              <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                <StatusRow label="Labs" status="ok" />
                <StatusRow label="Bioimpedance" status="ok" />
                <StatusRow label="Wearable" status="warn" note="3d ago" />
                <StatusRow label="Genetics" status="none" />
              </div>
            </div>

            {/* Import Status */}
            {importedData && (
              <div className="mt-6">
                <SectionLabel>Last Import</SectionLabel>
                <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
                  <div className="text-[12px] text-emerald-700 font-medium truncate">
                    {importedData.filename}
                  </div>
                  <div className="text-[11px] text-emerald-600 mt-1">
                    {importedData.pages} pg · {importedData.textLength} chars
                  </div>
                </div>
              </div>
            )}
          </aside>

          {/* CENTER: Cognition Core */}
          <main className="print-report rounded-xl border border-slate-200/60 bg-white shadow-sm">
            {/* Header */}
            <div className="border-b border-slate-100 px-6 py-4">
              <div className="flex items-center justify-between">
                {/* Import Button */}
                <div className="no-print">
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={handlePdfImport}
                    aria-label="Selecionar arquivo PDF"
                    title="Selecionar arquivo PDF para importação"
                  />
                  <button
                    type="button"
                    onClick={() => pdfInputRef.current?.click()}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {isLoading ? (
                      <>
                        <Spinner />
                        <span>Importing...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span>Import PDF</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Title */}
                <div className="text-center">
                  <h1 className="text-[20px] font-bold text-slate-800 tracking-tight">
                    Kauf AI
                  </h1>
                  <div className="text-[11px] text-slate-400 tracking-wide">
                    Clinical Intelligence
                  </div>
                </div>

                {/* Export Button */}
                <div className="no-print">
                  <button
                    type="button"
                    onClick={exportPDF}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Export PDF</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              <EditableBlock
                title="Diagnóstico Integrativo"
                value={integrativeDx}
                onChange={setIntegrativeDx}
              />

              <EditableBlock
                title="Gargalo Primário"
                value={primaryBottleneck}
                onChange={setPrimaryBottleneck}
              />

              <EditableBlock
                title="Camadas Ativas"
                value={activeLayers}
                onChange={setActiveLayers}
              />

              <section className="pb-6">
                <div className="flex items-end justify-between gap-4 mb-3">
                  <h2 className="text-[14px] font-semibold text-slate-800">
                    Programas
                  </h2>
                  <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
                </div>

                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                  {PROGRAMS.map((p) => (
                    <ProgramAccordion
                      key={p}
                      name={p}
                      open={openProgram === p}
                      onToggle={() => setOpenProgram(openProgram === p ? null : p)}
                      value={programText[p]}
                      onChange={(v) =>
                        setProgramText((prev) => ({ ...prev, [p]: v }))
                      }
                    />
                  ))}
                </div>
              </section>

              <EditableBlock
                title="KPIs + Checkpoints (30 / 60 / 90 dias)"
                value={kpis}
                onChange={setKpis}
              />
            </div>
          </main>

          {/* RIGHT: System Status */}
          <aside className="no-print sticky top-6 h-[calc(100vh-48px)] rounded-xl border border-slate-200/60 bg-white/80 backdrop-blur-sm p-5 shadow-sm overflow-y-auto">
            {/* API Key Section */}
            <div className="mb-6">
              <h3 className="text-[12px] font-semibold text-slate-600 uppercase tracking-wide mb-3">
                API Configuration
              </h3>
              <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${apiKeyStatus === "saved" ? "bg-emerald-400" : apiKeyStatus === "invalid" ? "bg-red-400" : "bg-slate-300"}`} />
                  <span className="text-[11px] text-slate-500">
                    {apiKeyStatus === "saved" ? "API key configurada" : apiKeyStatus === "invalid" ? "Key inválida" : "Não configurada"}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full text-[12px] px-3 py-2 pr-8 rounded border border-slate-200 bg-white outline-none focus:border-slate-300 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[10px]"
                    aria-label={showApiKey ? "Ocultar API key" : "Mostrar API key"}
                  >
                    {showApiKey ? "●●●" : "👁"}
                  </button>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={handleSaveApiKey}
                    className="flex-1 text-[11px] px-2 py-1.5 rounded bg-slate-800 text-white hover:bg-slate-700 transition-colors"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={handleClearApiKey}
                    className="text-[11px] px-2 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Limpar
                  </button>
                </div>
              </div>
            </div>

            {/* System Alerts */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="text-[12px] font-semibold text-slate-600 uppercase tracking-wide">
                System Alerts
              </h3>
            </div>

            {engineAlerts.length === 0 ? (
              <div className="text-[13px] text-slate-400 mb-6 py-3 px-4 rounded-lg bg-slate-50 border border-slate-100">
                No active alerts
              </div>
            ) : (
              <div className="space-y-2 mb-6">
                {engineAlerts.map((a, i) => (
                  <div key={i} className="text-[13px] text-slate-700 py-2 px-3 rounded-lg bg-amber-50 border border-amber-100">
                    {a}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8">
              <h3 className="text-[12px] font-semibold text-slate-600 uppercase tracking-wide mb-3">
                Engine State
              </h3>

              <div className="rounded-lg bg-slate-50 border border-slate-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] uppercase text-slate-400 tracking-wide">Current Phase</span>
                  <span className="text-[16px] font-bold text-slate-800">{enginePhase}</span>
                </div>

                {engineBlocked.length === 0 ? (
                  <div className="text-[12px] text-slate-400 py-2">
                    No modules blocked
                  </div>
                ) : (
                  <div className="space-y-2 mt-3 pt-3 border-t border-slate-200">
                    {engineBlocked.map((b, i) => (
                      <div key={i} className="text-[12px] py-2 px-3 rounded bg-red-50 border border-red-100">
                        <div className="font-medium text-red-700">{b.module}</div>
                        <div className="text-red-500 text-[11px] mt-0.5">{b.reason}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </aside>

        </div>
      </div>
    </div>
  );
}
